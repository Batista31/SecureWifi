/**
 * IPTables Service
 * 
 * Generates and manages iptables rules for Layer 3 (IP) security:
 * - NAT for internet access
 * - Forwarding rules for authenticated clients
 * - Redirect rules for captive portal
 * - MAC/IP binding validation
 * 
 * In SIMULATION MODE: Rules are generated and logged, but NOT applied.
 * In PRODUCTION MODE: Rules are applied to the system.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const firewallConfig = require('../../config/firewall.config');
const db = require('../../config/database.config');
const { securityLog } = require('../logging.service');

/**
 * Check if running in simulation mode
 */
function isSimulationMode() {
  return firewallConfig.mode === 'simulation';
}

/**
 * Execute an iptables command
 * In simulation mode, logs the command instead of executing
 */
async function executeCommand(command, description = '') {
  const fullCommand = `iptables ${command}`;
  
  if (isSimulationMode()) {
    // Log to console and database
    console.log(`[SIMULATION] ${description || 'iptables'}: ${fullCommand}`);
    
    securityLog.ruleApplied('iptables', description, null, true);
    
    return {
      success: true,
      simulated: true,
      command: fullCommand,
      description,
    };
  }
  
  // Production mode - actually execute
  try {
    const { stdout, stderr } = await execAsync(fullCommand);
    
    securityLog.ruleApplied('iptables', description, null, false);
    
    return {
      success: true,
      simulated: false,
      command: fullCommand,
      stdout,
      stderr,
    };
  } catch (error) {
    console.error(`iptables error: ${error.message}`);
    return {
      success: false,
      simulated: false,
      command: fullCommand,
      error: error.message,
    };
  }
}

/**
 * Generate rule to allow authenticated client internet access
 */
function generateAllowRule(macAddress, ipAddress) {
  const { interfaces, iptables } = firewallConfig;
  
  return {
    description: `Allow internet access for ${macAddress} (${ipAddress})`,
    commands: [
      // Allow forwarding from client to internet
      `-A FORWARD -i ${interfaces.bridge} -o ${interfaces.lan} -m mac --mac-source ${macAddress} -s ${ipAddress} -j ACCEPT`,
      // Allow return traffic
      `-A FORWARD -i ${interfaces.lan} -o ${interfaces.bridge} -d ${ipAddress} -j ACCEPT`,
    ],
    removeCommands: [
      `-D FORWARD -i ${interfaces.bridge} -o ${interfaces.lan} -m mac --mac-source ${macAddress} -s ${ipAddress} -j ACCEPT`,
      `-D FORWARD -i ${interfaces.lan} -o ${interfaces.bridge} -d ${ipAddress} -j ACCEPT`,
    ],
  };
}

/**
 * Generate rule to block unauthenticated client
 */
function generateBlockRule(macAddress, ipAddress) {
  const { interfaces, logging } = firewallConfig;
  
  return {
    description: `Block internet access for ${macAddress} (${ipAddress})`,
    commands: [
      // Log dropped packets (if enabled)
      ...(logging.logDropped ? [
        `-A FORWARD -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -j LOG --log-prefix "${logging.logPrefix}BLOCKED: "`
      ] : []),
      // Drop forwarding
      `-A FORWARD -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -j DROP`,
    ],
    removeCommands: [
      ...(logging.logDropped ? [
        `-D FORWARD -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -j LOG --log-prefix "${logging.logPrefix}BLOCKED: "`
      ] : []),
      `-D FORWARD -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -j DROP`,
    ],
  };
}

/**
 * Generate NAT masquerade rule
 */
function generateNatRule() {
  const { interfaces, network } = firewallConfig;
  
  return {
    description: 'NAT masquerade for client traffic',
    commands: [
      `-t nat -A POSTROUTING -s ${network.subnet} -o ${interfaces.lan} -j MASQUERADE`,
    ],
    removeCommands: [
      `-t nat -D POSTROUTING -s ${network.subnet} -o ${interfaces.lan} -j MASQUERADE`,
    ],
  };
}

/**
 * Generate captive portal redirect rule (for unauthenticated clients)
 */
