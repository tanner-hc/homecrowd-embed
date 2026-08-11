import { escapeAttr, escapeHtml } from '../../base-components/html.js';
import { renderPointMultiplierBadgeHtml } from '../../pointMultiplier.js';
import cardFilledSvg from '../../assets/icons/card-filled.svg?raw';

var FEATURED_STORE_TILE_BG = '#FFFFFF';

/**
 * Shapes raw Wildfire merchants for the "Shop online" row, which reads
 * small_logo_url / name and presses through to the merchant id. Logo-less
 * entries are dropped because the tile is logo-only, so `limit` is applied
 * after filtering rather than to the raw page.
 *
 * @param {*} response
 * @param {number} [limit]
 */
export function normalizeOnlineStores(response, limit) {
  var data;
  if (response && Array.isArray(response.click)) data = response.click;
  else if (response && Array.isArray(response.results)) data = response.results;
  else if (Array.isArray(response)) data = response;
  else data = [];

  var seen = {};
  var out = [];
  data.forEach(function (item) {
    if (!item || item.is_active === false) return;
    var logoUri =
      item.small_logo_url || item.large_logo_url || item.logoUrl || item.logo || '';
    if (!logoUri) return;
    var key = item.id != null ? String(item.id) : item.name || item.merchantName;
    if (!key || seen[key]) return;
    seen[key] = true;
    var merchantId =
      item.wildfireMerchantId ||
      item.wildfire_merchant_id ||
      item.merchantId ||
      item.id;
    out.push(
      Object.assign({}, item, {
        name: item.name || item.merchantName || '',
        small_logo_url: logoUri,
        large_logo_url: item.large_logo_url || logoUri,
        offer_type: 'click',
        offerType: 'click',
        offerSource: 'wildfire',
        offer_source: 'wildfire',
        wildfireMerchantId: merchantId,
        wildfire_merchant_id: merchantId,
      })
    );
  });
  return limit ? out.slice(0, limit) : out;
}

export function normalizeFeaturedStores(response, options) {
  options = options || {};
  var onlineOnly = options.onlineOnly !== false;
  var data;
  if (response && response.results) data = response.results;
  else if (Array.isArray(response)) data = response;
  else data = [];

  var active = data.filter(function (m) {
    if (!m || m.is_active === false) return false;
    if (m.is_preferred_partner) return false;
    if (onlineOnly) {
      var t = String(m.offer_type || m.offerType || '').toLowerCase();
      if (t && t !== 'click' && t !== 'click_sso' && t !== 'online') return false;
    }
    return true;
  });
  var topFeatured = active
    .filter(function (m) {
      return m.top_featured;
    })
    .sort(function (a, b) {
      return (b.top_order || 0) - (a.top_order || 0);
    });
  var bottomFeatured = active
    .filter(function (m) {
      return m.bottom_featured;
    })
    .sort(function (a, b) {
      return (b.bottom_order || 0) - (a.bottom_order || 0);
    });

  var seen = {};
  var merged = [];
  [].concat(topFeatured, bottomFeatured).forEach(function (item) {
    var key = item.id != null ? String(item.id) : item.name;
    if (!key || seen[key]) return;
    var logoUri = item.small_logo_url || item.large_logo_url;
    if (!logoUri) return;
    seen[key] = true;
    merged.push(
      Object.assign({}, item, {
        offer_type: item.offer_type || 'click',
        offerType: item.offerType || item.offer_type || 'click',
        offerSource: item.offerSource || item.offer_source || 'wildfire',
        wildfireMerchantId:
          item.wildfireMerchantId ||
          item.wildfire_merchant_id ||
          item.offer_id ||
          item.offerId ||
          null,
      })
    );
  });
  return merged;
}

/**
 * The "Linked card required" chip. Exported so screens other than this component
 * can place it — the Shop screen renders it under "Shop in person near you".
 * The chip states a fact about the offers rather than a setup step, so it shows
 * regardless of whether a card is currently linked.
 *
 * @param {string} [className] extra class for context-specific spacing
 */
export function buildLinkedCardRequiredHtml(className) {
  return (
    '<div class="hc-featured-stores-req' +
    (className ? ' ' + escapeHtml(className) : '') +
    '">' +
    '<span class="hc-featured-stores-req-icon" aria-hidden="true">' +
    cardFilledSvg +
    '</span>' +
    '<span class="hc-featured-stores-req-text">Linked card required</span>' +
    '</div>'
  );
}

/**
 * @param {{
 *   stores?: object[],
 *   loading?: boolean,
 *   title?: string,
 *   linkedCardRequired?: boolean, shows the "Linked card required" chip
 * }} props
 */
export function buildHomeFeaturedStoresHtml(props) {
  props = props || {};
  var title = props.title || 'Earn where you already shop';
  var stores = Array.isArray(props.stores) ? props.stores : [];

  var requirementHtml = props.linkedCardRequired
    ? buildLinkedCardRequiredHtml()
    : '';

  var body = '';
  if (props.loading) {
    body = '<div class="hc-featured-stores-loader" aria-hidden="true"></div>';
  } else if (stores.length) {
    body =
      '<div class="hc-featured-stores-row">' +
      stores
        .map(function (item) {
          var logoUri = item.small_logo_url || item.large_logo_url;
          return (
            '<button type="button" class="hc-featured-store" data-featured-store-id="' +
            escapeAttr(String(item.id || '')) +
            '">' +
            '<span class="hc-featured-store-tile" style="background:' +
            escapeAttr(FEATURED_STORE_TILE_BG) +
            '">' +
            '<span class="hc-featured-store-logo-clip">' +
            '<img src="' +
            escapeAttr(logoUri) +
            '" alt="" class="hc-featured-store-logo" />' +
            '</span>' +
            renderPointMultiplierBadgeHtml(item, 'overlay', true) +
            '</span>' +
            '<span class="hc-featured-store-name">' +
            escapeHtml(item.name || '') +
            '</span>' +
            '</button>'
          );
        })
        .join('') +
      '</div>';
  }

  return (
    '<div class="hc-featured-stores">' +
    '<div class="hc-featured-stores-header' +
    (requirementHtml ? ' hc-featured-stores-header--with-req' : '') +
    '">' +
    '<div class="hc-featured-stores-title">' +
    escapeHtml(title) +
    '</div>' +
    '<button type="button" class="hc-featured-stores-see-all" data-featured-see-all="1">View all</button>' +
    '</div>' +
    requirementHtml +
    body +
    '</div>'
  );
}

export function bindHomeFeaturedStores(root, handlers) {
  handlers = handlers || {};
  if (!root) return;
  var seeAll = root.querySelector('[data-featured-see-all]');
  if (seeAll) {
    seeAll.addEventListener('click', function () {
      if (typeof handlers.onSeeAll === 'function') handlers.onSeeAll();
    });
  }
  root.querySelectorAll('[data-featured-store-id]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-featured-store-id');
      if (typeof handlers.onStorePress === 'function') {
        handlers.onStorePress(id);
      } else if (typeof handlers.onSeeAll === 'function') {
        handlers.onSeeAll();
      }
    });
  });
}

export default {
  buildHomeFeaturedStoresHtml,
  bindHomeFeaturedStores,
  buildLinkedCardRequiredHtml,
  normalizeFeaturedStores,
  normalizeOnlineStores,
};
