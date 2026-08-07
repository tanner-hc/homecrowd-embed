import { escapeAttr, escapeHtml } from '../../base-components/html.js';

// Path data lifted verbatim from the exported Figma assets. Fills are swapped to
// currentColor so the reached/unreached states recolor from CSS instead of
// needing two copies of each asset.
var STAR_PATH =
  'M7.99974 11.4346L5.4905 12.9892C5.37965 13.0618 5.26377 13.0929 5.14284 13.0825' +
  'C5.02191 13.0721 4.9161 13.0307 4.8254 12.9581C4.73471 12.8856 4.66417 12.795 4.61378 12.6864' +
  'C4.5634 12.5778 4.55332 12.4559 4.58355 12.3207L5.24865 9.38255L3.02661 7.40821' +
  'C2.92584 7.31494 2.86296 7.2086 2.83797 7.08921C2.81297 6.96981 2.82043 6.85332 2.86034 6.73973' +
  'C2.90024 6.62614 2.96071 6.53287 3.04173 6.45991C3.12275 6.38694 3.2336 6.3403 3.37428 6.31999' +
  'L6.30676 6.05571L7.44045 3.28852C7.49084 3.16415 7.56904 3.07088 7.67505 3.00869' +
  'C7.78107 2.94651 7.8893 2.91542 7.99974 2.91542C8.11019 2.91542 8.21842 2.94651 8.32443 3.00869' +
  'C8.43044 3.07088 8.50864 3.16415 8.55903 3.28852L9.69272 6.05571L12.6252 6.31999' +
  'C12.7663 6.34072 12.8771 6.38736 12.9578 6.45991C13.0384 6.53245 13.0988 6.62573 13.1391 6.73973' +
  'C13.1795 6.85374 13.1871 6.97044 13.1621 7.08983C13.1371 7.20922 13.074 7.31535 12.9729 7.40821' +
  'L10.7508 9.38255L11.4159 12.3207C11.4462 12.4555 11.4361 12.5774 11.3857 12.6864' +
  'C11.3353 12.7954 11.2648 12.886 11.1741 12.9581C11.0834 13.0303 10.9776 13.0717 10.8566 13.0825' +
  'C10.7357 13.0933 10.6198 13.0622 10.509 12.9892L7.99974 11.4346Z';

var STAR_ICON =
  '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
  '<path d="' +
  STAR_PATH +
  '" fill="currentColor"/></svg>';

function formatPts(value) {
  return (Number(value) || 0).toLocaleString('en-US') + ' pts';
}

function formatNumber(value) {
  return (Number(value) || 0).toLocaleString('en-US');
}

function normalizeMilestone(raw) {
  if (!raw) return null;
  var cost = Number(raw.pointsCost != null ? raw.pointsCost : raw.points_cost) || 0;
  if (cost <= 0) return null;
  return {
    id: raw.id != null ? String(raw.id) : '',
    title: raw.title || 'Reward',
    description: raw.description || '',
    whatsIncluded: raw.whatsIncluded || raw.whats_included || '',
    location: raw.location || '',
    pointsCost: cost,
    images: Array.isArray(raw.images) ? raw.images.filter(Boolean) : [],
    imageUrl: raw.imageUrl || raw.image_url || '',
    // Not used by the card — the redemption screen uses it as its backdrop.
    confirmationImageUrl: raw.confirmationImageUrl || raw.confirmation_image_url || '',
    unlocked: !!raw.unlocked,
    redeemed: !!raw.redeemed,
  };
}

/**
 * Accepts the /rewards/first-rewards/ payload and returns the ladder sorted by
 * cost, dropping anything unusable. Exported so the view can decide whether the
 * section has enough to render before building markup.
 *
 * @param {{ milestones?: object[] }|object[]|null} payload
 * @returns {object[]}
 */
