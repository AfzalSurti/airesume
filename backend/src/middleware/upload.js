const multer = require('multer');
const { AppError } = require('../utils/AppError');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new AppError('Only PDF files are allowed', 400));
      return;
    }
    cb(null, true);
  },
});

module.exports = { upload };
