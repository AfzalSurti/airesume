const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../constants/roles');
const {
  listDocumentRequirements,
  createDocumentRequirement,
  updateDocumentRequirement,
  deleteDocumentRequirement,
} = require('../controllers/documentRequirementController');

const router = express.Router();

router.use(authenticate);

router.get('/', listDocumentRequirements);
router.post('/', authorize(ROLES.ADMIN, ROLES.HR), createDocumentRequirement);
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.HR), updateDocumentRequirement);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.HR), deleteDocumentRequirement);

module.exports = router;
