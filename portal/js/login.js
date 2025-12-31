/**
 * WiFi Captive Portal - Login Page JavaScript
 * 
 * Handles voucher and username/password authentication.
 */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initVoucherForm();
  initLoginForm();
  
  // Check URL params for default tab
  const urlParams = new URLSearchParams(window.location.search);
  const method = urlParams.get('method');
  
  if (method === 'login') {
    switchTab('login');
  }
});

/**
 * Initialize tab navigation
 */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update forms
  const voucherForm = document.getElementById('voucher-form');
  const loginForm = document.getElementById('login-form');
  
  if (tabName === 'voucher') {
    voucherForm.classList.remove('hidden');
    voucherForm.classList.add('active');
    loginForm.classList.add('hidden');
    loginForm.classList.remove('active');
  } else {
    loginForm.classList.remove('hidden');
    loginForm.classList.add('active');
    voucherForm.classList.add('hidden');
    voucherForm.classList.remove('active');
  }
  
  // Clear messages
  ui.hideMessage();
}

/**
 * Initialize voucher form
 */
function initVoucherForm() {
  const form = document.getElementById('voucher-form');
  const codeInput = document.getElementById('voucher-code');
  
  // Auto-uppercase input
  codeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const code = codeInput.value.trim();
    
    if (!code) {
      ui.showMessage('error', 'Please enter a voucher code');
      return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    ui.setButtonLoading(submitBtn, true);
    ui.hideMessage();
    
    try {
      const result = await api.authVoucher(code);
      
      if (result.success) {
        // Save session
        session.save(result.token, {
          sessionId: result.sessionId,
          expiresAt: result.expiresAt,
          authMethod: 'voucher',
        });
        
        ui.showMessage('success', 'Authentication successful! Redirecting...');
        
        // Redirect to success page
        setTimeout(() => {
          window.location.href = 'success.html';
        }, 1000);
      } else {
        ui.showMessage('error', result.message || 'Authentication failed');
      }
    } catch (error) {
      ui.showMessage('error', error.message || 'Authentication failed. Please try again.');
    } finally {
      ui.setButtonLoading(submitBtn, false);
    }
  });
}

/**
 * Initialize login form
 */
function initLoginForm() {
  const form = document.getElementById('login-form');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
      ui.showMessage('error', 'Please enter username and password');
      return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    ui.setButtonLoading(submitBtn, true);
    ui.hideMessage();
    
    try {
      const result = await api.authLogin(username, password);
      
      if (result.success) {
        // Save session
        session.save(result.token, {
          sessionId: result.sessionId,
          expiresAt: result.expiresAt,
          authMethod: 'user',
          username: username,
        });
        
        ui.showMessage('success', 'Login successful! Redirecting...');
        
        // Redirect to success page
        setTimeout(() => {
          window.location.href = 'success.html';
        }, 1000);
      } else {
        ui.showMessage('error', result.message || 'Login failed');
      }
    } catch (error) {
      ui.showMessage('error', error.message || 'Login failed. Please try again.');
    } finally {
      ui.setButtonLoading(submitBtn, false);
    }
  });
}
