const { pool } = require('../config/db');
const storage = require('../services/storage');
const resumeProcessingService = require('../services/resumeProcessingService');
const { saveResumeVersion } = require('../services/resumeStorageService');
const { assertValidPdf } = require('../utils/pdfValidation');
const { AppError } = require('../utils/AppError');

async function getPublicJob(req, res, next) {
  try {
    const { slug } = req.params;

    const { rows } = await pool.query(
      `SELECT id, title, slug, description, linkedin_url, location, employment_type,
              experience_min, experience_max
       FROM jobs WHERE lower(slug) = lower($1) AND status = 'PUBLISHED' AND deleted_at IS NULL`,
      [slug]
    );
    const job = rows[0];
    if (!job) {
      throw new AppError('Job not found', 404);
    }

    const questionsResult = await pool.query(
      `SELECT id, question, question_type, required, options, order_index
       FROM job_questions WHERE job_id = $1 ORDER BY order_index ASC, created_at ASC`,
      [job.id]
    );

    res.json({ status: 'ok', job: { ...job, questions: questionsResult.rows } });
  } catch (err) {
    next(err);
  }
}

function validateAnswer(question, answer) {
  const { question_type: type, options, question: label } = question;

  if (type === 'select') {
    const value = answer?.answerText ?? answer?.answerJson;
    if (Array.isArray(options) && options.length > 0 && !options.includes(value)) {
      throw new AppError(`Invalid answer for "${label}": must be one of ${options.join(', ')}`, 400);
    }
  } else if (type === 'multiselect') {
    const values = Array.isArray(answer?.answerJson) ? answer.answerJson : [];
    if (Array.isArray(options) && options.length > 0) {
      const invalid = values.filter((v) => !options.includes(v));
      if (invalid.length > 0) {
        throw new AppError(`Invalid answer(s) for "${label}": ${invalid.join(', ')}`, 400);
      }
    }
  } else if (type === 'boolean') {
    const value = answer?.answerJson;
    if (value !== undefined && value !== null && typeof value !== 'boolean') {
      throw new AppError(`Answer for "${label}" must be true or false`, 400);
    }
  } else if (type === 'number') {
    const value = answer?.answerText;
    if (value !== undefined && value !== null && value !== '' && Number.isNaN(Number(value))) {
      throw new AppError(`Answer for "${label}" must be a number`, 400);
    }
  }
}

function hasAnswerValue(answer) {
  if (!answer) return false;
  if (typeof answer.answerText === 'string' && answer.answerText.trim()) return true;
  if (answer.answerJson !== undefined && answer.answerJson !== null) {
    if (Array.isArray(answer.answerJson)) return answer.answerJson.length > 0;
    return true;
  }
  return false;
}

