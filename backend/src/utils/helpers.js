/**
 * Helper Utilities
 * 
 * Common utility functions used across the application.
 */

/**
 * Generate a random string
 */
function generateRandomString(length, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Normalize MAC address to lowercase colon-separated format
 */
function normalizeMac(mac) {
  if (!mac) return null;
  
  // Remove all separators
  const clean = mac.replace(/[:-]/g, '').toLowerCase();
  
  if (clean.length !== 12) return null;
  
  // Format as xx:xx:xx:xx:xx:xx
  return clean.match(/.{2}/g).join(':');
}

/**
 * Validate MAC address format
 */
function isValidMac(mac) {
  return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac);
}

/**
 * Validate IP address format
 */
function isValidIp(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255 && part === num.toString();
  });
}

/**
 * Sleep utility (async)
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse duration string to milliseconds
 * Supports: 1h, 30m, 2d, 1w
 */
function parseDuration(duration) {
  const match = duration.match(/^(\d+)([smhdw])$/);
  if (!match) return null;
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  
  return value * multipliers[unit];
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Sanitize string for safe display
 */
function sanitize(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  generateRandomString,
  normalizeMac,
  isValidMac,
  isValidIp,
  sleep,
  parseDuration,
  formatBytes,
  sanitize,
};
