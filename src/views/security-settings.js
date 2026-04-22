import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import NavHeader from '../base-components/NavHeader.js';
import SecondaryButton from '../base-components/SecondaryButton.js';
import MainButton from '../base-components/MainButton.js';
import { escapeHtml } from '../base-components/html.js';
import { showSuccess, showError } from '../base-components/toastApi.js';
import lockIconSvg from '../assets/icons/lock.svg?raw';
import chevronRightIconSvg from '../assets/icons/chevron-right.svg?raw';
import shieldIconSvg from '../assets/icons/shield.svg?raw';

var RESEND_COOLDOWN_SEC = 60;
var LS_VERIFICATION_SENT = 'hc_embed_verification_resend_at';

function svgAddClass(svgRaw, className) {
  return String(svgRaw).replace(/^<svg\s/i, '<svg class="' + className + '" ');
}

function secondaryIconHtml(svgRaw) {
  return svgAddClass(svgRaw, 'hc-profile-secondary-icon');
}

function chevronRightHtml() {
  return svgAddClass(chevronRightIconSvg, 'hc-profile-chevron-icon');
}

function isEmailVerified(user) {
  return !!(user && (user.email_verified === true || user.emailVerified === true));
}

function verificationCooldownRemainingSec() {
  try {
    var raw = localStorage.getItem(LS_VERIFICATION_SENT);
    if (!raw) return 0;
    var elapsed = (Date.now() - parseInt(raw, 10)) / 1000;
    var rem = Math.ceil(RESEND_COOLDOWN_SEC - elapsed);
    return rem > 0 ? rem : 0;
  } catch (_e) {
    return 0;
  }
}

function verifyEmailBannerHtml(user) {
  if (isEmailVerified(user)) {
    var em = escapeHtml(user.email || '');
    return (
      '<div class="hc-sec-verify hc-sec-verify--ok">' +
      '<div class="hc-sec-verify-row">' +
      '<div class="hc-sec-verify-shield">' +
      svgAddClass(shieldIconSvg, 'hc-sec-verify-shield-svg') +
      '</div>' +
      '<div class="hc-sec-verify-text">' +
      '<div class="hc-sec-verify-title">Email Verified</div>' +
      '<div class="hc-sec-verify-sub">' +
      em +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }
  return (
    '<div class="hc-sec-verify hc-sec-verify--warn">' +
    '<div class="hc-sec-verify-row">' +
    '<div class="hc-sec-verify-warn-icon" aria-hidden="true">!</div>' +
    '<div class="hc-sec-verify-text">' +
    '<div class="hc-sec-verify-title">Verify Your Email</div>' +
    '<div class="hc-sec-verify-sub">Please verify your email address to get full access to all features</div>' +
    '</div>' +
    '</div>' +
    MainButton({
      id: 'hc-sec-verify-send',
      text: 'Send Verification Email',
      loadingText: 'Sending...',
    }) +
    '</div>'
  );
}

function startResendCooldownTimer() {
  var existing = window._hcSecVerifyTimer;
  if (existing) window.clearInterval(existing);
  function tick() {
    var btn = document.getElementById('hc-sec-verify-send');
    if (!btn) {
      window.clearInterval(window._hcSecVerifyTimer);
      window._hcSecVerifyTimer = null;
      return;
    }
    var rem = verificationCooldownRemainingSec();
    if (rem > 0) {
      btn.disabled = true;
      btn.textContent = 'Resend in ' + rem + 's';
    } else {
      btn.disabled = false;
      btn.textContent = 'Send Verification Email';
    }
  }
  tick();
  window._hcSecVerifyTimer = window.setInterval(tick, 1000);
}

export function renderSecuritySettings(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading...' });
  loadSecuritySettings(container);
}

async function loadSecuritySettings(container) {
  var user;
  try {
    user = await api.getUserProfile();
  } catch (_e) {
    try {
      user = await api.fetchCurrentUser();
    } catch (err) {
      container.innerHTML =
        '<div class="hc-alert-error">' + escapeHtml(err.message || 'Failed to load') + '</div>';
      return;
    }
  }

  var html = '';
  html += '<div class="hc-security-settings">';
  html += '<div class="hc-account-settings-nav">';
  html += NavHeader({
    title: 'Security Settings',
    backButtonId: 'hc-sec-back',
  });
  html += '</div>';
  html += '<div class="hc-sec-body">';
  html += verifyEmailBannerHtml(user);
  html += '<div class="hc-profile-menu hc-sec-menu">';
  html += SecondaryButton({
    leftHtml: secondaryIconHtml(lockIconSvg),
    title: 'Change Password',
    subtitle: 'Update your account password',
    rightHtml: chevronRightHtml(),
    id: 'hc-sec-change-pw',
  });
  html += '</div>';
  html += '</div>';

  html += '</div>';

  container.innerHTML = html;

  var backBtn = document.getElementById('hc-sec-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate('/account-settings');
    });
  }

  if (!isEmailVerified(user)) {
    startResendCooldownTimer();
    var sendBtn = document.getElementById('hc-sec-verify-send');
    if (sendBtn) {
      sendBtn.addEventListener('click', async function () {
        if (verificationCooldownRemainingSec() > 0) return;
        sendBtn.disabled = true;
        var prev = sendBtn.innerHTML;
        sendBtn.innerHTML =
          '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>Sending...</span>';
        try {
          await api.resendVerificationEmail();
          localStorage.setItem(LS_VERIFICATION_SENT, String(Date.now()));
          showSuccess('Verification email sent');
          startResendCooldownTimer();
        } catch (err) {
          showError(err.message || 'Failed to send');
        } finally {
          sendBtn.disabled = false;
          sendBtn.innerHTML = prev;
          var rem = verificationCooldownRemainingSec();
          if (rem > 0) {
            sendBtn.disabled = true;
            sendBtn.textContent = 'Resend in ' + rem + 's';
          }
        }
      });
    }
  }

  var changePwBtn = document.getElementById('hc-sec-change-pw');
  if (changePwBtn) {
    changePwBtn.addEventListener('click', function () {
      navigate('/change-password');
    });
  }
}
