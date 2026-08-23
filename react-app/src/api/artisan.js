import { supabase } from '../lib/supabaseClient';
import { toBooking } from './workers';

/**
 * The worker profile owned by the signed-in account, or null if they have not
 * created one yet. Artisans get exactly one, enforced by a unique index on
 * workers.user_id.
 */
export async function fetchMyWorker() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from('workers')
    .select('*, worker_skills(skill), worker_availability(*), portfolio_items(*)')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    skill: data.skill,
    price: data.price ?? '',
    photo: data.photo ?? '',
    location: data.location,
    bio: data.bio ?? '',
    verified: data.verified,
    rating: data.rating === null ? null : Number(data.rating),
    jobSuccess: data.job_success,
    jobsCompleted: data.jobs_completed,
    hoursPerWeek: data.hours_per_week ?? '',
    skills: (data.worker_skills ?? []).map(s => s.skill),
    availability: (data.worker_availability ?? [])
      .map(a => ({ id: a.id, weekday: a.weekday, start: a.start_time, end: a.end_time }))
      .sort((a, b) => a.weekday - b.weekday),
    portfolio: (data.portfolio_items ?? []).map(p => ({
      id: p.id,
      imageUrl: p.image_url,
      caption: p.caption,
    })),
  };
}

/** Create the worker profile for the signed-in artisan. */
export async function createMyWorker({ name, skill, location, price, bio, photo, hoursPerWeek }) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('workers')
    .insert({
      user_id: auth.user.id,
      name,
      skill,
      location,
      price: price || null,
      bio: bio || null,
      photo: photo || null,
      hours_per_week: hoursPerWeek || null,
    })
    .select('id')
    .single();

  if (error) throw error;

  // Keep the primary trade in worker_skills too, so the skill list on the
  // public profile is never empty for a brand new artisan.
  await supabase.from('worker_skills').insert({ worker_id: data.id, skill });

  return data.id;
}

/**
 * Update the editable fields of your own worker profile.
 *
 * rating, job_success and jobs_completed are not here on purpose: they are
 * maintained by database triggers from reviews and completed bookings, so an
 * artisan cannot inflate their own numbers.
 */
export async function updateMyWorker(id, { name, skill, location, price, bio, photo, hoursPerWeek }) {
  const { error } = await supabase
    .from('workers')
    .update({
      name,
      skill,
      location,
      price: price || null,
      bio: bio || null,
      photo: photo || null,
      hours_per_week: hoursPerWeek || null,
    })
    .eq('id', id);

  if (error) throw error;
}

/** Replace the whole skill list in one go — simpler than diffing it. */
export async function saveMySkills(workerId, skills) {
  const { error: deleteError } = await supabase
    .from('worker_skills')
    .delete()
    .eq('worker_id', workerId);

  if (deleteError) throw deleteError;
  if (skills.length === 0) return;

  const { error } = await supabase
    .from('worker_skills')
    .insert(skills.map(skill => ({ worker_id: workerId, skill })));

  if (error) throw error;
}

/**
 * Replace the weekly availability.
 *
 * `slots` is an array of { weekday, start, end }; days the artisan does not
 * work are simply left out.
 */
export async function saveMyAvailability(workerId, slots) {
  const { error: deleteError } = await supabase
    .from('worker_availability')
    .delete()
    .eq('worker_id', workerId);

  if (deleteError) throw deleteError;
  if (slots.length === 0) return;

  const { error } = await supabase.from('worker_availability').insert(
    slots.map(s => ({
      worker_id: workerId,
      weekday: s.weekday,
      start_time: s.start,
      end_time: s.end,
    }))
  );

  if (error) throw error;
}

/**
 * Upload one portfolio photo and record it.
 *
 * The storage policy only lets you write inside a folder named after your own
 * account id, so that prefix is not cosmetic — it is the permission check.
 */
export async function addPortfolioItem(workerId, file, caption) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in.');

  const extension = file.name.split('.').pop().toLowerCase();
  const path = `${auth.user.id}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('portfolio')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data: published } = supabase.storage.from('portfolio').getPublicUrl(path);

  const { error } = await supabase.from('portfolio_items').insert({
    worker_id: workerId,
    image_url: published.publicUrl,
    caption: caption || null,
  });

  if (error) throw error;
}

export async function deletePortfolioItem(id) {
  const { error } = await supabase.from('portfolio_items').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Every booking made against the worker profile this account owns.
 *
 * Guest bookings show up here as well. Before the artisan side existed they
 * were written to a table nobody could read them back from.
 */
export async function fetchBookingsForMyWorker(workerId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, workers(id, name, skill, location), reviews(id)')
    .eq('worker_id', workerId)
    .order('booking_date', { ascending: true });

  if (error) throw error;
  return data.map(toBooking);
}

/**
 * Move a booking along its lifecycle. Only the artisan who owns the worker row
 * may do this; the policy restricts the client to 'cancelled'.
 */
export async function setBookingStatus(id, status, finalPrice = null) {
  const patch = { status };
  if (status === 'completed' && finalPrice !== null && finalPrice !== '') {
    patch.final_price = Number(finalPrice);
  }

  const { error } = await supabase.from('bookings').update(patch).eq('id', id);
  if (error) throw error;
}
