/**
 * Rule Engine Service
 * 
 * Orchestrates all firewall operations and manages the complete lifecycle
 * of security rules for authenticated clients. This is the main entry point
 * for the security automation system.
 * 
 * RULE LIFECYCLE:
 * 1. Client connects → Portal redirect rules applied
 * 2. Client authenticates → 
 *    - Remove portal redirect
 *    - Create MAC/IP binding
 *    - Apply L3 (iptables) allow rules
 *    - Apply L2 (ebtables) isolation rules
 * 3. Session expires/ends →
 *    - Remove all client rules
 *    - Remove MAC/IP binding
 *    - Re-apply portal redirect (optional)
 */

const iptablesService = require('./iptables.service');
const ebtablesService = require('./ebtables.service');
const bindingService = require('./binding.service');
const db = require('../../config/database.config');
const firewallConfig = require('../../config/firewall.config');
const { logEvent, EventCategory, Severity } = require('../logging.service');

// Cleanup interval reference
let cleanupInterval = null;

/**
 * Grant network access to an authenticated client
 * This is called after successful authentication
 */
async function grantClientAccess(sessionData) {
  const { sessionId, macAddress, ipAddress, authMethod } = sessionData;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[RULE ENGINE] Granting access to ${macAddress} (${ipAddress})`);
  console.log(`${'='.repeat(60)}`);
  
  const results = {
    success: true,
    sessionId,
    macAddress,
    ipAddress,
    steps: [],
  };
  
  try {
    // Step 1: Create MAC/IP binding
    console.log('\n[Step 1] Creating MAC/IP binding...');
    const bindingResult = bindingService.createBinding(
      macAddress, 
      ipAddress, 
      sessionId,
      sessionData.expiresAt
    );
    results.steps.push({
      step: 'MAC/IP Binding',
      success: bindingResult.success,
      details: bindingResult,
    });
    
    // Step 2: Remove portal redirect (if any)
    console.log('\n[Step 2] Removing portal redirect...');
    const redirectResult = await iptablesService.removePortalRedirect(macAddress);
    results.steps.push({
      step: 'Remove Portal Redirect',
      success: redirectResult.success,
      rules: redirectResult.rules?.length || 0,
    });
    
    // Step 3: Apply L3 (iptables) rules
    console.log('\n[Step 3] Applying Layer 3 (iptables) rules...');
    const iptablesResult = await iptablesService.applyAuthenticatedRules(
      macAddress, 
      ipAddress, 
      sessionId
    );
    results.steps.push({
      step: 'Layer 3 Rules (iptables)',
      success: iptablesResult.success,
      rules: iptablesResult.rules?.length || 0,
    });
    
    // Step 4: Apply L2 (ebtables) isolation rules
    console.log('\n[Step 4] Applying Layer 2 (ebtables) isolation rules...');
    const ebtablesResult = await ebtablesService.applyClientIsolation(
      macAddress, 
      ipAddress, 
      sessionId
    );
    results.steps.push({
      step: 'Layer 2 Rules (ebtables)',
      success: ebtablesResult.success,
      rules: ebtablesResult.rules?.length || 0,
    });
    
    // Check overall success
    results.success = results.steps.every(s => s.success);
    
    // Log event
    logEvent(EventCategory.FIREWALL, 'ACCESS_GRANTED', {
      sessionId,
      macAddress,
      ipAddress,
      authMethod,
      stepsCompleted: results.steps.length,
      simulated: iptablesService.isSimulationMode(),
    }, Severity.INFO);
    
    console.log(`\n[RULE ENGINE] Access granted: ${results.success ? 'SUCCESS' : 'PARTIAL'}`);
    console.log(`${'='.repeat(60)}\n`);
    
    return results;
    
  } catch (error) {
    console.error('[RULE ENGINE] Error granting access:', error);
    
    results.success = false;
    results.error = error.message;
    
    logEvent(EventCategory.FIREWALL, 'ACCESS_GRANT_ERROR', {
      sessionId,
      macAddress,
      ipAddress,
      error: error.message,
    }, Severity.ERROR);
    
    return results;
  }
}

/**
 * Revoke network access from a client
 * Called when session expires or admin disconnects
 */
async function revokeClientAccess(sessionData) {
  const { sessionId, macAddress, ipAddress } = sessionData;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[RULE ENGINE] Revoking access from ${macAddress} (${ipAddress})`);
  console.log(`${'='.repeat(60)}`);
  
  const results = {
    success: true,
    sessionId,
    macAddress,
    ipAddress,
    steps: [],
  };
  
  try {
    // Step 1: Remove L3 (iptables) rules
    console.log('\n[Step 1] Removing Layer 3 (iptables) rules...');
    const iptablesResult = await iptablesService.removeClientRules(
      macAddress, 
      ipAddress, 
      sessionId
    );
    results.steps.push({
      step: 'Remove Layer 3 Rules',
      success: iptablesResult.success,
      rules: iptablesResult.rules?.length || 0,
    });
    
    // Step 2: Remove L2 (ebtables) rules
    console.log('\n[Step 2] Removing Layer 2 (ebtables) rules...');
    const ebtablesResult = await ebtablesService.removeClientIsolation(
      macAddress, 
      ipAddress, 
      sessionId
    );
    results.steps.push({
      step: 'Remove Layer 2 Rules',
      success: ebtablesResult.success,
      rules: ebtablesResult.rules?.length || 0,
    });
    
    // Step 3: Remove MAC/IP binding
    console.log('\n[Step 3] Removing MAC/IP binding...');
    const bindingResult = bindingService.removeBindingBySession(sessionId);
    results.steps.push({
      step: 'Remove MAC/IP Binding',
      success: bindingResult.success,
      removed: bindingResult.removed,
    });
    
    // Step 4: Re-apply portal redirect (optional - forces re-auth)
    console.log('\n[Step 4] Re-applying portal redirect...');
    const redirectResult = await iptablesService.applyPortalRedirect(macAddress);
    results.steps.push({
      step: 'Apply Portal Redirect',
      success: redirectResult.success,
      rules: redirectResult.rules?.length || 0,
    });
    
    // Check overall success
    results.success = results.steps.every(s => s.success);
    
    // Log event
    logEvent(EventCategory.FIREWALL, 'ACCESS_REVOKED', {
      sessionId,
      macAddress,
      ipAddress,
      stepsCompleted: results.steps.length,
      simulated: iptablesService.isSimulationMode(),
    }, Severity.INFO);
    
    console.log(`\n[RULE ENGINE] Access revoked: ${results.success ? 'SUCCESS' : 'PARTIAL'}`);
    console.log(`${'='.repeat(60)}\n`);
    
    return results;
    
  } catch (error) {
    console.error('[RULE ENGINE] Error revoking access:', error);
    
    results.success = false;
    results.error = error.message;
    
    logEvent(EventCategory.FIREWALL, 'ACCESS_REVOKE_ERROR', {
      sessionId,
      macAddress,
      ipAddress,
      error: error.message,
    }, Severity.ERROR);
    
    return results;
  }
}

