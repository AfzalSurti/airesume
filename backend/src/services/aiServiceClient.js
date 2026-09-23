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

module.exports = { parseResume, createEmbedding };
