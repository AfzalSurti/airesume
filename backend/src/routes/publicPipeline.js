const express = require('express');
const { upload } = require('../middleware/upload');
const { applyRateLimiter } = require('../middleware/publicRateLimiter');
const {
  getPublicPipeline,
  uploadDocument,
  deleteDocument,
  addExperience,
  deleteExperience,
  submitDocuments,
  downloadOfferLetter,
} = require('../controllers/publicPipelineController');

const router = express.Router();

const experienceUpload = upload.fields([
  { name: 'experienceLetter', maxCount: 1 },
  { name: 'offerLetter', maxCount: 1 },
  { name: 'appointmentLetter', maxCount: 1 },
]);

router.get('/:token', getPublicPipeline);
router.get('/:token/offer-letter', downloadOfferLetter);
router.post('/:token/documents', applyRateLimiter, upload.single('file'), uploadDocument);
router.delete('/:token/documents/:documentId', deleteDocument);
router.post('/:token/experience', applyRateLimiter, experienceUpload, addExperience);
router.delete('/:token/experience/:experienceId', deleteExperience);
router.post('/:token/submit', submitDocuments);

module.exports = router;
