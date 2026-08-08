import { escapeAttr, escapeHtml } from '../../base-components/html.js';
import { renderPointMultiplierBadgeHtml } from '../../pointMultiplier.js';
import cardFilledSvg from '../../assets/icons/card-filled.svg?raw';

var FEATURED_STORE_TILE_BG = '#FFFFFF';

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

  // Figma 1216:13702 — sits between the section header and the store row while
  // the user has no card linked, since these offers only pay out once one is.
  var requirementHtml = props.linkedCardRequired
    ? '<div class="hc-featured-stores-req">' +
      '<span class="hc-featured-stores-req-icon" aria-hidden="true">' +
      cardFilledSvg +
      '</span>' +
      '<span class="hc-featured-stores-req-text">Linked card required</span>' +
      '</div>'
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
  normalizeFeaturedStores,
};
