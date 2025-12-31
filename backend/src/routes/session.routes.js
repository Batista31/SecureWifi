/**
 * Session Routes
 * 
 * Session management endpoints (requires authentication).
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/error.middleware');
const { authenticateToken } = require('../middleware/auth.middleware');
const sessionService = require('../services/session.service');
const authService = require('../services/auth.service');

/**
 * GET /api/sessions/current
 * Get current session info
 */
router.get('/current',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const session = sessionService.getSessionById(req.session.id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const remainingMs = new Date(session.expires_at) - new Date();
    const remainingMinutes = Math.max(0, Math.floor(remainingMs / 60000));
    
    res.json({
      id: session.id,
      macAddress: session.mac_address,
      ipAddress: session.ip_address,
      authMethod: session.auth_method,
      startedAt: session.started_at,
      expiresAt: session.expires_at,
      remainingMinutes,
      username: session.username,
      voucherCode: session.voucher_code,
      bytesUploaded: session.bytes_uploaded,
      bytesDownloaded: session.bytes_downloaded,
    });
  })
);

/**
 * POST /api/sessions/refresh
 * Refresh session token (extends validity)
 */
router.post('/refresh',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // Re-validate and generate new token
    const session = sessionService.getSessionById(req.session.id);
    
    if (!session || !session.is_active) {
      return res.status(401).json({ error: 'Session invalid' });
    }
    
    // Generate new token (same session, new JWT)
    const jwt = require('jsonwebtoken');
    const config = require('../config/app.config');
    
    const newToken = jwt.sign(
      {
        sessionId: session.id,
        macAddress: session.mac_address,
        authMethod: session.auth_method,
      },
      config.security.jwtSecret,
      { expiresIn: config.security.jwtExpiry }
    );
    
    res.json({
      token: newToken,
      expiresAt: session.expires_at,
    });
  })
);

/**
 * DELETE /api/sessions/current
 * End current session (logout)
 */
router.delete('/current',
  authenticateToken,
  asyncHandler(async (req, res) => {
    authService.endSession(req.session.id);
    
    res.json({ success: true, message: 'Session ended' });
  })
);

/**
 * GET /api/sessions/history
 * Get session history for current device
 */
router.get('/history',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const history = sessionService.getSessionHistory(req.session.mac_address);
    
    res.json({
      sessions: history.map(s => ({
        id: s.id,
        authMethod: s.auth_method,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        expiresAt: s.expires_at,
        wasActive: s.is_active,
      })),
    });
  })
);

module.exports = router;
