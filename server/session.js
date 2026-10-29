// Sign-in sessions for the website's routes (not the partner API, which uses
// API keys: see apiKey.js).
//
// After a right password, /login puts a signed token in a cookie:
//
//   fma_session=<payload>.<signature>
//
// payload is { id, role, exp } as base64url JSON. signature is an HMAC-SHA256 of
// the payload with SESSION_SECRET, which only this server knows. Changing the
// id in the payload breaks the signature, so the browser can't claim to be
// someone else. The cookie is httpOnly (page JavaScript can't read it) and
// SameSite=Lax (another site's page can't make the browser send it with a
// POST, PATCH or DELETE).
//
// Every website route that touches one person's data reads the account from
// here (req.account), never from an id in the request body or query.
const crypto = require('crypto');

const COOKIE = 'fma_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // a week, then sign in again

// Without SESSION_SECRET (a teammate's computer, or Render before it is set) a
// random one is made at start-up. Sessions still work, but everyone is signed
// out whenever the server restarts.
let secret = process.env.SESSION_SECRET;
if (!secret) {
  secret = crypto.randomBytes(32).toString('hex');
  if (process.env.NODE_ENV !== 'test') {
    console.log('[auth] SESSION_SECRET is not set: using a random one, so a restart signs everyone out.');
  }
}

const sign = payload => crypto.createHmac('sha256', secret).update(payload).digest('base64url');

/** A signed token for { id, role } that expires in a week. */
function makeToken({ id, role }, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ id, role, exp: now + MAX_AGE_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** { id, role } from a token, or null if it's missing, changed or expired. */
function readToken(token, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;

  // timingSafeEqual: a plain === stops at the first wrong character, so the time
  // it takes would show how much of a forged signature was right.
  const expected = Buffer.from(sign(payload));
  const sent = Buffer.from(signature);
  if (sent.length !== expected.length || !crypto.timingSafeEqual(sent, expected)) return null;

  try {
    const { id, role, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!Number.isInteger(id) || !['client', 'artisan'].includes(role) || !(exp > now)) return null;
    return { id, role };
  } catch {
    return null;
  }
}

// "a=1; fma_session=xyz" → "xyz"
function cookieValue(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/** The signed-in account ({ id, role }) for this request, or null. */
function readSession(req) {
  return readToken(cookieValue(req, COOKIE));
}

function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    // Only over https on Render. On http://localhost a Secure cookie isn't kept
    // by every browser (Safari drops it), so there it's left off.
    secure: req.secure,
    path: '/',
  };
}

/** Signs the browser in as this account. */
function startSession(req, res, account) {
  res.cookie(COOKIE, makeToken(account), { ...cookieOptions(req), maxAge: MAX_AGE_MS });
}

function endSession(req, res) {
  res.clearCookie(COOKIE, cookieOptions(req));
}

/**
 * Middleware: lets the request through only when someone is signed in (as
 * `role`, if given), and puts them in req.account.
 *   401: nobody is signed in.  403: signed in, but as the wrong kind of account.
 */
function requireSignIn(role) {
  return (req, res, next) => {
    const account = readSession(req);
    if (!account) {
      return res.status(401).json({ error: 'Please sign in first' });
    }
    if (role && account.role !== role) {
      return res.status(403).json({ error: `Only a signed-in ${role} can do this` });
    }
    req.account = account;
    next();
  };
}

/**
 * Middleware for routes like /clients/:id and /profiles/:id: the signed-in
 * account must be that `role` with that id. Anyone else gets 403.
 */
function requireOwnAccount(role) {
  const signedIn = requireSignIn(role);
  return (req, res, next) =>
    signedIn(req, res, () => {
      if (String(req.account.id) !== req.params.id) {
        return res.status(403).json({ error: "That isn't your account" });
      }
      next();
    });
}

module.exports = {
  COOKIE, makeToken, readToken, readSession, startSession, endSession, requireSignIn, requireOwnAccount,
};
