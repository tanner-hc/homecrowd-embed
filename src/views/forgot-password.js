import * as api from '../api.js';
import logoUrl from '../assets/header.png';
import Input from '../base-components/Input.js';
import Button from '../base-components/Button.js';
import { escapeHtml } from '../base-components/html.js';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function renderForgotPassword(container) {
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
    '<h1 class="hc-login-title">Forgot Password?</h1>' +
    '</div>' +
    '<div id="hc-forgot-success" class="hc-auth-success" style="display:none"></div>' +
    '<div id="hc-forgot-form-wrap">' +
    '<p class="hc-login-subtitle hc-auth-description">Enter your email address and we&apos;ll send you a link to reset your password.</p>' +
    '<div id="hc-forgot-error" class="hc-alert-error" style="display:none"></div>' +
    '<form id="hc-forgot-form">' +
    Input({
      id: 'hc-forgot-email',
      name: 'email',
      type: 'email',
      label: 'Email',
      placeholder: 'Email',
      autocomplete: 'email',
      value: '',
    }) +
    Button({
      id: 'hc-forgot-btn',
      title: 'Send Reset Link',
      type: 'submit',
      variant: 'primary',
      className: 'hc-btn-large hc-login-submit-btn',
    }) +
    '</form>' +
    '<button type="button" id="hc-forgot-back" class="hc-auth-link">Back to Login</button>' +
    '</div>' +
    '<div class="hc-login-footer">Powered by Homecrowd</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>';

  var form = document.getElementById('hc-forgot-form');
  var emailInput = document.getElementById('hc-forgot-email');
  var errorEl = document.getElementById('hc-forgot-error');
  var submitBtn = document.getElementById('hc-forgot-btn');
  var formWrap = document.getElementById('hc-forgot-form-wrap');
  var successEl = document.getElementById('hc-forgot-success');
  var backBtn = document.getElementById('hc-forgot-back');

  function showError(message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  backBtn.addEventListener('click', function () {
    window.location.hash = '#/login';
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = emailInput.value.trim();
    if (!email) {
      showError('Email is required');
      return;
    }
    if (!isValidEmail(email)) {
      showError('Please enter a valid email address');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    errorEl.style.display = 'none';

    try {
      await api.forgotPassword(email);
      formWrap.style.display = 'none';
      successEl.innerHTML =
        '<p class="hc-auth-success-title">We&apos;ve sent a password reset link to<br><strong>' +
        escapeHtml(email) +
        '</strong></p>' +
        '<p class="hc-auth-success-copy">Please check your email and follow the instructions to reset your password.</p>' +
        '<button type="button" id="hc-forgot-success-back" class="hc-auth-link">Back to Login</button>';
      successEl.style.display = 'block';
      document.getElementById('hc-forgot-success-back').addEventListener('click', function () {
        window.location.hash = '#/login';
      });
    } catch (err) {
      var body = err && err.body ? err.body : null;
      var emailError = body && body.email
        ? Array.isArray(body.email)
          ? body.email[0]
          : body.email
        : '';
      showError(emailError || (err && err.message) || 'Failed to send password reset email. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Reset Link';
    }
  });
}
