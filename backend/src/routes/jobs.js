const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../constants/roles');
const {
  createJob,
  listJobs,
  getJob,
  updateJob,
  deleteJob,
  createJobQuestion,
  listJobQuestions,
} = require('../controllers/jobController');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize(ROLES.ADMIN, ROLES.HR), createJob);
router.get('/', listJobs);
router.get('/:id', getJob);
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.HR), updateJob);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.HR), deleteJob);

router.post('/:id/questions', authorize(ROLES.ADMIN, ROLES.HR), createJobQuestion);
router.get('/:id/questions', listJobQuestions);

module.exports = router;
