import { supabase } from '../lib/supabaseClient';

// The database uses snake_case column names; the components were written against
// the camelCase shape of the old mockData.js. These mappers keep the components
// unchanged by translating at the edge.
function toWorker(row) {
  return {
    id: row.id,
    name: row.name,
    skill: row.skill,
    verified: row.verified,
    price: row.price,
    photo: row.photo,
    location: row.location,
    bio: row.bio,
    rating: row.rating === null ? null : Number(row.rating),
    jobSuccess: row.job_success,
    hoursPerWeek: row.hours_per_week,
    totalEarnings: row.total_earnings,
    jobsCompleted: row.jobs_completed,
    hoursWorked: row.hours_worked,
    languages: (row.languages ?? []).map(l => ({ name: l.name, level: l.level })),
    workHistory: (row.work_history ?? []).map(h => ({
      title: h.title,
      rating: h.rating,
      dateRange: h.date_range,
      price: h.price,
      priceType: h.price_type,
    })),
    reviews: (row.reviews ?? []).map(r => ({
      id: r.id,
      author: r.author,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
    })),
    // Every skill the artisan offers. The `skill` column above stays the
    // primary trade that the listings filter works on.
    skills: (row.worker_skills ?? []).map(s => s.skill),
    // Real stored availability. Empty means the artisan has not set one.
    availability: (row.worker_availability ?? [])
      .map(a => ({ weekday: a.weekday, start: a.start_time, end: a.end_time }))
      .sort((a, b) => a.weekday - b.weekday),
    portfolio: (row.portfolio_items ?? []).map(p => ({
      id: p.id,
      imageUrl: p.image_url,
      caption: p.caption,
    })),
  };
}

/** All workers, without their nested languages/history/reviews. */
export async function fetchWorkers() {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .order('id');

  if (error) throw error;
  return data.map(toWorker);
}

/** One worker with everything attached, or null if that id does not exist. */
export async function fetchWorkerById(id) {
  const { data, error } = await supabase
    .from('workers')
    .select(
      `*, languages(name, level), work_history(*), reviews(*),
       worker_skills(skill), worker_availability(*), portfolio_items(*)`
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? toWorker(data) : null;
}

/**
 * Insert a booking request.
 *
 * `userId` stamps the booking with the signed-in account so it can be read
 * back later on /bookings. Null means a guest booking: it is still stored,
 * but nobody can ever read it from the browser, because the select policy
 * compares auth.uid() against user_id and null never matches.
 *
 * We deliberately do not chain .select() — the insert policy allows writing,
 * and asking for the row back would be a separate read.
 */
export async function createBooking({
  workerId, userId = null, name, contact, date, time, budget, job,
  category = null, agreedPrice = null,
}) {
  const { error } = await supabase.from('bookings').insert({
    worker_id: workerId,
    user_id: userId,
    name,
    contact,
    booking_date: date,
    booking_time: time,
    budget: budget || null,
    job,
    category,
    agreed_price: agreedPrice === '' || agreedPrice === null ? null : Number(agreedPrice),
  });

  // The unique index only covers slots that are not cancelled, so this means
  // somebody already holds this artisan at this date and time.
  if (error?.code === '23505') {
    throw new Error('That slot is already taken. Please choose another time.');
  }
  if (error) throw error;
}

function toBooking(row) {
  return {
    id: row.id,
    status: row.status,
    job: row.job,
    category: row.category,
    agreedPrice: row.agreed_price === null ? null : Number(row.agreed_price),
    finalPrice: row.final_price === null ? null : Number(row.final_price),
    budget: row.budget,
    clientName: row.name,
    contact: row.contact,
    date: row.booking_date,
    time: row.booking_time,
    createdAt: row.created_at,
    workerId: row.worker_id,
    userId: row.user_id,
    reviewed: (row.reviews ?? []).length > 0,
    worker: row.workers
      ? { id: row.workers.id, name: row.workers.name, skill: row.workers.skill, location: row.workers.location }
      : null,
  };
}

/**
 * Every booking belonging to the signed-in user, newest first.
 *
 * There is no `.eq('user_id', ...)` here on purpose. The RLS select policy
 * already restricts rows to auth.uid(), so this returns only your own
 * bookings even though the query asks for all of them. Filtering in the
 * client would be cosmetic; the database is what actually enforces it.
 */
export async function fetchMyBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, workers(id, name, skill, location), reviews(id)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  // The select policy also lets an artisan read bookings made against their
  // own worker profile, so filter to the ones this account placed as a client.
  const { data: auth } = await supabase.auth.getUser();
  return data
    .filter(row => row.user_id === auth.user?.id)
    .map(toBooking);
}

/** Cancel one of your own bookings. The policy allows no other status change. */
export async function cancelBooking(id) {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) throw error;
}

/** The job categories used by the booking form. */
export async function fetchJobCategories() {
  const { data, error } = await supabase
    .from('job_categories')
    .select('*')
    .order('label');

  if (error) throw error;
  return data.map(c => ({ slug: c.slug, label: c.label }));
}

export { toBooking };
