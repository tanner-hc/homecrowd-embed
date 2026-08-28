import * as api from '../api.js';
import { navigate, getRoute } from '../router.js';
import PageHeader from '../base-components/PageHeader.js';
import MainButton from '../base-components/MainButton.js';
import { showSuccess, showError } from '../base-components/toastApi.js';
// Lives in support.js because upload-receipt.js sends the same context block.
import { getSupportContext } from './support.js';

// Reachable from the profile page's Contact us bar and from the support hub,
// so back follows a ?from= rather than one fixed route. routePathOnly() in
// main.js strips the query before dispatching, so the param costs no routing.
// Allowlisted, not trusted: the hash is user-editable.
var BACK_ROUTES = ['/profile', '/support'];
var DEFAULT_BACK = '/support';

function backRoute() {
  var route = getRoute();
  var q = route.indexOf('?');
  if (q < 0) return DEFAULT_BACK;
  var from = new URLSearchParams(route.slice(q + 1)).get('from');
  return BACK_ROUTES.indexOf(from) >= 0 ? from : DEFAULT_BACK;
}

export function renderContactUs(container) {
  var html = '';
  html += '<div class="hc-support-page">';
  html += PageHeader({ title: 'Contact us', backButtonId: 'hc-support-back' });
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
      navigate(backRoute());
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
