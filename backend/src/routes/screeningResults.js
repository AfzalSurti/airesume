const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { getScreeningResult } = require('../controllers/screeningController');

const router = express.Router();

router.use(authenticate);

router.get('/:id', getScreeningResult);

module.exports = router;
