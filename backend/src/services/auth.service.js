/**
 * Authentication Service
 * 
 * Handles user and voucher authentication, token generation,
 * and session creation.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database.config');
const config = require('../config/app.config');
const { securityLog } = require('./logging.service');

// Lazy-load to avoid circular dependency
let sessionFirewallService = null;
function getSessionFirewallService() {
  if (!sessionFirewallService) {
    sessionFirewallService = require('./session-firewall.service');
  }
  return sessionFirewallService;
}

/**
 * Authenticate with a voucher code
 * 
 * @param {string} code - Voucher code
 * @param {string} macAddress - Device MAC address
 * @param {string} ipAddress - Device IP address
 * @returns {object} - { success, token, expiresAt, message }
 */
async function authenticateWithVoucher(code, macAddress, ipAddress) {
  const normalizedMac = normalizeMacAddress(macAddress);

  // Find voucher
  const voucher = db.prepare(`
    SELECT * FROM vouchers 
    WHERE code = ? AND is_active = 1
  `).get(code.toUpperCase());

  if (!voucher) {
    securityLog.authFailure(normalizedMac, ipAddress, 'Invalid voucher code');
    return { success: false, message: 'Invalid voucher code' };
  }

  // Check if voucher is expired
  if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
    securityLog.authFailure(normalizedMac, ipAddress, 'Voucher expired');
    return { success: false, message: 'Voucher has expired' };
  }

  // Check device count for this voucher
  const deviceCount = db.prepare(`
    SELECT COUNT(DISTINCT mac_address) as count 
    FROM sessions 
    WHERE voucher_id = ? AND is_active = 1
  `).get(voucher.id);

  // Check if this MAC is already using this voucher
  const existingSession = db.prepare(`
    SELECT * FROM sessions 
    WHERE voucher_id = ? AND mac_address = ? AND is_active = 1
  `).get(voucher.id, normalizedMac);

  if (!existingSession && deviceCount.count >= voucher.max_devices) {
    securityLog.authFailure(normalizedMac, ipAddress, 'Voucher device limit reached');
    return {
      success: false,
      message: `Maximum devices (${voucher.max_devices}) reached for this voucher`
    };
  }

  // Create or update device record
  const device = await getOrCreateDevice(normalizedMac);

  if (device.is_blocked) {
    securityLog.authFailure(normalizedMac, ipAddress, 'Device is blocked');
    return { success: false, message: 'This device has been blocked' };
  }

  // If existing active session, return that token
  if (existingSession) {
    const token = generateToken(existingSession);
    return {
      success: true,
      token,
      sessionId: existingSession.id,
      expiresAt: existingSession.expires_at,
      message: 'Session resumed',
    };
  }

  // Create new session
  const session = await createSession({
    voucherId: voucher.id,
    deviceId: device.id,
    macAddress: normalizedMac,
    ipAddress,
    authMethod: 'voucher',
    durationHours: voucher.duration_hours,
  });

  // Mark voucher as used (first use)
  if (!voucher.used_at) {
    db.prepare(`
      UPDATE vouchers SET used_at = CURRENT_TIMESTAMP, used_by_device = ?
      WHERE id = ?
    `).run(normalizedMac, voucher.id);
  }

  securityLog.authSuccess(normalizedMac, ipAddress, 'voucher');

  return {
    success: true,
    token: session.token,
    sessionId: session.id,
    expiresAt: session.expiresAt,
    message: 'Authentication successful',
  };
}

/**
 * Authenticate with username/password
 */
async function authenticateWithCredentials(username, password, macAddress, ipAddress) {
  const normalizedMac = normalizeMacAddress(macAddress);

  // Find user
  const user = db.prepare(`
    SELECT * FROM users WHERE username = ? AND is_active = 1
  `).get(username);

  if (!user) {
    securityLog.authFailure(normalizedMac, ipAddress, 'User not found');
    return { success: false, message: 'Invalid username or password' };
  }

  // Verify password
  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    securityLog.authFailure(normalizedMac, ipAddress, 'Invalid password');
    return { success: false, message: 'Invalid username or password' };
  }

  // Check device
  const device = await getOrCreateDevice(normalizedMac);

  if (device.is_blocked) {
    securityLog.authFailure(normalizedMac, ipAddress, 'Device is blocked');
    return { success: false, message: 'This device has been blocked' };
  }

  // Check max devices for this user
  const activeDevices = db.prepare(`
    SELECT COUNT(DISTINCT mac_address) as count 
    FROM sessions 
    WHERE user_id = ? AND is_active = 1
  `).get(user.id);

  const existingSession = db.prepare(`
    SELECT * FROM sessions 
    WHERE user_id = ? AND mac_address = ? AND is_active = 1
  `).get(user.id, normalizedMac);

  if (!existingSession && activeDevices.count >= config.session.maxDevicesPerUser) {
    securityLog.authFailure(normalizedMac, ipAddress, 'Device limit reached');
    return {
      success: false,
      message: `Maximum devices (${config.session.maxDevicesPerUser}) reached`
    };
  }

  // Return existing session or create new
  if (existingSession) {
    const token = generateToken(existingSession);
    return {
      success: true,
      token,
      sessionId: existingSession.id,
      expiresAt: existingSession.expires_at,
      message: 'Session resumed',
    };
  }

  // Create session
  const session = await createSession({
    userId: user.id,
    deviceId: device.id,
    macAddress: normalizedMac,
    ipAddress,
    authMethod: 'user',
    durationHours: config.session.durationHours,
  });

  // Update user last login
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  securityLog.authSuccess(normalizedMac, ipAddress, 'user', user.id);

  return {
    success: true,
    token: session.token,
    sessionId: session.id,
    expiresAt: session.expiresAt,
    message: 'Authentication successful',
  };
}