function generatePortalRedirectRule(macAddress) {
  const { interfaces, network, portalPorts } = firewallConfig;
  
  return {
    description: `Redirect HTTP to portal for ${macAddress}`,
    commands: [
      // Redirect HTTP to portal
      `-t nat -A PREROUTING -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -p tcp --dport 80 -j DNAT --to-destination ${network.portalIp}:${portalPorts.portal}`,
      // Redirect HTTPS to portal (will cause cert warning, but necessary)
      `-t nat -A PREROUTING -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -p tcp --dport 443 -j DNAT --to-destination ${network.portalIp}:${portalPorts.portal}`,
    ],
    removeCommands: [
      `-t nat -D PREROUTING -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -p tcp --dport 80 -j DNAT --to-destination ${network.portalIp}:${portalPorts.portal}`,
      `-t nat -D PREROUTING -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -p tcp --dport 443 -j DNAT --to-destination ${network.portalIp}:${portalPorts.portal}`,
    ],
  };
}

/**
 * Generate MAC/IP binding validation rule
 */
function generateBindingRule(macAddress, ipAddress) {
  const { interfaces, logging } = firewallConfig;
  
  return {
    description: `MAC/IP binding validation for ${macAddress} -> ${ipAddress}`,
    commands: [
      // Allow only if MAC matches IP
      `-A FORWARD -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -s ${ipAddress} -j RETURN`,
      // Log spoofing attempts
      `-A FORWARD -i ${interfaces.bridge} -m mac --mac-source ${macAddress} ! -s ${ipAddress} -j LOG --log-prefix "${logging.logPrefix}SPOOF: "`,
      // Drop spoofed packets
      `-A FORWARD -i ${interfaces.bridge} -m mac --mac-source ${macAddress} ! -s ${ipAddress} -j DROP`,
    ],
    removeCommands: [
      `-D FORWARD -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -s ${ipAddress} -j RETURN`,
      `-D FORWARD -i ${interfaces.bridge} -m mac --mac-source ${macAddress} ! -s ${ipAddress} -j LOG --log-prefix "${logging.logPrefix}SPOOF: "`,
      `-D FORWARD -i ${interfaces.bridge} -m mac --mac-source ${macAddress} ! -s ${ipAddress} -j DROP`,
    ],
  };
}

/**
 * Generate DNS allow rule (always needed for portal)
 */
function generateDnsAllowRule(macAddress) {
  const { interfaces, network, portalPorts } = firewallConfig;
  
  return {
    description: `Allow DNS for ${macAddress}`,
    commands: [
      `-A INPUT -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -p udp --dport ${portalPorts.dns} -j ACCEPT`,
      `-A INPUT -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -p tcp --dport ${portalPorts.dns} -j ACCEPT`,
    ],
    removeCommands: [
      `-D INPUT -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -p udp --dport ${portalPorts.dns} -j ACCEPT`,
      `-D INPUT -i ${interfaces.bridge} -m mac --mac-source ${macAddress} -p tcp --dport ${portalPorts.dns} -j ACCEPT`,
    ],
  };
}

/**
 * Apply rules for authenticated client
 */
async function applyAuthenticatedRules(macAddress, ipAddress, sessionId) {
  const rules = [];
  const results = [];
  
  // Generate all rules for authenticated client
  rules.push(generateAllowRule(macAddress, ipAddress));
  rules.push(generateBindingRule(macAddress, ipAddress));
  rules.push(generateDnsAllowRule(macAddress));
  
  // Apply each rule
  for (const rule of rules) {
    for (const cmd of rule.commands) {
      const result = await executeCommand(cmd, rule.description);
      results.push(result);
      
      // Store rule in database
      storeRule('iptables', 'ALLOW', cmd, macAddress, ipAddress, sessionId);
    }
  }
  
  return {
    success: results.every(r => r.success),
    rules: results,
    macAddress,
    ipAddress,
  };
}

/**
 * Remove rules for client (on session end)
 */
