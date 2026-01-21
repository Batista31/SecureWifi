/**
 * WiFi Captive Portal - Common JavaScript
 * 
 * Shared utilities and functions used across portal pages.
 */

// API Base URL
const API_BASE = window.location.origin;

// Storage keys
const STORAGE_TOKEN = 'wifi_session_token';
const STORAGE_SESSION = 'wifi_session_info';

/**
 * API Client - handles all API calls
 */
const api = {
  /**
   * Make an API request
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE}/api${endpoint}`;
    const token = localStorage.getItem(STORAGE_TOKEN);

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add simulated MAC address header (for development)
    // headers['X-Client-Mac'] = getSimulatedMac();

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  },

  // Auth endpoints
  async authVoucher(code) {
    return this.request('/auth/voucher', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async authLogin(username, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async validateToken() {
    return this.request('/auth/validate', { method: 'POST' });
  },

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  },

  // Portal endpoints
  async getStatus() {
    return this.request('/portal/status');
  },

  async getClientInfo() {
    return this.request('/portal/client-info');
  },

  // Session endpoints
  async getCurrentSession() {
    return this.request('/sessions/current');
  },

  async endSession() {
    return this.request('/sessions/current', { method: 'DELETE' });
  },
};

/**
 * Get or generate a simulated MAC address for development
 * In production, the server would detect the real MAC from ARP table
 */
function getSimulatedMac() {
  let mac = localStorage.getItem('simulated_mac');

  if (!mac) {
    // Generate a random MAC address with local admin bit set
    const hexDigits = '0123456789abcdef';
    mac = '02:'; // Local admin bit set
    for (let i = 0; i < 5; i++) {
      mac += hexDigits[Math.floor(Math.random() * 16)];
      mac += hexDigits[Math.floor(Math.random() * 16)];
      if (i < 4) mac += ':';
    }
    localStorage.setItem('simulated_mac', mac);
  }

  return mac;
}

/**
 * Session management utilities
 */
const session = {
  save(token, sessionInfo) {
    localStorage.setItem(STORAGE_TOKEN, token);
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(sessionInfo));
  },

  get() {
    const token = localStorage.getItem(STORAGE_TOKEN);
    const info = localStorage.getItem(STORAGE_SESSION);

    if (!token) return null;

    return {
      token,
      info: info ? JSON.parse(info) : null,
    };
  },

  clear() {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_SESSION);
  },

  isValid() {
    const stored = this.get();
    if (!stored || !stored.info) return false;

    const expiresAt = new Date(stored.info.expiresAt);
    return expiresAt > new Date();
  },
};

/**
 * UI utilities
 */
const ui = {
  /**
   * Show a message in the message box
   */
  showMessage(type, message) {
    const messageBox = document.getElementById('message-box');
    if (!messageBox) return;

    messageBox.className = `message-box ${type}`;
    messageBox.textContent = message;
    messageBox.classList.remove('hidden');

    // Auto-hide success messages
    if (type === 'success') {
      setTimeout(() => this.hideMessage(), 5000);
    }
  },

  hideMessage() {
    const messageBox = document.getElementById('message-box');
    if (messageBox) {
      messageBox.classList.add('hidden');
    }
  },

  /**
   * Set button loading state
   */
  setButtonLoading(button, loading) {
    const textEl = button.querySelector('.btn-text');
    const loaderEl = button.querySelector('.btn-loader');

    if (loading) {
      button.disabled = true;
      if (textEl) textEl.style.visibility = 'hidden';
      if (loaderEl) loaderEl.classList.remove('hidden');
    } else {
      button.disabled = false;
      if (textEl) textEl.style.visibility = 'visible';
      if (loaderEl) loaderEl.classList.add('hidden');
    }
  },

  /**
   * Format time remaining
   */
  formatTimeRemaining(minutes) {
    if (minutes <= 0) return 'Expired';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} minutes`;
  },

  /**
   * Format date/time
   */
  formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString();
  },
};

/**
 * Check authentication status on page load
 */
async function checkAuthStatus() {
  try {
    const status = await api.getStatus();

    if (status.authenticated) {
      // Show status banner if on index page
      const banner = document.getElementById('status-banner');
      if (banner) {
        banner.classList.remove('hidden');
      }

      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to check auth status:', error);
    return false;
  }
}

/**
 * Update client info display
 */
async function updateClientInfo() {
  try {
    const info = await api.getClientInfo();

    const macEl = document.getElementById('client-mac');
    const ipEl = document.getElementById('client-ip');
    const container = document.getElementById('client-info');

    if (macEl) macEl.textContent = info.macAddress;
    if (ipEl) ipEl.textContent = info.ipAddress;
    if (container && info.simulationMode) {
      container.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Failed to get client info:', error);
  }
}

/**
 * Initialize page
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth status
  await checkAuthStatus();

  // Update client info (for debugging)
  if (document.getElementById('client-info')) {
    await updateClientInfo();
  }
});

// Export for use in other scripts
window.api = api;
window.session = session;
window.ui = ui;
window.getSimulatedMac = getSimulatedMac;
