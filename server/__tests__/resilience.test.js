// Week 11: the timeout, retries and saved-data fallback for calls to Kanairo-Klean.
// global.fetch is replaced with fakes, so no partner (and no database) is needed.
const request = require('supertest');
const app = require('../app');
const partnerRoutes = require('../routes/partner');
const { fetchWithRetry } = require('../resilientFetch');

const realFetch = global.fetch;
const env = { ...process.env };

const KANAIRO_ALU = { material_id: 'ALU', name: 'Aluminium', type: 'metal', quantity_kg: 430, unit_price_kes: 85 };
const OUR_ALU = { id: 'ALU', name: 'Aluminium', type: 'metal', quantityKg: 430, pricePerKgKes: 85 };

function answer(status, body = {}, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

// A fetch that answers with each of these in turn, then repeats the last one.
function partnerSequence(...answers) {
  let i = 0;
  return jest.fn(async () => {
    const next = answers[Math.min(i++, answers.length - 1)];
    if (next instanceof Error) throw next;
    return answer(...next);
  });
}

// A fetch like a partner that never answers: it only ends when the timeout aborts it.
function neverAnswers() {
  return jest.fn((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  }));
}

// The error codes logged as JSON by monitoring.js's logError (Week 12 format).
function loggedCodes() {
  return console.error.mock.calls.flatMap(([line]) => {
    try { return [JSON.parse(line).code]; } catch { return []; }
  });
}

function connectionRefused() {
  const err = new TypeError('fetch failed');
  err.cause = { code: 'ECONNREFUSED' };
  return err;
}

beforeEach(() => {
  process.env.PARTNER_URL = 'http://partner.test';
  process.env.PARTNER_API_KEY = 'test-token';
  process.env.PARTNER_RETRY_DELAY_MS = '1';
  partnerRoutes.forgetSavedMaterials();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = realFetch;
  process.env = { ...env };
  jest.restoreAllMocks();
});

describe('fetchWithRetry', () => {
  const quick = { timeoutMs: 50, retries: 2, delayMs: 1 };

  it('gives up on a slow partner after the timeout', async () => {
    global.fetch = neverAnswers();
    const started = Date.now();

    await expect(fetchWithRetry('http://partner.test/x', {}, { ...quick, retries: 0 }))
      .rejects.toHaveProperty('name', 'TimeoutError');
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('tries again after a 503 and returns the answer that worked', async () => {
    global.fetch = partnerSequence([503], [503], [200, { ok: true }]);

    const res = await fetchWithRetry('http://partner.test/x', {}, quick);

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('stops after 2 retries when the partner always fails', async () => {
    global.fetch = partnerSequence([500]);

    const res = await fetchWithRetry('http://partner.test/x', {}, quick);

    expect(res.status).toBe(500);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('retries a timeout and a refused connection, then throws the last error', async () => {
    global.fetch = partnerSequence(connectionRefused());

    await expect(fetchWithRetry('http://partner.test/x', {}, quick)).rejects.toThrow('fetch failed');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it.each([400, 401, 403, 404])('never retries a %i', async status => {
    global.fetch = partnerSequence([status]);

    const res = await fetchWithRetry('http://partner.test/x', {}, quick);

    expect(res.status).toBe(status);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('never retries a %s, which could happen twice', async method => {
    global.fetch = partnerSequence([503]);

    const res = await fetchWithRetry('http://partner.test/x', { method }, quick);

    expect(res.status).toBe(503);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('waits longer each time: 200 ms, then 400 ms', async () => {
    global.fetch = partnerSequence([503]);
    const waits = [];
    jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms) => {
      waits.push(ms);
      fn();
      return 0;
    });

    await fetchWithRetry('http://partner.test/x', {}, { timeoutMs: 1000, retries: 2, delayMs: 200 });

    expect(waits).toEqual([200, 400]);
  });

  it("waits for a 429's Retry-After, up to 5 seconds", async () => {
    global.fetch = partnerSequence([429, {}, { 'Retry-After': '3' }], [429, {}, { 'Retry-After': '60' }], [200]);
    const waits = [];
    jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms) => {
      waits.push(ms);
      fn();
      return 0;
    });

    const res = await fetchWithRetry('http://partner.test/x', {}, { timeoutMs: 1000, retries: 2, delayMs: 200 });

    expect(res.status).toBe(200);
    expect(waits).toEqual([3000, 5000]);
  });
});

describe('GET /partner/materials when Kanairo misbehaves', () => {
  it('succeeds through a flaky partner: two 503s, then the list', async () => {
    global.fetch = partnerSequence([503], [503], [200, { data: [KANAIRO_ALU], count: 1 }]);

    const res = await request(app).get('/partner/materials');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [OUR_ALU], stale: false, asOf: expect.any(String) });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('cuts off a slow partner and says "timeout" in the log', async () => {
    process.env.PARTNER_TIMEOUT_MS = '50';
    global.fetch = neverAnswers();

    const res = await request(app).get('/partner/materials');

    expect(res.status).toBe(502);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(loggedCodes()).toContain('timeout');
  });

  it('calls a rejected token once only, since retrying cannot fix it', async () => {
    global.fetch = partnerSequence([401, { code: 401, message: 'Missing or invalid API token' }]);

    const res = await request(app).get('/partner/materials');

    expect(res.status).toBe(502);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('shows the saved list, marked stale, when the partner goes down', async () => {
    global.fetch = partnerSequence([200, { data: [KANAIRO_ALU], count: 1 }], connectionRefused());
    const live = await request(app).get('/partner/materials');

    const res = await request(app).get('/partner/materials');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [OUR_ALU], stale: true, asOf: live.body.asOf });
    // Saved data hides the failure from users, so the log must still record it.
    expect(loggedCodes()).toContain('ECONNREFUSED');
  });

  it('keeps a separate saved list for each type filter', async () => {
    global.fetch = partnerSequence([200, { data: [KANAIRO_ALU], count: 1 }], connectionRefused());
    await request(app).get('/partner/materials?type=metal');

    const res = await request(app).get('/partner/materials?type=glass');

    expect(res.status).toBe(502);
  });

  it('answers 502 with a friendly message when nothing is saved yet', async () => {
    global.fetch = partnerSequence([500]);

    const res = await request(app).get('/partner/materials');

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/unavailable/);
  });

  it('never puts the token in the retry or failure log', async () => {
    global.fetch = partnerSequence([503]);

    await request(app).get('/partner/materials');

    const logged = [...console.warn.mock.calls, ...console.error.mock.calls].flat().join(' ');
    expect(logged).toContain('503');
    expect(logged).not.toContain('test-token');
  });
});
