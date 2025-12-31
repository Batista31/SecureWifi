/**
 * Device Service
 * 
 * Manages device records, blocking, and device-related operations.
 */

const db = require('../config/database.config');
const { securityLog } = require('./logging.service');

/**
 * Get all devices
 */
function getAllDevices(options = {}) {
  const { includeBlocked = true, limit = 100 } = options;
  
  let query = `
    SELECT 
      d.*,
      (SELECT COUNT(*) FROM sessions WHERE device_id = d.id AND is_active = 1) as active_sessions,
      (SELECT MAX(started_at) FROM sessions WHERE device_id = d.id) as last_session
    FROM devices d
  `;
  
  if (!includeBlocked) {
    query += ' WHERE d.is_blocked = 0';
  }
  
  query += ' ORDER BY d.last_seen DESC LIMIT ?';
  
  return db.prepare(query).all(limit);
}

/**
 * Get device by MAC address
 */
function getDeviceByMac(macAddress) {
  return db.prepare(`
    SELECT 
      d.*,
      (SELECT COUNT(*) FROM sessions WHERE device_id = d.id) as total_sessions,
      (SELECT COUNT(*) FROM sessions WHERE device_id = d.id AND is_active = 1) as active_sessions
    FROM devices d
    WHERE d.mac_address = ?
  `).get(macAddress);
}

/**
 * Block a device
 */
function blockDevice(macAddress, reason = 'Blocked by admin') {
  const device = db.prepare('SELECT id FROM devices WHERE mac_address = ?').get(macAddress);
  
  if (!device) {
    return { success: false, message: 'Device not found' };
  }
  
  // Block device
  db.prepare(`
    UPDATE devices SET is_blocked = 1, block_reason = ? WHERE mac_address = ?
  `).run(reason, macAddress);
  
  // Terminate all active sessions
  db.prepare(`
    UPDATE sessions SET is_active = 0, ended_at = CURRENT_TIMESTAMP
    WHERE mac_address = ? AND is_active = 1
  `).run(macAddress);
  
  // Deactivate MAC-IP bindings
  db.prepare(`
    UPDATE mac_ip_bindings SET is_active = 0 WHERE mac_address = ?
  `).run(macAddress);
  
  securityLog.suspiciousActivity(macAddress, null, `Device blocked: ${reason}`);
  
  return { success: true, message: 'Device blocked' };
}

/**
 * Unblock a device
 */
function unblockDevice(macAddress) {
  const result = db.prepare(`
    UPDATE devices SET is_blocked = 0, block_reason = NULL WHERE mac_address = ?
  `).run(macAddress);
  
  return { 
    success: result.changes > 0, 
    message: result.changes > 0 ? 'Device unblocked' : 'Device not found' 
  };
}

/**
 * Update device info
 */
function updateDevice(macAddress, updates) {
  const { hostname, vendor, notes } = updates;
  
  const result = db.prepare(`
    UPDATE devices 
    SET hostname = COALESCE(?, hostname),
        vendor = COALESCE(?, vendor),
        notes = COALESCE(?, notes)
    WHERE mac_address = ?
  `).run(hostname, vendor, notes, macAddress);
  
  return result.changes > 0;
}

/**
 * Get blocked devices
 */
function getBlockedDevices() {
  return db.prepare(`
    SELECT * FROM devices WHERE is_blocked = 1 ORDER BY last_seen DESC
  `).all();
}

/**
 * Get device statistics
 */
function getDeviceStats() {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  return {
    total: db.prepare('SELECT COUNT(*) as count FROM devices').get().count,
    blocked: db.prepare('SELECT COUNT(*) as count FROM devices WHERE is_blocked = 1').get().count,
    activeNow: db.prepare(`
      SELECT COUNT(DISTINCT d.id) as count 
      FROM devices d
      JOIN sessions s ON d.id = s.device_id
      WHERE s.is_active = 1
    `).get().count,
    newLast24h: db.prepare(`
      SELECT COUNT(*) as count FROM devices WHERE first_seen >= ?
    `).get(last24h).count,
  };
}

/**
 * Search devices
 */
function searchDevices(query) {
  const searchTerm = `%${query}%`;
  
  return db.prepare(`
    SELECT 
      d.*,
      (SELECT COUNT(*) FROM sessions WHERE device_id = d.id AND is_active = 1) as active_sessions
    FROM devices d
    WHERE d.mac_address LIKE ? 
       OR d.hostname LIKE ? 
       OR d.vendor LIKE ?
    ORDER BY d.last_seen DESC
    LIMIT 50
  `).all(searchTerm, searchTerm, searchTerm);
}

module.exports = {
  getAllDevices,
  getDeviceByMac,
  blockDevice,
  unblockDevice,
  updateDevice,
  getBlockedDevices,
  getDeviceStats,
  searchDevices,
};
