import FilterButton from './FilterButton.js';
import { escapeHtml, joinClasses } from './html.js';

export default function FilterList(props) {
  props = props || {};
  var title = props.title != null ? props.title : 'Filter by:';
  var categories = Array.isArray(props.categories) ? props.categories : [];
  var selectedFilter = props.selectedFilter;
  var extra = props.className ? ' ' + props.className : '';

  var titleBlock =
    title !== '' && title !== false
      ? '<div class="hc-bc-filter-list-title">' + escapeHtml(title) + '</div>'
      : '';

  var buttons = categories
    .map(function (category) {
      return FilterButton({
        text: String(category),
        selected: selectedFilter === category,
      });
    })
    .join('');

  return (
    '<div class="' +
    joinClasses('hc-bc-filter-list', extra) +
    '">' +
    titleBlock +
    '<div class="hc-bc-filter-tabs-scroll">' +
    buttons +
    '</div>' +
    '</div>'
  );
}
