const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Must come before the routes: React runs on a different port (5173),
// so without this header the browser blocks the response.
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running');
});

const artisanRoutes = require('./routes/artisans');
app.use('/api/artisans', artisanRoutes);

const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

app.listen(PORT, () => {
  // Print only the JSON route as a link: VS Code opens whichever localhost link
  // you click in the terminal, and "/" only says "API is running".
  console.log(`Server running on port ${PORT}`);
  console.log(`Artisans JSON: http://localhost:${PORT}/api/artisans`);
});
