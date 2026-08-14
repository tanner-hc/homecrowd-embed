import { escapeHtml, joinClasses } from './html.js';
import searchSvg from '../assets/icons/search.svg?raw';

function withCurrentColorStroke(svg) {
  return String(svg || '')
    .replace(/stroke="black"/gi, 'stroke="currentColor"')
    .replace(/stroke='#000(?:000)?'/gi, 'stroke="currentColor"');
}

/**
 * @param {{
 *   value?: string, placeholder?: string, id?: string, disabled?: boolean,
 *   error?: boolean, className?: string, variant?: 'default' | 'pill',
 * }} [props]
 *
 * `pill` is the grey capsule from Figma 1000:10548 — 48px tall, no border, 24px
 * icon. The default remains the bordered white field.
 */
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
    props.variant === 'pill' ? 'hc-bc-search-bar--pill' : '',
    err ? 'hc-bc-search-bar--error' : '',
    disabled ? 'hc-bc-search-bar--disabled' : '',
    extra,
  );

  var disabledAttr = disabled ? ' disabled' : '';

  return (
    '<div class="' +
    wrapClass +
    '">' +
    '<span class="hc-bc-search-bar-icon" aria-hidden="true">' +
    withCurrentColorStroke(searchSvg) +
    '</span>' +
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
