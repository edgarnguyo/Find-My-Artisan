const app = require('./app');

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Website:       http://localhost:${PORT}`);
  console.log(`Artisans JSON: http://localhost:${PORT}/artisans`);
  console.log(`Swagger UI:    http://localhost:${PORT}/docs`);
});
