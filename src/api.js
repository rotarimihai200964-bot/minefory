import { supabase } from './supabase.js';

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '') || '';

export async function apiRequest(path, { method = 'GET', body } = {}) {
  if (!supabase) throw new Error('Autentificarea Supabase nu este configurată.');

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Sesiunea nu a putut fi verificată: ${sessionError.message}`);
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Sesiunea a expirat. Autentifică-te din nou.');

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch {
    throw new Error('API-ul hostului nu este disponibil. Pornește backendul și verifică VITE_API_URL.');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    if (!response.ok) throw new Error(`API-ul hostului a returnat HTTP ${response.status}.`);
    throw new Error('Adresa API nu este configurată: site-ul a returnat HTML în loc de date API. Setează VITE_API_URL la URL-ul HTTPS al API-ului și reconstruiește frontend-ul.');
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('API-ul hostului a returnat un răspuns JSON invalid.');
  }
  if (!response.ok) throw new Error(result.error || `API-ul hostului a returnat HTTP ${response.status}.`);
  return result;
}
