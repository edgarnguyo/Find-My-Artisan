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
    county: row.county,
    bio: row.bio,
    phone: row.phone,
    hourlyRateKes: row.hourly_rate_kes,
    // The average of the artisan's reviews, or null when nobody has reviewed
    // them yet. DECIMAL arrives as a string ("4.8"), so convert it to a number.
    rating: row.rating === null ? null : Number(row.rating),
    reviewCount: row.review_count,
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
    // Booked windows in the next 14 days, in UTC: [{ start, end }]. Only the
    // single-artisan route sends them, like the portfolio below.
    busy: row.busy ?? [],
    portfolio: (row.portfolio ?? []).map(toPortfolioItem),
  };
}

function toPortfolioItem(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    workDate: row.work_date,
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
    // Who asked for the job, as typed into the booking form.
    clientName: row.name,
    job: row.job,
    budget: row.budget,
    contact: row.contact,
    date: row.booking_date,
    time: row.booking_time,
    // When the artisan said the job will be over (UTC), once they've accepted.
    endsAt: row.block_end,
    // The client's review of the job, once they've left one.
    review: row.review_rating === null ? null : { rating: row.review_rating, comment: row.review_comment },
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

/** Review a completed job: rating is 1 to 5, comment is optional. */
export async function reviewBooking(id, clientId, rating, comment) {
  await request(`/bookings/${id}/review`, { method: 'POST', body: { clientId, rating, comment } });
}

/** Every booking made with this artisan, newest first. */
export async function fetchArtisanBookings(artisanId) {
  const rows = await request(`/bookings?artisanId=${artisanId}`);
  return rows.map(toBooking);
}

/**
 * An artisan's answer to a booking: 'confirmed', 'declined' or 'completed'.
 * Accepting ('confirmed') also needs endTime: when the job will be over that
 * day, in Kenya time ('12:00').
 */
export async function setBookingStatus(id, artisanId, status, endTime) {
  await request(`/bookings/${id}/status`, { method: 'PATCH', body: { artisanId, status, endTime } });
}

/** The artisan's busy times that haven't ended: [{ id, start, end, bookingId, job }]. */
export function fetchBusyTimes(artisanId) {
  return request(`/profiles/${artisanId}/availability`);
}

/** Mark the artisan busy from start to end (Date objects). Uses the API's own route. */
export async function addBusyTime(artisanId, start, end) {
  await request(`/artisans/${artisanId}/availability`, {
    method: 'POST',
    body: { start: start.toISOString(), end: end.toISOString() },
  });
}

/** Free up a busy time the artisan added themselves. */
export async function removeBusyTime(artisanId, blockId) {
  await request(`/artisans/${artisanId}/availability/${blockId}`, { method: 'DELETE' });
}

/**
 * Save changes to an artisan's own profile. fields holds any of location,
 * county, phone, price, bio and hourlyRateKes.
 */
export async function updateProfile(artisanId, fields) {
  return toWorker(await request(`/profiles/${artisanId}`, { method: 'PATCH', body: fields }));
}

/** Add a past job to the portfolio: { title, imageUrl, description?, workDate? }. */
export async function addPortfolioItem(artisanId, item) {
  return toPortfolioItem(await request(`/profiles/${artisanId}/portfolio`, { method: 'POST', body: item }));
}

export async function removePortfolioItem(artisanId, itemId) {
  await request(`/profiles/${artisanId}/portfolio/${itemId}`, { method: 'DELETE' });
}
