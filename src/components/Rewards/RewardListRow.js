import { escapeAttr, escapeHtml } from '../../base-components/html.js';
import { formatDisplayNumber } from '../../formatNumber.js';

/**
 * One catalogue reward in the rewards-screen list: square artwork on the left,
 * title and cost stacked beside it, and a Redeem chip pinned to the right.
 *
 * The row itself carries data-reward-id, which the rewards view's delegated
 * click handler already listens for — so the whole row navigates to the reward
 * detail without any binding of its own.
 *
 * @param {{
 *   id?: string,
 *   title?: string,
 *   pointsCost?: number,
 *   imageUrl?: string,
 *   redemptionType?: string,
 *   redeemable?: boolean, when the user can afford it the chip reads as an action
 * }} props
 */
export function buildRewardListRowHtml(props) {
  props = props || {};

  // Mirrors the mobile RewardCard's type badge, which sits under the price.
  var type = String(props.redemptionType || '').toLowerCase();
  var badge = '';
  if (type === 'raffle' || type === 'auction') {
    badge =
      '<span class="hc-reward-type-badge hc-reward-type-badge--' +
      type +
      '">' +
      (type === 'raffle' ? 'RAFFLE' : 'AUCTION') +
      '</span>';
  }

  var thumb = props.imageUrl
    ? '<img data-hc-ph="gift" class="hc-reward-row-img" src="' +
      escapeAttr(String(props.imageUrl)) +
      '" alt="" />'
    : '<span class="hc-reward-row-img hc-reward-row-img--ph hc-img-ph hc-img-ph--gift"></span>';

  return (
    '<button type="button" class="hc-reward-row" data-reward-id="' +
    escapeAttr(String(props.id || '')) +
    '">' +
    thumb +
    '<span class="hc-reward-row-body">' +
    '<span class="hc-reward-row-text">' +
    '<span class="hc-reward-row-title">' +
    escapeHtml(String(props.title || '')) +
    '</span>' +
    '<span class="hc-reward-row-points">' +
    escapeHtml(formatDisplayNumber(props.pointsCost) + ' points') +
    '</span>' +
    badge +
    '</span>' +
    '<span class="hc-reward-row-action' +
    (props.redeemable ? ' hc-reward-row-action--ready' : '') +
    '">Redeem</span>' +
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
    '<div class="hc-reward-rows">' + rows.map(buildRewardListRowHtml).join('') + '</div>'
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
