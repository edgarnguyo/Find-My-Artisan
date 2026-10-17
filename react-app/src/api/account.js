import { request } from './client';

// The account page. A client's account lives under /clients, an artisan's
// under /profiles, so each call picks the path from the role.
const base = (role, id) => (role === 'artisan' ? `/profiles/${id}` : `/clients/${id}`);

/** A client's own details: { id, name, email, phone, location }. */
export function fetchClient(id) {
  return request(`/clients/${id}`);
}

/** Change a client's name, phone or location. Returns the saved details. */
export function updateClient(id, fields) {
  return request(`/clients/${id}`, { method: 'PATCH', body: fields });
}

/** Change an artisan's display name. */
export function updateArtisanName(id, name) {
  return request(`/profiles/${id}`, { method: 'PATCH', body: { name } });
}

export async function changePassword(role, id, currentPassword, newPassword) {
  await request(`${base(role, id)}/password`, {
    method: 'PATCH',
    body: { currentPassword, newPassword },
  });
}

/** Delete the account for good. The password confirms it's really them. */
export async function deleteAccount(role, id, password) {
  await request(base(role, id), { method: 'DELETE', body: { password } });
}
