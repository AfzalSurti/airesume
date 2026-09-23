const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();/*  */

router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'backend', database: 'connected' });
  } catch (err) {
    console.error('Health check DB error:', err.message);
    res.status(503).json({ status: 'error', service: 'backend', database: 'unreachable' });
  }
});

module.exports = router;
