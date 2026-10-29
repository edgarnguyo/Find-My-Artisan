// Automated tests for the website's booking routes: an artisan seeing the
// requests made to them and accepting, declining and completing them, a client
// cancelling, the busy times that accepting creates, and clients reviewing
// finished jobs. Every booking, busy time, review and client made here is
// deleted at the end.
const request = require('supertest');
const app = require('../app');
const { TEST_API_KEY, signedInAs, sessionCookie } = require('../jest.setup');
const db = require('../db');

// Sample artisans from schema.sql, so they exist on any machine that ran it.
const ARTISAN_ID = 1;
const OTHER_ARTISAN_ID = 2;
// The sample artisans have no password, so their sign-in cookies are made directly.
const AS_ARTISAN = signedInAs('artisan', ARTISAN_ID);
const AS_OTHER_ARTISAN = signedInAs('artisan', OTHER_ARTISAN_ID);

const bookingIds = [];
let clientId;
let asClient; // the test client's sign-in cookie, from signing up

// Each booking gets its own day in 2030, so accepting one never clashes with
// the time kept for another.
let nextDay = 0;
function freshDate() {
  nextDay += 1;
  return new Date(Date.UTC(2030, 0, nextDay)).toISOString().slice(0, 10);
}

function postBooking(fields) {
  return request(app).post('/bookings').set('Cookie', asClient).send({
    artisanId: ARTISAN_ID,
    name: 'Test Client',
    contact: '0712000000',
    time: '09:00',
    job: 'Booking made by bookings.test.js',
    ...fields,
  });
}

// Makes a pending booking with artisan 1 for the test client, and returns its id.
async function makeBooking(fields = {}) {
  const res = await postBooking({ date: freshDate(), ...fields });
  bookingIds.push(res.body.id);
  return res.body.id;
}

function setStatus(bookingId, body, as = AS_ARTISAN) {
  return request(app).patch(`/bookings/${bookingId}/status`).set('Cookie', as).send(body);
}

function cancel(bookingId, as = asClient) {
  return request(app).patch(`/bookings/${bookingId}/cancel`).set('Cookie', as);
}

// Accepting needs the time the job will be over; the tests' jobs start at 09:00.
function accept(bookingId, endTime = '11:00') {
  return setStatus(bookingId, { status: 'confirmed', endTime });
}

// A booking the artisan has accepted and marked completed, ready to review.
async function makeCompletedBooking() {
  const bookingId = await makeBooking();
  await accept(bookingId);
  await setStatus(bookingId, { status: 'completed' });
  return bookingId;
}

function review(bookingId, body) {
  return request(app).post(`/bookings/${bookingId}/review`).set('Cookie', asClient).send(body);
}

async function blockFor(bookingId) {
  const [rows] = await db.query('SELECT * FROM availability_blocks WHERE booking_id = ?', [bookingId]);
  return rows[0] ?? null;
}

beforeAll(async () => {
  // Date.now() keeps the email unique, since emails can't repeat.
  const res = await request(app).post('/clients').send({
    name: 'Test Client',
    email: `bookings-test-${Date.now()}@example.com`,
    password: 'secret1',
  });
  clientId = res.body.id;
  asClient = sessionCookie(res);
});

afterAll(async () => {
  if (bookingIds.length > 0) {
    // Blocks and reviews first: they point at the bookings, so MySQL won't
    // delete a booking that still has one.
    await db.query('DELETE FROM availability_blocks WHERE booking_id IN (?)', [bookingIds]);
    await db.query('DELETE FROM reviews WHERE booking_id IN (?)', [bookingIds]);
    await db.query('DELETE FROM bookings WHERE id IN (?)', [bookingIds]);
  }
  await db.query('DELETE FROM clients WHERE id = ?', [clientId]);
  // Without this, Jest hangs: mysql2's pool keeps its connections open.
  await db.end();
});

describe('GET /bookings', () => {
  it("lists the signed-in artisan's bookings", async () => {
    const bookingId = await makeBooking();

    const res = await request(app).get('/bookings').set('Cookie', AS_ARTISAN);

    expect(res.status).toBe(200);
    const booking = res.body.find(b => b.id === bookingId);
    expect(booking).toMatchObject({ artisan_id: ARTISAN_ID, status: 'pending', name: 'Test Client' });
    for (const b of res.body) {
      expect(b.artisan_id).toBe(ARTISAN_ID);
    }
  });

  it('needs someone signed in', async () => {
    const res = await request(app).get('/bookings').query({ clientId });
    expect(res.status).toBe(401);
  });

  // Week 9 audit, finding 8: these used to list anyone's bookings and contacts.
  it("refuses to list someone else's bookings by their id", async () => {
    const otherClient = await request(app).get('/bookings').set('Cookie', asClient).query({ clientId: clientId + 1 });
    const anArtisan = await request(app).get('/bookings').set('Cookie', asClient).query({ artisanId: ARTISAN_ID });
    const otherArtisan = await request(app).get('/bookings').set('Cookie', AS_ARTISAN).query({ artisanId: OTHER_ARTISAN_ID });

    expect([otherClient.status, anArtisan.status, otherArtisan.status]).toEqual([403, 403, 403]);
  });
});

