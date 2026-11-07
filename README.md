# Minefory Host

The project has a React panel and a Node.js API that downloads Minecraft server JARs, stores each account's server files separately, and starts/stops Java server processes.

## Requirements

- Node.js 20 or newer
- A Supabase project with Email authentication enabled
- Java runtimes installed on the host for the versions you plan to use

## Local setup

1. Copy `.env.example` to `.env`.
2. The provided `.env.example` is prefilled with this project's Supabase URL and publishable key. Copy it to `.env` and use `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` in the frontend and `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` in the API. The publishable key is safe for browser use; never use `SUPABASE_SECRET_KEY` or a `service_role` key.
3. Keep `API_HOST=127.0.0.1` for local development. Set `ALLOWED_ORIGINS=http://localhost:5173`.
4. Configure Java executable paths (for example `JAVA_21_PATH=C:\Program Files\Eclipse Adoptium\jdk-21\bin\java.exe`). The selected Java version is checked before starting a server.
5. In Supabase, enable the Email provider. For immediate sign-in after registration, turn off email confirmation under **Authentication → Providers → Email**; with confirmation enabled, users must confirm their address before signing in. Keep confirmation enabled for a public service if you require verified addresses.
6. Install dependencies and run the frontend and API in separate terminals:

   ```sh
   npm install
   npm run api
   npm run dev
   ```

Vite proxies `/api` to the local API. Server data and JARs are stored under `data/` and are excluded from Git.
Email addresses are trimmed and normalized to lowercase before authentication. Supabase enforces unique accounts for an email address; registration also requires a password confirmation and at least 8 characters.

## Remote deployment

- Put the API behind a reverse proxy with HTTPS. Keep the Node API bound to `127.0.0.1`; do not expose it directly to the public internet.
- Set `ALLOWED_ORIGINS` to the exact HTTPS origin of the panel and set the frontend `VITE_API_URL` to the API's HTTPS origin at build time.
- Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATA_DIR`, `MINECRAFT_HOST`, and Java paths on the API host. The publishable key can be used to validate Supabase sessions; never use a `SUPABASE_SECRET_KEY` or `service_role` key in the browser or API config.
- Configure Supabase's Site URL and allowed redirect URLs for the deployed panel. Configure SMTP for confirmation and password-recovery mail.
- Open the allocated Minecraft TCP port range (25565-25664) in the host firewall and set `MINECRAFT_HOST` to the address players should use.

### Node.js hosting panel / Egg

The `.env` file does not install or start the API. Upload the project files to the Node.js service's working directory (the directory containing `package.json`), install dependencies with `npm install`, and use `npm run api` as its startup command. The API reads `.env` from that working directory.

Set the Node service's `HOST` to `0.0.0.0` and `PORT` to the port allocated by the hosting panel. These standard variables take precedence over `API_HOST` and `API_PORT`. Set `ALLOWED_ORIGINS` to the exact HTTPS origin of the panel UI, and configure `VITE_API_URL` to the API's public HTTPS URL when building the frontend. The example file's localhost values are for local development and must be changed for a remote deployment. The browser cannot call a plain HTTP API from an HTTPS panel; if the host does not provide HTTPS for the API, use a reverse proxy with TLS or host the API on a VPS you control.

Keep the API in its own persistent Node.js service, not inside a Minecraft server's Java startup process. The API starts Java child processes itself and needs the selected Java executable plus allocated Minecraft ports. Verify the hosting provider permits this before using it as a game-server host.

## API

All server endpoints except `/api/health` require `Authorization: Bearer <Supabase access token>`. The API validates the token with Supabase and scopes server IDs and files to the authenticated user.

- `GET /api/servers` — list the caller's servers
- `POST /api/servers` — download and checksum-verify the selected official Vanilla or Paper `server.jar`
- `GET`, `PATCH`, `DELETE /api/servers/:id` — inspect, configure (while stopped), or delete a server
- `POST /api/servers/:id/start`, `/stop`, `/restart`, `/command` — manage the Java process
- `GET /api/servers/:id/logs` — read process output; `DELETE` clears it
- `GET /api/servers/:id/files` and `/files/:path` — list/read safe text configuration files; `POST` creates and `PUT` edits files

Starting a server requires the user to accept the Minecraft EULA in its settings and the selected Java runtime to be installed. Vanilla JARs come from Mojang's official manifest; Paper JARs come from PaperMC's v3 API. Both downloads are checksum-verified.

The API limits each account to 5 servers and 32 GB of configured RAM across those servers.

The plugin catalog is still a UI selection only; it does not download third-party plugin JARs. This API manages Minecraft server files/processes but does not replace a production isolation layer such as Pterodactyl/Wings or containers. Run it only on a host you control, use HTTPS remotely, and keep server data backed up.
