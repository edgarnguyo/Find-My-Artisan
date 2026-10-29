import { request } from './client';

// Signing up or in makes the server set an httpOnly sign-in cookie (see
// server/session.js). The browser sends it with every request after that, and
// the page's JavaScript can't read it, so nothing here stores the account.

/**
 * Sign up, which also signs you in. A client is saved by POST /clients, an
 * artisan by POST /profiles. Returns the new user: { id, name, email, role }.
 */
export function register(details) {
  const path = details.role === 'artisan' ? '/profiles' : '/clients';
  return request(path, { method: 'POST', body: details });
}

/** Check an email and password and sign in. Returns { id, name, email, role }. */
export function login(email, password) {
  return request('/login', { method: 'POST', body: { email, password } });
}

/** Who the sign-in cookie belongs to: { id, name, email, role }, or null if nobody. */
export async function fetchSignedInUser() {
  try {
    return await request('/login');
  } catch (err) {
    if (err.status === 401) return null;
    throw err;
  }
}

/** Sign out: the server clears the cookie. */
export async function logout() {
  await request('/login', { method: 'DELETE' });
}
