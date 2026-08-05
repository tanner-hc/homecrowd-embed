import { escapeAttr, escapeHtml } from '../../base-components/html.js';
import { renderPointMultiplierBadgeHtml } from '../../pointMultiplier.js';

var BRAND_COLORS = {
  'best buy': '#0046BE',
  alo: '#F3F3F3',
  ulta: '#F68026',
  'ulta beauty': '#F68026',
  walgreens: '#E31837',
  target: '#CC0000',
  nike: '#111111',
  adidas: '#000000',
  amazon: '#232F3E',
  apple: '#000000',
  starbucks: '#00704A',
  mcdonald: '#FFBC0D',
  "mcdonald's": '#FFBC0D',
  walmart: '#0071CE',
  cvs: '#CC0000',
  'home depot': '#F96302',
  costco: '#E31837',
};

function getBrandColor(name) {
  if (!name) return '#F2F2F2';
  var key = String(name).trim().toLowerCase();
  if (BRAND_COLORS[key]) return BRAND_COLORS[key];
  var match = Object.keys(BRAND_COLORS).find(function (brand) {
    return key.indexOf(brand) >= 0;
  });
  return match ? BRAND_COLORS[match] : '#F2F2F2';
}

export function normalizeFeaturedStores(response) {
  var data;
  if (response && response.results) data = response.results;
  else if (Array.isArray(response)) data = response;
  else data = [];

  var active = data.filter(function (m) {
    return m.is_active !== false;
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
  [].concat(topFeatured, bottomFeatured, active).forEach(function (item) {
    var key = item.id != null ? String(item.id) : item.name;
    if (!key || seen[key]) return;
    var logoUri = item.small_logo_url || item.large_logo_url;
    if (!logoUri) return;
    seen[key] = true;
    merged.push(item);
  });
  return merged;
}

/**
 * @param {{ stores?: object[], loading?: boolean, title?: string }} props
 */
export function buildHomeFeaturedStoresHtml(props) {
  props = props || {};
  var title = props.title || 'Earn where you already shop';
  var stores = Array.isArray(props.stores) ? props.stores : [];

  var body = '';
  if (props.loading) {
    body = '<div class="hc-featured-stores-loader" aria-hidden="true"></div>';
  } else if (stores.length) {
    body =
      '<div class="hc-featured-stores-row">' +
      stores
        .map(function (item) {
          var logoUri = item.small_logo_url || item.large_logo_url;
          var brandColor = getBrandColor(item.name);
          return (
            '<button type="button" class="hc-featured-store" data-featured-store-id="' +
            escapeAttr(String(item.id || '')) +
            '">' +
            '<span class="hc-featured-store-tile" style="background:' +
            escapeAttr(brandColor) +
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
    '<div class="hc-featured-stores-header">' +
    '<div class="hc-featured-stores-title">' +
    escapeHtml(title) +
    '</div>' +
    '<button type="button" class="hc-featured-stores-see-all" data-featured-see-all="1">View all</button>' +
    '</div>' +
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
