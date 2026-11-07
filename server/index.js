import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const execFileAsync = promisify(execFile);
const MAX_BODY_BYTES = 64 * 1024;
const MAX_JAR_BYTES = 256 * 1024 * 1024;
const MAX_SERVERS_PER_USER = 5;
const MAX_RAM_PER_USER_GB = 32;
const running = new Map();
const logs = new Map();
const reservedPorts = new Set();
const pendingProvisioning = new Map();
const pendingRamChanges = new Map();
let versionManifest;
let versionManifestExpires = 0;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function loadEnvFile() {
  try {
    const text = readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || Object.hasOwn(process.env, match[1])) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

loadEnvFile();

const JAVA_EXECUTABLES = {
  'Java 8': process.env.JAVA_8_PATH,
  'Java 11': process.env.JAVA_11_PATH,
  'Java 17': process.env.JAVA_17_PATH,
  'Java 21': process.env.JAVA_21_PATH,
  'Java 25': process.env.JAVA_25_PATH
};
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY;
const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
const host = process.env.HOST || process.env.API_HOST || '127.0.0.1';
const port = Number(process.env.PORT || process.env.API_PORT || 8787);
const dataRoot = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the backend .env file.');
}
if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  throw new Error('Set ADMIN_EMAIL to the administrator account email.');
}
if (allowedOrigins.size === 0 || allowedOrigins.has('*')) {
  throw new Error('Set ALLOWED_ORIGINS to the exact HTTPS frontend origin(s); wildcard CORS is not allowed.');
}
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT must be a valid TCP port.');
await mkdir(dataRoot, { recursive: true });

function serverKey(userId, serverId) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(serverId)) {
    throw new HttpError(400, 'Invalid account or server id.');
  }
  return `${userId}/${serverId}`;
}

function serverDirectory(userId, serverId) {
  return path.join(dataRoot, userId, serverId);
}

function metadataPath(userId, serverId) {
  return path.join(serverDirectory(userId, serverId), 'minefory.json');
}

function getStatus(userId, serverId) {
  const child = running.get(serverKey(userId, serverId));
  return child && child.exitCode === null && !child.killed ? 'Online' : 'Offline';
}

function publicServer(metadata, userId) {
  const { ownerId, ...server } = metadata;
  return { ...server, status: getStatus(userId, metadata.id) };
}

async function loadMetadata(userId, serverId) {
  let metadata;
  try {
    metadata = JSON.parse(await readFile(metadataPath(userId, serverId), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw new HttpError(404, 'Server not found.');
    throw error;
  }
  if (metadata.ownerId !== userId || metadata.id !== serverId) throw new HttpError(404, 'Server not found.');
  return metadata;
}

async function listUserMetadata(userId) {
  const ownerDirectory = path.join(dataRoot, userId);
  await mkdir(ownerDirectory, { recursive: true, mode: 0o700 });
  const entries = await readdir(ownerDirectory, { withFileTypes: true });
  const records = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[0-9a-f-]{36}$/i.test(entry.name)) continue;
    try {
      records.push(await loadMetadata(userId, entry.name));
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 404) throw error;
    }
  }
  return records;
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected a JSON object.');
    return body;
  } catch {
    throw new HttpError(400, 'Invalid JSON request body.');
  }
}

