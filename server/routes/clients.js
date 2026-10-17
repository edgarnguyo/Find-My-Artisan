const express = require('express');
const router = express.Router();
const db = require('../db');
const { inTransaction } = require('../transaction');
const { checkPassword, sentPasswordProblem, changePasswordRoute } = require('../accounts');

// There is no "GET all clients": it would show everyone's email and phone to
// anyone who asked. The account page only needs the signed-in client's own.

// GET one client's details for their account page (never the password)
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, phone, location FROM clients WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// POST a new client (the sign-up form, "A client")
router.post('/', async (req, res) => {
  const { name, email, password, phone, location } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // One email can't be both a client and an artisan, so check both tables.
    const [taken] = await db.query(
      'SELECT id FROM clients WHERE email = ? UNION SELECT id FROM artisans WHERE email = ?',
      [email, email]
    );
    if (taken.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    // The ? placeholders keep the typed values separate from the SQL,
    // so nothing typed into the form can run as SQL.
    const [result] = await db.query(
      'INSERT INTO clients (name, email, password, phone, location) VALUES (?, ?, ?, ?, ?)',
      [name, email, password, phone || null, location || null]
    );

    res.status(201).json({ id: result.insertId, name, email, role: 'client' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// PATCH /clients/5  with any of { name, phone, location }
// Only the fields sent change. Reviews already posted keep the name they had.
router.patch('/:id', async (req, res) => {
  const { name, phone, location } = req.body ?? {};
  const changes = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.length > 100) {
      return res.status(400).json({ error: 'name must be text of at most 100 characters' });
    }
    changes.name = name.trim();
  }
  // phone and location are optional: an empty value clears them.
  for (const [field, max] of [['phone', 30], ['location', 100]]) {
    const value = req.body?.[field];
    if (value === undefined) continue;
    if (value !== null && (typeof value !== 'string' || value.length > max)) {
      return res.status(400).json({ error: `${field} must be text of at most ${max} characters` });
    }
    changes[field] = value?.trim() || null;
  }
  if (Object.keys(changes).length === 0) {
    return res.status(400).json({ error: 'Send at least one of: name, phone, location' });
  }

  try {
    // Column names are the fixed keys above; the values go in as ? placeholders.
    const sets = Object.keys(changes).map(column => `${column} = ?`).join(', ');
    const [result] = await db.query(
      `UPDATE clients SET ${sets} WHERE id = ?`,
      [...Object.values(changes), req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const [rows] = await db.query(
      'SELECT id, name, email, phone, location FROM clients WHERE id = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// PATCH /clients/5/password  with { currentPassword, newPassword }
router.patch('/:id/password', changePasswordRoute('client'));

// DELETE /clients/5  with { password }
// Open bookings are cancelled, so the artisan's time is free again. Past
// bookings and reviews stay for the artisans, no longer linked to the account.
router.delete('/:id', async (req, res) => {
  try {
    const result = await checkPassword('client', req.params.id, req.body?.password);
    if (sentPasswordProblem(res, result)) return;

    await inTransaction(async conn => {
      const id = req.params.id;
      await conn.query(
        `DELETE availability_blocks FROM availability_blocks
         JOIN bookings ON bookings.id = availability_blocks.booking_id
         WHERE bookings.client_id = ? AND bookings.status IN ('pending', 'confirmed')`,
        [id]
      );
      await conn.query(
        "UPDATE bookings SET status = 'cancelled' WHERE client_id = ? AND status IN ('pending', 'confirmed')",
        [id]
      );
      await conn.query('UPDATE bookings SET client_id = NULL WHERE client_id = ?', [id]);
      await conn.query('DELETE FROM clients WHERE id = ?', [id]);
    });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
