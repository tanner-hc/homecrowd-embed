import { navigate } from '../router.js';
import { escapeAttr, escapeHtml } from './html.js';
import headerUrl from '../assets/header.png';
import chevronLeftSvg from '../assets/icons/chevron-left.svg?raw';
import showPassSvg from '../assets/icons/show_pass.svg?raw';
import hidePassSvg from '../assets/icons/hide_pass.svg?raw';

var BASE_INPUT_FONT = 52;
var MIN_INPUT_FONT = 18;
var EYE_RESERVED = 40;
var CHAR_WIDTH_RATIO = 0.72;

function getInputFontSize(text, availableWidth) {
  var width = availableWidth > 0 ? availableWidth : window.innerWidth - 16;
  var len = Math.max(String(text || '').length - 3, 1);
  var fitted = width / (len * CHAR_WIDTH_RATIO);
  return Math.min(BASE_INPUT_FONT, Math.max(MIN_INPUT_FONT, fitted));
}

/**
 * Shared signup field screen (mobile SignupFieldLayout 1:1).
 * @param {HTMLElement} container
 * @param {object} options
 * @returns {function} cleanup
 */
export function mountSignupFieldLayout(container, options) {
  options = options || {};
  var backTo = options.backTo || '/create-account';
  var secureTextEntry = !!options.secureTextEntry;
  var showPasswordToggle = !!options.showPasswordToggle;
  var autoCapitalize = options.autoCapitalize != null ? options.autoCapitalize : 'words';
  var autoComplete = options.autoComplete || 'name';
  var inputType = secureTextEntry ? 'password' : 'text';
  var passwordVisible = false;
  var value = options.value != null ? String(options.value) : '';

  container.innerHTML =
    '<div class="hc-signup-field">' +
    '<div class="hc-signup-field-nav">' +
    '<button type="button" class="hc-signup-field-back" id="hc-signup-field-back" aria-label="Back">' +
    chevronLeftSvg +
    '</button>' +
    '<img data-hc-ph="none" src="' +
    escapeAttr(headerUrl) +
    '" alt="Homecrowd" class="hc-signup-field-logo" />' +
    '<span class="hc-signup-field-nav-spacer" aria-hidden="true"></span>' +
    '</div>' +
    '<div class="hc-signup-field-header">' +
    '<h1 class="hc-signup-field-title">' +
    escapeHtml(options.title || '') +
    '</h1>' +
    '<p class="hc-signup-field-subtitle">' +
    escapeHtml(options.subtitle || '') +
    '</p>' +
    '</div>' +
    '<div class="hc-signup-field-wrap" id="hc-signup-field-wrap">' +
    '<div class="hc-signup-field-row">' +
    '<input id="hc-signup-field-input" class="hc-signup-field-input" type="' +
    inputType +
    '" value="' +
    escapeAttr(value) +
    '" placeholder="' +
    escapeAttr(options.placeholder || '') +
    '" autocomplete="' +
    escapeAttr(autoComplete) +
    '" autocapitalize="' +
    escapeAttr(autoCapitalize) +
    '" autocorrect="off" spellcheck="false" />' +
    (showPasswordToggle
      ? '<button type="button" class="hc-signup-field-eye" id="hc-signup-field-eye" aria-label="Toggle password visibility">' +
        showPassSvg +
        '</button>'
      : '') +
    '</div>' +
    '</div>' +
    '<div class="hc-signup-field-actions">' +
    '<button type="button" id="hc-signup-field-continue" class="hc-signup-field-btn' +
    (options.continueDisabled ? ' hc-signup-field-btn--disabled' : '') +
    '"' +
    (options.continueDisabled ? ' disabled' : '') +
    '>Continue</button>' +
    '</div>' +
    '</div>';

  var backBtn = container.querySelector('#hc-signup-field-back');
  var input = container.querySelector('#hc-signup-field-input');
  var wrap = container.querySelector('#hc-signup-field-wrap');
  var eyeBtn = container.querySelector('#hc-signup-field-eye');
  var continueBtn = container.querySelector('#hc-signup-field-continue');

  function updateFont() {
    if (!input || !wrap) return;
    var available = wrap.clientWidth - (showPasswordToggle ? EYE_RESERVED : 0);
    var displayText = input.value || options.placeholder || '';
    var fontSize = getInputFontSize(displayText, available);
    var lineHeight = Math.round(fontSize * 1.2);
    input.style.fontSize = fontSize + 'px';
    input.style.lineHeight = lineHeight + 'px';
    input.classList.toggle('hc-signup-field-input--empty', !input.value);
  }

  function setContinueDisabled(disabled) {
    if (!continueBtn) return;
    continueBtn.disabled = !!disabled;
    continueBtn.classList.toggle('hc-signup-field-btn--disabled', !!disabled);
  }

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      if (typeof options.onBack === 'function') {
        options.onBack();
        return;
      }
      navigate(backTo);
    });
  }

  if (input) {
    input.addEventListener('input', function () {
      value = input.value;
      updateFont();
      setContinueDisabled(!String(value || '').trim() || !!options.forceDisabled);
      if (typeof options.onChange === 'function') {
        options.onChange(value);
      }
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!continueBtn || continueBtn.disabled) return;
        if (typeof options.onContinue === 'function') {
          options.onContinue(value);
        }
      }
    });
  }

  if (eyeBtn && input) {
    eyeBtn.addEventListener('click', function () {
      passwordVisible = !passwordVisible;
      input.type = passwordVisible ? 'text' : 'password';
      eyeBtn.innerHTML = passwordVisible ? hidePassSvg : showPassSvg;
    });
  }

  if (continueBtn) {
    continueBtn.addEventListener('click', function () {
      if (continueBtn.disabled) return;
      if (typeof options.onContinue === 'function') {
        options.onContinue(input ? input.value : value);
      }
    });
  }

  updateFont();
  window.addEventListener('resize', updateFont);

  if (options.autoFocus !== false && input) {
    window.setTimeout(function () {
      input.focus();
    }, 300);
  }

  return {
    cleanup: function () {
      window.removeEventListener('resize', updateFont);
    },
    setContinueDisabled: setContinueDisabled,
    getValue: function () {
      return input ? input.value : value;
    },
    setValue: function (next) {
      if (input) {
        input.value = next != null ? String(next) : '';
        value = input.value;
        updateFont();
        setContinueDisabled(!String(value || '').trim() || !!options.forceDisabled);
      }
    },
  };
}

export default { mountSignupFieldLayout };
