import { escapeHtml, joinClasses } from './html.js';

export default function LoadingSpinner(props) {
  props = props || {};
  var text = escapeHtml(props.text || 'Loading...');
  var extra = props.className ? ' ' + props.className : '';

  return (
    '<div class="' +
    joinClasses('hc-bc-loading-spinner', extra) +
    '">' +
    '<div class="hc-spinner hc-bc-loading-spinner-wheel" aria-busy="true"></div>' +
    '<p class="hc-bc-loading-spinner-text">' +
    text +
    '</p>' +
    '</div>'
  );
}
