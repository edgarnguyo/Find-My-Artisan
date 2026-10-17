// Automated tests for an artisan editing their profile and portfolio from the
// dashboard. They use an artisan made just for these tests, deleted at the end,
// so the sample artisans are never changed.
const request = require('supertest');
const app = require('../app');
const db = require('../db');

const PHOTO = 'https://example.com/photos/kitchen-sink.jpg';
let artisanId;
let otherArtisanId;

async function makeArtisan(name) {
  const res = await request(app).post('/profiles').send({
    name,
    // Date.now() keeps the email unique, since emails can't repeat.
    email: `profiles-test-${name.replace(/\W/g, '')}-${Date.now()}@example.com`,
    password: 'secret1',
    skill: 'Plumber',
    location: 'Westlands',
    county: 'Nairobi',
    phone: '0712000555',
  });
  return res.body.id;
}

function editProfile(body, id = artisanId) {
  return request(app).patch(`/profiles/${id}`).send(body);
}

function addItem(body, id = artisanId) {
  return request(app).post(`/profiles/${id}/portfolio`).send({ title: 'New sink', imageUrl: PHOTO, ...body });
}

beforeAll(async () => {
  artisanId = await makeArtisan('Profile Tester');
  otherArtisanId = await makeArtisan('Other Tester');
});

afterAll(async () => {
  const ids = [artisanId, otherArtisanId];
  // Portfolio items first: they point at the artisan.
  await db.query('DELETE FROM portfolio_items WHERE artisan_id IN (?)', [ids]);
  await db.query('DELETE FROM artisans WHERE id IN (?)', [ids]);
  // Without this, Jest hangs: mysql2's pool keeps its connections open.
  await db.end();
});

describe('PATCH /profiles/:id', () => {
  it('changes only the fields sent', async () => {
    const res = await editProfile({ bio: '  Leak repairs and new fittings.  ', hourlyRateKes: 850 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: artisanId,
      bio: 'Leak repairs and new fittings.',
      hourly_rate_kes: 850,
      location: 'Westlands',
      phone: '0712000555',
    });
  });

  it("shows the change in Meditrac's GET /artisans/:id", async () => {
    await editProfile({ location: 'Kilimani', county: 'Kiambu', phone: '0799000111', hourlyRateKes: 1200 });

    const res = await request(app).get(`/artisans/${artisanId}`);

    expect(res.body).toMatchObject({ area: 'Kilimani', county: 'Kiambu', phone: '0799000111', hourlyRateKes: 1200 });
  });

  it('clears an optional field sent as null or empty', async () => {
    await editProfile({ price: 'KES 2,000 / job' });

    const res = await editProfile({ price: '', bio: null });

    expect(res.body).toMatchObject({ price: null, bio: null });
  });

  it('ignores fields that are not editable, like skill', async () => {
    const res = await editProfile({ skill: 'Electrician', phone: '0711222333' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ skill: 'Plumber', phone: '0711222333' });
  });

  it('changes the name', async () => {
    const res = await editProfile({ name: '  Profile Tester Renamed  ' });

    expect(res.body.name).toBe('Profile Tester Renamed');
    await editProfile({ name: 'Profile Tester' });
  });

  it.each([
    [{ county: 'Narnia' }],
    [{ location: '   ' }],
    [{ phone: '' }],
    [{ hourlyRateKes: 0 }],
    [{ hourlyRateKes: '900' }],
    [{ bio: 'x'.repeat(2001) }],
    [{ name: '' }],
    [{ skill: 'Only a field that cannot be edited' }],
  ])('rejects %p with 400 and changes nothing', async body => {
    const before = (await request(app).get(`/profiles/${artisanId}`)).body;

    const res = await editProfile(body);

    expect(res.status).toBe(400);
    const after = (await request(app).get(`/profiles/${artisanId}`)).body;
    expect(after.county).toBe(before.county);
    expect(after.location).toBe(before.location);
  });

  it('returns 404 for an artisan that does not exist', async () => {
    const res = await editProfile({ bio: 'Hello' }, 999999);
    expect(res.status).toBe(404);
  });
});

describe('Portfolio', () => {
  it('adds an item and shows it on the profile, newest first', async () => {
    await addItem({ title: 'Older job' });
    const res = await addItem({
      title: '  Bathroom refit  ',
      description: 'New basin, taps and pipes.',
      workDate: '2026-03-14',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      title: 'Bathroom refit',
      description: 'New basin, taps and pipes.',
      image_url: PHOTO,
      work_date: '2026-03-14',
    });
    const profile = (await request(app).get(`/profiles/${artisanId}`)).body;
    expect(profile.portfolio[0]).toEqual(res.body);
    expect(profile.portfolio[1].title).toBe('Older job');
  });

  it.each([
    ['a missing title', { title: '' }],
    ['an http link', { imageUrl: 'http://example.com/a.jpg' }],
    ['a javascript: link', { imageUrl: 'javascript:alert(1)' }],
    ['text that is not a link', { imageUrl: 'my photo' }],
    ['a date in the future', { workDate: '2999-01-01' }],
    ['a date in the wrong format', { workDate: '14/03/2026' }],
  ])('rejects %s', async (_, body) => {
    const res = await addItem(body);
    expect(res.status).toBe(400);
  });

  it('holds at most 12 items', async () => {
    const id = otherArtisanId;
    for (let i = 0; i < 12; i++) {
      expect((await addItem({ title: `Job ${i}` }, id)).status).toBe(201);
    }

    const res = await addItem({ title: 'One too many' }, id);

    expect(res.status).toBe(409);
  });

  it('removes an item', async () => {
    const item = (await addItem({ title: 'To remove' })).body;

    const res = await request(app).delete(`/profiles/${artisanId}/portfolio/${item.id}`);

    expect(res.status).toBe(204);
    const profile = (await request(app).get(`/profiles/${artisanId}`)).body;
    expect(profile.portfolio.map(p => p.id)).not.toContain(item.id);
  });

  it("returns 404 removing another artisan's item, and keeps it", async () => {
    const item = (await addItem({ title: 'Not yours' })).body;

    const res = await request(app).delete(`/profiles/${otherArtisanId}/portfolio/${item.id}`);

    expect(res.status).toBe(404);
    const [rows] = await db.query('SELECT id FROM portfolio_items WHERE id = ?', [item.id]);
    expect(rows).toHaveLength(1);
  });
});
