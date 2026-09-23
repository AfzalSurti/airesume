const { AppError } = require('./AppError');

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

module.exports = { assertValidPdf };
