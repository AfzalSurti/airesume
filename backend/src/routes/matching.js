const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../constants/roles');
const { searchCandidatePool } = require('../controllers/matchingController');

const router = express.Router();

router.use(authenticate);

router.post('/search', authorize(ROLES.ADMIN, ROLES.HR, ROLES.RECRUITER), searchCandidatePool);

module.exports = router;
