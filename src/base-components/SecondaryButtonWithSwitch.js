import { escapeHtml, joinClasses } from './html.js';

export default function SecondaryButtonWithSwitch(props) {
  props = props || {};
  var title = escapeHtml(props.title || '');
  var subtitle = props.subtitle ? escapeHtml(props.subtitle) : '';
  var leftHtml = props.leftHtml || '';
  var checked = !!props.value;
  var disabled = !!props.disabled;
  var switchId =
    props.switchId ||
    'hc-sw-' +
    Math.random().toString(36).slice(2, 10);
  var idAttr = props.id ? ' id="' + escapeHtml(props.id) + '"' : '';
  var extra = props.className ? ' ' + props.className : '';
  var disabledAttr = disabled ? ' disabled' : '';

  var subtitleBlock = subtitle
    ? '<span class="hc-bc-secondary-btn-subtitle">' + subtitle + '</span>'
    : '';

  var checkedAttr = checked ? ' checked' : '';

  return (
    '<div class="' +
    joinClasses('hc-bc-secondary-switch', extra) +
    '"' +
    idAttr +
    '>' +
    '<div class="hc-bc-secondary-switch-left">' +
    (leftHtml ? '<span class="hc-bc-secondary-switch-icon">' + leftHtml + '</span>' : '') +
    '<div class="hc-bc-secondary-switch-text">' +
    '<span class="hc-bc-secondary-btn-title">' +
    title +
    '</span>' +
    subtitleBlock +
    '</div>' +
    '</div>' +
    '<label class="hc-bc-switch">' +
    '<input type="checkbox" class="hc-bc-switch-input" role="switch" id="' +
    escapeHtml(switchId) +
    '"' +
    checkedAttr +
    disabledAttr +
    ' />' +
    '<span class="hc-bc-switch-track" aria-hidden="true"></span>' +
    '</label>' +
    '</div>'
  );
}
