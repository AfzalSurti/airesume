require('dotenv').config();

const app = require('./app');
const { pool } = require('./config/db');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

// Neon (and most serverless Postgres) suspends its compute after a few minutes idle;
// the first query after that incurs a multi-second cold-start. Pinging on an interval
// shorter than the suspend window keeps the connection warm so real requests stay fast.
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;
setInterval(() => {
  pool.query('SELECT 1').catch((err) => {
    console.error('Keep-alive ping failed:', err.message);
  });
}, KEEP_ALIVE_INTERVAL_MS).unref();
