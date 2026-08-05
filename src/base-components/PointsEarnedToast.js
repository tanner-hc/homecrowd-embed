import { escapeHtml } from './html.js';
import completeIconUrl from '../assets/icons/complete_icon.png';

/**
 * Inline / overlay points earned banner (mobile PointsEarnedToast 1:1).
 * @param {HTMLElement} mountEl
 * @param {{ points: number, duration?: number, onHide?: function }} options
 * @returns {{ hide: function, destroy: function }}
 */
export function showPointsEarnedToast(mountEl, options) {
  options = options || {};
  var points = Number(options.points) || 0;
  var duration = options.duration == null ? 3500 : options.duration;
  if (!mountEl || points <= 0) {
    return { hide: function () {}, destroy: function () {} };
  }

  var root = document.createElement('div');
  root.className = 'hc-points-earned-toast';
  root.setAttribute('aria-live', 'polite');
  root.innerHTML =
    '<div class="hc-points-earned-toast-banner">' +
    '<img src="' +
    completeIconUrl +
    '" alt="" class="hc-points-earned-toast-icon" />' +
    '<span class="hc-points-earned-toast-text">You earned ' +
    escapeHtml(String(points)) +
    ' points!</span>' +
    '</div>';

  mountEl.appendChild(root);
  requestAnimationFrame(function () {
    root.classList.add('hc-points-earned-toast--visible');
  });

  var hideTimer = window.setTimeout(hide, duration);
  var hidden = false;

  function hide() {
    if (hidden) return;
    hidden = true;
    window.clearTimeout(hideTimer);
    root.classList.remove('hc-points-earned-toast--visible');
    root.classList.add('hc-points-earned-toast--hiding');
    window.setTimeout(function () {
      if (root.parentNode) root.parentNode.removeChild(root);
      if (typeof options.onHide === 'function') options.onHide();
    }, 260);
  }

  return {
    hide: hide,
    destroy: function () {
      window.clearTimeout(hideTimer);
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

export default { showPointsEarnedToast };
