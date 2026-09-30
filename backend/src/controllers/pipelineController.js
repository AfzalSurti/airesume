const crypto = require('crypto');
const { pool } = require('../config/db');
const storage = require('../services/storage');
const { sendEmail } = require('../services/emailService');
const { assertValidPdf } = require('../utils/pdfValidation');
const { AppError } = require('../utils/AppError');
const { ROLES } = require('../constants/roles');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function getPipelineWithContext(pipelineId, organizationId) {
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS candidate_name, c.email AS candidate_email, j.title AS job_title, j.id AS job_id,
            hod.name AS hod_name, hod.email AS hod_email
     FROM hiring_pipelines p
     JOIN applications a ON a.id = p.application_id
     JOIN candidates c ON c.id = a.candidate_id
     JOIN jobs j ON j.id = a.job_id
     LEFT JOIN users hod ON hod.id = p.hod_id
     WHERE p.id = $1 AND p.organization_id = $2`,
    [pipelineId, organizationId]
  );
  return rows[0];
}

async function requestDocuments(req, res, next) {
  try {
    const { id: applicationId } = req.params;

    const appResult = await pool.query(
      `SELECT a.id, a.job_id, a.candidate_id, c.name AS candidate_name, c.email AS candidate_email, j.title AS job_title
       FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = a.job_id
       WHERE a.id = $1 AND j.organization_id = $2`,
      [applicationId, req.user.organizationId]
    );
    const application = appResult.rows[0];
    if (!application) {
      throw new AppError('Application not found', 404);
    }
    if (!application.candidate_email) {
      throw new AppError('Candidate has no email on file, cannot request documents', 400);
    }

    const existing = await pool.query('SELECT * FROM hiring_pipelines WHERE application_id = $1', [applicationId]);
    let pipeline;
    if (existing.rows[0]) {
      pipeline = existing.rows[0];
    } else {
      const token = crypto.randomBytes(24).toString('hex');
      const { rows } = await pool.query(
        `INSERT INTO hiring_pipelines (application_id, organization_id, document_token, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [applicationId, req.user.organizationId, token, req.user.id]
      );
      pipeline = rows[0];
    }

    const link = `${FRONTEND_URL}/documents/${pipeline.document_token}`;
    const emailResult = await sendEmail({
      to: application.candidate_email,
      subject: `Documents required - ${application.job_title}`,
      html: `
        <p>Hi ${application.candidate_name},</p>
        <p>Congratulations on progressing for the <strong>${application.job_title}</strong> role. Please upload the
        following documents using the link below:</p>
        <p><a href="${link}">${link}</a></p>
      `,
      organizationId: req.user.organizationId,
      hiringPipelineId: pipeline.id,
    });

    res.status(201).json({ status: 'ok', pipeline, link, emailStatus: emailResult.status });
  } catch (err) {
    next(err);
  }
}

async function listPipelines(req, res, next) {
  try {
    const assignedToMe = req.query.assignedToMe === 'true';
    const stage = req.query.stage || null;

    const { rows } = await pool.query(
      `SELECT p.*, c.name AS candidate_name, c.email AS candidate_email, j.title AS job_title,
              hod.name AS hod_name
       FROM hiring_pipelines p
       JOIN applications a ON a.id = p.application_id
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = a.job_id
       LEFT JOIN users hod ON hod.id = p.hod_id
       WHERE p.organization_id = $1
         AND ($2::boolean IS NOT TRUE OR p.hod_id = $3)
         AND ($4::text IS NULL OR p.stage = $4)
       ORDER BY p.updated_at DESC`,
      [req.user.organizationId, assignedToMe, req.user.id, stage]
    );

    res.json({ status: 'ok', pipelines: rows });
  } catch (err) {
    next(err);
  }
}

async function getPipeline(req, res, next) {
  try {
    const { id } = req.params;
    const pipeline = await getPipelineWithContext(id, req.user.organizationId);
    if (!pipeline) {
      throw new AppError('Pipeline not found', 404);
    }

    const documentsResult = await pool.query(
      'SELECT * FROM pipeline_documents WHERE hiring_pipeline_id = $1 ORDER BY uploaded_at ASC',
      [id]
    );
    const experienceResult = await pool.query(
      'SELECT * FROM pipeline_experience_entries WHERE hiring_pipeline_id = $1 ORDER BY created_at ASC',
      [id]
    );

    res.json({
      status: 'ok',
      pipeline: { ...pipeline, documents: documentsResult.rows, experienceEntries: experienceResult.rows },
    });
  } catch (err) {
    next(err);
  }
}

