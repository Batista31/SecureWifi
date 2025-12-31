/**
 * WiFi Captive Portal - Registration Page JavaScript
 * 
 * Handles new user registration.
 */

document.addEventListener('DOMContentLoaded', () => {
  initRegisterForm();
});

/**
 * Initialize registration form
 */
function initRegisterForm() {
  const form = document.getElementById('register-form');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const agreeTerms = document.getElementById('agree-terms').checked;
    
    // Validation
    if (!username || !password) {
      ui.showMessage('error', 'Please fill in all required fields');
      return;
    }
    
    if (username.length < 3) {
      ui.showMessage('error', 'Username must be at least 3 characters');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      ui.showMessage('error', 'Username can only contain letters, numbers, and underscores');
      return;
    }
    
    if (password.length < 6) {
      ui.showMessage('error', 'Password must be at least 6 characters');
      return;
    }
    
    if (password !== passwordConfirm) {
      ui.showMessage('error', 'Passwords do not match');
      return;
    }
    
    if (email && !isValidEmail(email)) {
      ui.showMessage('error', 'Please enter a valid email address');
      return;
    }
    
    if (!agreeTerms) {
      ui.showMessage('error', 'You must agree to the Terms of Service');
      return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    ui.setButtonLoading(submitBtn, true);
    ui.hideMessage();
    
    try {
      const result = await api.register({
        username,
        password,
        email: email || undefined,
        phone: phone || undefined,
      });
      
      if (result.success) {
        ui.showMessage('success', 'Account created successfully! You can now sign in.');
        
        // Redirect to login page after short delay
        setTimeout(() => {
          window.location.href = 'login.html?method=login';
        }, 2000);
      } else {
        ui.showMessage('error', result.message || 'Registration failed');
      }
    } catch (error) {
      ui.showMessage('error', error.message || 'Registration failed. Please try again.');
    } finally {
      ui.setButtonLoading(submitBtn, false);
    }
  });
  
  // Real-time password confirmation check
  const passwordInput = document.getElementById('reg-password');
  const confirmInput = document.getElementById('reg-password-confirm');
  
  confirmInput.addEventListener('input', () => {
    if (confirmInput.value && confirmInput.value !== passwordInput.value) {
      confirmInput.setCustomValidity('Passwords do not match');
    } else {
      confirmInput.setCustomValidity('');
    }
  });
}

/**
 * Simple email validation
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
