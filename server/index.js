const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// The React site after `vite build` has turned it into plain HTML, JS and CSS files.
const reactBuild = path.join(__dirname, '..', 'react-app', 'dist');

// Lets a page from another port call this API (for example the lab's separate
// React dev server). Pages served by this server don't need it, but it's harmless.
app.use(cors());
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
const artisanRoutes = require('./routes/artisans');
app.use('/artisans', artisanRoutes);

// Website-only: the extra profile data (photos, reviews...) and artisan sign-up.
const profileRoutes = require('./routes/profiles');
app.use('/profiles', profileRoutes);

const clientRoutes = require('./routes/clients');
app.use('/clients', clientRoutes);

const loginRoutes = require('./routes/login');
app.use('/login', loginRoutes);

const bookingRoutes = require('./routes/bookings');
app.use('/bookings', bookingRoutes);

// Everything that isn't an API address is the React site. express.static sends back the
// file that was asked for (JavaScript, CSS, images) from the build folder.
app.use(express.static(reactBuild));

// Page addresses like /listings or /profile/3 aren't real files: React Router
// reads the address and picks the page. So for any other GET, send index.html.
// API addresses are skipped, so a mistyped API URL still gets "Cannot GET".
// Old /api/... URLs are included, so anything still calling them gets a 404.
const API_PATHS = /^\/(artisans|profiles|clients|login|bookings|docs|api)(\/|$)/;

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Website:       http://localhost:${PORT}`);
  console.log(`Artisans JSON: http://localhost:${PORT}/artisans`);
  console.log(`Swagger UI:    http://localhost:${PORT}/docs`);
});
