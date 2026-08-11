import { escapeHtml } from '../../base-components/html.js';
import allCategorySvg from '../../assets/icons/all_category.svg?raw';
import groceriesSvg from '../../assets/icons/groceries.svg?raw';
import forkKnifeSvg from '../../assets/icons/fork_knife.svg?raw';
import houseSvg from '../../assets/icons/house.svg?raw';
import shouldersSvg from '../../assets/icons/shoulders.svg?raw';
import planeSvg from '../../assets/icons/plane.svg?raw';
import footballSvg from '../../assets/icons/american_football_ball.svg?raw';
import lipstickSvg from '../../assets/icons/lipstick.svg?raw';
import carSvg from '../../assets/icons/car.svg?raw';
import monitorPng from '../../assets/icons/monitor.png';

export var SHOP_CATEGORIES = [
  { id: 'all', label: 'All categories', iconSvg: allCategorySvg },
  { id: 'groceries', label: 'Groceries', iconSvg: groceriesSvg },
  { id: 'restaurants', label: 'Restaurants', iconSvg: forkKnifeSvg },
  { id: 'home', label: 'Home', iconSvg: houseSvg },
  { id: 'fashion', label: 'Fashion', iconSvg: shouldersSvg },
  { id: 'electronics', label: 'Electronics', iconPng: monitorPng },
  { id: 'travel', label: 'Travel', iconSvg: planeSvg },
  { id: 'health', label: 'Health & Beauty', iconSvg: lipstickSvg },
  { id: 'sports', label: 'Sports', iconSvg: footballSvg },
  { id: 'gas', label: 'Gas & auto', iconSvg: carSvg },
];

var CATEGORY_KEYWORDS = {
  all: [],
  groceries: ['grocery', 'groceries', 'supermarket', 'market'],
  restaurants: ['restaurant', 'dining', 'food', 'cafe', 'coffee'],
  home: ['home', 'furniture', 'decor', 'garden'],
  fashion: ['fashion', 'apparel', 'clothing', 'wear', 'style', 'retail', 'shopping'],
  electronics: ['electronic', 'tech', 'appliance', 'computer', 'phone'],
  travel: ['travel', 'hotel', 'flight', 'airline'],
  health: ['health', 'beauty', 'makeup', 'skincare', 'pharmacy', 'cosmetic'],
  sports: ['sport', 'fitness', 'athletic', 'outdoor'],
  gas: ['gas', 'auto', 'fuel', 'car', 'automotive'],
};

var RAW_CATEGORY_TO_SLUG = {
  food: 'restaurants',
  dining: 'restaurants',
  restaurant: 'restaurants',
  restaurants: 'restaurants',
  grocery: 'groceries',
  groceries: 'groceries',
  supermarket: 'groceries',
  shopping: 'fashion',
  retail: 'fashion',
  apparel: 'fashion',
  fashion: 'fashion',
  clothing: 'fashion',
  electronics: 'electronics',
  tech: 'electronics',
  technology: 'electronics',
  home: 'home',
  furniture: 'home',
  travel: 'travel',
  hotel: 'travel',
  hotels: 'travel',
  airline: 'travel',
  airlines: 'travel',
  health: 'health',
  beauty: 'health',
  pharmacy: 'health',
  sports: 'sports',
  fitness: 'sports',
  gas: 'gas',
  fuel: 'gas',
  automotive: 'gas',
  auto: 'gas',
};

function collectSlugsFromMerchant(merchant) {
  var slugs = [];
  var seen = {};

  function push(slug) {
    if (!slug || seen[slug]) return;
    seen[slug] = true;
    slugs.push(slug);
  }

  var fromApi = merchant && merchant.shopCategories;
  if (Array.isArray(fromApi)) {
    fromApi.forEach(push);
  }
  if (merchant && merchant.shopCategory) {
    push(merchant.shopCategory);
  }

  var rawCandidates = [merchant && merchant.category, merchant && merchant.category_name]
    .concat(Array.isArray(merchant && merchant.categories) ? merchant.categories : [])
    .concat(Array.isArray(merchant && merchant.tags) ? merchant.tags : []);

  rawCandidates.forEach(function (raw) {
    if (!raw) return;
    var key = String(raw).trim().toLowerCase();
    if (!key) return;
    if (RAW_CATEGORY_TO_SLUG[key]) {
      push(RAW_CATEGORY_TO_SLUG[key]);
      return;
    }
    Object.keys(CATEGORY_KEYWORDS).forEach(function (slug) {
      if (slug === 'all') return;
      if (
        CATEGORY_KEYWORDS[slug].some(function (k) {
          return key.indexOf(k) >= 0;
        })
      ) {
        push(slug);
      }
    });
  });

  return slugs;
}

export function merchantMatchesShopCategory(merchant, categoryId) {
  if (!categoryId || categoryId === 'all') return true;
  var slugs = collectSlugsFromMerchant(merchant);
  if (slugs.indexOf(categoryId) >= 0) return true;
  if (slugs.length > 0) return false;

  var keywords = CATEGORY_KEYWORDS[categoryId] || [];
  if (!keywords.length) return true;
  var haystack = [
    merchant && merchant.name,
    merchant && merchant.merchantName,
    merchant && merchant.category,
    merchant && merchant.category_name,
    merchant && merchant.description,
    merchant && merchant.summary,
    merchant && merchant.tags,
    Array.isArray(merchant && merchant.categories) ? merchant.categories.join(' ') : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return keywords.some(function (k) {
    return haystack.indexOf(k) >= 0;
  });
}

/**
 * @param {{ selectedId?: string }} props
 */
export function buildShopByCategoryHtml(props) {
  props = props || {};
  var selectedId = props.selectedId || 'all';
  var chips = SHOP_CATEGORIES.map(function (cat) {
    var selected = cat.id === selectedId;
    var iconHtml = cat.iconPng
      ? '<img data-hc-ph="none" src="' + cat.iconPng + '" alt="" class="hc-shop-cat-png" />'
      : '<span class="hc-shop-cat-svg" aria-hidden="true">' + (cat.iconSvg || '') + '</span>';
    return (
      '<button type="button" class="hc-shop-cat-chip' +
      (selected ? ' hc-shop-cat-chip--selected' : '') +
      '" data-shop-category="' +
      escapeHtml(cat.id) +
      '">' +
      iconHtml +
      '<span class="hc-shop-cat-label">' +
      escapeHtml(cat.label) +
      '</span>' +
      '</button>'
    );
  }).join('');

  return (
    '<div class="hc-shop-by-category">' +
    '<div class="hc-shop-by-category-title">Shop by category</div>' +
    '<div class="hc-shop-by-category-grid">' +
    chips +
    '</div>' +
    '</div>'
  );
}

export function bindShopByCategory(root, onSelect) {
  if (!root) return;
  root.querySelectorAll('[data-shop-category]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-shop-category');
      root.querySelectorAll('.hc-shop-cat-chip--selected').forEach(function (el) {
        el.classList.remove('hc-shop-cat-chip--selected');
      });
      btn.classList.add('hc-shop-cat-chip--selected');
      if (typeof onSelect === 'function') onSelect(id);
    });
  });
}
