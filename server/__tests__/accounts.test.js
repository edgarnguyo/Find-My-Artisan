// Automated tests for the account page: clients and artisans changing their
// details and password, and deleting their account. Every account made here is
// deleted by the tests themselves or at the end.
const request = require('supertest');
const app = require('../app');
const { TEST_API_KEY, signedInAs, sessionCookie } = require('../jest.setup');
const db = require('../db');

const PASSWORD = 'secret1';
let n = 0;

// Date.now() and a counter keep each email unique, since emails can't repeat.
const email = kind => `accounts-test-${kind}-${Date.now()}-${++n}@example.com`;

// Each returns the new account with `cookie`: signing up signs you in.
async function makeClient() {
  const res = await request(app).post('/clients').send({ name: 'Acc Client', email: email('c'), password: PASSWORD });
  return { ...res.body, cookie: sessionCookie(res) };
}

async function makeArtisan() {
  const res = await request(app).post('/profiles').send({
    name: 'Acc Artisan', email: email('a'), password: PASSWORD, skill: 'Painter',
    location: 'Ruaka', county: 'Kiambu', phone: '0712000888',
  });
  return { ...res.body, cookie: sessionCookie(res) };
}

// A booking between the two, moved on to `status` ('pending', 'confirmed' or 'completed').
async function makeBooking(artisan, client, status, date) {
  const { id } = (await request(app).post('/bookings').set('Cookie', client.cookie).send({
    artisanId: artisan.id, name: 'Acc Client', contact: '0712000000',
    date, time: '09:00', job: 'Booking made by accounts.test.js',
  })).body;
  if (status !== 'pending') {
    await request(app).patch(`/bookings/${id}/status`).set('Cookie', artisan.cookie).send({ status: 'confirmed', endTime: '11:00' });
  }
  if (status === 'completed') {
    await request(app).patch(`/bookings/${id}/status`).set('Cookie', artisan.cookie).send({ status: 'completed' });
  }
  return id;
}

// supertest requests signed in as `account`.
const as = account => ({
  get: path => request(app).get(path).set('Cookie', account.cookie),
  patch: path => request(app).patch(path).set('Cookie', account.cookie),
  post: path => request(app).post(path).set('Cookie', account.cookie),
  delete: path => request(app).delete(path).set('Cookie', account.cookie),
});

function login(account, password = PASSWORD) {
  return request(app).post('/login').send({ email: account.email, password });
}

