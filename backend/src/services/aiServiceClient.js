const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function parseResume(buffer, fileName, mimeType) {
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: mimeType }), fileName);

  const res = await fetch(`${AI_SERVICE_URL}/ai/parse-resume`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI service parse-resume failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function createEmbedding(text) {
  const res = await fetch(`${AI_SERVICE_URL}/ai/create-embedding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI service create-embedding failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.embedding;
}

async function parseJd(text) {
  const res = await fetch(`${AI_SERVICE_URL}/ai/parse-jd`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI service parse-jd failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.jd;
}

async function evaluateCandidate({ jd, jdText, candidateProfile, resumeText }) {
  const res = await fetch(`${AI_SERVICE_URL}/ai/evaluate-candidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jd,
      jd_text: jdText,
      candidate_profile: candidateProfile,
      resume_text: resumeText,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI service evaluate-candidate failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.evaluation;
}

module.exports = { parseResume, createEmbedding, parseJd, evaluateCandidate };
