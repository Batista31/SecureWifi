/**
 * Session Service
 * 
 * Manages active sessions, session queries, and session lifecycle.
 */

const db = require('../config/database.config');
const { securityLog } = require('./logging.service');

/**
 * Get all active sessions
 */
function getActiveSessions() {
  return db.prepare(`
    SELECT 
      s.*,
      d.hostname,
      d.vendor,
      d.is_blocked as device_blocked,
      u.username,
      v.code as voucher_code
    FROM sessions s
    LEFT JOIN devices d ON s.device_id = d.id
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN vouchers v ON s.voucher_id = v.id
    WHERE s.is_active = 1
    ORDER BY s.started_at DESC
  `).all();
}

/**
 * Get session by ID
 */
function getSessionById(sessionId) {
  return db.prepare(`
    SELECT 
      s.*,
      d.hostname,
      d.vendor,
      d.is_blocked as device_blocked,
      u.username,
      v.code as voucher_code
    FROM sessions s
    LEFT JOIN devices d ON s.device_id = d.id
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN vouchers v ON s.voucher_id = v.id
    WHERE s.id = ?
  `).get(sessionId);
}

/**
 * Get session by MAC address
 */
function getSessionByMac(macAddress) {
  return db.prepare(`
    SELECT * FROM sessions 
    WHERE mac_address = ? AND is_active = 1
    ORDER BY started_at DESC
    LIMIT 1
  `).get(macAddress);
}

/**
 * Get session history for a device
 */
function getSessionHistory(macAddress, limit = 20) {
  return db.prepare(`
    SELECT 
      s.*,
      u.username,
      v.code as voucher_code
    FROM sessions s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN vouchers v ON s.voucher_id = v.id
    WHERE s.mac_address = ?
    ORDER BY s.started_at DESC
    LIMIT ?
  `).all(macAddress, limit);
}

/**
 * Get session statistics
 */
function getSessionStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const lastHour = new Date(now - 60 * 60 * 1000).toISOString();
  const last24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  
  return {
    activeSessions: db.prepare(`
      SELECT COUNT(*) as count FROM sessions WHERE is_active = 1
    `).get().count,
    
    totalToday: db.prepare(`
      SELECT COUNT(*) as count FROM sessions WHERE started_at >= ?
    `).get(today).count,
    
    newLastHour: db.prepare(`
      SELECT COUNT(*) as count FROM sessions WHERE started_at >= ?
    `).get(lastHour).count,
    
    uniqueDevicesToday: db.prepare(`
      SELECT COUNT(DISTINCT mac_address) as count FROM sessions WHERE started_at >= ?
    `).get(today).count,
    
    authMethodBreakdown: db.prepare(`
      SELECT auth_method, COUNT(*) as count 
      FROM sessions 
      WHERE started_at >= ?
      GROUP BY auth_method
    `).all(last24h),
    
    hourlyActivity: db.prepare(`
      SELECT 
        strftime('%H', started_at) as hour,
        COUNT(*) as count
      FROM sessions
      WHERE started_at >= ?
      GROUP BY strftime('%H', started_at)
      ORDER BY hour
    `).all(last24h),
    
    peakConcurrent: db.prepare(`
      SELECT MAX(concurrent) as peak FROM (
        SELECT COUNT(*) as concurrent
        FROM sessions
        WHERE started_at >= ?
        GROUP BY strftime('%Y-%m-%d %H', started_at)
      )
    `).get(last24h).peak || 0,
  };
}

/**
 * Disconnect a session (admin action)
 */
function disconnectSession(sessionId, reason = 'Admin disconnected') {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  
  if (!session) {
    return { success: false, message: 'Session not found' };
  }
  
  db.prepare(`
    UPDATE sessions 
    SET is_active = 0, ended_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(sessionId);
  
  db.prepare(`
    UPDATE mac_ip_bindings SET is_active = 0 WHERE session_id = ?
  `).run(sessionId);
  
  securityLog.sessionExpired(sessionId, session.mac_address);
  
  return { success: true, message: 'Session disconnected' };
}

/**
 * Extend a session's duration
 */
function extendSession(sessionId, additionalHours) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  
  if (!session) {
    return { success: false, message: 'Session not found' };
  }
  
  const newExpiry = new Date(
    new Date(session.expires_at).getTime() + additionalHours * 60 * 60 * 1000
  ).toISOString();
  
  db.prepare(`
    UPDATE sessions SET expires_at = ? WHERE id = ?
  `).run(newExpiry, sessionId);
  
  db.prepare(`
    UPDATE mac_ip_bindings SET expires_at = ? WHERE session_id = ?
  `).run(newExpiry, sessionId);
  
  return { success: true, newExpiry, message: 'Session extended' };
}

/**
 * Check if a MAC address has an active session
 */
function hasActiveSession(macAddress) {
  const session = db.prepare(`
    SELECT id FROM sessions 
    WHERE mac_address = ? AND is_active = 1 AND expires_at > datetime('now')
    LIMIT 1
  `).get(macAddress);
  
  return !!session;
}

/**
 * Get all MAC-IP bindings
 */
function getActiveBindings() {
  return db.prepare(`
    SELECT 
      b.*,
      s.auth_method,
      s.started_at as session_started
    FROM mac_ip_bindings b
    LEFT JOIN sessions s ON b.session_id = s.id
    WHERE b.is_active = 1
    ORDER BY b.created_at DESC
  `).all();
}

module.exports = {
  getActiveSessions,
  getSessionById,
  getSessionByMac,
  getSessionHistory,
  getSessionStats,
  disconnectSession,
  extendSession,
  hasActiveSession,
  getActiveBindings,
};
