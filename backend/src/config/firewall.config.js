/**
 * Firewall Configuration
 * 
 * Configuration for iptables/ebtables rule generation.
 * These settings control security automation behavior.
 */

const config = require('./app.config');

const firewallConfig = {
  // Operation mode: 'simulation' | 'production'
  // In simulation mode, rules are logged but not applied
  mode: config.security.mode,

  // Network interfaces (used in production mode)
  interfaces: {
    wifi: process.env.WIFI_INTERFACE || 'wlan0',      // Wireless interface
    bridge: process.env.BRIDGE_INTERFACE || 'wlan0',  // Using wlan0 directly (no bridge)
    lan: process.env.LAN_INTERFACE || 'eth0',         // LAN/Internet interface
  },

  // IP ranges
  network: {
    portalIp: process.env.PORTAL_IP || '192.168.4.1',
    subnet: process.env.NETWORK_SUBNET || '192.168.4.0/24',
    gateway: process.env.GATEWAY_IP || '192.168.4.1',
    dhcpStart: process.env.DHCP_RANGE_START || '192.168.4.10',
    dhcpEnd: process.env.DHCP_RANGE_END || '192.168.4.200',
  },

  // Ports that should always be allowed for captive portal
  portalPorts: {
    http: 80,
    https: 443,
    dns: 53,
    dhcp: [67, 68],
    portal: parseInt(process.env.PORT) || 3000,
  },

  // iptables chain names
  iptables: {
    chains: {
      auth: 'CAPTIVE_AUTH',           // Authenticated clients
      unauth: 'CAPTIVE_UNAUTH',       // Unauthenticated clients  
      isolation: 'CLIENT_ISOLATION',   // Client isolation rules
      macBinding: 'MAC_BINDING',       // MAC/IP binding validation
    },
    tables: {
      filter: 'filter',
      nat: 'nat',
      mangle: 'mangle',
    },
  },

  // ebtables chain names
  ebtables: {
    chains: {
      isolation: 'CLIENT_ISOLATION',   // L2 isolation
      arpProtect: 'ARP_PROTECT',       // ARP spoofing protection
    },
  },

  // Rule templates
  templates: {
    // Allow authenticated client to access internet
    allowInternet: {
      table: 'filter',
      chain: 'FORWARD',
      action: 'ACCEPT',
    },

    // Block unauthenticated client from internet
    blockInternet: {
      table: 'filter',
      chain: 'FORWARD',
      action: 'DROP',
    },

    // Redirect HTTP to portal
    redirectToPortal: {
      table: 'nat',
      chain: 'PREROUTING',
      action: 'REDIRECT',
    },

    // Drop traffic between clients (L2)
    clientIsolation: {
      action: 'DROP',
    },
  },

  // Logging settings
  logging: {
    logPrefix: 'CAPTIVE_PORTAL: ',
    logLevel: 4,  // Warning level
    logDropped: true,
    logAccepted: false,
  },

  // Cleanup settings
  cleanup: {
    intervalMs: 60000,  // Check every minute
    graceperiodMs: 5000, // 5 second grace period after session expires
  },
};

module.exports = firewallConfig;
