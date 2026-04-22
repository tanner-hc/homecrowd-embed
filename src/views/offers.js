import * as api from '../api.js';
import { postToNative } from '../bridge.js';
import { showWebviewOverlay } from '../webview-overlay.js';

var _userLocation = null;

export function renderOffers(container) {
  container.innerHTML = '<div class="hc-spinner"></div>';

  // Try to get location silently first, then load
  if (navigator.geolocation && navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' }).then(function (result) {
      if (result.state === 'granted') {
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            _userLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            loadOffers(container, 'stores');
          },
          function () { loadOffers(container, 'stores'); }
        );
      } else {
        loadOffers(container, 'stores');
      }
    }).catch(function () { loadOffers(container, 'stores'); });
  } else {
    loadOffers(container, 'stores');
  }
}

async function loadOffers(container, activeTab) {
  try {
    var lat = _userLocation ? _userLocation.latitude : null;
    var lng = _userLocation ? _userLocation.longitude : null;

    var results = await Promise.all([
      api.getOffers(1, 50, lat, lng).catch(function () { return {}; }),
      api.getWildfireOffers(1, 50).catch(function () { return {}; }),
      api.getFeaturedOffers('card_linked').catch(function () { return []; }),
      api.getFeaturedOffers('click').catch(function () { return []; }),
    ]);

    var cardlinkedRaw = results[0];
    var clickRaw = results[1];
    var featuredStoresRaw = results[2];
    var featuredOnlineRaw = results[3];

    var cardlinked = cardlinkedRaw.cardlinked || cardlinkedRaw.results || (Array.isArray(cardlinkedRaw) ? cardlinkedRaw : []);
    var click = clickRaw.click || clickRaw.results || (Array.isArray(clickRaw) ? clickRaw : []);
    var allFeaturedStores = Array.isArray(featuredStoresRaw) ? featuredStoresRaw : featuredStoresRaw.results || [];
    var allFeaturedOnline = Array.isArray(featuredOnlineRaw) ? featuredOnlineRaw : featuredOnlineRaw.results || [];

    var featuredStoresTop = allFeaturedStores.filter(function (f) { return f.is_active && f.top_featured; });
    var featuredStoresBottom = allFeaturedStores.filter(function (f) { return f.is_active && f.bottom_featured; });
    var featuredOnlineTop = allFeaturedOnline.filter(function (f) { return f.is_active && f.top_featured; });
    var featuredOnlineBottom = allFeaturedOnline.filter(function (f) { return f.is_active && f.bottom_featured; });

    var html = '';

    // Tab bar
    html += '<div class="hc-offers-tabs">';
    html += '<button class="hc-offers-tab' + (activeTab === 'stores' ? ' active' : '') + '" data-tab="stores">Stores</button>';
    html += '<button class="hc-offers-tab' + (activeTab === 'online' ? ' active' : '') + '" data-tab="online">Online</button>';
    html += '</div>';

    // === STORES TAB ===
    html += '<div id="hc-tab-stores" class="hc-tab-content"' + (activeTab !== 'stores' ? ' style="display:none"' : '') + '>';

    // Title
    html += '<div class="hc-screen-title">';
    html += '<div class="hc-screen-title-text">Partner stores</div>';
    html += '<div class="hc-screen-title-subtitle">Earn on every purchase at these stores</div>';
    html += '</div>';

    // Featured top slider
    if (featuredStoresTop.length > 0) {
      html += renderFeaturedSlider(featuredStoresTop);
    }

    // Featured bottom grid
    if (featuredStoresBottom.length > 0) {
      html += renderFeaturedGrid(featuredStoresBottom);
    }

    // Store map — show map if stores have coords, always show enable location button below if location not granted
    var storesWithCoords = cardlinked.filter(function (m) { return m.latitude && m.longitude; });
    html += '<div id="hc-store-map-container">';
    if (storesWithCoords.length > 0) {
      html += '<div id="hc-store-map" class="hc-store-map"></div>';
    }
    html += '<div id="hc-enable-location" class="hc-enable-location">';
    html += '<div class="hc-enable-location-text">Enable location to discover nearby stores</div>';
    html += '<button id="hc-enable-location-btn" class="hc-btn hc-btn-primary" style="width:auto;min-height:40px;padding:8px 24px;font-size:14px;">Enable Location</button>';
    html += '</div>';
    html += '</div>';

    // Search bar
    html += '<div class="hc-search-wrap"><input id="hc-search-stores" class="hc-search-input" type="text" placeholder="Search" /></div>';

    // Merchant grid
    html += '<div id="hc-stores-grid" class="hc-merchant-grid">';
    cardlinked.forEach(function (m) { html += renderMerchantCard(m); });
    html += '</div>';

    if (cardlinked.length === 0 && featuredStoresTop.length === 0 && featuredStoresBottom.length === 0) {
      html += '<div class="hc-empty"><div class="hc-empty-title">No Store Offers</div><div class="hc-empty-text">No in-store offers available right now.</div></div>';
    }

    html += '<div style="height:80px"></div>';
    html += '</div>';

    // === ONLINE TAB ===
    html += '<div id="hc-tab-online" class="hc-tab-content"' + (activeTab !== 'online' ? ' style="display:none"' : '') + '>';

    // Title
    html += '<div class="hc-screen-title">';
    html += '<div class="hc-screen-title-text">Online offers</div>';
    html += '<div class="hc-screen-title-subtitle">Shop online and earn rewards</div>';
    html += '</div>';

    // Featured top slider
    if (featuredOnlineTop.length > 0) {
      html += renderFeaturedSlider(featuredOnlineTop);
    }

    // Featured bottom slider (smaller)
    if (featuredOnlineBottom.length > 0) {
      html += renderFeaturedSliderSmall(featuredOnlineBottom);
    }

    // Search bar
    html += '<div class="hc-search-wrap"><input id="hc-search-online" class="hc-search-input" type="text" placeholder="Search" /></div>';

    // Merchant grid
    html += '<div id="hc-online-grid" class="hc-merchant-grid">';
    click.forEach(function (m) { html += renderMerchantCard(m); });
    html += '</div>';

    if (click.length === 0 && featuredOnlineTop.length === 0 && featuredOnlineBottom.length === 0) {
      html += '<div class="hc-empty"><div class="hc-empty-title">No Online Offers</div><div class="hc-empty-text">No online offers available right now.</div></div>';
    }

    html += '<div style="height:80px"></div>';
    html += '</div>';

    // Toast
    html += '<div id="hc-toast" class="hc-toast" style="display:none"></div>';

    container.innerHTML = html;

    // Tab switching
    var tabs = container.querySelectorAll('.hc-offers-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var targetTab = this.getAttribute('data-tab');
        tabs.forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');
        document.getElementById('hc-tab-stores').style.display = targetTab === 'stores' ? '' : 'none';
        document.getElementById('hc-tab-online').style.display = targetTab === 'online' ? '' : 'none';
      });
    });

    // Initialize store map and location prompt
    var enableLocEl = document.getElementById('hc-enable-location');
    var enableLocBtn = document.getElementById('hc-enable-location-btn');

    // Hide location prompt if we already have location
    if (_userLocation) {
      if (enableLocEl) enableLocEl.style.display = 'none';
    } else if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(function (result) {
        if (result.state === 'granted') {
          if (enableLocEl) enableLocEl.style.display = 'none';
        }
      }).catch(function () {});
    }

    initStoreMap(storesWithCoords, _userLocation);

    if (enableLocBtn) {
      enableLocBtn.addEventListener('click', function () {
        if (!navigator.geolocation) return;
        enableLocBtn.textContent = 'Locating...';
        enableLocBtn.disabled = true;
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            _userLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            // Reload entire offers view with location data
            container.innerHTML = '<div class="hc-spinner"></div>';
            loadOffers(container, activeTab);
          },
          function () {
            enableLocBtn.textContent = 'Enable Location';
            enableLocBtn.disabled = false;
          }
        );
      });
    }

    // Search filtering
    bindSearch('hc-search-stores', 'hc-stores-grid', cardlinked);
    bindSearch('hc-search-online', 'hc-online-grid', click);

    // Merchant/featured card clicks
    container.addEventListener('click', async function (e) {
      var card = e.target.closest('[data-offer-id], [data-offer-type]');
      if (!card) return;
      var offerId = card.getAttribute('data-offer-id');
      var offerType = card.getAttribute('data-offer-type');

      // If we have a valid olive offer ID, go to detail page
      if (offerId && offerType !== 'wildfire') {
        window.location.hash = '#/offers/' + offerId;
        return;
      }

      // Wildfire offers — track click to get wildlink, then open
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
        } catch (err) {
          // Fall back to website
        }
      }
      // Fallback — open raw website
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
    });
  } catch (err) {
    container.innerHTML = '<div class="hc-alert-error">Failed to load offers: ' + escapeHtml(err.message) + '</div>';
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
      allMerchants.forEach(function (m) { grid.innerHTML += renderMerchantCard(m); });
      return;
    }
    var filtered = allMerchants.filter(function (m) {
      var name = (m.name || m.merchantName || '').toLowerCase();
      if (name.indexOf(q) >= 0) return true;
      if (m.tags && Array.isArray(m.tags)) {
        return m.tags.some(function (t) { return t.toLowerCase().indexOf(q) >= 0; });
      }
      return false;
    });
    grid.innerHTML = '';
    if (filtered.length === 0) {
      grid.innerHTML = '<div class="hc-search-empty" style="grid-column:1/-1;text-align:center;padding:40px;color:#999;">No results for "' + escapeHtml(q) + '"</div>';
    } else {
      filtered.forEach(function (m) { grid.innerHTML += renderMerchantCard(m); });
    }
  });
}

