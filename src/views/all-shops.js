import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { buildAppHeaderHtml, attachAppHeader } from '../base-components/AppHeader.js';
import SearchBar from '../base-components/SearchBar.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { getPointMultiplierValue } from '../pointMultiplier.js';
import { showWebviewOverlay } from '../webview-overlay.js';
import { hasNativeBridge, postToNative } from '../bridge.js';
import storeSvg from '../assets/icons/store.svg?raw';
import bagSvg from '../assets/icons/bag.svg?raw';
import locationSvg from '../assets/icon-location.svg?raw';
import chevronRightSvg from '../assets/icons/chevron-right.svg?raw';

var CHANNEL_LABEL = {
  in_person: 'In-person',
  in_app: 'In-app',
  online: 'Online',
};

// The wildfire endpoint clamps pageSize to min(200, ...), so one request is one
// batch. The feed runs to ~6,800 merchants, which is why this list pages rather
// than loading everything the way the superuser admin screen can.
var PAGE_SIZE = 200;
var SEARCH_DEBOUNCE_MS = 300;

function pickCardlinkedList(response) {
  if (!response) return [];
  if (Array.isArray(response.cardlinked)) return response.cardlinked;
  if (Array.isArray(response.stores)) return response.stores;
  if (Array.isArray(response.offers)) return response.offers;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.results) && response.results.length) return response.results;
  if (Array.isArray(response)) return response;
  return [];
}

function pickWildfireClickList(response) {
  if (!response) return [];
  if (Array.isArray(response.click)) return response.click;
  if (Array.isArray(response.results) && response.results.length) return response.results;
  if (Array.isArray(response)) return response;
  return [];
}

/** Mirrors pickWildfirePagination in offers.js. */
function pickWildfirePagination(response) {
  if (!response || !response.pagination) return null;
  return {
    currentPage: Number(response.pagination.currentPage) || 1,
    hasMore: !!response.pagination.hasMoreClick,
  };
}

function pickFeaturedList(response) {
  if (!response) return [];
  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response)) return response;
  return [];
}