/**
 * Cleanup expired sessions and their rules
 * Should be called periodically
 */
async function cleanupExpiredSessions() {
  const now = new Date().toISOString();
  
  // Find expired sessions with active rules
  const expiredSessions = db.prepare(`
    SELECT DISTINCT s.id, s.mac_address, s.ip_address
    FROM sessions s
    INNER JOIN firewall_rules f ON s.id = f.session_id
    WHERE s.expires_at < ? AND f.is_active = 1
  `).all(now);
  
  if (expiredSessions.length === 0) {
    return { cleaned: 0, sessions: [] };
  }
  
  console.log(`[CLEANUP] Found ${expiredSessions.length} expired sessions with active rules`);
  
  const results = [];
  
  for (const session of expiredSessions) {
    const result = await revokeClientAccess({
      sessionId: session.id,
      macAddress: session.mac_address,
      ipAddress: session.ip_address,
    });
    
    results.push({
      sessionId: session.id,
      macAddress: session.mac_address,
      success: result.success,
    });
  }
  
  // Also cleanup expired bindings
  const bindingsCleaned = bindingService.cleanupExpiredBindings();
  
  return {
    cleaned: results.length,
    bindingsCleaned,
    sessions: results,
  };
}

/**
 * Start the automatic cleanup scheduler
 */
function startCleanupScheduler() {
  if (cleanupInterval) {
    console.log('[CLEANUP] Scheduler already running');
    return;
  }
  
  const intervalMs = firewallConfig.cleanup.intervalMs;
  
  cleanupInterval = setInterval(async () => {
    try {
      const result = await cleanupExpiredSessions();
      if (result.cleaned > 0) {
        console.log(`[CLEANUP] Cleaned ${result.cleaned} expired sessions`);
      }
    } catch (error) {
      console.error('[CLEANUP] Error during cleanup:', error);
    }
  }, intervalMs);
  
  console.log(`[CLEANUP] Scheduler started (interval: ${intervalMs}ms)`);
}

