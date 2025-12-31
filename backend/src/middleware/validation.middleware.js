/**
 * Validation Middleware
 * 
 * Request validation using express-validator.
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  
  next();
}

/**
 * Validation rules for different endpoints
 */
const validationRules = {
  // Voucher authentication
  voucherAuth: [
    body('code')
      .notEmpty().withMessage('Voucher code is required')
      .isLength({ min: 4, max: 20 }).withMessage('Invalid voucher code format')
      .trim()
      .toUpperCase(),
  ],
  
  // User login
  userLogin: [
    body('username')
      .notEmpty().withMessage('Username is required')
      .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
      .trim(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
  ],
  
  // User registration
  userRegister: [
    body('username')
      .notEmpty().withMessage('Username is required')
      .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
      .trim(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('email')
      .optional()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('phone')
      .optional()
      .isMobilePhone('any').withMessage('Invalid phone number'),
  ],
  
  // Admin login
  adminLogin: [
    body('username')
      .notEmpty().withMessage('Username is required')
      .trim(),
    body('password')
      .notEmpty().withMessage('Password is required'),
  ],
  
  // Create vouchers
  createVouchers: [
    body('count')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Count must be 1-100'),
    body('durationHours')
      .optional()
      .isInt({ min: 1, max: 720 }).withMessage('Duration must be 1-720 hours'),
    body('maxDevices')
      .optional()
      .isInt({ min: 1, max: 10 }).withMessage('Max devices must be 1-10'),
  ],
  
  // MAC address parameter
  macAddress: [
    param('mac')
      .matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)
      .withMessage('Invalid MAC address format'),
  ],
  
  // Session ID parameter
  sessionId: [
    param('id')
      .isInt({ min: 1 }).withMessage('Invalid session ID'),
  ],
  
  // Pagination
  pagination: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 500 }).withMessage('Limit must be 1-500'),
    query('offset')
      .optional()
      .isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  ],
};

module.exports = {
  handleValidation,
  validationRules,
};
