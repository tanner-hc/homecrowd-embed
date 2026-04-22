import * as api from '../api.js';
import { resolveMapKitTokenAsync, ensureMapKitLoaded, mapKitAuthFailureWasReported } from '../mapkit-embed.js';
import { postToNative } from '../bridge.js';
import { showWebviewOverlay } from '../webview-overlay.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import ScreenTitle from '../base-components/ScreenTitle.js';
import SearchBar from '../base-components/SearchBar.js';
import EmptyState from '../base-components/EmptyState.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';

var OFFER_LOC_KEY = 'hc_embed_offer_location';

function getStoredOfferLocation() {
  try {
    var raw = sessionStorage.getItem(OFFER_LOC_KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    if (o && o.lat != null && o.lng != null) {
      return { latitude: Number(o.lat), longitude: Number(o.lng) };
    }
  } catch (e) {}
  return null;
}

export function renderOffers(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading offers...' });
  loadOffers(container, 'stores');
}

async function loadOffers(container, activeTab) {
  try {
    var userLoc = getStoredOfferLocation();
    var results = await Promise.all([
      api.getOffers(1, 50, userLoc).catch(function () {
        return {};
      }),
      api.getWildfireOffers(1, 50).catch(function () {
        return {};
      }),
      api.getFeaturedOffers('card_linked').catch(function () {
        return [];
      }),
      api.getFeaturedOffers('click').catch(function () {
        return [];
      }),
      resolveMapKitTokenAsync().catch(function () {
        return '';
      }),
    ]);

    var cardlinkedRaw = results[0];
    var clickRaw = results[1];
    var featuredStoresRaw = results[2];
    var featuredOnlineRaw = results[3];

    var cardlinked = cardlinkedRaw.cardlinked || cardlinkedRaw.results || (Array.isArray(cardlinkedRaw) ? cardlinkedRaw : []);
    var click = clickRaw.click || clickRaw.results || (Array.isArray(clickRaw) ? clickRaw : []);
    var allFeaturedStores = Array.isArray(featuredStoresRaw) ? featuredStoresRaw : featuredStoresRaw.results || [];
    var allFeaturedOnline = Array.isArray(featuredOnlineRaw) ? featuredOnlineRaw : featuredOnlineRaw.results || [];

    var featuredStoresTop = allFeaturedStores.filter(function (f) {
      return f.is_active && f.top_featured;
    });
    var featuredStoresBottom = allFeaturedStores.filter(function (f) {
      return f.is_active && f.bottom_featured;
    });
    var featuredOnlineTop = allFeaturedOnline.filter(function (f) {
      return f.is_active && f.top_featured;
    });
    var featuredOnlineBottom = allFeaturedOnline.filter(function (f) {
      return f.is_active && f.bottom_featured;
    });

    var html = '';

    html += '<div class="hc-offers-tabs">';
    html +=
      '<button class="hc-offers-tab' +
      (activeTab === 'stores' ? ' active' : '') +
      '" data-tab="stores">Stores</button>';
    html +=
      '<button class="hc-offers-tab' +
      (activeTab === 'online' ? ' active' : '') +
      '" data-tab="online">Online</button>';
    html += '</div>';

    html +=
      '<div id="hc-tab-stores" class="hc-tab-content"' +
      (activeTab !== 'stores' ? ' style="display:none"' : '') +
      '>';

    html += '<div class="hc-screen-title">';
    html += ScreenTitle({
      title: 'Partner stores',
      subtitle: 'Explore our marketplace of exclusive earnings',
    });
    html += '</div>';

    if (featuredStoresTop.length > 0) {
      html += renderStoresHeroCarousel(featuredStoresTop);
    }

    if (featuredStoresBottom.length > 0) {
      html += renderFeaturedGrid(featuredStoresBottom);
    }

    html += renderLocationMapSection();

    html += '<div class="hc-search-wrap">' + SearchBar({ id: 'hc-search-stores', placeholder: 'Search', value: '' }) + '</div>';

    html += '<div id="hc-stores-grid" class="hc-merchant-grid">';
    cardlinked.forEach(function (m) {
      html += renderMerchantCard(m);
    });
    html += '</div>';

    if (cardlinked.length === 0 && featuredStoresTop.length === 0 && featuredStoresBottom.length === 0) {
      html += EmptyState({
        title: 'No Store Offers',
        subtitle: 'No in-store offers available right now.',
        iconChar: '🏪',
      });
    }

    html += '<div style="height:80px"></div>';
    html += '</div>';

    html +=
      '<div id="hc-tab-online" class="hc-tab-content"' +
      (activeTab !== 'online' ? ' style="display:none"' : '') +
      '>';

    html += '<div class="hc-screen-title">';
    html += ScreenTitle({
      title: 'Online offers',
      subtitle: 'Explore our marketplace of exclusive earnings',
    });
    html += '</div>';

    if (featuredOnlineTop.length > 0) {
      html += renderOnlineFeaturedCarousel(featuredOnlineTop, 'top');
    }

    if (featuredOnlineBottom.length > 0) {
      html += renderOnlineFeaturedCarousel(featuredOnlineBottom, 'bottom');
    }

    html += '<div class="hc-search-wrap">' + SearchBar({ id: 'hc-search-online', placeholder: 'Search', value: '' }) + '</div>';

    html += '<div id="hc-online-grid" class="hc-merchant-grid">';
    click.forEach(function (m) {
      html += renderMerchantCard(m);
    });
    html += '</div>';

    if (click.length === 0 && featuredOnlineTop.length === 0 && featuredOnlineBottom.length === 0) {
      html += EmptyState({
        title: 'No Online Offers',
        subtitle: 'No online offers available right now.',
        iconChar: '🌐',
      });
    }

    html += '<div style="height:80px"></div>';
    html += '</div>';

    container.innerHTML = html;

    var tabs = container.querySelectorAll('.hc-offers-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var targetTab = this.getAttribute('data-tab');
        tabs.forEach(function (t) {
          t.classList.remove('active');
        });
        this.classList.add('active');
        document.getElementById('hc-tab-stores').style.display = targetTab === 'stores' ? '' : 'none';
        document.getElementById('hc-tab-online').style.display = targetTab === 'online' ? '' : 'none';
      });
    });

    bindSearch('hc-search-stores', 'hc-stores-grid', cardlinked);
    bindSearch('hc-search-online', 'hc-online-grid', click);

    initOffersCarousels(container);
    var carouselTapDedupe = initOffersCarouselTapOpens(container);
    initOffersMap(container, cardlinked);

    container.addEventListener('click', async function (e) {
      var card = e.target.closest('[data-offer-id], [data-offer-type]');
      if (!card) return;
      if (carouselTapDedupe.card === card && Date.now() < carouselTapDedupe.until) {
        carouselTapDedupe.card = null;
        carouselTapDedupe.until = 0;
        return;
      }
      await handleOffersMarketplaceCardClick(card);
    });
  } catch (err) {
    container.innerHTML =
      '<div class="hc-alert-error">Failed to load offers: ' + escapeHtml(err.message) + '</div>';
  }
}

