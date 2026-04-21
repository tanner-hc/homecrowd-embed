import { escapeHtml, joinClasses } from './html.js';

export default function Input(props) {
  props = props || {};
  var value = props.value != null ? String(props.value) : '';
  var placeholder = props.placeholder != null ? props.placeholder : '';
  var error = props.error;
  var disabled = !!props.disabled;
  var label = props.label != null ? props.label : '';
  var id = props.id || 'hc-inp-' + Math.random().toString(36).slice(2, 9);
  var name = props.name != null ? String(props.name) : '';
  var type = props.type || 'text';
  var rightHtml = props.rightHtml || '';
  var autoComplete = props.autocomplete != null ? props.autocomplete : props.autoComplete;
  var extra = props.className ? ' ' + props.className : '';
  var hasError = !!error;
  var errId = id + '-err';

  var labelBlock = label
    ? '<label class="hc-label' +
      (hasError ? ' hc-bc-input-label--error' : '') +
      '" for="' +
      escapeHtml(id) +
      '">' +
      escapeHtml(label) +
      '</label>'
    : '';

  var errText = hasError
    ? typeof error === 'string'
      ? error
      : 'Error'
    : '';
  var errBlock = hasError
    ? '<p class="hc-bc-input-error" id="' +
      escapeHtml(errId) +
      '">' +
      escapeHtml(errText) +
      '</p>'
    : '';

  var inputClass = joinClasses(
    'hc-input hc-bc-input',
    hasError ? 'hc-bc-input--error' : '',
    props.className || '',
  );
  var describedBy = hasError ? ' aria-describedby="' + escapeHtml(errId) + '"' : '';
  var invalidAttr = hasError ? ' aria-invalid="true"' : '';
  var disabledAttr = disabled ? ' disabled' : '';
  var nameAttr = name ? ' name="' + escapeHtml(name) + '"' : '';
  var acAttr = autoComplete != null ? ' autocomplete="' + escapeHtml(String(autoComplete)) + '"' : '';
  var valueAttr = ' value="' + escapeHtml(value) + '"';
  var ph = ' placeholder="' + escapeHtml(placeholder) + '"';

  var rightBlock = rightHtml
    ? '<div class="hc-bc-input-right-icon">' + rightHtml + '</div>'
    : '';

  return (
    '<div class="hc-form-group hc-bc-input-group">' +
    labelBlock +
    '<div class="hc-bc-input-wrap' +
    (rightHtml ? ' hc-bc-input-wrap--icon' : '') +
    '">' +
    '<input class="' +
    inputClass +
    '" id="' +
    escapeHtml(id) +
    '" type="' +
    escapeHtml(type) +
    '"' +
    nameAttr +
    valueAttr +
    ph +
    acAttr +
    describedBy +
    invalidAttr +
    disabledAttr +
    ' />' +
    rightBlock +
    '</div>' +
    errBlock +
    '</div>'
  );
}
