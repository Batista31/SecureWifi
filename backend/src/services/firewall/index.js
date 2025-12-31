/**
 * Firewall Service - Main Entry Point
 * 
 * Orchestrates all firewall operations including:
 * - iptables rules (Layer 3)
 * - ebtables rules (Layer 2)
 * - MAC/IP binding
 * - Rule lifecycle management
 */

const iptablesService = require('./iptables.service');
const ebtablesService = require('./ebtables.service');
const bindingService = require('./binding.service');
const ruleEngine = require('./rule-engine.service');

module.exports = {
  // IPTables operations
  iptables: iptablesService,
  
  // EBTables operations
  ebtables: ebtablesService,
  
  // MAC/IP binding operations
  binding: bindingService,
  
  // Rule engine (orchestration)
  engine: ruleEngine,
  
  // Convenience methods
  async grantAccess(sessionData) {
    return ruleEngine.grantClientAccess(sessionData);
  },
  
  async revokeAccess(sessionData) {
    return ruleEngine.revokeClientAccess(sessionData);
  },
  
  async getStatus() {
    return ruleEngine.getFirewallStatus();
  },
};
