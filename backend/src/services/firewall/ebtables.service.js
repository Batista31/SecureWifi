/**
 * EBTables Service
 * 
 * Generates and manages ebtables rules for Layer 2 (Ethernet) security:
 * - Client-to-client isolation
 * - ARP spoofing protection
 * - MAC address filtering
 * 
 * WHY EBTABLES?
 * iptables operates at Layer 3 (IP). A sophisticated attacker could still
 * perform Layer 2 attacks (ARP spoofing, MAC spoofing) to intercept traffic.
 * ebtables operates at Layer 2 (Ethernet frame level) and can:
 * - Block direct communication between wireless clients
 * - Prevent ARP spoofing by validating ARP packets
 * - Enforce MAC address rules at the frame level
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
 * Execute an ebtables command
 * In simulation mode, logs the command instead of executing
 */
async function executeCommand(command, description = '') {
  const fullCommand = `ebtables ${command}`;
  
  if (isSimulationMode()) {
    // Log to console and database
    console.log(`[SIMULATION] ${description || 'ebtables'}: ${fullCommand}`);
    
    securityLog.ruleApplied('ebtables', description, null, true);
    
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
    
    securityLog.ruleApplied('ebtables', description, null, false);
    
    return {
      success: true,
      simulated: false,
      command: fullCommand,
      stdout,
      stderr,
    };
  } catch (error) {
    console.error(`ebtables error: ${error.message}`);
    return {
      success: false,
      simulated: false,
      command: fullCommand,
      error: error.message,
    };
  }
}

/**
 * Generate client isolation rule
 * 
 * This prevents client A from directly communicating with client B
 * at the Ethernet frame level. Traffic must go through the gateway.
 * 
 * HOW IT WORKS:
 * - Blocks any Ethernet frame where both source AND destination
 *   are in the client MAC range (not the gateway)
 * - Allows frames to/from the gateway MAC
 */
function generateClientIsolationRule(clientMac, gatewayMac) {
  const { interfaces } = firewallConfig;
  
  return {
    description: `Client isolation for ${clientMac}`,
    commands: [
      // Drop frames from this client to any other client (not gateway)
      `-A FORWARD -i ${interfaces.bridge} -s ${clientMac} ! -d ${gatewayMac} -j DROP`,
    ],
    removeCommands: [
      `-D FORWARD -i ${interfaces.bridge} -s ${clientMac} ! -d ${gatewayMac} -j DROP`,
    ],
  };
}

/**
 * Generate global client isolation rule
 * 
 * Simpler approach: Block ALL inter-client traffic on the bridge.
 * Only allow traffic to/from the gateway.
 */
function generateGlobalIsolationRules(gatewayMac) {
  const { interfaces } = firewallConfig;
  
  return {
    description: 'Global client isolation - block inter-client traffic',
    commands: [
      // Allow traffic to gateway
      `-A FORWARD -i ${interfaces.bridge} -d ${gatewayMac} -j ACCEPT`,
      // Allow traffic from gateway
      `-A FORWARD -i ${interfaces.bridge} -s ${gatewayMac} -j ACCEPT`,
      // Allow broadcast (needed for DHCP, ARP)
      `-A FORWARD -i ${interfaces.bridge} -d ff:ff:ff:ff:ff:ff -j ACCEPT`,
      // Drop everything else (inter-client)
      `-A FORWARD -i ${interfaces.bridge} -j DROP`,
    ],
    removeCommands: [
      `-D FORWARD -i ${interfaces.bridge} -d ${gatewayMac} -j ACCEPT`,
      `-D FORWARD -i ${interfaces.bridge} -s ${gatewayMac} -j ACCEPT`,
      `-D FORWARD -i ${interfaces.bridge} -d ff:ff:ff:ff:ff:ff -j ACCEPT`,
      `-D FORWARD -i ${interfaces.bridge} -j DROP`,
    ],
  };
}

/**
 * Generate ARP spoofing protection rule
 * 
 * ARP SPOOFING EXPLAINED:
 * An attacker sends fake ARP replies saying "I am the gateway" with their MAC.
 * Victims update their ARP cache and send traffic to the attacker instead.
 * 
 * PROTECTION:
 * - Only allow ARP replies from known gateway IP with correct gateway MAC
 * - Drop ARP replies claiming to be the gateway but with wrong MAC
 * - Log suspicious ARP activity
 */
