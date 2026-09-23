const { pool } = require('../config/db');
const screeningService = require('../services/screeningService');
const { AppError } = require('../utils/AppError');

async function screenJobRoute(req, res, next) {
  try {
    const { id } = req.params;
    const results = await screeningService.screenJob(id, req.user.organizationId);
    res.json({ status: 'ok', screened: results.length, results });
  } catch (err) {
    next(err);
  }
}

async function getJobResults(req, res, next) {
  try {
    const { id } = req.params;

    const jobResult = await pool.query(
      'SELECT id FROM jobs WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [id, req.user.organizationId]
    );
    if (!jobResult.rows[0]) {
      throw new AppError('Job not found', 404);
    }

    const { rows } = await pool.query(
      `SELECT sr.*, c.name, c.email
       FROM screening_results sr
       JOIN candidates c ON c.id = sr.candidate_id
       WHERE sr.job_id = $1
       ORDER BY sr.overall_score DESC NULLS LAST
       LIMIT 20`,
      [id]
    );

    res.json({ status: 'ok', results: rows });
  } catch (err) {
    next(err);
  }
}

async function getScreeningResult(req, res, next) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT sr.*, c.name, c.email
       FROM screening_results sr
       JOIN candidates c ON c.id = sr.candidate_id
       JOIN jobs j ON j.id = sr.job_id
       WHERE sr.id = $1 AND j.organization_id = $2`,
      [id, req.user.organizationId]
    );
    if (!rows[0]) {
      throw new AppError('Screening result not found', 404);
    }

    res.json({ status: 'ok', result: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { screenJobRoute, getJobResults, getScreeningResult };
