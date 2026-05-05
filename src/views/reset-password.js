import * as api from '../api.js';
import logoUrl from '../assets/header.png';
import Button from '../base-components/Button.js';

function getResetParams(route) {
  var params = new URLSearchParams(route.indexOf('?') >= 0 ? route.slice(route.indexOf('?') + 1) : '');
  var uid = params.get('uid') || '';
  var token = params.get('token') || '';
  var pathOnly = route.indexOf('?') >= 0 ? route.slice(0, route.indexOf('?')) : route;
  var match = pathOnly.match(/^\/reset-password\/([^/]+)\/([^/]+)$/);
  if (match) {
    uid = uid || decodeURIComponent(match[1]);
    token = token || decodeURIComponent(match[2]);
  }
  if ((!uid || !token) && window.location.search) {
    var pageParams = new URLSearchParams(window.location.search);
    uid = uid || pageParams.get('uid') || '';
    token = token || pageParams.get('token') || '';
  }
  return { uid: uid, token: token };
}

function validatePassword(password, confirmPassword) {
  if (!password) return 'New password is required';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (password.length > 128) return 'Password must be at most 128 characters long';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  if (!confirmPassword) return 'Please confirm your new password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return '';
}

function passwordField(id, label, placeholder) {
  return (
    '<div class="hc-form-group">' +
    '<label class="hc-label" for="' +
    id +
    '">' +
    label +
    '</label>' +
    '<div style="position:relative">' +
    '<input id="' +
    id +
    '" class="hc-input" type="password" placeholder="' +
    placeholder +
    '" autocomplete="new-password" />' +
    '<button type="button" id="' +
    id +
    '-toggle" class="hc-toggle-pw">Show</button>' +
    '</div>' +
    '</div>'
  );
}

export function renderResetPassword(container, route) {
  var params = getResetParams(route || '');
  var isInvalid = !params.uid || !params.token;
  container.innerHTML =
    '<div class="hc-login-shell">' +
    '<div class="hc-login-bg"></div>' +
    '<div class="hc-login-overlay">' +
    '<div class="hc-login-container">' +
    '<div class="hc-login-logo">' +
    '<img src="' +
    logoUrl +
    '" alt="Homecrowd" class="hc-login-logo-img" />' +
    '</div>' +
    '<div class="hc-login-card hc-auth-card">' +
    '<div class="hc-login-heading">' +
    '<h1 class="hc-login-title">' +
    (isInvalid ? 'Invalid Link' : 'Reset Password') +
    '</h1>' +
    '</div>' +
    (isInvalid
      ? '<p class="hc-login-subtitle hc-auth-description">This password reset link is invalid or has expired. Please request a new password reset link.</p>' +
      Button({
        id: 'hc-reset-request-link',
        title: 'Request New Link',
        type: 'button',
        variant: 'primary',
        className: 'hc-btn-large hc-login-submit-btn',
      })
      : '<p class="hc-login-subtitle hc-auth-description">Enter your new password below.</p>' +
      '<div id="hc-reset-error" class="hc-alert-error" style="display:none"></div>' +
      '<form id="hc-reset-form">' +
      passwordField('hc-reset-new-password', 'New Password', 'New Password') +
      passwordField('hc-reset-confirm-password', 'Confirm New Password', 'Confirm New Password') +
      Button({
        id: 'hc-reset-btn',
        title: 'Reset Password',
        type: 'submit',
        variant: 'primary',
        className: 'hc-btn-large hc-login-submit-btn',
      }) +
      '</form>') +
    '<button type="button" id="hc-reset-back" class="hc-auth-link">Back to Login</button>' +
    '<div class="hc-login-footer">Powered by Homecrowd</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>';

  document.getElementById('hc-reset-back').addEventListener('click', function () {
    window.location.hash = '#/login';
  });

  if (isInvalid) {
    document.getElementById('hc-reset-request-link').addEventListener('click', function () {
      window.location.hash = '#/forgot-password';
    });
    return;
  }

  ['hc-reset-new-password', 'hc-reset-confirm-password'].forEach(function (id) {
    var input = document.getElementById(id);
    var toggle = document.getElementById(id + '-toggle');
    toggle.addEventListener('click', function () {
      var isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggle.textContent = isPassword ? 'Hide' : 'Show';
    });
  });

  var form = document.getElementById('hc-reset-form');
  var errorEl = document.getElementById('hc-reset-error');
  var submitBtn = document.getElementById('hc-reset-btn');
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var newPassword = document.getElementById('hc-reset-new-password').value;
    var confirmPassword = document.getElementById('hc-reset-confirm-password').value;
    var validationError = validatePassword(newPassword, confirmPassword);
    if (validationError) {
      errorEl.textContent = validationError;
      errorEl.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Resetting...';
    errorEl.style.display = 'none';

    try {
      await api.resetPassword({
        uid: params.uid,
        token: params.token,
        new_password: newPassword,
      });
      window.location.hash = '#/login';
    } catch (err) {
      var body = err && err.body ? err.body : null;
      var tokenError = body && body.token
        ? Array.isArray(body.token)
          ? body.token[0]
          : body.token
        : '';
      var passwordError = body && body.new_password
        ? Array.isArray(body.new_password)
          ? body.new_password[0]
          : body.new_password
        : '';
      errorEl.textContent = tokenError || passwordError || (err && err.message) || 'Failed to reset password. Please try again.';
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Reset Password';
    }
  });
}
