/**
 * Authentication Routes
 * 
 * Handles user authentication via voucher codes and credentials.
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/error.middleware');
const { validationRules, handleValidation } = require('../middleware/validation.middleware');
const { extractClientInfo } = require('../middleware/portal.middleware');
const authService = require('../services/auth.service');

/**
 * POST /api/auth/voucher
 * Authenticate with a voucher code
 */
router.post('/voucher',
  extractClientInfo,
  validationRules.voucherAuth,
  handleValidation,
  asyncHandler(async (req, res) => {
    const { code } = req.body;
    const macAddress = req.headers['x-client-mac'] || req.clientMac;
    const ipAddress = req.clientIp;
    
    const result = await authService.authenticateWithVoucher(code, macAddress, ipAddress);
    
    if (!result.success) {
      return res.status(401).json({ error: result.message });
    }
    
    res.json({
      success: true,
      token: result.token,
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
      message: result.message,
    });
  })
);

/**
 * POST /api/auth/login
 * Authenticate with username/password
 */
router.post('/login',
  extractClientInfo,
  validationRules.userLogin,
  handleValidation,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const macAddress = req.headers['x-client-mac'] || req.clientMac;
    const ipAddress = req.clientIp;
    
    const result = await authService.authenticateWithCredentials(
      username, password, macAddress, ipAddress
    );
    
    if (!result.success) {
      return res.status(401).json({ error: result.message });
    }
    
    res.json({
      success: true,
      token: result.token,
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
      message: result.message,
    });
  })
);

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register',
  validationRules.userRegister,
  handleValidation,
  asyncHandler(async (req, res) => {
    const { username, password, email, phone } = req.body;
    
    const result = await authService.registerUser({ username, password, email, phone });
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    res.status(201).json({
      success: true,
      userId: result.userId,
      message: result.message,
    });
  })
);

/**
 * POST /api/auth/validate
 * Validate a session token
 */
router.post('/validate',
  asyncHandler(async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1] || req.body.token;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    const result = authService.validateSession(token);
    
    res.json({
      valid: result.valid,
      session: result.valid ? {
        id: result.session.id,
        macAddress: result.session.mac_address,
        expiresAt: result.session.expires_at,
        authMethod: result.session.auth_method,
      } : null,
      message: result.message,
    });
  })
);

/**
 * POST /api/auth/logout
 * End current session
 */
router.post('/logout',
  asyncHandler(async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    const result = authService.validateSession(token);
    
    if (result.valid) {
      authService.endSession(result.session.id);
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
  })
);

module.exports = router;