async function forwardToHod(req, res, next) {
  try {
    const { id } = req.params;
    const { hodUserId } = req.body;

    const pipeline = await getPipelineWithContext(id, req.user.organizationId);
    if (!pipeline) {
      throw new AppError('Pipeline not found', 404);
    }

    const hodResult = await pool.query(
      'SELECT id, name, email FROM users WHERE id = $1 AND organization_id = $2 AND role = $3',
      [hodUserId, req.user.organizationId, ROLES.HOD]
    );
    const hod = hodResult.rows[0];
    if (!hod) {
      throw new AppError('HOD user not found', 404);
    }

    const { rows } = await pool.query(
      `UPDATE hiring_pipelines SET hod_id = $1, stage = 'FORWARDED_TO_HOD', updated_at = now()
       WHERE id = $2 RETURNING *`,
      [hod.id, id]
    );

    const emailResult = await sendEmail({
      to: hod.email,
      subject: `Candidate ready for review - ${pipeline.job_title}`,
      html: `
        <p>Hi ${hod.name},</p>
        <p><strong>${pipeline.candidate_name}</strong> has been forwarded to you for the
        <strong>${pipeline.job_title}</strong> role. Documents have been reviewed by HR.</p>
        <p>Sign in to schedule an interview: <a href="${FRONTEND_URL}/pipeline">${FRONTEND_URL}/pipeline</a></p>
      `,
      organizationId: req.user.organizationId,
      hiringPipelineId: id,
    });

    res.json({ status: 'ok', pipeline: rows[0], emailStatus: emailResult.status });
  } catch (err) {
    next(err);
  }
}

async function scheduleInterview(req, res, next) {
  try {
    const { id } = req.params;
    const { interviewDate, interviewTime, interviewLocation } = req.body;

    if (!interviewDate || !interviewTime || !interviewLocation) {
      throw new AppError('interviewDate, interviewTime and interviewLocation are all required', 400);
    }

    const pipeline = await getPipelineWithContext(id, req.user.organizationId);
    if (!pipeline) {
      throw new AppError('Pipeline not found', 404);
    }

    const { rows } = await pool.query(
      `UPDATE hiring_pipelines SET
         interview_date = $1, interview_time = $2, interview_location = $3,
         stage = 'INTERVIEW_SCHEDULED', updated_at = now()
       WHERE id = $4 RETURNING *`,
      [interviewDate, interviewTime, interviewLocation, id]
    );

    const emailResult = await sendEmail({
      to: pipeline.candidate_email,
      subject: `Interview scheduled - ${pipeline.job_title}`,
      html: `
        <p>Hi ${pipeline.candidate_name},</p>
        <p>Your interview for <strong>${pipeline.job_title}</strong> has been scheduled:</p>
        <p><strong>Date:</strong> ${interviewDate}<br/>
        <strong>Time:</strong> ${interviewTime}<br/>
        <strong>Location:</strong> ${interviewLocation}</p>
      `,
      organizationId: req.user.organizationId,
      hiringPipelineId: id,
    });

    res.json({ status: 'ok', pipeline: rows[0], emailStatus: emailResult.status });
  } catch (err) {
    next(err);
  }
}

