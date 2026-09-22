import { request } from './client';

// Artisan and booking data comes from the Express API (MySQL). MySQL columns are
// snake_case; the components were written against the camelCase shape of the old
// mockData.js. These mappers keep the components unchanged by translating here.
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
    // DECIMAL arrives as a string ("4.8"), so convert it to a number.
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
  const rows = await request('/profiles');
  return rows.map(toWorker);
}

/** One artisan with everything attached, or null if that id does not exist. */
export async function fetchWorkerById(id) {
  try {
    return toWorker(await request(`/profiles/${id}`));
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/** Save a booking request. clientId is null when nobody is signed in. */
export async function createBooking({ workerId, clientId, name, contact, date, time, budget, job }) {
  await request('/bookings', {
    method: 'POST',
    body: { artisanId: workerId, clientId, name, contact, date, time, budget, job },
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

/** Every booking made by this client, newest first. */
export async function fetchMyBookings(clientId) {
  const rows = await request(`/bookings?clientId=${clientId}`);
  return rows.map(toBooking);
}

/** Cancel one of this client's bookings. */
export async function cancelBooking(id, clientId) {
  await request(`/bookings/${id}/cancel`, { method: 'PATCH', body: { clientId } });
}
