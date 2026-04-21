import { escapeHtml, joinClasses } from './html.js';

export default function SecondaryButton(props) {
  props = props || {};
  var title = escapeHtml(props.title || '');
  var subtitle = props.subtitle ? escapeHtml(props.subtitle) : '';
  var leftHtml = props.leftHtml || '';
  var rightHtml = props.rightHtml || '';
  var showBadge = !!props.showBadge;
  var disabled = !!props.disabled;
  var idAttr = props.id ? ' id="' + escapeHtml(props.id) + '"' : '';
  var extra = props.className ? ' ' + props.className : '';
  var disabledAttr = disabled ? ' disabled' : '';

  var badgeHtml = showBadge
    ? '<span class="hc-bc-secondary-btn-badge" aria-hidden="true">!</span>'
    : '';

  var leftBlock =
    leftHtml !== ''
      ? '<span class="hc-bc-secondary-btn-icon-wrap">' + leftHtml + badgeHtml + '</span>'
      : badgeHtml !== ''
        ? '<span class="hc-bc-secondary-btn-icon-wrap">' + badgeHtml + '</span>'
        : '';

  var subtitleBlock = subtitle
    ? '<span class="hc-bc-secondary-btn-subtitle">' + subtitle + '</span>'
    : '';

  return (
    '<button type="button" class="' +
    joinClasses('hc-bc-secondary-btn', extra) +
    '"' +
    idAttr +
    disabledAttr +
    '>' +
    '<span class="hc-bc-secondary-btn-inner">' +
    leftBlock +
    '<span class="hc-bc-secondary-btn-text">' +
    '<span class="hc-bc-secondary-btn-title">' +
    title +
    '</span>' +
    subtitleBlock +
    '</span>' +
    '</span>' +
    (rightHtml ? '<span class="hc-bc-secondary-btn-right">' + rightHtml + '</span>' : '') +
    '</button>'
  );
}