export function normalizeMilestones(payload) {
  var raw = [];
  if (Array.isArray(payload)) {
    raw = payload;
  } else if (payload && Array.isArray(payload.milestones)) {
    raw = payload.milestones;
  }
  return raw
    .map(normalizeMilestone)
    .filter(Boolean)
    .sort(function (a, b) {
      return a.pointsCost - b.pointsCost;
    });
}

function buildThumbHtml(milestone) {
  // Artwork never depends on the points balance — seeing what you're working
  // toward is the point of the ladder, and only Redeem is gated. A rung with no
  // thumbnail borrows its confirmation image rather than showing a placeholder
  // that reads as locked.
  var art =
    (milestone.images && milestone.images[0]) ||
    milestone.imageUrl ||
    milestone.confirmationImageUrl;
  if (art) {
    return (
      '<div class="hc-milestones-thumb">' +
      '<img src="' +
      escapeAttr(art) +
      '" alt="" class="hc-milestones-thumb-img" />' +
      '</div>'
    );
  }
  return '<div class="hc-milestones-thumb"></div>';
}

function buildRowHtml(milestone, earned, isNext) {
  // The next rung shows progress toward its cost; every other rung just states
  // what it costs.
  var pointsLine = isNext
    ? formatNumber(earned) + ' / ' + formatPts(milestone.pointsCost)
    : formatPts(milestone.pointsCost);

  // The row is the tap target and the Redeem pill nests inside it, so the row
  // uses role/tabindex rather than a <button> — nested buttons are invalid.
  return (
    '<li class="hc-milestones-row' +
    (milestone.unlocked ? ' hc-milestones-row--unlocked' : '') +
    '" data-milestone-id="' +
    escapeAttr(milestone.id) +
    '" data-milestone-open="1" role="button" tabindex="0">' +
    buildThumbHtml(milestone) +
    '<div class="hc-milestones-row-copy">' +
    '<div class="hc-milestones-row-text">' +
    (isNext ? '<span class="hc-milestones-eyebrow">Next reward</span>' : '') +
    '<span class="hc-milestones-row-title">' +
    escapeHtml(milestone.title) +
    '</span>' +
    '<span class="hc-milestones-row-points">' +
    escapeHtml(pointsLine) +
    '</span>' +
    '</div>' +
    // Redeemed rungs keep the pill as a status marker rather than an action.
    '<button type="button" class="hc-milestones-redeem' +
    (milestone.redeemed ? ' hc-milestones-redeem--done' : '') +
    '" data-milestone-redeem="1"' +
    (milestone.unlocked && !milestone.redeemed ? '' : ' disabled') +
    '>' +
    (milestone.redeemed ? 'Redeemed' : 'Redeem') +
    '</button>' +
    '</div>' +
    '</li>'
  );
}

/**
 * Rungs sit proportionally along the track: a marker's left edge lands at
 * `cost/max` of the track's usable width. The marker layer is inset by half a
 * marker at each end so the last one tucks flush inside the track rather than
 * overhanging it, which is how the design places it.
 */
function progressPercent(milestones, earned) {
  var max = milestones[milestones.length - 1].pointsCost;
  if (max <= 0) return 0;
  return Math.min(Math.max((earned / max) * 100, 0), 100);
}

function buildProgressHtml(milestones, earned) {
  var max = milestones[milestones.length - 1].pointsCost;
  var pct = progressPercent(milestones, earned);

  var markers = '';
  var scale = '';
  for (var i = 0; i < milestones.length; i++) {
    var m = milestones[i];
    var at = max > 0 ? Math.min((m.pointsCost / max) * 100, 100) : 0;
    markers +=
      '<span class="hc-milestones-marker' +
      (m.unlocked ? ' hc-milestones-marker--reached' : '') +
      '" style="left:' +
      at +
      '%">' +
      STAR_ICON +
      '</span>';
    scale +=
      '<span class="hc-milestones-scale-label' +
      (i === milestones.length - 1 ? ' hc-milestones-scale-label--last' : '') +
      '" style="left:' +
      at +
      '%">' +
      escapeHtml(formatNumber(m.pointsCost)) +
      '</span>';
  }

  return (
    '<div class="hc-milestones-progress">' +
    '<div class="hc-milestones-track">' +
    '<div class="hc-milestones-fill" style="width:' +
    pct +
    '%"></div>' +
    '<div class="hc-milestones-markers">' +
    markers +
    '</div>' +
    '</div>' +
    '<div class="hc-milestones-scale">' +
    scale +
    '</div>' +
    '</div>'
  );
}

