import { load as loadMapKit } from '@apple/mapkit-loader';
import * as api from './api.js';

var mapKitDevOriginWarned = false;

function warnMapKitDevOriginIfNeeded() {
  if (!import.meta.env.DEV || typeof window === 'undefined' || mapKitDevOriginWarned) {
    return;
  }
  var h = window.location.hostname;
  if (h !== 'localhost' && h !== '127.0.0.1') {
    return;
  }
  mapKitDevOriginWarned = true;
  var port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  console.warn(
    '[HC MapKit] Token expects origin embed.gethomecrowd.com; current Origin is localhost. Options: (1) In Apple Developer → Maps / MapKit JS add http://localhost:' +
      port +
      '; (2) Add "127.0.0.1 embed.gethomecrowd.com" to /etc/hosts, run npm run dev:embed, open http://embed.gethomecrowd.com:' +
      port,
  );
}

var mapKitLoadPromise = null;
var mapKitTokenFromApiResolved = null;
var mapKitAuthFailureReported = false;
var mapKitConsoleAuthHookInstalled = false;

function joinMapKitConsoleArgs(args) {
  var parts = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a && typeof a === 'object' && typeof a.message === 'string') {
      parts.push(a.message);
    } else {
      parts.push(String(a));
    }
  }
  return parts.join(' ');
}

function mapKitConsoleImpliesAuthFailure(text) {
  var low = String(text).toLowerCase();
  if (low.indexOf('mapkit') < 0) return false;
  return (
    low.indexOf('initialization failed') >= 0 ||
    low.indexOf('authorization token is invalid') >= 0 ||
    (low.indexOf('authorization') >= 0 && low.indexOf('invalid') >= 0 && low.indexOf('token') >= 0)
  );
}

function installMapKitConsoleAuthWatcher() {
  if (mapKitConsoleAuthHookInstalled || typeof console === 'undefined' || typeof console.error !== 'function') {
    return;
  }
  mapKitConsoleAuthHookInstalled = true;
  var prev = console.error;
  console.error = function () {
    var joined = joinMapKitConsoleArgs(arguments);
    if (mapKitConsoleImpliesAuthFailure(joined)) {
      mapKitAuthFailureReported = true;
    }
    return prev.apply(console, arguments);
  };
}

export function mapKitAuthFailureWasReported() {
  return mapKitAuthFailureReported;
}

function getMapKitJsTokenFromEnv() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MAPKIT_JS_TOKEN) {
    return String(import.meta.env.VITE_MAPKIT_JS_TOKEN).trim();
  }
  return '';
}

function pickMapKitTokenFromPayload(data) {
  if (!data || typeof data !== 'object') return '';
  var t =
    data.token ||
    data.mapkit_js_token ||
    data.mapKitJsToken ||
    data.apple_maps_token ||
    data.appleMapsToken;
  return t && String(t).trim() ? String(t).trim() : '';
}

export function resolveMapKitTokenAsync() {
  var envTok = getMapKitJsTokenFromEnv();
  if (envTok) {
    console.log('[HC MapKit] token source: VITE_MAPKIT_JS_TOKEN');
    return Promise.resolve(envTok);
  }
  if (mapKitTokenFromApiResolved !== null) {
    console.log('[HC MapKit] token source: cache', mapKitTokenFromApiResolved ? 'present' : 'empty');
    return Promise.resolve(mapKitTokenFromApiResolved);
  }
  console.log('[HC MapKit] token source: fetching /api/embed/.../mapkit-js-token/');
  return api
    .getEmbedMapKitJsToken()
    .then(function (data) {
      mapKitTokenFromApiResolved = pickMapKitTokenFromPayload(data);
      console.log('[HC MapKit] token API:', mapKitTokenFromApiResolved ? 'ok' : 'empty payload');
      return mapKitTokenFromApiResolved;
    })
    .catch(function (err) {
      mapKitTokenFromApiResolved = '';
      console.warn('[HC MapKit] token API error:', err && err.message ? err.message : err);
      return '';
    });
}

export function ensureMapKitLoaded(token) {
  if (!token) return Promise.reject(new Error('no MapKit token'));
  installMapKitConsoleAuthWatcher();
  warnMapKitDevOriginIfNeeded();
  if (!mapKitLoadPromise) {
    console.log('[HC MapKit] loadMapKit: start (map + annotations)');
    mapKitLoadPromise = loadMapKit({
      version: '5.x.x',
      token: token,
      libraries: ['map', 'annotations'],
    })
      .then(function (mapkit) {
        console.log('[HC MapKit] loadMapKit: done', mapkit && mapkit.loadedLibraries ? mapkit.loadedLibraries : '');
        return mapkit;
      })
      .catch(function (err) {
        mapKitLoadPromise = null;
        console.error('[HC MapKit] loadMapKit: failed', err);
        throw err;
      });
  }
  return mapKitLoadPromise;
}

export function preloadMapKitForEmbed() {
  if (!api.isAuthenticated()) {
    console.log('[HC MapKit] preload: skip (not authenticated)');
    return;
  }
  installMapKitConsoleAuthWatcher();
  console.log('[HC MapKit] preload: start');
  resolveMapKitTokenAsync()
    .then(function (t) {
      if (t) return ensureMapKitLoaded(t);
      console.log('[HC MapKit] preload: no token, skip load');
    })
    .catch(function (e) {
      console.warn('[HC MapKit] preload error:', e && e.message ? e.message : e);
    });
}
