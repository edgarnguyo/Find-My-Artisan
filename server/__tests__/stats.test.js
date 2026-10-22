// Automated tests for GET /stats, the landing page's numbers and recent work.
// Each number is checked against the same count asked of the database directly.
const request = require('supertest');
const app = require('../app');
const db = require('../db');
const { verifiedSql } = require('../verified');

let artisanId;

beforeAll(async () => {
  const res = await request(app).post('/profiles').send({
    name: 'Stats Tester',
    email: `stats-test-${Date.now()}@example.com`,
    password: 'secret1',
    skill: 'Carpenter',
    location: 'Kilimani',
    county: 'Nairobi',
    phone: '0712000777',
  });
  artisanId = res.body.id;
});

afterAll(async () => {
  await db.query('DELETE FROM portfolio_items WHERE artisan_id = ?', [artisanId]);
  await db.query('DELETE FROM artisans WHERE id = ?', [artisanId]);
  // Without this, Jest hangs: mysql2's pool keeps its connections open.
  await db.end();
});

describe('GET /stats', () => {
  it('returns the real counts from the database', async () => {
    const res = await request(app).get('/stats');

    const [[expected]] = await db.query(
      `SELECT (SELECT COUNT(*) FROM artisans a WHERE ${verifiedSql('a')}) AS verified,
              (SELECT ROUND(AVG(rating), 1) FROM reviews) AS rating,
              (SELECT COUNT(*) FROM reviews) AS reviews,
              (SELECT SUM(jobs_completed) FROM artisans) AS seeded,
              (SELECT COUNT(*) FROM bookings WHERE status = 'completed') AS onSite`
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      verifiedArtisans: expected.verified,
      averageRating: Number(expected.rating),
      reviewCount: expected.reviews,
      jobsCompleted: Number(expected.seeded) + expected.onSite,
    });
    expect(typeof res.body.averageRating).toBe('number');
  });

  it('lists the newest portfolio photo first, with who did the work', async () => {
    const item = (await request(app).post(`/profiles/${artisanId}/portfolio`).send({
      title: 'Fitted wardrobe',
      imageUrl: 'https://example.com/wardrobe.jpg',
    })).body;

    const res = await request(app).get('/stats');

    expect(res.body.recentWork[0]).toEqual({
      id: item.id,
      title: 'Fitted wardrobe',
      imageUrl: 'https://example.com/wardrobe.jpg',
      artisanId,
      artisanName: 'Stats Tester',
      skill: 'Carpenter',
    });
    expect(res.body.recentWork.length).toBeLessThanOrEqual(6);
  });
});
