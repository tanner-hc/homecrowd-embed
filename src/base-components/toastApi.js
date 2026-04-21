var hostEl = null;
var hideTimer = null;
var currentEl = null;

function ensureHost() {
  if (hostEl && hostEl.parentNode) {
    return;
  }
  hostEl = document.createElement('div');
  hostEl.id = 'hc-toast-host';
  hostEl.className = 'hc-bc-toast-host';
  hostEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(hostEl);
}

function removeCurrent() {
  if (hideTimer) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (currentEl && currentEl.parentNode) {
    currentEl.parentNode.removeChild(currentEl);
  }
  currentEl = null;
}

export function showToast(message, type, duration) {
  type = type || 'error';
  duration = duration == null ? 3000 : duration;

  removeCurrent();
  ensureHost();

  var bar = document.createElement('div');
  bar.className =
    'hc-toast hc-bc-toast-bar ' + (type === 'success' ? 'hc-bc-toast--success' : 'hc-bc-toast--error');

  var text = document.createElement('span');
  text.className = 'hc-bc-toast-msg';
  text.textContent = message != null ? String(message) : '';

  var close = document.createElement('button');
  close.type = 'button';
  close.className = 'hc-bc-toast-close';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = '×';

  close.addEventListener('click', function () {
    hideToast();
  });

  bar.appendChild(text);
  bar.appendChild(close);
  hostEl.appendChild(bar);
  currentEl = bar;

  hideTimer = window.setTimeout(function () {
    hideToast();
  }, duration);
}

export function showError(message, duration) {
  showToast(message, 'error', duration);
}

export function showSuccess(message, duration) {
  showToast(message, 'success', duration);
}

export function hideToast() {
  if (hideTimer) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (currentEl && currentEl.parentNode) {
    currentEl.parentNode.removeChild(currentEl);
  }
  currentEl = null;
}
