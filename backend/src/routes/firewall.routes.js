/**
 * Firewall API Routes
 * 
 * Admin endpoints for viewing and managing the firewall system.
 * All endpoints require admin authentication.
 */

const express = require('express');
const router = express.Router();
const ruleEngine = require('../services/firewall/rule-engine.service');
const iptablesService = require('../services/firewall/iptables.service');
const ebtablesService = require('../services/firewall/ebtables.service');
const bindingService = require('../services/firewall/binding.service');
const { authenticateAdmin } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/firewall/status
 * @desc    Get complete firewall status
 * @access  Admin
 */
router.get('/status', authenticateAdmin, (req, res) => {
  try {
    const status = ruleEngine.getFirewallStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get firewall status',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/firewall/rules/iptables
 * @desc    Get all iptables rules (simulation)
 * @access  Admin
 */
router.get('/rules/iptables', authenticateAdmin, (req, res) => {
  try {
    const summary = iptablesService.getSimulationSummary();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get iptables rules',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/firewall/rules/ebtables
 * @desc    Get all ebtables rules (simulation)
 * @access  Admin
 */
router.get('/rules/ebtables', authenticateAdmin, (req, res) => {
  try {
    const summary = ebtablesService.getSimulationSummary();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get ebtables rules',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/firewall/bindings
 * @desc    Get all active MAC/IP bindings
 * @access  Admin
 */
router.get('/bindings', authenticateAdmin, (req, res) => {
  try {
    const bindings = bindingService.getAllActiveBindings();
    const stats = bindingService.getBindingStats();
    
    res.json({
      success: true,
      data: {
        bindings,
        stats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get bindings',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/firewall/bindings
 * @desc    Create a manual MAC/IP binding
 * @access  Admin
 */
router.post('/bindings', authenticateAdmin, (req, res) => {
  try {
    const { macAddress, ipAddress, expiresIn } = req.body;
    
    if (!macAddress || !ipAddress) {
      return res.status(400).json({
        success: false,
        message: 'macAddress and ipAddress are required',
      });
    }
    
    // Calculate expiry if provided
    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    }
    
    const result = bindingService.createBinding(macAddress, ipAddress, null, expiresAt);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create binding',
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/firewall/bindings/:mac
 * @desc    Remove a MAC/IP binding
 * @access  Admin
 */
router.delete('/bindings/:mac', authenticateAdmin, (req, res) => {
  try {
    const mac = req.params.mac.replace(/-/g, ':');
    const result = bindingService.removeBinding(mac);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove binding',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/firewall/security/spoof-detection
 * @desc    Run spoofing detection check
 * @access  Admin
 */
router.get('/security/spoof-detection', authenticateAdmin, (req, res) => {
  try {
    const result = bindingService.detectSpoofingAttempts();
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to run spoofing detection',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/firewall/cleanup
 * @desc    Manually trigger cleanup of expired sessions
 * @access  Admin
 */
router.post('/cleanup', authenticateAdmin, async (req, res) => {
  try {
    const result = await ruleEngine.cleanupExpiredSessions();
    
    res.json({
      success: true,
      message: `Cleaned up ${result.cleaned} expired sessions`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to run cleanup',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/firewall/grant-access
 * @desc    Manually grant access to a client (for testing)
 * @access  Admin
 */
router.post('/grant-access', authenticateAdmin, async (req, res) => {
  try {
    const { sessionId, macAddress, ipAddress, authMethod } = req.body;
    
    if (!macAddress || !ipAddress) {
      return res.status(400).json({
        success: false,
        message: 'macAddress and ipAddress are required',
      });
    }
    
    const result = await ruleEngine.grantClientAccess({
      sessionId: sessionId || `manual-${Date.now()}`,
      macAddress,
      ipAddress,
      authMethod: authMethod || 'manual',
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to grant access',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/firewall/revoke-access
 * @desc    Manually revoke access from a client
 * @access  Admin
 */
router.post('/revoke-access', authenticateAdmin, async (req, res) => {
  try {
    const { sessionId, macAddress, ipAddress } = req.body;
    
    if (!macAddress || !ipAddress) {
      return res.status(400).json({
        success: false,
        message: 'macAddress and ipAddress are required',
      });
    }
    
    const result = await ruleEngine.revokeClientAccess({
      sessionId: sessionId || 'manual',
      macAddress,
      ipAddress,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to revoke access',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/firewall/explain
 * @desc    Get educational explanation of the firewall system
 * @access  Public (educational)
 */
router.get('/explain', (req, res) => {
  const explanations = {
    ruleEngine: ruleEngine.explainRuleEngine(),
    layer2Isolation: ebtablesService.explainL2Isolation(),
    macIpBinding: bindingService.explainBindingSecurity(),
  };
  
  res.json({
    success: true,
    data: explanations,
  });
});

/**
 * @route   GET /api/firewall/validate/:mac/:ip
 * @desc    Validate a MAC/IP binding
 * @access  Admin
 */
router.get('/validate/:mac/:ip', authenticateAdmin, (req, res) => {
  try {
    const mac = req.params.mac.replace(/-/g, ':');
    const ip = req.params.ip;
    
    const result = bindingService.validateBinding(mac, ip);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to validate binding',
      error: error.message,
    });
  }
});

module.exports = router;
