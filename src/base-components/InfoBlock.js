import { escapeHtml, joinClasses } from './html.js';

export default function InfoBlock(props) {
  props = props || {};
  var inner =
    props.childrenHtml != null ? props.childrenHtml : escapeHtml(props.children || '');
  var extra = props.className ? ' ' + props.className : '';

  return (
    '<div class="' +
    joinClasses('hc-bc-info-block', extra) +
    '">' +
    '<div class="hc-bc-info-block-text">' +
    inner +
    '</div>' +
    '</div>'
  );
}