function generateArpProtectionRule(gatewayIp, gatewayMac, clientMac, clientIp) {
  const { interfaces, logging } = firewallConfig;
  
  return {
    description: `ARP protection for ${clientMac} (${clientIp})`,
    commands: [
      // Allow legitimate ARP from gateway
      `-A FORWARD -p arp --arp-ip-src ${gatewayIp} --arp-mac-src ${gatewayMac} -j ACCEPT`,
      
      // Allow ARP from this authenticated client with correct IP
      `-A FORWARD -p arp --arp-ip-src ${clientIp} --arp-mac-src ${clientMac} -j ACCEPT`,
      
      // Log and drop ARP spoofing attempts (claiming to be gateway)
      `-A FORWARD -p arp --arp-ip-src ${gatewayIp} ! --arp-mac-src ${gatewayMac} -j LOG --log-prefix "ARP_SPOOF_GW: " --log-level ${logging.logLevel}`,
      `-A FORWARD -p arp --arp-ip-src ${gatewayIp} ! --arp-mac-src ${gatewayMac} -j DROP`,
      
      // Log and drop ARP spoofing from this client (wrong IP)
      `-A FORWARD -p arp --arp-mac-src ${clientMac} ! --arp-ip-src ${clientIp} -j LOG --log-prefix "ARP_SPOOF_CLIENT: " --log-level ${logging.logLevel}`,
      `-A FORWARD -p arp --arp-mac-src ${clientMac} ! --arp-ip-src ${clientIp} -j DROP`,
    ],
    removeCommands: [
      `-D FORWARD -p arp --arp-ip-src ${gatewayIp} --arp-mac-src ${gatewayMac} -j ACCEPT`,
      `-D FORWARD -p arp --arp-ip-src ${clientIp} --arp-mac-src ${clientMac} -j ACCEPT`,
      `-D FORWARD -p arp --arp-ip-src ${gatewayIp} ! --arp-mac-src ${gatewayMac} -j LOG --log-prefix "ARP_SPOOF_GW: " --log-level ${logging.logLevel}`,
      `-D FORWARD -p arp --arp-ip-src ${gatewayIp} ! --arp-mac-src ${gatewayMac} -j DROP`,
      `-D FORWARD -p arp --arp-mac-src ${clientMac} ! --arp-ip-src ${clientIp} -j LOG --log-prefix "ARP_SPOOF_CLIENT: " --log-level ${logging.logLevel}`,
      `-D FORWARD -p arp --arp-mac-src ${clientMac} ! --arp-ip-src ${clientIp} -j DROP`,
    ],
  };
}

/**
 * Generate MAC binding rule at Layer 2
 * 
 * Ensures that frames from a MAC always have the correct source IP
 * This is checked at Ethernet frame level, before IP processing
 */
function generateMacIpBindingRule(clientMac, clientIp) {
  const { interfaces, logging } = firewallConfig;
  
  return {
    description: `L2 MAC/IP binding for ${clientMac} -> ${clientIp}`,
    commands: [
      // Allow IP packets from this MAC only with correct source IP
      `-A FORWARD -p ip -i ${interfaces.bridge} --ip-src ${clientIp} -s ${clientMac} -j ACCEPT`,
      
      // Log IP spoofing attempts
      `-A FORWARD -p ip -i ${interfaces.bridge} -s ${clientMac} ! --ip-src ${clientIp} -j LOG --log-prefix "IP_SPOOF: " --log-level ${logging.logLevel}`,
      
      // Drop IP spoofed packets
      `-A FORWARD -p ip -i ${interfaces.bridge} -s ${clientMac} ! --ip-src ${clientIp} -j DROP`,
    ],
    removeCommands: [
      `-D FORWARD -p ip -i ${interfaces.bridge} --ip-src ${clientIp} -s ${clientMac} -j ACCEPT`,
      `-D FORWARD -p ip -i ${interfaces.bridge} -s ${clientMac} ! --ip-src ${clientIp} -j LOG --log-prefix "IP_SPOOF: " --log-level ${logging.logLevel}`,
      `-D FORWARD -p ip -i ${interfaces.bridge} -s ${clientMac} ! --ip-src ${clientIp} -j DROP`,
    ],
  };
}

/**
 * Apply Layer 2 isolation rules for authenticated client
 */
