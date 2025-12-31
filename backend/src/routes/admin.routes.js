/**
 * Admin Routes
 * 
 * Admin dashboard API endpoints.
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/error.middleware');
const { authenticateAdmin, loginAdmin } = require('../middleware/auth.middleware');
const { validationRules, handleValidation } = require('../middleware/validation.middleware');
const sessionService = require('../services/session.service');
const deviceService = require('../services/device.service');
const voucherService = require('../services/voucher.service');
const { getLogs, getLogStats } = require('../services/logging.service');

/**
 * POST /api/admin/login
 * Admin authentication
 */
router.post('/login',
  validationRules.adminLogin,
  handleValidation,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    const result = await loginAdmin(username, password);
    
    if (!result.success) {
      return res.status(401).json({ error: result.message });
    }
    
    res.json({
      success: true,
      token: result.token,
      admin: result.admin,
    });
  })
);

// ================================
// Protected Admin Routes
// ================================

/**
 * GET /api/admin/dashboard
 * Get dashboard overview data
 */
router.get('/dashboard',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const sessionStats = sessionService.getSessionStats();
    const deviceStats = deviceService.getDeviceStats();
    const voucherStats = voucherService.getVoucherStats();
    const logStats = getLogStats(24);
    
    res.json({
      sessions: sessionStats,
      devices: deviceStats,
      vouchers: voucherStats,
      events: {
        total: logStats.totalEvents,
        byCategory: logStats.byCategory,
        bySeverity: logStats.bySeverity,
        recentErrors: logStats.recentErrors,
      },
      serverInfo: {
        mode: process.env.SECURITY_MODE || 'simulation',
        uptime: process.uptime(),
        nodeVersion: process.version,
      },
    });
  })
);

// ================================
// Session Management
// ================================

/**
 * GET /api/admin/sessions
 * Get all active sessions
 */
router.get('/sessions',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const sessions = sessionService.getActiveSessions();
    res.json({ sessions });
  })
);

/**
 * GET /api/admin/sessions/:id
 * Get session details
 */
router.get('/sessions/:id',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const session = sessionService.getSessionById(parseInt(req.params.id));
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({ session });
  })
);

/**
 * DELETE /api/admin/sessions/:id
 * Disconnect a session
 */
router.delete('/sessions/:id',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const result = sessionService.disconnectSession(parseInt(req.params.id));
    
    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }
    
    res.json(result);
  })
);

/**
 * POST /api/admin/sessions/:id/extend
 * Extend a session
 */
router.post('/sessions/:id/extend',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const { hours = 1 } = req.body;
    const result = sessionService.extendSession(parseInt(req.params.id), hours);
    
    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }
    
    res.json(result);
  })
);

// ================================
// Device Management
// ================================

/**
 * GET /api/admin/devices
 * Get all devices
 */
router.get('/devices',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const devices = deviceService.getAllDevices();
    res.json({ devices });
  })
);

/**
 * GET /api/admin/devices/blocked
 * Get blocked devices
 */
router.get('/devices/blocked',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const devices = deviceService.getBlockedDevices();
    res.json({ devices });
  })
);

/**
 * GET /api/admin/devices/:mac
 * Get device details
 */
router.get('/devices/:mac',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const device = deviceService.getDeviceByMac(req.params.mac);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const history = sessionService.getSessionHistory(req.params.mac);
    
    res.json({ device, history });
  })
);

/**
 * POST /api/admin/devices/:mac/block
 * Block a device
 */
router.post('/devices/:mac/block',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const result = deviceService.blockDevice(req.params.mac, reason);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    res.json(result);
  })
);

/**
 * POST /api/admin/devices/:mac/unblock
 * Unblock a device
 */
router.post('/devices/:mac/unblock',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const result = deviceService.unblockDevice(req.params.mac);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    res.json(result);
  })
);

/**
 * GET /api/admin/devices/search
 * Search devices
 */
router.get('/devices/search/:query',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const devices = deviceService.searchDevices(req.params.query);
    res.json({ devices });
  })
);

// ================================
// Voucher Management
// ================================

/**
 * GET /api/admin/vouchers
 * Get all vouchers
 */
router.get('/vouchers',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const includeUsed = req.query.includeUsed !== 'false';
    const vouchers = voucherService.getAllVouchers({ includeUsed });
    res.json({ vouchers });
  })
);

/**
 * POST /api/admin/vouchers
 * Create new vouchers
 */
