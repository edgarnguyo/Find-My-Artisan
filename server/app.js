const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// The React site after `vite build` has turned it into plain HTML, JS and CSS files.
const reactBuild = path.join(__dirname, '..', 'react-app', 'dist');

// Lets a page from another port call this API (for example the lab's separate
// React dev server). Pages served by this server don't need it, but it's harmless.
// It must stay above the API key check: a browser's preflight (OPTIONS) request
// carries no key, so cors() has to answer it before the check sends a 401.
//
// Vite's dev server (http://localhost:5173) is a different origin from this one,
// so its requests only carry the sign-in cookie if CORS allows credentials.
// That is allowed for localhost pages only; every other origin gets the plain
// "*" answer, which never lets a browser send or read the cookie.
const LOCAL_PAGE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(cors((req, callback) => {
  const origin = req.get('Origin');
  callback(null, origin && LOCAL_PAGE.test(origin) ? { origin, credentials: true } : {});
}));

// On Render, requests reach us through Render's proxy. Trusting one proxy hop
// makes req.ip the visitor's address (for the /login limit) and req.secure
// true for https (for the cookie's Secure flag). Render sets RENDER=true.
if (process.env.RENDER) app.set('trust proxy', 1);
app.use(express.json());

// Swagger UI at /docs, built from openapi.yaml, for "Try it out" testing.
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const contract = YAML.parse(fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(contract));


// The API promised to Meditrac in openapi.yaml, at the paths the contract gives.
// No route has an /api prefix, so page addresses must not reuse these names:
// the React pages that were at /artisans and /bookings moved to /artisans-table
// and /my-bookings.
// These are the routes partners call, so each request needs a partner's API key
// (see apiKey.js). The website never uses them: it has its own /profiles routes.
const { requireApiKey } = require('./apiKey');
const artisanRoutes = require('./routes/artisans');
app.use('/artisans', requireApiKey, artisanRoutes);

// Website-only: the extra profile data (photos, reviews...) and artisan sign-up.
const profileRoutes = require('./routes/profiles');
app.use('/profiles', profileRoutes);

const clientRoutes = require('./routes/clients');
app.use('/clients', clientRoutes);

const loginRoutes = require('./routes/login');
app.use('/login', loginRoutes);

const bookingRoutes = require('./routes/bookings');
app.use('/bookings', bookingRoutes);

const statsRoutes = require('./routes/stats');
app.use('/stats', statsRoutes);

// Website-only: material prices from our upstream partner, Kanairo-Klean.
const partnerRoutes = require('./routes/partner');
app.use('/partner', partnerRoutes);

// Everything that isn't an API address is the React site. express.static sends back the
// file that was asked for (JavaScript, CSS, images) from the build folder.
app.use(express.static(reactBuild));

// Page addresses like /listings or /profile/3 aren't real files: React Router
// reads the address and picks the page. So for any other GET, send index.html.
// API addresses are skipped, so a mistyped API URL still gets "Cannot GET".
// Old /api/... URLs are included, so anything still calling them gets a 404.
const API_PATHS = /^\/(artisans|profiles|clients|login|bookings|stats|partner|docs|api)(\/|$)/;

app.use((req, res, next) => {
  if (req.method !== 'GET' || API_PATHS.test(req.path)) return next();

  if (!fs.existsSync(path.join(reactBuild, 'index.html'))) {
    return res
      .status(503)
      .send('The React site is not built yet. Run "npm run dev" in server/, wait for "built in", then refresh.');
  }
  // { root } makes sendFile check only "index.html" itself. Given a full path, it
  // refuses any folder starting with a dot (like .claude) anywhere in that path.
  res.sendFile('index.html', { root: reactBuild });
});

// express.json() throws when the body isn't valid JSON. Send the contract's
// Error shape instead of Express's default HTML error page.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 'invalid_body', message: 'Request body must be valid JSON.' });
  }
  next(err);
});

// Any other error. Without this, Express answers with an HTML page, and outside
// production that page holds the stack trace and this server's file paths. The
// message is fixed text, never err.message, which can name tables or columns.
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ code: 'body_too_large', message: 'Request body must be under 100 kB.' });
  }
  console.error(err);
  // Body-parsing errors carry a 4xx status (e.g. 415 for an unknown charset).
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  const code = status === 500 ? 'server_error' : 'bad_request';
  const message = status === 500 ? 'Something went wrong on our side.' : 'The request could not be read.';
  res.status(status).json({ code, message });
});

module.exports = app;