async function removeClientRules(macAddress, ipAddress, sessionId) {
  const rules = [];
  const results = [];
  
  // Generate removal commands
  rules.push(generateAllowRule(macAddress, ipAddress));
  rules.push(generateBindingRule(macAddress, ipAddress));
  rules.push(generateDnsAllowRule(macAddress));
  
  // Remove each rule
  for (const rule of rules) {
    for (const cmd of rule.removeCommands) {
      const result = await executeCommand(cmd, `Remove: ${rule.description}`);
      results.push(result);
    }
  }
  
  // Update database
  markRulesRemoved(sessionId);
  
  securityLog.ruleRemoved('iptables', macAddress, isSimulationMode());
  
  return {
    success: results.every(r => r.success),
    rules: results,
    macAddress,
    ipAddress,
  };
}

/**
 * Apply captive portal redirect for unauthenticated client
 */
async function applyPortalRedirect(macAddress) {
  const rule = generatePortalRedirectRule(macAddress);
  const results = [];
  
  for (const cmd of rule.commands) {
    const result = await executeCommand(cmd, rule.description);
    results.push(result);
  }
  
  return {
    success: results.every(r => r.success),
    rules: results,
  };
}

/**
 * Remove portal redirect (after authentication)
 */
async function removePortalRedirect(macAddress) {
  const rule = generatePortalRedirectRule(macAddress);
  const results = [];
  
  for (const cmd of rule.removeCommands) {
    const result = await executeCommand(cmd, `Remove: ${rule.description}`);
    results.push(result);
  }
  
  return {
    success: results.every(r => r.success),
    rules: results,
  };
}

/**
 * Store rule in database
 */
function storeRule(ruleType, action, command, macAddress, ipAddress, sessionId) {
  try {
    db.prepare(`
      INSERT INTO firewall_rules 
      (rule_type, rule_action, rule_command, session_id, mac_address, ip_address, applied_at, is_simulated)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).run(
      ruleType,
      action,
      command,
      sessionId,
      macAddress,
      ipAddress,
      isSimulationMode() ? 1 : 0
    );
  } catch (error) {
    console.error('Failed to store rule:', error);
  }
}

/**
 * Mark rules as removed in database
 */
function markRulesRemoved(sessionId) {
  try {
    db.prepare(`
      UPDATE firewall_rules 
      SET is_active = 0, removed_at = CURRENT_TIMESTAMP
      WHERE session_id = ? AND is_active = 1
    `).run(sessionId);
  } catch (error) {
    console.error('Failed to mark rules removed:', error);
  }
}

/**
 * Get all active rules from database
 */
function getActiveRules() {
  return db.prepare(`
    SELECT * FROM firewall_rules WHERE is_active = 1 ORDER BY applied_at DESC
  `).all();
}

/**
 * Generate initialization rules (run once at startup)
 */
function generateInitRules() {
  const { interfaces, network, portalPorts } = firewallConfig;
  
  return {
    description: 'Initialize firewall chains and default rules',
    commands: [
      // Enable IP forwarding (would need sysctl in production)
      // '-P FORWARD DROP', // Default drop forwarding
      
      // Allow established connections
      `-A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT`,
      
      // Allow traffic to portal
      `-A INPUT -p tcp --dport ${portalPorts.portal} -j ACCEPT`,
      
      // Allow DHCP
      `-A INPUT -p udp --dport 67:68 -j ACCEPT`,
      
      // NAT for outbound traffic
      `-t nat -A POSTROUTING -s ${network.subnet} -o ${interfaces.lan} -j MASQUERADE`,
    ],
  };
}

/**
 * Get simulation summary
 */
function getSimulationSummary() {
  const rules = getActiveRules();
  
  return {
    mode: firewallConfig.mode,
    isSimulation: isSimulationMode(),
    activeRules: rules.length,
    rules: rules.map(r => ({
      id: r.id,
      type: r.rule_type,
      action: r.rule_action,
      mac: r.mac_address,
      ip: r.ip_address,
      command: r.rule_command,
      appliedAt: r.applied_at,
      simulated: r.is_simulated === 1,
    })),
  };
}

module.exports = {
  isSimulationMode,
  executeCommand,
  generateAllowRule,
  generateBlockRule,
  generateNatRule,
  generatePortalRedirectRule,
  generateBindingRule,
  generateDnsAllowRule,
  applyAuthenticatedRules,
  removeClientRules,
  applyPortalRedirect,
  removePortalRedirect,
  getActiveRules,
  generateInitRules,
  getSimulationSummary,
};
