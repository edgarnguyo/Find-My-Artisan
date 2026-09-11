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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
