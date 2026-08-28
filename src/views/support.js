import { navigate } from '../router.js';
import PageHeader from '../base-components/PageHeader.js';
import SettingsRow from '../base-components/SettingsRow.js';
import phoneIconSvg from '../assets/icons/settings/phone.svg?raw';
import dollarSignIconSvg from '../assets/icons/dollar-sign.svg?raw';

function getTimezoneString() {
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) return tz;
    }
    var offset = -new Date().getTimezoneOffset();
    var sign = offset >= 0 ? '+' : '-';
    return 'UTC' + sign + String(Math.abs(offset) / 60);
  } catch (_e) {
    return null;
  }
}

function getSupportContext(overrides) {
  var host = typeof window !== 'undefined' && window.location ? window.location.host : null;
  var base = {
    platform: 'Web',
    device_model: navigator && navigator.userAgent ? navigator.userAgent : null,
    os_version: navigator && navigator.platform ? navigator.platform : null,
    app_version: null,
    environment:
      typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
        ? 'development'
        : 'production',
    timezone: getTimezoneString(),
    screen: 'Support',
    build_type:
      typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
        ? 'debug'
        : 'release',
    host: host,
  };
  return Object.assign(base, overrides || {});
}

export { getSupportContext };

/**
 * The support hub: a short menu of the ways to reach us. The contact form
 * itself lives in contact-us.js, one row down.
 */
export function renderSupport(container) {
  container.innerHTML =
    '<div class="hc-support-page">' +
    PageHeader({ title: 'Support', backButtonId: 'hc-support-menu-back' }) +
    '<div class="hc-settings-list">' +
    SettingsRow({ id: 'hc-support-contact', icon: phoneIconSvg, label: 'Contact us' }) +
    SettingsRow({
      id: 'hc-support-upload-receipt',
      icon: dollarSignIconSvg,
      label: 'Upload receipt',
    }) +
    '</div>' +
    '</div>';

  var go = function (id, path) {
    var el = container.querySelector('#' + id);
    if (el) {
      el.addEventListener('click', function () {
        navigate(path);
      });
    }
  };

  go('hc-support-contact', '/contact-us?from=/support');
  go('hc-support-upload-receipt', '/upload-receipt');
  go('hc-support-menu-back', '/settings');
}
