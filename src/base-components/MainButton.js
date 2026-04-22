import { escapeHtml, joinClasses } from './html.js';

export default function MainButton(props) {
  props = props || {};
  var loading = !!props.loading;
  var disabled = !!props.disabled || loading;
  var outlined = !!props.outlined;
  var large = props.large !== false;
  var plain = !!props.plain;
  var text = loading ? props.loadingText || 'Loading...' : props.text || '';
  var idAttr = props.id ? ' id="' + escapeHtml(props.id) + '"' : '';
  var extra = props.className ? props.className : '';

  var variantPrimary = outlined ? 'hc-btn-secondary' : 'hc-btn-primary';

  var bcSkin =
    !plain &&
    (!extra ||
      (extra.indexOf('hc-split-half') === -1 && extra.indexOf('hc-rewards-link-card-btn') === -1));

  var classes = joinClasses(
    'hc-btn',
    large ? 'hc-btn-large' : '',
    variantPrimary,
    bcSkin
      ? outlined
        ? 'hc-bc-main-btn hc-bc-main-btn--outlined'
        : 'hc-bc-main-btn hc-bc-main-btn--filled'
      : '',
    extra,
  );

  var disabledAttr = disabled ? ' disabled' : '';

  var inner =
    props.html != null && !loading ? props.html : escapeHtml(text);

  if (loading) {
    var label = escapeHtml(text);
    return (
      '<button type="button" class="' +
      classes +
      '"' +
      idAttr +
      disabledAttr +
      '><span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>' +
      label +
      '</span></button>'
    );
  }

  return (
    '<button type="button" class="' +
    classes +
    '"' +
    idAttr +
    disabledAttr +
    '>' +
    inner +
    '</button>'
  );
}
