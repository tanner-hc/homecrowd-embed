import { openBottomSheet } from './base-components/BottomSheetModal.js';
import { escapeAttr, escapeHtml } from './base-components/html.js';
import { hasNativeBridge, postToNative } from './bridge.js';
import { isIOS, isAndroid } from './platform.js';

/**
 * Shared "open in maps" chooser, used by the stores map and by Shop now on
 * in-person offer detail. Callers build the destination with whatever location
 * helpers they already have and pass it in, so this module stays independent of
 * any one screen's merchant shape.
 *
 * @typedef {{ name?: string, address?: string, query: string, lat?: number, lng?: number }} Destination
 */

/**
 * @param {Destination} dest
 * @param {{ lat: number, lng: number }|null} [origin]
 */
export function buildDirectionsAppOptions(dest, origin) {
  var daddr = dest.query;
  var hasCoords = Number.isFinite(dest.lat) && Number.isFinite(dest.lng);
  var originStr =
    origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)
      ? origin.lat + ',' + origin.lng
      : '';

  var apple =
    'https://maps.apple.com/?' +
    (originStr ? 'saddr=' + encodeURIComponent(originStr) + '&' : '') +
    'daddr=' +
    encodeURIComponent(daddr) +
    '&dirflg=d';

  var google =
    'https://www.google.com/maps/dir/?api=1' +
    (originStr ? '&origin=' + encodeURIComponent(originStr) : '') +
    '&destination=' +
    encodeURIComponent(daddr);

  var waze = hasCoords
    ? 'https://waze.com/ul?ll=' +
      encodeURIComponent(dest.lat + ',' + dest.lng) +
      '&navigate=yes'
    : 'https://waze.com/ul?q=' + encodeURIComponent(daddr) + '&navigate=yes';

  var options = [];
  if (isIOS()) {
    options.push({ id: 'apple', label: 'Apple Maps', url: apple });
    options.push({ id: 'google', label: 'Google Maps', url: google });
    options.push({ id: 'waze', label: 'Waze', url: waze });
  } else if (isAndroid()) {
    options.push({ id: 'google', label: 'Google Maps', url: google });
    options.push({ id: 'waze', label: 'Waze', url: waze });
  } else {
    options.push({ id: 'google', label: 'Google Maps', url: google });
    options.push({ id: 'apple', label: 'Apple Maps', url: apple });
  }
  return options;
}

export function openDirectionsUrl(url) {
  if (!url) return;
  if (hasNativeBridge()) {
    try {
      postToNative('homecrowd:open-url', { url: url, title: 'Directions' });
    } catch (_e) {}
    try {
      postToNative('homecrowd:open-merchant-webview', { url: url, title: 'Directions' });
    } catch (_e2) {}
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Presents the installed map apps in a bottom sheet. A single option opens
 * straight through rather than asking the user to pick from a list of one.
 *
 * @param {Destination} dest
 * @param {{ lat: number, lng: number }|null} [origin]
 */
export function openDirectionsPicker(dest, origin) {
  if (!dest || !dest.query) {
    window.alert('Location is not available for this store.');
    return;
  }
  var apps = buildDirectionsAppOptions(dest, origin);
  if (!apps.length) return;

  if (apps.length === 1) {
    openDirectionsUrl(apps[0].url);
    return;
  }

  var bodyHtml =
    '<div class="hc-map-directions-picker">' +
    apps
      .map(function (app) {
        return (
          '<button type="button" class="hc-map-directions-option" data-map-app="' +
          escapeAttr(app.id) +
          '">' +
          escapeHtml(app.label) +
          '</button>'
        );
      })
      .join('') +
    '</div>';

  var sheet = openBottomSheet({
    title: 'Get Directions',
    subtitle: dest.address || dest.name || '',
    bodyHtml: bodyHtml,
  });
  var root = sheet && sheet.root;
  if (!root) return;

  root.querySelectorAll('[data-map-app]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-map-app');
      var app = apps.find(function (item) {
        return item.id === id;
      });
      if (typeof sheet.close === 'function') {
        sheet.close(function () {
          if (app) openDirectionsUrl(app.url);
        });
        return;
      }
      if (app) openDirectionsUrl(app.url);
    });
  });
}

export default {
  buildDirectionsAppOptions,
  openDirectionsUrl,
  openDirectionsPicker,
};
