const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { upload } = require('../middleware/upload');
const { ROLES } = require('../constants/roles');
const {
  listPipelines,
  getPipeline,
  forwardToHod,
  scheduleInterview,
  recordDecision,
  sendOffer,
  verifyDocument,
  completePipeline,
  downloadPipelineDocument,
  downloadOfferLetter,
} = require('../controllers/pipelineController');

const router = express.Router();

router.use(authenticate);

router.get('/', listPipelines);
router.get('/:id', getPipeline);
router.post('/:id/forward-to-hod', authorize(ROLES.ADMIN, ROLES.HR), forwardToHod);
router.post('/:id/schedule-interview', authorize(ROLES.ADMIN, ROLES.HOD), scheduleInterview);
router.post('/:id/decision', authorize(ROLES.ADMIN, ROLES.HOD), recordDecision);
router.post('/:id/offer', authorize(ROLES.ADMIN, ROLES.HR), upload.single('offerLetter'), sendOffer);
router.get('/:id/offer-letter', downloadOfferLetter);
router.post('/:id/documents/:documentId/verify', authorize(ROLES.ADMIN, ROLES.HR), verifyDocument);
router.post('/:id/complete', authorize(ROLES.ADMIN, ROLES.HR), completePipeline);

router.get('/documents/:documentId/file', downloadPipelineDocument);

module.exports = router;
