import * as api from '../api.js';
import { navigate } from '../router.js';
import { showError } from '../base-components/toastApi.js';
import { mountSignupFieldLayout } from '../base-components/SignupFieldLayout.js';
import { validatePassword } from '../signup-validation.js';
import { getPendingSignupEmail } from './create-account.js';
import { getPendingSignupFullName } from './enter-full-name.js';
import { getPendingSignupSchool } from './find-your-school.js';

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

function registrationErrorMessage(err) {
  var body = err && err.body;
  if (!body || typeof body !== 'object') {
    return (err && err.message) || 'Registration failed. Please try again.';
  }
  if (body.email) {
    return Array.isArray(body.email) ? body.email[0] : body.email;
  }
  if (body.password) {
    return Array.isArray(body.password) ? body.password[0] : body.password;
  }
  if (body.detail) {
    return body.detail;
  }
  return (err && err.message) || 'Registration failed. Please try again.';
}

/**
 * @param {HTMLElement} container
 * @param {function} onSuccess - called with user after register
 */
export function renderEnterPassword(container, onSuccess) {
  var email = getPendingSignupEmail();
  var fullName = getPendingSignupFullName();
  var school = getPendingSignupSchool() || {};
  var schoolId = school.id || '';
  var loading = false;

  if (!email) {
    navigate('/create-account');
    return function () {};
  }
  if (!fullName) {
    navigate('/enter-full-name');
    return function () {};
  }

  var layout = mountSignupFieldLayout(container, {
    title: 'Enter your password',
    subtitle: '8+ chars, upper, lower, and a number',
    placeholder: 'Password',
    backTo: '/enter-full-name',
    secureTextEntry: true,
    showPasswordToggle: true,
    autoCapitalize: 'none',
    autoComplete: 'new-password',
    continueDisabled: true,
    onContinue: function (value) {
      if (loading) return;

      var passwordResult = validatePassword(value);
      if (!passwordResult.ok) {
        showError(passwordResult.message || 'Invalid password');
        return;
      }

      var names = splitFullName(fullName);
      if (!names.first_name || !names.last_name) {
        showError('Please enter your full name');
        navigate('/enter-full-name');
        return;
      }

      loading = true;
      if (layout) layout.setContinueDisabled(true);

      api
        .register({
          first_name: names.first_name,
          last_name: names.last_name,
          email: email,
          password: passwordResult.data,
          password_confirm: passwordResult.data,
          accepted_terms_and_policies: true,
          registration_source: 'homecrowd_embedded',
          school_id: schoolId || undefined,
        })
        .then(function (response) {
          var user = response && response.user ? response.user : null;
          var assignId = schoolId;
          if (!assignId) {
            try {
              assignId = sessionStorage.getItem('hc_embed_pending_signup_school_id') || '';
            } catch (_e) { }
          }

          var assignPromise = assignId
            ? api.assignSchool(assignId).catch(function () {
                return null;
              })
            : Promise.resolve(null);

          return assignPromise.then(function () {
            return api.fetchCurrentUser().catch(function () {
              return user;
            });
          });
        })
        .then(function (user) {
          if (typeof onSuccess === 'function') {
            return onSuccess(user);
          }
          navigate('/account-created');
        })
        .catch(function (err) {
          showError(registrationErrorMessage(err));
          loading = false;
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
