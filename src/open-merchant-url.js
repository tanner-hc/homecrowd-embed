import { hasNativeBridge, postToNative } from './bridge.js';

function merchantRedirectPageUrl() {
  var base = '/';
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) {
      base = import.meta.env.BASE_URL;
    }
  } catch (_e) {}
  if (base.charAt(base.length - 1) !== '/') base += '/';
  return new URL(base + 'merchant-redirect.html', window.location.href).href;
}

export function openMerchantUrl(url, title, options) {
  options = options || {};
  if (!url) return;
  if (url.indexOf('http') !== 0) url = 'https://' + url;

  if (hasNativeBridge()) {
    try {
      postToNative('homecrowd:open-merchant-webview', { url: url, title: title || '' });
    } catch (_e) {}
    return;
  }

  if (typeof options.showSpinner === 'function') options.showSpinner();
  try {
    sessionStorage.setItem('hc_merchant_open_url', url);
    window.location.href = merchantRedirectPageUrl();
  } catch (_err) {
    window.location.href = url;
  }
}
