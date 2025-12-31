/**
 * Logging Service
 * 
 * Handles event logging to database and console.
 * Provides audit trail for security events.
 */

const db = require('../config/database.config');
const config = require('../config/app.config');

// Event categories
const EventCategory = {
  AUTH: 'AUTH',
  SESSION: 'SESSION',
  SECURITY: 'SECURITY',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
  FIREWALL: 'FIREWALL',
};

// Severity levels
const Severity = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
};

/**
 * Log an event to the database and optionally console
 * 
 * @param {string} category - Event category (AUTH, SESSION, etc.)
 * @param {string} eventType - Specific event type (LOGIN_SUCCESS, etc.)
 * @param {object} data - Additional event data
 * @param {string} severity - Event severity level
 */
async function logEvent(category, eventType, data = {}, severity = Severity.INFO) {
  const { macAddress, ipAddress, userId, sessionId, ...details } = data;
  
  try {
    db.prepare(`
      INSERT INTO event_logs (
        event_category, event_type, severity,
        mac_address, ip_address, user_id, session_id, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      category,
      eventType,
      severity,
      macAddress || null,
      ipAddress || null,
      userId || null,
      sessionId || null,
      JSON.stringify(details)
    );
    
    // Console logging based on log level
    if (shouldLogToConsole(severity)) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${severity}] [${category}] ${eventType}`;
      
      if (config.logging.level === 'verbose') {
        console.log(logMessage, data);
      } else {
        console.log(logMessage);
      }
    }
    
  } catch (error) {
    console.error('Failed to log event:', error);
  }
}

/**
 * Determine if event should be logged to console based on config
 */
function shouldLogToConsole(severity) {
  const logLevel = config.logging.level;
  
  if (logLevel === 'minimal') {
    return severity === Severity.ERROR || severity === Severity.CRITICAL;
  }
  
  if (logLevel === 'standard') {
    return severity !== Severity.DEBUG;
  }
  
  // verbose - log everything
  return true;
}

/**
 * Get recent logs with filtering
 */
function getLogs(options = {}) {
  const {
    category,
    severity,
    macAddress,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = options;
  
  let query = 'SELECT * FROM event_logs WHERE 1=1';
  const params = [];
  
  if (category) {
    query += ' AND event_category = ?';
    params.push(category);
  }
  
  if (severity) {
    query += ' AND severity = ?';
    params.push(severity);
  }
  
  if (macAddress) {
    query += ' AND mac_address = ?';
    params.push(macAddress);
  }
  
  if (startDate) {
    query += ' AND created_at >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND created_at <= ?';
    params.push(endDate);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  return db.prepare(query).all(...params);
}

/**
 * Get log statistics
 */
function getLogStats(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  return {
    totalEvents: db.prepare(`
      SELECT COUNT(*) as count FROM event_logs WHERE created_at >= ?
    `).get(since).count,
    
    byCategory: db.prepare(`
      SELECT event_category, COUNT(*) as count 
      FROM event_logs 
      WHERE created_at >= ?
      GROUP BY event_category
    `).all(since),
    
    bySeverity: db.prepare(`
      SELECT severity, COUNT(*) as count 
      FROM event_logs 
      WHERE created_at >= ?
      GROUP BY severity
    `).all(since),
    
    recentErrors: db.prepare(`
      SELECT * FROM event_logs 
      WHERE severity IN ('ERROR', 'CRITICAL') AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(since),
  };
}

/**
 * Security-specific logging helpers
 */
const securityLog = {
  authSuccess: (macAddress, ipAddress, method, userId = null) => {
    logEvent(EventCategory.AUTH, 'AUTH_SUCCESS', {
      macAddress, ipAddress, userId, method,
    }, Severity.INFO);
  },
  
  authFailure: (macAddress, ipAddress, reason) => {
    logEvent(EventCategory.AUTH, 'AUTH_FAILURE', {
      macAddress, ipAddress, reason,
    }, Severity.WARNING);
  },
  
  sessionCreated: (sessionId, macAddress, ipAddress) => {
    logEvent(EventCategory.SESSION, 'SESSION_CREATED', {
      sessionId, macAddress, ipAddress,
    }, Severity.INFO);
  },
  
  sessionExpired: (sessionId, macAddress) => {
    logEvent(EventCategory.SESSION, 'SESSION_EXPIRED', {
      sessionId, macAddress,
    }, Severity.INFO);
  },
  
  suspiciousActivity: (macAddress, ipAddress, activity) => {
    logEvent(EventCategory.SECURITY, 'SUSPICIOUS_ACTIVITY', {
      macAddress, ipAddress, activity,
    }, Severity.WARNING);
  },
  
  ruleApplied: (ruleType, action, macAddress, simulated = true) => {
    logEvent(EventCategory.FIREWALL, 'RULE_APPLIED', {
      macAddress, ruleType, action, simulated,
    }, Severity.INFO);
  },
  
  ruleRemoved: (ruleType, macAddress, simulated = true) => {
    logEvent(EventCategory.FIREWALL, 'RULE_REMOVED', {
      macAddress, ruleType, simulated,
    }, Severity.INFO);
  },
};

module.exports = {
  logEvent,
  getLogs,
  getLogStats,
  securityLog,
  EventCategory,
  Severity,
};
