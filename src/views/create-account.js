import * as api from '../api.js';
import { navigate } from '../router.js';
import { showError } from '../base-components/toastApi.js';
import { escapeAttr } from '../base-components/html.js';
import { getPendingSignupSchool } from './find-your-school.js';
import { getEmbedSchoolId, hasSchoolBrand } from '../brand.js';
import headerUrl from '../assets/header.png';
import googleIconUrl from '../assets/providers/googleIcon.png';
import appleIconUrl from '../assets/providers/apple_icon_dark.png';
import chevronLeftSvg from '../assets/icons/chevron-left.svg?raw';
import { isValidEmail } from '../contact-validation.js';
import {
  authenticateWithApple,
  authenticateWithGoogle,
  isSocialAuthCancelled,
  shouldShowAppleSignIn,
  takePendingGoogleOAuth,
} from '../social-auth.js';

function isSchoolMode() {
  var params = new URLSearchParams(window.location.search);
  var urlSchoolId = String(
    params.get('schoolId') || params.get('schoolID') || params.get('school_id') || '',
  )
    .trim()
    .replace(/^\/+|\/+$/g, '');
  return hasSchoolBrand() || !!getEmbedSchoolId() || !!urlSchoolId;
}

export var PENDING_SIGNUP_EMAIL_KEY = 'hc_embed_pending_signup_email';

export function setPendingSignupEmail(email) {
  try {
    sessionStorage.setItem(PENDING_SIGNUP_EMAIL_KEY, String(email || '').trim().toLowerCase());
  } catch (_e) { }
}

export function getPendingSignupEmail() {
  try {
    return sessionStorage.getItem(PENDING_SIGNUP_EMAIL_KEY) || '';
  } catch (_e) {
    return '';
  }
}

export function clearPendingSignupEmail() {
  try {
    sessionStorage.removeItem(PENDING_SIGNUP_EMAIL_KEY);
  } catch (_e) { }
}

