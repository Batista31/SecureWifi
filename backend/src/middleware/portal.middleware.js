/**
 * Captive Portal Detection Middleware
 * 
 * Handles captive portal detection requests from various OS.
 * These endpoints are hit by devices to check internet connectivity.
 */

const { hasActiveSession } = require('../services/session.service');
const { normalizeMacAddress } = require('../services/auth.service');
const config = require('../config/app.config');

/**
 * Get client MAC address from request
 * In production, this comes from ARP table or DHCP leases
 * In simulation, we use a header or generate one
 */
function getClientMac(req) {
  // In simulation mode, check for custom header
  const headerMac = req.headers['x-client-mac'];
  if (headerMac) {
    return normalizeMacAddress(headerMac);
  }

  // In production, query ARP table based on IP
  let ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  ip = ip.replace('::ffff:', ''); // Clean IPv6 prefix

  if (process.env.SECURITY_MODE === 'production' || config.security.mode === 'production') {
    try {
      const { execSync } = require('child_process');
      // Run arp -a and look for the IP
      const arpOutput = execSync(`arp -n ${ip}`).toString();
      // Output format: ? (192.168.4.203) at 70:d8:23:76:50:f7 [ether] on wlan0
      // OR: 192.168.4.203            ether   70:d8:23:76:50:f7   C                     wlan0
      const macMatch = arpOutput.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);

      if (macMatch) {
        return normalizeMacAddress(macMatch[0]);
      }
    } catch (e) {
      console.error(`Failed to resolve MAC for IP ${ip}:`, e.message);
    }
  }

  // Fallback: Simulate MAC from IP (for simulation/dev only)
  const ipParts = ip.split('.');
  if (ipParts.length === 4) {
    return `02:00:${ipParts.map(p => parseInt(p).toString(16).padStart(2, '0')).join(':')}`.substring(0, 17);
  }

  return '02:00:00:00:00:01'; // Default simulation MAC
}

/**
 * Get client IP address
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    '127.0.0.1';
}

/**
 * Captive portal detection handler
 * 
 * Different operating systems hit different endpoints:
 * - Android: /generate_204 (expects HTTP 204)
 * - iOS/macOS: /hotspot-detect.html (expects specific content)
 * - Windows: /ncsi.txt or /connecttest.txt
 */
function captivePortalDetection(req, res) {
  const macAddress = getClientMac(req);
  const clientIp = getClientIp(req);

  // Check if device has active session
  const hasSession = hasActiveSession(macAddress);

  // Store client info in locals for logging
  res.locals.clientMac = macAddress;
  res.locals.clientIp = clientIp;

  const path = req.path.toLowerCase();

  if (hasSession) {
    // Device is authenticated - return "connected" responses
    return handleAuthenticatedDevice(path, res);
  }

  // Device is not authenticated - trigger captive portal
  return handleUnauthenticatedDevice(path, req, res);
}

/**
 * Handle authenticated device - return success responses
 */
function handleAuthenticatedDevice(path, res) {
  // Android
  if (path.includes('generate_204') || path.includes('gen_204')) {
    return res.status(204).send();
  }

  // Apple iOS/macOS
  if (path.includes('hotspot-detect') || path.includes('success')) {
    return res.send('<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>');
  }

  // Windows
  if (path.includes('ncsi.txt')) {
    return res.send('Microsoft NCSI');
  }

  if (path.includes('connecttest.txt')) {
    return res.send('Microsoft Connect Test');
  }

  // Generic success
  return res.status(204).send();
}

/**
 * Handle unauthenticated device - redirect to portal
 */
function handleUnauthenticatedDevice(path, req, res) {
  const portalUrl = process.env.NODE_ENV === 'production'
    ? config.network.portalUrl
    : `http://${req.headers.host}`;

  // Android - return non-204 to trigger portal
  if (path.includes('generate_204') || path.includes('gen_204')) {
    return res.redirect(302, `${portalUrl}/portal/index.html`);
  }

  // Apple iOS/macOS - return redirect
  if (path.includes('hotspot-detect') || path.includes('library/test')) {
    // iOS expects a specific redirect pattern
    return res.status(200).send(`
      <HTML>
        <HEAD>
          <TITLE>Captive Portal</TITLE>
          <META HTTP-EQUIV="refresh" CONTENT="0;URL=${portalUrl}/portal/index.html">
        </HEAD>
        <BODY>
          <a href="${portalUrl}/portal/index.html">Click here to connect</a>
        </BODY>
      </HTML>
    `);
  }

  // Windows
  if (path.includes('ncsi.txt') || path.includes('connecttest.txt')) {
    // Return wrong content to trigger portal
    return res.redirect(302, `${portalUrl}/portal/index.html`);
  }

  // Generic redirect
  return res.redirect(302, `${portalUrl}/portal/index.html`);
}

/**
 * Middleware to extract client info and attach to request
 */
function extractClientInfo(req, res, next) {
  req.clientMac = getClientMac(req);
  req.clientIp = getClientIp(req);
  next();
}

module.exports = {
  captivePortalDetection,
  extractClientInfo,
  getClientMac,
  getClientIp,
};
