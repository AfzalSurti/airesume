const crypto = require('crypto');
const path = require('path');
const storage = require('./storage');

async function saveResumeVersion(client, candidateId, file) {
  const versionResult = await client.query(
    'SELECT COALESCE(MAX(version), 0) AS max_version FROM resumes WHERE candidate_id = $1',
    [candidateId]
  );
  const nextVersion = versionResult.rows[0].max_version + 1;

  await client.query('UPDATE resumes SET is_active = false WHERE candidate_id = $1 AND is_active = true', [
    candidateId,
  ]);

  const ext = path.extname(file.originalname) || '.pdf';
  const storageKey = `resumes/${candidateId}/${crypto.randomUUID()}${ext}`;
  await storage.save(file.buffer, storageKey);

  const { rows } = await client.query(
    `INSERT INTO resumes (candidate_id, storage_key, file_name, mime_type, file_size, version, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING *`,
    [candidateId, storageKey, file.originalname, file.mimetype, file.size, nextVersion]
  );

  return { resume: rows[0], storageKey };
}

module.exports = { saveResumeVersion };
