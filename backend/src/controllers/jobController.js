const crypto = require('crypto');
const { pool } = require('../config/db');
const { slugify } = require('../utils/slugify');
const aiServiceClient = require('../services/aiServiceClient');
const { AppError } = require('../utils/AppError');

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY'];
const STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'];
const QUESTION_TYPES = ['text', 'textarea', 'number', 'select', 'multiselect', 'boolean'];

const UPDATABLE_JOB_FIELDS = [
  'title',
  'description',
  'linkedin_url',
  'location',
  'employment_type',
  'experience_min',
  'experience_max',
  'status',
];

async function generateUniqueSlug(client, title) {
  const base = slugify(title) || 'job';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = crypto.randomBytes(3).toString('hex');
    const candidate = `${base}-${suffix}`;
    const { rows } = await client.query('SELECT 1 FROM jobs WHERE lower(slug) = lower($1)', [candidate]);
    if (rows.length === 0) {
      return candidate;
    }
  }
  throw new AppError('Could not generate a unique job slug, please try again', 500);
}

async function createJob(req, res, next) {
  const client = await pool.connect();
  try {
    const { title, description, linkedinUrl, location, employmentType, experienceMin, experienceMax, status } =
      req.body;

    if (!title || !title.trim()) {
      throw new AppError('title is required', 400);
    }
    if (!description || !description.trim()) {
      throw new AppError('description is required', 400);
    }
    if (employmentType && !EMPLOYMENT_TYPES.includes(employmentType)) {
      throw new AppError(`employmentType must be one of: ${EMPLOYMENT_TYPES.join(', ')}`, 400);
    }
    if (status && !STATUSES.includes(status)) {
      throw new AppError(`status must be one of: ${STATUSES.join(', ')}`, 400);
    }

    const slug = await generateUniqueSlug(client, title);

    const { rows } = await client.query(
      `INSERT INTO jobs (
         organization_id, title, slug, description, linkedin_url, location,
         employment_type, experience_min, experience_max, status, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        req.user.organizationId,
        title.trim(),
        slug,
        description.trim(),
        linkedinUrl || null,
        location || null,
        employmentType || 'FULL_TIME',
        experienceMin ?? null,
        experienceMax ?? null,
        status || 'DRAFT',
        req.user.id,
      ]
    );
    const job = rows[0];

    try {
      const structuredRequirements = await aiServiceClient.parseJd(description);
      const updated = await pool.query(
        'UPDATE jobs SET structured_requirements = $1::jsonb, updated_at = now() WHERE id = $2 RETURNING *',
        [JSON.stringify(structuredRequirements), job.id]
      );
      res.status(201).json({ status: 'ok', job: updated.rows[0] });
    } catch (err) {
      console.error('JD structuring failed for job', job.id, ':', err.message);
      res.status(201).json({ status: 'ok', job });
    }
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
}

async function listJobs(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const offset = (page - 1) * pageSize;
    const search = req.query.q ? `%${req.query.q}%` : null;
    const status = req.query.status && STATUSES.includes(req.query.status) ? req.query.status : null;

    const { rows } = await pool.query(
      `SELECT * FROM jobs
       WHERE organization_id = $1 AND deleted_at IS NULL
         AND ($2::text IS NULL OR title ILIKE $2)
         AND ($3::text IS NULL OR status = $3)
       ORDER BY created_at DESC
       LIMIT $4 OFFSET $5`,
      [req.user.organizationId, search, status, pageSize, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM jobs
       WHERE organization_id = $1 AND deleted_at IS NULL
         AND ($2::text IS NULL OR title ILIKE $2)
         AND ($3::text IS NULL OR status = $3)`,
      [req.user.organizationId, search, status]
    );

    res.json({ status: 'ok', jobs: rows, pagination: { page, pageSize, total: countResult.rows[0].total } });
  } catch (err) {
    next(err);
  }
}

async function getJob(req, res, next) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query('SELECT * FROM jobs WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL', [
      id,
      req.user.organizationId,
    ]);
    const job = rows[0];
    if (!job) {
      throw new AppError('Job not found', 404);
    }

    const questionsResult = await pool.query(
      'SELECT * FROM job_questions WHERE job_id = $1 ORDER BY order_index ASC, created_at ASC',
      [id]
    );

    res.json({ status: 'ok', job: { ...job, questions: questionsResult.rows } });
  } catch (err) {
    next(err);
  }
}

