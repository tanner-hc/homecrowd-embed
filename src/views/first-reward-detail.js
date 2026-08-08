import * as api from '../api.js';
import { navigate } from '../router.js';
import { escapeAttr, escapeHtml } from '../base-components/html.js';
import { formatNumber } from '../formatNumber.js';
import { normalizeMilestones } from '../components/Dashboard/PointsMilestonesCard.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import personSvg from '../assets/icons/person.svg?raw';
import chevronLeftSvg from '../assets/icons/chevron-left.svg?raw';
import giftSvg from '../assets/icon-gift-outline.svg?raw';
import locationSvg from '../assets/icon-location.svg?raw';
import unlockSvg from '../assets/icon-unlock.svg?raw';

function buildHeaderHtml(availablePoints) {
  return (
    '<div class="hc-fr-detail-header">' +
    '<button type="button" class="hc-app-header-circle" data-fr-back aria-label="Back">' +
    chevronLeftSvg +
    '</button>' +
    '<div class="hc-fr-detail-header-right">' +
    '<button type="button" class="hc-app-header-circle" data-fr-profile aria-label="Profile">' +
    personSvg +
    '</button>' +
    '<span class="hc-fr-detail-points">' +
    escapeHtml(formatNumber(availablePoints)) +
    ' pts</span>' +
    '</div>' +
    '</div>'
  );
}

/**
 * Peeking carousel. The rung's thumbnail and confirmation image are the only
 * artwork we hold, so this is one or two slides rather than the design's three.
 */
function buildCarouselHtml(milestone) {
  // The configured gallery when there is one; otherwise fall back to the legacy
  // single image so rungs predating the gallery still show artwork.
  var urls = (milestone.images || []).slice();
  if (!urls.length && milestone.imageUrl) urls.push(milestone.imageUrl);
  if (!urls.length && milestone.confirmationImageUrl) {
    urls.push(milestone.confirmationImageUrl);
  }

  var slides = urls.length
    ? urls
        .map(function (url) {
          return (
            '<div class="hc-fr-detail-slide">' +
            '<img class="hc-fr-detail-img" src="' +
            escapeAttr(url) +
            '" alt="" /></div>'
          );
        })
        .join('')
    : '<div class="hc-fr-detail-slide"><div class="hc-fr-detail-img hc-fr-detail-img--ph"></div></div>';

  var dots = '';
  if (urls.length > 1) {
    dots = '<div class="hc-fr-detail-dots">';
    for (var i = 0; i < urls.length; i++) {
      dots += '<span class="hc-fr-detail-dot' + (i === 0 ? ' is-active' : '') + '"></span>';
    }
    dots += '</div>';
  }

  // The cost pill lives inside the stage, not the media wrapper, so it sits a
  // fixed distance above the image edge whether or not dots are rendered.
  return (
    '<div class="hc-fr-detail-media">' +
    '<div class="hc-fr-detail-stage">' +
    '<div class="hc-fr-detail-track">' +
    slides +
    '</div>' +
    '<div class="hc-fr-detail-cost">' +
    '<span class="hc-fr-detail-cost-value">' +
    escapeHtml(formatNumber(milestone.pointsCost)) +
    '</span>' +
    '<span class="hc-fr-detail-cost-unit">pts</span>' +
    '</div>' +
    '</div>' +
    dots +
    '</div>'
  );
}

function buildInfoRowHtml(icon, title, body) {
  return (
    '<div class="hc-fr-detail-info-row">' +
    '<span class="hc-fr-detail-info-icon">' +
    icon +
    '</span>' +
    '<div class="hc-fr-detail-info-text">' +
    '<span class="hc-fr-detail-info-title">' +
    escapeHtml(title) +
    '</span>' +
    '<span class="hc-fr-detail-info-body">' +
    escapeHtml(body) +
    '</span>' +
    '</div>' +
    '</div>'
  );
}

function buildInfoHtml(milestone) {
  var rows = '';
  if (milestone.whatsIncluded) {
    rows += buildInfoRowHtml(giftSvg, "What's Included", milestone.whatsIncluded);
  }
  if (milestone.location) {
    rows += buildInfoRowHtml(locationSvg, 'Location', milestone.location);
  }

  // Always present: it explains the ladder, and reads differently once claimed.
  var unlockCopy = milestone.redeemed
    ? "You've redeemed this reward. Check the contact details you gave us for instructions."
    : milestone.unlocked
      ? "You've earned enough points. Tap Redeem on the home screen to claim it and tell us how to reach you."
      : 'Earn ' +
        formatNumber(milestone.pointsCost) +
        " points to unlock this experience. Once unlocked, you'll receive instructions for confirming your attendance.";
  rows += buildInfoRowHtml(unlockSvg, 'How to Unlock', unlockCopy);

  return '<div class="hc-fr-detail-info">' + rows + '</div>';
}