async function applyToJob(req, res, next) {
  const client = await pool.connect();
  let savedStorageKey = null;

  try {
    const { slug } = req.params;
    assertValidPdf(req.file);

    const { name, email, phone, location, linkedinUrl, githubUrl, portfolioUrl, noticePeriod, currentSalary, expectedSalary, answers } =
      req.body;

    if (!name || !name.trim()) {
      throw new AppError('name is required', 400);
    }
    if (!email || !email.trim()) {
      throw new AppError('email is required', 400);
    }

    let parsedAnswers = [];
    if (answers) {
      try {
        parsedAnswers = JSON.parse(answers);
      } catch (err) {
        throw new AppError('answers must be valid JSON', 400);
      }
      if (!Array.isArray(parsedAnswers)) {
        throw new AppError('answers must be a JSON array', 400);
      }
    }

    await client.query('BEGIN');

    const jobResult = await client.query(
      `SELECT * FROM jobs WHERE lower(slug) = lower($1) AND status = 'PUBLISHED' AND deleted_at IS NULL`,
      [slug]
    );
    const job = jobResult.rows[0];
    if (!job) {
      throw new AppError('Job not found or not accepting applications', 404);
    }

    const questionsResult = await client.query('SELECT * FROM job_questions WHERE job_id = $1', [job.id]);
    const questionsById = new Map(questionsResult.rows.map((q) => [q.id, q]));
    const answersByQuestionId = new Map(parsedAnswers.filter((a) => a && a.questionId).map((a) => [a.questionId, a]));

    for (const question of questionsResult.rows) {
      const answer = answersByQuestionId.get(question.id);
      if (question.required && !hasAnswerValue(answer)) {
        throw new AppError(`Missing required answer for question: ${question.question}`, 400);
      }
      if (answer) {
        validateAnswer(question, answer);
      }
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingCandidate = await client.query(
      'SELECT * FROM candidates WHERE organization_id = $1 AND lower(email) = $2 AND deleted_at IS NULL',
      [job.organization_id, normalizedEmail]
    );

    let candidate;
    if (existingCandidate.rows[0]) {
      const updateResult = await client.query(
        `UPDATE candidates SET
           name = $1, phone = COALESCE($2, phone), location = COALESCE($3, location),
           linkedin_url = COALESCE($4, linkedin_url), github_url = COALESCE($5, github_url),
           portfolio_url = COALESCE($6, portfolio_url), notice_period = COALESCE($7, notice_period),
           current_salary = COALESCE($8, current_salary), expected_salary = COALESCE($9, expected_salary),
           updated_at = now()
         WHERE id = $10
         RETURNING *`,
        [
          name.trim(),
          phone || null,
          location || null,
          linkedinUrl || null,
          githubUrl || null,
          portfolioUrl || null,
          noticePeriod || null,
          currentSalary || null,
          expectedSalary || null,
          existingCandidate.rows[0].id,
        ]
      );
      candidate = updateResult.rows[0];
    } else {
      const insertResult = await client.query(
        `INSERT INTO candidates (
           organization_id, name, email, phone, location, linkedin_url, github_url,
           portfolio_url, notice_period, current_salary, expected_salary
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          job.organization_id,
          name.trim(),
          normalizedEmail,
          phone || null,
          location || null,
          linkedinUrl || null,
          githubUrl || null,
          portfolioUrl || null,
          noticePeriod || null,
          currentSalary || null,
          expectedSalary || null,
        ]
      );
      candidate = insertResult.rows[0];
    }

    const { resume, storageKey } = await saveResumeVersion(client, candidate.id, req.file);
    savedStorageKey = storageKey;

    const appResult = await client.query(
      `INSERT INTO applications (job_id, candidate_id, resume_id, status, source)
       VALUES ($1, $2, $3, 'SUBMITTED', 'PUBLIC_FORM')
       ON CONFLICT (job_id, candidate_id)
       DO UPDATE SET resume_id = EXCLUDED.resume_id, status = 'SUBMITTED', submitted_at = now(), updated_at = now()
       RETURNING *`,
      [job.id, candidate.id, resume.id]
    );
    const application = appResult.rows[0];

    await client.query('DELETE FROM application_answers WHERE application_id = $1', [application.id]);
    for (const answer of parsedAnswers) {
      const question = questionsById.get(answer.questionId);
      if (!question) continue;
      await client.query(
        `INSERT INTO application_answers (application_id, job_question_id, answer_text, answer_json)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [
          application.id,
          answer.questionId,
          answer.answerText ?? null,
          answer.answerJson !== undefined ? JSON.stringify(answer.answerJson) : null,
        ]
      );
    }

    await client.query('COMMIT');

    let processing;
    try {
      await resumeProcessingService.processResume(resume.id);
      processing = { status: 'ok' };
    } catch (err) {
      console.error('Resume AI processing failed for application', application.id, ':', err.message);
      processing = { status: 'failed', message: err.message };
    }

    res.status(201).json({ status: 'ok', applicationId: application.id, processing });
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

module.exports = { getPublicJob, applyToJob };
