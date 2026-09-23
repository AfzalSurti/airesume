function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (err.name === 'MulterError' ? 400 : 500);

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({ status: 'error', message: err.message || 'Internal server error' });
}

module.exports = { errorHandler };
