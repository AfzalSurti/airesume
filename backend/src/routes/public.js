const express = require('express');
const { upload } = require('../middleware/upload');
const { applyRateLimiter } = require('../middleware/publicRateLimiter');
const { getPublicJob, applyToJob } = require('../controllers/publicController');

const router = express.Router();

router.get('/jobs/:slug', getPublicJob);
router.post('/jobs/:slug/apply', applyRateLimiter, upload.single('resume'), applyToJob);

module.exports = router;
