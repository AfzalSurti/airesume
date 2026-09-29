const crypto = require('crypto');
const { pool } = require('../config/db');
const storage = require('../services/storage');
const { sendEmail } = require('../services/emailService');
const { assertValidPdf } = require('../utils/pdfValidation');
const { AppError } = require('../utils/AppError');

async function getPipelineByToken(token) {
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS candidate_name, c.email AS candidate_email, j.title AS job_title
     FROM hiring_pipelines p
     JOIN applications a ON a.id = p.application_id
     JOIN candidates c ON c.id = a.candidate_id
     JOIN jobs j ON j.id = a.job_id
     WHERE p.document_token = $1`,
    [token]
  );
  return rows[0];
}

async function getPublicPipeline(req, res, next) {
  try {
    const { token } = req.params;
    const pipeline = await getPipelineByToken(token);
    if (!pipeline) {
      throw new AppError('Invalid or expired link', 404);
    }

    const requirementsResult = await pool.query(
      'SELECT id, label, required FROM document_requirements WHERE organization_id = $1 ORDER BY order_index ASC',
      [pipeline.organization_id]
    );
    const documentsResult = await pool.query(
      'SELECT id, document_requirement_id, label, file_name, uploaded_at FROM pipeline_documents WHERE hiring_pipeline_id = $1',
      [pipeline.id]
    );
    const experienceResult = await pool.query(
      `SELECT id, company_name, company_location, date_of_joining, date_of_exit,
              experience_letter_file_name, offer_letter_file_name, appointment_letter_file_name
       FROM pipeline_experience_entries WHERE hiring_pipeline_id = $1 ORDER BY created_at ASC`,
      [pipeline.id]
    );

    res.json({
      status: 'ok',
      pipeline: {
        id: pipeline.id,
        stage: pipeline.stage,
        candidateName: pipeline.candidate_name,
        jobTitle: pipeline.job_title,
        offerLetterAvailable: !!pipeline.offer_letter_storage_key,
        documentRequirements: requirementsResult.rows,
        documents: documentsResult.rows,
        experienceEntries: experienceResult.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function uploadDocument(req, res, next) {
  try {
    const { token } = req.params;
    const { documentRequirementId, label } = req.body;

    const pipeline = await getPipelineByToken(token);
    if (!pipeline) {
      throw new AppError('Invalid or expired link', 404);
    }
    assertValidPdf(req.file);

    let resolvedLabel = label;
    if (documentRequirementId) {
      const reqResult = await pool.query('SELECT label FROM document_requirements WHERE id = $1 AND organization_id = $2', [
        documentRequirementId,
        pipeline.organization_id,
      ]);
      if (!reqResult.rows[0]) {
        throw new AppError('Invalid document requirement', 400);
      }
      resolvedLabel = reqResult.rows[0].label;
    }
    if (!resolvedLabel || !resolvedLabel.trim()) {
      throw new AppError('label or documentRequirementId is required', 400);
    }

    const storageKey = `pipeline-docs/${pipeline.id}/${crypto.randomUUID()}.pdf`;
    await storage.save(req.file.buffer, storageKey);

    const { rows } = await pool.query(
      `INSERT INTO pipeline_documents (hiring_pipeline_id, document_requirement_id, label, storage_key, file_name, mime_type, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, document_requirement_id, label, file_name, uploaded_at`,
      [pipeline.id, documentRequirementId || null, resolvedLabel.trim(), storageKey, req.file.originalname, req.file.mimetype, req.file.size]
    );

    res.status(201).json({ status: 'ok', document: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteDocument(req, res, next) {
  try {
    const { token, documentId } = req.params;
    const pipeline = await getPipelineByToken(token);
    if (!pipeline) {
      throw new AppError('Invalid or expired link', 404);
    }

    const { rows } = await pool.query(
      'DELETE FROM pipeline_documents WHERE id = $1 AND hiring_pipeline_id = $2 RETURNING storage_key',
      [documentId, pipeline.id]
    );
    if (!rows[0]) {
      throw new AppError('Document not found', 404);
    }

    await storage.remove(rows[0].storage_key).catch(() => {});
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
}

async function addExperience(req, res, next) {
  try {
    const { token } = req.params;
    const { companyName, companyLocation, dateOfJoining, dateOfExit } = req.body;

    const pipeline = await getPipelineByToken(token);
    if (!pipeline) {
      throw new AppError('Invalid or expired link', 404);
    }
    if (!companyName || !companyName.trim()) {
      throw new AppError('companyName is required', 400);
    }

    const files = req.files || {};
    const savedKeys = {};

    for (const field of ['experienceLetter', 'offerLetter', 'appointmentLetter']) {
      const file = files[field]?.[0];
      if (file) {
        assertValidPdf(file);
        const key = `pipeline-docs/${pipeline.id}/experience-${field}-${crypto.randomUUID()}.pdf`;
        // eslint-disable-next-line no-await-in-loop
        await storage.save(file.buffer, key);
        savedKeys[field] = { key, name: file.originalname };
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO pipeline_experience_entries (
         hiring_pipeline_id, company_name, company_location, date_of_joining, date_of_exit,
         experience_letter_key, experience_letter_file_name,
         offer_letter_key, offer_letter_file_name,
         appointment_letter_key, appointment_letter_file_name
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, company_name, company_location, date_of_joining, date_of_exit,
                 experience_letter_file_name, offer_letter_file_name, appointment_letter_file_name`,
      [
        pipeline.id,
        companyName.trim(),
        companyLocation || null,
        dateOfJoining || null,
        dateOfExit || null,
        savedKeys.experienceLetter?.key || null,
        savedKeys.experienceLetter?.name || null,
        savedKeys.offerLetter?.key || null,
        savedKeys.offerLetter?.name || null,
        savedKeys.appointmentLetter?.key || null,
        savedKeys.appointmentLetter?.name || null,
      ]
    );

    res.status(201).json({ status: 'ok', experience: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteExperience(req, res, next) {
  try {
    const { token, experienceId } = req.params;
    const pipeline = await getPipelineByToken(token);
    if (!pipeline) {
      throw new AppError('Invalid or expired link', 404);
    }

    const { rows } = await pool.query(
      `DELETE FROM pipeline_experience_entries WHERE id = $1 AND hiring_pipeline_id = $2
       RETURNING experience_letter_key, offer_letter_key, appointment_letter_key`,
      [experienceId, pipeline.id]
    );
    if (!rows[0]) {
      throw new AppError('Experience entry not found', 404);
    }

    await Promise.all(
      [rows[0].experience_letter_key, rows[0].offer_letter_key, rows[0].appointment_letter_key]
        .filter(Boolean)
        .map((key) => storage.remove(key).catch(() => {}))
    );

    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
}

async function submitDocuments(req, res, next) {
  try {
    const { token } = req.params;
    const pipeline = await getPipelineByToken(token);
    if (!pipeline) {
      throw new AppError('Invalid or expired link', 404);
    }

    const { rows } = await pool.query(
      `UPDATE hiring_pipelines SET stage = 'DOCS_SUBMITTED', updated_at = now() WHERE id = $1 RETURNING *`,
      [pipeline.id]
    );

    const creatorResult = await pool.query('SELECT email, name FROM users WHERE id = $1', [pipeline.created_by]);
    const creator = creatorResult.rows[0];
    if (creator) {
      await sendEmail({
        to: creator.email,
        subject: `Documents submitted - ${pipeline.candidate_name}`,
        html: `<p>Hi ${creator.name},</p><p><strong>${pipeline.candidate_name}</strong> has submitted their documents for <strong>${pipeline.job_title}</strong>. Please review.</p>`,
        organizationId: pipeline.organization_id,
        hiringPipelineId: pipeline.id,
      });
    }

    res.json({ status: 'ok', pipeline: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function downloadOfferLetter(req, res, next) {
  try {
    const { token } = req.params;
    const pipeline = await getPipelineByToken(token);
    if (!pipeline || !pipeline.offer_letter_storage_key) {
      throw new AppError('Offer letter not found', 404);
    }

    const buffer = await storage.read(pipeline.offer_letter_storage_key);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pipeline.offer_letter_file_name}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPublicPipeline,
  uploadDocument,
  deleteDocument,
  addExperience,
  deleteExperience,
  submitDocuments,
  downloadOfferLetter,
};
