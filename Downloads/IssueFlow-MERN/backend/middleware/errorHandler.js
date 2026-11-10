function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: 'Validation failed.', errors: err.errors });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate value.', keyValue: err.keyValue });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid identifier.' });
  }

  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Internal server error.' });
}

module.exports = { notFound, errorHandler };