async function applyClientIsolation(macAddress, ipAddress, sessionId) {
  const { network } = firewallConfig;
  const gatewayMac = process.env.GATEWAY_MAC || 'dc:a6:32:xx:xx:xx'; // Would be detected in production
  
  const rules = [];
  const results = [];
  
  // Generate L2 rules
  rules.push(generateMacIpBindingRule(macAddress, ipAddress));
  rules.push(generateArpProtectionRule(network.gateway, gatewayMac, macAddress, ipAddress));
  
  // Apply each rule
  for (const rule of rules) {
    for (const cmd of rule.commands) {
      const result = await executeCommand(cmd, rule.description);
      results.push(result);
      
      // Store rule in database
      storeRule('ebtables', 'ISOLATION', cmd, macAddress, ipAddress, sessionId);
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
 * Remove Layer 2 rules for client
 */
async function removeClientIsolation(macAddress, ipAddress, sessionId) {
  const { network } = firewallConfig;
  const gatewayMac = process.env.GATEWAY_MAC || 'dc:a6:32:xx:xx:xx';
  
  const rules = [];
  const results = [];
  
  rules.push(generateMacIpBindingRule(macAddress, ipAddress));
  rules.push(generateArpProtectionRule(network.gateway, gatewayMac, macAddress, ipAddress));
  
  // Remove each rule
  for (const rule of rules) {
    for (const cmd of rule.removeCommands) {
      const result = await executeCommand(cmd, `Remove: ${rule.description}`);
      results.push(result);
    }
  }
  
  // Update database
  markRulesRemoved(sessionId, 'ebtables');
  
  securityLog.ruleRemoved('ebtables', macAddress, isSimulationMode());
  
  return {
    success: results.every(r => r.success),
    rules: results,
    macAddress,
    ipAddress,
  };
}

/**
 * Initialize global isolation rules (run once at startup)
 */
async function initializeGlobalIsolation() {
  const gatewayMac = process.env.GATEWAY_MAC || 'dc:a6:32:xx:xx:xx';
  const rule = generateGlobalIsolationRules(gatewayMac);
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
function markRulesRemoved(sessionId, ruleType = null) {
  try {
    let query = `
      UPDATE firewall_rules 
      SET is_active = 0, removed_at = CURRENT_TIMESTAMP
      WHERE session_id = ? AND is_active = 1
    `;
    
    if (ruleType) {
      query += ` AND rule_type = ?`;
      db.prepare(query).run(sessionId, ruleType);
    } else {
      db.prepare(query).run(sessionId);
    }
  } catch (error) {
    console.error('Failed to mark rules removed:', error);
  }
}

/**
 * Get simulation summary for ebtables
 */
function getSimulationSummary() {
  const rules = db.prepare(`
    SELECT * FROM firewall_rules WHERE rule_type = 'ebtables' AND is_active = 1
  `).all();
  
  return {
    mode: firewallConfig.mode,
    isSimulation: isSimulationMode(),
    activeRules: rules.length,
    rules: rules.map(r => ({
      id: r.id,
      action: r.rule_action,
      mac: r.mac_address,
      ip: r.ip_address,
      command: r.rule_command,
      appliedAt: r.applied_at,
      simulated: r.is_simulated === 1,
    })),
  };
}

/**
 * Educational: Explain Layer 2 isolation concepts
 */
function explainL2Isolation() {
  return {
    concept: 'Layer 2 Client Isolation',
    explanation: `
      Layer 2 isolation operates at the Ethernet frame level, below IP.
      This is crucial because Layer 3 (iptables) protection can be bypassed
      by sophisticated Layer 2 attacks.
    `,
    attacksPreveneted: [
      {
        name: 'ARP Spoofing',
        description: 'Attacker sends fake ARP replies to redirect traffic through their device',
        prevention: 'ebtables validates ARP source MAC/IP pairs against known bindings',
      },
      {
        name: 'Direct Client Communication',
        description: 'Client A sends frames directly to Client B on the same network',
        prevention: 'ebtables blocks frames between client MACs, forcing traffic through gateway',
      },
      {
        name: 'MAC Spoofing',
        description: 'Attacker changes their MAC to impersonate another device',
        prevention: 'MAC/IP binding ensures consistent identity at frame level',
      },
      {
        name: 'MITM via ARP',
        description: 'Man-in-the-middle attack using ARP cache poisoning',
        prevention: 'ARP protection rules validate all ARP traffic against authorized bindings',
      },
    ],
    ruleTypes: [
      'Client isolation: Blocks inter-client Ethernet frames',
      'ARP protection: Validates ARP request/reply authenticity',
      'MAC/IP binding: Ensures consistent identity at L2 and L3',
    ],
  };
}

module.exports = {
  isSimulationMode,
  executeCommand,
  generateClientIsolationRule,
  generateGlobalIsolationRules,
  generateArpProtectionRule,
  generateMacIpBindingRule,
  applyClientIsolation,
  removeClientIsolation,
  initializeGlobalIsolation,
  getSimulationSummary,
  explainL2Isolation,
};
