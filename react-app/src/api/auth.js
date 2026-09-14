import { request } from './client';

/**
 * Create an account. The server hashes the password and saves the login plus
 * the client or artisan profile. Resolves to { token, user }.
 *
 * details = { email, password, role: 'client' | 'artisan', name,
 *             phone, location              (client)
 *             skill, location, price, bio  (artisan) }
 */
export function signUp(details) {
  return request('/api/auth/signup', { method: 'POST', body: details });
}

/** Check an email and password. Resolves to { token, user }. */
export function signIn(email, password) {
  return request('/api/auth/signin', { method: 'POST', body: { email, password } });
}

/** The user the stored token belongs to. Rejects with status 401 if it's no longer valid. */
export async function fetchMe() {
  const { user } = await request('/api/auth/me');
  return user;
}
