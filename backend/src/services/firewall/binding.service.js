/**
 * MAC/IP Binding Service
 * 
 * Manages the binding between MAC addresses and IP addresses.
 * This is a critical security component that:
 * 1. Tracks which IP is assigned to which MAC
 * 2. Validates that traffic sources match their bindings
 * 3. Detects and reports binding violations (spoofing attempts)
 * 
 * WHY MAC/IP BINDING?
 * Without binding, an attacker could:
 * - Spoof their IP to match another authenticated user
 * - Claim an IP they weren't assigned via DHCP
 * - Hijack sessions by impersonating other devices
 * 
 * The binding table is populated when:
 * - DHCP assigns an IP to a MAC (in production)
 * - A user authenticates (MAC is bound to their current IP)
 * - Admin manually creates a binding
 */

const db = require('../../config/database.config');
const { securityLog, EventCategory, Severity, logEvent } = require('../logging.service');
const firewallConfig = require('../../config/firewall.config');

/**
 * Create or update a MAC/IP binding
 */
function createBinding(macAddress, ipAddress, sessionId, expiresAt = null) {
  const normalizedMac = normalizeMac(macAddress);
  
  try {
    // Check for existing binding with different IP
    const existingBinding = db.prepare(`
      SELECT * FROM mac_ip_bindings 
      WHERE mac_address = ? AND is_active = 1 AND ip_address != ?
    `).get(normalizedMac, ipAddress);
    
    if (existingBinding) {
      // Log potential issue - MAC changed IP
      logEvent(EventCategory.SECURITY, 'MAC_IP_CHANGE', {
        macAddress: normalizedMac,
        oldIp: existingBinding.ip_address,
        newIp: ipAddress,
        sessionId,
      }, Severity.WARNING);
      
      // Deactivate old binding
      db.prepare(`
        UPDATE mac_ip_bindings SET is_active = 0 WHERE id = ?
      `).run(existingBinding.id);
    }
    
    // Check for existing binding with different MAC for same IP
    const ipConflict = db.prepare(`
      SELECT * FROM mac_ip_bindings 
      WHERE ip_address = ? AND is_active = 1 AND mac_address != ?
    `).get(ipAddress, normalizedMac);
    
    if (ipConflict) {
      // This is suspicious - two MACs claiming same IP
      logEvent(EventCategory.SECURITY, 'IP_CONFLICT', {
        ipAddress,
        existingMac: ipConflict.mac_address,
        newMac: normalizedMac,
        sessionId,
      }, Severity.WARNING);
      
      // Deactivate conflicting binding
      db.prepare(`
        UPDATE mac_ip_bindings SET is_active = 0 WHERE id = ?
      `).run(ipConflict.id);
    }
    
    // Create new binding
    const result = db.prepare(`
      INSERT OR REPLACE INTO mac_ip_bindings 
      (mac_address, ip_address, session_id, expires_at, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(normalizedMac, ipAddress, sessionId, expiresAt);
    
    console.log(`[BINDING] Created: ${normalizedMac} -> ${ipAddress}`);
    
    return {
      success: true,
      bindingId: result.lastInsertRowid,
      macAddress: normalizedMac,
      ipAddress,
    };
  } catch (error) {
    console.error('Failed to create binding:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate a MAC/IP pair against known bindings
 */
function validateBinding(macAddress, ipAddress) {
  const normalizedMac = normalizeMac(macAddress);
  
  const binding = db.prepare(`
    SELECT * FROM mac_ip_bindings 
    WHERE mac_address = ? AND is_active = 1
  `).get(normalizedMac);
  
  if (!binding) {
    // No binding exists for this MAC
    return {
      valid: false,
      reason: 'NO_BINDING',
      message: `No active binding for MAC ${normalizedMac}`,
    };
  }
  
  if (binding.ip_address !== ipAddress) {
    // MAC is bound to a different IP - potential spoofing!
    logEvent(EventCategory.SECURITY, 'BINDING_VIOLATION', {
      macAddress: normalizedMac,
      expectedIp: binding.ip_address,
      actualIp: ipAddress,
    }, Severity.WARNING);
    
    return {
      valid: false,
      reason: 'IP_MISMATCH',
      message: `MAC ${normalizedMac} is bound to ${binding.ip_address}, not ${ipAddress}`,
      expectedIp: binding.ip_address,
    };
  }
  
  // Check expiry
  if (binding.expires_at && new Date(binding.expires_at) < new Date()) {
    return {
      valid: false,
      reason: 'EXPIRED',
      message: 'Binding has expired',
    };
  }
  
  return {
    valid: true,
    binding: {
      macAddress: binding.mac_address,
      ipAddress: binding.ip_address,
      sessionId: binding.session_id,
      createdAt: binding.created_at,
      expiresAt: binding.expires_at,
    },
  };
}

/**
 * Get binding for a MAC address
 */
function getBindingByMac(macAddress) {
  const normalizedMac = normalizeMac(macAddress);
  
  return db.prepare(`
    SELECT * FROM mac_ip_bindings 
    WHERE mac_address = ? AND is_active = 1
  `).get(normalizedMac);
}

/**
 * Get binding for an IP address
 */
function getBindingByIp(ipAddress) {
  return db.prepare(`
    SELECT * FROM mac_ip_bindings 
    WHERE ip_address = ? AND is_active = 1
  `).get(ipAddress);
}

/**
 * Remove binding for a MAC address
 */
function removeBinding(macAddress) {
  const normalizedMac = normalizeMac(macAddress);
  
  const result = db.prepare(`
    UPDATE mac_ip_bindings SET is_active = 0 WHERE mac_address = ? AND is_active = 1
  `).run(normalizedMac);
  
  console.log(`[BINDING] Removed: ${normalizedMac}`);
  
  return { success: true, removed: result.changes };
}

/**
 * Remove binding by session ID
 */
function removeBindingBySession(sessionId) {
  const result = db.prepare(`
    UPDATE mac_ip_bindings SET is_active = 0 WHERE session_id = ? AND is_active = 1
  `).run(sessionId);
  
  return { success: true, removed: result.changes };
}

/**
 * Get all active bindings
 */
function getAllActiveBindings() {
  return db.prepare(`
    SELECT 
      b.*,
      s.auth_method,
      s.started_at as session_started,
      s.expires_at as session_expires
    FROM mac_ip_bindings b
    LEFT JOIN sessions s ON b.session_id = s.id
    WHERE b.is_active = 1
    ORDER BY b.created_at DESC
  `).all();
}

/**
 * Cleanup expired bindings
 */
function cleanupExpiredBindings() {
  const now = new Date().toISOString();
  
  const result = db.prepare(`
    UPDATE mac_ip_bindings 
    SET is_active = 0 
    WHERE is_active = 1 AND expires_at IS NOT NULL AND expires_at < ?
  `).run(now);
  
  if (result.changes > 0) {
    console.log(`[BINDING] Cleaned up ${result.changes} expired bindings`);
  }
  
  return result.changes;
}

/**
 * Detect potential spoofing attempts
 * Called periodically or on suspicious activity
 */
function detectSpoofingAttempts() {
  const anomalies = [];
  
  // Check for multiple MACs using same IP
  const ipConflicts = db.prepare(`
    SELECT ip_address, GROUP_CONCAT(mac_address) as macs, COUNT(*) as count
    FROM mac_ip_bindings
    WHERE is_active = 1
    GROUP BY ip_address
    HAVING count > 1
  `).all();
  
  for (const conflict of ipConflicts) {
    anomalies.push({
      type: 'IP_CONFLICT',
      severity: 'HIGH',
      ipAddress: conflict.ip_address,
      macs: conflict.macs.split(','),
      description: `Multiple MACs bound to same IP: ${conflict.ip_address}`,
    });
    
    logEvent(EventCategory.SECURITY, 'SPOOF_DETECTION', {
      type: 'IP_CONFLICT',
      ipAddress: conflict.ip_address,
      macs: conflict.macs,
    }, Severity.WARNING);
  }
  
  // Check for MACs with multiple recent IPs (could indicate DHCP manipulation)
  const macChanges = db.prepare(`
    SELECT mac_address, COUNT(DISTINCT ip_address) as ip_count
    FROM mac_ip_bindings
    WHERE created_at > datetime('now', '-1 hour')
    GROUP BY mac_address
    HAVING ip_count > 2
  `).all();
  
  for (const change of macChanges) {
    anomalies.push({
      type: 'RAPID_IP_CHANGE',
      severity: 'MEDIUM',
      macAddress: change.mac_address,
      ipCount: change.ip_count,
      description: `MAC ${change.mac_address} changed IP ${change.ip_count} times in 1 hour`,
    });
  }
  
  return {
    detected: anomalies.length > 0,
    anomalies,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Normalize MAC address to lowercase colon-separated format
 */
function normalizeMac(mac) {
  if (!mac) return null;
  const clean = mac.replace(/[:-]/g, '').toLowerCase();
  if (clean.length !== 12) return mac.toLowerCase();
  return clean.match(/.{2}/g).join(':');
}

/**
 * Get binding statistics
 */
function getBindingStats() {
  const stats = {
    total: db.prepare('SELECT COUNT(*) as count FROM mac_ip_bindings').get().count,
    active: db.prepare('SELECT COUNT(*) as count FROM mac_ip_bindings WHERE is_active = 1').get().count,
    expired: db.prepare(`
      SELECT COUNT(*) as count FROM mac_ip_bindings 
      WHERE is_active = 1 AND expires_at < datetime('now')
    `).get().count,
  };
  
  // Get recent binding activity
  stats.recentActivity = db.prepare(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count
    FROM mac_ip_bindings
    WHERE created_at > datetime('now', '-7 days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all();
  
  return stats;
}

/**
 * Educational: Explain MAC/IP binding security
 */
function explainBindingSecurity() {
  return {
    concept: 'MAC/IP Binding',
    explanation: `
      MAC/IP binding creates a verified association between a device's 
      hardware address (MAC) and its network address (IP). This prevents
      various identity-based attacks on the network.
    `,
    withoutBinding: [
      'Attacker can claim any IP address',
      'Session hijacking by IP spoofing',
      'DHCP starvation attacks',
      'IP address conflicts',
    ],
    withBinding: [
      'Each MAC is locked to its assigned IP',
      'Spoofed packets are detected and dropped',
      'Clear audit trail of device-IP associations',
      'Prevents unauthorized IP usage',
    ],
    implementation: {
      creation: 'Binding created when session starts or DHCP assigns IP',
      validation: 'Every packet checked against binding table',
      enforcement: 'iptables and ebtables rules enforce bindings',
      cleanup: 'Bindings removed when session expires',
    },
  };
}

module.exports = {
  createBinding,
  validateBinding,
  getBindingByMac,
  getBindingByIp,
  removeBinding,
  removeBindingBySession,
  getAllActiveBindings,
  cleanupExpiredBindings,
  detectSpoofingAttempts,
  getBindingStats,
  explainBindingSecurity,
};
