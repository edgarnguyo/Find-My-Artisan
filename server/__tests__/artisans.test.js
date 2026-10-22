// Automated tests for the endpoints promised in openapi.yaml (Meditrac's contract):
// GET /artisans, GET /artisans/:id, and the reviews + availability writes.
// Website-only routes (profiles, clients, login, bookings) aren't in the
// contract, so they're out of scope for this file.
const request = require('supertest');
const app = require('../app');
const { TEST_API_KEY } = require('../jest.setup');
const db = require('../db');

// Artisan 1 (Wanjiru Kamau) is one of the 23 sample rows schema.sql always
// creates, so it exists on any machine that ran the setup script. No artisan
// will ever reach this id, since AUTO_INCREMENT is nowhere near it yet.
const REAL_ARTISAN_ID = 1;
const MISSING_ARTISAN_ID = 9999;

afterAll(async () => {
  // Without this, Jest hangs after the last test: mysql2's pool keeps its
  // connections open waiting for more queries that will never come.
  await db.end();
});

describe('GET /artisans', () => {
  it('returns 200 with every artisan in the ArtisanSummary shape', async () => {
    const res = await request(app).get('/artisans').set('X-API-Key', TEST_API_KEY);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(23);

    const wanjiru = res.body.find(a => a.id === REAL_ARTISAN_ID);
    expect(wanjiru).toMatchObject({
      id: 1,
      name: 'Wanjiru Kamau',
      trade: 'electrical',
      area: 'Westlands',
      county: 'Nairobi',
      verified: true,
    });
    expect(Array.isArray(wanjiru.busy)).toBe(true);
    // Full profile fields (phone, hourlyRateKes) belong only to GET /artisans/:id.
    expect(wanjiru).not.toHaveProperty('phone');
  });

  it('filters by trade and by county together', async () => {
    const res = await request(app).get('/artisans').set('X-API-Key', TEST_API_KEY).query({ trade: 'plumbing', county: 'Nairobi' });

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const artisan of res.body) {
      expect(artisan.trade).toBe('plumbing');
      expect(artisan.county).toBe('Nairobi');
    }
  });

  it('returns an empty array when no artisan matches the filters', async () => {
    // No sample artisan is based in Turkana, so this combination should never match.
    const res = await request(app).get('/artisans').set('X-API-Key', TEST_API_KEY).query({ county: 'Turkana' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('rejects an unknown county with 400 invalid_query', async () => {
    const res = await request(app).get('/artisans').set('X-API-Key', TEST_API_KEY).query({ county: 'Narnia' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      code: 'invalid_query',
      message: expect.any(String),
    });
  });
});

describe('GET /artisans/:id', () => {
  it('returns 200 with the full Artisan profile', async () => {
    const res = await request(app).get(`/artisans/${REAL_ARTISAN_ID}`).set('X-API-Key', TEST_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 1,
      name: 'Wanjiru Kamau',
      trade: 'electrical',
      verified: true,
      phone: '+254712000001',
    });
    expect(typeof res.body.hourlyRateKes).toBe('number');
    // The contract's verification is optional, and there are no certificates.
    expect(res.body).not.toHaveProperty('verification');
  });

  it('returns 404 not_found for an id that does not exist', async () => {
    const res = await request(app).get(`/artisans/${MISSING_ARTISAN_ID}`).set('X-API-Key', TEST_API_KEY);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      code: 'not_found',
      message: expect.any(String),
    });
  });

  it('returns 404 for a non-numeric id rather than crashing', async () => {
    const res = await request(app).get('/artisans/not-a-number').set('X-API-Key', TEST_API_KEY);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'not_found');
  });
});

