import { escapeHtml } from './html.js';

export default function Header(props) {
  props = props || {};
  var src = props.src || props.logoSrc;
  var alt = escapeHtml(props.alt || 'Homecrowd');
  var extra = props.className ? ' ' + escapeHtml(props.className) : '';

  if (!src) {
    return '<div class="hc-bc-header' + extra + '"></div>';
  }

  return (
    '<div class="hc-bc-header' +
    extra +
    '">' +
    '<div class="hc-bc-header-inner">' +
    '<img src="' +
    escapeHtml(src) +
    '" alt="' +
    alt +
    '" class="hc-bc-header-logo" />' +
    '</div>' +
    '</div>'
  );
}
