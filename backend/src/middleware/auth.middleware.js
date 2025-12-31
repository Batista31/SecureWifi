/**
 * Authentication Middleware
 * 
 * Validates JWT tokens and checks session status.
 */

const { verifyToken, validateSession } = require('../services/auth.service');
const db = require('../config/database.config');
const config = require('../config/app.config');
const bcrypt = require('bcryptjs');

/**
 * Authenticate user session via JWT token
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  const result = validateSession(token);
  
  if (!result.valid) {
    return res.status(403).json({ error: result.message });
  }
  
  req.session = result.session;
  req.token = token;
  next();
}

/**
 * Authenticate admin via JWT token
 */
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Admin token required' });
  }
  
  const decoded = verifyToken(token);
  
  if (!decoded || !decoded.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  // Verify admin exists and is active
  const admin = db.prepare(`
    SELECT * FROM admin_users WHERE id = ? AND is_active = 1
  `).get(decoded.adminId);
  
  if (!admin) {
    return res.status(403).json({ error: 'Admin account not found or deactivated' });
  }
  
  req.admin = admin;
  next();
}

/**
 * Optional authentication - doesn't fail if no token
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    const result = validateSession(token);
    if (result.valid) {
      req.session = result.session;
    }
  }
  
  next();
}

/**
 * Admin login (returns JWT)
 */
async function loginAdmin(username, password) {
  const admin = db.prepare(`
    SELECT * FROM admin_users WHERE username = ? AND is_active = 1
  `).get(username);
  
  if (!admin) {
    return { success: false, message: 'Invalid credentials' };
  }
  
  const validPassword = await bcrypt.compare(password, admin.password_hash);
  
  if (!validPassword) {
    return { success: false, message: 'Invalid credentials' };
  }
  
  // Update last login
  db.prepare('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(admin.id);
  
  // Generate admin token
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { adminId: admin.id, username: admin.username, role: admin.role, isAdmin: true },
    config.security.jwtSecret,
    { expiresIn: '8h' }
  );
  
  return {
    success: true,
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      role: admin.role,
    },
  };
}

module.exports = {
  authenticateToken,
  authenticateAdmin,
  optionalAuth,
  loginAdmin,
};
