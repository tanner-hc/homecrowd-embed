import { escapeHtml } from '../base-components/html.js';
import { getPrivacyUrl, getTermsUrl } from '../legal-urls.js';
import { getSchoolColor, hasSchoolBrand } from '../brand.js';

function envelopeIcon() {
  var stroke = 'currentColor';
  return (
    '<svg width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<rect x="1" y="1" width="20" height="14" rx="2.5" stroke="' +
    stroke +
    '" stroke-width="2"/>' +
    '<path d="M2 3.2L11 9.5L20 3.2" stroke="' +
    stroke +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>'
  );
}

export function renderPreviewScreen(container, options) {
  var opts = options || {};
  var signedEmail = String(opts.schoolEmail || '').trim() || 'school email';
  var termsUrl = String(opts.termsUrl || getTermsUrl()).trim();
  var privacyUrl = String(opts.privacyUrl || getPrivacyUrl()).trim();
  var schoolMode = hasSchoolBrand();
  var schoolColor = schoolMode ? getSchoolColor() : '';
  var screenClass = schoolMode ? 'hc-preview-screen hc-preview-screen--school' : 'hc-preview-screen';
  var screenStyle = schoolColor
    ? ' style="--hc-welcome-card-bg: ' + escapeHtml(schoolColor) + ';"'
    : '';
  var primaryIcon = schoolMode
    ? ''
    : '<span class="hc-preview-btn-icon">' + envelopeIcon() + '</span>';
  var secondaryIcon = schoolMode
    ? ''
    : '<span class="hc-preview-btn-icon">' + envelopeIcon() + '</span>';
  var titleText = schoolMode ? "Let's Get Started" : "Let's Get Started.";

  container.innerHTML =
    '<div class="' +
    screenClass +
    '"' +
    screenStyle +
    '>' +
    '<div class="hc-preview-card">' +
    '<h1 class="hc-preview-title">' +
    titleText +
    '</h1>' +
    '<p class="hc-preview-subtitle">Choose how you\'d like to sign in</p>' +
    '<label class="hc-preview-terms">' +
    '<input type="checkbox" id="hc-preview-terms-checkbox" />' +
    '<span class="hc-preview-terms-check" aria-hidden="true"></span>' +
    '<span class="hc-preview-terms-text">By continuing, I agree to <a href="' +
    escapeHtml(termsUrl) +
    '" target="_blank" rel="noopener noreferrer">Terms and Conditions</a> and <a href="' +
    escapeHtml(privacyUrl) +
    '" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span>' +
    '</label>' +
    '<button type="button" id="hc-preview-signin-primary" class="hc-preview-btn hc-preview-btn-primary" disabled>' +
    primaryIcon +
    '<span class="hc-preview-btn-label">Sign in with ' +
    escapeHtml(signedEmail) +
    '</span>' +
    '</button>' +
    '<button type="button" id="hc-preview-signin-secondary" class="hc-preview-btn hc-preview-btn-secondary">' +
    secondaryIcon +
    '<span class="hc-preview-btn-label">Sign in with another email</span>' +
    '</button>' +
    '</div>' +
    '</div>';

  var termsCheckbox = container.querySelector('#hc-preview-terms-checkbox');
  var primaryButton = container.querySelector('#hc-preview-signin-primary');
  var secondaryButton = container.querySelector('#hc-preview-signin-secondary');
  var submitting = false;

  function syncCtaState() {
    var accepted = !!(termsCheckbox && termsCheckbox.checked);
    if (primaryButton) {
      primaryButton.disabled = !accepted || submitting;
      primaryButton.classList.toggle('hc-preview-btn-disabled', !accepted);
    }
    if (secondaryButton) {
      secondaryButton.disabled = !accepted || submitting;
      secondaryButton.classList.toggle('hc-preview-btn-disabled', !accepted);
    }
  }

  if (termsCheckbox) {
    termsCheckbox.addEventListener('change', syncCtaState);
  }

  if (primaryButton) {
    primaryButton.addEventListener('click', function () {
      if (!opts.onPrimaryChoice || submitting) return;
      submitting = true;
      syncCtaState();
      Promise.resolve(opts.onPrimaryChoice())
        .catch(function () { })
        .finally(function () {
          submitting = false;
          syncCtaState();
        });
    });
  }

  if (secondaryButton) {
    secondaryButton.addEventListener('click', function () {
      if (!opts.onSecondaryChoice || submitting) return;
      submitting = true;
      syncCtaState();
      Promise.resolve(opts.onSecondaryChoice())
        .catch(function () { })
        .finally(function () {
          submitting = false;
          syncCtaState();
        });
    });
  }

  syncCtaState();
}
