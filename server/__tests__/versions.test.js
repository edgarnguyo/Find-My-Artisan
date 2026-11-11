// Week 13: v2 runs beside v1, and v1 must not change.
// v1 is at /v1/artisans and at the old /artisans: a partner can review any
// artisan. v2 is at /v2/artisans: a review needs a finished job the artisan
// logged for that partner, or it gets 403 no_job.
const request = require('supertest');
const app = require('../app');
const db = require('../db');
const { TEST_API_KEY, OTHER_API_KEY, logPartnerJob } = require('../jest.setup');

const KEY = { 'X-API-Key': TEST_API_KEY };
const OTHER = { 'X-API-Key': OTHER_API_KEY };
const ARTISAN = 3;   // a sample artisan from schema.sql
const SUNSET = 'Tue, 24 Nov 2026 00:00:00 GMT';
const review = { author: 'Versions test', rating: 4 };

// Every row this file writes, removed in afterAll.
const madeReviews = [];
const madeBlocks = [];

afterAll(async () => {
  if (madeReviews.length) await db.query('DELETE FROM reviews WHERE id IN (?)', [madeReviews]);
  if (madeBlocks.length) await db.query('DELETE FROM availability_blocks WHERE id IN (?)', [madeBlocks]);
  await db.end();
});

describe('v1 is frozen', () => {
  it('GET /v1/artisans keeps its original shape: a bare list of ArtisanSummary', async () => {
    const res = await request(app).get('/v1/artisans').set(KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(Object.keys(res.body[0]).sort())
      .toEqual(['area', 'busy', 'county', 'id', 'name', 'trade', 'verified']);
  });

  it('the old unversioned /artisans answers exactly like /v1/artisans', async () => {
    const a = await request(app).get('/artisans').set(KEY);
    const b = await request(app).get('/v1/artisans').set(KEY);
    expect(a.status).toBe(200);
    expect(a.body).toEqual(b.body);
  });

  it('v1 error shape is unchanged', async () => {
    const res = await request(app).get('/v1/artisans/999999').set(KEY);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'not_found', message: 'No artisan with id 999999.' });
  });

  it('v1 still takes a review with no job behind it: 201, the Review shape', async () => {
    for (const path of ['/v1/artisans', '/artisans']) {
      const res = await request(app).post(`${path}/${ARTISAN}/reviews`).set(OTHER).send(review);
      expect(res.status).toBe(201);
      madeReviews.push(res.body.id);
      expect(Object.keys(res.body).sort())
        .toEqual(['artisanId', 'author', 'comment', 'createdAt', 'id', 'rating']);
    }
  });

  it('a v1 review can still only be edited by the key that posted it', async () => {
    const res = await request(app).post(`/artisans/${ARTISAN}/reviews`).set(OTHER).send(review);
    madeReviews.push(res.body.id);
    const byOther = await request(app).patch(`/artisans/${ARTISAN}/reviews/${res.body.id}`).set(OTHER).send({ rating: 5 });
    const byJest = await request(app).patch(`/artisans/${ARTISAN}/reviews/${res.body.id}`).set(KEY).send({ rating: 1 });
    expect(byOther.status).toBe(200);
    expect(byJest.status).toBe(404);
  });
});

describe('v2: a review needs a finished job logged for the partner', () => {
  it('GET /v2/artisans returns the same list as v1', async () => {
    const a = await request(app).get('/v2/artisans').set(KEY);
    const b = await request(app).get('/v1/artisans').set(KEY);
    expect(a.status).toBe(200);
    expect(a.body).toEqual(b.body);
  });

  it('refuses a review with no job behind it: 403 no_job', async () => {
    const res = await request(app).post(`/v2/artisans/${ARTISAN}/reviews`).set(OTHER).send(review);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('no_job');
  });

  it('takes the review once the artisan has logged a finished job for this partner', async () => {
    madeBlocks.push(await logPartnerJob(ARTISAN));   // for 'jest', ended an hour ago
    const res = await request(app).post(`/v2/artisans/${ARTISAN}/reviews`).set(KEY).send(review);
    expect(res.status).toBe(201);
    madeReviews.push(res.body.id);
    expect(Object.keys(res.body).sort())
      .toEqual(['artisanId', 'author', 'comment', 'createdAt', 'id', 'rating']);
  });

  it('still checks the fields the way v1 does', async () => {
    const res = await request(app).post(`/v2/artisans/${ARTISAN}/reviews`).set(KEY)
      .send({ author: 'Versions test', rating: 9 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('rating must be a whole number from 1 to 5.');
  });

  it('needs an API key like every other version', async () => {
    const res = await request(app).get('/v2/artisans');
    expect(res.status).toBe(401);
  });
});

describe('deprecation headers', () => {
  it('v1 and the old URLs announce the sunset', async () => {
    for (const path of ['/v1/artisans', '/artisans', '/v1/artisans/1', '/artisans/1']) {
      const res = await request(app).get(path).set(KEY);
      expect(res.headers.deprecation).toBe('true');
      expect(res.headers.sunset).toBe(SUNSET);
      expect(res.headers.link).toBe('</v2/artisans>; rel="successor-version"');
    }
  });

  it('v2 and other paths do not carry them', async () => {
    for (const path of ['/v2/artisans', '/v2/artisans/1', '/stats']) {
      const res = await request(app).get(path).set(KEY);
      expect(res.headers.deprecation).toBeUndefined();
    }
  });
});