/**
 * @param {{
 *   points?: number,
 *   milestones?: object[],
 *   logoUrl?: string,
 *   loading?: boolean,
 * }} props
 */
export function buildPointsMilestonesCardHtml(props) {
  props = props || {};
  var displayPoints = Number.isFinite(Number(props.points))
    ? Math.round(Number(props.points))
    : 0;
  var milestones = Array.isArray(props.milestones) ? props.milestones : [];

  var header =
    '<div class="hc-milestones-head">' +
    '<div class="hc-milestones-head-text">' +
    '<div class="hc-milestones-label">You’ve earned</div>' +
    '<div class="hc-milestones-points-row">' +
    '<span class="hc-milestones-value">' +
    escapeHtml(displayPoints.toLocaleString('en-US')) +
    '</span>' +
    '<span class="hc-milestones-unit">pts</span>' +
    '</div>' +
    '</div>' +
    (props.logoUrl
      ? '<img src="' +
        escapeAttr(String(props.logoUrl)) +
        '" alt="" class="hc-milestones-logo" />'
      : '') +
    '</div>';

  if (props.loading) {
    return (
      '<div class="hc-milestones" id="hc-milestones">' +
      header +
      '<div class="hc-milestones-loader" aria-hidden="true"></div>' +
      '</div>'
    );
  }

  // No ladder configured for this school — keep the points readout, drop the rest.
  if (!milestones.length) {
    return '<div class="hc-milestones" id="hc-milestones">' + header + '</div>';
  }

  var nextIndex = milestones.findIndex(function (m) {
    return !m.unlocked;
  });

  var rows = '';
  for (var i = 0; i < milestones.length; i++) {
    rows += buildRowHtml(milestones[i], displayPoints, i === nextIndex);
  }

  return (
    '<div class="hc-milestones" id="hc-milestones">' +
    '<div class="hc-milestones-top">' +
    header +
    buildProgressHtml(milestones, displayPoints) +
    '<div class="hc-milestones-caption">Each goal you reach unlocks the next reward.</div>' +
    '</div>' +
    '<ul class="hc-milestones-rows">' +
    rows +
    '</ul>' +
    '</div>'
  );
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   onPressMilestone?: function(string),
 *   onRedeem?: function(string),
 * }} options
 */
export function bindPointsMilestonesCard(root, options) {
  options = options || {};
  if (!root) return;

  function handle(e, fromKeyboard) {
    var target = e.target;
    if (!target || !target.closest) return;

    var row = target.closest('[data-milestone-id]');
    if (!row) return;
    var id = row.getAttribute('data-milestone-id');
    if (!id) return;

    var redeem = target.closest('[data-milestone-redeem]');
    if (redeem && !fromKeyboard) {
      if (redeem.disabled) return;
      e.preventDefault();
      if (typeof options.onRedeem === 'function') options.onRedeem(id);
      return;
    }

    e.preventDefault();
    if (typeof options.onPressMilestone === 'function') options.onPressMilestone(id);
  }

  root.addEventListener('click', function (e) {
    handle(e, false);
  });

  root.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target || !e.target.closest || !e.target.closest('[data-milestone-open]')) return;
    // Let the Redeem pill handle its own keyboard activation as a real button.
    if (e.target.closest('[data-milestone-redeem]')) return;
    handle(e, true);
  });
}

export default {
  buildPointsMilestonesCardHtml,
  bindPointsMilestonesCard,
  normalizeMilestones,
};