function renderFeaturedSlider(items) {
  var html = '<div class="hc-featured-slider">';
  items.forEach(function (f) {
    html += '<div class="hc-featured-card"' + (f.offer_id ? ' data-offer-id="' + escapeAttr(String(f.offer_id)) + '"' : '') + '>';
    if (f.large_logo_url) {
      html += '<img class="hc-featured-img" src="' + escapeAttr(f.large_logo_url) + '" alt="' + escapeAttr(f.name) + '" />';
    } else {
      html += '<div class="hc-featured-img hc-featured-placeholder">' + escapeHtml(f.name) + '</div>';
    }
    if (f.small_logo_url) {
      html += '<div class="hc-featured-logo"><img src="' + escapeAttr(f.small_logo_url) + '" width="30" height="30" alt="" /></div>';
    }
    html += '<div class="hc-featured-name">' + escapeHtml(f.name) + '</div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function renderFeaturedSliderSmall(items) {
  var html = '<div class="hc-featured-slider hc-featured-slider-small">';
  items.forEach(function (f) {
    html += '<div class="hc-featured-card hc-featured-card-small" data-offer-id="' + escapeAttr(String(f.offer_id || f.id)) + '">';
    if (f.large_logo_url) {
      html += '<img class="hc-featured-img" src="' + escapeAttr(f.large_logo_url) + '" alt="' + escapeAttr(f.name) + '" />';
    } else {
      html += '<div class="hc-featured-img hc-featured-placeholder">' + escapeHtml(f.name) + '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function renderFeaturedGrid(items) {
  var html = '<div class="hc-featured-grid">';
  items.forEach(function (f) {
    html += '<div class="hc-featured-grid-item"' + (f.offer_id ? ' data-offer-id="' + escapeAttr(String(f.offer_id)) + '"' : '') + '>';
    if (f.small_logo_url) {
      html += '<img class="hc-featured-grid-logo" src="' + escapeAttr(f.small_logo_url) + '" alt="' + escapeAttr(f.name) + '" />';
    } else {
      var initials = (f.name || '').split(' ').map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
      html += '<div class="hc-featured-grid-initials">' + escapeHtml(initials) + '</div>';
    }
    html += '<div class="hc-featured-grid-name">' + escapeHtml(f.name) + '</div>';
    html += '</div>';
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
  var id = String(merchant.offerId || merchant.storeId || merchant.wildfireMerchantId || merchant.id || '');
  var offerType = merchant.offerSource === 'wildfire' || merchant.wildfireMerchantId ? 'wildfire' : 'olive';
  var detailId = offerType === 'olive' && merchant.offerId ? String(merchant.offerId) : '';

  var wildfireId = merchant.wildfireMerchantId || '';
  var html = '<div class="hc-merchant-card"' + (detailId ? ' data-offer-id="' + escapeAttr(detailId) + '"' : '') + ' data-offer-type="' + offerType + '"' + (wildfireId ? ' data-merchant-id="' + escapeAttr(String(wildfireId)) + '"' : '') + ' data-merchant="' + escapeAttr(JSON.stringify({
    name: name, logoUrl: logoUrl, location: location, website: merchant.website || '',
    isOnline: !!(merchant.isOnline || merchant.reach === 'online_only'),
    cashback: merchant.cashback || merchant.points || '',
  })) + '">';
  if (logoUrl) {
    html += '<div class="hc-merchant-img-wrap"><img class="hc-merchant-img" src="' + escapeAttr(logoUrl) + '" alt="' + escapeAttr(name) + '" /></div>';
  } else {
    var initials = name.split(' ').map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
    html += '<div class="hc-merchant-img-wrap"><div class="hc-merchant-initials">' + escapeHtml(initials) + '</div></div>';
  }
  html += '<div class="hc-merchant-card-info">';
  if (location) {
    html += '<div class="hc-merchant-location">' + escapeHtml(location) + '</div>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

function openExternalUrl(url) {
  postToNative('homecrowd:open-url', { url: url });
  showWebviewOverlay(url);
}

function initStoreMap(merchants, userLocation) {
  var mapEl = document.getElementById('hc-store-map');
  if (!mapEl || !merchants || merchants.length === 0) return;
  if (typeof L === 'undefined') return; // Leaflet not loaded

  var map = L.map(mapEl, {
    center: [37.78, -122.43],
    zoom: 11,
    zoomControl: false,
    attributionControl: false,
  });
  window._hcStoreMap = map;

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
  }).addTo(map);

  // Purple marker icon matching mobile app
  var purpleIcon = L.divIcon({
    className: 'hc-map-marker',
    html: '<div class="hc-map-pin"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });

  merchants.forEach(function (m) {
    var name = m.name || m.merchantName || '';
    var address = '';
    if (m.address) address = m.address + ', ';
    if (m.city && m.state) address += m.city + ', ' + m.state;

    var mapsUrl = 'https://maps.apple.com/?q=' + encodeURIComponent(name + (address ? ' ' + address : '')) + '&ll=' + m.latitude + ',' + m.longitude;
    var marker = L.marker([m.latitude, m.longitude], { icon: purpleIcon }).addTo(map);
    marker.bindPopup(
      '<div style="font-family:Baikal-Bold,sans-serif;font-size:14px;margin-bottom:4px;">' + escapeHtml(name) + '</div>' +
      (address ? '<a href="' + escapeAttr(mapsUrl) + '" target="_blank" style="font-family:Baikal-Regular,sans-serif;font-size:12px;color:#007AFF;text-decoration:underline;">' + escapeHtml(address) + '</a>' : '')
    );
  });

  // If we have user location, add blue marker and zoom to closest 5 stores (matching mobile logic)
  if (userLocation) {
    var userIcon = L.divIcon({
      className: 'hc-map-marker-user',
      html: '<div class="hc-map-pin-user"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    L.marker([userLocation.latitude, userLocation.longitude], { icon: userIcon }).addTo(map);

    // Sort merchants by distance to user, take closest 5
    var sorted = merchants.map(function (m) {
      var dLat = (m.latitude - userLocation.latitude) * Math.PI / 180;
      var dLng = (m.longitude - userLocation.longitude) * Math.PI / 180;
      var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(userLocation.latitude * Math.PI / 180) * Math.cos(m.latitude * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
      m._dist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 3959;
      return m;
    }).sort(function (a, b) { return a._dist - b._dist; }).slice(0, 5);

    // Fit bounds to user + closest 5
    var points = [[userLocation.latitude, userLocation.longitude]];
    sorted.forEach(function (m) { points.push([m.latitude, m.longitude]); });
    var bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [30, 30] });
  } else {
    // No user location — fit all merchants
    var bounds = L.latLngBounds(merchants.map(function (m) { return [m.latitude, m.longitude]; }));
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
