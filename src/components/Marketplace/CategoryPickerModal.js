import MainButton from '../../base-components/MainButton.js';
import { escapeHtml } from '../../base-components/html.js';
import { SHOP_CATEGORIES } from './ShopByCategory.js';

var ICON_BY_ID = {};

SHOP_CATEGORIES.forEach(function (cat) {
  ICON_BY_ID[cat.id] = cat;
});

/**
 * @param {{
 *   selectedId?: string,
 *   onClose?: function,
 *   onApply?: function(string),
 * }} options
 * @returns {{ close: function }}
 */
export function openCategoryPickerModal(options) {
  options = options || {};
  var draftId = options.selectedId || 'all';
  var closed = false;

  var root = document.createElement('div');
  root.className = 'hc-cat-picker-root';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');

  function renderBody() {
    var rows = SHOP_CATEGORIES.map(function (cat) {
      var selected = draftId === cat.id;
      var iconHtml = cat.iconPng
        ? '<img data-hc-ph="none" src="' +
          cat.iconPng +
          '" alt="" class="hc-cat-picker-icon" />'
        : '<span class="hc-cat-picker-icon hc-cat-picker-icon--svg" aria-hidden="true">' +
          (cat.iconSvg || '') +
          '</span>';
      return (
        '<button type="button" class="hc-cat-picker-row" data-cat-id="' +
        escapeHtml(cat.id) +
        '">' +
        '<span class="hc-cat-picker-row-left">' +
        iconHtml +
        '<span class="hc-cat-picker-label">' +
        escapeHtml(cat.label) +
        '</span>' +
        '</span>' +
        '<span class="hc-cat-picker-radio' +
        (selected ? ' hc-cat-picker-radio--selected' : '') +
        '">' +
        (selected ? '<span class="hc-cat-picker-radio-dot"></span>' : '') +
        '</span>' +
        '</button>'
      );
    }).join('');

    root.innerHTML =
      '<div class="hc-cat-picker-backdrop" data-cat-picker-close="1"></div>' +
      '<div class="hc-cat-picker-sheet">' +
      '<div class="hc-cat-picker-handle" aria-hidden="true"></div>' +
      '<div class="hc-cat-picker-title">Category</div>' +
      '<div class="hc-cat-picker-list">' +
      rows +
      '</div>' +
      '<div class="hc-cat-picker-footer">' +
      MainButton({
        id: 'hc-cat-picker-clear',
        text: 'Clear',
        outlined: true,
        className: 'hc-cat-picker-footer-btn',
      }) +
      MainButton({
        id: 'hc-cat-picker-apply',
        text: 'Apply',
        className: 'hc-cat-picker-footer-btn',
      }) +
      '</div>' +
      '</div>';
  }

  function close(after) {
    if (closed) return;
    closed = true;
    root.classList.remove('hc-cat-picker-root--visible');
    window.setTimeout(function () {
      if (root.parentNode) root.parentNode.removeChild(root);
      if (typeof options.onClose === 'function') options.onClose();
      if (typeof after === 'function') after();
    }, 220);
  }

  function bind() {
    root.querySelectorAll('[data-cat-picker-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        close();
      });
    });
    root.querySelectorAll('[data-cat-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        draftId = btn.getAttribute('data-cat-id') || 'all';
        renderBody();
        bind();
        requestAnimationFrame(function () {
          root.classList.add('hc-cat-picker-root--visible');
        });
      });
    });
    var clearBtn = root.querySelector('#hc-cat-picker-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        draftId = 'all';
        renderBody();
        bind();
        requestAnimationFrame(function () {
          root.classList.add('hc-cat-picker-root--visible');
        });
      });
    }
    var applyBtn = root.querySelector('#hc-cat-picker-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        var next = draftId;
        close(function () {
          if (typeof options.onApply === 'function') options.onApply(next);
        });
      });
    }
  }

  renderBody();
  document.body.appendChild(root);
  bind();
  requestAnimationFrame(function () {
    root.classList.add('hc-cat-picker-root--visible');
  });

  return { close: close };
}

export default { openCategoryPickerModal };
