import { escapeHtml } from '../base-components/html.js';

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
  var termsUrl = String(opts.termsUrl || 'https://app.gethomecrowd.com/terms-and-conditions').trim();
  var privacyUrl = String(opts.privacyUrl || 'https://app.gethomecrowd.com/privacy-policy/').trim();

  container.innerHTML =
    '<div class="hc-preview-screen">' +
    '<div class="hc-preview-card">' +
    '<h1 class="hc-preview-title">Let\'s Get Started.</h1>' +
    '<p class="hc-preview-subtitle">Choose how you\'d like to sign in.</p>' +
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
    '<span class="hc-preview-btn-icon">' +
    envelopeIcon() +
    '</span>' +
    '<span class="hc-preview-btn-label">Sign in with ' +
    escapeHtml(signedEmail) +
    '</span>' +
    '</button>' +
    '<button type="button" id="hc-preview-signin-secondary" class="hc-preview-btn hc-preview-btn-secondary">' +
    '<span class="hc-preview-btn-icon">' +
    envelopeIcon() +
    '</span>' +
    '<span class="hc-preview-btn-label">Sign in with another email</span>' +
    '</button>' +
    '<div id="hc-preview-alt-wrap" class="hc-preview-alt-wrap" style="display:none;">' +
    '<label for="hc-preview-alt-email" class="hc-preview-alt-label">Email</label>' +
    '<input id="hc-preview-alt-email" class="hc-preview-alt-input" type="email" placeholder="name@example.com" autocomplete="email" />' +
    '<label for="hc-preview-alt-password" class="hc-preview-alt-label">Password (optional)</label>' +
    '<input id="hc-preview-alt-password" class="hc-preview-alt-input" type="password" placeholder="Password" autocomplete="current-password" />' +
    '<button type="button" id="hc-preview-alt-continue" class="hc-preview-btn hc-preview-btn-secondary" disabled>' +
    '<span class="hc-preview-btn-label">Continue</span>' +
    '</button>' +
    '<button type="button" id="hc-preview-alt-forgot" class="hc-preview-link-btn">Forgot password?</button>' +
    '<div id="hc-preview-alt-error" class="hc-alert-error" style="display:none;"></div>' +
    '<div id="hc-preview-alt-status" class="hc-preview-inline-status" style="display:none;"></div>' +
    '</div>' +
    '</div>' +
    '</div>';

  var termsCheckbox = container.querySelector('#hc-preview-terms-checkbox');
  var primaryButton = container.querySelector('#hc-preview-signin-primary');
  var secondaryButton = container.querySelector('#hc-preview-signin-secondary');
  var altWrap = container.querySelector('#hc-preview-alt-wrap');
  var altEmailInput = container.querySelector('#hc-preview-alt-email');
  var altPasswordInput = container.querySelector('#hc-preview-alt-password');
  var altContinueButton = container.querySelector('#hc-preview-alt-continue');
  var altForgotButton = container.querySelector('#hc-preview-alt-forgot');
  var altError = container.querySelector('#hc-preview-alt-error');
  var altStatus = container.querySelector('#hc-preview-alt-status');
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
    if (altContinueButton) {
      var hasAltEmail = !!(altEmailInput && String(altEmailInput.value || '').trim());
      altContinueButton.disabled = !accepted || !hasAltEmail || submitting;
      altContinueButton.classList.toggle('hc-preview-btn-disabled', altContinueButton.disabled);
    }
  }

  if (termsCheckbox) {
    termsCheckbox.addEventListener('change', syncCtaState);
  }

  if (altEmailInput) {
    altEmailInput.addEventListener('input', function () {
      if (altError) {
        altError.style.display = 'none';
        altError.textContent = '';
      }
      if (altStatus) {
        altStatus.style.display = 'none';
        altStatus.textContent = '';
      }
      syncCtaState();
    });
  }
  if (altPasswordInput) {
    altPasswordInput.addEventListener('input', function () {
      if (altError) {
        altError.style.display = 'none';
        altError.textContent = '';
      }
      if (altStatus) {
        altStatus.style.display = 'none';
        altStatus.textContent = '';
      }
      syncCtaState();
    });
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
      if (submitting) return;
      if (altWrap) {
        altWrap.style.display = '';
      }
      if (altEmailInput) {
        altEmailInput.focus();
      }
      syncCtaState();
    });
  }

  function submitAlternate() {
    if (!opts.onAlternateChoice || submitting) return;
    var emailValue = String((altEmailInput && altEmailInput.value) || '').trim().toLowerCase();
    var passwordValue = String((altPasswordInput && altPasswordInput.value) || '').trim();
    if (!emailValue) return;
    submitting = true;
    syncCtaState();
    var request = passwordValue
      ? Promise.resolve(opts.onPasswordChoice && opts.onPasswordChoice(emailValue, passwordValue))
      : Promise.resolve(opts.onAlternateChoice(emailValue));
    request
      .then(function (result) {
        if (!result) return;
        if (result.requiresPassword) {
          if (altStatus) {
            altStatus.textContent = 'Account found. Enter password to continue.';
            altStatus.style.display = 'block';
          }
          if (altPasswordInput) {
            altPasswordInput.focus();
          }
          return;
        }
        if (result.emailConfirmationSent) {
          if (altStatus) {
            altStatus.textContent = result.message || 'Confirmation email sent.';
            altStatus.style.display = 'block';
          }
          return;
        }
      })
      .catch(function (err) {
        if (altError) {
          altError.textContent = (err && err.message) || 'Failed to continue';
          altError.style.display = 'block';
        }
      })
      .finally(function () {
        submitting = false;
        syncCtaState();
      });
  }

  if (altContinueButton) {
    altContinueButton.addEventListener('click', submitAlternate);
  }

  if (altEmailInput) {
    altEmailInput.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      submitAlternate();
    });
  }
  if (altPasswordInput) {
    altPasswordInput.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      submitAlternate();
    });
  }

  if (altForgotButton) {
    altForgotButton.addEventListener('click', function () {
      if (!opts.onForgotPassword || submitting) return;
      var emailValue = String((altEmailInput && altEmailInput.value) || '').trim().toLowerCase();
      if (!emailValue) return;
      submitting = true;
      syncCtaState();
      Promise.resolve(opts.onForgotPassword(emailValue))
        .then(function () {
          if (altStatus) {
            altStatus.textContent = 'Password reset email sent.';
            altStatus.style.display = 'block';
          }
        })
        .catch(function (err) {
          if (altError) {
            altError.textContent = (err && err.message) || 'Could not send reset email';
            altError.style.display = 'block';
          }
        })
        .finally(function () {
          submitting = false;
          syncCtaState();
        });
    });
  }

  syncCtaState();
}
