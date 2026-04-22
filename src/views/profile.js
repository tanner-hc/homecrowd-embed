import * as api from '../api.js';
import { postToNative } from '../bridge.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import ScreenTitle from '../base-components/ScreenTitle.js';
import SecondaryButton from '../base-components/SecondaryButton.js';
import MainButton from '../base-components/MainButton.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import iconTransparentUrl from '../assets/icon-transparent.png';
import settingsIconSvg from '../assets/icons/settings.svg?raw';
import cardIconSvg from '../assets/icons/card.svg?raw';
import phoneIconSvg from '../assets/icons/phone.svg?raw';
import activityIconSvg from '../assets/icons/activity.svg?raw';
import extensionIconSvg from '../assets/icons/extension.svg?raw';
import referralIconSvg from '../assets/icons/referral.svg?raw';
import chevronRightIconSvg from '../assets/icons/chevron-right.svg?raw';

function svgAddClass(svgRaw, className) {
  return String(svgRaw).replace(/^<svg\s/i, '<svg class="' + className + '" ');
}

function formatFanId(fanId) {
  if (fanId == null) return 'N/A';
  var s = String(fanId).trim();
  return s !== '' ? s : 'N/A';
}

function pickFanId(user) {
  if (!user || typeof user !== 'object') return '';
  var v = user.fanId != null ? user.fanId : user.fan_id;
  if (v == null) return '';
  var s = String(v).trim();
  return s;
}

function pickDateJoined(user) {
  if (!user || typeof user !== 'object') return null;
  return (
    user.dateJoined ||
    user.date_joined ||
    user.createdAt ||
    user.created_at ||
    null
  );
}

