const { pool } = require('../config/db');
const aiServiceClient = require('./aiServiceClient');
const resumeProcessingService = require('./resumeProcessingService');
const { buildJdEmbeddingText } = require('./matchingService');
const { AppError } = require('../utils/AppError');

const EVAL_CONCURRENCY = 5;
const AI_MODEL_LABEL = 'gpt-4o-mini';

async function screenJob(jobId, organizationId) {
  const jobResult = await pool.query('SELECT * FROM jobs WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL', [
    jobId,
    organizationId,
  ]);
  const job = jobResult.rows[0];
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const structuredJd = job.structured_requirements || {
    job_title: job.title,
    required_skills: [],
    preferred_skills: [],
  };
  const jdEmbeddingText = buildJdEmbeddingText(structuredJd, job.description);
  const jdEmbedding = await aiServiceClient.createEmbedding(jdEmbeddingText);
  const jdEmbeddingLiteral = `[${jdEmbedding.join(',')}]`;

  const applicationsResult = await pool.query(
    `SELECT a.id AS application_id, a.candidate_id, a.resume_id,
            r.raw_text, r.parsed_profile, r.embedding
     FROM applications a
     JOIN candidates c ON c.id = a.candidate_id
     LEFT JOIN resumes r ON r.id = a.resume_id
     WHERE a.job_id = $1`,
    [jobId]
  );

  const results = [];
  for (let i = 0; i < applicationsResult.rows.length; i += EVAL_CONCURRENCY) {
    const batch = applicationsResult.rows.slice(i, i + EVAL_CONCURRENCY);
    // eslint-disable-next-line no-await-in-loop
    const batchResults = await Promise.all(
      batch.map(async (application) => {
        try {
          if (!application.resume_id) {
            return null;
          }

          let { raw_text: rawText, parsed_profile: parsedProfile, embedding } = application;
          if (!embedding) {
            const processed = await resumeProcessingService.processResume(application.resume_id);
            rawText = processed.rawText;
            parsedProfile = processed.profile;
          }

          const similarityResult = await pool.query(
            'SELECT 1 - (embedding <=> $1::vector) AS similarity FROM resumes WHERE id = $2',
            [jdEmbeddingLiteral, application.resume_id]
          );
          const vectorSimilarity = similarityResult.rows[0]?.similarity ?? null;

          const evaluation = await aiServiceClient.evaluateCandidate({
            jd: structuredJd,
            jdText: job.description,
            candidateProfile: parsedProfile,
            resumeText: rawText,
          });

          const upserted = await pool.query(
            `INSERT INTO screening_results (
               job_id, candidate_id, application_id, resume_id, vector_similarity,
               overall_score, skills_score, experience_score, education_score,
               matched_skills, missing_skills, strengths, concerns, experience_analysis,
               evidence, recommendation, ai_model
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15::jsonb, $16, $17)
             ON CONFLICT (job_id, candidate_id) DO UPDATE SET
               application_id = EXCLUDED.application_id,
               resume_id = EXCLUDED.resume_id,
               vector_similarity = EXCLUDED.vector_similarity,
               overall_score = EXCLUDED.overall_score,
               skills_score = EXCLUDED.skills_score,
               experience_score = EXCLUDED.experience_score,
               education_score = EXCLUDED.education_score,
               matched_skills = EXCLUDED.matched_skills,
               missing_skills = EXCLUDED.missing_skills,
               strengths = EXCLUDED.strengths,
               concerns = EXCLUDED.concerns,
               experience_analysis = EXCLUDED.experience_analysis,
               evidence = EXCLUDED.evidence,
               recommendation = EXCLUDED.recommendation,
               ai_model = EXCLUDED.ai_model,
               updated_at = now()
             RETURNING *`,
            [
              jobId,
              application.candidate_id,
              application.application_id,
              application.resume_id,
              vectorSimilarity,
              evaluation.overall_score,
              evaluation.skills_score,
              evaluation.experience_score,
              evaluation.education_score,
              JSON.stringify(evaluation.matched_skills),
              JSON.stringify(evaluation.missing_required_skills),
              JSON.stringify(evaluation.strengths),
              JSON.stringify(evaluation.concerns),
              evaluation.experience_analysis,
              JSON.stringify(evaluation.evidence),
              evaluation.recommendation,
              AI_MODEL_LABEL,
            ]
          );

          return upserted.rows[0];
        } catch (err) {
          console.error(`Screening failed for application ${application.application_id}:`, err.message);
          return null;
        }
      })
    );
    results.push(...batchResults.filter(Boolean));
  }

  return results;
}

module.exports = { screenJob };
