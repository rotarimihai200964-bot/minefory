import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const allowedActions = new Set(['status', 'resources', 'service_status', 'restart_service', 'reboot']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

function isPublicHttpsUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  const ipLiteral = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || /^\[[0-9a-f:]+\]$/i.test(hostname);
  const localHostname = ['localhost', 'localhost.', 'metadata.google.internal'].includes(hostname)
    || /\.(local|internal|localhost|test|invalid|example)$/.test(hostname);
  return url.protocol === 'https:' && hostname.includes('.') && !ipLiteral && !localHostname;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Metodă neacceptată.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Autentificare necesară.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Configurația server-side Supabase lipsește.' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.email) return json({ error: 'Sesiunea nu este validă.' }, 401);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const email = userData.user.email.trim().toLowerCase();
  const { data: member, error: memberError } = await serviceClient
    .from('minefory_members')
    .select('role')
    .eq('email', email)
    .maybeSingle();
  if (memberError) return json({ error: 'Rolul contului nu a putut fi verificat.' }, 500);
  if (!member || !['owner', 'co_owner'].includes(member.role)) return json({ error: 'Acces refuzat.' }, 403);

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 8192) return json({ error: 'Cererea este prea mare.' }, 413);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Corpul cererii nu este JSON valid.' }, 400);
  }

  if (body.operation === 'configure') {
    const machine = body.machine;
    if (!machine || typeof machine !== 'object') return json({ error: 'Datele mașinii lipsesc.' }, 400);
    const candidate = machine as Record<string, unknown>;
    const id = typeof candidate.id === 'string' ? candidate.id : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const platform = candidate.platform;
    const endpoint = typeof candidate.endpoint === 'string' ? candidate.endpoint : '';
    const serviceName = typeof candidate.service_name === 'string' ? candidate.service_name.trim() : null;
    const token = typeof candidate.agent_token === 'string' ? candidate.agent_token.trim() : '';
    let parsedEndpoint: URL;
    try {
      parsedEndpoint = new URL(endpoint);
    } catch {
      return json({ error: 'Endpointul agentului nu este un URL valid.' }, 400);
    }
    if (!uuidPattern.test(id) || !name || name.length > 60) {
      return json({ error: 'Identificatorul sau numele mașinii nu este valid.' }, 400);
    }
    if (platform !== 'ubuntu' && platform !== 'termux') return json({ error: 'Platformă neacceptată.' }, 400);
    if (!isPublicHttpsUrl(parsedEndpoint) || parsedEndpoint.username || parsedEndpoint.password || parsedEndpoint.search || parsedEndpoint.hash) {
      return json({ error: 'Agentul trebuie să aibă un endpoint HTTPS fără credențiale sau parametri.' }, 400);
    }
    if (token.length < 32 || token.length > 256) return json({ error: 'Tokenul agentului trebuie să aibă între 32 și 256 de caractere.' }, 400);
    if (platform === 'ubuntu' && (!serviceName || !/^[A-Za-z0-9_.@-]{1,100}$/.test(serviceName))) {
      return json({ error: 'Serviciul Ubuntu nu este valid.' }, 400);
    }
    if (platform === 'termux' && serviceName && !/^[A-Za-z0-9_.@-]{1,100}$/.test(serviceName)) {
      return json({ error: 'Serviciul Termux nu este valid.' }, 400);
    }

    const { error: machineError } = await serviceClient.from('minefory_machines').upsert({
      id, name, platform, endpoint: parsedEndpoint.origin + parsedEndpoint.pathname.replace(/\/+$/, ''),
      service_name: serviceName || null, enabled: true, created_by: userData.user.id
    });
    if (machineError) return json({ error: `Mașina nu a putut fi salvată: ${machineError.message}` }, 400);
    const { error: credentialError } = await serviceClient.from('minefory_machine_credentials')
      .upsert({ machine_id: id, agent_token: token, updated_at: new Date().toISOString() });
    if (credentialError) return json({ error: 'Mașina a fost salvată, dar tokenul nu a putut fi stocat. Reîncearcă salvarea.' }, 500);
    return json({ ok: true });
  }

  if (body.operation === 'delete') {
    const id = typeof body.machine_id === 'string' ? body.machine_id : '';
    if (!uuidPattern.test(id)) return json({ error: 'Identificatorul mașinii nu este valid.' }, 400);
    const { error } = await serviceClient.from('minefory_machines').delete().eq('id', id);
    if (error) return json({ error: `Mașina nu a putut fi ștearsă: ${error.message}` }, 500);
    return json({ ok: true });
  }

  if (body.operation !== 'action') return json({ error: 'Operație neacceptată.' }, 400);
  const id = typeof body.machine_id === 'string' ? body.machine_id : '';
  const action = typeof body.action === 'string' ? body.action : '';
  if (!uuidPattern.test(id) || !allowedActions.has(action)) {
    return json({ error: 'Mașina sau acțiunea nu este validă.' }, 400);
  }
  if (action === 'reboot' && body.confirm_reboot !== true) return json({ error: 'Rebootul necesită confirmare explicită.' }, 400);

  const { data: machine, error: machineError } = await serviceClient.from('minefory_machines')
    .select('id,platform,endpoint,service_name,enabled')
    .eq('id', id).maybeSingle();
  if (machineError) return json({ error: 'Configurația mașinii nu a putut fi citită.' }, 500);
  if (!machine || !machine.enabled) return json({ error: 'Mașina nu există sau este dezactivată.' }, 404);
  if (action === 'reboot' && machine.platform !== 'ubuntu') return json({ error: 'Rebootul este disponibil doar pentru Ubuntu.' }, 400);
  if (['service_status', 'restart_service'].includes(action) && !machine.service_name) {
    return json({ error: 'Nu este configurat un serviciu allowlist pentru această mașină.' }, 400);
  }

  const { data: credential, error: credentialError } = await serviceClient.from('minefory_machine_credentials')
    .select('agent_token')
    .eq('machine_id', id).maybeSingle();
  if (credentialError) return json({ error: 'Credențialul agentului nu a putut fi citit.' }, 500);
  if (!credential?.agent_token) return json({ error: 'Mașina nu are un agent asociat.' }, 404);

  try {
    const response = await fetch(`${machine.endpoint.replace(/\/+$/, '')}/v1/action`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.agent_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, service_name: machine.service_name }),
      signal: AbortSignal.timeout(10000)
    });
    const responseText = await response.text();
    if (responseText.length > 4096) return json({ error: 'Răspunsul agentului este prea mare.' }, 502);
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(responseText);
    } catch {
      return json({ error: 'Agentul a returnat un răspuns invalid.' }, 502);
    }
    if (!response.ok) return json({ error: typeof result.error === 'string' ? result.error : `Agentul a răspuns cu HTTP ${response.status}.` }, 502);
    return json({ ok: true, result });
  } catch (error) {
    const detail = error instanceof Error && error.name === 'TimeoutError'
      ? 'Agentul nu a răspuns în 10 secunde.'
      : 'Agentul nu este accesibil. Verifică endpointul HTTPS și tunelul securizat.';
    return json({ error: detail }, 502);
  }
});
