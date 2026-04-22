import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import NavHeader from '../base-components/NavHeader.js';
import SecondaryButton from '../base-components/SecondaryButton.js';
import { escapeHtml } from '../base-components/html.js';
import settingsIconSvg from '../assets/icons/settings.svg?raw';
import bellIconSvg from '../assets/icons/bell.svg?raw';
import lockIconSvg from '../assets/icons/lock.svg?raw';
import chevronRightIconSvg from '../assets/icons/chevron-right.svg?raw';

function svgAddClass(svgRaw, className) {
  return String(svgRaw).replace(/^<svg\s/i, '<svg class="' + className + '" ');
}

function secondaryIconHtml(svgRaw) {
  return svgAddClass(svgRaw, 'hc-profile-secondary-icon');
}

function chevronRightHtml() {
  return svgAddClass(chevronRightIconSvg, 'hc-profile-chevron-icon');
}

export function renderAccountSettings(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading...' });
  loadAccountSettings(container);
}

async function loadAccountSettings(container) {
  var currentUser;
  try {
    currentUser = await api.fetchCurrentUser();
  } catch (err) {
    container.innerHTML =
      '<div class="hc-alert-error">' + escapeHtml(err.message || 'Failed to load') + '</div>';
    return;
  }

  var showSecurityBadge = !!(
    currentUser &&
    (currentUser.emailVerified === false || currentUser.email_verified === false)
  );

  var html = '';
  html += '<div class="hc-account-settings">';
  html += '<div class="hc-account-settings-nav">';
  html += NavHeader({
    title: 'Account settings',
    backButtonId: 'hc-as-back',
  });
  html += '</div>';
  html += '<div class="hc-account-settings-body">';
  html += '<div class="hc-profile-menu hc-account-settings-section">';
  html += SecondaryButton({
    leftHtml: secondaryIconHtml(settingsIconSvg),
    title: 'Profile Details',
    rightHtml: chevronRightHtml(),
    id: 'hc-as-profile-details',
  });
  html += '</div>';
  html += '<div class="hc-profile-menu hc-account-settings-section">';
  html += SecondaryButton({
    leftHtml: secondaryIconHtml(bellIconSvg),
    title: 'Notification settings',
    subtitle: 'Configure notification settings',
    rightHtml: chevronRightHtml(),
    id: 'hc-as-notifications',
  });
  html += '</div>';
  html += '<div class="hc-profile-menu hc-account-settings-section">';
  html += SecondaryButton({
    leftHtml: secondaryIconHtml(lockIconSvg),
    title: 'Security Settings',
    subtitle: 'View your security settings',
    rightHtml: chevronRightHtml(),
    showBadge: showSecurityBadge,
    id: 'hc-as-security',
  });
  html += '</div>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  var backBtn = document.getElementById('hc-as-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate('/profile');
    });
  }
  var profileDetailsBtn = document.getElementById('hc-as-profile-details');
  if (profileDetailsBtn) {
    profileDetailsBtn.addEventListener('click', function () {
      navigate('/profile-details');
    });
  }
  var notifBtn = document.getElementById('hc-as-notifications');
  if (notifBtn) {
    notifBtn.addEventListener('click', function () {
      navigate('/notification-settings');
    });
  }
  var securityBtn = document.getElementById('hc-as-security');
  if (securityBtn) {
    securityBtn.addEventListener('click', function () {
      navigate('/security-settings');
    });
  }
}
