// Runs before every test file (see "jest" in package.json), before app.js loads.
// (package.json also gives each test 30 s, not 5: the tests talk to a database
// that may be in another country, and a slow round trip is not a failure.)
// The tests get their own API key, so they never need a real partner's key,
// and a limit high enough that a full test run never hits 429.
// dotenv doesn't overwrite variables that are already set, so these win over .env.
const TEST_API_KEY = 'jest-test-key';
process.env.API_KEYS = `jest:${TEST_API_KEY}`;
process.env.RATE_LIMIT_PER_MINUTE = '100000';

module.exports = { TEST_API_KEY };
