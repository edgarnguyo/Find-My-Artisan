// Automated tests for the website's routes to Kanairo-Klean: /partner/materials,
// /partner/collection-locations and /partner/drop-offs.
// The partner's server isn't needed: global.fetch is replaced with a fake that
// answers the way their contract (or a broken network) would.
const request = require('supertest');
const app = require('../app');
const db = require('../db');
const { signedInAs } = require('../jest.setup');

const realFetch = global.fetch;
const env = { ...process.env };

// A Response like the one fetch resolves with.
function partnerAnswers(status, body) {
  return jest.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  );
}

// The error Node's fetch throws when nothing is listening at the address.
function connectionRefused() {
  const err = new TypeError('fetch failed');
  err.cause = { code: 'ECONNREFUSED' };
  return jest.fn().mockRejectedValue(err);
}

beforeEach(() => {
  process.env.PARTNER_URL = 'http://partner.test';
  process.env.PARTNER_API_KEY = 'test-token';
  // The route logs why each failure happened; keep the test output readable.
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = realFetch;
  process.env = { ...env };
  jest.restoreAllMocks();
});

describe('GET /partner/materials', () => {
  it('sends the Bearer token and returns each material in our shape', async () => {
    global.fetch = partnerAnswers(200, [
      { material_id: 'ALU', name: 'Aluminium', type: 'metal', quantity_kg: 430, unit_price_kes: 85 },
    ]);

    const res = await request(app).get('/partner/materials?type=metal');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 'ALU', name: 'Aluminium', type: 'metal', quantityKg: 430, pricePerKgKes: 85 },
    ]);
    const [url, options] = global.fetch.mock.calls[0];
    expect(String(url)).toBe('http://partner.test/materials?type=metal');
    expect(options.headers.Authorization).toBe('Bearer test-token');
  });

  it('rejects an unknown type without calling the partner', async () => {
    global.fetch = jest.fn();

    const res = await request(app).get('/partner/materials?type=wood');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/metal, plastic, paper, glass, e-waste/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('answers 502 with a message when the partner is down', async () => {
    global.fetch = connectionRefused();

    const res = await request(app).get('/partner/materials');

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/unavailable/);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), 'ECONNREFUSED');
  });

  it('answers 502 when the partner rejects the token', async () => {
    global.fetch = partnerAnswers(401, { code: 401, message: 'Missing or invalid API token' });

    const res = await request(app).get('/partner/materials');

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/unavailable/);
  });

  it('answers 502 without calling anyone when the partner settings are missing', async () => {
    delete process.env.PARTNER_API_KEY;
    global.fetch = jest.fn();

    const res = await request(app).get('/partner/materials');

    expect(res.status).toBe(502);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('never puts the token in the log', async () => {
    global.fetch = partnerAnswers(500, { code: 500, message: 'boom' });

    await request(app).get('/partner/materials');

    const logged = console.error.mock.calls.flat().join(' ');
    expect(logged).toContain('500');
    expect(logged).not.toContain('test-token');
  });
});

describe('GET /partner/collection-locations', () => {
  it('returns each yard in our shape', async () => {
    global.fetch = partnerAnswers(200, [
      { location_id: '2', name: 'Gikomba', area: 'Gikomba', county: 'Nairobi', is_active: true },
    ]);

    const res = await request(app).get('/partner/collection-locations');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: '2', name: 'Gikomba', area: 'Gikomba', county: 'Nairobi' }]);
  });

  it('answers 502 when the partner is down', async () => {
    global.fetch = connectionRefused();

    const res = await request(app).get('/partner/collection-locations');

    expect(res.status).toBe(502);
  });
});

