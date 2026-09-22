import { request } from './client';

/**
 * Sign up. A client is saved by POST /clients, an artisan by POST /profiles.
 * Returns the new user: { id, name, email, role }.
 */
export function register(details) {
  const path = details.role === 'artisan' ? '/profiles' : '/clients';
  return request(path, { method: 'POST', body: details });
}

/** Check an email and password. Returns { id, name, email, role }. */
export function login(email, password) {
  return request('/login', { method: 'POST', body: { email, password } });
}
