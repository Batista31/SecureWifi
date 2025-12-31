/**
 * Monitoring Routes
 * 
 * Real-time monitoring and statistics endpoints.
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/error.middleware');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const sessionService = require('../services/session.service');
const deviceService = require('../services/device.service');
const { cleanupExpiredSessions } = require('../services/database.service');

/**
 * GET /api/monitoring/realtime
 * Get real-time statistics (for dashboard polling)
 */
router.get('/realtime',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const stats = sessionService.getSessionStats();
    const activeSessions = sessionService.getActiveSessions();
    
    res.json({
      timestamp: new Date().toISOString(),
      activeSessions: stats.activeSessions,
      sessions: activeSessions.map(s => ({
        id: s.id,
        macAddress: s.mac_address,
        ipAddress: s.ip_address,
        authMethod: s.auth_method,
        startedAt: s.started_at,
        expiresAt: s.expires_at,
        hostname: s.hostname,
        username: s.username,
      })),
      stats: {
        newLastHour: stats.newLastHour,
        uniqueDevicesToday: stats.uniqueDevicesToday,
        peakConcurrent: stats.peakConcurrent,
      },
    });
  })
);

/**
 * GET /api/monitoring/activity
 * Get hourly activity data for charts
 */
router.get('/activity',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const stats = sessionService.getSessionStats();
    
    res.json({
      hourlyActivity: stats.hourlyActivity,
      authMethodBreakdown: stats.authMethodBreakdown,
    });
  })
);

/**
 * POST /api/monitoring/cleanup
 * Trigger manual cleanup of expired sessions
 */
router.post('/cleanup',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const cleaned = cleanupExpiredSessions();
    
    res.json({
      success: true,
      cleanedSessions: cleaned,
      message: `Cleaned up ${cleaned} expired sessions`,
    });
  })
);

/**
 * GET /api/monitoring/health
 * System health check (can be public for load balancers)
 */
router.get('/health', (req, res) => {
  const stats = sessionService.getSessionStats();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeSessions: stats.activeSessions,
    mode: process.env.SECURITY_MODE || 'simulation',
  });
});

module.exports = router;
