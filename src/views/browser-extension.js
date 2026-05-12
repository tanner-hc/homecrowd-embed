import * as api from '../api.js';
import { navigate } from '../router.js';
import { postToNative } from '../bridge.js';
import NavHeader from '../base-components/NavHeader.js';
import MainButton from '../base-components/MainButton.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { escapeHtml } from '../base-components/html.js';
import { showError } from '../base-components/toastApi.js';

var EXTENSION_URL = 'https://app.gethomecrowd.com/extension-download/';

function extensionFlagTrue(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.is_extension_enabled === true) return true;
  if (obj.isExtensionEnabled === true) return true;
  return false;
}

function extensionOnFromTier(user) {
  if (!user || typeof user !== 'object') return false;
  var t =
    user.currentTier != null
      ? user.currentTier
      : user.current_tier != null
        ? user.current_tier
        : null;
  if (!t || typeof t !== 'object') return false;
  var o = t.onboarding_status || t.onboardingStatus;
  if (!o || typeof o !== 'object') return false;
  return !!(o.extension_installed || o.extensionInstalled);
}

function userExtensionEnabled(embedUser, profileUser) {
  if (extensionFlagTrue(embedUser)) return true;
  if (extensionFlagTrue(profileUser)) return true;
  if (extensionOnFromTier(embedUser)) return true;
  return false;
}

function buildExtensionContentHtml(enabled, installButtonId) {
  var inner = '';
  inner += '<div class="hc-be-content">';
  if (enabled) {
    inner += '<div class="hc-be-enabled-badge" aria-hidden="true">\u2713</div>';
    inner += '<div class="hc-be-title">Extension enabled</div>';
    inner +=
      '<div class="hc-be-description">You\'re all set. Online offers will appear automatically as you browse in Safari with the Homecrowd extension enabled.</div>';
  } else {
    inner += '<div class="hc-be-title">Safari Extension</div>';
    inner +=
      '<div class="hc-be-description">Install the Homecrowd Safari extension to earn points while browsing your favorite websites.</div>';
    inner += '<div class="hc-be-actions">';
    inner += MainButton({
      id: installButtonId,
      text: 'Install Extension',
    });
    inner += '</div>';
  }
  inner += '</div>';
  return inner;
}

function bindExtensionInstallButton(installBtn) {
  if (!installBtn) return;
  installBtn.addEventListener('click', function () {
    try {
      postToNative('homecrowd:open-url', { url: EXTENSION_URL });
      var child = null;
      try {
        child = window.open(EXTENSION_URL, '_blank', 'noopener,noreferrer');
        if (child) {
          try {
            child.opener = null;
          } catch (_op) {}
        }
      } catch (_wo) {}
      if (!child && window.top && window.top !== window) {
        try {
          child = window.top.open(EXTENSION_URL, '_blank', 'noopener,noreferrer');
          if (child) {
            try {
              child.opener = null;
            } catch (_op2) {}
          }
        } catch (_wt) {}
      }
      if (!child) {
        var a = document.createElement('a');
        a.href = EXTENSION_URL;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (_e) {
      showError('Failed to open extension page');
    }
  });
}

export async function mountBrowserExtensionInline(panelEl) {
  if (!panelEl) return;
  panelEl.innerHTML = LoadingSpinner({ text: 'Loading...' });
  var embedUser;
  try {
    embedUser = await api.fetchCurrentUser();
  } catch (err) {
    panelEl.innerHTML =
      '<div class="hc-alert-error">' + escapeHtml(err.message || 'Failed to load') + '</div>';
    return;
  }
  var profileUser = null;
  try {
    profileUser = await api.getUserProfile();
  } catch (_e) {
    profileUser = null;
  }
  var enabled = userExtensionEnabled(embedUser, profileUser);
  var installId = 'hc-offers-ext-install';
  panelEl.innerHTML =
    '<div class="hc-browser-extension hc-browser-extension--inline">' +
    '<div class="hc-be-body">' +
    buildExtensionContentHtml(enabled, installId) +
    '</div></div>';
  bindExtensionInstallButton(document.getElementById(installId));
}

export function renderBrowserExtension(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading...' });
  loadBrowserExtension(container);
}

async function loadBrowserExtension(container) {
  var embedUser;
  try {
    embedUser = await api.fetchCurrentUser();
  } catch (err) {
    container.innerHTML =
      '<div class="hc-alert-error">' + escapeHtml(err.message || 'Failed to load') + '</div>';
    return;
  }

  var profileUser = null;
  try {
    profileUser = await api.getUserProfile();
  } catch (_e) {
    profileUser = null;
  }

  var enabled = userExtensionEnabled(embedUser, profileUser);
  var html = '';
  html += '<div class="hc-browser-extension">';
  html += '<div class="hc-account-settings-nav">';
  html += NavHeader({
    title: 'Browser Extension',
    backButtonId: 'hc-be-back',
  });
  html += '</div>';
  html += '<div class="hc-be-body">';
  html += buildExtensionContentHtml(enabled, 'hc-be-install');
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  var backBtn = document.getElementById('hc-be-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate('/profile');
    });
  }

  bindExtensionInstallButton(document.getElementById('hc-be-install'));
}
