// Automated tests for the account page: clients and artisans changing their
// details and password, and deleting their account. Every account made here is
// deleted by the tests themselves or at the end.
const request = require('supertest');
const app = require('../app');
const { TEST_API_KEY } = require('../jest.setup');
const db = require('../db');

const PASSWORD = 'secret1';
let n = 0;

// Date.now() and a counter keep each email unique, since emails can't repeat.
const email = kind => `accounts-test-${kind}-${Date.now()}-${++n}@example.com`;

async function makeClient() {
  return (await request(app).post('/clients').send({ name: 'Acc Client', email: email('c'), password: PASSWORD })).body;
}

async function makeArtisan() {
  return (await request(app).post('/profiles').send({
    name: 'Acc Artisan', email: email('a'), password: PASSWORD, skill: 'Painter',
    location: 'Ruaka', county: 'Kiambu', phone: '0712000888',
  })).body;
}

// A booking between the two, moved on to `status` ('pending', 'confirmed' or 'completed').
async function makeBooking(artisanId, clientId, status, date) {
  const { id } = (await request(app).post('/bookings').send({
    artisanId, clientId, name: 'Acc Client', contact: '0712000000',
    date, time: '09:00', job: 'Booking made by accounts.test.js',
  })).body;
  if (status !== 'pending') {
    await request(app).patch(`/bookings/${id}/status`).send({ artisanId, status: 'confirmed', endTime: '11:00' });
  }
  if (status === 'completed') {
    await request(app).patch(`/bookings/${id}/status`).send({ artisanId, status: 'completed' });
  }
  return id;
}

function login(account, password = PASSWORD) {
  return request(app).post('/login').send({ email: account.email, password });
}

const madeArtisans = [];
afterAll(async () => {
  // Anything a test left behind: rows pointing at these artisans first.
  if (madeArtisans.length > 0) {
    for (const table of ['availability_blocks', 'reviews', 'portfolio_items', 'bookings']) {
      await db.query(`DELETE FROM ${table} WHERE artisan_id IN (?)`, [madeArtisans]);
    }
    await db.query('DELETE FROM artisans WHERE id IN (?)', [madeArtisans]);
  }
  await db.query("DELETE FROM clients WHERE email LIKE 'accounts-test-%'");
  // Without this, Jest hangs: mysql2's pool keeps its connections open.
  await db.end();
});

