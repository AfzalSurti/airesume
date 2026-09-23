const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../constants/roles');
const { listCandidates, getCandidate, updateCandidate, deleteCandidate } = require('../controllers/candidateController');
const { listCandidateResumes } = require('../controllers/resumeController');

const router = express.Router();

router.use(authenticate);

router.get('/', listCandidates);
router.get('/:id', getCandidate);
router.get('/:id/resumes', listCandidateResumes);
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.HR, ROLES.RECRUITER), updateCandidate);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.HR), deleteCandidate);

module.exports = router;