async function requireUser(request) {
  const authorization = request.headers.authorization || '';
  const match = authorization.match(/^Bearer ([^\s]+)$/);
  if (!match) throw new HttpError(401, 'Sign in to manage servers.');

  let response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${match[1]}` },
      signal: AbortSignal.timeout(8000)
    });
  } catch {
    throw new HttpError(503, 'Could not verify the account with Supabase.');
  }
  if (!response.ok) throw new HttpError(401, 'Your session is invalid or expired.');
  const user = await response.json();
  if (!user.id || typeof user.email !== 'string' || user.email.trim().toLowerCase() !== adminEmail) {
    throw new HttpError(403, 'This panel is restricted to its administrator account.');
  }
  return user.id;
}

async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'MineforyHost/1.0' } });
  } catch {
    throw new HttpError(502, 'Could not reach the official Minecraft download service.');
  }
  if (!response.ok) throw new HttpError(502, `Official download service returned HTTP ${response.status}.`);
  return response.json();
}

async function getManifest() {
  if (!versionManifest || Date.now() > versionManifestExpires) {
    versionManifest = await fetchJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
    versionManifestExpires = Date.now() + 10 * 60 * 1000;
  }
  return versionManifest;
}

function validateVersion(version) {
  if (typeof version !== 'string' || !/^\d+\.\d+(?:\.\d+)?$/.test(version)) {
    throw new HttpError(400, 'Select a valid Minecraft release version.');
  }
}

function validateServerOptions(body, current = {}) {
  const next = { ...current };
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 40 || /[\r\n\0]/.test(body.name)) {
      throw new HttpError(400, 'Server name must be between 1 and 40 characters.');
    }
    next.name = body.name.trim();
  }
  if (body.version !== undefined) {
    validateVersion(body.version);
    next.version = body.version;
  }
  if (body.software !== undefined) {
    if (!['Paper', 'Vanilla'].includes(body.software)) throw new HttpError(400, 'Only Paper and Vanilla installers are supported.');
    next.software = body.software;
  }
  if (body.javaVersion !== undefined) {
    if (!Object.hasOwn(JAVA_EXECUTABLES, body.javaVersion)) throw new HttpError(400, 'Unsupported Java runtime selection.');
    next.javaVersion = body.javaVersion;
  }
  if (body.ram !== undefined) {
    if (!Number.isInteger(body.ram) || body.ram < 1 || body.ram > 32) throw new HttpError(400, 'RAM must be between 1 and 32 GB.');
    next.ram = body.ram;
  }
  if (body.maxPlayers !== undefined) {
    const maxPlayers = Number(body.maxPlayers);
    if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 500) throw new HttpError(400, 'Maximum players must be between 1 and 500.');
    next.maxPlayers = maxPlayers;
  }
  if (body.motd !== undefined) {
    if (typeof body.motd !== 'string' || body.motd.length > 100 || /[\r\n]/.test(body.motd)) throw new HttpError(400, 'MOTD must be a single line of 100 characters or fewer.');
    next.motd = body.motd;
  }
  if (body.eulaAccepted !== undefined) {
    if (typeof body.eulaAccepted !== 'boolean') throw new HttpError(400, 'EULA acceptance must be true or false.');
    next.eulaAccepted = body.eulaAccepted;
  }
  if (body.plugins !== undefined) {
    if (!Array.isArray(body.plugins) || body.plugins.length > 40 || body.plugins.some(id => typeof id !== 'string' || !/^[a-z0-9-]{1,50}$/.test(id))) {
      throw new HttpError(400, 'Invalid plugin selection.');
    }
    next.plugins = [...new Set(body.plugins)];
  }
  return next;
}

function decodeFilePath(encodedPath) {
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    throw new HttpError(400, 'Invalid encoded file path.');
  }
}

async function downloadToFile(url, destination, expectedHash, algorithm) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(120000), headers: { 'User-Agent': 'MineforyHost/1.0' } });
  } catch {
    throw new HttpError(502, 'The server JAR download failed.');
  }
  if (!response.ok || !response.body) throw new HttpError(502, `The JAR service returned HTTP ${response.status}.`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_JAR_BYTES) throw new HttpError(413, 'The selected server JAR is too large.');
  const temporary = `${destination}.download-${randomUUID()}`;
  const hash = createHash(algorithm);
  let bytes = 0;
  const hashStream = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > MAX_JAR_BYTES) return callback(new HttpError(413, 'The selected server JAR is too large.'));
      hash.update(chunk);
      callback(null, chunk);
    }
  });
  try {
    await pipeline(response.body, hashStream, createWriteStream(temporary, { flags: 'wx' }));
    if (expectedHash && hash.digest('hex').toLowerCase() !== expectedHash.toLowerCase()) {
      throw new HttpError(502, 'The downloaded server JAR failed its checksum verification.');
    }
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function installServerJar(directory, version, software) {
  const destination = path.join(directory, 'server.jar');
  if (software === 'Vanilla') {
    const manifest = await getManifest();
    const entry = manifest.versions.find(item => item.id === version && item.type === 'release');
    if (!entry) throw new HttpError(404, `Minecraft release ${version} was not found.`);
    const versionInfo = await fetchJson(entry.url);
    const download = versionInfo.downloads?.server;
    if (!download?.url || !download.sha1) throw new HttpError(404, `No official server JAR is available for Minecraft ${version}.`);
    await downloadToFile(download.url, destination, download.sha1, 'sha1');
    return;
  }

  const builds = await fetchJson(`https://fill.papermc.io/v3/projects/paper/versions/${encodeURIComponent(version)}/builds`);
  const availableBuilds = Array.isArray(builds) ? builds : [];
  const build = availableBuilds.find(item => item.channel === 'STABLE' && item.downloads?.['server:default']?.url && item.downloads['server:default'].checksums?.sha256)
    || availableBuilds.find(item => item.downloads?.['server:default']?.url && item.downloads['server:default'].checksums?.sha256);
  if (!build) throw new HttpError(404, `No verifiable Paper build is available for Minecraft ${version}.`);
  const artifact = build.downloads['server:default'];
  await downloadToFile(artifact.url, destination, artifact.checksums.sha256, 'sha256');
}

