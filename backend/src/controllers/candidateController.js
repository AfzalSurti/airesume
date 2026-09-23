const { pool } = require('../config/db');
const { AppError } = require('../utils/AppError');

const UPDATABLE_FIELDS = [
  'name',
  'email',
  'phone',
  'location',
  'linkedin_url',
  'github_url',
  'portfolio_url',
  'total_experience',
  'education_summary',
  'notice_period',
  'current_salary',
  'expected_salary',
];

async function listCandidates(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const offset = (page - 1) * pageSize;
    const search = req.query.q ? `%${req.query.q}%` : null;

    const { rows } = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM resumes r WHERE r.candidate_id = c.id AND r.deleted_at IS NULL)::int AS resume_count
       FROM candidates c
       WHERE c.organization_id = $1 AND c.deleted_at IS NULL
         AND ($2::text IS NULL OR c.name ILIKE $2 OR c.email ILIKE $2)
       ORDER BY c.created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.user.organizationId, search, pageSize, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM candidates c
       WHERE c.organization_id = $1 AND c.deleted_at IS NULL
         AND ($2::text IS NULL OR c.name ILIKE $2 OR c.email ILIKE $2)`,
      [req.user.organizationId, search]
    );

    res.json({
      status: 'ok',
      candidates: rows,
      pagination: { page, pageSize, total: countResult.rows[0].total },
    });
  } catch (err) {
    next(err);
  }
}

async function getCandidate(req, res, next) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      'SELECT * FROM candidates WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [id, req.user.organizationId]
    );
    const candidate = rows[0];
    if (!candidate) {
      throw new AppError('Candidate not found', 404);
    }

    const resumesResult = await pool.query(
      `SELECT id, file_name, mime_type, file_size, version, is_active, created_at
       FROM resumes WHERE candidate_id = $1 AND deleted_at IS NULL
       ORDER BY version DESC`,
      [id]
    );

    res.json({ status: 'ok', candidate: { ...candidate, resumes: resumesResult.rows } });
  } catch (err) {
    next(err);
  }
}

async function updateCandidate(req, res, next) {
  try {
    const { id } = req.params;

    const updates = {};
    for (const field of UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    if (Object.keys(updates).length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    const setClauses = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${i}`);
      values.push(value);
      i += 1;
    }
    setClauses.push('updated_at = now()');
    values.push(id, req.user.organizationId);

    const { rows } = await pool.query(
      `UPDATE candidates SET ${setClauses.join(', ')}
       WHERE id = $${i} AND organization_id = $${i + 1} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (rows.length === 0) {
      throw new AppError('Candidate not found', 404);
    }

    res.json({ status: 'ok', candidate: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteCandidate(req, res, next) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `UPDATE candidates SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, req.user.organizationId]
    );

    if (rows.length === 0) {
      throw new AppError('Candidate not found', 404);
    }

    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCandidates, getCandidate, updateCandidate, deleteCandidate };
