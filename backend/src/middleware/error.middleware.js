/**
 * Error Handling Middleware
 * 
 * Centralized error handling for the application.
 */

const { logEvent, Severity, EventCategory } = require('../services/logging.service');

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

/**
 * Error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logEvent(
    EventCategory.SYSTEM,
    'ERROR',
    {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    },
    err.statusCode >= 500 ? Severity.ERROR : Severity.WARNING
  );
  
  // Determine status code
  const statusCode = err.statusCode || 500;
  
  // Send error response
  const response = {
    error: err.message || 'Internal server error',
    status: statusCode,
  };
  
  // Include details in development mode
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    if (err.details) {
      response.details = err.details;
    }
  }
  
  res.status(statusCode).json(response);
}

/**
 * Async handler wrapper - catches async errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler
 */
function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.path}`));
}

module.exports = {
  ApiError,
  errorHandler,
  asyncHandler,
  notFoundHandler,
};
