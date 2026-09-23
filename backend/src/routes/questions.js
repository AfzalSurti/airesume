const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../constants/roles');
const { updateJobQuestion, deleteJobQuestion } = require('../controllers/jobController');

const router = express.Router();

router.use(authenticate);

router.patch('/:id', authorize(ROLES.ADMIN, ROLES.HR), updateJobQuestion);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.HR), deleteJobQuestion);

module.exports = router;
