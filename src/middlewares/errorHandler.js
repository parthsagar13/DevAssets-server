const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

const notFoundHandler = (req, res, next) => {
  return ApiResponse.error(res, `Route ${req.originalUrl} not found`, 404);
};

const errorHandler = (err, req, res, next) => {
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.user?.id
  });

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    return ApiResponse.error(res, 'Validation failed', 400, errors);
  }

  if (err.name === 'UnauthorizedError') {
    return ApiResponse.error(res, 'Invalid token', 401);
  }

  if (err.code === '23505') {
    return ApiResponse.error(res, 'Resource already exists', 409);
  }

  if (err.code === '23503') {
    return ApiResponse.error(res, 'Referenced resource not found', 400);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  return ApiResponse.error(res, message, statusCode);
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  notFoundHandler,
  errorHandler,
  asyncHandler
};
