const mysql = require('mysql2');
require('dotenv').config();

// A pool keeps up to 10 open connections and hands one to each query,
// instead of opening and closing a new connection per request.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  // Return dates as text like '2026-10-01'. Otherwise they become JavaScript
  // Date objects, which can shift to the day before when turned into JSON.
  dateStrings: true,
});

module.exports = pool.promise();
