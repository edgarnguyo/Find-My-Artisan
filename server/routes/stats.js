const express = require('express');
const router = express.Router();
const db = require('../db');

// Website-only: the real numbers and recent work shown on the landing page, in
// place of the made-up "200+ artisans" and stock photos it used to have.

// GET /stats
router.get('/', async (req, res) => {
  try {
    // jobs_completed counts the same way as on each profile: the number each
    // artisan started with, plus the jobs finished through the site.
    const [[totals]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM artisans WHERE verified = TRUE) AS verified_artisans,
         (SELECT ROUND(AVG(rating), 1) FROM reviews) AS average_rating,
         (SELECT COUNT(*) FROM reviews) AS review_count,
         (SELECT COALESCE(SUM(jobs_completed), 0) FROM artisans)
           + (SELECT COUNT(*) FROM bookings WHERE status = 'completed') AS jobs_completed`
    );

    // The newest portfolio photos from any artisan.
    const [recentWork] = await db.query(
      `SELECT portfolio_items.id, portfolio_items.title, portfolio_items.image_url,
              artisans.id AS artisan_id, artisans.name AS artisan_name, artisans.skill
       FROM portfolio_items
       JOIN artisans ON artisans.id = portfolio_items.artisan_id
       ORDER BY portfolio_items.id DESC
       LIMIT 6`
    );

    res.json({
      verifiedArtisans: totals.verified_artisans,
      // AVG and SUM arrive from MySQL as text ("4.6"), so make them numbers.
      // averageRating is null while there are no reviews at all.
      averageRating: totals.average_rating === null ? null : Number(totals.average_rating),
      reviewCount: totals.review_count,
      jobsCompleted: Number(totals.jobs_completed),
      recentWork: recentWork.map(row => ({
        id: row.id,
        title: row.title,
        imageUrl: row.image_url,
        artisanId: row.artisan_id,
        artisanName: row.artisan_name,
        skill: row.skill,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
