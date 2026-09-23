const crypto = require('crypto');
const path = require('path');
const { pool } = require('../config/db');
const storage = require('../services/storage');
const resumeProcessingService = require('../services/resumeProcessingService');
const { AppError } = require('../utils/AppError');

const PDF_MAGIC_BYTES = '%PDF-';

function assertValidPdf(file) {
  if (!file) {
    throw new AppError('resume file is required', 400);
  }
  if (file.mimetype !== 'application/pdf') {
    throw new AppError('Only PDF files are allowed', 400);
  }
  const header = file.buffer.slice(0, 5).toString('ascii');
  if (header !== PDF_MAGIC_BYTES) {
    throw new AppError('Uploaded file is not a valid PDF', 400);
  }
}

async function findOrCreateCandidate(client, organizationId, body) {
  const { candidateId, name, email, phone, location, linkedinUrl, githubUrl, portfolioUrl } = body;

  if (candidateId) {
    const { rows } = await client.query(
      'SELECT * FROM candidates WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [candidateId, organizationId]
    );
    if (!rows[0]) {
      throw new AppError('Candidate not found', 404);
    }
    return rows[0];
  }

  if (!name) {
    throw new AppError('name is required when candidateId is not provided', 400);
  }

  const normalizedEmail = email ? email.toLowerCase().trim() : null;

  if (normalizedEmail) {
    const existing = await client.query(
      'SELECT * FROM candidates WHERE organization_id = $1 AND lower(email) = $2 AND deleted_at IS NULL',
      [organizationId, normalizedEmail]
    );
    if (existing.rows[0]) {
      return existing.rows[0];
    }
  }

  const { rows } = await client.query(
    `INSERT INTO candidates (organization_id, name, email, phone, location, linkedin_url, github_url, portfolio_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      organizationId,
      name.trim(),
      normalizedEmail,
      phone || null,
      location || null,
      linkedinUrl || null,
      githubUrl || null,
      portfolioUrl || null,
    ]
  );
  return rows[0];
}

async function uploadResume(req, res, next) {
  const client = await pool.connect();
  let savedStorageKey = null;

  try {
    assertValidPdf(req.file);

    await client.query('BEGIN');

    const candidate = await findOrCreateCandidate(client, req.user.organizationId, req.body);

    const versionResult = await client.query(
      'SELECT COALESCE(MAX(version), 0) AS max_version FROM resumes WHERE candidate_id = $1',
      [candidate.id]
    );
    const nextVersion = versionResult.rows[0].max_version + 1;

    await client.query('UPDATE resumes SET is_active = false WHERE candidate_id = $1 AND is_active = true', [
      candidate.id,
    ]);

    const ext = path.extname(req.file.originalname) || '.pdf';
    const storageKey = `resumes/${candidate.id}/${crypto.randomUUID()}${ext}`;
    await storage.save(req.file.buffer, storageKey);
    savedStorageKey = storageKey;

    const { rows } = await client.query(
      `INSERT INTO resumes (candidate_id, storage_key, file_name, mime_type, file_size, version, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, candidate_id, file_name, mime_type, file_size, version, is_active, created_at`,
      [candidate.id, storageKey, req.file.originalname, req.file.mimetype, req.file.size, nextVersion]
    );

    await client.query('COMMIT');

    let processing;
    try {
      const result = await resumeProcessingService.processResume(rows[0].id);
      processing = { status: 'ok', profile: result.profile };
    } catch (err) {
      console.error('Resume AI processing failed:', err.message);
      processing = { status: 'failed', message: err.message };
    }

    res.status(201).json({ status: 'ok', candidate, resume: rows[0], processing });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (savedStorageKey) {
      await storage.remove(savedStorageKey).catch(() => {});
    }
    next(err);
  } finally {
    client.release();
  }
}

async function processResumeRoute(req, res, next) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT r.id FROM resumes r
       JOIN candidates c ON c.id = r.candidate_id
       WHERE r.id = $1 AND c.organization_id = $2 AND r.deleted_at IS NULL`,
      [id, req.user.organizationId]
    );
    if (!rows[0]) {
      throw new AppError('Resume not found', 404);
    }

    const result = await resumeProcessingService.processResume(id);
    res.json({ status: 'ok', profile: result.profile });
  } catch (err) {
    next(err);
  }
}

async function listCandidateResumes(req, res, next) {
  try {
    const { id } = req.params;

    const candidateResult = await pool.query(
      'SELECT id FROM candidates WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [id, req.user.organizationId]
    );
    if (!candidateResult.rows[0]) {
      throw new AppError('Candidate not found', 404);
    }

    const { rows } = await pool.query(
      `SELECT id, file_name, mime_type, file_size, version, is_active, created_at
       FROM resumes WHERE candidate_id = $1 AND deleted_at IS NULL
       ORDER BY version DESC`,
      [id]
    );

    res.json({ status: 'ok', resumes: rows });
  } catch (err) {
    next(err);
  }
}

async function downloadResume(req, res, next) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT r.id, r.storage_key, r.file_name, r.mime_type
       FROM resumes r
       JOIN candidates c ON c.id = r.candidate_id
       WHERE r.id = $1 AND c.organization_id = $2 AND r.deleted_at IS NULL`,
      [id, req.user.organizationId]
    );
    const resume = rows[0];
    if (!resume) {
      throw new AppError('Resume not found', 404);
    }

    const buffer = await storage.read(resume.storage_key);
    res.setHeader('Content-Type', resume.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${resume.file_name}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function deleteResume(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT r.id, r.candidate_id, r.storage_key, r.is_active
       FROM resumes r
       JOIN candidates c ON c.id = r.candidate_id
       WHERE r.id = $1 AND c.organization_id = $2 AND r.deleted_at IS NULL
       FOR UPDATE OF r`,
      [id, req.user.organizationId]
    );
    const resume = rows[0];
    if (!resume) {
      throw new AppError('Resume not found', 404);
    }

    await client.query('DELETE FROM resumes WHERE id = $1', [id]);

    if (resume.is_active) {
      const nextResult = await client.query(
        `SELECT id FROM resumes WHERE candidate_id = $1 AND deleted_at IS NULL
         ORDER BY version DESC LIMIT 1`,
        [resume.candidate_id]
      );
      if (nextResult.rows[0]) {
        await client.query('UPDATE resumes SET is_active = true WHERE id = $1', [nextResult.rows[0].id]);
      }
    }

    await client.query('COMMIT');

    await storage.remove(resume.storage_key).catch((err) => {
      console.error('Failed to remove resume file from storage:', err.message);
    });

    res.json({ status: 'ok' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { uploadResume, processResumeRoute, listCandidateResumes, downloadResume, deleteResume };
