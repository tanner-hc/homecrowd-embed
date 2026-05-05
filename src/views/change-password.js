import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import NavHeader from '../base-components/NavHeader.js';
import MainButton from '../base-components/MainButton.js';
import { escapeHtml } from '../base-components/html.js';
import { showSuccess, showError } from '../base-components/toastApi.js';

function hasPassword(user) {
  if (!user) return true;
  if (user.has_password === false || user.hasPassword === false) return false;
  return true;
}

export function renderChangePassword(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading...' });
  loadChangePassword(container);
}

async function loadChangePassword(container) {
  var user;
  try {
    user = await api.getUserProfile();
  } catch (_e) {
    try {
      user = await api.fetchCurrentUser();
    } catch (err) {
      container.innerHTML =
        '<div class="hc-alert-error">' + escapeHtml(err.message || 'Failed to load') + '</div>';
      return;
    }
  }

  var needCurrent = hasPassword(user);

  var html = '';
  html += '<div class="hc-profile-details hc-change-password-page">';
  html += '<div class="hc-account-settings-nav">';
  html += NavHeader({
    title: 'Change Password',
    backButtonId: 'hc-cp-back',
  });
  html += '</div>';
  html += '<div class="hc-pd-form">';
  html +=
    '<p class="hc-cp-intro">' +
    (needCurrent
      ? 'Enter your current password and choose a new one.'
      : 'No password is set for this account. Enter a new password to secure your account.') +
    '</p>';
  if (needCurrent) {
    html += '<div class="hc-form-group hc-pd-field">';
    html += '<label class="hc-label" for="hc-cp-current">Current password</label>';
    html +=
      '<input id="hc-cp-current" class="hc-input hc-pd-input" type="password" autocomplete="current-password" placeholder="Enter current password" />';
    html += '</div>';
  }
  html += '<div class="hc-form-group hc-pd-field">';
  html += '<label class="hc-label" for="hc-cp-new">New password</label>';
  html +=
    '<input id="hc-cp-new" class="hc-input hc-pd-input" type="password" autocomplete="new-password" placeholder="Enter new password" />';
  html += '</div>';
  html += '<div class="hc-form-group hc-pd-field">';
  html += '<label class="hc-label" for="hc-cp-confirm">Confirm new password</label>';
  html +=
    '<input id="hc-cp-confirm" class="hc-input hc-pd-input" type="password" autocomplete="new-password" placeholder="Confirm new password" />';
  html += '</div>';
  html += '<div class="hc-pd-actions">';
  html += MainButton({
    id: 'hc-cp-save',
    text: 'Save Changes',
    loadingText: 'Saving...',
  });
  html += '</div>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  var backBtn = document.getElementById('hc-cp-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate('/security-settings');
    });
  }

  var saveBtn = document.getElementById('hc-cp-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async function () {
      var newPw = (document.getElementById('hc-cp-new') || {}).value || '';
      var confirmPw = (document.getElementById('hc-cp-confirm') || {}).value || '';
      if (newPw !== confirmPw) {
        showError('New passwords do not match');
        return;
      }
      var payload = { new_password: newPw };
      if (needCurrent) {
        payload.current_password = (document.getElementById('hc-cp-current') || {}).value || '';
        if (!payload.current_password) {
          showError('Current password is required');
          return;
        }
      }
      saveBtn.disabled = true;
      var prevHtml = saveBtn.innerHTML;
      saveBtn.innerHTML =
        '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>Saving...</span>';
      try {
        var data = await api.changePassword(payload);
        if (data && data.tokens && data.tokens.access) {
          api.setTokens(data.tokens.access, data.tokens.refresh || null);
        }
        showSuccess('Password changed successfully');
        navigate('/security-settings');
      } catch (err) {
        showError(err.message || 'Failed to change password');
        saveBtn.disabled = false;
        saveBtn.innerHTML = prevHtml;
      }
    });
  }
}
