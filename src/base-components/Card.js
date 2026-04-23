import { joinClasses } from './html.js';

export default function Card(props) {
  props = props || {};
  var padding = props.padding != null ? props.padding : 20;
  var inner = props.childrenHtml != null ? props.childrenHtml : props.html || '';
  var extra = props.className ? ' ' + props.className : '';

  return (
    '<div class="' +
    joinClasses('hc-card hc-bc-card', extra) +
    '" style="padding:' +
    padding +
    'px">' +
    inner +
    '</div>'
  );
}
