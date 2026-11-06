export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - User-facing safe error message
   * @param {Array} errors - Optional field-level validation errors
   * @param {string} stack - Optional custom stack trace
   */
  constructor(statusCode, message = 'Internal Server Error', errors = [], stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.success = false;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message, errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Access forbidden: Insufficient permissions') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Requested resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Resource conflict or duplicate entry') {
    return new ApiError(409, message);
  }

  static unprocessable(message = 'Validation failed', errors = []) {
    return new ApiError(422, message, errors);
  }

  static internal(message = 'An unexpected server error occurred') {
    return new ApiError(500, message);
  }
}
