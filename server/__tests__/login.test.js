// Automated tests for signing in (Week 9 audit, findings 8-10): the session
// cookie /login issues, bcrypt-hashed passwords (and old plain-text ones being
// hashed on the next sign-in), and the limit on wrong passwords per address.
// Every client made here is deleted at the end.
const express = require('express');
const request = require('supertest');
const app = require('../app');
const db = require('../db');
const { sessionCookie } = require('../jest.setup');
const { makeToken, readToken } = require('../session');
const { createLoginLimit } = require('../loginLimit');
const loginRoutes = require('../routes/login');

const PASSWORD = 'secret1';
let n = 0;
const email = () => `login-test-${Date.now()}-${++n}@example.com`;

async function makeClient() {
  const res = await request(app).post('/clients').send({ name: 'Login Client', email: email(), password: PASSWORD });
  return { ...res.body, cookie: sessionCookie(res) };
}

const login = (address, password = PASSWORD, to = app) => request(to).post('/login').send({ email: address, password });

const storedPassword = async id =>
  (await db.query('SELECT password FROM clients WHERE id = ?', [id]))[0][0].password;

afterAll(async () => {
  await db.query("DELETE FROM clients WHERE email LIKE 'login-test-%'");
  // Without this, Jest hangs: mysql2's pool keeps its connections open.
  await db.end();
});

describe('Session cookie', () => {
  it('is set by /login: httpOnly, SameSite=Lax, a week long', async () => {
    const client = await makeClient();

    const res = await login(client.email);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: client.id, name: 'Login Client', email: client.email, role: 'client' });
    const cookie = res.headers['set-cookie'].find(c => c.startsWith('fma_session='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Max-Age=604800/);
    // The cookie holds the account id and role, never the password or email.
    const token = sessionCookie(res).split('=')[1];
    expect(Buffer.from(token.split('.')[0], 'base64url').toString()).not.toMatch(/secret1|@/);
  });

  it('is also set by sign-up, and GET /login says who is signed in', async () => {
    const client = await makeClient();

    const res = await request(app).get('/login').set('Cookie', client.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: client.id, name: 'Login Client', email: client.email, role: 'client' });
  });

  it('DELETE /login signs out: the cookie is cleared', async () => {
    const res = await request(app).delete('/login');

    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'][0]).toMatch(/^fma_session=;.*Expires=Thu, 01 Jan 1970/);
  });

  it('GET /login is 401 with no cookie, a changed one, or an expired one', async () => {
    const client = await makeClient();
    const [payload, signature] = client.cookie.split('=')[1].split('.');
    // Someone edits the payload to claim another id, keeping the old signature.
    const otherId = Buffer.from(JSON.stringify({ id: client.id + 1, role: 'client', exp: Date.now() + 1e6 })).toString('base64url');
    const expired = makeToken({ id: client.id, role: 'client' }, Date.now() - 8 * 24 * 60 * 60 * 1000);

    for (const cookie of [undefined, `fma_session=${otherId}.${signature}`, `fma_session=${payload}.x${signature.slice(1)}`, `fma_session=${expired}`]) {
      const req = request(app).get('/login');
      const res = await (cookie ? req.set('Cookie', cookie) : req);
      expect(res.status).toBe(401);
    }
  });

  it('only accepts tokens signed with the server secret', () => {
    const token = makeToken({ id: 4, role: 'artisan' });
    expect(readToken(token)).toEqual({ id: 4, role: 'artisan' });
    expect(readToken(`${token}x`)).toBeNull();
    expect(readToken('not.a.token')).toBeNull();
    expect(readToken(undefined)).toBeNull();
  });
});

describe('Passwords (finding 9)', () => {
  it('are saved as bcrypt hashes on sign-up, never as typed', async () => {
    const client = await makeClient();

    const stored = await storedPassword(client.id);

    expect(stored).not.toBe(PASSWORD);
    expect(stored).toMatch(/^\$2[aby]\$10\$.{53}$/);
    expect((await login(client.email)).status).toBe(200);
    expect((await login(client.email, 'Secret1')).status).toBe(401); // still case-sensitive
  });

  it('are saved as hashes when changed', async () => {
    const client = await makeClient();

    await request(app).patch(`/clients/${client.id}/password`).set('Cookie', client.cookie)
      .send({ currentPassword: PASSWORD, newPassword: 'newpass1' });

    expect(await storedPassword(client.id)).toMatch(/^\$2[aby]\$/);
    expect((await login(client.email, 'newpass1')).status).toBe(200);
  });

  it('an account from before hashing still signs in, and its password is hashed then', async () => {
    const address = email();
    // Saved the old way, as typed, straight into the table.
    const [result] = await db.query('INSERT INTO clients (name, email, password) VALUES (?, ?, ?)', ['Old Client', address, 'oldpass1']);

    expect((await login(address, 'wrong12')).status).toBe(401);
    expect(await storedPassword(result.insertId)).toBe('oldpass1'); // a wrong guess changes nothing

    expect((await login(address, 'oldpass1')).status).toBe(200);
    const stored = await storedPassword(result.insertId);
    expect(stored).toMatch(/^\$2[aby]\$/);
    expect((await login(address, 'oldpass1')).status).toBe(200);
  });

  it('refuses one longer than bcrypt can read (72 bytes)', async () => {
    const res = await request(app).post('/clients').send({ name: 'x', email: email(), password: 'x'.repeat(73) });
    expect(res.status).toBe(400);
  });

  it("gives the same answer for an unknown email and a wrong password", async () => {
    const client = await makeClient();
    const unknown = await login(`nobody-${Date.now()}@example.com`);
    const wrong = await login(client.email, 'wrong12');
    expect([unknown.status, wrong.status]).toEqual([401, 401]);
    expect(unknown.body).toEqual(wrong.body);
  });
});

describe('Wrong-password limit (finding 10)', () => {
  // The real /login routes behind a limit of 3 wrong passwords per address.
  // Each request names its address in X-Forwarded-For, which this app trusts.
  function limitedApp() {
    const limited = express();
    limited.set('trust proxy', true);
    limited.use(express.json());
    limited.use('/login', createLoginLimit({ maxFailures: 3, windowMs: 60_000 }), loginRoutes);
    return limited;
  }
  const from = (to, ip, address, password) =>
    request(to).post('/login').set('X-Forwarded-For', ip).send({ email: address, password });

  it('answers 429 after 3 wrong passwords, even to the right one, for that address only', async () => {
    const client = await makeClient();
    const limited = limitedApp();

    // Signing in fine never counts.
    for (let i = 0; i < 4; i++) {
      expect((await from(limited, '203.0.113.1', client.email, PASSWORD)).status).toBe(200);
    }
    for (let i = 0; i < 3; i++) {
      expect((await from(limited, '203.0.113.1', client.email, 'guess' + i)).status).toBe(401);
    }

    const blocked = await from(limited, '203.0.113.1', client.email, 'guess3');
    const rightButBlocked = await from(limited, '203.0.113.1', client.email, PASSWORD);
    const otherAddress = await from(limited, '203.0.113.2', client.email, PASSWORD);

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body.error).toMatch(/Too many wrong sign-in attempts/);
    expect(rightButBlocked.status).toBe(429);
    expect(otherAddress.status).toBe(200);
  });
});
