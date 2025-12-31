/**
 * Database Service
 * 
 * Handles database initialization, schema creation, and common operations.
 */

const db = require('../config/database.config');
const bcrypt = require('bcryptjs');
const config = require('../config/app.config');

/**
 * Initialize the database with all required tables
 */
async function initializeDatabase() {
  // Create tables
  db.exec(`
    -- Users table: stores registered user accounts
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      last_login DATETIME
    );

    -- Vouchers table: stores pre-generated access codes
    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      duration_hours INTEGER DEFAULT 4,
      max_devices INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT 'admin',
      expires_at DATETIME,
      used_at DATETIME,
      used_by_device TEXT,
      is_active INTEGER DEFAULT 1,
      notes TEXT
    );

    -- Devices table: stores all known devices (by MAC address)
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mac_address TEXT UNIQUE NOT NULL,
      hostname TEXT,
      vendor TEXT,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_sessions INTEGER DEFAULT 0,
      is_blocked INTEGER DEFAULT 0,
      block_reason TEXT,
      notes TEXT
    );

    -- Sessions table: active and historical sessions
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      voucher_id INTEGER,
      device_id INTEGER NOT NULL,
      mac_address TEXT NOT NULL,
      ip_address TEXT,
      auth_method TEXT NOT NULL, -- 'voucher' | 'user' | 'admin'
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      ended_at DATETIME,
      is_active INTEGER DEFAULT 1,
      firewall_applied INTEGER DEFAULT 0, -- 1 = firewall rules applied
      bytes_uploaded INTEGER DEFAULT 0,
      bytes_downloaded INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
      FOREIGN KEY (device_id) REFERENCES devices(id)
    );

    -- MAC-IP Bindings table: enforced bindings for security
    CREATE TABLE IF NOT EXISTS mac_ip_bindings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mac_address TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      session_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      UNIQUE(mac_address, ip_address)
    );

    -- Firewall Rules table: tracks rules (applied or simulated)
    CREATE TABLE IF NOT EXISTS firewall_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_type TEXT NOT NULL, -- 'iptables' | 'ebtables'
      rule_action TEXT NOT NULL, -- 'ALLOW' | 'DROP' | 'REJECT'
      rule_command TEXT NOT NULL,
      session_id INTEGER,
      mac_address TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      applied_at DATETIME,
      removed_at DATETIME,
      is_active INTEGER DEFAULT 1,
      is_simulated INTEGER DEFAULT 1, -- 1 = simulation mode
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    -- Event Logs table: comprehensive audit logging
    CREATE TABLE IF NOT EXISTS event_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      event_category TEXT NOT NULL, -- 'AUTH' | 'SESSION' | 'SECURITY' | 'ADMIN' | 'SYSTEM'
      severity TEXT DEFAULT 'INFO', -- 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
      mac_address TEXT,
      ip_address TEXT,
      user_id INTEGER,
      session_id INTEGER,
      details TEXT, -- JSON string with additional data
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    -- Admin Users table: separate admin accounts
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin', -- 'admin' | 'viewer'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_active INTEGER DEFAULT 1
    );

    -- System Settings table: runtime configuration
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_sessions_mac ON sessions(mac_address);
    CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_devices_mac ON devices(mac_address);
    CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
    CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_event_logs_created ON event_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_bindings_mac ON mac_ip_bindings(mac_address);
  `);

  // Migration: Add firewall_applied column if it doesn't exist
  try {
    db.exec('ALTER TABLE sessions ADD COLUMN firewall_applied INTEGER DEFAULT 0');
    console.log('✓ Added firewall_applied column to sessions table');
  } catch (e) {
    // Column already exists, ignore
  }

  // Create default admin user if not exists
  await createDefaultAdmin();
  
  // Create some sample vouchers for testing
  await createSampleVouchers();

  return true;
}

/**
 * Create the default admin user
 */
async function createDefaultAdmin() {
  const adminExists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(config.admin.username);
  
  if (!adminExists) {
    const passwordHash = await bcrypt.hash(config.admin.password, config.security.bcryptRounds);
    
    db.prepare(`
      INSERT INTO admin_users (username, password_hash, role)
      VALUES (?, ?, 'admin')
    `).run(config.admin.username, passwordHash);
    
    console.log(`✓ Default admin user created: ${config.admin.username}`);
  }
}

/**
 * Create sample vouchers for testing
 */
async function createSampleVouchers() {
  const voucherCount = db.prepare('SELECT COUNT(*) as count FROM vouchers').get();
  
  if (voucherCount.count === 0) {
    const sampleVouchers = [
      { code: 'TEST1234', duration: 4, devices: 2, notes: 'Test voucher 1' },
      { code: 'DEMO5678', duration: 8, devices: 1, notes: 'Demo voucher' },
      { code: 'WIFI2024', duration: 24, devices: 3, notes: 'Long duration voucher' },
    ];
    
    const insertStmt = db.prepare(`
      INSERT INTO vouchers (code, duration_hours, max_devices, notes)
      VALUES (?, ?, ?, ?)
    `);
    
    for (const voucher of sampleVouchers) {
      insertStmt.run(voucher.code, voucher.duration, voucher.devices, voucher.notes);
    }
    
    console.log(`✓ Sample vouchers created: ${sampleVouchers.map(v => v.code).join(', ')}`);
  }
}

/**
 * Clean up expired sessions and bindings
 */
function cleanupExpiredSessions() {
  const now = new Date().toISOString();
  
  // Deactivate expired sessions
  const result = db.prepare(`
    UPDATE sessions 
    SET is_active = 0, ended_at = ?
    WHERE is_active = 1 AND expires_at < ?
  `).run(now, now);
  
  // Deactivate expired MAC-IP bindings
  db.prepare(`
    UPDATE mac_ip_bindings 
    SET is_active = 0
    WHERE is_active = 1 AND expires_at < ?
  `).run(now);
  
  // Deactivate related firewall rules
  db.prepare(`
    UPDATE firewall_rules 
    SET is_active = 0, removed_at = ?
    WHERE is_active = 1 AND session_id IN (
      SELECT id FROM sessions WHERE is_active = 0
    )
  `).run(now);
  
  return result.changes;
}

module.exports = {
  db,
  initializeDatabase,
  cleanupExpiredSessions,
};
