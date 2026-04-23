import { navigate } from '../router.js';
import { postToNative } from '../bridge.js';
import NavHeader from '../base-components/NavHeader.js';
import MainButton from '../base-components/MainButton.js';
import { showError } from '../base-components/toastApi.js';

var EXTENSION_URL = 'https://app.gethomecrowd.com/extension-download/';

export function renderBrowserExtension(container) {
  var html = '';
  html += '<div class="hc-browser-extension">';
  html += '<div class="hc-account-settings-nav">';
  html += NavHeader({
    title: 'Browser Extension',
    backButtonId: 'hc-be-back',
  });
  html += '</div>';
  html += '<div class="hc-be-body">';
  html += '<div class="hc-be-content">';
  html += '<div class="hc-be-title">Safari Extension</div>';
  html +=
    '<div class="hc-be-description">Install the Homecrowd Safari extension to earn points while browsing your favorite websites.</div>';
  html += '<div class="hc-be-actions">';
  html += MainButton({
    id: 'hc-be-install',
    text: 'Install Extension',
  });
  html += '</div>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  var backBtn = document.getElementById('hc-be-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate('/profile');
    });
  }

  var installBtn = document.getElementById('hc-be-install');
  if (installBtn) {
    installBtn.addEventListener('click', function () {
      try {
        // Ask native host to open Safari/External browser.
        postToNative('homecrowd:open-url', { url: EXTENSION_URL });
        // Browser/web fallback only when running without native bridge.
        var hasNativeBridge =
          !!(window.ReactNativeWebView && window.ReactNativeWebView.postMessage) ||
          !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.homecrowd) ||
          !!(window.HomecrowdBridge && window.HomecrowdBridge.postMessage) ||
          !!(window.FlutterWebView && window.FlutterWebView.postMessage);
        if (!hasNativeBridge) {
          var opened = window.open(EXTENSION_URL, '_blank', 'noopener,noreferrer');
          if (!opened) {
            window.location.href = EXTENSION_URL;
          }
        }
      } catch (_e) {
        showError('Failed to open extension page');
      }
    });
  }
}
