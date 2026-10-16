// Automated tests for the website's booking routes: an artisan seeing the
// requests made to them and accepting, declining and completing them, and a
// client cancelling. Every booking and client made here is deleted at the end.
const request = require('supertest');
const app = require('../app');
const db = require('../db');

// Sample artisans from schema.sql, so they exist on any machine that ran it.
const ARTISAN_ID = 1;
const OTHER_ARTISAN_ID = 2;

const bookingIds = [];
let clientId;

// Makes a pending booking with artisan 1 for the test client, and returns its id.
async function makeBooking() {
  const res = await request(app).post('/bookings').send({
    artisanId: ARTISAN_ID,
    clientId,
    name: 'Test Client',
    contact: '0712000000',
    date: '2030-01-15',
    time: '09:00',
    job: 'Booking made by bookings.test.js',
  });
  bookingIds.push(res.body.id);
  return res.body.id;
}

function setStatus(bookingId, body) {
  return request(app).patch(`/bookings/${bookingId}/status`).send(body);
}

beforeAll(async () => {
  // Date.now() keeps the email unique, since emails can't repeat.
  const res = await request(app).post('/clients').send({
    name: 'Test Client',
    email: `bookings-test-${Date.now()}@example.com`,
    password: 'secret1',
  });
  clientId = res.body.id;
});

afterAll(async () => {
  if (bookingIds.length > 0) {
    await db.query('DELETE FROM bookings WHERE id IN (?)', [bookingIds]);
  }
  await db.query('DELETE FROM clients WHERE id = ?', [clientId]);
  // Without this, Jest hangs: mysql2's pool keeps its connections open.
  await db.end();
});

describe('GET /bookings', () => {
  it("lists an artisan's bookings when given artisanId", async () => {
    const bookingId = await makeBooking();

    const res = await request(app).get('/bookings').query({ artisanId: ARTISAN_ID });

    expect(res.status).toBe(200);
    const booking = res.body.find(b => b.id === bookingId);
    expect(booking).toMatchObject({ artisan_id: ARTISAN_ID, status: 'pending', name: 'Test Client' });
    for (const b of res.body) {
      expect(b.artisan_id).toBe(ARTISAN_ID);
    }
  });

  it('rejects a request with neither clientId nor artisanId', async () => {
    const res = await request(app).get('/bookings');
    expect(res.status).toBe(400);
  });

  it('rejects a request with both clientId and artisanId', async () => {
    const res = await request(app).get('/bookings').query({ clientId, artisanId: ARTISAN_ID });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /bookings/:id/status', () => {
  it('lets the artisan accept a request, then mark it completed', async () => {
    const bookingId = await makeBooking();

    const accepted = await setStatus(bookingId, { artisanId: ARTISAN_ID, status: 'confirmed' });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual({ id: bookingId, status: 'confirmed' });

    const completed = await setStatus(bookingId, { artisanId: ARTISAN_ID, status: 'completed' });
    expect(completed.status).toBe(200);
    expect(completed.body).toEqual({ id: bookingId, status: 'completed' });
  });

  it('lets the artisan decline a request', async () => {
    const bookingId = await makeBooking();

    const res = await setStatus(bookingId, { artisanId: ARTISAN_ID, status: 'declined' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('declined');
  });

  it("refuses to complete a job the artisan hasn't accepted", async () => {
    const bookingId = await makeBooking();

    const res = await setStatus(bookingId, { artisanId: ARTISAN_ID, status: 'completed' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/pending/);
  });

  it('refuses to re-open a declined request', async () => {
    const bookingId = await makeBooking();
    await setStatus(bookingId, { artisanId: ARTISAN_ID, status: 'declined' });

    const res = await setStatus(bookingId, { artisanId: ARTISAN_ID, status: 'confirmed' });

    expect(res.status).toBe(409);
  });

  it("returns 404 for another artisan's booking and leaves it unchanged", async () => {
    const bookingId = await makeBooking();

    const res = await setStatus(bookingId, { artisanId: OTHER_ARTISAN_ID, status: 'confirmed' });

    expect(res.status).toBe(404);
    const [rows] = await db.query('SELECT status FROM bookings WHERE id = ?', [bookingId]);
    expect(rows[0].status).toBe('pending');
  });

  it('rejects a status that is not one of the three', async () => {
    const bookingId = await makeBooking();

    const res = await setStatus(bookingId, { artisanId: ARTISAN_ID, status: 'cancelled' });

    expect(res.status).toBe(400);
  });

  it('rejects a request without artisanId', async () => {
    const bookingId = await makeBooking();

    const res = await setStatus(bookingId, { status: 'confirmed' });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /bookings/:id/cancel', () => {
  it('lets the client cancel a pending booking', async () => {
    const bookingId = await makeBooking();

    const res = await request(app).patch(`/bookings/${bookingId}/cancel`).send({ clientId });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: bookingId, status: 'cancelled' });
  });

  it('refuses to cancel a completed job', async () => {
    const bookingId = await makeBooking();
    await setStatus(bookingId, { artisanId: ARTISAN_ID, status: 'confirmed' });
    await setStatus(bookingId, { artisanId: ARTISAN_ID, status: 'completed' });

    const res = await request(app).patch(`/bookings/${bookingId}/cancel`).send({ clientId });

    expect(res.status).toBe(409);
  });
});
