const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../constants/roles');
const { listUsers, createUser } = require('../controllers/userController');

const router = express.Router();

router.use(authenticate);

router.get('/', listUsers);
router.post('/', authorize(ROLES.ADMIN, ROLES.HR), createUser);

module.exports = router;
