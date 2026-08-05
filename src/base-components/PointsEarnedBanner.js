import { escapeAttr, escapeHtml } from './html.js';

/**
 * @param {{
 *   points?: number,
 *   schoolAmount?: number,
 *   schoolName?: string,
 *   logoUrl?: string,
 *   backgroundColor?: string,
 *   clickable?: boolean,
 * }} props
 */
export function buildPointsEarnedBannerHtml(props) {
  props = props || {};
  var displayPoints = Number.isFinite(Number(props.points))
    ? Math.round(Number(props.points))
    : 0;
  var bg = props.backgroundColor || '#001C44';
  var showSchool =
    typeof props.schoolAmount === 'number' &&
    props.schoolAmount > 0 &&
    Boolean(props.schoolName);
  var tag = props.clickable ? 'button' : 'div';
  var typeAttr = props.clickable ? ' type="button"' : '';
  var clickClass = props.clickable ? ' hc-points-banner--clickable' : '';

  return (
    '<' +
    tag +
    typeAttr +
    ' class="hc-points-banner' +
    clickClass +
    '" id="hc-points-banner"' +
    (props.clickable ? ' data-action="open-tiers-modal"' : '') +
    ' style="background:' +
    escapeAttr(bg) +
    '">' +
    '<div class="hc-points-banner-text">' +
    '<div class="hc-points-banner-label">You\'ve earned</div>' +
    '<div class="hc-points-banner-points-row">' +
    '<span class="hc-points-banner-value">' +
    escapeHtml(displayPoints.toLocaleString('en-US')) +
    '</span>' +
    '<span class="hc-points-banner-unit"> pts</span>' +
    '</div>' +
    (showSchool
      ? '<div class="hc-points-banner-school">$' +
        props.schoolAmount.toFixed(2) +
        ' for ' +
        escapeHtml(String(props.schoolName)) +
        '</div>'
      : '') +
    '</div>' +
    (props.logoUrl
      ? '<img src="' +
        escapeAttr(String(props.logoUrl)) +
        '" alt="" class="hc-points-banner-logo" />'
      : '') +
    '</' +
    tag +
    '>'
  );
}

export default { buildPointsEarnedBannerHtml };
