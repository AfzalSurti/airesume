const { pool } = require('../config/db');
const storage = require('./storage');
const aiServiceClient = require('./aiServiceClient');

function summarizeEducation(education) {
  if (!Array.isArray(education) || education.length === 0) {
    return null;
  }
  return education
    .map((entry) => [entry.degree, entry.field, entry.institution].filter(Boolean).join(' - '))
    .filter(Boolean)
    .join('; ') || null;
}

async function processResume(resumeId) {
  const { rows } = await pool.query(
    `SELECT id, candidate_id, storage_key, file_name, mime_type, is_active
     FROM resumes WHERE id = $1 AND deleted_at IS NULL`,
    [resumeId]
  );
  const resume = rows[0];
  if (!resume) {
    throw new Error('Resume not found');
  }

  const buffer = await storage.read(resume.storage_key);
  const { raw_text: rawText, profile } = await aiServiceClient.parseResume(
    buffer,
    resume.file_name,
    resume.mime_type
  );

  const embeddingSourceText = [profile.skills.join(', '), rawText].filter(Boolean).join('\n\n').slice(0, 12000);
  const embedding = await aiServiceClient.createEmbedding(embeddingSourceText);
  const embeddingLiteral = `[${embedding.join(',')}]`;

  await pool.query(
    `UPDATE resumes SET raw_text = $1, parsed_profile = $2::jsonb, embedding = $3::vector, updated_at = now()
     WHERE id = $4`,
    [rawText, JSON.stringify(profile), embeddingLiteral, resumeId]
  );

  if (resume.is_active) {
    await pool.query(
      `UPDATE candidates SET
         structured_profile = $1::jsonb,
         total_experience = COALESCE($2, total_experience),
         education_summary = COALESCE($3, education_summary),
         updated_at = now()
       WHERE id = $4`,
      [JSON.stringify(profile), profile.total_experience_years, summarizeEducation(profile.education), resume.candidate_id]
    );
  }

  return { rawText, profile };
}

module.exports = { processResume };
