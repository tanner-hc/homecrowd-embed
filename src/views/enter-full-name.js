import { navigate } from '../router.js';
import { showError } from '../base-components/toastApi.js';
import { mountSignupFieldLayout } from '../base-components/SignupFieldLayout.js';
import { validateFullName } from '../signup-validation.js';
import { getPendingSignupEmail } from './create-account.js';

export var PENDING_SIGNUP_FULL_NAME_KEY = 'hc_embed_pending_signup_full_name';

export function setPendingSignupFullName(fullName) {
  try {
    sessionStorage.setItem(PENDING_SIGNUP_FULL_NAME_KEY, String(fullName || '').trim());
  } catch (_e) { }
}

export function getPendingSignupFullName() {
  try {
    return sessionStorage.getItem(PENDING_SIGNUP_FULL_NAME_KEY) || '';
  } catch (_e) {
    return '';
  }
}

export function clearPendingSignupFullName() {
  try {
    sessionStorage.removeItem(PENDING_SIGNUP_FULL_NAME_KEY);
  } catch (_e) { }
}

export function renderEnterFullName(container) {
  var email = getPendingSignupEmail();
  if (!email) {
    navigate('/create-account');
    return function () {};
  }

  var layout = mountSignupFieldLayout(container, {
    className: 'hc-signup-field--name',
    title: 'Enter your full name',
    subtitle: 'This will be shown on your profile',
    placeholder: 'Full Name',
    backTo: '/create-account',
    autoCapitalize: 'words',
    autoComplete: 'name',
    continueDisabled: true,
    onContinue: function (value) {
      var result = validateFullName(value);
      if (!result.ok) {
        showError(result.message || 'Please enter your full name');
        return;
      }
      setPendingSignupFullName(result.data);
      navigate('/enter-password');
    },
  });

  return function cleanup() {
    if (layout && typeof layout.cleanup === 'function') layout.cleanup();
  };
}
