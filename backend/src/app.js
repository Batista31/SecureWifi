/**
 * WiFi Captive Portal - Main Application Entry Point
 * 
 * This is the core Express.js server that handles:
 * - Captive portal detection and redirection
 * - User authentication (voucher codes + registration)
 * - Session management
 * - REST APIs for admin dashboard
 * - Security rule simulation
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth.routes');
const sessionRoutes = require('./routes/session.routes');
const adminRoutes = require('./routes/admin.routes');
const portalRoutes = require('./routes/portal.routes');
const monitoringRoutes = require('./routes/monitoring.routes');
const firewallRoutes = require('./routes/firewall.routes');

// Import middleware
const { errorHandler } = require('./middleware/error.middleware');
const { captivePortalDetection } = require('./middleware/portal.middleware');

// Import services
const { initializeDatabase } = require('./services/database.service');
const { logEvent } = require('./services/logging.service');
const ruleEngine = require('./services/firewall/rule-engine.service');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ===========================================
// Security Middleware
// ===========================================

// Helmet for security headers (configured for captive portal compatibility)
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for captive portal compatibility
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://192.168.4.1:3000'],
  credentials: true,
}));

// Rate limiting to prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ===========================================
// Body Parsing & Logging
// ===========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
if (process.env.LOG_LEVEL !== 'minimal') {
  app.use(morgan('combined', {
    skip: (req, res) => req.path.startsWith('/assets'),
  }));
}

// ===========================================
// Static Files - Captive Portal
// ===========================================

// Serve captive portal static files
app.use('/portal', express.static(path.join(__dirname, '../../portal')));
app.use('/assets', express.static(path.join(__dirname, '../../portal/assets')));

// Serve admin dashboard
app.use('/admin', express.static(path.join(__dirname, '../../dashboard/dist')));
// Handle SPA routing for admin dashboard
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dashboard/dist/index.html'));
});

// ===========================================
// Captive Portal Detection
// ===========================================

// Standard captive portal detection endpoints
// These are hit by devices to check internet connectivity
const portalDetectionPaths = [
  '/generate_204',           // Android
  '/gen_204',                // Android alternative
  '/hotspot-detect.html',    // Apple iOS/macOS
  '/library/test/success.html', // Apple alternative
  '/ncsi.txt',               // Windows
  '/connecttest.txt',        // Windows 10+
  '/redirect',               // Generic
  '/success.txt',            // Generic
];

portalDetectionPaths.forEach(detectionPath => {
  app.get(detectionPath, captivePortalDetection);
});

// ===========================================
// API Routes
// ===========================================

// Portal routes (public - for captive portal pages)
app.use('/api/portal', portalRoutes);

// Authentication routes (public)
app.use('/api/auth', authLimiter, authRoutes);

// Session routes (requires authentication)
app.use('/api/sessions', sessionRoutes);

// Admin routes (requires admin authentication)
app.use('/api/admin', adminRoutes);

// Monitoring routes (for dashboard)
app.use('/api/monitoring', monitoringRoutes);

// Firewall routes (admin only)
app.use('/api/firewall', firewallRoutes);

// ===========================================
// Portal Page Routes
// ===========================================

// Serve portal pages
app.get('/', (req, res) => {
  res.redirect('/portal/index.html');
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../../portal/login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../../portal/register.html'));
});

app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, '../../portal/success.html'));
});

// ===========================================
// Health Check Endpoint
// ===========================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    mode: process.env.SECURITY_MODE || 'production',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ===========================================
// 404 Handler - Redirect to Portal
// ===========================================

app.use((req, res, next) => {
  // For API routes, return 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }

  // For all other routes, redirect to portal (captive portal behavior)
  res.redirect('/portal/index.html');
});

// ===========================================
// Error Handler
// ===========================================

app.use(errorHandler);

// ===========================================
// Server Startup
// ===========================================

async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('✓ Database initialized');

    // Initialize rule engine (firewall)
    await ruleEngine.initialize();
    console.log('✓ Rule engine initialized');

    // Log startup
    await logEvent('SYSTEM', 'SERVER_START', {
      mode: process.env.SECURITY_MODE || 'production',
      port: PORT,
    });

    // Start server
    const server = app.listen(PORT, HOST, () => {
      console.log('\n========================================');
      console.log('  WiFi Captive Portal Server Started');
      console.log('========================================');
      console.log(`  Mode:     ${process.env.SECURITY_MODE || 'production'}`);
      console.log(`  URL:      http://localhost:${PORT}`);
      console.log(`  Portal:   http://localhost:${PORT}/portal`);
      console.log(`  API:      http://localhost:${PORT}/api`);
      console.log('========================================\n');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please stop the other process or use a different port.`);
      } else {
        console.error('Server error:', err);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Keep process alive
process.stdin.resume();

module.exports = app;
