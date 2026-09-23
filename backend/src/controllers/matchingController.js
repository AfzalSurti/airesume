const matchingService = require('../services/matchingService');
const { AppError } = require('../utils/AppError');

async function searchCandidatePool(req, res, next) {
  try {
    const { jdText, retrievalLimit, topLimit } = req.body;

    if (!jdText || !jdText.trim()) {
      throw new AppError('jdText is required', 400);
    }

    const safeRetrievalLimit = Math.min(Math.max(parseInt(retrievalLimit, 10) || 25, 1), 100);
    const safeTopLimit = Math.min(Math.max(parseInt(topLimit, 10) || 10, 1), 20);

    const result = await matchingService.searchCandidatePool(req.user.organizationId, {
      jdText,
      retrievalLimit: safeRetrievalLimit,
      topLimit: safeTopLimit,
    });

    res.json({ status: 'ok', ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { searchCandidatePool };