function dedupeShops(list) {
  var seen = {};
  return list.filter(function (item) {
    var key = String(item.id != null ? item.id : item.name || item.merchantName || '')
      .trim()
      .toLowerCase();
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function normalizeOliveShop(item) {
  return Object.assign({}, item, {
    listKey: 'in_person-' + (item.id != null ? item.id : item.name),
    shopChannel: 'in_person',
    offerType: item.offerType || item.offer_type || 'cardlinked',
    name: item.name || item.merchantName || '',
    logoUrl:
      item.logoUrl ||
      item.logo ||
      item.large_logo_url ||
      item.small_logo_url ||
      '',
  });
}

function normalizeWildfireShop(item, shopChannel) {
  return Object.assign({}, item, {
    listKey: shopChannel + '-' + (item.id != null ? item.id : item.name),
    shopChannel: shopChannel,
    offerSource: 'wildfire',
    offerType: 'click',
    name: item.name || item.merchantName || '',
    logoUrl:
      item.logoUrl ||
      item.logo ||
      item.large_logo_url ||
      item.small_logo_url ||
      '',
  });
}

function normalizeFeaturedShop(item) {
  var offerType = String(item.offer_type || item.offerType || '').toLowerCase();
  var isCardlinked =
    offerType === 'cardlinked' ||
    offerType === 'card_linked' ||
    offerType === 'card-linked';
  return Object.assign({}, item, {
    listKey:
      'featured-' +
      (item.offer_type || item.offerType || 'click') +
      '-' +
      (item.id != null ? item.id : item.name),
    shopChannel: isCardlinked ? 'in_person' : 'in_app',
    offerType: isCardlinked ? 'cardlinked' : 'click',
    isFeatured: true,
    name: item.name || item.merchantName || '',
    logoUrl:
      item.large_logo_url ||
      item.small_logo_url ||
      item.logoUrl ||
      item.logo ||
      '',
  });
}

function getMerchantHaystack(merchant) {
  return [
    merchant && merchant.name,
    merchant && merchant.merchantName,
    merchant && merchant.category,
    merchant && merchant.category_name,
    merchant && merchant.categories,
    merchant && merchant.description,
    merchant && merchant.tags,
    Array.isArray(merchant && merchant.category_list)
      ? merchant.category_list.join(' ')
      : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getSubtitle(merchant) {
  if (!merchant) return '';
  if (merchant.subtitle) return merchant.subtitle;
  if (merchant.shopCategoryLabel) return merchant.shopCategoryLabel;
  if (merchant.description) return merchant.description;
  if (Array.isArray(merchant.categories)) return merchant.categories.join(', ');
  if (merchant.category_name) return merchant.category_name;
  if (merchant.category) return String(merchant.category);
  return CHANNEL_LABEL[merchant.shopChannel] || '';
}

function getLogoUri(merchant) {
  if (!merchant) return '';
  return (
    merchant.small_logo_url ||
    merchant.large_logo_url ||
    merchant.logoUrl ||
    merchant.logo ||
    ''
  );
}

function isNewMerchant(merchant) {
  return !!(
    merchant &&
    (merchant.is_new || merchant.isNew || merchant.new || merchant.badge === 'new')
  );
}

function parseRouteParams() {
  var hash = String(window.location.hash || '');
  var qIndex = hash.indexOf('?');
  var params = {};
  if (qIndex < 0) return params;
  var sp = new URLSearchParams(hash.slice(qIndex + 1));
  sp.forEach(function (v, k) {
    params[k] = v;
  });
  return params;
}

function buildShopRowHtml(shop) {
  var logoUri = getLogoUri(shop);
  var subtitle = getSubtitle(shop);
  var multiplier = getPointMultiplierValue(shop);
  var showNew = isNewMerchant(shop);
  var payload = {
    id: shop.id,
    name: shop.name,
    shopChannel: shop.shopChannel,
    offerType: shop.offerType || shop.offer_type,
    offerSource: shop.offerSource,
    offer_id: shop.offer_id || shop.offerId,
    wildfireMerchantId:
      shop.wildfireMerchantId || shop.wildfire_merchant_id || shop.merchantId || shop.id,
    logoUrl: logoUri,
  };

  return (
    '<button type="button" class="hc-all-shops-row" data-all-shop="' +
    escapeAttr(JSON.stringify(payload)) +
    '">' +
    '<span class="hc-all-shops-logo-wrap">' +
    (logoUri
      ? '<img data-hc-ph="store" src="' + escapeAttr(logoUri) + '" alt="" class="hc-all-shops-logo" />'
      : '<span class="hc-all-shops-logo hc-all-shops-logo--ph hc-img-ph hc-img-ph--store"></span>') +
    '</span>' +
    '<span class="hc-all-shops-meta">' +
    '<span class="hc-all-shops-title-row">' +
    '<span class="hc-all-shops-name">' +
    escapeHtml(shop.name || shop.merchantName || 'Store') +
    '</span>' +
    (showNew ? '<span class="hc-all-shops-tag">New</span>' : '') +
    '</span>' +
    (subtitle
      ? '<span class="hc-all-shops-subtitle">' + escapeHtml(subtitle) + '</span>'
      : '') +
    (!showNew && multiplier
      ? '<span class="hc-all-shops-tag hc-all-shops-tag--earn">Earn ' +
        (Number.isInteger(multiplier) ? multiplier : multiplier) +
        'X point</span>'
      : '') +
    '</span>' +
    '<span class="hc-all-shops-chevron" aria-hidden="true">' +
    chevronRightSvg +
    '</span>' +
    '</button>'
  );
}

/** Mirrors the carousel's ordering so the list reads in the same sequence. */
function preferredOrderOf(shop) {
  if (!shop) return 0;
  var raw =
    shop.preferred_order != null
      ? shop.preferred_order
      : shop.preferredOrder != null
        ? shop.preferredOrder
        : shop.top_order != null
          ? shop.top_order
          : shop.topOrder;
  return Number(raw) || 0;
}

/**
 * "Online" here means a click-through offer rather than a card-linked one —
 * wildfire shops normalize to the in_app channel, so match on both.
 */
function isOnlineShop(shop) {
  if (!shop) return false;
  var channel = String(shop.shopChannel || '').toLowerCase();
  if (channel === 'in_app' || channel === 'online') return true;
  var type = String(shop.offerType || shop.offer_type || '').toLowerCase();
  return type === 'click' || type === 'click_sso' || type === 'online';
}

/** Card-linked shops you visit, as opposed to click-through online offers. */
function isInPersonShop(shop) {
  if (!shop) return false;
  var channel = String(shop.shopChannel || '').toLowerCase();
  if (channel === 'in_person') return true;
  var type = String(shop.offerType || shop.offer_type || '').toLowerCase();
  return type === 'cardlinked' || type === 'card_linked' || type === 'card-linked';
}

/**
 * Local match across name / category / description / tags. Wildfire results are
 * already narrowed server-side by `?q=`, so this mostly serves the in-memory
 * preferred partners and keeps both sets consistent.
 */
function filterShops(shops, query) {
  var q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return shops;
  return shops.filter(function (shop) {
    return getMerchantHaystack(shop).indexOf(q) >= 0;
  });
}

function openShop(shop) {
  if (!shop) return;
  var offerId = shop.offer_id || shop.offerId || shop.id;
  if (offerId) {
    try {
      sessionStorage.setItem(
        'hc_offer_detail_initial',
        JSON.stringify({ offerId: String(offerId), offer: shop })
      );
    } catch (_e) {}
    window.location.hash = '#/offers/' + encodeURIComponent(offerId);
    return;
  }
  if (
    shop.offerSource === 'wildfire' ||
    shop.shopChannel === 'online' ||
    shop.shopChannel === 'in_app' ||
    shop.offerType === 'click' ||
    shop.offerType === 'click_sso'
  ) {
    var merchantId = shop.wildfireMerchantId || shop.id;
    var url = api.buildWildfireRedirectUrl(merchantId);
    if (url) {
      if (hasNativeBridge()) {
        postToNative('homecrowd:open-url', { url: url, title: shop.name || '' });
      } else {
        showWebviewOverlay(url, { title: shop.name || 'Offer' });
      }
    }
  }
}

export function renderAllShops(container) {
  var params = parseRouteParams();
  var autoFocus = params.autoFocusSearch === '1' || params.autoFocusSearch === 'true';
  // Each section's "View all" lands here scoped to that section's set.
  var preferredOnly = params.preferred === '1' || params.preferred === 'true';
  var onlineOnly = params.channel === 'online';
  var inPersonOnly = params.channel === 'in_person';
  var allShops = [];

  // Which sources this scope draws on. Wildfire is the only paged one; preferred
  // partners come back unpaginated and card-linked is a single fetch.
  var usesWildfirePaging = !preferredOnly && !inPersonOnly;
  var includesPreferred = !onlineOnly && !inPersonOnly;

  var preferredShops = [];
  var wildfireShops = [];
  var wildfirePage = 0;
  var wildfireHasMore = usesWildfirePaging;
  var loadingPage = false;
  var activeQuery = '';
  var renderedCount = 0;
  var sentinelObserver = null;
  var searchTimer = null;

  /** Active pill standing in for the scope the user arrived with. */
  function scopePillHtml(id, icon, label, iconClass) {
    return (
      '<div class="hc-all-shops-filters">' +
      '<button type="button" class="hc-all-shops-top-rated hc-all-shops-top-rated--active"' +
      ' id="' +
      id +
      '" aria-pressed="true">' +
      '<span class="hc-all-shops-top-rated-icon' +
      (iconClass ? ' ' + iconClass : '') +
      '" aria-hidden="true">' +
      icon +
      '</span>' +
      '<span>' +
      escapeHtml(label) +
      '</span>' +
      '</button>' +
      '</div>'
    );
  }

  function buildFiltersHtml() {
    // Top Rated ranks within the full catalog; inside a scoped list it would
    // only ever remove rows the user came here to see. The active scope pill
    // takes its place, and clearing it drops back to the full catalog.
    if (preferredOnly) {
      return scopePillHtml(
        'hc-all-shops-preferred',
        storeSvg,
        'Partners',
        'hc-all-shops-preferred-icon'
      );
    }
    if (onlineOnly) {
      return scopePillHtml('hc-all-shops-online', bagSvg, 'Online');
    }
    if (inPersonOnly) {
      return scopePillHtml(
        'hc-all-shops-inperson',
        locationSvg,
        'In person',
        'hc-all-shops-inperson-icon'
      );
    }
    // Unscoped catalog carries no pill.
    return '';
  }

  function mountShell() {
    container.innerHTML =
      '<div class="hc-all-shops">' +
      buildAppHeaderHtml({ showBack: true }) +
      '<div class="hc-all-shops-page">' +
      '<div class="hc-all-shops-search">' +
      SearchBar({
        id: 'hc-all-shops-search',
        placeholder: preferredOnly
          ? 'Search preferred partners'
          : onlineOnly
            ? 'Search online shops'
            : inPersonOnly
              ? 'Search in-person shops'
              : 'Search anything',
        value: '',
      }) +
      '</div>' +
      '<div id="hc-all-shops-filters-slot">' +
      buildFiltersHtml() +
      '</div>' +
      '<div id="hc-all-shops-body" class="hc-all-shops-body">' +
      LoadingSpinner({ text: 'Loading shops...' }) +
      '</div>' +
      '</div></div>';

    attachAppHeader(container, {
      showBack: true,
      onBackPress: function () {
        navigate('/offers');
      },
    });
  }

  function bindFilters() {
    // Deselecting the only filter on the screen means "show everything".
    var scopeBtn = container.querySelector(
      '#hc-all-shops-preferred, #hc-all-shops-online, #hc-all-shops-inperson'
    );
    if (scopeBtn) {
      scopeBtn.addEventListener('click', function () {
        navigate('/offers/all-shops');
      });
    }
  }

  function emptyLabel() {
    if (preferredOnly) return 'No preferred partners found';
    if (onlineOnly) return 'No online shops found';
    if (inPersonOnly) return 'No in-person shops found';
    return 'No shops found';
  }

  function syncAllShops() {
    var merged = dedupeShops([].concat(preferredShops, wildfireShops));
    allShops = onlineOnly ? merged.filter(isOnlineShop) : merged;
  }

  function currentQuery() {
    var searchEl = container.querySelector('#hc-all-shops-search');
    return searchEl ? searchEl.value : '';
  }

  function sentinelHtml() {
    if (!wildfireHasMore) return '';
    return (
      '<div id="hc-all-shops-sentinel" class="hc-all-shops-sentinel">' +
      (loadingPage ? LoadingSpinner({ text: 'Loading more...' }) : '') +
      '</div>'
    );
  }

  /**
   * `append` reuses the existing rows and only adds the new tail, so scrolling
   * through several thousand merchants doesn't rebuild the whole list each time.
   * Ordering is append-only (dedupe and filter both preserve it), so everything
   * already on screen keeps its position.
   */
  function renderList(append) {
    var bodyEl = container.querySelector('#hc-all-shops-body');
    if (!bodyEl) return;
    var filtered = filterShops(allShops, currentQuery());
    var listEl = bodyEl.querySelector('.hc-all-shops-list');

    if (append && listEl) {
      if (filtered.length > renderedCount) {
        listEl.insertAdjacentHTML(
          'beforeend',
          filtered.slice(renderedCount).map(buildShopRowHtml).join('')
        );
        renderedCount = filtered.length;
      }
      var sentinel = bodyEl.querySelector('#hc-all-shops-sentinel');
      if (sentinel) sentinel.outerHTML = sentinelHtml();
      observeSentinel();
      return;
    }

    if (!filtered.length) {
      bodyEl.innerHTML = loadingPage
        ? LoadingSpinner({ text: 'Loading shops...' })
        : '<div class="hc-all-shops-empty">' + emptyLabel() + '</div>';
      renderedCount = 0;
      observeSentinel();
      return;
    }

    bodyEl.innerHTML =
      '<div class="hc-all-shops-list">' +
      filtered.map(buildShopRowHtml).join('') +
      '</div>' +
      sentinelHtml();
    renderedCount = filtered.length;
    observeSentinel();
  }

  // Delegated so appended rows need no rebinding and can't be double-bound.
  function bindRowClicks() {
    var bodyEl = container.querySelector('#hc-all-shops-body');
    if (!bodyEl) return;
    bodyEl.addEventListener('click', function (e) {
      var row = e.target && e.target.closest && e.target.closest('[data-all-shop]');
      if (!row) return;
      try {
        openShop(JSON.parse(row.getAttribute('data-all-shop')));
      } catch (_e) {}
    });
  }

  function observeSentinel() {
    if (sentinelObserver) {
      sentinelObserver.disconnect();
      sentinelObserver = null;
    }
    if (!wildfireHasMore || typeof IntersectionObserver === 'undefined') return;
    var bodyEl = container.querySelector('#hc-all-shops-body');
    var sentinel = container.querySelector('#hc-all-shops-sentinel');
    if (!bodyEl || !sentinel) return;
    sentinelObserver = new IntersectionObserver(
      function (entries) {
        var visible = entries.some(function (entry) {
          return entry.isIntersecting;
        });
        if (visible) loadMorePage();
      },
      // Start the next request before the user actually hits the bottom.
      { root: bodyEl, rootMargin: '400px' }
    );
    sentinelObserver.observe(sentinel);
  }

  function fetchPreferred() {
    return api
      .getFeaturedOffers(null, { is_preferred_partner: true })
      .catch(function () {
        return null;
      })
      .then(function (response) {
        preferredShops = pickFeaturedList(response)
          .filter(function (m) {
            return m && m.is_active !== false;
          })
          .map(normalizeFeaturedShop)
          .sort(function (a, b) {
            return preferredOrderOf(b) - preferredOrderOf(a);
          });
      });
  }

  function fetchWildfirePage() {
    if (loadingPage || !wildfireHasMore) return Promise.resolve();
    loadingPage = true;
    var requestedPage = wildfirePage + 1;
    var queryAtRequest = activeQuery;
    return api
      .getWildfireOffers(requestedPage, PAGE_SIZE, activeQuery)
      .catch(function () {
        return null;
      })
      .then(function (response) {
        // A newer search superseded this request — its state was already reset.
        if (queryAtRequest !== activeQuery) return;
        var pagination = pickWildfirePagination(response);
        wildfirePage = pagination ? pagination.currentPage : requestedPage;
        wildfireHasMore = pagination ? pagination.hasMore : false;
        wildfireShops = wildfireShops.concat(
          pickWildfireClickList(response).map(function (item) {
            return normalizeWildfireShop(item, 'in_app');
          })
        );
      })
      .then(function () {
        loadingPage = false;
      });
  }

  function loadMorePage() {
    if (loadingPage || !wildfireHasMore) return;
    fetchWildfirePage().then(function () {
      if (!container.isConnected) return;
      syncAllShops();
      renderList(true);
    });
    // Reflect the in-flight state straight away.
    var sentinel = container.querySelector('#hc-all-shops-sentinel');
    if (sentinel) sentinel.innerHTML = LoadingSpinner({ text: 'Loading more...' });
  }

  /**
   * Wildfire search runs on the server (`?q=`) so it reaches the whole feed, not
   * just the pages already pulled. Preferred partners are all in memory, so they
   * keep filtering locally.
   */
  function runSearch() {
    if (!usesWildfirePaging) {
      renderList();
      return;
    }
    var next = String(currentQuery() || '').trim();
    if (next === activeQuery) {
      renderList();
      return;
    }
    activeQuery = next;
    wildfireShops = [];
    wildfirePage = 0;
    wildfireHasMore = true;
    loadingPage = false;
    syncAllShops();
    renderList();
    fetchWildfirePage().then(function () {
      if (!container.isConnected) return;
      syncAllShops();
      renderList();
    });
  }

  mountShell();
  bindFilters();

  bindRowClicks();

  var searchEl = container.querySelector('#hc-all-shops-search');
  if (searchEl) {
    searchEl.addEventListener('input', function () {
      if (searchTimer) window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(runSearch, SEARCH_DEBOUNCE_MS);
    });
    if (autoFocus) {
      window.setTimeout(function () {
        searchEl.focus();
      }, 50);
    }
  }

  window.addEventListener(
    'hashchange',
    function () {
      if (searchTimer) window.clearTimeout(searchTimer);
      if (sentinelObserver) {
        sentinelObserver.disconnect();
        sentinelObserver = null;
      }
    },
    { once: true }
  );

  // Card-linked is a single fetch with no paging, so it stays on its own path.
  if (inPersonOnly) {
    api
      .getOffers(1, 100, null, { includeOnline: false })
      .catch(function () {
        return null;
      })
      .then(function (response) {
        if (!container.isConnected) return;
        allShops = dedupeShops(
          pickCardlinkedList(response).map(normalizeOliveShop)
        ).filter(isInPersonShop);
        renderList();
      });
    return;
  }

  // Preferred partners come back unpaginated, so one request gets all of them;
  // wildfire pages in behind them at PAGE_SIZE a time. Card-linked shops are
  // deliberately not part of this list — they live under ?channel=in_person.
  var initialLoads = [];
  if (includesPreferred) initialLoads.push(fetchPreferred());
  if (usesWildfirePaging) initialLoads.push(fetchWildfirePage());
  Promise.all(initialLoads).then(function () {
    if (!container.isConnected) return;
    syncAllShops();
    renderList();
  });
}