function safeTextPath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length > 240 || relativePath.includes('\\')) {
    throw new HttpError(400, 'Invalid file path.');
  }
  const segments = relativePath.split('/');
  const allowedExtension = /\.(txt|properties|json|ya?ml|cfg|toml|conf|md)$/i;
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || !/^[A-Za-z0-9._ -]+$/.test(segment)) || !allowedExtension.test(segments.at(-1))) {
    throw new HttpError(400, 'Only safe relative paths to text configuration files are allowed.');
  }
  return segments;
}

async function assertSafeFilePath(directory, segments, allowMissing = false) {
  let current = directory;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || (index < segments.length - 1 && !info.isDirectory())) throw new HttpError(400, 'Unsafe file path.');
    } catch (error) {
      if (error.code === 'ENOENT' && allowMissing) continue;
      if (error.code === 'ENOENT') throw new HttpError(404, 'File not found.');
      throw error;
    }
  }
  const resolved = path.resolve(current);
  if (!resolved.startsWith(`${path.resolve(directory)}${path.sep}`)) throw new HttpError(400, 'Unsafe file path.');
  return resolved;
}

async function listFiles(directory, relative = '', depth = 0) {
  if (depth > 8) return [];
  const absolute = relative ? path.join(directory, ...relative.split('/')) : directory;
  const entries = await readdir(absolute, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink() || entry.name === 'minefory.json' || entry.name.startsWith('server.jar.download-')) continue;
    const itemPath = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push({ path: itemPath, type: 'folder' }, ...await listFiles(directory, itemPath, depth + 1));
    else if (entry.isFile() && /\.(txt|properties|json|ya?ml|cfg|toml|conf|md)$/i.test(entry.name)) result.push({ path: itemPath, type: 'file', size: (await lstat(path.join(directory, ...itemPath.split('/')))).size });
  }
  return result;
}

async function writeMetadata(metadata) {
  await writeFile(metadataPath(metadata.ownerId, metadata.id), JSON.stringify(metadata, null, 2), { mode: 0o600 });
}

async function serverJarMissing(directory) {
  try {
    return !(await lstat(path.join(directory, 'server.jar'))).isFile();
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    throw error;
  }
}

