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
  var termsUrl = String(opts.termsUrl || 'https://www.gethomecrowd.com/terms').trim();
  var privacyUrl = String(opts.privacyUrl || 'https://www.gethomecrowd.com/privacy').trim();

  container.innerHTML =
    '<div class="hc-preview-screen">' +
    '<div class="hc-preview-card">' +
    '<h1 class="hc-preview-title">Let\'s Get Started.</h1>' +
    '<p class="hc-preview-subtitle">Choose how you\'d like to sign in.</p>' +
    '<p class="hc-preview-links">By continuing, you agree to our <a href="' +
    escapeHtml(termsUrl) +
    '" target="_blank" rel="noopener noreferrer">Terms and Conditions</a> and <a href="' +
    escapeHtml(privacyUrl) +
    '" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>' +
    '<label class="hc-preview-terms">' +
    '<input type="checkbox" id="hc-preview-terms-checkbox" />' +
    '<span class="hc-preview-terms-check" aria-hidden="true"></span>' +
    '<span class="hc-preview-terms-text">I accept Terms and Privacy Policy</span>' +
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
    '<label for="hc-preview-alt-email" class="hc-preview-alt-label">Enter another email</label>' +
    '<input id="hc-preview-alt-email" class="hc-preview-alt-input" type="email" placeholder="name@example.com" autocomplete="email" />' +
    '<button type="button" id="hc-preview-alt-continue" class="hc-preview-btn hc-preview-btn-secondary" disabled>' +
    '<span class="hc-preview-btn-label">Continue with this email</span>' +
    '</button>' +
    '<div id="hc-preview-alt-error" class="hc-alert-error" style="display:none;"></div>' +
    '</div>' +
    '<div id="hc-preview-password-wrap" class="hc-preview-alt-wrap" style="display:none;">' +
    '<label for="hc-preview-password" class="hc-preview-alt-label" id="hc-preview-password-label">Enter password</label>' +
    '<input id="hc-preview-password" class="hc-preview-alt-input" type="password" placeholder="Password" autocomplete="current-password" />' +
    '<button type="button" id="hc-preview-password-continue" class="hc-preview-btn hc-preview-btn-secondary" disabled>' +
    '<span class="hc-preview-btn-label">Sign in</span>' +
    '</button>' +
    '<button type="button" id="hc-preview-password-forgot" class="hc-preview-link-btn">Forgot password?</button>' +
    '<div id="hc-preview-password-error" class="hc-alert-error" style="display:none;"></div>' +
    '<div id="hc-preview-password-status" class="hc-preview-inline-status" style="display:none;"></div>' +
    '</div>' +
    '</div>' +
    '</div>';

  var termsCheckbox = container.querySelector('#hc-preview-terms-checkbox');
  var primaryButton = container.querySelector('#hc-preview-signin-primary');
  var secondaryButton = container.querySelector('#hc-preview-signin-secondary');
  var altWrap = container.querySelector('#hc-preview-alt-wrap');
  var altEmailInput = container.querySelector('#hc-preview-alt-email');
  var altContinueButton = container.querySelector('#hc-preview-alt-continue');
  var altError = container.querySelector('#hc-preview-alt-error');
  var passwordWrap = container.querySelector('#hc-preview-password-wrap');
  var passwordLabel = container.querySelector('#hc-preview-password-label');
  var passwordInput = container.querySelector('#hc-preview-password');
  var passwordContinueButton = container.querySelector('#hc-preview-password-continue');
  var passwordForgotButton = container.querySelector('#hc-preview-password-forgot');
  var passwordError = container.querySelector('#hc-preview-password-error');
  var passwordStatus = container.querySelector('#hc-preview-password-status');
  var submitting = false;
  var passwordEmail = '';

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
    if (passwordContinueButton) {
      var hasPassword = !!(passwordInput && String(passwordInput.value || '').trim());
      passwordContinueButton.disabled = !accepted || !hasPassword || submitting;
      passwordContinueButton.classList.toggle('hc-preview-btn-disabled', passwordContinueButton.disabled);
    }
  }

  function showPasswordStep(email) {
    passwordEmail = String(email || '').trim().toLowerCase();
    if (altWrap) altWrap.style.display = 'none';
    if (passwordWrap) passwordWrap.style.display = '';
    if (passwordLabel) {
      passwordLabel.textContent = 'Enter password for ' + passwordEmail;
    }
    if (passwordError) {
      passwordError.style.display = 'none';
      passwordError.textContent = '';
    }
    if (passwordStatus) {
      passwordStatus.style.display = 'none';
      passwordStatus.textContent = '';
    }
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.focus();
    }
    syncCtaState();
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
      syncCtaState();
    });
  }
  if (passwordInput) {
    passwordInput.addEventListener('input', function () {
      if (passwordError) {
        passwordError.style.display = 'none';
        passwordError.textContent = '';
      }
      if (passwordStatus) {
        passwordStatus.style.display = 'none';
        passwordStatus.textContent = '';
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

  if (altContinueButton) {
    altContinueButton.addEventListener('click', function () {
      if (!opts.onAlternateChoice || submitting) return;
      var value = String((altEmailInput && altEmailInput.value) || '').trim().toLowerCase();
      if (!value) {
        return;
      }
      submitting = true;
      syncCtaState();
      Promise.resolve(opts.onAlternateChoice(value))
        .then(function (result) {
          if (result && result.requiresPassword) {
            showPasswordStep(result.email || value);
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
    });
  }

  if (passwordContinueButton) {
    passwordContinueButton.addEventListener('click', function () {
      if (!opts.onPasswordChoice || submitting) return;
      var pass = String((passwordInput && passwordInput.value) || '').trim();
      if (!pass || !passwordEmail) return;
      submitting = true;
      syncCtaState();
      Promise.resolve(opts.onPasswordChoice(passwordEmail, pass))
        .catch(function (err) {
          if (passwordError) {
            passwordError.textContent = (err && err.message) || 'Failed to sign in';
            passwordError.style.display = 'block';
          }
        })
        .finally(function () {
          submitting = false;
          syncCtaState();
        });
    });
  }

  if (passwordForgotButton) {
    passwordForgotButton.addEventListener('click', function () {
      if (!opts.onForgotPassword || submitting || !passwordEmail) return;
      submitting = true;
      syncCtaState();
      Promise.resolve(opts.onForgotPassword(passwordEmail))
        .then(function () {
          if (passwordStatus) {
            passwordStatus.textContent = 'Password reset email sent.';
            passwordStatus.style.display = 'block';
          }
        })
        .catch(function (err) {
          if (passwordError) {
            passwordError.textContent = (err && err.message) || 'Could not send reset email';
            passwordError.style.display = 'block';
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
