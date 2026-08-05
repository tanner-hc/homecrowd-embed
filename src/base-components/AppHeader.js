import { navigate } from '../router.js';
import { escapeAttr, escapeHtml } from './html.js';
import * as api from '../api.js';
import personSvg from '../assets/icons/person.svg?raw';
import starSvg from '../assets/icons/star.svg?raw';

function resolvePoints(summary, user) {
  if (summary) {
    if (summary.available_points != null) return Number(summary.available_points) || 0;
    if (summary.availablePoints != null) return Number(summary.availablePoints) || 0;
  }
  if (!user) return 0;
  if (user.current_points != null) return Number(user.current_points) || 0;
  if (user.available_points != null) return Number(user.available_points) || 0;
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

/**
 * @param {{ user?: object, points?: number, avatarUri?: string, onProfilePress?: function, onPointsPress?: function }} props
 */
export function buildAppHeaderHtml(props) {
  props = props || {};
  var points = Number(props.points);
  if (!Number.isFinite(points)) {
    points = resolvePoints(null, props.user);
  }
  var avatarUri = props.avatarUri != null ? props.avatarUri : pickAvatar(props.user);
  var leftInner = avatarUri
    ? '<img src="' + escapeAttr(String(avatarUri)) + '" alt="" class="hc-app-header-avatar" />'
    : personSvg;

  return (
    '<div class="hc-app-header">' +
    '<button type="button" class="hc-app-header-circle" id="hc-app-header-profile" aria-label="Profile">' +
    leftInner +
    '</button>' +
    '<button type="button" class="hc-app-header-points" id="hc-app-header-points" aria-label="Points">' +
    starSvg +
    '<span class="hc-app-header-points-text">' +
    escapeHtml(String(points)) +
    ' pts</span>' +
    '</button>' +
    '</div>'
  );
}

/**
 * @param {HTMLElement} container
 * @param {{ user?: object, onProfilePress?: function, onPointsPress?: function }} options
 */
export function mountAppHeader(container, options) {
  options = options || {};
  var user = options.user || null;
  var profileBtn = container.querySelector('#hc-app-header-profile');
  var pointsBtn = container.querySelector('#hc-app-header-points');
  var pointsLabel = container.querySelector('.hc-app-header-points-text');
  var cancelled = false;

  if (profileBtn) {
    profileBtn.addEventListener('click', function () {
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

  if (user && user.id && pointsLabel) {
    api
      .getUserPointsSummary(user.id)
      .then(function (summary) {
        if (cancelled || !pointsLabel) return;
        var next = resolvePoints(summary, user);
        pointsLabel.textContent = String(next) + ' pts';
      })
      .catch(function () { });
  }

  return function cleanup() {
    cancelled = true;
  };
}

export default { buildAppHeaderHtml, mountAppHeader };
