// Automated tests for GET /partner/materials, the page's route to Kanairo-Klean.
// The partner's server isn't needed: global.fetch is replaced with a fake that
// answers the way their contract (or a broken network) would.
const request = require('supertest');
const app = require('../app');

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
