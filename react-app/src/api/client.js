import { supabase } from '../lib/supabaseClient';

export const API_URL = 'http://localhost:5001';

/**
 * Call the Express API and return the parsed JSON body.
 *
 * When someone is signed in, their Supabase access token goes along as
 * "Authorization: Bearer <token>" so the server can tell who is asking.
 * Throws an Error with the server's message and the HTTP status on `err.status`.
 */
export async function request(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch only throws when no response came back at all, e.g. the server is off.
    // Browsers word that differently (Safari "Load failed", Chrome "Failed to fetch").
    throw new Error(`could not reach the API at ${API_URL}. Is the server running?`);
  }

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(payload?.error ?? `Request failed with status ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return payload;
}
