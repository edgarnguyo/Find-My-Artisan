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

app.get('/api', (req, res) => {
  res.send('API is running');
});

const artisanRoutes = require('./routes/artisans');
app.use('/api/artisans', artisanRoutes);

const clientRoutes = require('./routes/clients');
app.use('/api/clients', clientRoutes);

const loginRoutes = require('./routes/login');
app.use('/api/login', loginRoutes);

const bookingRoutes = require('./routes/bookings');
app.use('/api/bookings', bookingRoutes);

// Everything that isn't /api is the React site. express.static sends back the
// file that was asked for (JavaScript, CSS, images) from the build folder.
app.use(express.static(reactBuild));

// Page addresses like /listings or /profile/3 aren't real files: React Router
// reads the address and picks the page. So for any other GET, send index.html.
// /api addresses are skipped, so a mistyped API URL still gets "Cannot GET".
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();

  if (!fs.existsSync(path.join(reactBuild, 'index.html'))) {
    return res
      .status(503)
      .send('The React site is not built yet. Run "npm run dev" in server/, wait for "built in", then refresh.');
  }
  // { root } makes sendFile check only "index.html" itself. Given a full path, it
  // refuses any folder starting with a dot (like .claude) anywhere in that path.
  res.sendFile('index.html', { root: reactBuild });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Website:       http://localhost:${PORT}`);
  console.log(`Artisans JSON: http://localhost:${PORT}/api/artisans`);
});
