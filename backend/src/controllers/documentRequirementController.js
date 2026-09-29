const { pool } = require('../config/db');
const { AppError } = require('../utils/AppError');

const DEFAULT_REQUIREMENTS = ['10th Marksheet', '12th Marksheet', 'Degree / Diploma Certificate', 'Certificate'];

async function ensureDefaults(organizationId) {
  const { rows } = await pool.query('SELECT id FROM document_requirements WHERE organization_id = $1 LIMIT 1', [
    organizationId,
  ]);
  if (rows.length > 0) return;

  await Promise.all(
    DEFAULT_REQUIREMENTS.map((label, index) =>
      pool.query(
        'INSERT INTO document_requirements (organization_id, label, required, order_index) VALUES ($1, $2, true, $3)',
        [organizationId, label, index]
      )
    )
  );
}

async function listDocumentRequirements(req, res, next) {
  try {
    await ensureDefaults(req.user.organizationId);

    const { rows } = await pool.query(
      'SELECT * FROM document_requirements WHERE organization_id = $1 ORDER BY order_index ASC, created_at ASC',
      [req.user.organizationId]
    );

    res.json({ status: 'ok', documentRequirements: rows });
  } catch (err) {
    next(err);
  }
}

async function createDocumentRequirement(req, res, next) {
  try {
    const { label, required, orderIndex } = req.body;
    if (!label || !label.trim()) {
      throw new AppError('label is required', 400);
    }

    const { rows } = await pool.query(
      `INSERT INTO document_requirements (organization_id, label, required, order_index)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.organizationId, label.trim(), required !== false, orderIndex ?? 0]
    );

    res.status(201).json({ status: 'ok', documentRequirement: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateDocumentRequirement(req, res, next) {
  try {
    const { id } = req.params;
    const { label, required, orderIndex } = req.body;

    const { rows } = await pool.query(
      `UPDATE document_requirements SET
         label = COALESCE($1, label),
         required = COALESCE($2, required),
         order_index = COALESCE($3, order_index)
       WHERE id = $4 AND organization_id = $5
       RETURNING *`,
      [label ?? null, required ?? null, orderIndex ?? null, id, req.user.organizationId]
    );
    if (rows.length === 0) {
      throw new AppError('Document requirement not found', 404);
    }

    res.json({ status: 'ok', documentRequirement: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteDocumentRequirement(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      'DELETE FROM document_requirements WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, req.user.organizationId]
    );
    if (rows.length === 0) {
      throw new AppError('Document requirement not found', 404);
    }

    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listDocumentRequirements, createDocumentRequirement, updateDocumentRequirement, deleteDocumentRequirement };