describe('PATCH /bookings/:id/status', () => {
  it('lets the artisan accept a request, then mark it completed', async () => {
    const bookingId = await makeBooking();

    const accepted = await accept(bookingId);
    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual({ id: bookingId, status: 'confirmed' });

    const completed = await setStatus(bookingId, { status: 'completed' });
    expect(completed.status).toBe(200);
    expect(completed.body).toEqual({ id: bookingId, status: 'completed' });
  });

  it('lets the artisan decline a request', async () => {
    const bookingId = await makeBooking();

    const res = await setStatus(bookingId, { status: 'declined' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('declined');
  });

  it("refuses to complete a job the artisan hasn't accepted", async () => {
    const bookingId = await makeBooking();

    const res = await setStatus(bookingId, { status: 'completed' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/pending/);
  });

  it('refuses to re-open a declined request', async () => {
    const bookingId = await makeBooking();
    await setStatus(bookingId, { status: 'declined' });

    const res = await accept(bookingId);

    expect(res.status).toBe(409);
  });

  it("returns 404 for another artisan's booking and leaves it unchanged", async () => {
    const bookingId = await makeBooking();

    const res = await setStatus(bookingId, { status: 'confirmed', endTime: '11:00' }, AS_OTHER_ARTISAN);

    expect(res.status).toBe(404);
    const [rows] = await db.query('SELECT status FROM bookings WHERE id = ?', [bookingId]);
    expect(rows[0].status).toBe('pending');
  });

  it('rejects a status that is not one of the three', async () => {
    const bookingId = await makeBooking();

    const res = await setStatus(bookingId, { status: 'cancelled' });

    expect(res.status).toBe(400);
  });

  it('ignores an artisanId in the body: the artisan is whoever is signed in', async () => {
    const bookingId = await makeBooking();

    const res = await setStatus(bookingId, { artisanId: ARTISAN_ID, status: 'declined' }, AS_OTHER_ARTISAN);

    expect(res.status).toBe(404);
  });

  it('needs an artisan signed in', async () => {
    const bookingId = await makeBooking();

    const nobody = await request(app).patch(`/bookings/${bookingId}/status`).send({ status: 'declined' });
    const theClient = await setStatus(bookingId, { status: 'declined' }, asClient);

    expect(nobody.status).toBe(401);
    expect(theClient.status).toBe(403);
    const [rows] = await db.query('SELECT status FROM bookings WHERE id = ?', [bookingId]);
    expect(rows[0].status).toBe('pending');
  });
});

describe('PATCH /bookings/:id/cancel', () => {
  it('lets the client cancel a pending booking', async () => {
    const bookingId = await makeBooking();

    const res = await cancel(bookingId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: bookingId, status: 'cancelled' });
  });

  it("returns 404 for another client's booking and leaves it unchanged", async () => {
    const bookingId = await makeBooking();

    const res = await cancel(bookingId, signedInAs('client', clientId + 1000));

    expect(res.status).toBe(404);
    const [rows] = await db.query('SELECT status FROM bookings WHERE id = ?', [bookingId]);
    expect(rows[0].status).toBe('pending');
  });

  it('refuses to cancel a completed job', async () => {
    const bookingId = await makeBooking();
    await accept(bookingId);
    await setStatus(bookingId, { status: 'completed' });

    const res = await cancel(bookingId);

    expect(res.status).toBe(409);
  });
});

describe('Busy times from accepted bookings', () => {
  it('saves the job time as a busy block, converted from Kenya time to UTC', async () => {
    const bookingId = await makeBooking({ date: '2030-06-03', time: '09:00' });

    await accept(bookingId, '12:30');

    const block = await blockFor(bookingId);
    // Kenya is UTC+3, so 09:00-12:30 there is 06:00-09:30 UTC.
    expect(block).toMatchObject({
      artisan_id: ARTISAN_ID,
      start_at: '2030-06-03 06:00:00',
      end_at: '2030-06-03 09:30:00',
    });
  });

  it('refuses to accept without an end time', async () => {
    const bookingId = await makeBooking();

    const res = await setStatus(bookingId, { status: 'confirmed' });

    expect(res.status).toBe(400);
  });

  it('refuses an end time before the job starts', async () => {
    const bookingId = await makeBooking();

    const res = await accept(bookingId, '08:00');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/09:00/);
  });

  it('refuses to accept a job that clashes with a time already kept, and saves nothing', async () => {
    const date = freshDate();
    // Both requested before either is accepted, so both get saved.
    const first = await makeBooking({ date, time: '09:00' });
    const second = await makeBooking({ date, time: '10:00' });
    await accept(first, '12:00');

    // Accepting 10:00-13:00 would overlap 09:00-12:00.
    const res = await accept(second, '13:00');

    expect(res.status).toBe(409);
    expect(await blockFor(second)).toBeNull();
    const [rows] = await db.query('SELECT status FROM bookings WHERE id = ?', [second]);
    expect(rows[0].status).toBe('pending');
  });

  it('frees the time again when the client cancels an accepted job', async () => {
    const bookingId = await makeBooking();
    await accept(bookingId);
    expect(await blockFor(bookingId)).not.toBeNull();

    const res = await cancel(bookingId);

    expect(res.status).toBe(200);
    expect(await blockFor(bookingId)).toBeNull();
  });

  it('refuses a new booking that starts while the artisan is busy', async () => {
    const date = freshDate();
    const bookingId = await makeBooking({ date, time: '09:00' });
    await accept(bookingId, '12:00');

    const res = await postBooking({ date, time: '10:30' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/09:00 to 12:00/);
  });

  it('allows a new booking that starts when the busy time ends', async () => {
    const date = freshDate();
    const bookingId = await makeBooking({ date, time: '09:00' });
    await accept(bookingId, '12:00');

    const res = await postBooking({ date, time: '12:00' });
    bookingIds.push(res.body.id);

    expect(res.status).toBe(201);
  });

  it('rejects a booking whose date or time is not in the form the site sends', async () => {
    const res = await postBooking({ date: '15/01/2030' });
    expect(res.status).toBe(400);
  });

  it('refuses a booking without a signed-in client', async () => {
    const booking = { artisanId: ARTISAN_ID, name: 'x', contact: 'x', date: freshDate(), time: '09:00', job: 'x' };

    const nobody = await request(app).post('/bookings').send({ ...booking, clientId });
    const anArtisan = await request(app).post('/bookings').set('Cookie', AS_ARTISAN).send({ ...booking, clientId });
    const deleted = await request(app).post('/bookings').set('Cookie', signedInAs('client', clientId + 1000)).send(booking);

    expect([nobody.status, anArtisan.status, deleted.status]).toEqual([401, 403, 400]);
    expect(deleted.body.error).toBe('Sign in with a client account to book');
  });

  it("shows an accepted job in Meditrac's busy list and on the profile", async () => {
    // Tomorrow in Kenya, early, so it's inside the 14-day busy window.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
    const bookingId = await makeBooking({ date: tomorrow, time: '05:00' });
    await accept(bookingId, '06:00');
    const window = {
      start: `${tomorrow}T02:00:00Z`,
      end: `${tomorrow}T03:00:00Z`,
    };

    const api = await request(app).get(`/artisans/${ARTISAN_ID}`).set('X-API-Key', TEST_API_KEY);
    expect(api.body.busy).toContainEqual(window);

    const profile = await request(app).get(`/profiles/${ARTISAN_ID}`);
    expect(profile.body.busy).toContainEqual(window);
  });

  it("lists the artisan's own busy times with the booking they belong to", async () => {
    const bookingId = await makeBooking({ date: '2030-07-01', time: '09:00' });
    await accept(bookingId);

    const res = await request(app).get(`/profiles/${ARTISAN_ID}/availability`).set('Cookie', AS_ARTISAN);
    const someoneElse = await request(app).get(`/profiles/${ARTISAN_ID}/availability`).set('Cookie', AS_OTHER_ARTISAN);

    expect(someoneElse.status).toBe(403);
    expect(res.status).toBe(200);
    expect(res.body).toContainEqual({
      id: expect.any(Number),
      start: '2030-07-01T06:00:00Z',
      end: '2030-07-01T08:00:00Z',
      bookingId,
      job: 'Booking made by bookings.test.js',
    });
  });

  // Week 9 audit: a booked block is the client's time, so no one may free it
  // by its id, through the partner API or the website's busy-time routes.
  it("won't let a booked block be moved or deleted by its id", async () => {
    const bookingId = await makeBooking();
    await accept(bookingId);
    const block = await blockFor(bookingId);
    const path = `/artisans/${ARTISAN_ID}/availability/${block.id}`;

    const del = await request(app).delete(path).set('X-API-Key', TEST_API_KEY);
    const patch = await request(app)
      .patch(path)
      .set('X-API-Key', TEST_API_KEY)
      .send({ end: '2030-12-31T23:00:00Z' });
    const websiteDel = await request(app)
      .delete(`/profiles/${ARTISAN_ID}/availability/${block.id}`)
      .set('Cookie', AS_ARTISAN);

    expect([del.status, patch.status, websiteDel.status]).toEqual([404, 404, 404]);
    expect(del.body.code).toBe('not_found');
    // Untouched: same times, still linked to the booking.
    expect(await blockFor(bookingId)).toEqual(block);
  });
});

describe('POST /bookings/:id/review', () => {
  it("saves the client's review of a completed job, with their name as author", async () => {
    const bookingId = await makeCompletedBooking();

    const res = await review(bookingId, { rating: 4, comment: '  Quick and tidy.  ' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(Number), rating: 4, comment: 'Quick and tidy.' });
    const [rows] = await db.query('SELECT * FROM reviews WHERE id = ?', [res.body.id]);
    expect(rows[0]).toMatchObject({
      artisan_id: ARTISAN_ID,
      booking_id: bookingId,
      author: 'Test Client',
      rating: 4,
      from_api: 0,
    });
  });

  it('lets a client review a job only once', async () => {
    const bookingId = await makeCompletedBooking();
    await review(bookingId, { rating: 5 });

    const res = await review(bookingId, { rating: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already reviewed/);
  });

  it('refuses a review before the job is completed', async () => {
    const bookingId = await makeBooking();
    await accept(bookingId);

    const res = await review(bookingId, { rating: 5 });

    expect(res.status).toBe(409);
  });

  it("returns 404 for someone else's booking", async () => {
    const bookingId = await makeCompletedBooking();

    const res = await request(app)
      .post(`/bookings/${bookingId}/review`)
      .set('Cookie', signedInAs('client', clientId + 1000))
      .send({ clientId, rating: 5 });

    expect(res.status).toBe(404);
  });

  it.each([[0], [6], [4.5], ['5'], [undefined]])('rejects rating %p', async rating => {
    const bookingId = await makeCompletedBooking();

    const res = await review(bookingId, { rating });

    expect(res.status).toBe(400);
  });

  it("shows the review on the client's booking", async () => {
    const bookingId = await makeCompletedBooking();
    await review(bookingId, { rating: 3, comment: 'Fine.' });

    const res = await request(app).get('/bookings').set('Cookie', asClient);

    expect(res.body.find(b => b.id === bookingId)).toMatchObject({
      review_rating: 3,
      review_comment: 'Fine.',
    });
  });

  it("can't be changed or deleted through Meditrac's review routes", async () => {
    const bookingId = await makeCompletedBooking();
    const posted = await review(bookingId, { rating: 5 });

    const patch = await request(app)
      .patch(`/artisans/${ARTISAN_ID}/reviews/${posted.body.id}`).set('X-API-Key', TEST_API_KEY)
      .send({ rating: 1 });
    const del = await request(app).delete(`/artisans/${ARTISAN_ID}/reviews/${posted.body.id}`).set('X-API-Key', TEST_API_KEY);

    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);
  });
});

describe('Rating and jobs done on the profile', () => {
  it('works the rating out from the reviews and counts jobs finished on the site', async () => {
    const before = (await request(app).get(`/profiles/${ARTISAN_ID}`)).body;

    const bookingId = await makeCompletedBooking();
    await review(bookingId, { rating: 1 });

    const after = (await request(app).get(`/profiles/${ARTISAN_ID}`)).body;
    const [[avg]] = await db.query(
      'SELECT ROUND(AVG(rating), 1) AS rating FROM reviews WHERE artisan_id = ?',
      [ARTISAN_ID]
    );
    expect(after.review_count).toBe(before.review_count + 1);
    expect(after.rating).toBe(avg.rating);
    expect(after.jobs_completed).toBe(before.jobs_completed + 1);
    expect(after.reviews[0]).toMatchObject({ author: 'Test Client', rating: 1 });
  });

  it('has no rating for an artisan nobody has reviewed', async () => {
    const res = await request(app).post('/profiles').send({
      name: 'Unrated Artisan',
      email: `unrated-${Date.now()}@example.com`,
      password: 'secret1',
      skill: 'Painter',
      location: 'Kilimani',
      county: 'Nairobi',
      phone: '0712000123',
    });

    const profile = (await request(app).get(`/profiles/${res.body.id}`)).body;
    await db.query('DELETE FROM artisans WHERE id = ?', [res.body.id]);

    expect(profile.rating).toBeNull();
    expect(profile.review_count).toBe(0);
    expect(profile.jobs_completed).toBe(0);
  });
});