/**
 * Register a new user
 */
async function registerUser(userData) {
  const { username, password, email, phone } = userData;

  // Check if username exists
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

  if (existing) {
    return { success: false, message: 'Username already exists' };
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);

  // Insert user
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, email, phone)
    VALUES (?, ?, ?, ?)
  `).run(username, passwordHash, email || null, phone || null);

  return {
    success: true,
    userId: result.lastInsertRowid,
    message: 'Registration successful',
  };
}

/**
 * Create a new session
 */
async function createSession({ userId, voucherId, deviceId, macAddress, ipAddress, authMethod, durationHours }) {
  const sessionToken = uuidv4();
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

  const result = db.prepare(`
    INSERT INTO sessions (
      session_token, user_id, voucher_id, device_id,
      mac_address, ip_address, auth_method, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionToken,
    userId || null,
    voucherId || null,
    deviceId,
    macAddress,
    ipAddress,
    authMethod,
    expiresAt
  );

  const sessionId = result.lastInsertRowid;

  // Create MAC-IP binding
  db.prepare(`
    INSERT OR REPLACE INTO mac_ip_bindings (mac_address, ip_address, session_id, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(macAddress, ipAddress, sessionId, expiresAt);

  // Update device stats
  db.prepare(`
    UPDATE devices 
    SET last_seen = CURRENT_TIMESTAMP, total_sessions = total_sessions + 1
    WHERE id = ?
  `).run(deviceId);

  // Log session creation
  securityLog.sessionCreated(sessionId, macAddress, ipAddress);

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);

  // Apply firewall rules for this session (async, don't block auth)
  try {
    const firewallService = getSessionFirewallService();
    firewallService.onSessionCreated(session).catch(err => {
      console.error('[AUTH] Background firewall rule application failed:', err);
    });
  } catch (err) {
    console.error('[AUTH] Failed to trigger firewall rules:', err);
  }

  return {
    id: sessionId,
    token: generateToken(session),
    expiresAt,
  };
}

/**
 * Generate JWT token
 */
function generateToken(session) {
  return jwt.sign(
    {
      sessionId: session.id,
      macAddress: session.mac_address,
      authMethod: session.auth_method,
    },
    config.security.jwtSecret,
    { expiresIn: config.security.jwtExpiry }
  );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.security.jwtSecret);
  } catch (error) {
    return null;
  }
}

/**
 * Get or create device record
 */
async function getOrCreateDevice(macAddress) {
  let device = db.prepare('SELECT * FROM devices WHERE mac_address = ?').get(macAddress);

  if (!device) {
    const result = db.prepare(`
      INSERT INTO devices (mac_address) VALUES (?)
    `).run(macAddress);

    device = db.prepare('SELECT * FROM devices WHERE id = ?').get(result.lastInsertRowid);
  } else {
    // Update last seen
    db.prepare('UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(device.id);
  }

  return device;
}

/**
 * Normalize MAC address format (lowercase, colon-separated)
 */
function normalizeMacAddress(mac) {
  if (!mac) return '00:00:00:00:00:00';

  // Remove all separators and convert to lowercase
  const clean = mac.replace(/[:-]/g, '').toLowerCase();

  // Format as xx:xx:xx:xx:xx:xx
  return clean.match(/.{2}/g)?.join(':') || '00:00:00:00:00:00';
}

/**
 * Validate session by token
 */
function validateSession(token) {
  const decoded = verifyToken(token);

  if (!decoded) {
    return { valid: false, message: 'Invalid token' };
  }

  const session = db.prepare(`
    SELECT * FROM sessions 
    WHERE id = ? AND is_active = 1
  `).get(decoded.sessionId);

  if (!session) {
    return { valid: false, message: 'Session not found or expired' };
  }

  if (new Date(session.expires_at) < new Date()) {
    // Deactivate expired session
    db.prepare('UPDATE sessions SET is_active = 0 WHERE id = ?').run(session.id);
    return { valid: false, message: 'Session expired' };
  }

  return { valid: true, session };
}

/**
 * End a session
 */
async function endSession(sessionId) {
  try {
    const firewallService = getSessionFirewallService();
    // usage of logoutSession which handles DB update and firewall rule removal
    await firewallService.logoutSession(sessionId);

    // Legacy cleanup (just in case) - though logoutSession handles it
    db.prepare(`
      UPDATE mac_ip_bindings SET is_active = 0 WHERE session_id = ?
    `).run(sessionId);

  } catch (error) {
    console.error('Failed to end session:', error);
    // Fallback if firewall service fails
    db.prepare(`
      UPDATE sessions 
      SET is_active = 0, ended_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(sessionId);
  }
}

module.exports = {
  authenticateWithVoucher,
  authenticateWithCredentials,
  registerUser,
  validateSession,
  verifyToken,
  endSession,
  normalizeMacAddress,
  getOrCreateDevice,
};