async function allocatePort() {
  const usedPorts = new Set(reservedPorts);
  const owners = await readdir(dataRoot, { withFileTypes: true });
  for (const owner of owners) {
    if (!owner.isDirectory() || !/^[0-9a-f-]{36}$/i.test(owner.name)) continue;
    for (const entry of await readdir(path.join(dataRoot, owner.name), { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[0-9a-f-]{36}$/i.test(entry.name)) continue;
      try {
        const metadata = JSON.parse(await readFile(path.join(dataRoot, owner.name, entry.name, 'minefory.json'), 'utf8'));
        if (Number.isInteger(metadata.port)) usedPorts.add(metadata.port);
      } catch (error) {
        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      }
    }
  }
  for (let port = 25565; port <= 25664; port += 1) {
    if (!usedPorts.has(port)) {
      reservedPorts.add(port);
      return port;
    }
  }
  throw new HttpError(503, 'No Minecraft ports are available in the configured range 25565-25664.');
}

async function stopServer(userId, serverId) {
  const key = serverKey(userId, serverId);
  const child = running.get(key);
  if (!child || child.exitCode !== null || child.killed) throw new HttpError(409, 'Server is not running.');
  child.stdin.write('stop\n');
}

async function startServer(userId, serverId, metadata, directory) {
  const eula = await readFile(path.join(directory, 'eula.txt'), 'utf8');
  if (!/^eula=true\s*$/im.test(eula)) throw new HttpError(409, 'Accept the Minecraft EULA in server settings before starting.');
  const javaPath = JAVA_EXECUTABLES[metadata.javaVersion] || process.env.JAVA_PATH || 'java';
  let javaVersion;
  try {
    const result = await execFileAsync(javaPath, ['-version'], { timeout: 10000, windowsHide: true });
    const versionText = `${result.stdout || ''}\n${result.stderr || ''}`;
    const versionMatch = versionText.match(/version\s+"(\d+)(?:\.(\d+))?/i);
    javaVersion = versionMatch?.[1] === '1' ? versionMatch[2] : versionMatch?.[1];
  } catch {
    throw new HttpError(503, `Could not run ${metadata.javaVersion}. Set its executable path in the backend environment.`);
  }
  if (javaVersion !== metadata.javaVersion.replace('Java ', '')) {
    throw new HttpError(409, `${metadata.javaVersion} is selected but Java ${javaVersion || 'unknown'} is configured.`);
  }
  const [major, minor, patch = 0] = metadata.version.split('.').map(Number);
  const minimumJava = major > 1 || minor > 20 || (minor === 20 && patch >= 5) ? 21 : minor >= 17 ? 17 : 8;
  const selectedJavaMajor = Number(metadata.javaVersion.match(/\d+/)?.[0]);
  if (selectedJavaMajor < minimumJava) {
    throw new HttpError(409, `Minecraft ${metadata.version} requires Java ${minimumJava} or newer.`);
  }
  const child = spawn(javaPath, ['-Xms512M', `-Xmx${metadata.ram}G`, '-jar', 'server.jar', 'nogui'], {
    cwd: directory, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
  });
  const key = serverKey(userId, serverId);
  running.set(key, child);
  logs.set(key, []);
  const appendLog = chunk => {
    const entries = logs.get(key) || [];
    entries.push(...chunk.toString('utf8').split(/\r?\n/).filter(Boolean));
    logs.set(key, entries.slice(-500));
  };
  child.stdout.on('data', appendLog);
  child.stderr.on('data', appendLog);
  child.on('error', error => appendLog(Buffer.from(`[Minefory API] ${error.message}`)));
  child.on('exit', (code, signal) => {
    appendLog(Buffer.from(`[Minefory API] Server stopped (code ${code ?? 'none'}, signal ${signal ?? 'none'}).`));
    running.delete(key);
  });
  return child;
}

async function handleApi(request, response, url) {
  if (url.pathname === '/api/health' && request.method === 'GET') {
    return sendJson(response, 200, { status: 'ok' });
  }

  const userId = await requireUser(request);
  const collectionPath = url.pathname === '/api/servers';

  if (collectionPath && request.method === 'GET') {
    const records = await listUserMetadata(userId);
    return sendJson(response, 200, { servers: records.map(metadata => publicServer(metadata, userId)) });
  }

  if (collectionPath && request.method === 'POST') {
    const body = await readJsonBody(request);
    const version = body.version;
    validateVersion(version);
    const metadata = validateServerOptions({ ...body, software: body.software || 'Paper' });
    if (!metadata.name) throw new HttpError(400, 'Server name is required.');
    const existing = await listUserMetadata(userId);
    const pending = pendingProvisioning.get(userId) || { servers: 0, ram: 0 };
    const requestedRam = metadata.ram || 2;
    const allocatedRam = existing.reduce((total, server) => total + (server.ram || 0), 0);
    if (existing.length + pending.servers >= MAX_SERVERS_PER_USER) throw new HttpError(429, `Each account can create up to ${MAX_SERVERS_PER_USER} servers.`);
    if (allocatedRam + pending.ram + requestedRam > MAX_RAM_PER_USER_GB) throw new HttpError(429, `Each account can allocate up to ${MAX_RAM_PER_USER_GB} GB RAM across all servers.`);
    pending.servers += 1;
    pending.ram += requestedRam;
    pendingProvisioning.set(userId, pending);
    const id = randomUUID();
    const directory = serverDirectory(userId, id);
    let port;
    try {
      await mkdir(path.join(dataRoot, userId), { recursive: true, mode: 0o700 });
      port = await allocatePort();
      await mkdir(directory, { recursive: false, mode: 0o700 });
      await installServerJar(directory, version, metadata.software);
      const now = new Date().toISOString();
      const stored = {
        id, ownerId: userId, name: metadata.name, game: 'Minecraft Java',
        version, javaVersion: metadata.javaVersion || 'Java 21',
        software: metadata.software, ram: metadata.ram || 2,
        maxPlayers: metadata.maxPlayers || 20,
        motd: metadata.motd || metadata.name, eulaAccepted: false, port,
        address: `${process.env.MINECRAFT_HOST || '127.0.0.1'}:${port}`,
        plugins: [], createdAt: now, updatedAt: now
      };
      await mkdir(path.join(directory, 'plugins'), { mode: 0o700 });
      await writeFile(path.join(directory, 'eula.txt'), 'eula=false\n', { mode: 0o600 });
      await writeFile(path.join(directory, 'server.properties'), `server-port=${port}\nmotd=${stored.motd}\nmax-players=${stored.maxPlayers}\nonline-mode=true\n`, { mode: 0o600 });
      await writeMetadata(stored);
      return sendJson(response, 201, { server: publicServer(stored, userId) });
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      if (port !== undefined) reservedPorts.delete(port);
      throw error;
    } finally {
      pending.servers -= 1;
      pending.ram -= requestedRam;
      if (pending.servers === 0) pendingProvisioning.delete(userId);
    }
  }

  const match = url.pathname.match(/^\/api\/servers\/([0-9a-f-]{36})(?:\/(start|stop|restart|command|logs|files(?:\/.*)?))?$/i);
  if (!match) throw new HttpError(404, 'API endpoint not found.');
  const serverId = match[1];
  const action = match[2] || '';
  const metadata = await loadMetadata(userId, serverId);
  const directory = serverDirectory(userId, serverId);

  if (!action && request.method === 'GET') return sendJson(response, 200, { server: publicServer(metadata, userId) });

  if (!action && request.method === 'PATCH') {
    if (getStatus(userId, serverId) === 'Online') throw new HttpError(409, 'Stop the server before changing its version or settings.');
    const body = await readJsonBody(request);
    const updated = validateServerOptions(body, metadata);
    const userServers = await listUserMetadata(userId);
    const allocatedRam = userServers.reduce((total, server) => total + (server.id === serverId ? updated.ram || 0 : server.ram || 0), 0);
    const ramChange = Math.max(0, (updated.ram || 0) - (metadata.ram || 0));
    const pendingRamChange = pendingRamChanges.get(userId) || 0;
    if (allocatedRam + pendingRamChange + ramChange > MAX_RAM_PER_USER_GB) throw new HttpError(429, `Each account can allocate up to ${MAX_RAM_PER_USER_GB} GB RAM across all servers.`);
    if (ramChange > 0) pendingRamChanges.set(userId, pendingRamChange + ramChange);
    try {
      if (updated.version !== metadata.version || updated.software !== metadata.software || await serverJarMissing(directory)) {
        await installServerJar(directory, updated.version, updated.software);
      }
      if (updated.eulaAccepted !== undefined) {
        await writeFile(path.join(directory, 'eula.txt'), `eula=${updated.eulaAccepted}\n`, { mode: 0o600 });
      }
      if (updated.maxPlayers !== undefined || updated.motd !== undefined) {
        await writeFile(path.join(directory, 'server.properties'), `server-port=${updated.port}\nmotd=${updated.motd}\nmax-players=${updated.maxPlayers}\nonline-mode=true\n`, { mode: 0o600 });
      }
      updated.updatedAt = new Date().toISOString();
      await writeMetadata(updated);
      return sendJson(response, 200, { server: publicServer(updated, userId) });
    } finally {
      if (ramChange > 0) {
        const remaining = (pendingRamChanges.get(userId) || 0) - ramChange;
        if (remaining === 0) pendingRamChanges.delete(userId);
        else pendingRamChanges.set(userId, remaining);
      }
    }
  }

  if (!action && request.method === 'DELETE') {
    if (getStatus(userId, serverId) === 'Online') throw new HttpError(409, 'Stop the server before deleting it.');
    await rm(directory, { recursive: true, force: false });
    reservedPorts.delete(metadata.port);
    return sendJson(response, 200, { deleted: serverId });
  }

  if (action === 'start' && request.method === 'POST') {
    if (getStatus(userId, serverId) === 'Online') throw new HttpError(409, 'Server is already running.');
    await startServer(userId, serverId, metadata, directory);
    return sendJson(response, 202, { server: publicServer(metadata, userId), status: 'Starting' });
  }

  if (action === 'stop' && request.method === 'POST') {
    await stopServer(userId, serverId);
    return sendJson(response, 202, { status: 'Stopping' });
  }

  if (action === 'restart' && request.method === 'POST') {
    if (getStatus(userId, serverId) !== 'Online') throw new HttpError(409, 'Start the server before restarting it.');
    const child = running.get(serverKey(userId, serverId));
    child.once('exit', () => {
      setTimeout(() => {
        startServer(userId, serverId, metadata, directory).catch(error => {
          const entries = logs.get(serverKey(userId, serverId)) || [];
          entries.push(`[Minefory API] Restart failed: ${error.message}`);
          logs.set(serverKey(userId, serverId), entries.slice(-500));
        });
      }, 1000).unref();
    });
    await stopServer(userId, serverId);
    return sendJson(response, 202, { status: 'Restarting' });
  }

  if (action === 'command' && request.method === 'POST') {
    const body = await readJsonBody(request);
    if (getStatus(userId, serverId) !== 'Online') throw new HttpError(409, 'Server is not running.');
    if (typeof body.command !== 'string' || !body.command.trim() || body.command.length > 500 || /[\r\n]/.test(body.command)) {
      throw new HttpError(400, 'Enter a single server command of 1 to 500 characters.');
    }
    running.get(serverKey(userId, serverId)).stdin.write(`${body.command.trim()}\n`);
    return sendJson(response, 202, { accepted: true });
  }

  if (action === 'logs' && request.method === 'GET') {
    return sendJson(response, 200, { logs: logs.get(serverKey(userId, serverId)) || [], status: getStatus(userId, serverId) });
  }
  if (action === 'logs' && request.method === 'DELETE') {
    logs.set(serverKey(userId, serverId), []);
    return sendJson(response, 200, { cleared: true });
  }

  if (action === 'files' && request.method === 'GET') {
    const relative = decodeFilePath(url.pathname.slice(`/api/servers/${serverId}/files`.length).replace(/^\/+/, ''));
    const directoryPath = relative ? await assertSafeFilePath(directory, safeTextPath(`${relative}/placeholder.txt`).slice(0, -1)) : directory;
    const files = await listFiles(directoryPath);
    return sendJson(response, 200, { files: files.map(file => relative ? { ...file, path: `${relative}/${file.path}` } : file) });
  }

  if (action === 'files' && request.method === 'POST') {
    if (getStatus(userId, serverId) === 'Online') throw new HttpError(409, 'Stop the server before creating files.');
    const body = await readJsonBody(request);
    const segments = safeTextPath(body.path);
    const filePath = await assertSafeFilePath(directory, segments, true);
    if (typeof body.content !== 'string' || Buffer.byteLength(body.content) > MAX_BODY_BYTES) {
      throw new HttpError(400, 'File content must be text under 64 KB.');
    }
    try {
      await writeFile(filePath, body.content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    } catch (error) {
      if (error.code === 'EEXIST') throw new HttpError(409, 'File already exists.');
      throw error;
    }
    return sendJson(response, 201, { saved: true, path: segments.join('/') });
  }

  const fileMatch = action.match(/^files\/(.+)$/);
  if (fileMatch && request.method === 'GET') {
    const segments = safeTextPath(decodeFilePath(fileMatch[1]));
    const filePath = await assertSafeFilePath(directory, segments);
    const content = await readFile(filePath, 'utf8');
    if (Buffer.byteLength(content) > MAX_BODY_BYTES) throw new HttpError(413, 'File is too large to edit in the panel.');
    return sendJson(response, 200, { path: segments.join('/'), content });
  }

  if (fileMatch && request.method === 'PUT') {
    if (getStatus(userId, serverId) === 'Online') throw new HttpError(409, 'Stop the server before editing files.');
    const segments = safeTextPath(decodeFilePath(fileMatch[1]));
    const filePath = await assertSafeFilePath(directory, segments, true);
    const body = await readJsonBody(request);
    if (typeof body.content !== 'string') throw new HttpError(400, 'File content must be text.');
    if (segments.length === 1 && segments[0] === 'eula.txt') {
      if (!/^eula=(true|false)\s*$/im.test(body.content.trim())) throw new HttpError(400, 'EULA file must contain eula=true or eula=false.');
      metadata.eulaAccepted = /^eula=true\s*$/im.test(body.content.trim());
      metadata.updatedAt = new Date().toISOString();
      await writeMetadata(metadata);
    }
    await writeFile(filePath, body.content, { encoding: 'utf8', mode: 0o600 });
    return sendJson(response, 200, { saved: true, path: segments.join('/') });
  }

  throw new HttpError(405, 'Method not allowed.');
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

const api = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  } else if (origin) {
    return sendJson(response, 403, { error: 'Origin not allowed.' });
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    return response.end();
  }
  try {
    await handleApi(request, response, new URL(request.url, `http://${request.headers.host || 'localhost'}`));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error('[Minefory API]', error);
    if (!response.headersSent) sendJson(response, status, { error: status === 500 ? 'Internal server error.' : error.message });
    else response.destroy();
  }
});

api.listen(port, host, () => {
  console.log(`Minefory API listening on http://${host}:${port}`);
  console.log(`Server data directory: ${dataRoot}`);
});

async function shutdown() {
  api.close();
  for (const child of running.values()) {
    if (child.exitCode === null && !child.killed) child.stdin.write('stop\n');
  }
  setTimeout(() => {
    for (const child of running.values()) {
      if (child.exitCode === null && !child.killed) child.kill();
    }
    process.exit(0);
  }, 10000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