async function recordDecision(req, res, next) {
  try {
    const { id } = req.params;
    const { decision, notes } = req.body;

    if (!['SELECTED', 'REJECTED'].includes(decision)) {
      throw new AppError('decision must be SELECTED or REJECTED', 400);
    }

    const pipeline = await getPipelineWithContext(id, req.user.organizationId);
    if (!pipeline) {
      throw new AppError('Pipeline not found', 404);
    }

    const stage = decision === 'SELECTED' ? 'HOD_SELECTED' : 'HOD_REJECTED';
    const { rows } = await pool.query(
      `UPDATE hiring_pipelines SET stage = $1, hod_decision_notes = $2, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [stage, notes || null, id]
    );

    if (decision === 'REJECTED') {
      await pool.query('UPDATE applications SET status = $1, updated_at = now() WHERE id = $2', [
        'REJECTED',
        pipeline.application_id,
      ]);
    }

    const creatorResult = await pool.query('SELECT email, name FROM users WHERE id = $1', [pipeline.created_by]);
    const creator = creatorResult.rows[0];
    if (creator) {
      await sendEmail({
        to: creator.email,
        subject: `HOD decision: ${decision} - ${pipeline.candidate_name}`,
        html: `
          <p>Hi ${creator.name},</p>
          <p>${pipeline.hod_name || 'The HOD'} has marked <strong>${pipeline.candidate_name}</strong>
          (${pipeline.job_title}) as <strong>${decision}</strong>.</p>
          ${notes ? `<p>Notes: ${notes}</p>` : ''}
        `,
        organizationId: req.user.organizationId,
        hiringPipelineId: id,
      });
    }

    res.json({ status: 'ok', pipeline: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function sendOffer(req, res, next) {
  try {
    const { id } = req.params;
    assertValidPdf(req.file);

    const pipeline = await getPipelineWithContext(id, req.user.organizationId);
    if (!pipeline) {
      throw new AppError('Pipeline not found', 404);
    }

    const storageKey = `pipeline-docs/${id}/offer-${crypto.randomUUID()}.pdf`;
    await storage.save(req.file.buffer, storageKey);

    await pool.query(
      `UPDATE hiring_pipelines SET
         stage = 'OFFER_SENT', offer_letter_storage_key = $1, offer_letter_file_name = $2, updated_at = now()
       WHERE id = $3`,
      [storageKey, req.file.originalname, id]
    );

    const link = `${FRONTEND_URL}/documents/${pipeline.document_token}`;
    const emailResult = await sendEmail({
      to: pipeline.candidate_email,
      subject: `Offer letter - ${pipeline.job_title}`,
      html: `
        <p>Hi ${pipeline.candidate_name},</p>
        <p>Congratulations! Please find your offer letter for <strong>${pipeline.job_title}</strong> attached.</p>
        <p>${req.body.message || ''}</p>
        <p>Please confirm by uploading any remaining documents here: <a href="${link}">${link}</a></p>
      `,
      organizationId: req.user.organizationId,
      hiringPipelineId: id,
    });

    const { rows } = await pool.query('SELECT * FROM hiring_pipelines WHERE id = $1', [id]);
    res.json({ status: 'ok', pipeline: rows[0], emailStatus: emailResult.status });
  } catch (err) {
    next(err);
  }
}

async function verifyDocument(req, res, next) {
  try {
    const { id, documentId } = req.params;

    const pipeline = await getPipelineWithContext(id, req.user.organizationId);
    if (!pipeline) {
      throw new AppError('Pipeline not found', 404);
    }

    const { rows } = await pool.query(
      'UPDATE pipeline_documents SET verified = true WHERE id = $1 AND hiring_pipeline_id = $2 RETURNING *',
      [documentId, id]
    );
    if (rows.length === 0) {
      throw new AppError('Document not found', 404);
    }

    res.json({ status: 'ok', document: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function completePipeline(req, res, next) {
  try {
    const { id } = req.params;

    const pipeline = await getPipelineWithContext(id, req.user.organizationId);
    if (!pipeline) {
      throw new AppError('Pipeline not found', 404);
    }

    const { rows } = await pool.query(
      `UPDATE hiring_pipelines SET stage = 'COMPLETED', updated_at = now() WHERE id = $1 RETURNING *`,
      [id]
    );

    await pool.query('UPDATE applications SET status = $1, updated_at = now() WHERE id = $2', [
      'HIRED',
      pipeline.application_id,
    ]);

    res.json({ status: 'ok', pipeline: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function downloadPipelineDocument(req, res, next) {
  try {
    const { documentId } = req.params;

    const { rows } = await pool.query(
      `SELECT pd.* FROM pipeline_documents pd
       JOIN hiring_pipelines p ON p.id = pd.hiring_pipeline_id
       WHERE pd.id = $1 AND p.organization_id = $2`,
      [documentId, req.user.organizationId]
    );
    const doc = rows[0];
    if (!doc) {
      throw new AppError('Document not found', 404);
    }

    const buffer = await storage.read(doc.storage_key);
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

const EXPERIENCE_FILE_FIELDS = {
  experienceLetter: { key: 'experience_letter_key', name: 'experience_letter_file_name' },
  offerLetter: { key: 'offer_letter_key', name: 'offer_letter_file_name' },
  appointmentLetter: { key: 'appointment_letter_key', name: 'appointment_letter_file_name' },
};

async function downloadExperienceFile(req, res, next) {
  try {
    const { id, experienceId, field } = req.params;
    const columns = EXPERIENCE_FILE_FIELDS[field];
    if (!columns) {
      throw new AppError('Invalid file field', 400);
    }

    const pipeline = await getPipelineWithContext(id, req.user.organizationId);
    if (!pipeline) {
      throw new AppError('Pipeline not found', 404);
    }

    const { rows } = await pool.query(
      `SELECT ${columns.key} AS storage_key, ${columns.name} AS file_name
       FROM pipeline_experience_entries WHERE id = $1 AND hiring_pipeline_id = $2`,
      [experienceId, id]
    );
    const entry = rows[0];
    if (!entry || !entry.storage_key) {
      throw new AppError('File not found', 404);
    }

    const buffer = await storage.read(entry.storage_key);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${entry.file_name}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function downloadOfferLetter(req, res, next) {
  try {
    const { id } = req.params;
    const pipeline = await getPipelineWithContext(id, req.user.organizationId);
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
  requestDocuments,
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
  downloadExperienceFile,
};