function buildFeaturedCardInner(f) {
  var oid = f.offer_id || f.id ? String(f.offer_id || f.id) : '';
  var html =
    '<div class="hc-featured-card"' +
    (oid ? ' data-offer-id="' + escapeAttr(oid) + '"' : '') +
    '>';
  html += '<div class="hc-featured-img-wrap">';
  if (f.large_logo_url) {
    html +=
      '<img class="hc-featured-img" draggable="false" src="' +
      escapeAttr(f.large_logo_url) +
      '" alt="' +
      escapeAttr(f.name) +
      '" />';
  } else {
    html += '<div class="hc-featured-img hc-featured-placeholder">' + escapeHtml(f.name) + '</div>';
  }
  html += '<div class="hc-featured-gradient" aria-hidden="true"></div>';
  html += '</div>';
  html += '<div class="hc-featured-footer">';
  if (f.small_logo_url) {
    html +=
      '<div class="hc-featured-logo"><img draggable="false" src="' +
      escapeAttr(f.small_logo_url) +
      '" width="30" height="30" alt="" /></div>';
  }
  html += '<div class="hc-featured-name">' + escapeHtml(f.name) + '</div>';
  html += '</div></div>';
  return html;
}

function renderStoresHeroCarousel(items) {
  if (!items.length) return '';
  var spacer = '<div class="hc-carousel-spacer" aria-hidden="true"></div>';
  var html = '<div class="hc-product-carousel-bleed hc-offers-hero-carousel">';
  html += '<div class="hc-carousel">';
  html += spacer;
  items.forEach(function (f) {
    html += '<div class="hc-carousel-slide">' + buildFeaturedCardInner(f) + '</div>';
  });
  html += spacer + '</div>';
  if (items.length > 1) {
    html += '<div class="hc-carousel-dots">';
    items.forEach(function (_, i) {
      html += '<span class="hc-carousel-dot' + (i === 0 ? ' active' : '') + '"></span>';
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderOnlineFeaturedCarousel(items, position) {
  if (!items.length) return '';
  var top = position === 'top';
  var w = top ? 340 : 220;
  var h = top ? 192 : 128;
  var spacer = '<div class="hc-carousel-spacer" aria-hidden="true"></div>';
  var html =
    '<div class="hc-online-carousel hc-online-carousel--' +
    position +
    ' hc-product-carousel-bleed" style="--hc-carousel-slide-w:' +
    w +
    'px;--hc-online-card-h:' +
    h +
    'px">';
  html += '<div class="hc-carousel">';
  html += spacer;
  items.forEach(function (f) {
    var oid = String(f.offer_id || f.id || '');
    html += '<div class="hc-carousel-slide">';
    html +=
      '<div class="hc-online-card" data-offer-id="' +
      escapeAttr(oid) +
      '">';
    if (f.large_logo_url) {
      html +=
        '<img class="hc-online-card-img" draggable="false" src="' +
        escapeAttr(f.large_logo_url) +
        '" alt="' +
        escapeAttr(f.name) +
        '" />';
    } else {
      html += '<div class="hc-online-card-placeholder">' + escapeHtml(f.name) + '</div>';
    }
    html += '</div></div>';
  });
  html += spacer + '</div></div>';
  return html;
}

function renderLocationMapSection() {
  return (
    '<div class="hc-offers-map-section">' +
    '<div id="hc-offers-location-prompt" class="hc-offers-location-card">' +
    '<p class="hc-offers-location-text">Enable location to discover nearby stores and exclusive local deals</p>' +
    '<button type="button" class="hc-offers-location-btn" id="hc-offers-enable-loc">Enable Location</button>' +
    '</div>' +
    '<div id="hc-offers-map-mount" class="hc-offers-map-mount" style="display:none" aria-label="Map"></div>' +
    '</div>'
  );
}

function initOffersCarouselTapOpens(container) {
  var dedupe = { card: null, until: 0 };
  var carousels = container.querySelectorAll(
    '.hc-offers-hero-carousel .hc-carousel, .hc-online-carousel .hc-carousel',
  );
  carousels.forEach(function (carousel) {
    var ptrDown = null;
    carousel.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      ptrDown = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
    });
    carousel.addEventListener('pointerup', function (e) {
      if (!ptrDown || e.pointerId !== ptrDown.id) return;
      var down = ptrDown;
      ptrDown = null;
      if (Math.abs(e.clientX - down.x) > 14 || Math.abs(e.clientY - down.y) > 14) return;
      if (Date.now() - down.t > 800) return;
      var slide = e.target && e.target.closest && e.target.closest('.hc-carousel-slide');
      if (!slide || !carousel.contains(slide)) return;
      var slideCard = slide.querySelector('[data-offer-id], [data-offer-type]');
      if (!slideCard) return;
      dedupe.card = slideCard;
      dedupe.until = Date.now() + 450;
      handleOffersMarketplaceCardClick(slideCard).catch(function () {});
    });
    carousel.addEventListener('pointercancel', function (e) {
      if (ptrDown && e.pointerId === ptrDown.id) ptrDown = null;
    });
  });
  return dedupe;
}

function initOffersCarousels(container) {
  container.querySelectorAll('.hc-carousel').forEach(function (carousel) {
    var dotsWrap = carousel.nextElementSibling;
    if (!dotsWrap || !dotsWrap.classList || !dotsWrap.classList.contains('hc-carousel-dots')) return;
    var dots = dotsWrap.querySelectorAll('.hc-carousel-dot');
    if (!dots.length) return;
    carousel.addEventListener('scroll', function () {
      var slides = carousel.querySelectorAll('.hc-carousel-slide');
      if (!slides.length) return;
      var cRect = carousel.getBoundingClientRect();
      var mid = cRect.left + cRect.width / 2;
      var best = 0;
      var bestDist = Infinity;
      slides.forEach(function (slide, i) {
        var r = slide.getBoundingClientRect();
        var sc = r.left + r.width / 2;
        var dist = Math.abs(sc - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      dots.forEach(function (d, i) {
        d.classList.toggle('active', i === best);
      });
    });
  });
}

function pickMerchantLatLng(m) {
  var la = m.latitude != null ? m.latitude : m.lat;
  var lo = m.longitude != null ? m.longitude : m.lng;
  if (la == null || lo == null) return null;
  var lat = Number(la);
  var lng = Number(lo);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: lat, lng: lng };
}

function milesBetween(lat1, lon1, lat2, lon2) {
  var R = 3959;
  var dLat = ((lat2 - lat1) * Math.PI) / 180;
  var dLon = ((lon2 - lon1) * Math.PI) / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function storeMapMerchantAddressDescription(m) {
  if (!m || typeof m !== 'object') return '';
  if (m.address) {
    return m.address + ', ' + m.city + ', ' + m.state;
  }
  if (m.city && m.state) return m.city + ', ' + m.state;
  return m.city || m.state || '';
}

function merchantDistanceMiles(m, userLat, userLng) {
  if (m != null && typeof m.distance === 'number' && Number.isFinite(m.distance)) {
    return m.distance;
  }
  var p = pickMerchantLatLng(m);
  if (!p || !Number.isFinite(userLat) || !Number.isFinite(userLng)) return NaN;
  return milesBetween(userLat, userLng, p.lat, p.lng);
}

function storeMapMerchantMapKitSubtitle(m, userLat, userLng) {
  var addr = storeMapMerchantAddressDescription(m).trim();
  var d = merchantDistanceMiles(m, userLat, userLng);
  if (addr && Number.isFinite(d)) {
    return addr + ' — ' + d.toFixed(1) + ' mi away';
  }
  if (addr) return addr;
  if (Number.isFinite(d)) return d.toFixed(1) + ' mi away';
  return '';
}

function computeMapKitRegionLikeStoreMap(userLat, userLng, merchantPoints) {
  var merchants = (merchantPoints || []).filter(function (pt) {
    return pt && Number.isFinite(pt.lat) && Number.isFinite(pt.lng);
  });
  if (Number.isFinite(userLat) && Number.isFinite(userLng) && merchants.length > 0) {
    var withDist = merchants.map(function (pt) {
      return {
        lat: pt.lat,
        lng: pt.lng,
        d: milesBetween(userLat, userLng, pt.lat, pt.lng),
      };
    });
    withDist.sort(function (a, b) {
      return a.d - b.d;
    });
    var closest = withDist.slice(0, 5);
    var lats = [userLat];
    var lngs = [userLng];
    closest.forEach(function (pt) {
      lats.push(pt.lat);
      lngs.push(pt.lng);
    });
    var minLat = Math.min.apply(null, lats);
    var maxLat = Math.max.apply(null, lats);
    var minLon = Math.min.apply(null, lngs);
    var maxLon = Math.max.apply(null, lngs);
    var centerLat = (minLat + maxLat) / 2;
    var centerLng = (minLon + maxLon) / 2;
    var deltaLat = Math.max((maxLat - minLat) * 1.4, 0.02);
    var deltaLon = Math.max((maxLon - minLon) * 1.4, 0.02);
    return { centerLat: centerLat, centerLng: centerLng, spanLat: deltaLat, spanLon: deltaLon };
  }
  if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
    return { centerLat: userLat, centerLng: userLng, spanLat: 0.05, spanLon: 0.05 };
  }
  if (merchants.length > 0) {
    var lats2 = merchants.map(function (p) {
      return p.lat;
    });
    var lngs2 = merchants.map(function (p) {
      return p.lng;
    });
    var minLa = Math.min.apply(null, lats2);
    var maxLa = Math.max.apply(null, lats2);
    var minLo = Math.min.apply(null, lngs2);
    var maxLo = Math.max.apply(null, lngs2);
    var cLat = (minLa + maxLa) / 2;
    var cLng = (minLo + maxLo) / 2;
    var dLa = Math.max((maxLa - minLa) * 1.3, 0.01);
    var dLo = Math.max((maxLo - minLo) * 1.3, 0.01);
    return { centerLat: cLat, centerLng: cLng, spanLat: dLa, spanLon: dLo };
  }
  return { centerLat: userLat, centerLng: userLng, spanLat: 0.06, spanLon: 0.06 };
}

var MAP_PIN_USER_COLOR = '#007AFF';
var MAP_PIN_MERCHANT_COLOR = '#AF52DE';

var OFFERS_LEAFLET_MAPLIBRE_STYLE = 'https://tiles.openfreemap.org/styles/positron';
var offersLeafletMapLibreLoadPromise = null;

function destroyOffersMapInstance(container) {
  restoreMapKitConsoleErrorHook(container);
  var h = container._hcMkFallbackHandler;
  if (h && window.mapkit && window.mapkit.removeEventListener) {
    try {
      window.mapkit.removeEventListener('error', h);
      window.mapkit.removeEventListener('configuration-error', h);
    } catch (e) {}
  }
  container._hcMkFallbackHandler = null;
  var mk = container._hcMkMap;
  if (mk && typeof mk.destroy === 'function') {
    try {
      mk.destroy();
    } catch (e) {}
  }
  container._hcMkMap = null;
  var lf = container._hcLeafletMap;
  if (lf && typeof lf.remove === 'function') {
    try {
      lf.remove();
    } catch (e2) {}
  }
  container._hcLeafletMap = null;
}

function leafletMapPinIcon(L, fillHex) {
  var html =
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42" aria-hidden="true">' +
    '<path fill="' +
    fillHex +
    '" d="M16 0C7.2 0 0 7.2 0 16c0 11 16 26 16 26s16-15 16-26C32 7.2 24.8 0 16 0zm0 22a6 6 0 110-12 6 6 0 010 12z"/>' +
    '</svg>';
  return L.divIcon({
    className: 'hc-map-pin-icon',
    html: html,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
  });
}

function offersMapLinkOnce(href, id) {
  if (document.querySelector('link[data-hc-offers-map="' + id + '"]')) return;
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute('data-hc-offers-map', id);
  document.head.appendChild(link);
}

function offersLoadScriptSequential(urls, index, done, err) {
  if (index >= urls.length) {
    done();
    return;
  }
  var s = document.createElement('script');
  s.src = urls[index];
  s.onload = function () {
    offersLoadScriptSequential(urls, index + 1, done, err);
  };
  s.onerror = function () {
    err(new Error('Failed to load script: ' + urls[index]));
  };
  document.body.appendChild(s);
}

function ensureLeafletMapLibreGl() {
  if (window.L && window.maplibregl && typeof window.L.maplibreGL === 'function') {
    return Promise.resolve(window.L);
  }
  if (offersLeafletMapLibreLoadPromise) return offersLeafletMapLibreLoadPromise;

  offersLeafletMapLibreLoadPromise = new Promise(function (resolve, reject) {
    offersMapLinkOnce('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'leaflet');
    offersMapLinkOnce('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css', 'maplibre-gl');

    var urls = [];
    if (!window.L) {
      urls.push('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    }
    if (!window.maplibregl) {
      urls.push('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js');
    }
    if (!window.L || typeof window.L.maplibreGL !== 'function') {
      urls.push('https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.0/leaflet-maplibre-gl.js');
    }

    if (urls.length === 0) {
      resolve(window.L);
      return;
    }

    offersLoadScriptSequential(
      urls,
      0,
      function () {
        if (window.L && window.maplibregl && typeof window.L.maplibreGL === 'function') {
          resolve(window.L);
        } else {
          reject(new Error('MapLibre GL Leaflet is not available'));
        }
      },
      reject,
    );
  }).catch(function (e) {
    offersLeafletMapLibreLoadPromise = null;
    throw e;
  });

  return offersLeafletMapLibreLoadPromise;
}

function tokenLooksLikeMapKitJwt(t) {
  if (!t || typeof t !== 'string') return false;
  var parts = t.split('.');
  return parts.length === 3 && parts[0].length > 0 && parts[1].length > 0 && parts[2].length > 0;
}

function mapKitConfigurationErrorStatusMeansFallback(st) {
  if (st == null) return false;
  var s = String(st);
  return (
    s === 'Unauthorized' ||
    s === 'Bad Request' ||
    s === 'Too Many Requests' ||
    s === 'Malformed Response' ||
    s === 'Timeout' ||
    s === 'Network Error'
  );
}

function mapKitErrorEventBlob(ev) {
  var parts = [];
  if (ev && ev.status != null) parts.push(String(ev.status));
  if (ev && ev.message) parts.push(String(ev.message));
  if (typeof ev === 'string') parts.push(ev);
  if (ev && ev.reason != null) parts.push(String(ev.reason));
  if (ev && ev.detail != null) {
    try {
      parts.push(typeof ev.detail === 'string' ? ev.detail : JSON.stringify(ev.detail));
    } catch (e) {
      parts.push(String(ev.detail));
    }
  }
  if (ev && ev.error != null) {
    try {
      parts.push(ev.error && ev.error.message ? String(ev.error.message) : String(ev.error));
    } catch (e2) {
      parts.push('error');
    }
  }
  return parts.join(' ').toLowerCase();
}

function mapKitConsoleErrorImpliesTokenFailure(text) {
  var low = String(text).toLowerCase();
  if (low.indexOf('mapkit') < 0) return false;
  return (
    low.indexOf('initialization failed') >= 0 ||
    low.indexOf('authorization token is invalid') >= 0 ||
    (low.indexOf('authorization') >= 0 && low.indexOf('invalid') >= 0 && low.indexOf('token') >= 0)
  );
}

function mapKitErrorShouldFallbackToOsm(ev) {
  if (ev && mapKitConfigurationErrorStatusMeansFallback(ev.status)) return true;
  var blob = mapKitErrorEventBlob(ev);
  return (
    blob.indexOf('too many') >= 0 ||
    blob.indexOf('429') >= 0 ||
    blob.indexOf('quota') >= 0 ||
    blob.indexOf('rate limit') >= 0 ||
    blob.indexOf('unauthorized') >= 0 ||
    blob.indexOf('authorization') >= 0 ||
    (blob.indexOf('invalid') >= 0 && blob.indexOf('token') >= 0) ||
    blob.indexOf('invalid token') >= 0 ||
    blob.indexOf('initialization failed') >= 0 ||
    blob.indexOf('jwt') >= 0 ||
    blob.indexOf('signature') >= 0 ||
    blob.indexOf('expired') >= 0
  );
}

function joinConsoleErrorArgs(args) {
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

function installMapKitConsoleErrorFallback(container, onMatch) {
  if (container._hcMkConsoleErrorRestore) {
    try {
      container._hcMkConsoleErrorRestore();
    } catch (e) {}
    container._hcMkConsoleErrorRestore = null;
  }
  var prev = console.error;
  function wrapped() {
    var joined = joinConsoleErrorArgs(arguments);
    if (mapKitConsoleErrorImpliesTokenFailure(joined)) {
      onMatch({ message: joined });
    }
    return prev.apply(console, arguments);
  }
  console.error = wrapped;
  container._hcMkConsoleErrorRestore = function () {
    if (console.error === wrapped) {
      console.error = prev;
    }
    container._hcMkConsoleErrorRestore = null;
  };
}

function restoreMapKitConsoleErrorHook(container) {
  if (container._hcMkConsoleErrorRestore) {
    try {
      container._hcMkConsoleErrorRestore();
    } catch (e) {}
    container._hcMkConsoleErrorRestore = null;
  }
}

function renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData) {
  ensureLeafletMapLibreGl()
    .then(function (L) {
      destroyOffersMapInstance(container);
      mapMount.innerHTML = '';
      mapMount.classList.remove('hc-offers-map-loading');
      mapMount.removeAttribute('aria-busy');
      mapMount.classList.add('hc-offers-map-osm-fallback');
      var map = L.map(mapMount).setView([userLat, userLng], 12);
      container._hcLeafletMap = map;
      L.maplibreGL({
        style: OFFERS_LEAFLET_MAPLIBRE_STYLE,
      }).addTo(map);

      var userIcon = leafletMapPinIcon(L, MAP_PIN_USER_COLOR);
      var merchantIcon = leafletMapPinIcon(L, MAP_PIN_MERCHANT_COLOR);
      var userMarker = L.marker([userLat, userLng], {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(map);
      userMarker.bindPopup('<strong>' + escapeHtml('Your Location') + '</strong>');

      var merchantLayers = [];
      merchantMarkerData.forEach(function (mk) {
        var title = (mk.name || '').trim() || 'Partner store';
        var sub = (mk.subtitle || '').trim();
        var body =
          '<strong>' +
          escapeHtml(title) +
          '</strong>' +
          (sub ? '<br/>' + escapeHtml(sub).replace(/\n/g, '<br/>') : '');
        var marker = L.marker([mk.lat, mk.lng], { icon: merchantIcon }).addTo(map);
        marker.bindPopup(body);
        merchantLayers.push(marker);
      });

      var boundsGroup = [userMarker].concat(merchantLayers);
      if (merchantLayers.length > 0) {
        map.fitBounds(L.featureGroup(boundsGroup).getBounds().pad(0.2));
      } else {
        map.setView([userLat, userLng], 13);
      }
      window.setTimeout(function () {
        map.invalidateSize();
      }, 100);
    })
    .catch(function () {
      destroyOffersMapInstance(container);
      mapMount.classList.remove('hc-offers-map-loading');
      mapMount.removeAttribute('aria-busy');
      mapMount.innerHTML =
        '<div class="hc-offers-map-unavailable">' +
        escapeHtml('Map could not be loaded. Please try again later.') +
        '</div>';
    });
}

function whenOffersMapMountLaidOut(mapMount, cb) {
  var frames = 0;
  function tick() {
    frames++;
    var w = mapMount.clientWidth;
    var h = mapMount.clientHeight;
    if ((w >= 32 && h >= 32) || frames > 120) {
      console.log('[HC offers map] mount layout:', w, 'x', h, 'frames', frames);
      cb();
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(function () {
    requestAnimationFrame(tick);
  });
}

function scheduleMapKitTileReflow(map) {
  function nudge() {
    window.dispatchEvent(new Event('resize'));
    try {
      if (map && map.region) {
        var r = map.region;
        map.region = r;
      }
    } catch (e) {}
  }
  nudge();
  window.setTimeout(nudge, 50);
  window.setTimeout(nudge, 200);
  window.setTimeout(nudge, 500);
}

function offersMapAnnotationCalloutDelegate() {
  return {
    calloutContentForAnnotation: function (annotation) {
      var wrap = document.createElement('div');
      wrap.className = 'hc-mk-callout-inner';
      wrap.style.padding = '10px 12px';
      wrap.style.minWidth = '200px';
      wrap.style.maxWidth = '280px';
      wrap.style.boxSizing = 'border-box';
      wrap.style.fontFamily =
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      var t = annotation.title != null ? String(annotation.title) : '';
      var st = annotation.subtitle != null ? String(annotation.subtitle) : '';
      var h = document.createElement('div');
      h.textContent = t;
      h.style.fontWeight = '700';
      h.style.fontSize = '15px';
      h.style.color = '#1d1d1f';
      h.style.marginBottom = st ? '6px' : '0';
      wrap.appendChild(h);
      if (st) {
        var s = document.createElement('div');
        s.textContent = st;
        s.style.fontSize = '12px';
        s.style.color = '#3c3c43';
        s.style.lineHeight = '1.4';
        s.style.wordBreak = 'break-word';
        wrap.appendChild(s);
      }
      return wrap;
    },
  };
}

function renderMapWithMapKit(container, mapMount, mapkit, userLat, userLng, merchantMarkerData) {
  if (mapKitAuthFailureWasReported()) {
    console.warn('[HC offers map] MapKit auth failure before render, using OpenStreetMap fallback');
    renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData);
    return;
  }
  console.log('[HC offers map] renderMapWithMapKit center', userLat, userLng, 'pins', merchantMarkerData.length);
  destroyOffersMapInstance(container);
  mapMount.innerHTML = '';
  mapMount.classList.remove('hc-offers-map-loading');
  mapMount.removeAttribute('aria-busy');

  var Coord = mapkit.Coordinate;
  var Region = mapkit.CoordinateRegion;
  var Span = mapkit.CoordinateSpan;
  var Mai = mapkit.MarkerAnnotation;

  var calloutDel = offersMapAnnotationCalloutDelegate();

  var userCoord = new Coord(userLat, userLng);
  var annotations = [
    new Mai(userCoord, {
      title: 'Your Location',
      color: MAP_PIN_USER_COLOR,
      calloutEnabled: true,
      titleVisibility: 'hidden',
      callout: calloutDel,
    }),
  ];

  merchantMarkerData.forEach(function (mk) {
    var label = (mk.name || '').trim() || 'Partner store';
    var sub = (mk.subtitle || '').trim();
    annotations.push(
      new Mai(new Coord(mk.lat, mk.lng), {
        title: label,
        subtitle: sub,
        color: MAP_PIN_MERCHANT_COLOR,
        calloutEnabled: true,
        titleVisibility: 'hidden',
        subtitleVisibility: 'hidden',
        callout: calloutDel,
      }),
    );
  });

  var regionBox = computeMapKitRegionLikeStoreMap(userLat, userLng, merchantMarkerData);
  var mapCenterCoord = new Coord(regionBox.centerLat, regionBox.centerLng);
  var startSpan = new Span(regionBox.spanLat, regionBox.spanLon);
  var M = mapkit.Map;

  function createMapAndAnnotations() {
    if (mapKitAuthFailureWasReported()) {
      console.warn('[HC offers map] MapKit auth failure detected, using OpenStreetMap fallback');
      renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData);
      return;
    }
    var mapOpts = {
      region: new Region(mapCenterCoord, startSpan),
      mapType: 'standard',
      colorScheme: 'light',
      showsZoomControl: true,
      showsMapTypeControl: false,
      showsPointsOfInterest: true,
    };
    if (M && M.LoadPriorities && M.LoadPriorities.PointsOfInterest != null) {
      mapOpts.loadPriority = M.LoadPriorities.PointsOfInterest;
    }
    var map;

    function cleanupMapKitFallbackListeners() {
      restoreMapKitConsoleErrorHook(container);
      container._hcMkFallbackHandler = null;
      try {
        if (window.mapkit && window.mapkit.removeEventListener) {
          window.mapkit.removeEventListener('error', onMapKitFallbackTrigger);
          window.mapkit.removeEventListener('configuration-error', onMapKitFallbackTrigger);
        }
      } catch (e) {}
      try {
        if (map && map.removeEventListener) {
          map.removeEventListener('error', onMapKitFallbackTrigger);
        }
      } catch (e2) {}
    }

    function onMapKitFallbackTrigger(ev) {
      if (container._hcOsmFallbackDone) return;
      if (!mapKitErrorShouldFallbackToOsm(ev)) return;
      container._hcOsmFallbackDone = true;
      console.warn('[HC offers map] MapKit error, switching to OpenStreetMap', ev && ev.status, ev && ev.message);
      cleanupMapKitFallbackListeners();
      try {
        if (map && typeof map.destroy === 'function') {
          map.destroy();
        }
      } catch (e3) {}
      container._hcMkMap = null;
      renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData);
    }

    container._hcMkFallbackHandler = onMapKitFallbackTrigger;
    if (window.mapkit && window.mapkit.addEventListener) {
      window.mapkit.addEventListener('error', onMapKitFallbackTrigger);
      window.mapkit.addEventListener('configuration-error', onMapKitFallbackTrigger);
    }
    installMapKitConsoleErrorFallback(container, onMapKitFallbackTrigger);

    console.log(
      '[HC offers map] new Map',
      'colorScheme=' + mapOpts.colorScheme,
      'loadPriority=' + (mapOpts.loadPriority != null ? mapOpts.loadPriority : 'default'),
    );
    try {
      map = new mapkit.Map(mapMount, mapOpts);
    } catch (e) {
      console.error('[HC offers map] new Map failed', e);
      cleanupMapKitFallbackListeners();
      renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData);
      return;
    }
    container._hcMkMap = map;
    try {
      map.addEventListener('error', onMapKitFallbackTrigger);
    } catch (e4) {}
    map.addAnnotations(annotations);
    console.log('[HC offers map] annotations:', annotations.length);
    scheduleMapKitTileReflow(map);
  }

  whenOffersMapMountLaidOut(mapMount, createMapAndAnnotations);
}

function initOffersMap(container, cardlinked) {
  var promptEl = container.querySelector('#hc-offers-location-prompt');
  var mapMount = container.querySelector('#hc-offers-map-mount');
  var btn = container.querySelector('#hc-offers-enable-loc');
  if (!mapMount || !promptEl) return;

  container._hcCardlinkedStores = Array.isArray(cardlinked) ? cardlinked : [];

  function showMapMountUnavailable(message) {
    console.warn('[HC offers map] unavailable:', message || '');
    destroyOffersMapInstance(container);
    mapMount.classList.remove('hc-offers-map-loading');
    mapMount.classList.remove('hc-offers-map-osm-fallback');
    mapMount.removeAttribute('aria-busy');
    mapMount.innerHTML =
      '<div class="hc-offers-map-unavailable">' + escapeHtml(message || 'Map could not be loaded.') + '</div>';
  }

  function showMapUI() {
    promptEl.style.display = 'none';
    mapMount.style.display = '';
  }

  function showPromptUI() {
    promptEl.style.display = '';
    mapMount.style.display = 'none';
    mapMount.classList.remove('hc-offers-map-loading');
    mapMount.classList.remove('hc-offers-map-osm-fallback');
    mapMount.removeAttribute('aria-busy');
    mapMount.innerHTML = '';
  }

  function renderMap(userLat, userLng) {
    var merchants = Array.isArray(container._hcCardlinkedStores) ? container._hcCardlinkedStores : [];
    var merchantMarkerData = [];
    merchants.forEach(function (m) {
      var p = pickMerchantLatLng(m);
      if (p) {
        merchantMarkerData.push({
          lat: p.lat,
          lng: p.lng,
          name: m.name || m.merchantName || '',
          subtitle: storeMapMerchantMapKitSubtitle(m, userLat, userLng),
        });
      }
    });

    mapMount.classList.add('hc-offers-map-loading');
    mapMount.setAttribute('aria-busy', 'true');
    mapMount.innerHTML = '<div class="hc-offers-map-skeleton"></div>';

    console.log('[HC offers map] renderMap start', userLat, userLng, 'merchant pins', merchantMarkerData.length);
    container._hcOsmFallbackDone = false;
    resolveMapKitTokenAsync().then(function (mkToken) {
      if (!mkToken) {
        console.warn('[HC offers map] no MapKit token, using OpenStreetMap fallback');
        renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData);
        return;
      }
      if (!tokenLooksLikeMapKitJwt(mkToken)) {
        console.warn('[HC offers map] token is not a JWT, using OpenStreetMap fallback');
        renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData);
        return;
      }
      ensureMapKitLoaded(mkToken)
        .then(function (mapkit) {
          if (mapKitAuthFailureWasReported()) {
            console.warn('[HC offers map] MapKit reported invalid token, using OpenStreetMap fallback');
            renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData);
            return;
          }
          try {
            renderMapWithMapKit(container, mapMount, mapkit, userLat, userLng, merchantMarkerData);
          } catch (e) {
            console.error('[HC offers map] renderMapWithMapKit threw', e);
            renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData);
          }
        })
        .catch(function (err) {
          console.error('[HC offers map] ensureMapKitLoaded failed', err);
          renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData);
        });
    });
  }

  function applyStoredLocation() {
    try {
      var raw = sessionStorage.getItem(OFFER_LOC_KEY);
      if (!raw) {
        showPromptUI();
        return;
      }
      var o = JSON.parse(raw);
      if (o && o.lat != null && o.lng != null) {
        showMapUI();
        renderMap(Number(o.lat), Number(o.lng));
      } else {
        showPromptUI();
      }
    } catch (e) {
      showPromptUI();
    }
  }

  applyStoredLocation();

  if (btn) {
    btn.addEventListener('click', function () {
      if (!navigator.geolocation) {
        return;
      }
      btn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        async function (pos) {
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          sessionStorage.setItem(OFFER_LOC_KEY, JSON.stringify({ lat: lat, lng: lng }));
          try {
            var raw = await api.getOffers(1, 50, { latitude: lat, longitude: lng });
            var list = raw.cardlinked || raw.results || (Array.isArray(raw) ? raw : []);
            container._hcCardlinkedStores = list;
            var grid = document.getElementById('hc-stores-grid');
            if (grid) {
              var gridHtml = '';
              list.forEach(function (m) {
                gridHtml += renderMerchantCard(m);
              });
              grid.innerHTML = gridHtml;
            }
            bindSearch('hc-search-stores', 'hc-stores-grid', list);
          } catch (e) {}
          btn.disabled = false;
          showMapUI();
          renderMap(lat, lng);
        },
        function () {
          btn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    });
  }
}

function bindSearch(inputId, gridId, allMerchants) {
  var input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', function () {
    var q = this.value.toLowerCase().trim();
    var grid = document.getElementById(gridId);
    if (!q) {
      grid.innerHTML = '';
      allMerchants.forEach(function (m) {
        grid.innerHTML += renderMerchantCard(m);
      });
      return;
    }
    var filtered = allMerchants.filter(function (m) {
      var name = (m.name || m.merchantName || '').toLowerCase();
      if (name.indexOf(q) >= 0) return true;
      if (m.tags && Array.isArray(m.tags)) {
        return m.tags.some(function (t) {
          return t.toLowerCase().indexOf(q) >= 0;
        });
      }
      return false;
    });
    grid.innerHTML = '';
    if (filtered.length === 0) {
      grid.innerHTML =
        '<div class="hc-search-empty" style="grid-column:1/-1;text-align:center;padding:40px;color:#999;">No results for "' +
        escapeHtml(q) +
        '"</div>';
    } else {
      filtered.forEach(function (m) {
        grid.innerHTML += renderMerchantCard(m);
      });
    }
  });
}

function renderFeaturedGrid(items) {
  var html = '<div class="hc-featured-grid">';
  items.forEach(function (f) {
    var gridOid = f.offer_id || f.id ? String(f.offer_id || f.id) : '';
    html +=
      '<div class="hc-featured-grid-item"' +
      (gridOid ? ' data-offer-id="' + escapeAttr(gridOid) + '"' : '') +
      '>';
    html += '<div class="hc-featured-grid-row">';
    if (f.small_logo_url) {
      html +=
        '<img class="hc-featured-grid-logo" draggable="false" src="' +
        escapeAttr(f.small_logo_url) +
        '" alt="' +
        escapeAttr(f.name) +
        '" />';
    } else {
      var initials = (f.name || '')
        .split(' ')
        .map(function (w) {
          return w[0] || '';
        })
        .join('')
        .slice(0, 2)
        .toUpperCase();
      html += '<div class="hc-featured-grid-initials">' + escapeHtml(initials) + '</div>';
    }
    html += '<div class="hc-featured-grid-name">' + escapeHtml(f.name) + '</div>';
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

function renderMerchantCard(merchant) {
  var logoUrl = merchant.logoUrl || merchant.logo || '';
  var name = merchant.name || merchant.merchantName || 'Unknown';
  var location = '';
  if (merchant.isOnline || merchant.reach === 'online_only') {
    location = 'Online Store';
  } else if (merchant.city && merchant.state) {
    location = merchant.city + ', ' + merchant.state;
  }
  var offerType = merchant.offerSource === 'wildfire' || merchant.wildfireMerchantId ? 'wildfire' : 'olive';
  var detailId = offerType === 'olive' && merchant.offerId ? String(merchant.offerId) : '';
  var wildfireId = merchant.wildfireMerchantId || '';
  var html =
    '<div class="hc-merchant-card"' +
    (detailId ? ' data-offer-id="' + escapeAttr(detailId) + '"' : '') +
    ' data-offer-type="' +
    offerType +
    '"' +
    (wildfireId ? ' data-merchant-id="' + escapeAttr(String(wildfireId)) + '"' : '') +
    ' data-merchant="' +
    escapeAttr(
      JSON.stringify({
        name: name,
        logoUrl: logoUrl,
        location: location,
        website: merchant.website || '',
        isOnline: !!(merchant.isOnline || merchant.reach === 'online_only'),
        cashback: merchant.cashback || merchant.points || '',
      }),
    ) +
    '">';
  if (logoUrl) {
    html +=
      '<div class="hc-merchant-img-wrap"><img class="hc-merchant-img" src="' +
      escapeAttr(logoUrl) +
      '" alt="' +
      escapeAttr(name) +
      '" /></div>';
  } else {
    var initials = name
      .split(' ')
      .map(function (w) {
        return w[0] || '';
      })
      .join('')
      .slice(0, 2)
      .toUpperCase();
    html +=
      '<div class="hc-merchant-img-wrap"><div class="hc-merchant-initials">' +
      escapeHtml(initials) +
      '</div></div>';
  }
  html += '<div class="hc-merchant-card-info">';
  if (location) {
    html += '<div class="hc-merchant-location">' + escapeHtml(location) + '</div>';
  }
  html += '</div></div>';
  return html;
}

async function handleOffersMarketplaceCardClick(card) {
  if (!card) return;
  var offerId = card.getAttribute('data-offer-id');
  var offerType = card.getAttribute('data-offer-type');

  if (offerId && card.classList.contains('hc-online-card')) {
    try {
      var trackResult = await api.trackOfferClick(offerId).catch(function () {
        return null;
      });
      var trackUrl = trackResult && (trackResult.tracking_url || trackResult.trackingUrl);
      if (trackUrl) {
        if (trackUrl.indexOf('http') !== 0) trackUrl = 'https://' + trackUrl;
        openExternalUrl(trackUrl);
        return;
      }
    } catch (err) {}
    window.location.hash = '#/offers/' + offerId;
    return;
  }

  if (offerId && offerType !== 'wildfire') {
    window.location.hash = '#/offers/' + offerId;
    return;
  }

  var merchantId = card.getAttribute('data-merchant-id');
  if (merchantId) {
    try {
      var trackResult = await api.trackWildfireClick(merchantId);
      var trackUrl = trackResult && (trackResult.tracking_url || trackResult.website);
      if (trackUrl) {
        if (trackUrl.indexOf('http') !== 0) trackUrl = 'https://' + trackUrl;
        openExternalUrl(trackUrl);
        return;
      }
    } catch (err) {}
  }
  try {
    var merchantAttr = card.getAttribute('data-merchant');
    if (merchantAttr) {
      var merchantData = JSON.parse(merchantAttr);
      var url = merchantData.website;
      if (url) {
        if (url.indexOf('http') !== 0) url = 'https://' + url;
        openExternalUrl(url);
      }
    }
  } catch (err) {}
}

function openExternalUrl(url) {
  postToNative('homecrowd:open-url', { url: url });
  showWebviewOverlay(url);
}