function formatMemberSince(dateString) {
  if (!dateString) return null;
  try {
    var joinDate = new Date(dateString);
    if (!isNaN(joinDate.getTime())) {
      return joinDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  } catch (_e) { }
  return null;
}

function isReferralCampaignActive(campaign, isEarlyRelease) {
  if (isEarlyRelease) return true;
  if (!campaign) return false;
  var raw = campaign.incentive_value;
  if (raw === null || raw === undefined) return true;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw > 0 : true;
  var parsed = parseInt(String(raw), 10);
  return Number.isFinite(parsed) ? parsed > 0 : true;
}

function pickActiveSchool(u) {
  if (!u || typeof u !== 'object') return null;
  return u.activeSchool || u.active_school || null;
}

function schoolEarlyRelease(school) {
  if (!school || typeof school !== 'object') return false;
  if (school.earlyRelease === true) return true;
  if (school.early_release === true) return true;
  return false;
}

function profileCardHtml(user) {
  var first = (user && (user.firstName || user.first_name)) || '';
  var last = (user && (user.lastName || user.last_name)) || '';
  var name = (first + ' ' + last).trim() || 'Member';
  var fanId = pickFanId(user);
  var memberSince = formatMemberSince(pickDateJoined(user));
  var memberBlock = '';
  if (memberSince) {
    memberBlock =
      '<div class="hc-profile-card-member">' +
      '<span class="hc-profile-card-stat-label">MEMBER SINCE</span>' +
      '<span class="hc-profile-card-stat-value">' +
      escapeHtml(memberSince) +
      '</span>' +
      '</div>';
  }
  return (
    '<div class="hc-profile-card">' +
    '<div class="hc-profile-card-inner">' +
    '<div class="hc-profile-card-tagline">Shop Smarter, Cheer Louder</div>' +
    '<div class="hc-profile-card-body">' +
    '<div class="hc-profile-card-user">' +
    '<div class="hc-profile-card-name">' +
    escapeHtml(name) +
    '</div>' +
    '<div class="hc-profile-card-stat">' +
    '<span class="hc-profile-card-stat-label">FAN ID</span>' +
    '<span class="hc-profile-card-stat-value hc-profile-card-stat-value--bold">' +
    escapeHtml(formatFanId(fanId)) +
    '</span>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="hc-profile-card-logo-wrap">' +
    '<img src="' +
    escapeAttr(iconTransparentUrl) +
    '" alt="" class="hc-profile-card-logo" />' +
    '</div>' +
    memberBlock +
    '</div>' +
    '</div>'
  );
}

function secondaryIconHtml(svgRaw) {
  return svgAddClass(svgRaw, 'hc-profile-secondary-icon');
}

function chevronRightHtml() {
  return svgAddClass(chevronRightIconSvg, 'hc-profile-chevron-icon');
}

export function renderProfile(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading profile...' });
  loadProfile(container);
}

async function loadProfile(container) {
  var embedUser;
  var profileUser = null;
  var referralCampaign = null;
  try {
    embedUser = await api.fetchCurrentUser();
  } catch (err) {
    container.innerHTML =
      '<div class="hc-alert-error">' + escapeHtml(err.message || 'Failed to load profile') + '</div>';
    return;
  }
  try {
    profileUser = await api.getUserProfile();
  } catch (_e) {
    profileUser = null;
  }
  try {
    var referralResponse = await api.getReferralCampaign();
    referralCampaign = referralResponse && referralResponse.campaign ? referralResponse.campaign : null;
  } catch (_e) {
    referralCampaign = null;
  }

  var cardUser = profileUser || embedUser;
  var prefsUser = profileUser || embedUser;
  var school = pickActiveSchool(prefsUser);
  var isEarlyRelease = schoolEarlyRelease(school);
  var showInvite = isReferralCampaignActive(referralCampaign, isEarlyRelease);
  var showActivity = !isEarlyRelease;
  var emailUnverified = !!(
    prefsUser &&
    (prefsUser.emailVerified === false || prefsUser.email_verified === false)
  );

  var html = '';
  html += '<div id="hc-profile-root" class="hc-profile-view">';
  html += '<div class="hc-screen-title hc-profile-title-wrap">';
  html += ScreenTitle({ title: 'Profile' });
  html += '</div>';
  html += profileCardHtml(cardUser);
  html += '<div class="hc-profile-scroll">';
  html += '<div class="hc-profile-menu">';

  html += SecondaryButton({
    leftHtml: secondaryIconHtml(settingsIconSvg),
    title: 'Account settings',
    subtitle: 'Manage your account details',
    rightHtml: chevronRightHtml(),
    showBadge: emailUnverified,
    id: 'hc-profile-account-settings',
  });

  if (showInvite) {
    html += SecondaryButton({
      leftHtml: secondaryIconHtml(referralIconSvg),
      title: 'Invite a Friend',
      subtitle: isEarlyRelease
        ? 'Invite friends to join Homecrowd'
        : 'Send an invite to a friend and earn points',
      rightHtml: chevronRightHtml(),
      id: 'hc-profile-invite',
    });
  }

  if (showActivity) {
    html += SecondaryButton({
      leftHtml: secondaryIconHtml(activityIconSvg),
      title: 'Activity log',
      subtitle: 'See your points earning history',
      rightHtml: chevronRightHtml(),
      id: 'hc-profile-activity',
    });
  }

  html += SecondaryButton({
    leftHtml: secondaryIconHtml(cardIconSvg),
    title: 'Linked cards',
    subtitle: 'View and manage payment methods',
    rightHtml: chevronRightHtml(),
    id: 'hc-profile-linked-cards',
  });

  html += SecondaryButton({
    leftHtml: secondaryIconHtml(extensionIconSvg),
    title: 'Browser Extension',
    subtitle: 'Download the Safari extension',
    rightHtml: chevronRightHtml(),
    id: 'hc-profile-extension',
  });

  html += SecondaryButton({
    leftHtml: secondaryIconHtml(phoneIconSvg),
    title: 'Support',
    subtitle: 'Get help or give feedback',
    rightHtml: chevronRightHtml(),
    id: 'hc-profile-support',
  });

  html += '</div>';
  html += '<div class="hc-profile-logout-section">';
  html += MainButton({
    id: 'hc-profile-logout',
    text: 'Log Out',
    loadingText: 'Logging out...',
    className: 'hc-profile-logout-btn',
  });
  html += '</div>';
  html += '<div class="hc-profile-version-section">';
  html += '<span class="hc-profile-version-text">Homecrowd v1.1.0</span>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  var accountBtn = container.querySelector('#hc-profile-account-settings');
  if (accountBtn) {
    accountBtn.addEventListener('click', function () {
      navigate('/account-settings');
    });
  }
  var inviteBtn = container.querySelector('#hc-profile-invite');
  if (inviteBtn) {
    inviteBtn.addEventListener('click', function () {
      navigate('/invite-friend');
    });
  }
  var activityBtn = container.querySelector('#hc-profile-activity');
  if (activityBtn) {
    activityBtn.addEventListener('click', function () {
      postToNative('homecrowd:profile-action', { screen: 'ActivityLog' });
    });
  }
  var cardsBtn = container.querySelector('#hc-profile-linked-cards');
  if (cardsBtn) {
    cardsBtn.addEventListener('click', function () {
      navigate('/cards');
    });
  }
  var extBtn = container.querySelector('#hc-profile-extension');
  if (extBtn) {
    extBtn.addEventListener('click', function () {
      postToNative('homecrowd:profile-action', { screen: 'ExtensionDownload' });
    });
  }
  var supportBtn = container.querySelector('#hc-profile-support');
  if (supportBtn) {
    supportBtn.addEventListener('click', function () {
      postToNative('homecrowd:profile-action', { screen: 'ContactSupport' });
    });
  }

  var logoutBtn = container.querySelector('#hc-profile-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      logoutBtn.disabled = true;
      var prevHtml = logoutBtn.innerHTML;
      logoutBtn.innerHTML =
        '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>Logging out...</span>';
      try {
        handleLogout();
      } finally {
        logoutBtn.disabled = false;
        logoutBtn.innerHTML = prevHtml;
      }
    });
  }
}

function handleLogout() {
  window.dispatchEvent(new CustomEvent('homecrowd:embed-logout'));
}
