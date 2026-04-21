import { escapeHtml, joinClasses } from './html.js';

export default function SearchBar(props) {
  props = props || {};
  var value = props.value != null ? String(props.value) : '';
  var placeholder = props.placeholder != null ? props.placeholder : 'Search';
  var id = props.id || 'hc-search-' + Math.random().toString(36).slice(2, 9);
  var disabled = !!props.disabled;
  var extra = props.className ? ' ' + props.className : '';
  var err = !!props.error;

  var wrapClass = joinClasses(
    'hc-bc-search-bar',
    err ? 'hc-bc-search-bar--error' : '',
    disabled ? 'hc-bc-search-bar--disabled' : '',
    extra,
  );

  var disabledAttr = disabled ? ' disabled' : '';

  return (
    '<div class="' +
    wrapClass +
    '">' +
    '<span class="hc-bc-search-bar-icon" aria-hidden="true">⌕</span>' +
    '<input type="search" class="hc-bc-search-bar-input" id="' +
    escapeHtml(id) +
    '" value="' +
    escapeHtml(value) +
    '" placeholder="' +
    escapeHtml(placeholder) +
    '"' +
    disabledAttr +
    ' />' +
    '</div>'
  );
}