describe('Availability blocks (POST, PATCH, DELETE /artisans/:id/availability)', () => {
  // Far enough in the future that it can't collide with a block a different
  // test (or a real artisan) created for the 14-day busy window.
  const base = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);
  const start = base.toISOString().replace(/\.\d+Z$/, 'Z');
  const end = new Date(base.getTime() + 3 * 60 * 60 * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
  let blockId;

  it('rejects a request missing start/end with 400 invalid_body', async () => {
    const res = await request(app).post(`/artisans/${REAL_ARTISAN_ID}/availability`).set('X-API-Key', TEST_API_KEY).send({ start });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ code: 'invalid_body', message: expect.any(String) });
  });

  it('rejects end before start with 400 invalid_body', async () => {
    const res = await request(app)
      .post(`/artisans/${REAL_ARTISAN_ID}/availability`).set('X-API-Key', TEST_API_KEY)
      .send({ start: end, end: start });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_body');
  });

  it('returns 404 when the artisan does not exist', async () => {
    const res = await request(app)
      .post(`/artisans/${MISSING_ARTISAN_ID}/availability`).set('X-API-Key', TEST_API_KEY)
      .send({ start, end });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('creates the block and returns 201 with the AvailabilityBlock shape', async () => {
    const res = await request(app)
      .post(`/artisans/${REAL_ARTISAN_ID}/availability`).set('X-API-Key', TEST_API_KEY)
      .send({ start, end });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ artisanId: REAL_ARTISAN_ID, start, end });
    expect(typeof res.body.id).toBe('number');
    expect(typeof res.body.createdAt).toBe('string');
    blockId = res.body.id;
  });

  it('rejects a second block that overlaps the one just created', async () => {
    const res = await request(app)
      .post(`/artisans/${REAL_ARTISAN_ID}/availability`).set('X-API-Key', TEST_API_KEY)
      .send({ start, end });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_body');
  });

  it('updates the block with PATCH and returns the new end time', async () => {
    const newEnd = new Date(base.getTime() + 4 * 60 * 60 * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
    const res = await request(app)
      .patch(`/artisans/${REAL_ARTISAN_ID}/availability/${blockId}`).set('X-API-Key', TEST_API_KEY)
      .send({ end: newEnd });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: blockId, start, end: newEnd });
  });

  it('rejects a PATCH with no fields with 400 invalid_body', async () => {
    const res = await request(app).patch(`/artisans/${REAL_ARTISAN_ID}/availability/${blockId}`).set('X-API-Key', TEST_API_KEY).send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_body');
  });

  it('returns 404 for PATCH on a block id that does not exist', async () => {
    const res = await request(app)
      .patch(`/artisans/${REAL_ARTISAN_ID}/availability/999999`).set('X-API-Key', TEST_API_KEY)
      .send({ end });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('deletes the block and returns 204 with no body', async () => {
    const res = await request(app).delete(`/artisans/${REAL_ARTISAN_ID}/availability/${blockId}`).set('X-API-Key', TEST_API_KEY);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('returns 404 deleting the same block a second time', async () => {
    const res = await request(app).delete(`/artisans/${REAL_ARTISAN_ID}/availability/${blockId}`).set('X-API-Key', TEST_API_KEY);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });
});

describe('Reviews (POST, PATCH, DELETE /artisans/:id/reviews)', () => {
  let reviewId;
  // A review that shipped with schema.sql, not posted through the API. The
  // contract says only API-posted reviews can be edited, so this id has to
  // come straight from the database, not from any endpoint under test.
  let seededReviewId;

  beforeAll(async () => {
    const [rows] = await db.query(
      'SELECT id FROM reviews WHERE artisan_id = ? AND from_api = FALSE LIMIT 1',
      [REAL_ARTISAN_ID]
    );
    seededReviewId = rows[0].id;
  });

  it('rejects a missing rating with 400 invalid_body', async () => {
    const res = await request(app)
      .post(`/artisans/${REAL_ARTISAN_ID}/reviews`).set('X-API-Key', TEST_API_KEY)
      .send({ author: 'Meditrac — Test branch' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ code: 'invalid_body', message: expect.any(String) });
  });

  it('rejects a rating outside 1-5 with 400 invalid_body', async () => {
    const res = await request(app)
      .post(`/artisans/${REAL_ARTISAN_ID}/reviews`).set('X-API-Key', TEST_API_KEY)
      .send({ author: 'Meditrac — Test branch', rating: 6 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_body');
  });

  it('returns 404 when the artisan does not exist', async () => {
    const res = await request(app)
      .post(`/artisans/${MISSING_ARTISAN_ID}/reviews`).set('X-API-Key', TEST_API_KEY)
      .send({ author: 'Meditrac — Test branch', rating: 5 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('creates the review and returns 201 with the Review shape', async () => {
    const res = await request(app)
      .post(`/artisans/${REAL_ARTISAN_ID}/reviews`).set('X-API-Key', TEST_API_KEY)
      .send({ author: 'Meditrac — Test branch', rating: 5, comment: 'Great job.' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      artisanId: REAL_ARTISAN_ID,
      author: 'Meditrac — Test branch',
      rating: 5,
      comment: 'Great job.',
    });
    expect(typeof res.body.id).toBe('number');
    expect(typeof res.body.createdAt).toBe('string');
    reviewId = res.body.id;
  });

  it('updates just the rating with PATCH, leaving other fields unchanged', async () => {
    const res = await request(app)
      .patch(`/artisans/${REAL_ARTISAN_ID}/reviews/${reviewId}`).set('X-API-Key', TEST_API_KEY)
      .send({ rating: 3 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: reviewId, rating: 3, author: 'Meditrac — Test branch' });
  });

  it('rejects a PATCH with no fields with 400 invalid_body', async () => {
    const res = await request(app).patch(`/artisans/${REAL_ARTISAN_ID}/reviews/${reviewId}`).set('X-API-Key', TEST_API_KEY).send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_body');
  });

  it('returns 404 trying to PATCH a review that did not come through the API', async () => {
    const res = await request(app)
      .patch(`/artisans/${REAL_ARTISAN_ID}/reviews/${seededReviewId}`).set('X-API-Key', TEST_API_KEY)
      .send({ rating: 1 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('deletes the review and returns 204 with no body', async () => {
    const res = await request(app).delete(`/artisans/${REAL_ARTISAN_ID}/reviews/${reviewId}`).set('X-API-Key', TEST_API_KEY);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('returns 404 deleting the same review a second time', async () => {
    const res = await request(app).delete(`/artisans/${REAL_ARTISAN_ID}/reviews/${reviewId}`).set('X-API-Key', TEST_API_KEY);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('returns 404 trying to DELETE a review that did not come through the API', async () => {
    const res = await request(app).delete(`/artisans/${REAL_ARTISAN_ID}/reviews/${seededReviewId}`).set('X-API-Key', TEST_API_KEY);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });
});

describe('verified: 30 days on the site and 3+ reviews averaging 4.3 or more', () => {
  let id;
  const review = rating =>
    request(app).post(`/artisans/${id}/reviews`).set('X-API-Key', TEST_API_KEY).send({ author: 'artisans.test.js', rating });
  const profile = async () => (await request(app).get(`/artisans/${id}`).set('X-API-Key', TEST_API_KEY)).body;
  const signedUpDaysAgo = days =>
    db.query('UPDATE artisans SET created_at = NOW() - INTERVAL ? DAY WHERE id = ?', [days, id]);

  beforeAll(async () => {
    const res = await request(app).post('/profiles').send({
      name: 'Verified Tester',
      email: `verified-test-${Date.now()}@example.com`,
      password: 'secret1',
      skill: 'Painter',
      location: 'Kilimani',
      county: 'Nairobi',
      phone: '0700000002',
    });
    id = res.body.id;
    await signedUpDaysAgo(31);
  });

  afterAll(async () => {
    await db.query('DELETE FROM reviews WHERE artisan_id = ?', [id]);
    await db.query('DELETE FROM artisans WHERE id = ?', [id]);
  });

  it('is not verified with only 2 reviews, however good', async () => {
    await review(5);
    await review(5);

    expect((await profile()).verified).toBe(false);
  });

  it('is verified at the third review', async () => {
    await review(5);

    expect((await profile()).verified).toBe(true);

    // The list and the website's profile agree.
    const list = await request(app).get('/artisans').set('X-API-Key', TEST_API_KEY);
    expect(list.body.find(a => a.id === id).verified).toBe(true);
    const site = await request(app).get(`/profiles/${id}`);
    expect(site.body.verified).toBe(1);
  });

  it('loses the badge when the average drops below 4.3, and gets it back', async () => {
    const bad = await review(1); // 5, 5, 5, 1: average 4.0

    expect((await profile()).verified).toBe(false);

    await request(app).delete(`/artisans/${id}/reviews/${bad.body.id}`).set('X-API-Key', TEST_API_KEY);
    expect((await profile()).verified).toBe(true);
  });

  it('is not verified before 30 days on the site', async () => {
    await signedUpDaysAgo(29);

    expect((await profile()).verified).toBe(false);
  });
});
