import { escapeHtml, joinClasses } from './html.js';

export default function NavHeader(props) {
  props = props || {};
  var title = escapeHtml(props.title || '');
  var idAttr = props.backButtonId ? ' id="' + escapeHtml(props.backButtonId) + '"' : '';
  var extra = props.className ? ' ' + props.className : '';

  return (
    '<div class="' +
    joinClasses('hc-bc-nav-header', extra) +
    '">' +
    '<button type="button" class="hc-bc-nav-header-back"' +
    idAttr +
    ' aria-label="Back">' +
    '<span class="hc-bc-nav-header-chevron" aria-hidden="true">‹</span>' +
    '<span class="hc-bc-nav-header-title">' +
    title +
    '</span>' +
    '</button>' +
    '</div>'
  );
}
