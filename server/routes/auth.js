const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { signToken, requireAuth } = require('../auth');

// The account plus the name from whichever profile table it has.
const SELECT_USER = `
  SELECT u.id, u.email, u.role, u.password_hash,
         COALESCE(c.name, a.name) AS name, a.id AS artisan_id
  FROM users u
  LEFT JOIN clients c ON c.user_id = u.id
  LEFT JOIN artisans a ON a.user_id = u.id
`;

// What the browser gets: never the password hash.
function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    artisanId: row.artisan_id ?? null,
  };
}

// Trimmed text, or null when empty, so blank optional fields are stored as NULL.
function clean(value) {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
}

// POST /api/auth/signup
// Body: { email, password, role: 'client' | 'artisan', name,
//         phone, location              (client, optional)
//         skill, location, price, bio  (artisan: skill and location required) }
router.post('/signup', async (req, res) => {
  const body = req.body ?? {};
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const name = clean(body.name);
  const { role } = body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password and name are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (role !== 'client' && role !== 'artisan') {
    return res.status(400).json({ error: "role must be 'client' or 'artisan'" });
  }
  if (role === 'artisan' && (!clean(body.skill) || !clean(body.location))) {
    return res.status(400).json({ error: 'Artisans need a skill and location' });
  }

  try {
    // bcrypt turns the password into a salted, deliberately slow hash. Only the
    // hash is stored, so a leaked database doesn't reveal anyone's password.
    const passwordHash = await bcrypt.hash(password, 10);

    // The INSERTs live in stored procedures in schema.sql. Each adds the users
    // row and the profile row in one transaction and returns the new user id.
    // The ? placeholders send values separately from the SQL text, so nothing
    // typed into the form can run as SQL.
    const [results] = role === 'client'
      ? await db.query('CALL register_client(?, ?, ?, ?, ?)', [
          email, passwordHash, name, clean(body.phone), clean(body.location),
        ])
      : await db.query('CALL register_artisan(?, ?, ?, ?, ?, ?, ?)', [
          email, passwordHash, name, clean(body.skill), clean(body.location),
          clean(body.price), clean(body.bio),
        ]);
    // A CALL returns [rows of its SELECT, status]; the SELECT has one row.
    const newUserId = results[0][0].user_id;

    const [[row]] = await db.query(`${SELECT_USER} WHERE u.id = ?`, [newUserId]);
    const user = publicUser(row);
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    if (err.code === 'ER_DATA_TOO_LONG') {
      return res.status(400).json({ error: 'One of the fields is too long' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /api/auth/signin
// Body: { email, password }
router.post('/signin', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [[row]] = await db.query(`${SELECT_USER} WHERE u.email = ?`, [email]);
    // bcrypt.compare hashes the attempt the same way and compares the results.
    const matches = row ? await bcrypt.compare(password, row.password_hash) : false;
    // One message for both a wrong email and a wrong password, so the form
    // can't be used to find out which emails have accounts.
    if (!matches) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }

    const user = publicUser(row);
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

// GET /api/auth/me: who does this token belong to? Used when the page reloads.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [[row]] = await db.query(`${SELECT_USER} WHERE u.id = ?`, [req.user.id]);
    if (!row) {
      return res.status(401).json({ error: 'This account no longer exists' });
    }
    res.json({ user: publicUser(row) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load account' });
  }
});

module.exports = router;
