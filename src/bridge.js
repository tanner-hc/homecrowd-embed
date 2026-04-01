/**
 * Homecrowd Native Bridge
 *
 * Handles communication between the WebView and the host mobile app.
 * Works with any WebView implementation:
 *   - iOS WKWebView (webkit.messageHandlers)
 *   - Android WebView (HomecrowdBridge)
 *   - React Native WebView (ReactNativeWebView)
 *   - Flutter WebView (FlutterWebView)
 *   - Generic postMessage fallback
 *
 * --- Native → WebView ---
 * Send messages via: webview.evaluateJavaScript("HomecrowdEmbed.configure({...})")
 *   or via postMessage with { type: 'homecrowd:configure', payload: {...} }
 *
 * Commands:
 *   homecrowd:configure  — { token, primaryColor, view }
 *   homecrowd:navigate   — { view: 'rewards' | 'cards' | 'login' }
 *
 * --- WebView → Native ---
 * Events sent to the native layer:
 *   homecrowd:ready           — WebView is loaded and ready for config
 *   homecrowd:login           — User authenticated, payload: { user }
 *   homecrowd:logout          — User logged out
 *   homecrowd:route-change    — Navigation occurred, payload: { route }
 *   homecrowd:card-link-session — Card link session created, payload: { session }
 *   homecrowd:error           — Something went wrong, payload: { message }
 */

var listeners = {};

/**
 * Send an event to the native host app.
 */
export function postToNative(type, payload) {
  var message = { type: type, payload: payload || null };

  // iOS WKWebView
  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.homecrowd) {
    window.webkit.messageHandlers.homecrowd.postMessage(message);
    return;
  }

  // Android WebView
  if (window.HomecrowdBridge && window.HomecrowdBridge.postMessage) {
    window.HomecrowdBridge.postMessage(JSON.stringify(message));
    return;
  }

  // React Native WebView
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
    return;
  }

  // Flutter WebView
  if (window.FlutterWebView && window.FlutterWebView.postMessage) {
    window.FlutterWebView.postMessage(JSON.stringify(message));
    return;
  }

  // Generic fallback (parent window / iframe)
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

/**
 * Register a handler for messages from the native layer.
 */
export function onNativeMessage(type, fn) {
  if (!listeners[type]) listeners[type] = [];
  listeners[type].push(fn);
}

function dispatch(type, payload) {
  var fns = listeners[type];
  if (fns) {
    fns.forEach(function (fn) { fn(payload); });
  }
}

// Listen for postMessage from native
window.addEventListener('message', function (event) {
  var data = event.data;
  if (!data || typeof data !== 'object') return;
  if (!data.type || data.type.indexOf('homecrowd:') !== 0) return;
  dispatch(data.type, data.payload);
});

// Expose global API so native can call via evaluateJavaScript
window.HomecrowdEmbed = {
  configure: function (config) {
    dispatch('homecrowd:configure', config);
  },
  navigate: function (view) {
    dispatch('homecrowd:navigate', { view: view });
  },
};
