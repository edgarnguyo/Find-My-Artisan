// Week 13: v1 of the partner API, at /v1/artisans and the old /artisans.
// FROZEN: it answers the way the API did before reviews needed a job.
//
// The breaking change (now v2, routes/artisans.js): POST .../reviews answers
// 403 no_job unless the artisan has logged a finished job for this partner.
// Before that rule, a partner could review any artisan, and Meditrac's code was
// written against that. So v1 keeps the old review rule, and every other route
// falls through to the current router: both versions use the same data.
const express = require('express');
const db = require('../db');
const { toDbTime } = require('../availability');
const { logError } = require('../monitoring');
const current = require('./artisans');

const { isId, artisanExists, reviewProblem, toReview, sendError } = current.helpers;

const router = express.Router();

// POST /v1/artisans/1/reviews   body: { "author": "...", "rating": 5, "comment": "..." }
// The v1 rule: valid fields and an artisan that exists. No job needed.
router.post('/:id/reviews', async (req, res) => {
  const artisanId = req.params.id;
  const { author, rating, comment } = req.body ?? {};

  const problem = reviewProblem({ author, rating, comment });
  if (problem) return sendError(res, 400, 'invalid_body', problem);

  try {
    if (!isId(artisanId) || !(await artisanExists(artisanId))) {
      return sendError(res, 404, 'not_found', `No artisan with id ${artisanId}.`);
    }
    // api_consumer is still recorded, so only this key can edit or delete it.
    const [result] = await db.query(
      `INSERT INTO reviews (artisan_id, author, rating, comment, created_at, from_api, api_consumer)
       VALUES (?, ?, ?, ?, ?, TRUE, ?)`,
      [artisanId, author.trim(), rating, comment?.trim() || null, toDbTime(new Date()), req.consumer]
    );
    const [rows] = await db.query('SELECT * FROM reviews WHERE id = ?', [result.insertId]);
    res.status(201).json(toReview(rows[0]));
  } catch (err) {
    logError(err);
    sendError(res, 500, 'server_error', 'Failed to create review.');
  }
});

// Every other route is the same in v1 as in v2.
router.use(current);

module.exports = router;
