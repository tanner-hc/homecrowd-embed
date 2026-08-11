import * as api from '../api.js';
import { navigate } from '../router.js';
import { escapeAttr, escapeHtml } from '../base-components/html.js';
import { showPointsEarnedToast } from '../base-components/PointsEarnedToast.js';
import {
  claimSetupTaskReward,
  fetchSetupRewardPoints,
  getSetupRewardPoints,
} from '../setup-rewards.js';
import { getPendingSignupSchool } from './find-your-school.js';
import hcIconUrl from '../assets/logos/icon.png';

function schoolNameFromUser(user) {
  if (!user || typeof user !== 'object') return '';
  var active = user.active_school || user.activeSchool;
  if (active && active.name) return String(active.name);
  if (user.active_school_name) return String(user.active_school_name);
  return '';
}

function buildSubtitle(points, schoolName) {
  if (points && schoolName) {
    return 'Your first ' + points + ' pts for ' + schoolName + ' are in.';
  }
  if (points) {
    return 'Your first ' + points + ' pts are in.';
  }
  if (schoolName) {
    return "You're ready to start earning for " + schoolName + '.';
  }
  return "You're ready to start earning points.";
}

/**
 * @param {HTMLElement} container
 * @param {{ user?: object, onContinue?: function }} options
 */
export function renderAccountCreated(container, options) {
  options = options || {};
  var user = options.user || null;
  var pendingSchool = getPendingSignupSchool() || {};
  var schoolName = schoolNameFromUser(user) || pendingSchool.name || '';
  var toastApi = null;
  var cancelled = false;

  container.innerHTML =
    '<div class="hc-account-created">' +
    '<div class="hc-account-created-banner-wrap" id="hc-account-created-banner">' +
    '<div class="hc-account-created-banner-placeholder" aria-hidden="true"></div>' +
    '</div>' +
    '<div class="hc-account-created-content">' +
    '<img data-hc-ph="none" src="' +
    escapeAttr(hcIconUrl) +
    '" alt="Homecrowd" class="hc-account-created-logo" />' +
    '<h1 class="hc-account-created-title">Account created!</h1>' +
    '<p class="hc-account-created-subtitle" id="hc-account-created-subtitle">' +
    escapeHtml(buildSubtitle(null, schoolName)) +
    '</p>' +
    '</div>' +
    '<div class="hc-account-created-actions">' +
    '<button type="button" id="hc-account-created-continue" class="hc-account-created-btn">Continue</button>' +
    '</div>' +
    '</div>';

  var bannerWrap = container.querySelector('#hc-account-created-banner');
  var subtitleEl = container.querySelector('#hc-account-created-subtitle');
  var continueBtn = container.querySelector('#hc-account-created-continue');

  function setSubtitle(points, name) {
    if (subtitleEl) {
      subtitleEl.textContent = buildSubtitle(points, name);
    }
  }

  function showBanner(points) {
    if (!bannerWrap || !points) return;
    bannerWrap.innerHTML = '';
    toastApi = showPointsEarnedToast(bannerWrap, {
      points: points,
      duration: 10000,
      onHide: function () {
        if (cancelled) return;
        bannerWrap.innerHTML =
          '<div class="hc-account-created-banner-placeholder" aria-hidden="true"></div>';
        toastApi = null;
      },
    });
  }

  if (continueBtn) {
    continueBtn.addEventListener('click', function () {
      if (typeof options.onContinue === 'function') {
        options.onContinue();
        return;
      }
      navigate('/');
    });
  }

  Promise.resolve()
    .then(function () {
      if (user && user.id) return user;
      return api.fetchCurrentUser();
    })
    .then(function (currentUser) {
      if (cancelled) return null;
      var nextName = schoolNameFromUser(currentUser) || schoolName;
      if (nextName) schoolName = nextName;
      setSubtitle(null, schoolName);

      return claimSetupTaskReward('profile')
        .then(function (result) {
          var awarded = 0;
          if (result && result.awarded && result.points > 0) {
            awarded = Number(result.points) || 0;
          } else if (result && result.rewards && result.rewards.profile != null) {
            awarded = Number(result.rewards.profile) || 0;
          }
          return awarded;
        })
        .catch(function () {
          return 0;
        })
        .then(function (awarded) {
          if (cancelled) return;
          if (!awarded) {
            return fetchSetupRewardPoints().then(function () {
              return Number(getSetupRewardPoints().profile) || 0;
            });
          }
          return awarded;
        })
        .then(function (awarded) {
          if (cancelled || !awarded) {
            setSubtitle(null, schoolName);
            return;
          }
          setSubtitle(awarded, schoolName);
          showBanner(awarded);
        });
    })
    .catch(function () { });

  return function cleanup() {
    cancelled = true;
    if (toastApi && typeof toastApi.destroy === 'function') toastApi.destroy();
  };
}
