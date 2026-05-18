/**
 * Full-screen iframe overlay for opening external URLs within the embed.
 *
 * Usage:
 *   showWebviewOverlay(url, {
 *     title: 'Optional title (shown in header)',
 *     onFallback: function () { ... },  // called when iframe load fails or
 *                                       // user taps "Open in browser"
 *   });
 *
 * Failure detection (best-effort; browser security model limits what we
 * can see):
 *   - iframe never fires `onload` within LOAD_TIMEOUT_MS  → bail
 *   - iframe fires `onload` but contentWindow ends up at about:blank,
 *     which is what some browsers leave behind on X-Frame-Options
 *     blocks → bail
 *   - Successful cross-origin loads throw SecurityError when we try to
 *     read `contentWindow.location.href`; that's the *good* signal.
 *
 * What this WON'T catch: iframes that technically load but render a
 * broken page (third-party cookies blocked, scripts failing, etc.).
 * For those cases the "Open in browser" button gives the user an escape.
 */

var overlayEl = null;
var loadTimer = null;
var loaded = false;
var bailed = false;
var currentOnFallback = null;

var LOAD_TIMEOUT_MS = 5000;

export function showWebviewOverlay(url, options) {
  if (overlayEl) closeWebviewOverlay();

  options = options || {};
  var title = options.title || '';
  currentOnFallback = typeof options.onFallback === 'function' ? options.onFallback : null;

  loaded = false;
  bailed = false;

  overlayEl = document.createElement('div');
  overlayEl.className = 'hc-webview-overlay';
  overlayEl.innerHTML =
    '<div class="hc-webview-header">' +
      '<button type="button" class="hc-webview-done">Done</button>' +
      // Title and "Open in browser" button hidden for now.
      // (title
      //   ? '<div class="hc-webview-title">' + escapeHtml(title) + '</div>'
      //   : '<div class="hc-webview-title"></div>') +
      // '<button type="button" class="hc-webview-open-external" title="Open in browser">Open</button>' +
    '</div>' +
    '<iframe class="hc-webview-iframe" src="' + escapeAttr(url) + '" ' +
      'allow="clipboard-write" ' +
      'sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>';

  document.body.appendChild(overlayEl);

  overlayEl.querySelector('.hc-webview-done').addEventListener('click', closeWebviewOverlay);
  // var openExternalBtn = overlayEl.querySelector('.hc-webview-open-external');
  // if (openExternalBtn) {
  //   openExternalBtn.addEventListener('click', function () { bailToFallback(); });
  // }

  var iframe = overlayEl.querySelector('.hc-webview-iframe');
  iframe.addEventListener('load', function () {
    if (bailed) return;
    if (!iframe.contentWindow) {
      bailToFallback();
      return;
    }
    // The merchant URL is always cross-origin from the embed, so a
    // successful cross-origin merchant load makes location.href reads
    // throw SecurityError. If we can read it, the iframe got parked
    // somewhere else — about:blank (X-Frame-Options block), chrome-
    // error://chromewebdata/ (CSP frame-ancestors block, network error),
    // empty string (some browser implementations), or any other
    // browser-internal fallback page. Treat all of those as failure.
    try {
      // Touching .href is enough to trigger SecurityError on a
      // successful cross-origin load. The actual returned value, when
      // readable, just tells us *which* failure state we ended up in.
      // eslint-disable-next-line no-unused-vars
      var docHref = iframe.contentWindow.location.href;
      bailToFallback();
      return;
    } catch (e) {
      // SecurityError — merchant content loaded cross-origin. Success.
    }
    loaded = true;
    if (loadTimer) {
      clearTimeout(loadTimer);
      loadTimer = null;
    }
  });

  loadTimer = setTimeout(function () {
    if (loaded || bailed) return;
    bailToFallback();
  }, LOAD_TIMEOUT_MS);
}

function bailToFallback() {
  if (bailed) return;
  bailed = true;
  if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = null;
  }
  var fb = currentOnFallback;
  closeWebviewOverlay();
  if (typeof fb === 'function') fb();
}

export function closeWebviewOverlay() {
  if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = null;
  }
  currentOnFallback = null;
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
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