/**
 * Three states, matching the ladder pill: locked (not enough points), claimable,
 * and already redeemed. Only the claimable one is a live action.
 */
function buildRedeemHtml(milestone) {
  var label = milestone.redeemed
    ? 'Redeemed'
    : milestone.unlocked
      ? 'Redeem'
      : 'Locked — ' + formatNumber(milestone.pointsCost) + ' pts';
  var modifier = milestone.redeemed
    ? ' hc-fr-detail-redeem--done'
    : milestone.unlocked
      ? ''
      : ' hc-fr-detail-redeem--locked';
  var claimable = milestone.unlocked && !milestone.redeemed;

  return (
    '<div class="hc-fr-detail-actions">' +
    '<button type="button" class="hc-fr-detail-redeem' +
    modifier +
    '" data-fr-redeem="1"' +
    (claimable ? '' : ' disabled') +
    '>' +
    escapeHtml(label) +
    '</button>' +
    '</div>'
  );
}

function buildHtml(milestone, availablePoints) {
  return (
    '<div class="hc-fr-detail">' +
    buildHeaderHtml(availablePoints) +
    buildCarouselHtml(milestone) +
    '<div class="hc-fr-detail-body">' +
    '<span class="hc-fr-detail-badge">Reward</span>' +
    '<h1 class="hc-fr-detail-title">' +
    escapeHtml(milestone.title || 'Reward') +
    '</h1>' +
    (milestone.description
      ? '<p class="hc-fr-detail-desc">' + escapeHtml(milestone.description) + '</p>'
      : '') +
    buildInfoHtml(milestone) +
    '</div>' +
    buildRedeemHtml(milestone) +
    '</div>'
  );
}

function buildUnavailableHtml(message, availablePoints) {
  return (
    '<div class="hc-fr-detail">' +
    buildHeaderHtml(availablePoints) +
    '<div class="hc-fr-detail-body">' +
    '<p class="hc-fr-detail-desc">' +
    escapeHtml(message) +
    '</p>' +
    '</div>' +
    '</div>'
  );
}

/**
 * Detail screen for one first-reward rung, reached by tapping a ladder row
 * anywhere other than its Redeem button. Read-only — claiming happens on the
 * unlock screen.
 *
 * @param {HTMLElement} container
 * @param {string} rewardId
 * @param {{ returnTo?: string }} [options]
 */
export async function renderFirstRewardDetail(container, rewardId, options) {
  options = options || {};
  var returnTo = options.returnTo || '/home';
  container.innerHTML = LoadingSpinner({ text: 'Loading reward...' });

  var milestone = null;
  var availablePoints = 0;
  try {
    // One rung, not the whole ladder — the endpoint returns the balance too.
    var payload = await api.getFirstReward(rewardId);
    milestone = normalizeMilestones([payload.milestone])[0] || null;
    availablePoints = Number(payload.availablePoints) || 0;
  } catch (_e) {
    container.innerHTML = buildUnavailableHtml(
      "We couldn't load this reward. Please try again.",
      0
    );
    bindDetail(container, returnTo);
    return;
  }

  if (!milestone) {
    container.innerHTML = buildUnavailableHtml(
      'This reward is no longer available.',
      availablePoints
    );
  } else {
    container.innerHTML = buildHtml(milestone, availablePoints);
  }
  bindDetail(container, returnTo, milestone);
}

function bindDetail(container, returnTo, milestone) {
  var back = container.querySelector('[data-fr-back]');
  if (back) {
    back.addEventListener('click', function () {
      navigate(returnTo);
    });
  }

  var profile = container.querySelector('[data-fr-profile]');
  if (profile) {
    profile.addEventListener('click', function () {
      navigate('/profile');
    });
  }

  var redeem = container.querySelector('[data-fr-redeem]');
  if (redeem && milestone) {
    redeem.addEventListener('click', function () {
      if (redeem.disabled) return;
      // Carry the origin through so the unlock screen still knows where to
      // return after claiming.
      navigate(
        '/first-rewards/' +
          encodeURIComponent(milestone.id) +
          '/redeem?from=' +
          (returnTo === '/rewards' ? 'rewards' : 'home')
      );
    });
  }

  // Keep the dots in step with a swipe.
  var track = container.querySelector('.hc-fr-detail-track');
  var dots = container.querySelectorAll('.hc-fr-detail-dot');
  if (track && dots.length > 1) {
    track.addEventListener('scroll', function () {
      var index = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === index);
      });
    });
  }
}

export default { renderFirstRewardDetail };
