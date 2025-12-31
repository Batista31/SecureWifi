/**
 * Portal Routes
 * 
 * Public API routes for captive portal pages.
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/error.middleware');
const { extractClientInfo } = require('../middleware/portal.middleware');
const { hasActiveSession } = require('../services/session.service');
const { getSessionByMac } = require('../services/session.service');

/**
 * GET /api/portal/status
 * Check if current device is authenticated
 */
router.get('/status',
  extractClientInfo,
  asyncHandler(async (req, res) => {
    const macAddress = req.headers['x-client-mac'] || req.clientMac;
    const session = getSessionByMac(macAddress);
    
    if (session && session.is_active) {
      const remainingMs = new Date(session.expires_at) - new Date();
      const remainingMinutes = Math.max(0, Math.floor(remainingMs / 60000));
      
      return res.json({
        authenticated: true,
        sessionId: session.id,
        macAddress: session.mac_address,
        ipAddress: session.ip_address,
        authMethod: session.auth_method,
        startedAt: session.started_at,
        expiresAt: session.expires_at,
        remainingMinutes,
      });
    }
    
    res.json({
      authenticated: false,
      clientMac: macAddress,
      clientIp: req.clientIp,
    });
  })
);

/**
 * GET /api/portal/info
 * Get portal information for display
 */
router.get('/info', (req, res) => {
  res.json({
    name: process.env.PORTAL_NAME || 'WiFi Access Portal',
    description: 'Secure Public WiFi Access',
    authMethods: ['voucher', 'login'],
    registrationEnabled: true,
    sessionDurationHours: parseInt(process.env.SESSION_DURATION_HOURS) || 4,
    maxDevicesPerUser: parseInt(process.env.MAX_DEVICES_PER_USER) || 2,
    termsUrl: '/portal/terms.html',
    supportEmail: 'support@example.com',
  });
});

/**
 * GET /api/portal/client-info
 * Get detected client information (for debugging/display)
 */
router.get('/client-info',
  extractClientInfo,
  (req, res) => {
    res.json({
      macAddress: req.clientMac,
      ipAddress: req.clientIp,
      userAgent: req.headers['user-agent'],
      // In production, additional info would be available
      simulationMode: process.env.SECURITY_MODE !== 'production',
    });
  }
);

module.exports = router;
