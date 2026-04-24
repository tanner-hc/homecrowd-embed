import * as api from '../api.js';
import logoUrl from '../assets/header.png';
import Input from '../base-components/Input.js';
import Button from '../base-components/Button.js';

export function renderLogin(container, onLoginSuccess, options) {
  var schoolId = options && options.schoolId ? String(options.schoolId).trim() : '';
  container.innerHTML =
    '<div class="hc-login-shell">' +
    '<div class="hc-login-bg"></div>' +
    '<div class="hc-login-overlay">' +
    '<div class="hc-login-container">' +
    '<div class="hc-login-logo">' +
    '<img src="' +
    logoUrl +
    '" alt="Homecrowd" class="hc-login-logo-img" />' +
    '</div>' +
    '<div class="hc-login-card">' +
    '<div class="hc-login-switch">' +
    '<button type="button" id="hc-auth-mode-signin" class="hc-login-switch-btn active">Sign In</button>' +
    '<button type="button" id="hc-auth-mode-signup" class="hc-login-switch-btn">Sign Up</button>' +
    '</div>' +
    '<div class="hc-login-heading">' +
    '<h1 class="hc-login-title">Shop Smarter.</h1>' +
    '<h1 class="hc-login-title">Cheer Louder.</h1>' +
    '</div>' +
    '<p class="hc-login-subtitle">Sign in to access your rewards</p>' +
    '<div id="hc-login-error" class="hc-alert-error" style="display:none"></div>' +
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
    Input({
      id: 'hc-email',
      name: 'email',
      type: 'email',
      label: 'Email',
      placeholder: 'you@example.com',
      autocomplete: 'email',
      value: '',
    }) +
    '<div class="hc-form-group">' +
    '<label class="hc-label" for="hc-password">Password</label>' +
    '<div style="position:relative">' +
    '<input id="hc-password" class="hc-input" type="password" placeholder="Enter your password" autocomplete="current-password" />' +
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
    '<div id="hc-signup-terms-wrap" class="hc-form-group hc-login-terms" style="display:none">' +
    '<label class="hc-login-checkbox-label">' +
    '<input id="hc-accept-terms" type="checkbox" />' +
    '<span>I agree to Terms and Privacy Policy</span>' +
    '</label>' +
    '</div>' +
    Button({
      id: 'hc-login-btn',
      title: 'Sign In',
      type: 'submit',
      variant: 'primary',
      className: 'hc-btn-large hc-login-submit-btn',
    }) +
    '</form>' +
    '<div class="hc-login-footer">Powered by Homecrowd</div>' +
    '</div>' +
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
  var firstNameInput = document.getElementById('hc-first-name');
  var lastNameInput = document.getElementById('hc-last-name');
  var passwordConfirmInput = document.getElementById('hc-password-confirm');
  var acceptTermsInput = document.getElementById('hc-accept-terms');
  var loginCardEl = container.querySelector('.hc-login-card');
  var titleEls = container.querySelectorAll('.hc-login-title');
  var subtitleEl = container.querySelector('.hc-login-subtitle');
  var mode = 'signin';

  function applyMode(nextMode) {
    mode = nextMode === 'signup' ? 'signup' : 'signin';
    var isSignup = mode === 'signup';
    if (loginCardEl) {
      loginCardEl.classList.toggle('hc-login-card--signup', isSignup);
    }
    signupNameRow.style.display = isSignup ? '' : 'none';
    signupConfirmWrap.style.display = isSignup ? '' : 'none';
    signupTermsWrap.style.display = isSignup ? '' : 'none';
    signupModeBtn.classList.toggle('active', isSignup);
    signinModeBtn.classList.toggle('active', !isSignup);
    if (titleEls[0]) {
      titleEls[0].textContent = isSignup ? 'Create Account' : 'Shop Smarter.';
    }
    if (titleEls[1]) {
      titleEls[1].textContent = isSignup ? '' : 'Cheer Louder.';
      titleEls[1].style.display = isSignup ? 'none' : '';
    }
    subtitleEl.textContent = isSignup
      ? 'Create a Homecrowd account to continue'
      : 'Sign in to access your rewards';
    submitBtn.textContent = isSignup ? 'Create Account' : 'Sign In';
    passwordInput.setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
    errorEl.style.display = 'none';
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
  signupModeBtn.addEventListener('click', function () {
    applyMode('signup');
  });
  signinModeBtn.addEventListener('click', function () {
    applyMode('signin');
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var isSignup = mode === 'signup';
    var email = emailInput.value.trim();
    var password = passwordInput.value.trim();
    var firstName = firstNameInput.value.trim();
    var lastName = lastNameInput.value.trim();
    var passwordConfirm = passwordConfirmInput.value.trim();
    var acceptedTerms = !!acceptTermsInput.checked;
    if (!email || !password) return;
    if (isSignup) {
      if (!firstName || !lastName || !passwordConfirm) return;
      if (password !== passwordConfirm) {
        errorEl.textContent = "Passwords don't match";
        errorEl.style.display = 'block';
        return;
      }
      if (!acceptedTerms) {
        errorEl.textContent = 'Please accept Terms and Privacy Policy';
        errorEl.style.display = 'block';
        return;
      }
    }

    submitBtn.disabled = true;
    submitBtn.textContent = isSignup ? 'Creating account...' : 'Signing in...';
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
          school_id: schoolId || undefined,
        });
      } else {
        await api.login(email, password);
      }
      var user = await api.fetchCurrentUser();
      await onLoginSuccess(user, { mode: mode });
    } catch (err) {
      errorEl.textContent = err.message || 'Login failed';
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = isSignup ? 'Create Account' : 'Sign In';
    }
  });

  applyMode('signin');
}
