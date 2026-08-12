import { escapeAttr, escapeHtml } from '../../base-components/html.js';
import { formatDisplayNumber } from '../../formatNumber.js';
import ticketSvg from '../../assets/icons/ticket-fill.svg?raw';

/**
 * One catalogue reward as a tile. Figma 1423:9735 — Gray 1 card with a dashed
 * Gray 2 outline at an 18px radius, a 112px cover, a Medium 16 title, and a
 * pill that is either the blue entry action or a muted "Opens ..." state.
 *
 * The tile carries data-reward-id, which the rewards view's delegated click
 * handler already listens for — so it navigates to the detail page without any
 * binding of its own.
 *
 * @param {{
 *   id?: string,
 *   title?: string,
 *   pointsCost?: number,
 *   imageUrl?: string,
 *   redemptionType?: string,
 *   redeemable?: boolean, when the user can act the pill reads as an action
 *   opensLabel?: string, e.g. "Opens Sep 15" — shown instead when not yet open
 * }} props
 */
export function buildRewardListRowHtml(props) {
  props = props || {};

  var type = String(props.redemptionType || '').toLowerCase();
  var isRaffle = type === 'raffle';

  var thumb = props.imageUrl
    ? '<img data-hc-ph="gift" class="hc-reward-tile-img" src="' +
      escapeAttr(String(props.imageUrl)) +
      '" alt="" />'
    : '<span class="hc-reward-tile-img hc-reward-tile-img--ph hc-img-ph hc-img-ph--gift"></span>';

  // A reward that has not opened yet says so; otherwise a raffle invites an
  // entry at its cost and everything else offers a redeem.
  var actionLabel;
  var actionIcon = '';
  if (props.opensLabel) {
    actionLabel = String(props.opensLabel);
  } else if (isRaffle) {
    actionLabel = 'Enter for ' + formatDisplayNumber(props.pointsCost) + ' pts';
    actionIcon = '<span class="hc-reward-tile-action-icon" aria-hidden="true">' + ticketSvg + '</span>';
  } else {
    actionLabel = 'Redeem for ' + formatDisplayNumber(props.pointsCost) + ' pts';
  }

  var ready = !props.opensLabel && !!props.redeemable;

  return (
    '<button type="button" class="hc-reward-tile" data-reward-id="' +
    escapeAttr(String(props.id || '')) +
    '">' +
    thumb +
    '<span class="hc-reward-tile-body">' +
    '<span class="hc-reward-tile-title">' +
    escapeHtml(String(props.title || '')) +
    '</span>' +
    '<span class="hc-reward-tile-action' +
    (ready ? ' hc-reward-tile-action--ready' : '') +
    '">' +
    actionIcon +
    '<span class="hc-reward-tile-action-text">' +
    escapeHtml(actionLabel) +
    '</span>' +
    '</span>' +
    '</span>' +
    '</button>'
  );
}

/**
 * @param {Array<object>} rows props for buildRewardListRowHtml, in display order
 */
export function buildRewardListHtml(rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  return (
    '<div class="hc-reward-tiles">' + rows.map(buildRewardListRowHtml).join('') + '</div>'
  );
}

/**
 * Rewards under a heading for the day they open, matching the mobile rewards
 * screen's sectioned list.
 *
 * @param {Array<{ title?: string, rows: Array<object> }>} sections
 */
export function buildRewardSectionsHtml(sections) {
  if (!Array.isArray(sections)) return '';
  return sections
    .filter(function (section) {
      return section && Array.isArray(section.rows) && section.rows.length;
    })
    .map(function (section) {
      var heading = section.title
        ? '<div class="hc-reward-section-title">' +
          escapeHtml(String(section.title)) +
          '</div>'
        : '';
      return (
        '<div class="hc-reward-section">' +
        heading +
        buildRewardListHtml(section.rows) +
        '</div>'
      );
    })
    .join('');
}

export default { buildRewardListRowHtml, buildRewardListHtml, buildRewardSectionsHtml };
