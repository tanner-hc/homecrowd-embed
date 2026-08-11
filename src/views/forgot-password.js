import * as api from '../api.js';
import {
  getEmbedSchoolId,
  getHeaderLogoUrl,
  getSchoolColor,
  hasCustomHeaderLogo,
  hasSchoolBrand,
  renderBrandLockup,
  renderPoweredByLockup,
} from '../brand.js';
import Input from '../base-components/Input.js';
import { escapeAttr, escapeHtml } from '../base-components/html.js';
import { isValidEmail } from '../contact-validation.js';

function isSchoolMode() {
  var params = new URLSearchParams(window.location.search);
  var urlSchoolId = String(
    params.get('schoolId') || params.get('schoolID') || params.get('school_id') || '',
  )
    .trim()
    .replace(/^\/+|\/+$/g, '');
  return hasSchoolBrand() || !!getEmbedSchoolId() || !!urlSchoolId;
}

export function renderForgotPassword(container) {
  var schoolMode = isSchoolMode();
  var schoolColor = schoolMode ? getSchoolColor() : '';
  var shellClass = schoolMode ? 'hc-login-shell hc-login-shell--school' : 'hc-login-shell';
  var shellStyle = schoolColor
    ? ' style="--hc-welcome-card-bg: ' + escapeAttr(schoolColor) + ';"'
    : '';
  var logoBlock =
    hasCustomHeaderLogo() || schoolMode
      ? '<div class="hc-login-logo hc-login-logo--brand">' + renderBrandLockup() + '</div>'
      : '<div class="hc-login-logo"><img src="' +
        escapeAttr(getHeaderLogoUrl()) +
        '" alt="Homecrowd" class="hc-login-logo-img" /></div>';
  var footerHtml = schoolMode ? '' : renderPoweredByLockup('hc-login-footer');

  container.innerHTML =
    '<div class="' +
    shellClass +
    '"' +
    shellStyle +
    '>' +
    '<div class="hc-login-bg"></div>' +
    '<div class="hc-login-overlay">' +
    '<div class="hc-login-container">' +
    logoBlock +
    '<div class="hc-login-card hc-login-card--signup">' +
    '<div class="hc-login-heading">' +
    '<button type="button" id="hc-forgot-back" class="hc-signup-back-btn" style="display:inline-flex" aria-label="Back to login">' +
    '<span class="hc-signup-back-arrow">&larr;</span>' +
    '</button>' +
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
      label: schoolMode ? '' : 'Email',
      placeholder: 'Email',
      autocomplete: 'email',
      value: '',
    }) +
    '</form>' +
    '</div>' +
    footerHtml +
    '</div>' +
    '<button class="hc-btn hc-btn-primary hc-btn-large hc-login-submit-btn" id="hc-forgot-btn" type="submit" form="hc-forgot-form">' +
    'Send Reset Link' +
    '</button>' +
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

  function goToLogin() {
    window.location.hash = '#/login';
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  backBtn.addEventListener('click', goToLogin);

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
      submitBtn.style.display = 'none';
      successEl.innerHTML =
        '<p class="hc-auth-success-title">We&apos;ve sent a password reset link to<br><strong>' +
        escapeHtml(email) +
        '</strong></p>' +
        '<p class="hc-auth-success-copy">Please check your email and follow the instructions to reset your password.</p>' +
        '<button type="button" id="hc-forgot-success-back" class="hc-auth-link">Back to Login</button>';
      successEl.style.display = 'block';
      document.getElementById('hc-forgot-success-back').addEventListener('click', goToLogin);
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
