import { escapeHtml, joinClasses } from './html.js';

export default function Button(props) {
  props = props || {};
  var title = props.title != null ? props.title : '';
  var variant = props.variant || 'primary';
  var disabled = !!props.disabled;
  var tag = props.href ? 'a' : 'button';
  var variantClass =
    variant === 'secondary'
      ? 'hc-btn-secondary'
      : variant === 'danger'
        ? 'hc-btn-danger'
        : 'hc-btn-primary';

  var extra = props.className ? props.className : '';
  var idAttr = props.id ? ' id="' + escapeHtml(props.id) + '"' : '';
  var typeAttr =
    tag === 'button'
      ? ' type="' + escapeHtml(props.type || 'button') + '"'
      : '';
  var disabledAttr = disabled && tag === 'button' ? ' disabled' : '';

  var inner = escapeHtml(title);

  if (tag === 'a') {
    return (
      '<a href="' +
      escapeHtml(props.href || '#') +
      '" class="' +
      joinClasses('hc-btn', variantClass, extra) +
      '"' +
      idAttr +
      '>' +
      inner +
      '</a>'
    );
  }

  return (
    '<button class="' +
    joinClasses('hc-btn', variantClass, extra) +
    '"' +
    idAttr +
    typeAttr +
    disabledAttr +
    '>' +
    inner +
    '</button>'
  );
}
