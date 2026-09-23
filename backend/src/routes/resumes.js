const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../constants/roles');
const { upload } = require('../middleware/upload');
const { uploadResume, processResumeRoute, downloadResume, deleteResume } = require('../controllers/resumeController');

const router = express.Router();

router.use(authenticate);

router.post('/upload', authorize(ROLES.ADMIN, ROLES.HR, ROLES.RECRUITER), upload.single('resume'), uploadResume);
router.post('/:id/process', authorize(ROLES.ADMIN, ROLES.HR, ROLES.RECRUITER), processResumeRoute);
router.get('/:id/file', downloadResume);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.HR), deleteResume);

module.exports = router;
