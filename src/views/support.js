import * as api from '../api.js';
import { navigate } from '../router.js';
import NavHeader from '../base-components/NavHeader.js';
import MainButton from '../base-components/MainButton.js';
import { showSuccess, showError } from '../base-components/toastApi.js';

function getTimezoneString() {
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) return tz;
    }
    var offset = -new Date().getTimezoneOffset();
    var sign = offset >= 0 ? '+' : '-';
    return 'UTC' + sign + String(Math.abs(offset) / 60);
  } catch (_e) {
    return null;
  }
}

function getSupportContext() {
  var host = typeof window !== 'undefined' && window.location ? window.location.host : null;
  return {
    platform: 'Web',
    device_model: navigator && navigator.userAgent ? navigator.userAgent : null,
    os_version: navigator && navigator.platform ? navigator.platform : null,
    app_version: null,
    environment:
      typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
        ? 'development'
        : 'production',
    timezone: getTimezoneString(),
    screen: 'Support',
    build_type:
      typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
        ? 'debug'
        : 'release',
    host: host,
  };
}

export function renderSupport(container) {
  var html = '';
  html += '<div class="hc-support-page">';
  html += '<div class="hc-account-settings-nav">';
  html += NavHeader({
    title: 'Support',
    backButtonId: 'hc-support-back',
  });
  html += '</div>';
  html += '<div class="hc-support-body">';
  html += '<div class="hc-support-subtitle">We\'re here to help! Send us your questions or feedback.</div>';
  html += '<div class="hc-support-form">';
  html += '<label class="hc-label" for="hc-support-message">Your message</label>';
  html +=
    '<textarea id="hc-support-message" class="hc-input hc-support-textarea" placeholder="Type your message here..." rows="8"></textarea>';
  html += '</div>';
  html += '<div class="hc-support-actions">';
  html += MainButton({
    id: 'hc-support-submit',
    text: 'Submit',
    loadingText: 'Sending...',
  });
  html += '</div>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  var backBtn = document.getElementById('hc-support-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate('/profile');
    });
  }

  var msgEl = document.getElementById('hc-support-message');
  var submitBtn = document.getElementById('hc-support-submit');

  function syncSubmitState() {
    if (!submitBtn || !msgEl) return;
    submitBtn.disabled = !String(msgEl.value || '').trim();
  }

  if (msgEl) {
    msgEl.addEventListener('input', syncSubmitState);
  }
  syncSubmitState();

  if (submitBtn) {
    submitBtn.addEventListener('click', async function () {
      var message = String((msgEl && msgEl.value) || '').trim();
      if (!message) return;
      submitBtn.disabled = true;
      var prevHtml = submitBtn.innerHTML;
      submitBtn.innerHTML =
        '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>Sending...</span>';
      try {
        await api.submitSupportMessage(message, getSupportContext());
        showSuccess('Message sent');
        if (msgEl) msgEl.value = '';
      } catch (err) {
        showError((err && err.message) || 'Failed to send');
      } finally {
        submitBtn.innerHTML = prevHtml;
        syncSubmitState();
      }
    });
  }
}
