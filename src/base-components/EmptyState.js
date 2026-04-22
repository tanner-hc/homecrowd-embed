import { escapeHtml, joinClasses } from './html.js';

export default function EmptyState(props) {
  props = props || {};
  var title = escapeHtml(props.title || 'No items found');
  var subtitle = props.subtitle ? escapeHtml(props.subtitle) : '';
  var iconChar = props.iconChar || '📄';
  var extra = props.className ? ' ' + props.className : '';

  var subBlock = subtitle
    ? '<p class="hc-empty-text hc-bc-empty-subtitle">' + subtitle + '</p>'
    : '';

  return (
    '<div class="' +
    joinClasses('hc-empty hc-bc-empty-state', extra) +
    '">' +
    '<div class="hc-empty-icon" aria-hidden="true">' +
    escapeHtml(iconChar) +
    '</div>' +
    '<h2 class="hc-empty-title">' +
    title +
    '</h2>' +
    subBlock +
    '</div>'
  );
}
