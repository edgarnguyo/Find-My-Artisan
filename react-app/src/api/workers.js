import { request } from './client';

// Artisan and booking data comes from the Express API (MySQL); sign-in is in
// auth.js. MySQL columns are snake_case; the components were written
// against the camelCase shape of the old mockData.js. These mappers keep the
// components unchanged by translating at the edge.
function toWorker(row) {
  return {
    id: row.id,
    name: row.name,
    skill: row.skill,
    // MySQL has no true/false type: BOOLEAN arrives as 1 or 0, and React would
    // print a bare 0 for `worker.verified && ...`.
    verified: Boolean(row.verified),
    price: row.price,
    photo: row.photo,
    location: row.location,
    bio: row.bio,
    // DECIMAL arrives as a string ("4.8") so no precision is lost; convert it.
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
      author: r.author,
      rating: r.rating,
      comment: r.comment,
    })),
  };
}

/** All artisans, without their languages/history/reviews. */
export async function fetchWorkers() {
  const rows = await request('/api/artisans');
  return rows.map(toWorker);
}

/** One artisan with everything attached, or null if that id does not exist. */
export async function fetchWorkerById(id) {
  try {
    return toWorker(await request(`/api/artisans/${encodeURIComponent(id)}`));
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/**
 * Create a booking request.
 *
 * There is no user id in the body on purpose: when someone is signed in,
 * request() sends their token and the server reads the id from it, so a
 * booking can't be filed under another account. Signed out = guest booking.
 */
export async function createBooking({ workerId, name, contact, date, time, budget, job }) {
  await request('/api/bookings', {
    method: 'POST',
    body: { artisanId: workerId, name, contact, date, time, budget: budget || null, job },
  });
}

function toBooking(row) {
  return {
    id: row.id,
    status: row.status,
    job: row.job,
    budget: row.budget,
    contact: row.contact,
    date: row.booking_date,
    time: row.booking_time,
    createdAt: row.created_at,
    worker: {
      id: row.artisan_id,
      name: row.artisan_name,
      skill: row.artisan_skill,
      location: row.artisan_location,
    },
  };
}

/** Every booking belonging to the signed-in user, newest first. */
export async function fetchMyBookings() {
  const rows = await request('/api/bookings/mine');
  return rows.map(toBooking);
}

/** Cancel one of your own bookings. The server allows no other status change. */
export async function cancelBooking(id) {
  await request(`/api/bookings/${encodeURIComponent(id)}/cancel`, { method: 'PATCH' });
}
