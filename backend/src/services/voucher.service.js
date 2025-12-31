/**
 * Voucher Service
 * 
 * Handles voucher generation, management, and validation.
 */

const db = require('../config/database.config');
const config = require('../config/app.config');

/**
 * Generate a random voucher code
 */
function generateVoucherCode(length = config.voucher.codeLength) {
  const charset = config.voucher.charset;
  let code = '';
  
  for (let i = 0; i < length; i++) {
    code += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return code;
}

/**
 * Create new vouchers
 * 
 * @param {number} count - Number of vouchers to create
 * @param {object} options - Voucher options
 * @returns {array} - Created voucher codes
 */
function createVouchers(count, options = {}) {
  const {
    durationHours = config.voucher.defaultDurationHours,
    maxDevices = 1,
    expiresAt = null,
    notes = '',
    createdBy = 'admin',
  } = options;
  
  const vouchers = [];
  const insertStmt = db.prepare(`
    INSERT INTO vouchers (code, duration_hours, max_devices, expires_at, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  for (let i = 0; i < count; i++) {
    let code;
    let attempts = 0;
    
    // Ensure unique code
    do {
      code = generateVoucherCode();
      attempts++;
    } while (
      db.prepare('SELECT id FROM vouchers WHERE code = ?').get(code) &&
      attempts < 10
    );
    
    if (attempts >= 10) {
      throw new Error('Failed to generate unique voucher code');
    }
    
    insertStmt.run(code, durationHours, maxDevices, expiresAt, notes, createdBy);
    vouchers.push(code);
  }
  
  return vouchers;
}

/**
 * Get all vouchers with usage info
 */
function getAllVouchers(options = {}) {
  const { includeUsed = true, includeExpired = false } = options;
  
  let query = `
    SELECT 
      v.*,
      (SELECT COUNT(DISTINCT mac_address) FROM sessions WHERE voucher_id = v.id AND is_active = 1) as active_devices,
      (SELECT COUNT(*) FROM sessions WHERE voucher_id = v.id) as total_uses
    FROM vouchers v
    WHERE 1=1
  `;
  
  if (!includeUsed) {
    query += ' AND v.used_at IS NULL';
  }
  
  if (!includeExpired) {
    query += ' AND (v.expires_at IS NULL OR v.expires_at > datetime("now"))';
  }
  
  query += ' ORDER BY v.created_at DESC';
  
  return db.prepare(query).all();
}

/**
 * Get voucher by code
 */
function getVoucherByCode(code) {
  return db.prepare(`
    SELECT 
      v.*,
      (SELECT COUNT(DISTINCT mac_address) FROM sessions WHERE voucher_id = v.id AND is_active = 1) as active_devices
    FROM vouchers v
    WHERE v.code = ?
  `).get(code.toUpperCase());
}

/**
 * Deactivate a voucher
 */
function deactivateVoucher(voucherId) {
  const result = db.prepare(`
    UPDATE vouchers SET is_active = 0 WHERE id = ?
  `).run(voucherId);
  
  return result.changes > 0;
}

/**
 * Get voucher statistics
 */
function getVoucherStats() {
  return {
    total: db.prepare('SELECT COUNT(*) as count FROM vouchers').get().count,
    active: db.prepare('SELECT COUNT(*) as count FROM vouchers WHERE is_active = 1').get().count,
    used: db.prepare('SELECT COUNT(*) as count FROM vouchers WHERE used_at IS NOT NULL').get().count,
    unused: db.prepare('SELECT COUNT(*) as count FROM vouchers WHERE used_at IS NULL AND is_active = 1').get().count,
    expired: db.prepare(`
      SELECT COUNT(*) as count FROM vouchers 
      WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
    `).get().count,
  };
}

/**
 * Bulk delete unused vouchers
 */
function deleteUnusedVouchers(olderThanDays = 30) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  
  const result = db.prepare(`
    DELETE FROM vouchers 
    WHERE used_at IS NULL AND created_at < ?
  `).run(cutoff);
  
  return result.changes;
}

module.exports = {
  generateVoucherCode,
  createVouchers,
  getAllVouchers,
  getVoucherByCode,
  deactivateVoucher,
  getVoucherStats,
  deleteUnusedVouchers,
};
