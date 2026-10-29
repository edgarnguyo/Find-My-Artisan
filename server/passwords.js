// Password hashing with bcrypt (the bcryptjs package: the same algorithm in
// plain JavaScript, so Render needs nothing compiled to install it).
//
// A bcrypt hash looks like $2b$10$<22 characters of salt><31 of hash>. The salt
// is random per password, so two people with the same password get different
// hashes, and "10" is the cost: each guess takes about 2^10 rounds of work,
// which makes trying millions of guesses against a leaked table slow.
//
// Accounts made before hashing still hold the password as typed. They keep
// working: the first right sign-in (or password check) replaces it with a hash.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const COST = 10;
const MIN_LENGTH = 6;
// bcrypt only reads the first 72 bytes, so anything after them wouldn't count.
const MAX_BYTES = 72;

const isHash = stored => /^\$2[aby]\$\d{2}\$.{53}$/.test(stored);

// Compared when there's no account, so a wrong email takes as long as a wrong
// password and the timing doesn't reveal which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST);

/** The problem with a new password, or null when it's fine. */
function newPasswordProblem(password) {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters`;
  }
  if (Buffer.byteLength(password) > MAX_BYTES) {
    return `Password must be at most ${MAX_BYTES} characters`;
  }
  return null;
}

function hashPassword(password) {
  return bcrypt.hash(password, COST);
}

/**
 * Checks a typed password against what's stored (a hash, plain text from before
 * hashing, or null for the sample artisans, which have no login).
 * Returns { ok, needsHash }: needsHash is true when it was right but stored as
 * plain text, so the caller should save hashPassword(typed) in its place.
 */
async function verifyPassword(typed, stored) {
  if (typeof typed !== 'string' || typeof stored !== 'string' || stored === '') {
    await bcrypt.compare('x', DUMMY_HASH);
    return { ok: false, needsHash: false };
  }
  if (isHash(stored)) {
    return { ok: await bcrypt.compare(typed, stored), needsHash: false };
  }
  // Plain text: compare SHA-256 digests with timingSafeEqual, which needs two
  // buffers of the same length. Case-sensitive, like the old === check.
  const digest = text => crypto.createHash('sha256').update(text).digest();
  const ok = crypto.timingSafeEqual(digest(typed), digest(stored));
  return { ok, needsHash: ok };
}

module.exports = { MIN_LENGTH, isHash, newPasswordProblem, hashPassword, verifyPassword };
