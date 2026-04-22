import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import NavHeader from '../base-components/NavHeader.js';
import SecondaryButtonWithSwitch from '../base-components/SecondaryButtonWithSwitch.js';
import { escapeHtml } from '../base-components/html.js';
import bellIconSvg from '../assets/icons/bell.svg?raw';
import phoneIconSvg from '../assets/icons/phone.svg?raw';
import mailIconSvg from '../assets/icons/mail.svg?raw';

function svgAddClass(svgRaw, className) {
  return String(svgRaw).replace(/^<svg\s/i, '<svg class="' + className + '" ');
}

function secondaryIconHtml(svgRaw) {
  return svgAddClass(svgRaw, 'hc-profile-secondary-icon');
}

function notifPrefsStorageKey(userId) {
  return 'hc_embed_notification_prefs_' + String(userId || 'unknown');
}

function loadNotifPrefs(userId) {
  try {
    var raw = localStorage.getItem(notifPrefsStorageKey(userId));
    if (raw) {
      var o = JSON.parse(raw);
      return {
        email: o.email !== false,
        sms: !!o.sms,
      };
    }
  } catch (_e) { }
  return { email: true, sms: false };
}

function saveNotifPrefs(userId, prefs) {
  try {
    localStorage.setItem(notifPrefsStorageKey(userId), JSON.stringify(prefs));
  } catch (_e) { }
}

export function renderNotificationSettings(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading...' });
  loadNotificationSettings(container);
}

async function loadNotificationSettings(container) {
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

  var userId = '';
  if (user) {
    if (user.id != null) userId = String(user.id);
    else if (user.userId != null) userId = String(user.userId);
    else if (user.email) userId = String(user.email);
  }
  var prefs = loadNotifPrefs(userId);

  var html = '';
  html += '<div class="hc-notification-settings">';
  html += '<div class="hc-account-settings-nav">';
  html += NavHeader({
    title: 'Notification settings',
    backButtonId: 'hc-ns-back',
  });
  html += '</div>';
  html += '<div class="hc-ns-body">';
  html += '<div class="hc-ns-banner">';
  html += '<div class="hc-ns-banner-icon">' + secondaryIconHtml(bellIconSvg) + '</div>';
  html += '<div class="hc-ns-banner-text">';
  html += '<div class="hc-ns-banner-title">Stay up to date!</div>';
  html +=
    '<div class="hc-ns-banner-desc">Get Homecrowd updates by email or SMS. Push alerts are only in the mobile app.</div>';
  html += '</div>';
  html += '</div>';
  html += '<div class="hc-profile-menu hc-ns-switches">';
  html += SecondaryButtonWithSwitch({
    leftHtml: secondaryIconHtml(mailIconSvg),
    title: 'Email notifications',
    subtitle: 'Receive updates via email',
    value: prefs.email,
    switchId: 'hc-ns-email',
  });
  html += SecondaryButtonWithSwitch({
    leftHtml: secondaryIconHtml(phoneIconSvg),
    title: 'SMS notifications',
    subtitle: 'Receive updates via text message',
    value: prefs.sms,
    switchId: 'hc-ns-sms',
  });
  html += '</div>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  var backBtn = document.getElementById('hc-ns-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate('/account-settings');
    });
  }

  var emailSw = document.getElementById('hc-ns-email');
  var smsSw = document.getElementById('hc-ns-sms');
  function persist() {
    if (!emailSw || !smsSw) return;
    saveNotifPrefs(userId, { email: !!emailSw.checked, sms: !!smsSw.checked });
  }
  if (emailSw) {
    emailSw.addEventListener('change', persist);
  }
  if (smsSw) {
    smsSw.addEventListener('change', persist);
  }
}
