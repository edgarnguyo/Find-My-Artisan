const API_URL = 'http://localhost:5001';

/**
 * Save an account in MySQL through Express. The password never leaves Supabase.
 * `account` is { id, email } plus, on sign-up, { name, role, artisan }.
 * Safe to call more than once: the route answers 409 when the row already exists.
 */
export async function saveUser(account) {
  let res;
  try {
    res = await fetch(`${API_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    });
  } catch {
    // fetch only throws when no response came back at all, e.g. the server is off.
    // Browsers word that differently (Safari "Load failed", Chrome "Failed to fetch").
    throw new Error(`could not reach the API at ${API_URL}. Is the server running?`);
  }

  if (res.status === 409) return account;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}
