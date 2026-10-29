const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyPassword } = require('../passwords');
const { TABLES, hashIfPlain } = require('../accounts');
const { readSession, startSession, endSession } = require('../session');
const { loginLimit } = require('../loginLimit');

// POST /login  with  { email, password }
// A right password signs the browser in (the fma_session cookie, see
// session.js) and returns { id, name, email, role } for the page to show.
// Wrong passwords are limited per address (loginLimit.js).
router.post('/', loginLimit, async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // The account could be in either table, so look in both.
    const [clients] = await db.query(
      'SELECT id, name, email, password FROM clients WHERE email = ?',
      [email]
    );
    const [artisans] = await db.query(
      'SELECT id, name, email, password FROM artisans WHERE email = ?',
      [email]
    );

    let account = null;
    if (clients.length > 0) {
      account = { ...clients[0], role: 'client' };
    } else if (artisans.length > 0) {
      account = { ...artisans[0], role: 'artisan' };
    }

    // verifyPassword takes the same time with no account as with a wrong
    // password, and one message covers both, so the form doesn't reveal which
    // emails have accounts.
    const result = await verifyPassword(password, account?.password ?? null);
    if (!result.ok) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }
    // An account from before hashing: save the password as a hash from now on.
    await hashIfPlain(account.role, account.id, password, result);

    startSession(req, res, { id: account.id, role: account.role });
    res.json({ id: account.id, name: account.name, email: account.email, role: account.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

// GET /login: who is signed in, { id, name, email, role }, or 401. The site
// asks on load, so a reload keeps you signed in without storing anything the
// page's JavaScript could read.
router.get('/', async (req, res) => {
  const account = readSession(req);
  if (!account) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  try {
    const [rows] = await db.query(`SELECT id, name, email FROM ${TABLES[account.role]} WHERE id = ?`, [account.id]);
    if (rows.length === 0) {
      // The account was deleted since: drop the cookie too.
      endSession(req, res);
      return res.status(401).json({ error: 'Not signed in' });
    }
    res.json({ ...rows[0], role: account.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check sign-in' });
  }
});

// DELETE /login: sign out.
router.delete('/', (req, res) => {
  endSession(req, res);
  res.status(204).send();
});

module.exports = router;
