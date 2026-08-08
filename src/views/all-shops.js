import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { buildAppHeaderHtml, attachAppHeader } from '../base-components/AppHeader.js';
import SearchBar from '../base-components/SearchBar.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { getPointMultiplierValue } from '../pointMultiplier.js';
import {
  SHOP_CATEGORIES,
  merchantMatchesShopCategory,
} from '../components/Marketplace/ShopByCategory.js';
import { openCategoryPickerModal } from '../components/Marketplace/CategoryPickerModal.js';
import { showWebviewOverlay } from '../webview-overlay.js';
import { hasNativeBridge, postToNative } from '../bridge.js';
import starSvg from '../assets/icons/star.svg?raw';
import chevronRightSvg from '../assets/icons/chevron-right.svg?raw';

var CHANNEL_LABEL = {
  in_person: 'In-person',
  in_app: 'In-app',
  online: 'Online',
};

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
      ? '<img src="' + escapeAttr(logoUri) + '" alt="" class="hc-all-shops-logo" />'
      : '<span class="hc-all-shops-logo hc-all-shops-logo--ph"></span>') +
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

function isFeaturedShop(shop) {
  if (!shop) return false;
  if (shop.isFeatured) return true;
  if (shop.top_featured || shop.bottom_featured) return true;
  return String(shop.listKey || '').indexOf('featured-') === 0;
}

function filterShops(shops, categoryId, query, topRatedOnly) {
  var q = String(query || '')
    .trim()
    .toLowerCase();
  var list = shops.filter(function (shop) {
    if (topRatedOnly && !isFeaturedShop(shop)) return false;
    if (!merchantMatchesShopCategory(shop, categoryId)) return false;
    if (!q) return true;
    return getMerchantHaystack(shop).indexOf(q) >= 0;
  });
  if (topRatedOnly) {
    list = list.slice().sort(function (a, b) {
      var aTop = a.top_featured ? 1 : 0;
      var bTop = b.top_featured ? 1 : 0;
      if (bTop !== aTop) return bTop - aTop;
      var aOrder = Number(a.top_order != null ? a.top_order : a.topOrder) || 0;
      var bOrder = Number(b.top_order != null ? b.top_order : b.topOrder) || 0;
      if (bOrder !== aOrder) return bOrder - aOrder;
      return (getPointMultiplierValue(b) || 0) - (getPointMultiplierValue(a) || 0);
    });
  }
  return list;
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
  var categoryId = params.categoryId || 'all';
  var autoFocus = params.autoFocusSearch === '1' || params.autoFocusSearch === 'true';
  var topRatedOnly = false;
  var allShops = [];
  var categoryPicker = null;

  function selectedCategory() {
    return (
      SHOP_CATEGORIES.find(function (c) {
        return c.id === categoryId;
      }) || SHOP_CATEGORIES[0]
    );
  }

  function buildFiltersHtml() {
    var cat = selectedCategory();
    return (
      '<div class="hc-all-shops-filters">' +
      '<button type="button" class="hc-all-shops-cat-pill" id="hc-all-shops-cat-pill">' +
      '<span class="hc-all-shops-cat-pill-text">' +
      escapeHtml(cat.label) +
      '</span>' +
      '<span class="hc-all-shops-cat-pill-chevron" aria-hidden="true">▾</span>' +
      '</button>' +
      '<button type="button" class="hc-all-shops-top-rated' +
      (topRatedOnly ? ' hc-all-shops-top-rated--active' : '') +
      '" id="hc-all-shops-top-rated">' +
      '<span class="hc-all-shops-top-rated-icon" aria-hidden="true">' +
      starSvg +
      '</span>' +
      '<span>Top Rated</span>' +
      '</button>' +
      '</div>'
    );
  }

  function mountShell() {
    container.innerHTML =
      '<div class="hc-all-shops">' +
      buildAppHeaderHtml({ showBack: true }) +
      '<div class="hc-all-shops-page">' +
      '<div class="hc-all-shops-search">' +
      SearchBar({
        id: 'hc-all-shops-search',
        placeholder: 'Search anything',
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
    var catPill = container.querySelector('#hc-all-shops-cat-pill');
    if (catPill) {
      catPill.addEventListener('click', function () {
        if (categoryPicker) {
          categoryPicker.close();
          categoryPicker = null;
        }
        categoryPicker = openCategoryPickerModal({
          selectedId: categoryId,
          onApply: function (id) {
            categoryId = id || 'all';
            var slot = container.querySelector('#hc-all-shops-filters-slot');
            if (slot) {
              slot.innerHTML = buildFiltersHtml();
              bindFilters();
            }
            renderList();
          },
          onClose: function () {
            categoryPicker = null;
          },
        });
      });
    }
    var topRatedBtn = container.querySelector('#hc-all-shops-top-rated');
    if (topRatedBtn) {
      topRatedBtn.addEventListener('click', function () {
        topRatedOnly = !topRatedOnly;
        var slot = container.querySelector('#hc-all-shops-filters-slot');
        if (slot) {
          slot.innerHTML = buildFiltersHtml();
          bindFilters();
        }
        renderList();
      });
    }
  }

  function renderList() {
    var bodyEl = container.querySelector('#hc-all-shops-body');
    var searchEl = container.querySelector('#hc-all-shops-search');
    if (!bodyEl) return;
    var filtered = filterShops(
      allShops,
      categoryId,
      searchEl ? searchEl.value : '',
      topRatedOnly
    );
    if (!filtered.length) {
      bodyEl.innerHTML = '<div class="hc-all-shops-empty">No shops found</div>';
      return;
    }
    bodyEl.innerHTML =
      '<div class="hc-all-shops-list">' +
      filtered.map(buildShopRowHtml).join('') +
      '</div>';
    bodyEl.querySelectorAll('[data-all-shop]').forEach(function (row) {
      row.addEventListener('click', function () {
        try {
          openShop(JSON.parse(row.getAttribute('data-all-shop')));
        } catch (_e) {}
      });
    });
  }

  mountShell();
  bindFilters();

  var searchEl = container.querySelector('#hc-all-shops-search');
  if (searchEl) {
    searchEl.addEventListener('input', renderList);
    if (autoFocus) {
      window.setTimeout(function () {
        searchEl.focus();
      }, 50);
    }
  }

  Promise.all([
    api.getOffers(1, 100, null, { includeOnline: false }).catch(function () {
      return null;
    }),
    api.getWildfireOffers(1, 100).catch(function () {
      return null;
    }),
    api.getFeaturedOffers().catch(function () {
      return null;
    }),
  ]).then(function (results) {
    if (!container.isConnected) return;
    var olive = pickCardlinkedList(results[0]).map(normalizeOliveShop);
    var wildfire = pickWildfireClickList(results[1]).map(function (item) {
      return normalizeWildfireShop(item, 'in_app');
    });
    var featured = pickFeaturedList(results[2])
      .filter(function (m) {
        return m && m.is_active !== false;
      })
      .map(normalizeFeaturedShop);
    // Featured first so Top Rated keeps the featured flags after dedupe.
    allShops = dedupeShops([].concat(featured, olive, wildfire));
    renderList();
  });
}
