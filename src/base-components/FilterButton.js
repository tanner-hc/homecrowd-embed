import { escapeHtml, joinClasses } from './html.js';

export default function FilterButton(props) {
  props = props || {};
  var text = escapeHtml(props.text || '');
  var selected = !!props.selected;
  var idAttr = props.id ? ' id="' + escapeHtml(props.id) + '"' : '';
  var extra = props.className ? ' ' + props.className : '';

  return (
    '<button type="button" class="' +
    joinClasses(
      'hc-bc-filter-btn',
      selected ? 'hc-bc-filter-btn--selected' : '',
      extra,
    ) +
    '"' +
    idAttr +
    '>' +
    text +
    '</button>'
  );
}
