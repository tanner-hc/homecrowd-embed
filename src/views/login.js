import * as api from '../api.js';
import { navigate } from '../router.js';
import logoUrl from '../assets/header.png';

export function renderLogin(container, onLoginSuccess) {
  container.innerHTML = '\
    <div class="hc-login-container">\
      <div class="hc-login-logo">\
        <img src="' + logoUrl + '" alt="Homecrowd" class="hc-login-logo-img" />\
      </div>\
      <div class="hc-login-card">\
        <h1 class="hc-login-title">Welcome Back</h1>\
        <p class="hc-login-subtitle">Sign in to access your rewards</p>\
        <div id="hc-login-error" class="hc-alert-error" style="display:none"></div>\
        <form id="hc-login-form">\
          <div class="hc-form-group">\
            <label class="hc-label" for="hc-email">Email</label>\
            <input id="hc-email" class="hc-input" type="email" placeholder="you@example.com" autocomplete="email" />\
          </div>\
          <div class="hc-form-group">\
            <label class="hc-label" for="hc-password">Password</label>\
            <div style="position:relative">\
              <input id="hc-password" class="hc-input" type="password" placeholder="Enter your password" autocomplete="current-password" />\
              <button type="button" id="hc-toggle-pw" class="hc-toggle-pw">Show</button>\
            </div>\
          </div>\
          <button type="submit" id="hc-login-btn" class="hc-btn hc-btn-primary hc-btn-large">Sign In</button>\
        </form>\
        <div class="hc-login-footer">Powered by Homecrowd</div>\
      </div>\
    </div>';

  var form = document.getElementById('hc-login-form');
  var emailInput = document.getElementById('hc-email');
  var passwordInput = document.getElementById('hc-password');
  var errorEl = document.getElementById('hc-login-error');
  var submitBtn = document.getElementById('hc-login-btn');
  var toggleBtn = document.getElementById('hc-toggle-pw');

  toggleBtn.addEventListener('click', function () {
    var isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = emailInput.value.trim();
    var password = passwordInput.value.trim();
    if (!email || !password) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
    errorEl.style.display = 'none';

    try {
      await api.login(email, password);
      var user = await api.fetchCurrentUser();
      onLoginSuccess(user);
      navigate('/rewards');
    } catch (err) {
      errorEl.textContent = err.message || 'Login failed';
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}
