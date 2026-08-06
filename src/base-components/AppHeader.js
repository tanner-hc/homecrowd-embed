import { navigate } from '../router.js';
import { escapeAttr, escapeHtml } from './html.js';
import * as api from '../api.js';
import personSvg from '../assets/icons/person.svg?raw';
import starSvg from '../assets/icons/star.svg?raw';
import chevronLeftSvg from '../assets/icons/chevron-left.svg?raw';

function resolvePoints(summary, user) {
  if (summary) {
    if (summary.available_points != null) return Number(summary.available_points) || 0;
    if (summary.availablePoints != null) return Number(summary.availablePoints) || 0;
  }
  if (!user) return 0;
  if (user.current_points != null) return Number(user.current_points) || 0;
  if (user.available_points != null) return Number(user.available_points) || 0;
  if (user.availablePoints != null) return Number(user.availablePoints) || 0;
  return 0;
}

function pickAvatar(user) {
  if (!user) return '';
  return (
    user.avatar_url ||
    user.avatarUrl ||
    user.profile_image ||
    user.profileImage ||
    ''
  );
}

function setPointsLabel(pointsLabel, points) {
  if (!pointsLabel) return;
  pointsLabel.textContent = String(Number(points) || 0) + ' pts';
}

function setProfileAvatar(profileBtn, avatarUri) {
  if (!profileBtn) return;
  if (avatarUri) {
    profileBtn.innerHTML =
      '<img src="' + escapeAttr(String(avatarUri)) + '" alt="" class="hc-app-header-avatar" />';
  } else if (!profileBtn.querySelector('img') && !profileBtn.querySelector('svg')) {
    profileBtn.innerHTML = personSvg;
  }
}

/**
 * @param {{
 *   user?: object,
 *   points?: number,
 *   avatarUri?: string,
 *   showBack?: boolean,
 * }} props
 */
export function buildAppHeaderHtml(props) {
  props = props || {};
  var points = Number(props.points);
  if (!Number.isFinite(points)) {
    points = resolvePoints(null, props.user);
  }
  var avatarUri = props.avatarUri != null ? props.avatarUri : pickAvatar(props.user);
  var leftInner = props.showBack
    ? chevronLeftSvg
    : avatarUri
      ? '<img src="' + escapeAttr(String(avatarUri)) + '" alt="" class="hc-app-header-avatar" />'
      : personSvg;
  var leftLabel = props.showBack ? 'Back' : 'Profile';

  return (
    '<div class="hc-app-header">' +
    '<button type="button" class="hc-app-header-circle" data-hc-app-header-left aria-label="' +
    escapeAttr(leftLabel) +
    '">' +
    leftInner +
    '</button>' +
    '<button type="button" class="hc-app-header-points" data-hc-app-header-points aria-label="Points">' +
    starSvg +
    '<span class="hc-app-header-points-text">' +
    escapeHtml(String(points)) +
    ' pts</span>' +
    '</button>' +
    '</div>'
  );
}

/**
 * Mount handlers + refresh points (same flow as mobile AppHeader).
 * @param {HTMLElement} container
 * @param {{
 *   user?: object,
 *   showBack?: boolean,
 *   onBackPress?: function,
 *   onProfilePress?: function,
 *   onPointsPress?: function,
 *   avatarUri?: string,
 * }} options
 * @returns {function} cleanup
 */
export function mountAppHeader(container, options) {
  options = options || {};
  var headerRoot = container && container.querySelector
    ? container.querySelector('.hc-app-header')
    : null;
  if (!headerRoot) {
    return function cleanup() {};
  }

  var profileBtn = headerRoot.querySelector('[data-hc-app-header-left]');
  var pointsBtn = headerRoot.querySelector('[data-hc-app-header-points]');
  var pointsLabel = headerRoot.querySelector('.hc-app-header-points-text');
  var cancelled = false;
  var seededUser = options.user || null;

  setPointsLabel(pointsLabel, resolvePoints(null, seededUser));
  if (!options.showBack) {
    setProfileAvatar(
      profileBtn,
      options.avatarUri != null ? options.avatarUri : pickAvatar(seededUser)
    );
  }

  if (profileBtn) {
    profileBtn.addEventListener('click', function () {
      if (options.showBack) {
        if (typeof options.onBackPress === 'function') {
          options.onBackPress();
          return;
        }
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        navigate('/home');
        return;
      }
      if (typeof options.onProfilePress === 'function') {
        options.onProfilePress();
        return;
      }
      navigate('/profile');
    });
  }

  if (pointsBtn) {
    pointsBtn.addEventListener('click', function () {
      if (typeof options.onPointsPress === 'function') {
        options.onPointsPress();
        return;
      }
      navigate('/activity-log');
    });
  }

  api
    .fetchCurrentUser()
    .catch(function () {
      return seededUser;
    })
    .then(function (freshUser) {
      if (cancelled) return null;
      var user = freshUser || seededUser;
      if (!options.showBack) {
        setProfileAvatar(
          profileBtn,
          options.avatarUri != null ? options.avatarUri : pickAvatar(user)
        );
      }
      setPointsLabel(pointsLabel, resolvePoints(null, user));
      var userId = user && user.id;
      if (!userId) return null;
      return api.getUserPointsSummary(userId).then(
        function (summary) {
          if (cancelled) return;
          setPointsLabel(pointsLabel, resolvePoints(summary, user));
        },
        function () {}
      );
    });

  return function cleanup() {
    cancelled = true;
  };
}

/**
 * Ensure header exists in container, then mount (reuse from home / offers / all-shops).
 * @param {HTMLElement} container
 * @param {object} [options]
 * @returns {function} cleanup
 */
export function attachAppHeader(container, options) {
  options = options || {};
  if (!container) return function cleanup() {};
  if (!container.querySelector('.hc-app-header')) {
    var wrap = document.createElement('div');
    wrap.innerHTML = buildAppHeaderHtml(options);
    var node = wrap.firstChild;
    if (node) {
      container.insertBefore(node, container.firstChild);
    }
  }
  return mountAppHeader(container, options);
}

export default {
  buildAppHeaderHtml,
  mountAppHeader,
  attachAppHeader,
};
