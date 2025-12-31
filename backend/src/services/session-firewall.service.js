/**
 * Session-Firewall Integration Service
 * 
 * Bridges authentication/session events with firewall rule management.
 * This service is responsible for:
 * - Triggering firewall rules when sessions are created
 * - Removing rules when sessions end or expire
 * - Coordinating between auth service and rule engine
 * 
 * DESIGN DECISION:
 * We keep this as a separate integration layer rather than
 * directly calling firewall services from auth. This allows:
 * - Cleaner separation of concerns
 * - Easier testing (can mock either side)
 * - Option to disable firewall integration without changing auth
 * - Event-driven architecture readiness
 */

const ruleEngine = require('./firewall/rule-engine.service');
const db = require('../config/database.config');
const { logEvent, EventCategory, Severity } = require('./logging.service');
const config = require('../config/app.config');

/**
 * Called when a new session is created after successful authentication
 * Applies all necessary firewall rules for the client
 */
async function onSessionCreated(session) {
  const { id, mac_address, ip_address, auth_method, expires_at } = session;
  
  console.log(`[INTEGRATION] Session created: ${id} for ${mac_address}`);
  
  try {
    // Grant network access via rule engine
    const result = await ruleEngine.grantClientAccess({
      sessionId: id,
      macAddress: mac_address,
      ipAddress: ip_address,
      authMethod: auth_method,
      expiresAt: expires_at,
    });
    
    // Store result in database for audit
    db.prepare(`
      UPDATE sessions SET firewall_applied = ? WHERE id = ?
    `).run(result.success ? 1 : 0, id);
    
    return result;
    
  } catch (error) {
    console.error('[INTEGRATION] Failed to apply firewall rules:', error);
    
    logEvent(EventCategory.FIREWALL, 'INTEGRATION_ERROR', {
      sessionId: id,
      macAddress: mac_address,
      error: error.message,
    }, Severity.ERROR);
    
    return { success: false, error: error.message };
  }
}

/**
 * Called when a session ends (logout, timeout, admin disconnect)
 * Removes all firewall rules for the client
 */
async function onSessionEnded(session, reason = 'unknown') {
  const { id, mac_address, ip_address } = session;
  
  console.log(`[INTEGRATION] Session ended: ${id} for ${mac_address} (reason: ${reason})`);
  
  try {
    // Revoke network access
    const result = await ruleEngine.revokeClientAccess({
      sessionId: id,
      macAddress: mac_address,
      ipAddress: ip_address,
    });
    
    // Mark session as inactive in database
    db.prepare(`
      UPDATE sessions SET is_active = 0, firewall_applied = 0 WHERE id = ?
    `).run(id);
    
    return result;
    
  } catch (error) {
    console.error('[INTEGRATION] Failed to remove firewall rules:', error);
    
    logEvent(EventCategory.FIREWALL, 'REVOKE_ERROR', {
      sessionId: id,
      macAddress: mac_address,
      error: error.message,
    }, Severity.ERROR);
    
    return { success: false, error: error.message };
  }
}

/**
 * Logout a session by ID
 */
async function logoutSession(sessionId) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  
  if (!session) {
    return { success: false, message: 'Session not found' };
  }
  
  return await onSessionEnded(session, 'logout');
}

/**
 * Logout all sessions for a device (by MAC address)
 */
async function logoutDevice(macAddress) {
  const sessions = db.prepare(`
    SELECT * FROM sessions WHERE mac_address = ? AND is_active = 1
  `).all(macAddress);
  
  const results = [];
  
  for (const session of sessions) {
    const result = await onSessionEnded(session, 'device_logout');
    results.push({ sessionId: session.id, result });
  }
  
  return {
    success: true,
    loggedOut: results.length,
    results,
  };
}

/**
 * Force disconnect a client (admin action)
 */
async function forceDisconnect(sessionId, adminId, reason = 'admin_disconnect') {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  
  if (!session) {
    return { success: false, message: 'Session not found' };
  }
  
  // Log admin action
  logEvent(EventCategory.ADMIN, 'FORCE_DISCONNECT', {
    sessionId,
    macAddress: session.mac_address,
    adminId,
    reason,
  }, Severity.WARNING);
  
  return await onSessionEnded(session, reason);
}

/**
 * Enhanced session creation that includes firewall integration
 * This wraps the existing createSession logic
 */
async function createSessionWithFirewall(sessionData) {
  // The session should already be created in the database
  // This function applies firewall rules to an existing session
  
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionData.sessionId);
  
  if (!session) {
    return { success: false, message: 'Session not found' };
  }
  
  // Apply firewall rules
  const firewallResult = await onSessionCreated(session);
  
  return {
    success: firewallResult.success,
    session,
    firewall: firewallResult,
  };
}

/**
 * Get integration status for a session
 */
function getSessionFirewallStatus(sessionId) {
  const session = db.prepare(`
    SELECT s.*, 
           b.ip_address as bound_ip,
           b.is_active as binding_active
    FROM sessions s
    LEFT JOIN mac_ip_bindings b ON s.mac_address = b.mac_address AND b.is_active = 1
    WHERE s.id = ?
  `).get(sessionId);
  
  if (!session) {
    return { found: false };
  }
  
  return {
    found: true,
    session: {
      id: session.id,
      macAddress: session.mac_address,
      ipAddress: session.ip_address,
      authMethod: session.auth_method,
      isActive: session.is_active === 1,
      firewallApplied: session.firewall_applied === 1,
      expiresAt: session.expires_at,
    },
    binding: {
      active: session.binding_active === 1,
      boundIp: session.bound_ip,
      matches: session.bound_ip === session.ip_address,
    },
  };
}

/**
 * Check if session firewall rules need refresh
 * (e.g., after server restart)
 */
async function refreshSessionRules(sessionId) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND is_active = 1').get(sessionId);
  
  if (!session) {
    return { success: false, message: 'Active session not found' };
  }
  
  // Check if session is expired
  if (new Date(session.expires_at) < new Date()) {
    // Session expired, end it
    return await onSessionEnded(session, 'expired');
  }
  
  // Re-apply rules
  return await onSessionCreated(session);
}

/**
 * Refresh all active session rules
 * Useful after server restart
 */
async function refreshAllSessionRules() {
  const activeSessions = db.prepare(`
    SELECT * FROM sessions WHERE is_active = 1 AND expires_at > datetime('now')
  `).all();
  
  console.log(`[INTEGRATION] Refreshing rules for ${activeSessions.length} active sessions`);
  
  const results = [];
  
  for (const session of activeSessions) {
    const result = await onSessionCreated(session);
    results.push({
      sessionId: session.id,
      macAddress: session.mac_address,
      success: result.success,
    });
  }
  
  return {
    refreshed: results.length,
    results,
  };
}

module.exports = {
  onSessionCreated,
  onSessionEnded,
  logoutSession,
  logoutDevice,
  forceDisconnect,
  createSessionWithFirewall,
  getSessionFirewallStatus,
  refreshSessionRules,
  refreshAllSessionRules,
};
