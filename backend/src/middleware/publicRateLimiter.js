const rateLimit = require('express-rate-limit');

const applyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many applications submitted from this address, please try again later.' },
});

module.exports = { applyRateLimiter };
