// "Verified" is earned on the site, not checked against a certificate: an
// artisan is verified once they have been signed up for MIN_DAYS days and
// have at least MIN_REVIEWS reviews averaging MIN_RATING or more. The average
// is rounded to one decimal first, like the rating shown on the profile, so a
// profile showing 4.3 is never left out.
//
// The website's wording of this rule is in react-app/src/data/verified.js.
const MIN_DAYS = 30;
const MIN_REVIEWS = 3;
const MIN_RATING = 4.3;

// SQL that is 1 when the artisan in table (or alias) `a` is verified, else 0.
function verifiedSql(a) {
  return `(${a}.created_at <= NOW() - INTERVAL ${MIN_DAYS} DAY
    AND (SELECT COUNT(*) FROM reviews vr WHERE vr.artisan_id = ${a}.id) >= ${MIN_REVIEWS}
    AND (SELECT ROUND(AVG(vr.rating), 1) FROM reviews vr WHERE vr.artisan_id = ${a}.id) >= ${MIN_RATING})`;
}

module.exports = { verifiedSql, MIN_DAYS, MIN_REVIEWS, MIN_RATING };
