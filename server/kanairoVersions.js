// Week 13: the ONE place that knows the shape of Kanairo-Klean's list endpoints
// (GET /materials and GET /collection-locations) in each version.
//   v1: GET /materials           -> [ ... ]                     (a bare list)
//   v2: GET /v2/materials        -> { "data": [ ... ], "count": N }
// Nothing else changed in their v2: same fields, filters, errors and key.
// Each version's list() hands the rest of our code the same plain array, so
// kanairo.js and routes/partner.js never need to know which version answered.
// PARTNER_VERSION in .env picks one; switching back is a one-word change.

const versions = {
  v1: {
    prefix: '',
    list: body => {
      if (!Array.isArray(body)) throw new Error('unexpected v1 shape: expected a list');
      return body;
    },
  },
  v2: {
    prefix: '/v2',
    list: body => {
      if (!body || !Array.isArray(body.data)) throw new Error('unexpected v2 shape: expected { data: [...] }');
      return body.data;
    },
  },
};

// Read on every call, not at startup, so the tests can switch versions.
function partnerVersion() {
  const name = process.env.PARTNER_VERSION || 'v1';
  if (!versions[name]) {
    console.error(`Kanairo-Klean: PARTNER_VERSION=${name} is not v1 or v2; using v1`);
    return versions.v1;
  }
  return versions[name];
}

module.exports = { versions, partnerVersion };
