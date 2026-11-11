// Week 13: v2 of the partner API, mounted at /v2/artisans.
//
// The only difference from v1: POST /artisans/{id}/reviews needs one more
// field, blockId. It is the id of the availability block (the booked job)
// the review is about, and the block must belong to that artisan. So a review
// can only be left for a job that was actually booked, not for any artisan at
// any time. Everything else falls through to the v1 router unchanged, so both
// versions read and write the same data.
const express = require('express');
const db = require('../db');
const { toDbTime } = require('../availability');
const { logError } = require('../monitoring');
const v1 = require('./artisans');

const { isId, artisanExists, findBlock, reviewProblem, toReview, sendError } = v1.v1Helpers;

const router = express.Router();

// POST /v2/artisans/1/reviews
// body: { "blockId": 7, "author": "...", "rating": 5, "comment": "..." }
router.post('/:id/reviews', async (req, res) => {
  const artisanId = req.params.id;
  const { blockId, author, rating, comment } = req.body ?? {};

  // The new field. Checked first, so a v1-shaped body gets a clear message.
  if (blockId === undefined) {
    return sendError(res, 400, 'invalid_body',
      'blockId is required in v2: the id of the booked availability block this review is about.');
  }
  if (!Number.isInteger(blockId) || blockId < 1) {
    return sendError(res, 400, 'invalid_body', 'blockId must be a positive whole number.');
  }

  // The same checks as v1 for the other fields.
  const problem = reviewProblem({ author, rating, comment });
  if (problem) return sendError(res, 400, 'invalid_body', problem);

  try {
    if (!isId(artisanId) || !(await artisanExists(artisanId))) {
      return sendError(res, 404, 'not_found', `No artisan with id ${artisanId}.`);
    }
    // findBlock only finds blocks of this artisan that were added through the
    // API, never one made from a website booking.
    if (!(await findBlock(artisanId, String(blockId)))) {
      return sendError(res, 400, 'invalid_body',
        `blockId ${blockId} is not an availability block of artisan ${artisanId}.`);
    }

    const [result] = await db.query(
      `INSERT INTO reviews (artisan_id, author, rating, comment, created_at, from_api)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [artisanId, author.trim(), rating, comment?.trim() || null, toDbTime(new Date())]
    );
    const [rows] = await db.query('SELECT * FROM reviews WHERE id = ?', [result.insertId]);
    // The Review shape, plus the block it was left for (a new field, which is not breaking).
    res.status(201).json({ ...toReview(rows[0]), blockId });
  } catch (err) {
    logError(err);
    sendError(res, 500, 'server_error', 'Failed to create review.');
  }
});

// Every other route is the same in v2 as in v1.
router.use(v1);

module.exports = router;
