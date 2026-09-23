const { pool } = require('../config/db');
const aiServiceClient = require('./aiServiceClient');

const EVAL_CONCURRENCY = 5;
const EXPERIENCE_SLACK_YEARS = 1;

function buildJdEmbeddingText(jd, jdText) {
  const parts = [jd.job_title, jd.required_skills.join(', '), jd.preferred_skills.join(', '), jdText].filter(
    Boolean
  );
  return parts.join('\n\n').slice(0, 12000);
}

function passesHardFilter(candidate, jd) {
  if (jd.required_experience_years != null && candidate.total_experience != null) {
    const experience = Number(candidate.total_experience);
    if (!Number.isNaN(experience) && experience < jd.required_experience_years - EXPERIENCE_SLACK_YEARS) {
      return false;
    }
  }
  return true;
}

async function evaluateCandidates(candidates, structuredJd, jdText) {
  const results = [];
  for (let i = 0; i < candidates.length; i += EVAL_CONCURRENCY) {
    const batch = candidates.slice(i, i + EVAL_CONCURRENCY);
    // eslint-disable-next-line no-await-in-loop
    const batchResults = await Promise.all(
      batch.map(async (candidate) => {
        try {
          const evaluation = await aiServiceClient.evaluateCandidate({
            jd: structuredJd,
            jdText,
            candidateProfile: candidate.parsed_profile,
            resumeText: candidate.raw_text,
          });
          return { candidate, evaluation };
        } catch (err) {
          console.error(`Evaluation failed for candidate ${candidate.candidate_id}:`, err.message);
          return null;
        }
      })
    );
    results.push(...batchResults.filter(Boolean));
  }
  return results;
}

async function searchCandidatePool(organizationId, { jdText, retrievalLimit, topLimit }) {
  const structuredJd = await aiServiceClient.parseJd(jdText);

  const jdEmbeddingText = buildJdEmbeddingText(structuredJd, jdText);
  const jdEmbedding = await aiServiceClient.createEmbedding(jdEmbeddingText);
  const jdEmbeddingLiteral = `[${jdEmbedding.join(',')}]`;

  const { rows: candidates } = await pool.query(
    `SELECT c.id AS candidate_id, c.name, c.email, c.total_experience,
            r.id AS resume_id, r.raw_text, r.parsed_profile,
            1 - (r.embedding <=> $1::vector) AS similarity
     FROM resumes r
     JOIN candidates c ON c.id = r.candidate_id
     WHERE c.organization_id = $2
       AND c.deleted_at IS NULL
       AND r.deleted_at IS NULL
       AND r.is_active = true
       AND r.embedding IS NOT NULL
     ORDER BY r.embedding <=> $1::vector
     LIMIT $3`,
    [jdEmbeddingLiteral, organizationId, retrievalLimit]
  );

  if (candidates.length === 0) {
    return { structuredJd, totalCandidatesConsidered: 0, totalAfterHardFilter: 0, results: [] };
  }

  const filtered = candidates.filter((candidate) => passesHardFilter(candidate, structuredJd));

  const evaluated = await evaluateCandidates(filtered, structuredJd, jdText);

  const ranked = evaluated
    .sort((a, b) => b.evaluation.overall_score - a.evaluation.overall_score)
    .slice(0, topLimit)
    .map(({ candidate, evaluation }) => ({
      candidateId: candidate.candidate_id,
      resumeId: candidate.resume_id,
      name: candidate.name,
      email: candidate.email,
      totalExperience: candidate.total_experience,
      vectorSimilarity: Number(candidate.similarity),
      ...evaluation,
    }));

  return {
    structuredJd,
    totalCandidatesConsidered: candidates.length,
    totalAfterHardFilter: filtered.length,
    results: ranked,
  };
}

module.exports = { searchCandidatePool };
