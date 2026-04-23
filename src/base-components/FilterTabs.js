import { escapeHtml, joinClasses } from './html.js';

export default function FilterTabs(props) {
  props = props || {};
  var categories = Array.isArray(props.categories) ? props.categories : [];
  var selectedFilter = props.selectedFilter;
  var label = props.label != null ? props.label : 'Filter by:';
  var showLabel = props.showLabel !== false;
  var extra = props.className ? ' ' + props.className : '';

  var labelBlock = showLabel
    ? '<span class="hc-bc-filter-tabs-label">' + escapeHtml(label) + '</span>'
    : '';

  var tabs = categories
    .map(function (category) {
      var cat = String(category);
      var active = selectedFilter === category;
      return (
        '<button type="button" class="' +
        joinClasses('hc-bc-filter-tab', active ? 'hc-bc-filter-tab--active' : '') +
        '" data-filter="' +
        escapeHtml(cat) +
        '">' +
        escapeHtml(cat) +
        '</button>'
      );
    })
    .join('');

  return (
    '<div class="' +
    joinClasses('hc-bc-filter-tabs', extra) +
    '">' +
    labelBlock +
    '<div class="hc-bc-filter-tabs-scroll">' +
    tabs +
    '</div>' +
    '</div>'
  );
}

export function bindFilterTabs(root, onFilterChange) {
  if (!root || typeof onFilterChange !== 'function') {
    return function () {};
  }
  function handler(ev) {
    var t = ev.target;
    if (!t || !t.closest) {
      return;
    }
    var btn = t.closest('[data-filter]');
    if (!btn || !root.contains(btn)) {
      return;
    }
    var v = btn.getAttribute('data-filter');
    if (v != null) {
      onFilterChange(v);
    }
  }
  root.addEventListener('click', handler);
  return function unbind() {
    root.removeEventListener('click', handler);
  };
}
