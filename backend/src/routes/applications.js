const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../constants/roles');
const { getApplication, updateApplication } = require('../controllers/applicationController');

const router = express.Router();

router.use(authenticate);

router.get('/:id', getApplication);
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.HR, ROLES.RECRUITER), updateApplication);

module.exports = router;
