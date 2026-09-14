const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');

// POST /api/login  with  { email, password }
router.post('/', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // The account could be in either table, so look in both.
    const [clients] = await db.query(
      'SELECT id, name, email, password_hash FROM clients WHERE email = ?',
      [email]
    );
    const [artisans] = await db.query(
      'SELECT id, name, email, password_hash FROM artisans WHERE email = ?',
      [email]
    );

    let account = null;
    if (clients.length > 0) {
      account = { ...clients[0], role: 'client' };
    } else if (artisans.length > 0) {
      account = { ...artisans[0], role: 'artisan' };
    }

    // bcrypt.compare hashes the typed password the same way and checks it
    // matches the stored hash. The same message is used for a wrong email and a
    // wrong password, so the form doesn't reveal which emails have accounts.
    if (!account || !(await bcrypt.compare(password, account.password_hash))) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }

    res.json({ id: account.id, name: account.name, email: account.email, role: account.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

module.exports = router;
