import * as api from '../api.js';
import { navigate } from '../router.js';
import SettingsRow from '../base-components/SettingsRow.js';
import PageHeader from '../base-components/PageHeader.js';
import { isSuperuser } from './superuser.js';
// Exported from the settings design (node 1690:7756) so the row icons are the
// designer's, not near-matches from the shared icon set.
import personIconSvg from '../assets/icons/settings/profile.svg?raw';
import bellIconSvg from '../assets/icons/settings/bell.svg?raw';
import lockIconSvg from '../assets/icons/settings/lock.svg?raw';
import activityIconSvg from '../assets/icons/settings/activity.svg?raw';
import cardIconSvg from '../assets/icons/settings/card.svg?raw';
import phoneIconSvg from '../assets/icons/settings/phone.svg?raw';
// Rows the design does not show keep the embed's existing icons.
import referralIconSvg from '../assets/icons/referral.svg?raw';
import extensionIconSvg from '../assets/icons/extension.svg?raw';

function svgAddClass(svgRaw, className) {
  return String(svgRaw).replace(/^<svg\s/i, '<svg class="' + className + '" ');
}

function pickActiveSchool(u) {
  if (!u || typeof u !== 'object') return null;
  return u.activeSchool || u.active_school || null;
}

function schoolEarlyRelease(school) {
  if (!school || typeof school !== 'object') return false;
  return school.earlyRelease === true || school.early_release === true;
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

export function renderSettings(container) {
  container.innerHTML = '<div class="hc-settings-view"></div>';
  load(container.querySelector('.hc-settings-view'));
}

async function load(root) {
  var user = null;
  var referralCampaign = null;
  try {
    user = await api.getUserProfile();
  } catch (_e) {
    try {
      user = await api.fetchCurrentUser();
    } catch (_e2) {
      user = null;
    }
  }
  try {
    var res = await api.getReferralCampaign();
    referralCampaign = res && res.campaign ? res.campaign : null;
  } catch (_e) {
    referralCampaign = null;
  }

  var school = pickActiveSchool(user);
  var isEarlyRelease = schoolEarlyRelease(school);
  var showInvite = isReferralCampaignActive(referralCampaign, isEarlyRelease);
  var showActivity = !isEarlyRelease;
  var emailUnverified = !!(
    user &&
    (user.emailVerified === false || user.email_verified === false)
  );

  var rows = '';
  // Order follows the design (node 1690:7756): Profile, Notifications,
  // Security, Activity log, Linked cards, Support. The items the embed already
  // had and the design does not show are interleaved around those.
  rows += SettingsRow({
    id: 'hc-settings-profile',
    icon: personIconSvg,
    label: 'Profile',
    badge: emailUnverified,
  });
  rows += SettingsRow({ id: 'hc-settings-notifications', icon: bellIconSvg, label: 'Notifications' });
  rows += SettingsRow({ id: 'hc-settings-security', icon: lockIconSvg, label: 'Security' });
  if (showActivity) {
    rows += SettingsRow({ id: 'hc-settings-activity', icon: activityIconSvg, label: 'Activity log' });
  }
  rows += SettingsRow({ id: 'hc-settings-cards', icon: cardIconSvg, label: 'Linked cards' });
  rows += SettingsRow({
    id: 'hc-settings-extension',
    icon: extensionIconSvg,
    label: 'Browser extension',
  });
  rows += SettingsRow({ id: 'hc-settings-support', icon: phoneIconSvg, label: 'Support' });
  if (showInvite) {
    rows += SettingsRow({ id: 'hc-settings-invite', icon: referralIconSvg, label: 'Invite a friend' });
  }
  // Last row, and only for superusers. Cosmetic only — the routes behind it are
  // guarded on their own.
  if (isSuperuser(user)) {
    rows += SettingsRow({ id: 'hc-settings-superuser', icon: personIconSvg, label: 'Superuser' });
  }

  root.innerHTML =
    PageHeader({ title: 'Settings', backButtonId: 'hc-settings-back' }) +
    '<div class="hc-settings-list">' +
    rows +
    '</div>' +
    '<button type="button" class="hc-settings-logout" id="hc-settings-logout">Log Out</button>';

  var go = function (id, path) {
    var el = root.querySelector('#' + id);
    if (el) {
      el.addEventListener('click', function () {
        navigate(path);
      });
    }
  };

  go('hc-settings-profile', '/profile-details');
  go('hc-settings-notifications', '/notification-settings');
  go('hc-settings-security', '/security-settings');
  go('hc-settings-activity', '/activity-log');
  go('hc-settings-cards', '/cards');
  go('hc-settings-support', '/support');
  go('hc-settings-superuser', '/superuser');
  go('hc-settings-invite', '/invite-friend');
  go('hc-settings-extension', '/browser-extension');

  var back = root.querySelector('#hc-settings-back');
  if (back) {
    back.addEventListener('click', function () {
      navigate('/profile');
    });
  }

  var logout = root.querySelector('#hc-settings-logout');
  if (logout) {
    logout.addEventListener('click', function () {
      logout.disabled = true;
      var prevHtml = logout.innerHTML;
      logout.innerHTML =
        '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>Logging out...</span>';
      try {
        window.dispatchEvent(new CustomEvent('homecrowd:embed-logout'));
      } finally {
        logout.disabled = false;
        logout.innerHTML = prevHtml;
      }
    });
  }
}
