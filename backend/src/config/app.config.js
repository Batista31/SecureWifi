/**
 * Application Configuration
 * 
 * Centralized configuration loaded from environment variables.
 * This allows easy switching between development and production modes.
 */

const config = {
  // Application
  app: {
    name: 'WiFi Captive Portal',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || 'localhost',
  },
  
  // Security
  security: {
    mode: process.env.SECURITY_MODE || 'simulation', // 'simulation' | 'production'
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
    jwtExpiry: parseInt(process.env.JWT_EXPIRY, 10) || 14400, // 4 hours in seconds
    bcryptRounds: 10,
  },
  
  // Session
  session: {
    durationHours: parseInt(process.env.SESSION_DURATION_HOURS, 10) || 4,
    maxDevicesPerUser: parseInt(process.env.MAX_DEVICES_PER_USER, 10) || 2,
  },
  
  // Admin
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },
  
  // Network (for production/hardware mode)
  network: {
    wifiInterface: process.env.WIFI_INTERFACE || 'wlan0',
    bridgeInterface: process.env.BRIDGE_INTERFACE || 'br0',
    lanInterface: process.env.LAN_INTERFACE || 'eth0',
    portalUrl: process.env.PORTAL_URL || 'http://192.168.4.1:3000',
    dhcp: {
      rangeStart: process.env.DHCP_RANGE_START || '192.168.4.10',
      rangeEnd: process.env.DHCP_RANGE_END || '192.168.4.200',
      leaseTime: process.env.DHCP_LEASE_TIME || '12h',
    },
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'standard', // 'minimal' | 'standard' | 'verbose'
  },
  
  // Voucher settings
  voucher: {
    codeLength: 8,
    defaultDurationHours: 4,
    charset: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // Excludes confusing chars (0,O,1,I)
  },
};

// Validation
if (config.app.env === 'production' && config.security.jwtSecret === 'default-secret-change-me') {
  console.warn('WARNING: Using default JWT secret in production mode!');
}

module.exports = config;
