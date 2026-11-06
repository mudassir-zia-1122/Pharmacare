/**
 * Wraps an async route handler to catch errors and forward them to Next(error).
 * Avoids repetitive try/catch boilerplate in controllers.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
