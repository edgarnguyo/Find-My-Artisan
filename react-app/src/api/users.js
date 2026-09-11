import { request } from './client';

/**
 * Save an account in MySQL through Express. The password never leaves Supabase.
 * `account` is { id, email } plus, on sign-up, { name, role, artisan }.
 * Safe to call more than once: the route answers 409 when the row already exists.
 */
export async function saveUser(account) {
  try {
    return await request('/api/users', { method: 'POST', body: account });
  } catch (err) {
    if (err.status === 409) return account;
    throw err;
  }
}
