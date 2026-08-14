import * as api from '../api.js';
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

function splitFullName(fullName) {
  var parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return { first_name: '', last_name: '' };
  }
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: parts[0] };
  }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
  };
}

export function renderEnterFullName(container, options) {
  options = options || {};
  var completeProfile = !!options.completeProfile;
  var saving = false;
  if (!completeProfile) {
    var email = getPendingSignupEmail();
    if (!email) {
      navigate('/create-account');
      return function () {};
    }
  }

  var layout = mountSignupFieldLayout(container, {
    className: 'hc-signup-field--name',
    title: 'Enter your full name',
    subtitle: 'This will be shown on your profile',
    placeholder: 'Full Name',
    backTo: completeProfile ? '/account-created' : '/create-account',
    autoCapitalize: 'words',
    autoComplete: 'name',
    continueDisabled: true,
    onContinue: function (value) {
      if (saving) return;
      var result = validateFullName(value);
      if (!result.ok) {
        showError(result.message || 'Please enter your full name');
        return;
      }
      if (!completeProfile) {
        setPendingSignupFullName(result.data);
        navigate('/enter-password');
        return;
      }
      var names = splitFullName(result.data);
      if (!names.first_name || !names.last_name) {
        showError('Please enter first and last name separated by a space');
        return;
      }
      saving = true;
      if (layout) layout.setContinueDisabled(true);
      api
        .updateUserProfile({
          first_name: names.first_name,
          last_name: names.last_name,
        })
        .then(function () {
          return api.fetchCurrentUser();
        })
        .then(function (user) {
          if (typeof options.onComplete === 'function') {
            return options.onComplete(user);
          }
          navigate('/account-created');
        })
        .catch(function (err) {
          saving = false;
          showError((err && err.message) || 'Failed to save your name. Please try again.');
          if (layout) {
            layout.setContinueDisabled(!String(layout.getValue() || '').trim());
          }
        });
    },
  });

  return function cleanup() {
    if (layout && typeof layout.cleanup === 'function') layout.cleanup();
  };
}
