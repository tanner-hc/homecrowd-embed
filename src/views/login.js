import * as api from '../api.js';
import defaultHeaderLogoUrl from '../assets/header.png';
import Input from '../base-components/Input.js';
import { escapeAttr, escapeHtml } from '../base-components/html.js';
import { PRIVACY_URL, TERMS_URL } from '../legal-urls.js';

function sortSchoolsForPicker(schools) {
  var list = Array.isArray(schools) ? schools.slice() : [];
  var withLogos = [];
  var withoutLogos = [];
  list.forEach(function (school) {
    if (school && school.image && String(school.image).trim()) {
      withLogos.push(school);
    } else {
      withoutLogos.push(school);
    }
  });
  withLogos.sort(function (a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  withoutLogos.sort(function (a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  return withLogos.concat(withoutLogos);
}

function setFieldErrorState(el, hasError) {
  if (!el) return;
  el.classList.toggle('hc-login-field-error', !!hasError);
  if (el.id === 'hc-email' || el.id === 'hc-first-name' || el.id === 'hc-last-name') {
    var group = el.closest('.hc-bc-input-group');
    if (group) {
      var label = group.querySelector('.hc-label');
      if (label) label.classList.toggle('hc-login-label--error', !!hasError);
    }
  }
  if (el.id === 'hc-signup-school') {
    var schoolLabel = document.querySelector('label[for="hc-signup-school"]');
    if (schoolLabel) schoolLabel.classList.toggle('hc-login-label--error', !!hasError);
  }
  if (el.id === 'hc-password' || el.id === 'hc-password-confirm') {
    var pwLabel = document.querySelector('label[for="' + el.id + '"]');
    if (pwLabel) pwLabel.classList.toggle('hc-login-label--error', !!hasError);
  }
}

export function renderLogin(container, onLoginSuccess, options) {
  var schoolId = options && options.schoolId ? String(options.schoolId).trim() : '';
  var initialEmail = options && options.initialEmail ? String(options.initialEmail).trim() : '';
  var lockEmail = !!(options && options.lockEmail);
  var initialNotice = options && options.notice ? String(options.notice) : '';
  var isSchoolSelectionLocked = !!schoolId;
  container.innerHTML =
    '<div class="hc-login-shell">' +
    '<div class="hc-login-bg"></div>' +
    '<div class="hc-login-overlay">' +
    '<div class="hc-login-container">' +
    '<div class="hc-login-logo">' +
    '<img src="' +
    defaultHeaderLogoUrl +
    '" alt="Homecrowd" class="hc-login-logo-img" />' +
    '</div>' +
    '<div class="hc-login-card">' +
    '<div class="hc-login-heading">' +
    '<button type="button" id="hc-signup-back-btn" class="hc-signup-back-btn" style="display:none" aria-label="Back to login">' +
    '<span class="hc-signup-back-arrow">&larr;</span>' +
    '</button>' +
    '<h1 class="hc-login-title">Shop Smarter.</h1>' +
    '<h1 class="hc-login-title">Cheer Louder.</h1>' +
    '</div>' +
    '<div id="hc-login-error" class="hc-alert-error" style="' +
    (initialNotice ? '' : 'display:none') +
    '">' +
    escapeHtml(initialNotice) +
    '</div>' +
    '<form id="hc-login-form">' +
    '<div id="hc-signup-name-row" class="hc-login-signup-row" style="display:none">' +
    '<div class="hc-login-signup-col">' +
    Input({
      id: 'hc-first-name',
      name: 'first_name',
      type: 'text',
      label: 'First name',
      placeholder: 'First name',
      autocomplete: 'given-name',
      value: '',
    }) +
    '</div>' +
    '<div class="hc-login-signup-col">' +
    Input({
      id: 'hc-last-name',
      name: 'last_name',
      type: 'text',
      label: 'Last name',
      placeholder: 'Last name',
      autocomplete: 'family-name',
      value: '',
    }) +
    '</div>' +
    '</div>' +
    '<div id="hc-signup-school-wrap" class="hc-form-group" style="display:none">' +
    '<label class="hc-label" for="hc-signup-school">School</label>' +
    '<select id="hc-signup-school" class="hc-input hc-login-school-select">' +
    '<option value="">Select your school</option>' +
    '</select>' +
    '</div>' +
    Input({
      id: 'hc-email',
      name: 'email',
      type: 'email',
      label: 'Email',
      placeholder: 'Email',
      autocomplete: 'email',
      value: '',
    }) +
    '<div class="hc-form-group" id="hc-password-wrap">' +
    '<label class="hc-label" id="hc-password-label" for="hc-password">Password</label>' +
    '<div style="position:relative">' +
    '<input id="hc-password" class="hc-input" type="password" placeholder="Password" autocomplete="current-password" />' +
    '<button type="button" id="hc-toggle-pw" class="hc-toggle-pw">Show</button>' +
    '</div>' +
    '</div>' +
    '<div id="hc-signup-password-confirm-wrap" class="hc-form-group" style="display:none">' +
    '<label class="hc-label" for="hc-password-confirm">Confirm password</label>' +
    '<div style="position:relative">' +
    '<input id="hc-password-confirm" class="hc-input" type="password" placeholder="Confirm your password" autocomplete="new-password" />' +
    '<button type="button" id="hc-toggle-pw-confirm" class="hc-toggle-pw">Show</button>' +
    '</div>' +
    '</div>' +
    '<div id="hc-forgot-password-wrap" class="hc-login-forgot-wrap">' +
    '<a href="#/forgot-password" class="hc-login-forgot-link">Forgot your password?</a>' +
    '</div>' +
    '<p id="hc-login-signup-prompt" class="hc-login-signup-prompt">' +
    'Log in to your account to get access to your dashboard. New to the app? ' +
    '<button type="button" id="hc-login-signup-link" class="hc-login-signup-link">Sign up</button>' +
    '</p>' +
    '<div id="hc-signup-terms-wrap" class="hc-form-group hc-login-terms" style="display:none">' +
    '<label class="hc-login-checkbox-label">' +
    '<input id="hc-accept-terms" type="checkbox" />' +
    '<span>I agree to <a href="' +
    escapeHtml(TERMS_URL) +
    '" target="_blank" rel="noopener noreferrer">Terms and Conditions</a> and <a href="' +
    escapeHtml(PRIVACY_URL) +
    '" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span>' +
    '</label>' +
    '</div>' +
    '</form>' +
    '<div class="hc-login-footer">Powered by Homecrowd</div>' +
    '</div>' +
    '<button class="hc-btn hc-btn-primary hc-btn-large hc-login-submit-btn" id="hc-login-btn" type="submit" form="hc-login-form">Log In</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  var form = document.getElementById('hc-login-form');
  var emailInput = document.getElementById('hc-email');
  var passwordInput = document.getElementById('hc-password');
  var errorEl = document.getElementById('hc-login-error');
  var submitBtn = document.getElementById('hc-login-btn');
  var toggleBtn = document.getElementById('hc-toggle-pw');
  var toggleConfirmBtn = document.getElementById('hc-toggle-pw-confirm');
  var signupModeBtn = document.getElementById('hc-auth-mode-signup');
  var signinModeBtn = document.getElementById('hc-auth-mode-signin');
  var signupNameRow = document.getElementById('hc-signup-name-row');
  var signupConfirmWrap = document.getElementById('hc-signup-password-confirm-wrap');
  var signupTermsWrap = document.getElementById('hc-signup-terms-wrap');
  var forgotPasswordWrap = document.getElementById('hc-forgot-password-wrap');
  var signupPrompt = document.getElementById('hc-login-signup-prompt');
  var signupPromptBtn = document.getElementById('hc-login-signup-link');
  var signupBackBtn = document.getElementById('hc-signup-back-btn');
  var firstNameInput = document.getElementById('hc-first-name');
  var lastNameInput = document.getElementById('hc-last-name');
  var passwordConfirmInput = document.getElementById('hc-password-confirm');
  var acceptTermsInput = document.getElementById('hc-accept-terms');
  var signupSchoolWrap = document.getElementById('hc-signup-school-wrap');
  var signupSchoolSelect = document.getElementById('hc-signup-school');
  var loginCardEl = container.querySelector('.hc-login-card');
  var titleEls = container.querySelectorAll('.hc-login-title');
  var subtitleEl = container.querySelector('.hc-login-subtitle');
  var mode = 'signin';
  var schoolsLoaded = false;
  var schoolsLoading = false;

  function clearSignupFieldErrors() {
    var fields = document.querySelectorAll(
      '#hc-login-form .hc-login-field-error, #hc-login-form .hc-login-label--error',
    );
    fields.forEach(function (el) {
      el.classList.remove('hc-login-field-error', 'hc-login-label--error');
    });
    if (signupTermsWrap) signupTermsWrap.classList.remove('hc-login-field-error');
  }

  function applySignupFieldErrors(fieldKeys) {
    var map = {
      first_name: firstNameInput,
      last_name: lastNameInput,
      school: signupSchoolSelect,
      email: emailInput,
      password: passwordInput,
      password_confirm: passwordConfirmInput,
    };
    fieldKeys.forEach(function (key) {
      setFieldErrorState(map[key], true);
    });
    if (fieldKeys.indexOf('terms') >= 0 && signupTermsWrap) {
      signupTermsWrap.classList.add('hc-login-field-error');
    }
  }

  function validateSignupFields(values) {
    clearSignupFieldErrors();
    var invalid = [];
    if (!values.firstName) invalid.push('first_name');
    if (!values.lastName) invalid.push('last_name');
    if (!values.selectedSchoolId) invalid.push('school');
    if (!values.email) invalid.push('email');
    if (!values.password) invalid.push('password');
    if (!values.passwordConfirm) invalid.push('password_confirm');
    if (values.password && values.passwordConfirm && values.password !== values.passwordConfirm) {
      if (invalid.indexOf('password') < 0) invalid.push('password');
      if (invalid.indexOf('password_confirm') < 0) invalid.push('password_confirm');
    }
    if (!values.acceptedTerms) invalid.push('terms');
    if (invalid.length) {
      applySignupFieldErrors(invalid);
    }
    return invalid;
  }

  function bindClearOnInput(el, extraWrap) {
    if (!el) return;
    var evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, function () {
      setFieldErrorState(el, false);
      if (extraWrap) extraWrap.classList.remove('hc-login-field-error');
    });
  }

  function populateSchoolSelect(schools) {
    if (!signupSchoolSelect) return;
    var sorted = sortSchoolsForPicker(schools);
    var html = '<option value="">Select your school</option>';
    sorted.forEach(function (school) {
      if (!school || school.id == null) return;
      var id = String(school.id);
      var name = school.name ? String(school.name) : 'School';
      var location = [school.city, school.state].filter(Boolean).join(', ');
      var label = location ? name + ' (' + location + ')' : name;
      html +=
        '<option value="' + escapeAttr(id) + '">' + escapeHtml(label) + '</option>';
    });
    signupSchoolSelect.innerHTML = html;
    if (schoolId) {
      signupSchoolSelect.value = schoolId;
    }
    signupSchoolSelect.disabled = isSchoolSelectionLocked;
  }

  async function ensureSchoolsLoaded() {
    if (schoolsLoaded || schoolsLoading) return;
    schoolsLoading = true;
    try {
      var data = await api.fetchPublicSchools();
      var list = (data && data.results) || data || [];
      populateSchoolSelect(list);
      schoolsLoaded = true;
    } catch (err) {
      errorEl.textContent = err.message || 'Failed to load schools';
      errorEl.style.display = 'block';
    } finally {
      schoolsLoading = false;
    }
  }

  function applyMode(nextMode) {
    mode = nextMode === 'signup' ? 'signup' : 'signin';
    var isSignup = mode === 'signup';
    if (loginCardEl) {
      loginCardEl.classList.toggle('hc-login-card--signup', isSignup);
    }
    signupNameRow.style.display = isSignup ? '' : 'none';
    signupSchoolWrap.style.display = isSignup ? '' : 'none';
    signupConfirmWrap.style.display = isSignup ? '' : 'none';
    signupTermsWrap.style.display = isSignup ? '' : 'none';
    if (isSignup) {
      ensureSchoolsLoaded();
    } else {
      clearSignupFieldErrors();
    }
    forgotPasswordWrap.style.display = isSignup ? 'none' : '';
    signupPrompt.style.display = isSignup ? 'none' : '';
    signupBackBtn.style.display = isSignup ? 'inline-flex' : 'none';
    if (signupModeBtn) {
      signupModeBtn.classList.toggle('active', isSignup);
    }
    if (signinModeBtn) {
      signinModeBtn.classList.toggle('active', !isSignup);
    }
    if (titleEls[0]) {
      titleEls[0].textContent = isSignup ? 'Create Account' : 'Shop Smarter.';
    }
    if (titleEls[1]) {
      titleEls[1].textContent = isSignup ? '' : 'Cheer Louder.';
      titleEls[1].style.display = isSignup ? 'none' : '';
    }
    if (subtitleEl) {
      subtitleEl.textContent = isSignup ? 'Create a Homecrowd account to continue' : '';
    }
    submitBtn.textContent = isSignup ? 'Create Account' : 'Log In';
    passwordInput.setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
    if (isSignup || !initialNotice) {
      errorEl.style.display = 'none';
    } else {
      errorEl.style.display = 'block';
      errorEl.textContent = initialNotice;
    }
    if (!isSignup) clearSignupFieldErrors();
  }

  bindClearOnInput(firstNameInput);
  bindClearOnInput(lastNameInput);
  bindClearOnInput(signupSchoolSelect);
  bindClearOnInput(emailInput);
  bindClearOnInput(passwordInput);
  bindClearOnInput(passwordConfirmInput);
  if (acceptTermsInput) {
    acceptTermsInput.addEventListener('change', function () {
      if (signupTermsWrap) signupTermsWrap.classList.remove('hc-login-field-error');
    });
  }

  toggleBtn.addEventListener('click', function () {
    var isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
  });
  toggleConfirmBtn.addEventListener('click', function () {
    var isPassword = passwordConfirmInput.type === 'password';
    passwordConfirmInput.type = isPassword ? 'text' : 'password';
    toggleConfirmBtn.textContent = isPassword ? 'Hide' : 'Show';
  });
  if (signupModeBtn) {
    signupModeBtn.addEventListener('click', function () {
      applyMode('signup');
    });
  }
  if (signinModeBtn) {
    signinModeBtn.addEventListener('click', function () {
      applyMode('signin');
    });
  }
  signupPromptBtn.addEventListener('click', function () {
    applyMode('signup');
  });
  signupBackBtn.addEventListener('click', function () {
    applyMode('signin');
  });

  if (initialEmail) {
    emailInput.value = initialEmail;
  }
  if (lockEmail) {
    emailInput.readOnly = true;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var isSignup = mode === 'signup';
    var email = emailInput.value.trim();
    var password = passwordInput.value.trim();
    var firstName = firstNameInput.value.trim();
    var lastName = lastNameInput.value.trim();
    var passwordConfirm = passwordConfirmInput.value.trim();
    var acceptedTerms = !!acceptTermsInput.checked;
    var selectedSchoolId =
      signupSchoolSelect && signupSchoolSelect.value
        ? String(signupSchoolSelect.value).trim()
        : '';
    if (!selectedSchoolId && isSchoolSelectionLocked) {
      selectedSchoolId = schoolId;
    }
    if (isSignup) {
      if (schoolsLoading) {
        errorEl.textContent = 'Loading schools, please wait';
        errorEl.style.display = 'block';
        return;
      }
      var invalidFields = validateSignupFields({
        firstName: firstName,
        lastName: lastName,
        selectedSchoolId: selectedSchoolId,
        email: email,
        password: password,
        passwordConfirm: passwordConfirm,
        acceptedTerms: acceptedTerms,
      });
      if (invalidFields.length) {
        if (
          invalidFields.indexOf('password') >= 0 &&
          invalidFields.indexOf('password_confirm') >= 0 &&
          password &&
          passwordConfirm &&
          password !== passwordConfirm
        ) {
          errorEl.textContent = "Passwords don't match";
        } else {
          errorEl.textContent = 'Please fill in all required fields';
        }
        errorEl.style.display = 'block';
        return;
      }
    } else if (!email || !password) {
      clearSignupFieldErrors();
      if (!email) setFieldErrorState(emailInput, true);
      if (!password) setFieldErrorState(passwordInput, true);
      errorEl.textContent = 'Please enter email and password';
      errorEl.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = isSignup ? 'Creating account...' : 'Logging in...';
    errorEl.style.display = 'none';

    try {
      if (isSignup) {
        await api.register({
          email: email,
          first_name: firstName,
          last_name: lastName,
          password: password,
          password_confirm: passwordConfirm,
          accepted_terms_and_policies: acceptedTerms,
          registration_source: 'homecrowd_embedded',
          school_id: selectedSchoolId || undefined,
        });
      } else {
        await api.login(email, password);
      }
      var user = await api.fetchCurrentUser();
      await onLoginSuccess(user, {
        mode: mode,
        signupSchoolId: isSignup ? selectedSchoolId : '',
      });
    } catch (err) {
      errorEl.textContent = err.message || 'Login failed';
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = isSignup ? 'Create Account' : 'Log In';
    }
  });

  applyMode('signin');
}
