/**
 * WiFi Captive Portal - Success Page JavaScript
 * 
 * Displays session information and handles session management.
 */

let countdownInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check if user has a valid session
  const hasSession = await checkAndDisplaySession();

  if (!hasSession) {
    // Redirect to login if no valid session
    window.location.href = 'login.html';
    return;
  }

  // Initialize buttons
  initButtons();

  // Start countdown timer
  startCountdown();
});

/**
 * Check session and display info
 */
async function checkAndDisplaySession() {
  // FIRST: Check local storage - trust it if valid
  const stored = session.get();
  if (stored && stored.info) {
    const expiresAt = new Date(stored.info.expiresAt);

    if (expiresAt > new Date()) {
      // Local session is valid - display it immediately
      displaySessionInfo({
        ...stored.info,
        authenticated: true,
      });
      return true;
    }
  }

  // Only check API if no local session
  try {
    const status = await api.getStatus();

    if (status.authenticated) {
      displaySessionInfo(status);
      return true;
    }
  } catch (error) {
    console.error('Failed to check session:', error);
  }

  return false;
}

/**
 * Display session information
 */
function displaySessionInfo(data) {
  // Status
  const statusEl = document.getElementById('session-status');
  if (statusEl) {
    statusEl.textContent = 'Active';
    statusEl.className = 'info-value status-active';
  }

  // Time remaining
  updateTimeRemaining(data.expiresAt || data.expires_at);

  // Connected since
  const connectedEl = document.getElementById('connected-since');
  if (connectedEl && (data.startedAt || data.started_at)) {
    connectedEl.textContent = ui.formatDateTime(data.startedAt || data.started_at);
  }

  // Auth method
  const authMethodEl = document.getElementById('auth-method');
  if (authMethodEl) {
    const method = data.authMethod || data.auth_method || 'Unknown';
    authMethodEl.textContent = method.charAt(0).toUpperCase() + method.slice(1);
  }

  // MAC Address
  const macEl = document.getElementById('mac-address');
  if (macEl) {
    macEl.textContent = data.macAddress || data.mac_address || getSimulatedMac();
  }

  // IP Address
  const ipEl = document.getElementById('ip-address');
  if (ipEl) {
    ipEl.textContent = data.ipAddress || data.ip_address || 'Assigned';
  }

  // Store expiry for countdown
  window.sessionExpiresAt = data.expiresAt || data.expires_at;
}

/**
 * Update time remaining display
 */
function updateTimeRemaining(expiresAt) {
  const timeEl = document.getElementById('time-remaining');
  if (!timeEl || !expiresAt) return;

  const expires = new Date(expiresAt);
  const now = new Date();
  const diffMs = expires - now;

  if (diffMs <= 0) {
    timeEl.textContent = 'Expired';
    timeEl.style.color = 'var(--danger-color)';

    // Clear interval and show message
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    ui.showMessage('error', 'Your session has expired. Please reconnect.');
    return;
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  timeEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Change color when less than 30 minutes
  if (diffMs < 30 * 60 * 1000) {
    timeEl.style.color = 'var(--warning-color)';
  }

  // Change color when less than 5 minutes
  if (diffMs < 5 * 60 * 1000) {
    timeEl.style.color = 'var(--danger-color)';
  }
}

/**
 * Start countdown timer
 */
function startCountdown() {
  // Update immediately
  if (window.sessionExpiresAt) {
    updateTimeRemaining(window.sessionExpiresAt);
  }

  // Update every second
  countdownInterval = setInterval(() => {
    if (window.sessionExpiresAt) {
      updateTimeRemaining(window.sessionExpiresAt);
    }
  }, 1000);
}

/**
 * Initialize action buttons
 */
function initButtons() {
  // Test connection button
  const testBtn = document.getElementById('test-connection');
  if (testBtn) {
    testBtn.addEventListener('click', testConnection);
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

/**
 * Test internet connection
 */
async function testConnection() {
  const testResult = document.getElementById('test-result');
  const testIcon = testResult?.querySelector('.test-icon');
  const testText = testResult?.querySelector('.test-text');

  if (!testResult) return;

  testResult.classList.remove('hidden', 'error');
  testIcon.textContent = '⏳';
  testText.textContent = 'Testing connection...';

  try {
    // Try to fetch a known URL (in production, this would be an actual internet resource)
    const response = await fetch('/api/health', { cache: 'no-store' });

    if (response.ok) {
      testIcon.textContent = '✓';
      testText.textContent = 'Internet connection is working!';
      testResult.classList.remove('error');
    } else {
      throw new Error('Connection test failed');
    }
  } catch (error) {
    testIcon.textContent = '✗';
    testText.textContent = 'Connection test failed. Please check your connection.';
    testResult.classList.add('error');
  }
}

/**
 * Handle logout/disconnect
 */
async function handleLogout() {
  const logoutBtn = document.getElementById('logout-btn');

  if (!confirm('Are you sure you want to disconnect?')) {
    return;
  }

  logoutBtn.disabled = true;
  logoutBtn.textContent = 'Disconnecting...';

  try {
    await api.logout();
  } catch (error) {
    console.error('Logout error:', error);
  }

  // Clear local session
  session.clear();

  // Stop countdown
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  // Redirect to portal
  window.location.href = 'index.html';
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});
