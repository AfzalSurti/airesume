const { pool } = require('../config/db');
const { AppError } = require('../utils/AppError');

const STATUSES = ['SUBMITTED', 'SCREENING', 'SHORTLISTED', 'REJECTED', 'HIRED', 'ARCHIVED'];

async function listJobApplications(req, res, next) {
  try {
    const { id: jobId } = req.params;

    const jobResult = await pool.query(
      'SELECT id FROM jobs WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [jobId, req.user.organizationId]
    );
    if (!jobResult.rows[0]) {
      throw new AppError('Job not found', 404);
    }

    const { rows } = await pool.query(
      `SELECT a.*, c.name, c.email, c.phone
       FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       WHERE a.job_id = $1
       ORDER BY a.submitted_at DESC`,
      [jobId]
    );

    res.json({ status: 'ok', applications: rows });
  } catch (err) {
    next(err);
  }
}

async function getApplication(req, res, next) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT a.*, c.name, c.email, c.phone, c.location, c.linkedin_url, c.github_url, c.portfolio_url,
              c.notice_period, c.current_salary, c.expected_salary, j.title AS job_title
       FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = a.job_id
       WHERE a.id = $1 AND j.organization_id = $2`,
      [id, req.user.organizationId]
    );
    const application = rows[0];
    if (!application) {
      throw new AppError('Application not found', 404);
    }

    const answersResult = await pool.query(
      `SELECT aa.id, aa.answer_text, aa.answer_json, jq.id AS job_question_id, jq.question, jq.question_type
       FROM application_answers aa
       JOIN job_questions jq ON jq.id = aa.job_question_id
       WHERE aa.application_id = $1
       ORDER BY jq.order_index ASC`,
      [id]
    );

    res.json({ status: 'ok', application: { ...application, answers: answersResult.rows } });
  } catch (err) {
    next(err);
  }
}

async function updateApplication(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !STATUSES.includes(status)) {
      throw new AppError(`status must be one of: ${STATUSES.join(', ')}`, 400);
    }

    const { rows } = await pool.query(
      `UPDATE applications a SET status = $1, updated_at = now()
       FROM jobs j
       WHERE a.id = $2 AND a.job_id = j.id AND j.organization_id = $3
       RETURNING a.*`,
      [status, id, req.user.organizationId]
    );
    if (rows.length === 0) {
      throw new AppError('Application not found', 404);
    }

    res.json({ status: 'ok', application: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listJobApplications, getApplication, updateApplication };
