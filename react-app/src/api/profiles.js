import { supabase } from '../lib/supabaseClient';

/**
 * The signed-in user's profile row.
 *
 * The row is created by a trigger on auth.users, so it exists for every
 * account. It can still come back null for a moment right after sign-up, in
 * the window before the trigger's transaction is visible.
 */
export async function fetchMyProfile() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    fullName: data.full_name ?? '',
    contact: data.contact ?? '',
    role: data.role,
    email: auth.user.email,
  };
}

/** Save the editable fields. The role is fixed at sign-up. */
export async function updateMyProfile({ fullName, contact }) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, contact })
    .eq('id', auth.user.id);

  if (error) throw error;
}

/** Change the account's email address. Supabase mails a confirmation link. */
export async function updateMyEmail(email) {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
}

/** Change the account's password. */
export async function updateMyPassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/**
 * Delete the account for good.
 *
 * The anon key cannot touch auth.users, so this calls a security-definer
 * function that deletes exactly the caller. Profile, worker row, portfolio,
 * availability and bookings go with it through the foreign keys.
 */
export async function deleteMyAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
  await supabase.auth.signOut();
}