const madeArtisans = [];
afterAll(async () => {
  // Anything a test left behind: rows pointing at these artisans first.
  if (madeArtisans.length > 0) {
    // Quotes and their materials point at the bookings, not the artisan.
    for (const table of ['booking_materials', 'booking_quotes']) {
      await db.query(
        `DELETE ${table} FROM ${table} JOIN bookings ON bookings.id = ${table}.booking_id
         WHERE bookings.artisan_id IN (?)`,
        [madeArtisans]
      );
    }
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

    const res = await as(client).get(`/clients/${client.id}`);

    expect(res.body).toEqual({ id: client.id, name: 'Acc Client', email: client.email, phone: null, location: null });
  });

  // Week 9 audit, finding 8: anyone could read any client's email and phone.
  it("is only for that client: 401 signed out, 403 for anyone else", async () => {
    const client = await makeClient();
    const other = await makeClient();
    const path = `/clients/${client.id}`;

    const signedOut = await request(app).get(path);
    const otherClient = await as(other).get(path);
    const anArtisan = await request(app).get(path).set('Cookie', signedInAs('artisan', client.id));
    const edit = await as(other).patch(path).send({ name: 'Taken over' });
    const password = await as(other).patch(`${path}/password`).send({ currentPassword: PASSWORD, newPassword: 'newpass1' });
    const del = await as(other).delete(path).send({ password: PASSWORD });

    expect(signedOut.status).toBe(401);
    expect([otherClient.status, anArtisan.status, edit.status, password.status, del.status]).toEqual([403, 403, 403, 403, 403]);
    expect(otherClient.body).toEqual({ error: "That isn't your account" });
    expect((await as(client).get(path)).body.name).toBe('Acc Client');
  });

  it('changes name, phone and location; an empty value clears one', async () => {
    const client = await makeClient();
    await as(client).patch(`/clients/${client.id}`).send({ location: 'Kasarani' });

    const res = await as(client).patch(`/clients/${client.id}`).send({ name: ' Amina O. ', phone: '0722 111 222', location: '' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Amina O.', phone: '0722 111 222', location: null });
  });

  it.each([[{ name: '' }], [{ phone: 'x'.repeat(31) }], [{}], [{ email: 'new@example.com' }]])(
    'rejects %p', async body => {
      const client = await makeClient();
      const res = await as(client).patch(`/clients/${client.id}`).send(body);
      expect(res.status).toBe(400);
    }
  );

  it('changes the password only with the right current one', async () => {
    const client = await makeClient();
    const path = `/clients/${client.id}/password`;

    expect((await as(client).patch(path).send({ currentPassword: 'wrong1', newPassword: 'newpass1' })).status).toBe(403);
    expect((await as(client).patch(path).send({ currentPassword: PASSWORD, newPassword: 'short' })).status).toBe(400);
    expect((await as(client).patch(path).send({ currentPassword: PASSWORD, newPassword: 'newpass1' })).status).toBe(200);

    expect((await login(client, 'newpass1')).status).toBe(200);
    expect((await login(client, PASSWORD)).status).toBe(401);
  });

  it('refuses to delete with the wrong password, and keeps the account', async () => {
    const client = await makeClient();

    const res = await as(client).delete(`/clients/${client.id}`).send({ password: 'wrong1' });

    expect(res.status).toBe(403);
    expect((await login(client)).status).toBe(200);
  });

  it('deletes the account: open bookings cancelled and freed, past ones and reviews kept', async () => {
    const artisan = await makeArtisan();
    madeArtisans.push(artisan.id);
    const client = await makeClient();
    const open = await makeBooking(artisan, client, 'confirmed', '2031-02-01');
    const past = await makeBooking(artisan, client, 'completed', '2031-02-02');
    await as(client).post(`/bookings/${past}/review`).send({ rating: 5 });

    const res = await as(client).delete(`/clients/${client.id}`).send({ password: PASSWORD });

    expect(res.status).toBe(204);
    // Deleting signs you out: the cookie is cleared.
    expect(res.headers['set-cookie'][0]).toMatch(/^fma_session=;.*Expires=Thu, 01 Jan 1970/);
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

    expect((await as(artisan).patch(path).send({ currentPassword: 'nope12', newPassword: 'newpass1' })).status).toBe(403);
    expect((await as(artisan).patch(path).send({ currentPassword: PASSWORD, newPassword: 'newpass1' })).status).toBe(200);
    expect((await login(artisan, 'newpass1')).body.role).toBe('artisan');
  });

  it("can't delete a sample artisan, which has no password", async () => {
    const res = await request(app).delete('/profiles/1').set('Cookie', signedInAs('artisan', 1)).send({ password: '' });

    expect(res.status).toBe(403);
    expect((await request(app).get('/profiles/1')).status).toBe(200);
  });

  it("is only for that artisan: 401 signed out, 403 for anyone else", async () => {
    const artisan = await makeArtisan();
    madeArtisans.push(artisan.id);
    const path = `/profiles/${artisan.id}`;

    const signedOut = await request(app).delete(path).send({ password: PASSWORD });
    const otherArtisan = await request(app).delete(path).set('Cookie', signedInAs('artisan', 1)).send({ password: PASSWORD });
    const aClient = await request(app).delete(path).set('Cookie', signedInAs('client', artisan.id)).send({ password: PASSWORD });
    const password = await request(app).patch(`${path}/password`).set('Cookie', signedInAs('artisan', 1))
      .send({ currentPassword: PASSWORD, newPassword: 'newpass1' });

    expect([signedOut.status, otherArtisan.status, aClient.status, password.status]).toEqual([401, 403, 403, 403]);
    expect((await login(artisan)).status).toBe(200);
  });

  it('refuses to delete while a job is open, then deletes everything once it is answered', async () => {
    const artisan = await makeArtisan();
    madeArtisans.push(artisan.id);
    const client = await makeClient();
    const past = await makeBooking(artisan, client, 'completed', '2031-03-01');
    await as(client).post(`/bookings/${past}/review`).send({ rating: 4 });
    await as(artisan).post(`/profiles/${artisan.id}/portfolio`).send({ title: 'Mural', imageUrl: 'https://example.com/m.jpg' });
    const open = await makeBooking(artisan, client, 'pending', '2031-03-02');

    const refused = await as(artisan).delete(`/profiles/${artisan.id}`).send({ password: PASSWORD });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/1 open job/);

    await as(artisan).patch(`/bookings/${open}/status`).send({ status: 'declined' });
    const res = await as(artisan).delete(`/profiles/${artisan.id}`).send({ password: PASSWORD });

    expect(res.status).toBe(204);
    expect((await request(app).get(`/profiles/${artisan.id}`)).status).toBe(404);
    expect((await request(app).get(`/artisans/${artisan.id}`).set('X-API-Key', TEST_API_KEY)).status).toBe(404);
    expect((await login(artisan)).status).toBe(401);
    for (const table of ['bookings', 'reviews', 'portfolio_items']) {
      const [rows] = await db.query(`SELECT id FROM ${table} WHERE artisan_id = ?`, [artisan.id]);
      expect(rows).toHaveLength(0);
    }
  });

  // Quotes came after account deletion was written, and have no artisan_id:
  // deleting an artisan who had sent one used to fail with a 500.
  it('deletes an artisan whose finished job has a quote and materials', async () => {
    const artisan = await makeArtisan();
    madeArtisans.push(artisan.id);
    const client = await makeClient();
    const past = await makeBooking(artisan, client, 'completed', '2031-04-01');
    await db.query(
      "INSERT INTO booking_quotes (booking_id, labour_kes, status, version, sent_at) VALUES (?, 1500, 'accepted', 1, NOW())",
      [past]
    );
    await db.query(
      `INSERT INTO booking_materials (booking_id, material_id, name, material_type, quantity_kg, price_per_kg_kes)
       VALUES (?, 'HDPE', 'HDPE pellets', 'plastic', 2, 80)`,
      [past]
    );

    const res = await as(artisan).delete(`/profiles/${artisan.id}`).send({ password: PASSWORD });

    expect(res.status).toBe(204);
    for (const table of ['booking_quotes', 'booking_materials']) {
      const [rows] = await db.query(`SELECT booking_id FROM ${table} WHERE booking_id = ?`, [past]);
      expect(rows).toHaveLength(0);
    }
    const [bookings] = await db.query('SELECT id FROM bookings WHERE id = ?', [past]);
    expect(bookings).toHaveLength(0);
  });
});