router.post('/vouchers',
  authenticateAdmin,
  validationRules.createVouchers,
  handleValidation,
  asyncHandler(async (req, res) => {
    const { count = 1, durationHours, maxDevices, notes } = req.body;
    
    const vouchers = voucherService.createVouchers(count, {
      durationHours,
      maxDevices,
      notes,
      createdBy: req.admin.username,
    });
    
    res.status(201).json({
      success: true,
      count: vouchers.length,
      vouchers,
    });
  })
);

/**
 * DELETE /api/admin/vouchers/:id
 * Deactivate a voucher
 */
router.delete('/vouchers/:id',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const success = voucherService.deactivateVoucher(parseInt(req.params.id));
    
    if (!success) {
      return res.status(404).json({ error: 'Voucher not found' });
    }
    
    res.json({ success: true, message: 'Voucher deactivated' });
  })
);

// ================================
// Logs
// ================================

/**
 * GET /api/admin/logs
 * Get event logs
 */
router.get('/logs',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const { category, severity, limit = 100, offset = 0 } = req.query;
    
    const logs = getLogs({
      category,
      severity,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    
    res.json({ logs });
  })
);

/**
 * GET /api/admin/logs/stats
 * Get log statistics
 */
router.get('/logs/stats',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const hours = parseInt(req.query.hours) || 24;
    const stats = getLogStats(hours);
    res.json({ stats });
  })
);

// ================================
// Settings Management
// ================================

// In-memory settings (would be in database in production)
let systemSettings = {
  session_timeout: 3600,
  max_devices_per_user: 3,
  session_extension_allowed: true,
  portal_title: 'WiFi Access',
  portal_welcome_message: 'Welcome to our network',
  terms_required: true,
  sms_auth_enabled: true,
  voucher_auth_enabled: true,
  social_auth_enabled: false,
  firewall_simulation_mode: true,
  client_isolation: true,
  mac_binding_enabled: true,
  auto_block_suspicious: false,
  auth_rate_limit: 5,
  auth_rate_window: 300,
  log_retention_days: 30,
  session_cleanup_interval: 3600,
};

/**
 * GET /api/admin/settings
 * Get system settings
 */
router.get('/settings',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    res.json(systemSettings);
  })
);

/**
 * PUT /api/admin/settings
 * Update system settings
 */
router.put('/settings',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    systemSettings = { ...systemSettings, ...req.body };
    res.json({ success: true, settings: systemSettings });
  })
);

/**
 * GET /api/admin/me
 * Get current admin user info
 */
router.get('/me',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    res.json({
      id: req.admin.id,
      username: req.admin.username,
      role: req.admin.role || 'admin',
    });
  })
);

// ================================
// Monitoring Stats
// ================================

/**
 * GET /api/admin/monitoring/stats
 * Get real-time monitoring statistics
 */
router.get('/monitoring/stats',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const sessionStats = sessionService.getSessionStats();
    const deviceStats = deviceService.getDeviceStats();
    const voucherStats = voucherService.getVoucherStats();
    
    // Generate time series data for charts
    const now = new Date();
    const sessionsOverTime = [];
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now - i * 3600000);
      sessionsOverTime.push({
        time: time.toISOString(),
        hour: time.getHours(),
        sessions: Math.floor(Math.random() * sessionStats.active + 1), // Simulated data
      });
    }
    
    res.json({
      sessions: sessionStats,
      devices: deviceStats,
      vouchers: voucherStats,
      sessionsOverTime,
      authMethods: {
        sms: sessionStats.active > 0 ? Math.floor(sessionStats.active * 0.6) : 0,
        voucher: sessionStats.active > 0 ? Math.floor(sessionStats.active * 0.35) : 0,
        social: sessionStats.active > 0 ? Math.floor(sessionStats.active * 0.05) : 0,
      },
    });
  })
);

/**
 * GET /api/admin/activity/recent
 * Get recent activity events
 */
router.get('/activity/recent',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const logs = getLogs({ limit: 10 });
    const activities = logs.map(log => ({
      id: log.id,
      type: log.event_type,
      description: `${log.event_category}: ${log.event_type}`,
      time: log.created_at,
      details: log.details,
    }));
    res.json({ activities });
  })
);

// ================================
// MAC-IP Bindings
// ================================

/**
 * GET /api/admin/bindings
 * Get active MAC-IP bindings
 */
router.get('/bindings',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const bindings = sessionService.getActiveBindings();
    res.json({ bindings });
  })
);

module.exports = router;