describe('Client account', () => {
  it('no longer lists every client to anyone who asks', async () => {
    const res = await request(app).get('/clients');
    expect(res.status).toBe(404);
  });

  it('returns one client without the password', async () => {
    const client = await makeClient();

    const res = await request(app).get(`/clients/${client.id}`);

    expect(res.body).toEqual({ id: client.id, name: 'Acc Client', email: client.email, phone: null, location: null });
  });

  it('changes name, phone and location; an empty value clears one', async () => {
    const client = await makeClient();
    await request(app).patch(`/clients/${client.id}`).send({ location: 'Kasarani' });

    const res = await request(app).patch(`/clients/${client.id}`).send({ name: ' Amina O. ', phone: '0722 111 222', location: '' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Amina O.', phone: '0722 111 222', location: null });
  });

  it.each([[{ name: '' }], [{ phone: 'x'.repeat(31) }], [{}], [{ email: 'new@example.com' }]])(
    'rejects %p', async body => {
      const client = await makeClient();
      const res = await request(app).patch(`/clients/${client.id}`).send(body);
      expect(res.status).toBe(400);
    }
  );

  it('changes the password only with the right current one', async () => {
    const client = await makeClient();
    const path = `/clients/${client.id}/password`;

    expect((await request(app).patch(path).send({ currentPassword: 'wrong1', newPassword: 'newpass1' })).status).toBe(403);
    expect((await request(app).patch(path).send({ currentPassword: PASSWORD, newPassword: 'short' })).status).toBe(400);
    expect((await request(app).patch(path).send({ currentPassword: PASSWORD, newPassword: 'newpass1' })).status).toBe(200);

    expect((await login(client, 'newpass1')).status).toBe(200);
    expect((await login(client, PASSWORD)).status).toBe(401);
  });

  it('refuses to delete with the wrong password, and keeps the account', async () => {
    const client = await makeClient();

    const res = await request(app).delete(`/clients/${client.id}`).send({ password: 'wrong1' });

    expect(res.status).toBe(403);
    expect((await login(client)).status).toBe(200);
  });

  it('deletes the account: open bookings cancelled and freed, past ones and reviews kept', async () => {
    const artisan = await makeArtisan();
    madeArtisans.push(artisan.id);
    const client = await makeClient();
    const open = await makeBooking(artisan.id, client.id, 'confirmed', '2031-02-01');
    const past = await makeBooking(artisan.id, client.id, 'completed', '2031-02-02');
    await request(app).post(`/bookings/${past}/review`).send({ clientId: client.id, rating: 5 });

    const res = await request(app).delete(`/clients/${client.id}`).send({ password: PASSWORD });

    expect(res.status).toBe(204);
    expect((await login(client)).status).toBe(401);
    const [bookings] = await db.query('SELECT id, status, client_id FROM bookings WHERE id IN (?) ORDER BY id', [[open, past]]);
    expect(bookings).toEqual([
      { id: open, status: 'cancelled', client_id: null },
      { id: past, status: 'completed', client_id: null },
    ]);
    const [blocks] = await db.query('SELECT id FROM availability_blocks WHERE booking_id = ?', [open]);
    expect(blocks).toHaveLength(0);
    const [reviews] = await db.query('SELECT author FROM reviews WHERE booking_id = ?', [past]);
    expect(reviews).toEqual([{ author: 'Acc Client' }]);
  });
});

describe('Artisan account', () => {
  it('changes the password only with the right current one', async () => {
    const artisan = await makeArtisan();
    madeArtisans.push(artisan.id);
    const path = `/profiles/${artisan.id}/password`;

    expect((await request(app).patch(path).send({ currentPassword: 'nope12', newPassword: 'newpass1' })).status).toBe(403);
    expect((await request(app).patch(path).send({ currentPassword: PASSWORD, newPassword: 'newpass1' })).status).toBe(200);
    expect((await login(artisan, 'newpass1')).body.role).toBe('artisan');
  });

  it("can't delete a sample artisan, which has no password", async () => {
    const res = await request(app).delete('/profiles/1').send({ password: '' });

    expect(res.status).toBe(403);
    expect((await request(app).get('/profiles/1')).status).toBe(200);
  });

  it('refuses to delete while a job is open, then deletes everything once it is answered', async () => {
    const artisan = await makeArtisan();
    madeArtisans.push(artisan.id);
    const client = await makeClient();
    const past = await makeBooking(artisan.id, client.id, 'completed', '2031-03-01');
    await request(app).post(`/bookings/${past}/review`).send({ clientId: client.id, rating: 4 });
    await request(app).post(`/profiles/${artisan.id}/portfolio`).send({ title: 'Mural', imageUrl: 'https://example.com/m.jpg' });
    const open = await makeBooking(artisan.id, client.id, 'pending', '2031-03-02');

    const refused = await request(app).delete(`/profiles/${artisan.id}`).send({ password: PASSWORD });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/1 open job/);

    await request(app).patch(`/bookings/${open}/status`).send({ artisanId: artisan.id, status: 'declined' });
    const res = await request(app).delete(`/profiles/${artisan.id}`).send({ password: PASSWORD });

    expect(res.status).toBe(204);
    expect((await request(app).get(`/profiles/${artisan.id}`)).status).toBe(404);
    expect((await request(app).get(`/artisans/${artisan.id}`).set('X-API-Key', TEST_API_KEY)).status).toBe(404);
    expect((await login(artisan)).status).toBe(401);
    for (const table of ['bookings', 'reviews', 'portfolio_items']) {
      const [rows] = await db.query(`SELECT id FROM ${table} WHERE artisan_id = ?`, [artisan.id]);
      expect(rows).toHaveLength(0);
    }
  });
});
