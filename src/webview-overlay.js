/**
 * Full-screen iframe overlay for opening external URLs
 * within the embed without leaving the experience.
 */

var overlayEl = null;

export function showWebviewOverlay(url) {
  if (overlayEl) closeWebviewOverlay();

  overlayEl = document.createElement('div');
  overlayEl.className = 'hc-webview-overlay';
  overlayEl.innerHTML =
    '<div class="hc-webview-header">' +
      '<button class="hc-webview-done">Done</button>' +
    '</div>' +
    '<iframe class="hc-webview-iframe" src="' + escapeAttr(url) + '" allow="clipboard-write" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>';

  document.body.appendChild(overlayEl);

  overlayEl.querySelector('.hc-webview-done').addEventListener('click', closeWebviewOverlay);
}

export function closeWebviewOverlay() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