/**
 * Stop the cleanup scheduler
 */
function stopCleanupScheduler() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[CLEANUP] Scheduler stopped');
  }
}

/**
 * Get current firewall status
 */
function getFirewallStatus() {
  const iptablesSummary = iptablesService.getSimulationSummary();
  const ebtablesSummary = ebtablesService.getSimulationSummary();
  const bindings = bindingService.getAllActiveBindings();
  const bindingStats = bindingService.getBindingStats();
  const spoofDetection = bindingService.detectSpoofingAttempts();
  
  return {
    mode: firewallConfig.mode,
    isSimulation: iptablesService.isSimulationMode(),
    cleanupRunning: cleanupInterval !== null,
    
    iptables: {
      activeRules: iptablesSummary.activeRules,
      rules: iptablesSummary.rules,
    },
    
    ebtables: {
      activeRules: ebtablesSummary.activeRules,
      rules: ebtablesSummary.rules,
    },
    
    bindings: {
      active: bindings.length,
      stats: bindingStats,
      list: bindings,
    },
    
    security: {
      spoofDetection,
    },
    
    config: {
      interfaces: firewallConfig.interfaces,
      network: firewallConfig.network,
      cleanupInterval: firewallConfig.cleanup.intervalMs,
    },
  };
}

/**
 * Initialize the rule engine
 * Called at server startup
 */
async function initialize() {
  console.log('\n[RULE ENGINE] Initializing...');
  console.log(`[RULE ENGINE] Mode: ${firewallConfig.mode.toUpperCase()}`);
  
  // Start cleanup scheduler
  startCleanupScheduler();
  
  // In production, would also initialize global rules
  if (!iptablesService.isSimulationMode()) {
    console.log('[RULE ENGINE] Would initialize global firewall rules here');
    // await ebtablesService.initializeGlobalIsolation();
  }
  
  console.log('[RULE ENGINE] Initialization complete\n');
  
  return {
    mode: firewallConfig.mode,
    cleanupScheduled: true,
  };
}

/**
 * Shutdown the rule engine
 */
function shutdown() {
  stopCleanupScheduler();
  console.log('[RULE ENGINE] Shutdown complete');
}

/**
 * Get educational explanation of the rule engine
 */
function explainRuleEngine() {
  return {
    concept: 'Rule Engine Orchestration',
    description: `
      The rule engine coordinates all security components to provide
      comprehensive protection for the WiFi network. It manages the
      complete lifecycle of security rules from client connection
      through session expiration.
    `,
    
    components: [
      {
        name: 'iptables (Layer 3)',
        purpose: 'IP-level filtering and NAT',
        rules: [
          'Forward traffic from authenticated clients',
          'NAT for internet access',
          'MAC/IP binding validation',
          'Portal redirect for unauthenticated clients',
        ],
      },
      {
        name: 'ebtables (Layer 2)',
        purpose: 'Ethernet frame filtering',
        rules: [
          'Client isolation (block inter-client traffic)',
          'ARP spoofing protection',
          'MAC/IP binding at frame level',
        ],
      },
      {
        name: 'MAC/IP Binding',
        purpose: 'Identity verification',
        rules: [
          'Track device-IP associations',
          'Detect spoofing attempts',
          'Enforce consistent identity',
        ],
      },
    ],
    
    lifecycle: [
      '1. New client connects → Portal redirect active',
      '2. Client authenticates → Rules applied (L2 + L3)',
      '3. Session active → Traffic allowed, isolation enforced',
      '4. Session expires → Rules removed automatically',
      '5. Client must re-authenticate for new session',
    ],
    
    simulationMode: {
      purpose: 'Development and testing without affecting network',
      behavior: 'Rules are generated and logged but not applied',
      switchTo: 'Set SECURITY_MODE=production in .env',
    },
  };
}

module.exports = {
  grantClientAccess,
  revokeClientAccess,
  cleanupExpiredSessions,
  startCleanupScheduler,
  stopCleanupScheduler,
  getFirewallStatus,
  initialize,
  shutdown,
  explainRuleEngine,
};