async function updateJob(req, res, next) {
  try {
    const { id } = req.params;

    if (req.body.employmentType !== undefined) {
      req.body.employment_type = req.body.employmentType;
    }
    if (req.body.linkedinUrl !== undefined) {
      req.body.linkedin_url = req.body.linkedinUrl;
    }
    if (req.body.experienceMin !== undefined) {
      req.body.experience_min = req.body.experienceMin;
    }
    if (req.body.experienceMax !== undefined) {
      req.body.experience_max = req.body.experienceMax;
    }

    if (req.body.employment_type && !EMPLOYMENT_TYPES.includes(req.body.employment_type)) {
      throw new AppError(`employmentType must be one of: ${EMPLOYMENT_TYPES.join(', ')}`, 400);
    }
    if (req.body.status && !STATUSES.includes(req.body.status)) {
      throw new AppError(`status must be one of: ${STATUSES.join(', ')}`, 400);
    }

    const updates = {};
    for (const field of UPDATABLE_JOB_FIELDS) {
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
      `UPDATE jobs SET ${setClauses.join(', ')}
       WHERE id = $${i} AND organization_id = $${i + 1} AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    if (rows.length === 0) {
      throw new AppError('Job not found', 404);
    }
    let job = rows[0];

    if (updates.description) {
      try {
        const structuredRequirements = await aiServiceClient.parseJd(updates.description);
        const reparsed = await pool.query(
          'UPDATE jobs SET structured_requirements = $1::jsonb, updated_at = now() WHERE id = $2 RETURNING *',
          [JSON.stringify(structuredRequirements), id]
        );
        job = reparsed.rows[0];
      } catch (err) {
        console.error('JD re-structuring failed for job', id, ':', err.message);
      }
    }

    res.json({ status: 'ok', job });
  } catch (err) {
    next(err);
  }
}

async function deleteJob(req, res, next) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `UPDATE jobs SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, req.user.organizationId]
    );
    if (rows.length === 0) {
      throw new AppError('Job not found', 404);
    }

    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
}

async function assertJobOwnership(id, organizationId) {
  const { rows } = await pool.query('SELECT id FROM jobs WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL', [
    id,
    organizationId,
  ]);
  if (!rows[0]) {
    throw new AppError('Job not found', 404);
  }
}

function validateQuestionPayload(body) {
  const { question, questionType, options } = body;
  if (!question || !question.trim()) {
    throw new AppError('question is required', 400);
  }
  const type = questionType || 'text';
  if (!QUESTION_TYPES.includes(type)) {
    throw new AppError(`questionType must be one of: ${QUESTION_TYPES.join(', ')}`, 400);
  }
  if (['select', 'multiselect'].includes(type)) {
    if (!Array.isArray(options) || options.length === 0) {
      throw new AppError('options must be a non-empty array for select/multiselect questions', 400);
    }
  }
  return type;
}

async function createJobQuestion(req, res, next) {
  try {
    const { id: jobId } = req.params;
    await assertJobOwnership(jobId, req.user.organizationId);

    const type = validateQuestionPayload(req.body);
    const { question, required, options, orderIndex } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO job_questions (job_id, question, question_type, required, options, order_index)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING *`,
      [jobId, question.trim(), type, !!required, options ? JSON.stringify(options) : null, orderIndex ?? 0]
    );

    res.status(201).json({ status: 'ok', question: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function listJobQuestions(req, res, next) {
  try {
    const { id: jobId } = req.params;
    await assertJobOwnership(jobId, req.user.organizationId);

    const { rows } = await pool.query(
      'SELECT * FROM job_questions WHERE job_id = $1 ORDER BY order_index ASC, created_at ASC',
      [jobId]
    );

    res.json({ status: 'ok', questions: rows });
  } catch (err) {
    next(err);
  }
}

async function updateJobQuestion(req, res, next) {
  try {
    const { id } = req.params;

    const existingResult = await pool.query(
      `SELECT jq.* FROM job_questions jq
       JOIN jobs j ON j.id = jq.job_id
       WHERE jq.id = $1 AND j.organization_id = $2 AND j.deleted_at IS NULL`,
      [id, req.user.organizationId]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      throw new AppError('Question not found', 404);
    }

    const type = req.body.questionType || existing.question_type;
    if (!QUESTION_TYPES.includes(type)) {
      throw new AppError(`questionType must be one of: ${QUESTION_TYPES.join(', ')}`, 400);
    }
    const options = req.body.options !== undefined ? req.body.options : existing.options;
    if (['select', 'multiselect'].includes(type) && (!Array.isArray(options) || options.length === 0)) {
      throw new AppError('options must be a non-empty array for select/multiselect questions', 400);
    }

    const { rows } = await pool.query(
      `UPDATE job_questions SET
         question = $1,
         question_type = $2,
         required = $3,
         options = $4::jsonb,
         order_index = $5
       WHERE id = $6
       RETURNING *`,
      [
        req.body.question !== undefined ? req.body.question.trim() : existing.question,
        type,
        req.body.required !== undefined ? !!req.body.required : existing.required,
        options ? JSON.stringify(options) : null,
        req.body.orderIndex !== undefined ? req.body.orderIndex : existing.order_index,
        id,
      ]
    );

    res.json({ status: 'ok', question: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteJobQuestion(req, res, next) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `DELETE FROM job_questions jq
       USING jobs j
       WHERE jq.id = $1 AND jq.job_id = j.id AND j.organization_id = $2 AND j.deleted_at IS NULL
       RETURNING jq.id`,
      [id, req.user.organizationId]
    );
    if (rows.length === 0) {
      throw new AppError('Question not found', 404);
    }

    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createJob,
  listJobs,
  getJob,
  updateJob,
  deleteJob,
  createJobQuestion,
  listJobQuestions,
  updateJobQuestion,
  deleteJobQuestion,
};
