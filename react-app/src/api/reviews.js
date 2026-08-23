import { supabase } from '../lib/supabaseClient';

/**
 * Rate a completed job.
 *
 * The insert policy re-checks all of this in the database: the booking must be
 * yours, must belong to this worker, and must be completed. A unique index on
 * booking_id stops a second review of the same job. The worker's average
 * rating is recomputed by a trigger, not here.
 */
export async function createReview({ workerId, bookingId, author, rating, comment }) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Sign in to leave a review.');

  const { error } = await supabase.from('reviews').insert({
    worker_id: workerId,
    booking_id: bookingId,
    user_id: auth.user.id,
    author,
    rating,
    comment: comment || null,
  });

  if (error?.code === '23505') {
    throw new Error('You have already reviewed this job.');
  }
  if (error) throw error;
}

/** Reviews written by the signed-in user, so they can revisit or remove them. */
export async function fetchMyReviews() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from('reviews')
    .select('*, workers(id, name)')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(r => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    bookingId: r.booking_id,
    worker: r.workers ? { id: r.workers.id, name: r.workers.name } : null,
  }));
}

export async function deleteReview(id) {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) throw error;
}