describe('POST /partner/drop-offs', () => {
  const valid = { bookingId: 12, locationId: '2', materialType: 'metal', quantityKg: 12.5 };
  // Reports come from the signed-in artisan, here artisan 3.
  const AS_ARTISAN = signedInAs('artisan', 3);

  // A fake database: the booking lookup answers as if booking 12 is artisan 3's,
  // with this status. The reserving INSERT gets row id 7, or fails as a duplicate.
  // Returns the mock, so a test can check which statements ran.
  function bookingIs(status, { duplicate = false } = {}) {
    return jest.spyOn(db, 'query').mockImplementation(async sql => {
      if (sql.trim().startsWith('SELECT')) return [status ? [{ status, skill: 'Plumber' }] : []];
      if (sql.trim().startsWith('INSERT')) {
        if (duplicate) throw Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });
        return [{ insertId: 7 }];
      }
      return [{ affectedRows: 1 }];
    });
  }

  // The statements the route ran, by their first word: ['SELECT', 'INSERT', ...].
  const statements = query => query.mock.calls.map(([sql]) => sql.trim().split(/\s/)[0]);

  it('sends the contract body to the right yard and returns the drop-off', async () => {
    const query = bookingIs('completed');
    global.fetch = partnerAnswers(201, {
      drop_off_id: 'drop-0001', location_id: '2', material_type: 'metal', quantity_kg: 12.5,
      source: 'Find My Artisan, plumber job #12', notes: 'Copper offcuts',
      status: 'pending', created_at: '2026-10-20T10:30:00Z',
    });

    const res = await request(app).post('/partner/drop-offs').set('Cookie', AS_ARTISAN).send({ ...valid, notes: ' Copper offcuts ' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 'drop-0001', locationId: '2', materialType: 'metal', quantityKg: 12.5,
      status: 'pending', createdAt: '2026-10-20T10:30:00Z',
    });
    const [url, options] = global.fetch.mock.calls[0];
    expect(String(url)).toBe('http://partner.test/collection-locations/2/drop-offs');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(options.body)).toEqual({
      material_type: 'metal', quantity_kg: 12.5, source: 'Find My Artisan, plumber job #12', notes: 'Copper offcuts',
    });
    // Reserved before the call, then filled in with Kanairo's id and status.
    expect(statements(query)).toEqual(['SELECT', 'INSERT', 'UPDATE']);
    expect(query.mock.calls[2][1]).toEqual(['drop-0001', 'pending', 7]);
  });

  it('refuses a material already reported for the job, without calling the partner', async () => {
    bookingIs('completed', { duplicate: true });
    global.fetch = jest.fn();

    const res = await request(app).post('/partner/drop-offs').set('Cookie', AS_ARTISAN).send(valid);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already reported metal/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('leaves out blank notes, which their contract does not allow', async () => {
    bookingIs('completed');
    global.fetch = partnerAnswers(201, { drop_off_id: 'drop-0002', location_id: '2', status: 'pending' });

    await request(app).post('/partner/drop-offs').set('Cookie', AS_ARTISAN).send({ ...valid, notes: '   ' });

    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).not.toHaveProperty('notes');
  });

  it.each([
    ['an unknown material', { materialType: 'wood' }],
    ['a weight of 0', { quantityKg: 0 }],
    ['a weight sent as text', { quantityKg: '12' }],
    ['a weight too big for the column', { quantityKg: 1e6 }],
    ['no yard', { locationId: '' }],
    ['no booking', { bookingId: undefined }],
  ])('rejects %s without calling the partner', async (_, change) => {
    global.fetch = jest.fn();

    const res = await request(app).post('/partner/drop-offs').set('Cookie', AS_ARTISAN).send({ ...valid, ...change });

    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Week 9 audit, finding 8: the artisan used to come from the body.
  it('needs an artisan signed in, and takes the artisan from the session', async () => {
    const query = bookingIs('completed');
    global.fetch = jest.fn();

    const nobody = await request(app).post('/partner/drop-offs').send({ ...valid, artisanId: 3 });
    const aClient = await request(app).post('/partner/drop-offs').set('Cookie', signedInAs('client', 3)).send(valid);
    expect([nobody.status, aClient.status]).toEqual([401, 403]);
    expect(global.fetch).not.toHaveBeenCalled();

    // An artisanId in the body is ignored: the booking is looked up for artisan 8.
    await request(app).post('/partner/drop-offs').set('Cookie', signedInAs('artisan', 8)).send({ ...valid, artisanId: 3 });
    expect(query.mock.calls[0][1]).toEqual([12, 8]);
  });

  it('answers 404 for a job that is not this artisan\'s', async () => {
    bookingIs(null);
    global.fetch = jest.fn();

    const res = await request(app).post('/partner/drop-offs').set('Cookie', AS_ARTISAN).send(valid);

    expect(res.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('answers 409 for a job that is not completed yet', async () => {
    bookingIs('confirmed');
    global.fetch = jest.fn();

    const res = await request(app).post('/partner/drop-offs').set('Cookie', AS_ARTISAN).send(valid);

    expect(res.status).toBe(409);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('answers 404 when the partner says the yard is not active', async () => {
    bookingIs('completed');
    global.fetch = partnerAnswers(404, { code: 404, message: 'Collection location 2 not found' });

    const res = await request(app).post('/partner/drop-offs').set('Cookie', AS_ARTISAN).send(valid);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no longer taking drop-offs/);
  });

  it("passes on the partner's reason when they refuse the body", async () => {
    bookingIs('completed');
    global.fetch = partnerAnswers(400, { code: 400, message: 'source must be 1 to 120 characters' });

    const res = await request(app).post('/partner/drop-offs').set('Cookie', AS_ARTISAN).send(valid);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/source must be 1 to 120 characters/);
  });

  it('answers 502 when the partner is down, and frees the reserved row', async () => {
    const query = bookingIs('completed');
    global.fetch = connectionRefused();

    const res = await request(app).post('/partner/drop-offs').set('Cookie', AS_ARTISAN).send(valid);

    expect(res.status).toBe(502);
    expect(statements(query)).toEqual(['SELECT', 'INSERT', 'DELETE']);
    expect(query.mock.calls[2][1]).toEqual([7]);
  });

  it('frees the reserved row when the partner refuses it, so it can be sent again', async () => {
    const query = bookingIs('completed');
    global.fetch = partnerAnswers(404, { code: 404, message: 'Collection location 2 not found' });

    await request(app).post('/partner/drop-offs').set('Cookie', AS_ARTISAN).send(valid);

    expect(statements(query)).toEqual(['SELECT', 'INSERT', 'DELETE']);
  });
});