export function renderCreateAccount(container, onSocialSuccess) {
  var school = getPendingSignupSchool() || {};
  var schoolId = school.id || getEmbedSchoolId() || '';
  var checkingEmail = false;
  var emailExists = false;
  var socialBusy = false;

  container.innerHTML =
    '<div class="hc-create-account">' +
    '<div class="hc-create-account-nav">' +
    '<button type="button" id="hc-create-account-back" class="hc-create-account-back" aria-label="Back">' +
    chevronLeftSvg +
    '</button>' +
    '<img data-hc-ph="none" src="' +
    escapeAttr(headerUrl) +
    '" alt="Homecrowd" class="hc-create-account-logo" />' +
    '<span class="hc-create-account-nav-spacer" aria-hidden="true"></span>' +
    '</div>' +
    '<div class="hc-create-account-scroll">' +
    '<h1 class="hc-create-account-title">Create an Account</h1>' +
    '<button type="button" id="hc-create-google" class="hc-create-account-social">' +
    '<img data-hc-ph="none" src="' +
    escapeAttr(googleIconUrl) +
    '" alt="" class="hc-create-account-social-icon" />' +
    '<span>Continue with Google</span>' +
    '</button>' +
    (shouldShowAppleSignIn()
      ? '<button type="button" id="hc-create-apple" class="hc-create-account-social">' +
        '<img data-hc-ph="none" src="' +
        escapeAttr(appleIconUrl) +
        '" alt="" class="hc-create-account-social-icon" />' +
        '<span>Continue with Apple</span>' +
        '</button>'
      : '') +
    '<div class="hc-create-account-divider">' +
    '<span class="hc-create-account-divider-line"></span>' +
    '<span class="hc-create-account-divider-text">or sign up with email</span>' +
    '<span class="hc-create-account-divider-line"></span>' +
    '</div>' +
    '<label class="hc-create-account-label" for="hc-create-email">Email adress</label>' +
    '<div class="hc-create-account-input-wrap" id="hc-create-email-wrap">' +
    '<input type="email" id="hc-create-email" class="hc-create-account-input" placeholder="Email" autocomplete="email" autocapitalize="none" autocorrect="off" />' +
    '</div>' +
    '<div class="hc-create-account-exists" id="hc-create-exists" style="display:none">' +
    '<span class="hc-create-account-exists-text">This email is already registered.</span>' +
    '<button type="button" id="hc-create-exists-login" class="hc-create-account-exists-link">Log in</button>' +
    '</div>' +
    '</div>' +
    '<div class="hc-create-account-actions">' +
    '<button type="button" id="hc-create-email-submit" class="hc-create-account-btn">' +
    '<span class="hc-create-account-btn-label">Sign up with email</span>' +
    '<span class="hc-create-account-btn-spinner" style="display:none" aria-hidden="true"></span>' +
    '</button>' +
    '</div>' +
    '</div>';

  var backBtn = container.querySelector('#hc-create-account-back');
  var emailInput = container.querySelector('#hc-create-email');
  var emailWrap = container.querySelector('#hc-create-email-wrap');
  var existsRow = container.querySelector('#hc-create-exists');
  var existsLogin = container.querySelector('#hc-create-exists-login');
  var submitBtn = container.querySelector('#hc-create-email-submit');
  var submitLabel = container.querySelector('.hc-create-account-btn-label');
  var submitSpinner = container.querySelector('.hc-create-account-btn-spinner');
  var googleBtn = container.querySelector('#hc-create-google');
  var appleBtn = container.querySelector('#hc-create-apple');

  function setEmailExists(next) {
    emailExists = !!next;
    if (emailWrap) {
      emailWrap.classList.toggle('hc-create-account-input-wrap--error', emailExists);
    }
    if (existsRow) {
      existsRow.style.display = emailExists ? '' : 'none';
    }
  }

  function setChecking(next) {
    checkingEmail = !!next;
    if (submitBtn) submitBtn.disabled = checkingEmail;
    if (submitBtn) {
      submitBtn.classList.toggle('hc-create-account-btn--disabled', checkingEmail);
    }
    if (submitLabel) submitLabel.style.display = checkingEmail ? 'none' : '';
    if (submitSpinner) submitSpinner.style.display = checkingEmail ? '' : 'none';
  }

  function setSocialBusy(next) {
    socialBusy = !!next;
    if (googleBtn) googleBtn.disabled = socialBusy;
    if (appleBtn) appleBtn.disabled = socialBusy;
    if (submitBtn) submitBtn.disabled = socialBusy || checkingEmail;
  }

  function finishSocial(result) {
    if (typeof onSocialSuccess === 'function') {
      return onSocialSuccess(result);
    }
    navigate('/');
  }

  function runSocial(provider) {
    if (socialBusy || checkingEmail) return;
    setSocialBusy(true);
    var run = provider === 'apple' ? authenticateWithApple() : authenticateWithGoogle();
    run
      .then(function (result) {
        return finishSocial(result);
      })
      .catch(function (err) {
        setSocialBusy(false);
        if (isSocialAuthCancelled(err)) return;
        showError((err && err.message) || 'Unable to sign in');
      });
  }

  function goToLogin() {
    var email = emailInput ? String(emailInput.value || '').trim().toLowerCase() : '';
    var q = email ? '?email=' + encodeURIComponent(email) : '';
    navigate('/login' + q);
  }

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate(isSchoolMode() ? '/get-started' : '/youre-in');
    });
  }

  if (emailInput) {
    emailInput.addEventListener('input', function () {
      setEmailExists(false);
    });
  }

  if (existsLogin) {
    existsLogin.addEventListener('click', function () {
      goToLogin();
    });
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', function () {
      runSocial('google');
    });
  }

  if (appleBtn) {
    appleBtn.addEventListener('click', function () {
      runSocial('apple');
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      var trimmed = emailInput ? String(emailInput.value || '').trim() : '';
      if (!isValidEmail(trimmed)) {
        showError('Please enter a valid email');
        return;
      }
      if (checkingEmail || socialBusy) return;

      setChecking(true);
      setEmailExists(false);

      api
        .checkEmailExists(trimmed)
        .then(function (exists) {
          if (exists) {
            setEmailExists(true);
            return;
          }
          setPendingSignupEmail(trimmed);
          if (schoolId) {
            try {
              sessionStorage.setItem('hc_embed_pending_signup_school_id', String(schoolId));
            } catch (_e) { }
          }
          navigate('/enter-full-name');
        })
        .catch(function () {
          showError('Unable to verify email. Please try again.');
        })
        .then(function () {
          setChecking(false);
        });
    });
  }

  if (emailInput) {
    window.setTimeout(function () {
      emailInput.focus();
    }, 200);
  }

  var pendingGoogle = takePendingGoogleOAuth();
  if (pendingGoogle && pendingGoogle.id_token) {
    setSocialBusy(true);
    api
      .googleLogin(pendingGoogle.id_token)
      .then(function (result) {
        return finishSocial(result);
      })
      .catch(function (err) {
        setSocialBusy(false);
        showError((err && err.message) || 'Unable to sign in');
      });
  } else if (pendingGoogle && pendingGoogle.error && pendingGoogle.error !== 'access_denied') {
    showError(pendingGoogle.error_description || pendingGoogle.error || 'Google Sign-In failed');
  }
}
