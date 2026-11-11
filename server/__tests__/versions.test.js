// Week 13: v2 runs beside v1, and v1 must not change.
// v1 is at /v1/artisans and at the old /artisans. v2 is at /v2/artisans, and its
// only difference is that POST .../reviews needs a blockId (the booked job).
const request = require('supertest');
const app = require('../app');
const db = require('../db');
const { TEST_API_KEY } = require('../jest.setup');

const KEY = { 'X-API-Key': TEST_API_KEY };
const ARTISAN = 1;        // a sample artisan from schema.sql
const OTHER_ARTISAN = 2;  // another sample artisan
const SUNSET = 'Tue, 17 Nov 2026 00:00:00 GMT';

// Every row this file writes, removed in afterAll.
const madeReviews = [];
const madeBlocks = [];

// A block far in the future, so it never overlaps a real one.
async function makeBlock(artisanId, hour) {
  const res = await request(app).post(`/artisans/${artisanId}/availability`).set(KEY)
    .send({ start: `2099-01-0${hour}T09:00:00Z`, end: `2099-01-0${hour}T11:00:00Z` });
  expect(res.status).toBe(201);
  madeBlocks.push(res.body.id);
  return res.body.id;
}

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

  it('v1 still accepts a review with no blockId', async () => {
    const res = await request(app).post(`/artisans/${ARTISAN}/reviews`).set(KEY)
      .send({ author: 'Meditrac — versions test', rating: 4 });
    expect(res.status).toBe(201);
    madeReviews.push(res.body.id);
    expect(res.body).not.toHaveProperty('blockId');
  });
});

describe('v2: a review needs the booked job (blockId)', () => {
  it('GET /v2/artisans returns the same list as v1', async () => {
    const a = await request(app).get('/v2/artisans').set(KEY);
    const b = await request(app).get('/v1/artisans').set(KEY);
    expect(a.status).toBe(200);
    expect(a.body).toEqual(b.body);
  });

  it('rejects a v1-shaped review (no blockId) with 400', async () => {
    const res = await request(app).post(`/v2/artisans/${ARTISAN}/reviews`).set(KEY)
      .send({ author: 'Meditrac — versions test', rating: 4 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_body');
    expect(res.body.message).toMatch(/blockId is required/);
  });

  it('rejects a blockId that is not a whole number', async () => {
    const res = await request(app).post(`/v2/artisans/${ARTISAN}/reviews`).set(KEY)
      .send({ blockId: '7', author: 'Meditrac — versions test', rating: 4 });
    expect(res.status).toBe(400);
  });

  it("rejects another artisan's block", async () => {
    const othersBlock = await makeBlock(OTHER_ARTISAN, 1);
    const res = await request(app).post(`/v2/artisans/${ARTISAN}/reviews`).set(KEY)
      .send({ blockId: othersBlock, author: 'Meditrac — versions test', rating: 4 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not an availability block of artisan 1/);
  });

  it('creates the review for a block of this artisan: 201, Review shape plus blockId', async () => {
    const blockId = await makeBlock(ARTISAN, 2);
    const res = await request(app).post(`/v2/artisans/${ARTISAN}/reviews`).set(KEY)
      .send({ blockId, author: 'Meditrac — versions test', rating: 5, comment: 'Done on time.' });
    expect(res.status).toBe(201);
    madeReviews.push(res.body.id);
    expect(Object.keys(res.body).sort())
      .toEqual(['artisanId', 'author', 'blockId', 'comment', 'createdAt', 'id', 'rating']);
    expect(res.body).toMatchObject({ artisanId: ARTISAN, blockId, rating: 5 });
  });

  it('still checks the other fields the way v1 does', async () => {
    const blockId = await makeBlock(ARTISAN, 3);
    const res = await request(app).post(`/v2/artisans/${ARTISAN}/reviews`).set(KEY)
      .send({ blockId, author: 'Meditrac — versions test', rating: 9 });
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
