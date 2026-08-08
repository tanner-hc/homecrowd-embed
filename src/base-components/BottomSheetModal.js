import { escapeHtml, joinClasses } from './html.js';

function animateOpen(overlay, sheet) {
  requestAnimationFrame(function () {
    overlay.classList.add('hc-bs-overlay--visible');
    sheet.classList.add('hc-bs-sheet--visible');
  });
}

function animateClose(overlay, sheet, done) {
  overlay.classList.remove('hc-bs-overlay--visible');
  sheet.classList.remove('hc-bs-sheet--visible');
  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    sheet.removeEventListener('transitionend', onEnd);
    if (typeof done === 'function') done();
  }
  function onEnd(e) {
    if (e.target === sheet) finish();
  }
  sheet.addEventListener('transitionend', onEnd);
  window.setTimeout(finish, 280);
}

/**
 * @param {object} options
 * @returns {{ close: function, setPrimaryLoading: function, updateBody: function, root: HTMLElement }}
 */
export function openBottomSheet(options) {
  options = options || {};
  var onClose = options.onClose;
  var root = document.createElement('div');
  root.className = joinClasses(
    'hc-bs-root',
    options.keyboardAvoiding ? 'hc-bs-root--keyboard' : ''
  );
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');

  var primary = options.primaryButton || null;
  var secondary = options.secondaryButton || null;
  var closed = false;
  var api = {
    root: root,
    close: function () {},
    setPrimaryLoading: function () {},
    updateBody: function () {},
  };

  function buttonHtml(btn, kind) {
    if (!btn) return '';
    var idAttr = btn.id ? ' id="' + escapeHtml(btn.id) + '"' : '';
    var disabled = btn.disabled || btn.loading ? ' disabled' : '';
    var loadingHtml = btn.loading
      ? '<span class="hc-bs-btn-spinner" aria-hidden="true"></span>'
      : '';
    var labelHtml = btn.loading ? '' : escapeHtml(btn.label || '');
    return (
      '<button type="button" class="hc-bs-btn hc-bs-btn--' +
      kind +
      (secondary && kind === 'primary' ? ' hc-bs-btn--spaced' : '') +
      '"' +
      idAttr +
      disabled +
      ' data-bs-btn="' +
      kind +
      '">' +
      loadingHtml +
      '<span class="hc-bs-btn-label">' +
      labelHtml +
      '</span></button>'
    );
  }

  var titleHtml = '';
  if (options.title) {
    titleHtml =
      '<h2 class="hc-bs-title">' +
      escapeHtml(options.title).replace(/\n/g, '<br />') +
      '</h2>';
  }

  root.innerHTML =
    '<div class="hc-bs-overlay" data-bs-dismiss="1"></div>' +
    '<div class="hc-bs-sheet">' +
    '<div class="hc-bs-handle-area" data-bs-handle="1">' +
    '<div class="hc-bs-handle"></div>' +
    '</div>' +
    (options.iconHtml
      ? '<div class="hc-bs-icon">' + options.iconHtml + '</div>'
      : '') +
    titleHtml +
    (options.subtitle
      ? '<p class="hc-bs-subtitle' +
        (options.subtitleClass ? ' ' + escapeHtml(options.subtitleClass) : '') +
        '">' +
        escapeHtml(options.subtitle) +
        '</p>'
      : '') +
    '<div class="hc-bs-body">' +
    (options.bodyHtml || '') +
    '</div>' +
    buttonHtml(primary, 'primary') +
    buttonHtml(secondary, 'secondary') +
    '</div>';

  document.body.appendChild(root);

  var overlay = root.querySelector('.hc-bs-overlay');
  var sheet = root.querySelector('.hc-bs-sheet');

  function destroy() {
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  function cleanupDrag() {
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
    window.removeEventListener('touchend', onPointerUp);
  }

  function close(callback) {
    if (closed) return;
    closed = true;
    cleanupDrag();
    animateClose(overlay, sheet, function () {
      destroy();
      if (typeof callback === 'function') {
        callback();
      } else if (typeof onClose === 'function') {
        onClose();
      }
    });
  }

  api.close = close;

  function handleButton(kind) {
    var btn = kind === 'primary' ? primary : secondary;
    if (!btn || btn.disabled || btn.loading) return;
    if (btn.closeOnPress === false) {
      if (typeof btn.onPress === 'function') btn.onPress(close);
      return;
    }
    close(btn.onPress || onClose);
  }

  root.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('[data-bs-dismiss]')) {
      close(onClose);
      return;
    }
    var btnEl = t && t.closest ? t.closest('[data-bs-btn]') : null;
    if (btnEl) {
      handleButton(btnEl.getAttribute('data-bs-btn'));
    }
  });

  var handleArea = root.querySelector('[data-bs-handle]');
  var dragStartY = 0;
  var dragging = false;
  var currentY = 0;

  function onPointerDown(e) {
    dragging = true;
    dragStartY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
    currentY = 0;
    sheet.style.transition = 'none';
  }

  function onPointerMove(e) {
    if (!dragging) return;
    var y = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
    currentY = Math.max(0, y - dragStartY);
    sheet.style.transform = 'translateY(' + currentY + 'px)';
    overlay.style.opacity = String(Math.max(0, 1 - currentY / (window.innerHeight * 0.45)));
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    overlay.style.opacity = '';
    if (currentY > 100) {
      close(onClose);
      return;
    }
    sheet.style.transform = '';
  }

  if (handleArea) {
    handleArea.addEventListener('mousedown', onPointerDown);
    handleArea.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
  }

  api.setPrimaryLoading = function (loading) {
    var btnEl = root.querySelector('[data-bs-btn="primary"]');
    if (!btnEl) return;
    if (primary) {
      primary.loading = !!loading;
      primary.disabled = !!loading;
    }
    btnEl.disabled = !!loading;
    var label = btnEl.querySelector('.hc-bs-btn-label');
    var spinner = btnEl.querySelector('.hc-bs-btn-spinner');
    if (loading) {
      if (label) label.textContent = '';
      if (!spinner) {
        btnEl.insertAdjacentHTML(
          'afterbegin',
          '<span class="hc-bs-btn-spinner" aria-hidden="true"></span>'
        );
      }
    } else {
      if (spinner) spinner.remove();
      if (label) label.textContent = (primary && primary.label) || '';
    }
  };

  api.updateBody = function (html) {
    var body = root.querySelector('.hc-bs-body');
    if (body) body.innerHTML = html || '';
  };

  animateOpen(overlay, sheet);
  return api;
}

export default { openBottomSheet };
