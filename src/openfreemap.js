export var OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

var mapLibreLoadPromise = null;
var styleWarmed = false;

function mapLibreWorkerUrl() {
  var base = import.meta.env.BASE_URL || '/';
  if (base.charAt(base.length - 1) !== '/') base += '/';
  return new URL(base + 'maplibre-gl-worker.mjs', window.location.href).href;
}

export function ensureMapLibreLoaded() {
  if (!mapLibreLoadPromise) {
    console.log('[HC OpenFreeMap] loading maplibre-gl');
    mapLibreLoadPromise = Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ])
      .then(function (mods) {
        var mod = mods[0];
        var maplibregl = mod && mod.default ? mod.default : mod;
        if (!maplibregl || typeof maplibregl.Map !== 'function') {
          throw new Error('maplibre-gl is not available');
        }
        if (typeof maplibregl.setWorkerUrl === 'function') {
          maplibregl.setWorkerUrl(mapLibreWorkerUrl());
        }
        console.log('[HC OpenFreeMap] maplibre-gl ready');
        return maplibregl;
      })
      .catch(function (err) {
        mapLibreLoadPromise = null;
        console.error('[HC OpenFreeMap] maplibre-gl load failed', err);
        throw err;
      });
  }
  return mapLibreLoadPromise;
}

function warmOpenFreeMapStyle() {
  if (styleWarmed || typeof fetch !== 'function') return;
  styleWarmed = true;
  fetch(OPENFREEMAP_STYLE_URL, { mode: 'cors', cache: 'force-cache' }).catch(function (err) {
    console.warn('[HC OpenFreeMap] style warmup failed:', err && err.message ? err.message : err);
  });
}

export function preloadMapForEmbed() {
  warmOpenFreeMapStyle();
  ensureMapLibreLoaded().catch(function (e) {
    console.warn('[HC OpenFreeMap] preload error:', e && e.message ? e.message : e);
  });
}
