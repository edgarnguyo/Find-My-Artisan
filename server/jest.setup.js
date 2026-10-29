// Runs before every test file (see "jest" in package.json), before app.js loads.
// (package.json also gives each test 30 s, not 5: the tests talk to a database
// that may be in another country, and a slow round trip is not a failure.)
// The tests get their own API key, so they never need a real partner's key,
// and a limit high enough that a full test run never hits 429.
// dotenv doesn't overwrite variables that are already set, so these win over .env.
const TEST_API_KEY = 'jest-test-key';
process.env.API_KEYS = `jest:${TEST_API_KEY}`;
process.env.RATE_LIMIT_PER_MINUTE = '100000';
// The /login limit has its own test with a low limit (login.test.js); the rest
// of the suite signs in many times and must never hit it.
process.env.LOGIN_FAILURES_PER_15_MIN = '100000';
// A fixed secret, so every sign-in cookie made in a test run is valid in it.
process.env.SESSION_SECRET = 'jest-session-secret';

// A sign-in cookie for this account, made the way /login makes one. For the
// sample artisans, which have no password and so can't sign in.
function signedInAs(role, id) {
  const { COOKIE, makeToken } = require('./session');
  return `${COOKIE}=${makeToken({ id, role })}`;
}

// The sign-in cookie a response set (sign-up or /login), ready for .set('Cookie', ...).
function sessionCookie(res) {
  const { COOKIE } = require('./session');
  const set = (res.headers['set-cookie'] ?? []).find(c => c.startsWith(`${COOKIE}=`));
  return set?.split(';')[0];
}

module.exports = { TEST_API_KEY, signedInAs, sessionCookie };
