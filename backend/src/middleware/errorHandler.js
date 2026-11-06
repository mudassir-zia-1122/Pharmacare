import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  let error = err;

  // Log error on server with request context
  logger.error(err.message || 'Unhandled error', {
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  // Handle MySQL specific error codes safely
  if (err.code === 'ER_DUP_ENTRY') {
    error = ApiError.conflict('A record with this unique identifier already exists');
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    error = ApiError.badRequest('Referenced record does not exist or cannot be deleted due to existing relationships');
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    error = new ApiError(503, 'Database server is currently unavailable. Please verify MySQL service is running.');
  } else if (err.sqlState === '45000') {
    // Custom SQL trigger error (e.g. Pharmacy safety trigger thrown)
    error = ApiError.badRequest(err.message || 'Operation rejected by pharmacy safety rules');
  }

  // Convert generic Error into ApiError
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred. Please contact system administrator.'
      : error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, [], err.stack);
  }

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    ...(error.errors?.length > 0 && { errors: error.errors }),
  };

  res.status(error.statusCode).json(response);
}

export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Endpoint not found: ${req.method} ${req.originalUrl}`));
}
