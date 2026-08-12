import * as api from '../api.js';
import * as analytics from '../analytics.js';
import iconTransparentUrl from '../assets/icon-transparent.png';
import shopIconUrl from '../assets/icons/store.svg';
import cardIconSvg from '../assets/icons/card-filled.svg?raw';
import bagIconSvg from '../assets/icons/bag.svg?raw';
import chevronDownSvg from '../assets/icons/chevron-down-sm.svg?raw';
import rowChevronSvg from '../assets/icons/chevron-right-sm.svg?raw';
import { resolveCardLinkStatus } from '../cardLinkStatus.js';
import { mountBrowserExtensionInline } from './browser-extension.js';
import {
  resolveMapKitTokenAsync,
  ensureMapKitLoaded,
  mapKitAuthFailureWasReported,
  shouldUseMapKitJs,
} from '../mapkit-embed.js';
import { hasNativeBridge, postToNative } from '../bridge.js';
import { showWebviewOverlay } from '../webview-overlay.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import ScreenTitle from '../base-components/ScreenTitle.js';
import SearchBar from '../base-components/SearchBar.js';
import MapLocationSearchBar from '../base-components/MapLocationSearchBar.js';
import EmptyState from '../base-components/EmptyState.js';
import Button from '../base-components/Button.js';
import LinkCardBanner from '../base-components/LinkCardBanner.js';
import NoExtraCostFooter from '../base-components/NoExtraCostFooter.js';
import PointsPerDollarBanner from '../base-components/PointsPerDollarBanner.js';
import { buildAppHeaderHtml, attachAppHeader } from '../base-components/AppHeader.js';
import {
  buildLinkCardUnlockBarHtml,
  bindLinkCardUnlockBar,
} from '../base-components/LinkCardUnlockBar.js';
import { openBottomSheet } from '../base-components/BottomSheetModal.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { renderPointMultiplierBadgeHtml } from '../pointMultiplier.js';
import { searchUSCities, lookupUSCity } from '../usCitySearch.js';
import { navigate } from '../router.js';
import { openDirectionsPicker } from '../mapDirections.js';
import {
  buildHomeFeaturedStoresHtml,
  bindHomeFeaturedStores,
  buildLinkedCardRequiredHtml,
  normalizeOnlineStores,
  openFeaturedStore,
} from '../components/Dashboard/HomeFeaturedStores.js';
import {
  buildBottomFeaturedGridHtml,
  bindBottomFeaturedGrid,
  fetchBottomFeaturedMerchants,
} from '../components/Marketplace/BottomFeaturedGrid.js';
import { buildShopEarnCardHtml, bindShopEarnCard } from '../components/Marketplace/ShopEarnCard.js';
import {
  buildPreferredPartnersCarouselHtml,
  mountPreferredPartnersCarousel,
  fetchPreferredPartners,
} from '../components/Marketplace/PreferredPartnersCarousel.js';
import { getSetupRewardPoints } from '../setup-rewards.js';
import lockIconUrl from '../assets/icons/lock_icon.png';

var MAP_OFFERS_PAGE_SIZE = 150;
var MAP_USER_ZOOM_LEAFLET = 13;
var MAP_USER_SPAN_DEG = 0.001;
var MAP_INITIAL_NEARBY_STORES = 3;
var MAP_LEAFLET_DISABLE_CLUSTERING_AT_ZOOM = 9;
var MAPKIT_CLUSTER_MIN_LATITUDE_DELTA = 0.55;

var trophyIconSvg =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M17 5h2a2 2 0 012 2v1a4 4 0 01-4 4M7 5H5a2 2 0 00-2 2v1a4 4 0 004 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

var clockIconSvg =
  '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="9" stroke="#1d6dff" stroke-width="2"/>' +
  '<path d="M12 7v5l3 2" stroke="#1d6dff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

function buildLinkCardBannerHtml() {
  return LinkCardBanner({
    title: 'Link a card and use it in-person',
    subtitleHtml:
      'Earn points for you and dollars for ' +
      '<span data-hc-school-name>your school</span>' +
      ' on every in-network purchase.',
  });
}

function buildInAppBannerHtml() {
  return (
    '<div class="hc-be-info-card-code hc-inapp-info-card">' +
    '<div class="hc-be-info-item hc-be-info-item--primary">' +
    '<div class="hc-be-info-icon hc-be-info-icon--puzzle">' + bagIconSvg + '</div>' +
    '<div class="hc-be-info-text">' +
    '<div class="hc-be-info-heading">No card needed. Just shop in-app.</div>' +
    '<div class="hc-be-info-body">Earn points automatically on every in-app purchase.</div>' +
    '</div>' +
    '</div>' +
    '<div class="hc-be-info-divider" aria-hidden="true"></div>' +
    '<div class="hc-be-info-item hc-be-info-item--secondary">' +
    '<div class="hc-be-info-icon hc-be-info-icon--clock">' + clockIconSvg + '</div>' +
    '<div class="hc-be-info-text">' +
    '<div class="hc-be-info-body">Points may take <span class="hc-be-info-emphasis">up to 24 hours</span> to appear.</div>' +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

function buildHowItWorksHtml() {
  return (
    '<div class="hc-stores-howitworks">' +
    '<div class="hc-stores-howitworks-step">' +
    '<div class="hc-stores-howitworks-icon" aria-hidden="true">' + cardIconSvg + '</div>' +
    '<div class="hc-stores-howitworks-text">' +
    '<div class="hc-stores-howitworks-step-title">1. Link a card</div>' +
    '<div class="hc-stores-howitworks-step-desc">Connect a visa or mastercard.</div>' +
    '</div></div>' +
    '<div class="hc-stores-howitworks-arrow" aria-hidden="true">&rarr;</div>' +
    '<div class="hc-stores-howitworks-step">' +
    '<div class="hc-stores-howitworks-icon" aria-hidden="true">' + bagIconSvg + '</div>' +
    '<div class="hc-stores-howitworks-text">' +
    '<div class="hc-stores-howitworks-step-title">2. Shop</div>' +
    '<div class="hc-stores-howitworks-step-desc">Shop with your card at partner locations.</div>' +
    '</div></div>' +
    '<div class="hc-stores-howitworks-arrow" aria-hidden="true">&rarr;</div>' +
    '<div class="hc-stores-howitworks-step">' +
    '<div class="hc-stores-howitworks-icon" aria-hidden="true">' + trophyIconSvg + '</div>' +
    '<div class="hc-stores-howitworks-text">' +
    '<div class="hc-stores-howitworks-step-title">3. Earn</div>' +
    '<div class="hc-stores-howitworks-step-desc">' +
    'Get points for you and dollars for ' +
    '<span data-hc-school-name>your school</span>.' +
    '</div>' +
    '</div></div>' +
    '</div>'
  );
}

var OFFER_LOC_KEY = 'hc_embed_offer_location';

function readStoredOfferLocationRaw() {
  try {
    var localRaw = localStorage.getItem(OFFER_LOC_KEY);
    if (localRaw) return localRaw;
  } catch (e) {}
  try {
    return sessionStorage.getItem(OFFER_LOC_KEY);
  } catch (e2) {}
  return null;
}

function persistOfferLocation(lat, lng) {
  var payload = JSON.stringify({ lat: lat, lng: lng });
  try {
    localStorage.setItem(OFFER_LOC_KEY, payload);
  } catch (e) {}
  try {
    sessionStorage.setItem(OFFER_LOC_KEY, payload);
  } catch (e2) {}
}

function getStoredOfferLocation() {
  try {
    var raw = readStoredOfferLocationRaw();
    if (!raw) return null;
    var o = JSON.parse(raw);
    if (o && o.lat != null && o.lng != null) {
      return { latitude: Number(o.lat), longitude: Number(o.lng) };
    }
  } catch (e) {}
  return null;
}

var _userLocation = null;
var _activeOfferLocation = null;

function setActiveOfferLocation(lat, lng) {
  if (lat == null || lng == null) return;
  var latitude = Number(lat);
  var longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  _activeOfferLocation = { latitude: latitude, longitude: longitude };
}

function getActiveOfferLocation() {
  return _activeOfferLocation;
}

export function renderOffers(container) {
  if (container._hcPreferredPartnersApi && typeof container._hcPreferredPartnersApi.destroy === 'function') {
    container._hcPreferredPartnersApi.destroy();
    container._hcPreferredPartnersApi = null;
  }

  container.innerHTML = buildMarketplaceShell();

  var carouselTapDedupe = { card: null, until: 0 };
  container._hcCarouselDedupe = carouselTapDedupe;
  container._hcStoresLoaded = { featured: false, grid: false };
  container._hcOnlineLoaded = { featured: false, grid: false };

  attachAppHeader(container, {});
  wireUpOffersCardClicks(container, carouselTapDedupe);
  wireMarketplaceInteractions(container);
  populateMarketplacePreferredPartners(container, null, true);

  api
    .fetchCurrentUser()
    .then(function (user) {
      if (!container.isConnected) return;
      container._hcOffersUser = user;
      return api.getCards().then(function (cards) {
        if (!container.isConnected) return;
        var status = resolveCardLinkStatus(user, cards) || 'unknown';
        mountLinkCardGate(container, user, status);
      });
    })
    .catch(function () {});

  fetchPreferredPartners()
    .then(function (partners) {
      if (!container.isConnected) return;
      populateMarketplacePreferredPartners(container, partners, false);
    })
    .catch(function () {
      if (!container.isConnected) return;
      populateMarketplacePreferredPartners(container, [], false);
    });

  // "Shop online" previews the first 8 of the online catalog — two rows of four,
  // per Figma 1421:9172 — and its "View all" opens the rest. It used to show
  // only top/bottom-featured offers, which is a different (promoted) set than
  // the list behind it.
  api
    .getWildfireOffers(1, 60)
    .then(function (raw) {
      if (!container.isConnected) return;
      populateMarketplaceFeaturedShops(container, normalizeOnlineStores(raw, 8));
    })
    .catch(function () {
      if (!container.isConnected) return;
      populateMarketplaceFeaturedShops(container, []);
    });

  fetchBottomFeaturedMerchants()
    .then(function (merchants) {
      if (!container.isConnected) return;
      populateMarketplaceBottomGrid(container, merchants);
    })
    .catch(function () {
      if (!container.isConnected) return;
      populateMarketplaceBottomGrid(container, []);
    });

  getOffersWithLocationRetry(
    1,
    MAP_OFFERS_PAGE_SIZE,
    getActiveOfferLocation() || getStoredOfferLocation(),
  )
    .then(function (raw) {
      if (!container.isConnected) return;
      var cardlinked = pickOliveMapStores(raw);
      fillStoresGrid(container.querySelector('#hc-stores-grid'), cardlinked, container);
      initOffersMap(container, cardlinked);
      container._hcStoresLoaded.grid = true;
      container._hcStoresGridHasItems = cardlinked.length > 0;
    })
    .catch(function () {
      if (!container.isConnected) return;
      initOffersMap(container, []);
    });

  api
    .getFeaturedOffers('card_linked')
    .then(function (raw) {
      if (!container.isConnected) return;
      var list = (raw && raw.results) || (Array.isArray(raw) ? raw : []);
      container._hcFeaturedMapOffers = (list || []).filter(function (offer) {
        return (
          offer &&
          offer.is_active !== false &&
          (offer.top_featured || offer.bottom_featured)
        );
      });
    })
    .catch(function () {
      container._hcFeaturedMapOffers = [];
    });
}

export function renderStoresMap(container) {
  container.innerHTML =
    '<div class="hc-stores-map-page">' +
    buildAppHeaderHtml({ showBack: true }) +
    '<div class="hc-stores-map-body">' +
    renderLocationMapSection({ includeSearch: false }) +
    '</div>' +
    '</div>';

  attachAppHeader(container, {
    showBack: true,
    onBackPress: function () {
      navigate('/offers');
    },
  });

  container._hcPendingMapSelect = consumePendingMapMerchantSelection();

  api
    .getFeaturedOffers('card_linked')
    .then(function (raw) {
      if (!container.isConnected) return;
      var list = (raw && raw.results) || (Array.isArray(raw) ? raw : []);
      container._hcFeaturedMapOffers = (list || []).filter(function (offer) {
        return (
          offer &&
          offer.is_active !== false &&
          (offer.top_featured || offer.bottom_featured)
        );
      });
    })
    .catch(function () {
      container._hcFeaturedMapOffers = [];
    });

  getOffersWithLocationRetry(
    1,
    MAP_OFFERS_PAGE_SIZE,
    getActiveOfferLocation() || getStoredOfferLocation(),
  )
    .then(function (raw) {
      if (!container.isConnected) return;
      var list = pickOliveMapStores(raw);
      var pendingMerchant =
        container._hcPendingMapSelect &&
        flattenOfferMerchantForMap(container._hcPendingMapSelect.merchant);
      if (pendingMerchant && pickMerchantLatLng(pendingMerchant)) {
        list = [pendingMerchant].concat(list || []);
      }
      initOffersMap(container, list);
    })
    .catch(function () {
      if (!container.isConnected) return;
      var pendingMerchant =
        container._hcPendingMapSelect &&
        flattenOfferMerchantForMap(container._hcPendingMapSelect.merchant);
      initOffersMap(
        container,
        pendingMerchant && pickMerchantLatLng(pendingMerchant) ? [pendingMerchant] : []
      );
    });
}

function buildMarketplaceShell() {
  return (
    '<div class="hc-offers-page hc-offers-page--marketplace">' +
    buildAppHeaderHtml({ title: 'Shop' }) +
    '<div class="hc-marketplace-scroll">' +
    // Figma 1421:9134 — the old plain heading and subheading are now the copy
    // inside this dismissible card. Deliberately not wrapped: dismissing it
    // removes the node outright, so the section below becomes the scroller's
    // first child and drops its section gap.
    buildShopEarnCardHtml({}) +
    '<div id="hc-marketplace-preferred-partners" class="hc-marketplace-preferred-partners"></div>' +
    '<div id="hc-marketplace-featured-shops" class="hc-marketplace-featured-shops"></div>' +
    '<div id="hc-marketplace-bottom-grid" class="hc-marketplace-bottom-grid"></div>' +
    '<div class="hc-marketplace-map-block">' +
    '<div class="hc-marketplace-map-header">' +
    '<div class="hc-marketplace-map-title">Eat local</div>' +
    '<button type="button" class="hc-marketplace-map-view" id="hc-marketplace-view-map">View map</button>' +
    '</div>' +
    renderLocationMapSection({ includeSearch: false }) +
    buildLinkedCardRequiredHtml('hc-marketplace-map-req') +
    '</div>' +
    // Figma 1421:9207 — full-width rows under the map, not the two-up grid the
    // search results elsewhere still use.
    '<div id="hc-stores-grid" class="hc-merchant-grid hc-merchant-grid--rows">' +
    gridSkeletonHtml() +
    '</div>' +
    '<div class="hc-marketplace-stores-more" id="hc-marketplace-stores-more" hidden>' +
    '<button type="button" class="hc-marketplace-show-more" id="hc-marketplace-show-more">' +
    'Show more' +
    '<span class="hc-marketplace-show-more-icon" aria-hidden="true">' +
    chevronDownSvg +
    '</span>' +
    '</button>' +
    '</div>' +
    '<div class="hc-marketplace-bottom-space"></div>' +
    '</div>' +
    '<div id="hc-marketplace-unlock-slot"></div>' +
    '</div>'
  );
}

/** The card layout a given grid wants, from the class on the grid itself. */
function merchantCardOptionsFor(grid) {
  return grid && grid.classList && grid.classList.contains('hc-merchant-grid--rows')
    ? { layout: 'row' }
    : null;
}

/**
 * Fills a stores grid in whichever layout that grid uses — the Shop screen's
 * list is rows, every other grid is the two-up card.
 *
 * Reading the layout off the element matters because the map re-renders this
 * same grid from several places that only have the node, and any of them
 * writing plain cards would silently replace the rows.
 *
 * @param {HTMLElement} grid
 * @param {object[]} list
 * @param {HTMLElement} [container] re-applies the "Show more" collapse
 */
function fillStoresGrid(grid, list, container) {
  if (!grid) return;
  var opts = merchantCardOptionsFor(grid);
  var html = '';
  (Array.isArray(list) ? list : []).forEach(function (m) {
    html += renderMerchantCard(m, opts);
  });
  grid.innerHTML = html;
  if (container) applyMarketplaceStoresReveal(container);
}

/** How many local stores show at first, and how many each "Show more" adds. */
var MARKETPLACE_STORES_PAGE = 15;

/**
 * Collapses the local-store list to one page and shows the reveal control only
 * while something is still hidden (Figma 1421:9213). Re-run after each render,
 * since the list is replaced wholesale when results arrive.
 */
function applyMarketplaceStoresReveal(container) {
  var grid = container.querySelector('#hc-stores-grid');
  var moreWrap = container.querySelector('#hc-marketplace-stores-more');
  if (!grid || !moreWrap) return;
  var rows = grid.querySelectorAll('.hc-merchant-row');
  var shown = container._hcStoresShown || MARKETPLACE_STORES_PAGE;
  container._hcStoresShown = shown;
  rows.forEach(function (row, idx) {
    row.hidden = idx >= shown;
  });
  moreWrap.hidden = rows.length <= shown;
}

function wireMarketplaceInteractions(container) {
  var showMore = container.querySelector('#hc-marketplace-show-more');
  if (showMore) {
    showMore.addEventListener('click', function () {
      container._hcStoresShown =
        (container._hcStoresShown || MARKETPLACE_STORES_PAGE) + MARKETPLACE_STORES_PAGE;
      applyMarketplaceStoresReveal(container);
    });
  }

  bindShopEarnCard(container, {
    onExplore: function () {
      navigate('/offers/all-shops?channel=online');
    },
  });

  var viewMap = container.querySelector('#hc-marketplace-view-map');
  if (viewMap) {
    viewMap.addEventListener('click', function () {
      navigate('/offers/map');
    });
  }
}

function populateMarketplacePreferredPartners(container, partners, loading) {
  var wrap = container.querySelector('#hc-marketplace-preferred-partners');
  if (!wrap) return;

  if (container._hcPreferredPartnersApi && typeof container._hcPreferredPartnersApi.destroy === 'function') {
    container._hcPreferredPartnersApi.destroy();
    container._hcPreferredPartnersApi = null;
  }

  wrap.innerHTML = buildPreferredPartnersCarouselHtml({
    partners: partners || [],
    loading: !!loading,
  });

  if (loading) return;

  var root = wrap.querySelector('[data-pp-root]');
  if (!root) return;

  container._hcPreferredPartnersApi = mountPreferredPartnersCarousel(root, {
    onViewAll: function () {
      navigate('/offers/all-shops?preferred=1');
    },
    onPartnerPress: function (partner) {
      if (!partner) return;
      var offerId = partner.offer_id || partner.id;
      if (!offerId) {
        navigate('/offers/all-shops?categoryId=all');
        return;
      }
      try {
        sessionStorage.setItem(
          'hc_offer_detail_initial',
          JSON.stringify({
            offerId: String(offerId),
            offer: partner,
            // The small mark is the one on the partner card, and it is what the
            // detail page should show. It travels as an override rather than on
            // the offer because fetched merchant data is merged over the seeded
            // offer and would otherwise replace it.
            logoOverride: partner.small_logo_url || partner.large_logo_url || '',
          })
        );
      } catch (_e) {}
      window.location.hash = '#/offers/' + encodeURIComponent(offerId);
    },
  });
}

/**
 * Drops the first three store marks into the intro card's cluster. The card
 * renders with the shell, before any store data exists, so it starts bare and
 * fills in once the online catalogue lands.
 */
function fillShopEarnLogos(container, stores) {
  var card = container.querySelector('[data-shop-earn]');
  if (!card || card.querySelector('.hc-shop-earn-logos')) return;
  var logos = (Array.isArray(stores) ? stores : [])
    .map(function (item) {
      return (item && (item.small_logo_url || item.large_logo_url)) || '';
    })
    .filter(Boolean)
    .slice(0, 3);
  if (!logos.length) return;
  var html = logos
    .map(function (url) {
      return (
        '<span class="hc-shop-earn-logo"><img data-hc-ph="store" src="' +
        escapeAttr(String(url)) +
        '" alt="" /></span>'
      );
    })
    .join('');
  var cluster = document.createElement('div');
  cluster.className = 'hc-shop-earn-logos';
  cluster.setAttribute('aria-hidden', 'true');
  cluster.innerHTML = html;
  card.insertBefore(cluster, card.querySelector('.hc-shop-earn-body'));
}

function populateMarketplaceFeaturedShops(container, stores) {
  var wrap = container.querySelector('#hc-marketplace-featured-shops');
  if (!wrap) return;
  wrap.innerHTML = buildHomeFeaturedStoresHtml({
    title: 'Shop online',
    stores: stores,
    layout: 'grid',
  });
  fillShopEarnLogos(container, stores);
  bindHomeFeaturedStores(wrap, {
    onSeeAll: function () {
      navigate('/offers/all-shops?channel=online');
    },
    onStorePress: function (id) {
      var store = (stores || []).find(function (s) {
        return String(s.id) === String(id);
      });
      if (!openFeaturedStore(store)) {
        navigate('/offers/all-shops?channel=online');
      }
    },
  });
}

function populateMarketplaceBottomGrid(container, merchants) {
  var wrap = container.querySelector('#hc-marketplace-bottom-grid');
  if (!wrap) return;
  wrap.innerHTML = buildBottomFeaturedGridHtml({ merchants: merchants });
  bindBottomFeaturedGrid(wrap, {
    onPress: function (offer) {
      var offerId = offer && (offer.id || offer.offer_id || offer.offerId);
      if (offerId) {
        try {
          sessionStorage.setItem(
            'hc_offer_detail_initial',
            JSON.stringify({ offerId: String(offerId), offer: offer })
          );
        } catch (_e) { }
        window.location.hash = '#/offers/' + encodeURIComponent(offerId);
        return;
      }
      navigate('/offers/all-shops?categoryId=all');
    },
  });
}

function openFeaturedClickStore(store) {
  var offerId = store.offer_id || store.id;
  var merchantId = store.wildfire_merchant_id || store.merchant_id || store.id;
  if (merchantId && (store.offer_type === 'click' || !store.offer_id)) {
    var url = api.buildWildfireRedirectUrl(merchantId);
    if (url) {
      showWebviewOverlay(url, { title: store.name || 'Offer' });
      return;
    }
  }
  if (offerId) {
    api.trackOfferClick(offerId).catch(function () {
      return null;
    }).then(function (trackResult) {
      var trackUrl =
        trackResult && (trackResult.tracking_url || trackResult.trackingUrl);
      if (trackUrl) {
        if (trackUrl.indexOf('http') !== 0) trackUrl = 'https://' + trackUrl;
        showWebviewOverlay(trackUrl, { title: store.name || 'Offer' });
        return;
      }
      window.location.hash = '#/offers/' + encodeURIComponent(offerId);
    });
  }
}

function mountLinkCardGate(container, user, status) {
  var earlyRelease = !!(
    (user && user.active_school && (user.active_school.early_release || user.active_school.earlyRelease)) ||
    (user && user.activeSchool && (user.activeSchool.early_release || user.activeSchool.earlyRelease))
  );
  if (earlyRelease || status !== 'unlinked') return;

  var slot = container.querySelector('#hc-marketplace-unlock-slot');
  if (!slot) return;
  var pts = getSetupRewardPoints().linkCard;
  slot.innerHTML = buildLinkCardUnlockBarHtml({ points: pts });
  bindLinkCardUnlockBar(slot, function () {
    navigate('/cards/link-intro');
  });

  var dismissedKey = 'hc_link_card_modal_dismissed';
  var already = false;
  try {
    already = sessionStorage.getItem(dismissedKey) === '1';
  } catch (_e) { }
  if (already) return;

  openBottomSheet({
    iconHtml:
      '<img data-hc-ph="none" src="' +
      lockIconUrl +
      '" alt="" class="hc-link-card-lock-icon" />',
    title: 'Almost there',
    subtitle: 'Link your card to unlock shopping and start earning points.',
    primaryButton: {
      label: 'Link my card +' + pts + ' pts',
      onPress: function () {
        try {
          sessionStorage.setItem(dismissedKey, '1');
        } catch (_e2) { }
        navigate('/cards/link-intro');
      },
    },
    secondaryButton: {
      label: 'Keep browsing shops',
      onPress: function () {
        try {
          sessionStorage.setItem(dismissedKey, '1');
        } catch (_e3) { }
      },
    },
  });
}

function pickWildfirePagination(raw) {
  if (!raw || !raw.pagination) return null;
  return {
    currentPage: Number(raw.pagination.currentPage) || 1,
    hasMore: !!raw.pagination.hasMoreClick,
  };
}

async function getOffersWithLocationRetry(page, pageSize, userLoc) {
  try {
    return await api.getOffers(page, pageSize, userLoc);
  } catch (e) {
    if (userLoc && userLoc.latitude != null && userLoc.longitude != null) {
      return api.getOffers(page, pageSize);
    }
    throw e;
  }
}

function pickFeaturedList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.results)) return raw.results;
  return [];
}

function pickOliveList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw.cardlinked)) return raw.cardlinked;
  if (Array.isArray(raw.results)) return raw.results;
  if (Array.isArray(raw)) return raw;
  return [];
}

function pickOliveMapStores(raw) {
  if (!raw) return [];
  if (Array.isArray(raw.stores) && raw.stores.length) return raw.stores;
  return pickOliveList(raw);
}

function pickWildfireList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw.click)) return raw.click;
  if (Array.isArray(raw.results)) return raw.results;
  if (Array.isArray(raw)) return raw;
  return [];
}


function gridSkeletonHtml() {
  var card =
    '<div class="hc-merchant-card hc-merchant-card--skeleton" aria-hidden="true">' +
    '<div class="hc-merchant-img-wrap hc-skeleton-shimmer"></div>' +
    '<div class="hc-merchant-card-info">' +
    '<div class="hc-merchant-location hc-skeleton-line hc-skeleton-shimmer"></div>' +
    '</div></div>';
  var html = '';
  for (var i = 0; i < 6; i++) html += card;
  return html;
}

function buildOffersShell(activeTab) {
  var html = '<div class="hc-offers-page">';

  html += '<div class="hc-offers-tabs">';
  html +=
    '<button type="button" class="hc-offers-tab' +
    (activeTab === 'stores' ? ' active' : '') +
    '" data-tab="stores">In-person</button>';
  html +=
    '<button type="button" class="hc-offers-tab' +
    (activeTab === 'online' ? ' active' : '') +
    '" data-tab="online">In-app</button>';
  html +=
    '<button type="button" class="hc-offers-tab' +
    (activeTab === 'extension' ? ' active' : '') +
    '" data-tab="extension">Online</button>';
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
  html += '<div id="hc-stores-banner-slot"></div>';
  html += '<div id="hc-stores-featured-top"></div>';
  html += PointsPerDollarBanner({ attached: true });
  html += buildHowItWorksHtml();
  html += NoExtraCostFooter();
  html += '<div id="hc-stores-featured-bottom"></div>';
  html += renderLocationMapSection();
  html +=
    '<div class="hc-search-wrap">' +
    SearchBar({ id: 'hc-search-stores', placeholder: 'Search', value: '' }) +
    '</div>';
  html += '<div id="hc-stores-search-header" class="hc-search-header"></div>';
  html += '<div id="hc-stores-grid" class="hc-merchant-grid">' + gridSkeletonHtml() + '</div>';
  html += '<div id="hc-stores-empty-slot"></div>';
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
  html += '<div id="hc-online-featured-top"></div>';
  html += '<div id="hc-online-featured-bottom"></div>';
  html += PointsPerDollarBanner({ attached: true });
  html += buildInAppBannerHtml();
  html += NoExtraCostFooter();
  html +=
    '<div class="hc-search-wrap">' +
    SearchBar({ id: 'hc-search-online', placeholder: 'Search', value: '' }) +
    '</div>';
  html += '<div id="hc-online-search-header" class="hc-search-header"></div>';
  html += '<div id="hc-online-grid" class="hc-merchant-grid">' + gridSkeletonHtml() + '</div>';
  html += '<div id="hc-online-load-more"></div>';
  html += '<div id="hc-online-empty-slot"></div>';
  html += '<div style="height:80px"></div>';
  html += '</div>';

  html +=
    '<div id="hc-tab-extension" class="hc-tab-content"' +
    (activeTab !== 'extension' ? ' style="display:none"' : '') +
    '>';
  html += '<div id="hc-offers-extension-panel" class="hc-offers-extension-panel"></div>';
  html += '<div style="height:80px"></div>';
  html += '</div>';

  html += '</div>';
  return html;
}

function wireUpOffersTabs(container) {
  var tabs = container.querySelectorAll('.hc-offers-tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var targetTab = this.getAttribute('data-tab');
      tabs.forEach(function (t) {
        t.classList.remove('active');
      });
      this.classList.add('active');
      var storesEl = container.querySelector('#hc-tab-stores');
      var onlineEl = container.querySelector('#hc-tab-online');
      var extEl = container.querySelector('#hc-tab-extension');
      if (storesEl) storesEl.style.display = targetTab === 'stores' ? '' : 'none';
      if (onlineEl) onlineEl.style.display = targetTab === 'online' ? '' : 'none';
      if (extEl) extEl.style.display = targetTab === 'extension' ? '' : 'none';
      clearOffersSearchInputs(container);
      if (targetTab === 'extension') {
        var extPanel = container.querySelector('#hc-offers-extension-panel');
        mountBrowserExtensionInline(extPanel);
      }
    });
  });
}

function clearOffersSearchInputs(container) {
  ['hc-search-stores', 'hc-search-online'].forEach(function (id) {
    var input = container.querySelector('#' + id);
    if (!input || !input.value) return;
    input.value = '';
    // Dispatch input so bindSearch's listener restores the grid, hides the
    // search header, and re-shows the featured area / load-more button.
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function initStoresBannerAndSchoolName(container) {
  Promise.all([
    api.fetchCurrentUser(),
    api.getCards().catch(function () { return null; }),
  ])
    .then(function (results) {
      if (!container.isConnected) return;
      var user = results[0];
      var paymentCards = results[1];
      var cardLinkStatus = resolveCardLinkStatus(user, paymentCards) || 'unknown';
      var isEarlyRelease =
        !!(user && user.active_school && user.active_school.early_release);
      var showBanner = !isEarlyRelease && cardLinkStatus === 'unlinked';

      if (showBanner) {
        var slot = container.querySelector('#hc-stores-banner-slot');
        if (slot) {
          slot.innerHTML = buildLinkCardBannerHtml();
          var btn = slot.querySelector('.hc-stores-link-card-btn');
          if (btn) {
            btn.addEventListener('click', function (e) {
              e.stopPropagation();
              window.location.hash = '#/cards/link-intro';
            });
          }
        }
      }

      var schoolName =
        (user && user.active_school && user.active_school.name) || '';
      if (schoolName) {
        container.querySelectorAll('[data-hc-school-name]').forEach(function (node) {
          node.textContent = schoolName;
        });
      }
    })
    .catch(function () {});
}

function wireUpOffersCardClicks(container, dedupe) {
  container.addEventListener('click', async function (e) {
    var card = e.target.closest('[data-offer-id], [data-offer-type]');
    if (!card) return;
    if (dedupe.card === card && Date.now() < dedupe.until) {
      dedupe.card = null;
      dedupe.until = 0;
      return;
    }
    await handleOffersMarketplaceCardClick(card);
  });
}

function populateFeaturedStores(container, all) {
  var topArea = container.querySelector('#hc-stores-featured-top');
  var bottomArea = container.querySelector('#hc-stores-featured-bottom');
  if (!topArea && !bottomArea) return;
  var top = all.filter(function (f) { return f.is_active && f.top_featured; });
  var bottom = all.filter(function (f) { return f.is_active && f.bottom_featured; });
  if (topArea) {
    topArea.innerHTML = top.length > 0 ? renderStoresHeroCarousel(top) : '';
    initOffersCarousels(topArea);
    initOffersCarouselTapOpensInto(topArea, container._hcCarouselDedupe);
  }
  if (bottomArea) {
    bottomArea.innerHTML = bottom.length > 0 ? renderFeaturedGrid(bottom) : '';
    initOffersCarousels(bottomArea);
    initOffersCarouselTapOpensInto(bottomArea, container._hcCarouselDedupe);
  }
  container._hcStoresLoaded.featured = true;
  container._hcStoresFeaturedHasItems = top.length > 0 || bottom.length > 0;
  maybeShowStoresEmptyState(container);
}

function populateFeaturedOnline(container, all) {
  var topArea = container.querySelector('#hc-online-featured-top');
  var bottomArea = container.querySelector('#hc-online-featured-bottom');
  if (!topArea && !bottomArea) return;
  var top = all.filter(function (f) { return f.is_active && f.top_featured; });
  var bottom = all.filter(function (f) { return f.is_active && f.bottom_featured; });
  if (topArea) {
    topArea.innerHTML = top.length > 0 ? renderOnlineFeaturedCarousel(top, 'top') : '';
    initOffersCarousels(topArea);
    initOffersCarouselTapOpensInto(topArea, container._hcCarouselDedupe);
  }
  if (bottomArea) {
    bottomArea.innerHTML = bottom.length > 0 ? renderOnlineFeaturedCarousel(bottom, 'bottom') : '';
    initOffersCarousels(bottomArea);
    initOffersCarouselTapOpensInto(bottomArea, container._hcCarouselDedupe);
  }
  container._hcOnlineLoaded.featured = true;
  container._hcOnlineFeaturedHasItems = top.length > 0 || bottom.length > 0;
  maybeShowOnlineEmptyState(container);
}

function populateStoresGrid(container, cardlinked) {
  var grid = container.querySelector('#hc-stores-grid');
  if (grid) {
    var html = '';
    cardlinked.forEach(function (m) { html += renderMerchantCard(m); });
    grid.innerHTML = html;
  }
  bindSearch('hc-search-stores', 'hc-stores-grid', cardlinked);
  initOffersMap(container, cardlinked);
  container._hcStoresLoaded.grid = true;
  container._hcStoresGridHasItems = cardlinked.length > 0;
  maybeShowStoresEmptyState(container);
}

function populateOnlineGrid(container, click, pagination) {
  var grid = container.querySelector('#hc-online-grid');
  if (grid) {
    var html = '';
    click.forEach(function (m) { html += renderMerchantCard(m); });
    grid.innerHTML = html;
  }
  // Keep the merchants array on the container so search + load-more both
  // operate on the same growing list.
  container._hcOnlineMerchants = click.slice();
  container._hcOnlinePage = pagination ? pagination.currentPage : 1;
  container._hcOnlineHasMore = pagination ? pagination.hasMore : false;
  bindSearch('hc-search-online', 'hc-online-grid', container._hcOnlineMerchants, container);
  renderOnlineLoadMore(container);
  container._hcOnlineLoaded.grid = true;
  container._hcOnlineGridHasItems = click.length > 0;
  maybeShowOnlineEmptyState(container);
}

function renderOnlineLoadMore(container) {
  var slot = container.querySelector('#hc-online-load-more');
  if (!slot) return;
  // Hide while searching — server-side search returns the full result set.
  var searchInput = container.querySelector('#hc-search-online');
  var searching = !!(searchInput && searchInput.value && searchInput.value.trim());
  if (!container._hcOnlineHasMore || searching) {
    slot.innerHTML = '';
    return;
  }
  slot.innerHTML =
    '<button type="button" class="hc-load-more-btn" id="hc-online-load-more-btn">Load More</button>';
  var btn = slot.querySelector('#hc-online-load-more-btn');
  if (btn) {
    btn.addEventListener('click', function () {
      handleOnlineLoadMore(container, btn);
    });
  }
}

function handleOnlineLoadMore(container, btn) {
  if (container._hcOnlineLoadingMore) return;
  container._hcOnlineLoadingMore = true;
  btn.disabled = true;
  btn.textContent = 'Loading...';
  var nextPage = (container._hcOnlinePage || 1) + 1;
  api
    .getWildfireOffers(nextPage, 50)
    .then(function (raw) {
      if (!container.isConnected) return;
      var newItems = pickWildfireList(raw);
      var pagination = pickWildfirePagination(raw);
      container._hcOnlineMerchants.push.apply(container._hcOnlineMerchants, newItems);
      container._hcOnlinePage = pagination ? pagination.currentPage : nextPage;
      container._hcOnlineHasMore = pagination ? pagination.hasMore : false;
      var grid = container.querySelector('#hc-online-grid');
      if (grid) {
        var appendHtml = '';
        newItems.forEach(function (m) { appendHtml += renderMerchantCard(m); });
        grid.insertAdjacentHTML('beforeend', appendHtml);
      }
      renderOnlineLoadMore(container);
    })
    .catch(function (err) {
      console.error('Load more wildfire failed:', err && err.message);
      btn.disabled = false;
      btn.textContent = 'Load More';
    })
    .then(function () {
      container._hcOnlineLoadingMore = false;
    });
}

function maybeShowStoresEmptyState(container) {
  var loaded = container._hcStoresLoaded;
  if (!loaded.featured || !loaded.grid) return;
  if (container._hcStoresGridHasItems || container._hcStoresFeaturedHasItems) return;
  var slot = container.querySelector('#hc-stores-empty-slot');
  if (!slot) return;
  slot.innerHTML = EmptyState({
    title: 'No Store Offers',
    subtitle: 'No in-store offers available right now.',
    iconChar: '🏪',
  });
}

function maybeShowOnlineEmptyState(container) {
  var loaded = container._hcOnlineLoaded;
  if (!loaded.featured || !loaded.grid) return;
  if (container._hcOnlineGridHasItems || container._hcOnlineFeaturedHasItems) return;
  var slot = container.querySelector('#hc-online-empty-slot');
  if (!slot) return;
  slot.innerHTML = EmptyState({
    title: 'No Online Offers',
    subtitle: 'No online offers available right now.',
    iconChar: '🌐',
  });
}

function initOffersCarouselTapOpensInto(scopeEl, dedupe) {
  var carousels = scopeEl.querySelectorAll(
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
}


function buildFeaturedCardInner(f) {
  var oid = f.offer_id || f.id ? String(f.offer_id || f.id) : '';
  var featuredPayload = escapeAttr(
    JSON.stringify({
      offerId: oid || '',
      name: f.name || '',
      logoUrl: f.small_logo_url || '',
      logo: f.small_logo_url || '',
      large_logo_url: f.large_logo_url || '',
      summary: f.summary || '',
      description: f.summary || '',
      offerType: 'card_linked',
      reach: 'state',
      isOnline: false,
    }),
  );
  var html =
    '<div class="hc-featured-card"' +
    (oid ? ' data-offer-id="' + escapeAttr(oid) + '"' : '') +
    ' data-featured-offer="' +
    featuredPayload +
    '"' +
    '>';
  html += renderPointMultiplierBadgeHtml(f, 'block');
  html += '<div class="hc-featured-img-wrap">';
  if (f.large_logo_url) {
    html +=
      '<img data-hc-ph="store" class="hc-featured-img" draggable="false" src="' +
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
      '<div class="hc-featured-logo"><img data-hc-ph="store" draggable="false" src="' +
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
    var featuredPayload = escapeAttr(
      JSON.stringify({
        offerId: oid || '',
        name: f.name || '',
        logoUrl: f.small_logo_url || '',
        logo: f.small_logo_url || '',
        large_logo_url: f.large_logo_url || '',
        summary: f.summary || '',
        description: f.summary || '',
        offerType: 'click',
        reach: 'online_only',
        isOnline: true,
      }),
    );
    html += '<div class="hc-carousel-slide">';
    html +=
      '<div class="hc-online-card" data-offer-id="' +
      escapeAttr(oid) +
      '" data-merchant-id="' +
      escapeAttr(oid) +
      '" data-offer-type="wildfire"' +
      ' data-featured-offer="' +
      featuredPayload +
      '">';
    html += renderPointMultiplierBadgeHtml(f, 'block');
    if (f.large_logo_url) {
      html +=
        '<img data-hc-ph="store" class="hc-online-card-img" draggable="false" src="' +
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

var OFFERS_LOCATION_PROMPT_DEFAULT =
  'Enable location to discover nearby stores and exclusive local deals';
var OFFERS_LOCATION_PROMPT_DENIED =
  'Location access is blocked. Allow location in your browser settings, then reopen the HomeCrowd embed and tap Enable Location again.';
var OFFERS_LOCATION_PROMPT_SYSTEM_BLOCKED =
  'Your browser could not access location even though the site permission is granted. Check that Location Services are enabled for your browser in the system settings, then try again.';
var OFFERS_LOCATION_PROMPT_GENERIC =
  'Unable to get your location. Please try again.';

var OFFERS_DEFAULT_MAP_LAT = 39.8283;
var OFFERS_DEFAULT_MAP_LNG = -98.5795;

var OFFERS_MAP_LOCATE_ICON_SVG =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M12 8a4 4 0 100 8 4 4 0 000-8z" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  '</svg>';
var OFFERS_MAP_SEARCH_ICON_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  '</svg>';

function renderLocationMapSection(opts) {
  opts = opts || {};
  var includeSearch = opts.includeSearch !== false;
  return (
    '<div class="hc-offers-map-section">' +
    '<div id="hc-offers-location-loading" class="hc-offers-location-card">' +
    '<p class="hc-offers-location-text" style="margin-bottom:16px">Loading map\u2026</p>' +
    '<div class="hc-offers-location-spinner" role="status" aria-label="Loading"></div>' +
    '</div>' +
    '<div id="hc-offers-location-prompt" class="hc-offers-location-card" style="display:none">' +
    '<p class="hc-offers-location-text" id="hc-offers-location-prompt-text">' +
    OFFERS_LOCATION_PROMPT_DEFAULT +
    '</p>' +
    '<button type="button" class="hc-offers-location-btn" id="hc-offers-enable-loc">Enable Location</button>' +
    '</div>' +
    '<div id="hc-offers-map-location-wrap" class="hc-offers-map-location-wrap" style="display:none">' +
    (includeSearch ? MapLocationSearchBar() : '') +
    '<div id="hc-offers-map-shell" class="hc-offers-map-shell">' +
    '<div id="hc-offers-map-mount" class="hc-offers-map-mount" aria-label="Map"></div>' +
    '<button type="button" class="hc-offers-map-my-location" id="hc-offers-map-my-location" aria-label="My location">' +
    OFFERS_MAP_LOCATE_ICON_SVG +
    '</button>' +
    '<div id="hc-offers-map-busy-overlay" class="hc-offers-map-busy-overlay" style="display:none" aria-hidden="true">' +
    '<div class="hc-offers-location-spinner" role="status" aria-label="Updating map"></div>' +
    '</div>' +
    '<div id="hc-offers-map-merchant-card" class="hc-offers-map-merchant-card" style="display:none" hidden></div>' +
    '</div>' +
    '</div>' +
    '<div id="hc-offers-no-stores" class="hc-offers-no-stores-card" style="display:none">' +
    '<p class="hc-offers-no-stores-text" id="hc-offers-no-stores-text">No stores near you</p>' +
    '</div>' +
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
  if (!m || typeof m !== 'object') return null;
  var la = m.latitude != null ? m.latitude : m.lat;
  var lo = m.longitude != null ? m.longitude : m.lng;
  if (la == null || lo == null) {
    var store = Array.isArray(m.stores) ? m.stores[0] : null;
    if (store && typeof store === 'object') {
      la = store.latitude != null ? store.latitude : store.lat;
      lo = store.longitude != null ? store.longitude : store.lng;
    }
  }
  if (la == null || lo == null) return null;
  var lat = Number(la);
  var lng = Number(lo);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: lat, lng: lng };
}

function expandMerchantLocationsForMap(merchant) {
  if (!merchant || typeof merchant !== 'object') return [];
  var stores = Array.isArray(merchant.stores) ? merchant.stores : [];
  var expanded = [];
  stores.forEach(function (store) {
    if (!store || typeof store !== 'object') return;
    var la = store.latitude != null ? store.latitude : store.lat;
    var lo = store.longitude != null ? store.longitude : store.lng;
    if (la == null || lo == null) return;
    var lat = Number(la);
    var lng = Number(lo);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    var row = Object.assign({}, merchant, {
      latitude: lat,
      longitude: lng,
      lat: lat,
      lng: lng,
      storeId: store.id != null ? store.id : merchant.storeId,
      address: store.address || merchant.address,
      city: store.city || merchant.city,
      state: store.state || merchant.state,
    });
    delete row.stores;
    expanded.push(row);
  });
  if (expanded.length) return expanded;
  var flat = flattenOfferMerchantForMap(merchant) || merchant;
  return pickMerchantLatLng(flat) ? [flat] : [];
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

function logOffersMapViewportDistance(source, centerLat, latDelta, lngDelta) {
  if (
    !Number.isFinite(centerLat) ||
    !Number.isFinite(latDelta) ||
    !Number.isFinite(lngDelta)
  ) {
    return;
  }
  var halfLat = Math.abs(latDelta) / 2;
  var halfLng = Math.abs(lngDelta) / 2;
  var heightMiles = milesBetween(
    centerLat - halfLat,
    0,
    centerLat + halfLat,
    0,
  );
  var widthMiles = milesBetween(
    centerLat,
    -halfLng,
    centerLat,
    halfLng,
  );
  var radiusMiles = Math.sqrt(
    widthMiles * widthMiles + heightMiles * heightMiles,
  ) / 2;
  console.log(
    '[HC offers map] viewport distance',
    source,
    'width=' + widthMiles.toFixed(1) + 'mi',
    'height=' + heightMiles.toFixed(1) + 'mi',
    'radius≈' + radiusMiles.toFixed(1) + 'mi',
  );
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
  var p = pickMerchantLatLng(m);
  if (p && Number.isFinite(userLat) && Number.isFinite(userLng)) {
    return milesBetween(userLat, userLng, p.lat, p.lng);
  }
  if (m != null && typeof m.distance === 'number' && Number.isFinite(m.distance)) {
    return m.distance;
  }
  return NaN;
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
    var closest = merchants
      .map(function (pt) {
        return {
          lat: pt.lat,
          lng: pt.lng,
          distance: milesBetween(userLat, userLng, pt.lat, pt.lng),
        };
      })
      .sort(function (a, b) {
        return a.distance - b.distance;
      })
      .slice(0, MAP_INITIAL_NEARBY_STORES);
    var nearbyLats = [userLat];
    var nearbyLngs = [userLng];
    closest.forEach(function (pt) {
      nearbyLats.push(pt.lat);
      nearbyLngs.push(pt.lng);
    });
    var nearbyMinLat = Math.min.apply(null, nearbyLats);
    var nearbyMaxLat = Math.max.apply(null, nearbyLats);
    var nearbyMinLng = Math.min.apply(null, nearbyLngs);
    var nearbyMaxLng = Math.max.apply(null, nearbyLngs);
    return {
      centerLat: (nearbyMinLat + nearbyMaxLat) / 2,
      centerLng: (nearbyMinLng + nearbyMaxLng) / 2,
      spanLat: Math.max((nearbyMaxLat - nearbyMinLat) * 1.4, 0.005),
      spanLon: Math.max((nearbyMaxLng - nearbyMinLng) * 1.4, 0.005),
    };
  }
  if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
    return {
      centerLat: userLat,
      centerLng: userLng,
      spanLat: MAP_USER_SPAN_DEG,
      spanLon: MAP_USER_SPAN_DEG,
    };
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
var MAP_MERCHANT_CLUSTER_ID = 'hc-merchant';

function syncMapKitMerchantClustering(container, region) {
  var span = region && region.span;
  if (!span || !Number.isFinite(span.latitudeDelta)) return;
  var clusteringIdentifier =
    span.latitudeDelta > MAPKIT_CLUSTER_MIN_LATITUDE_DELTA
      ? MAP_MERCHANT_CLUSTER_ID
      : null;
  (container._hcMkMerchantAnnotations || []).forEach(function (annotation) {
    if (!annotation) return;
    try {
      annotation.clusteringIdentifier = clusteringIdentifier;
    } catch (e) {}
  });
}

var OFFERS_MAP_PAN_DEBOUNCE_MS = 600;

function offersMapStoreKey(m) {
  var p = pickMerchantLatLng(m);
  var coord = p ? p.lat + ',' + p.lng : '';
  return String(m.id || m.storeId || (m.offerId ? m.offerId + '@' + coord : coord));
}

function resetOffersMapStores(container) {
  container._hcMapStores = [];
  container._hcMapStoreKeys = {};
}

function mergeOffersMapStores(container, list) {
  if (!container._hcMapStores) {
    container._hcMapStores = [];
    container._hcMapStoreKeys = {};
  }
  var added = [];
  (list || []).forEach(function (m) {
    expandMerchantLocationsForMap(m).forEach(function (row) {
      var key = offersMapStoreKey(row);
      if (!key || container._hcMapStoreKeys[key]) return;
      container._hcMapStoreKeys[key] = true;
      container._hcMapStores.push(row);
      added.push(row);
    });
  });
  return added;
}

function addMerchantPinsToLiveMap(container, merchants) {
  var loc = container._hcMapUserLoc || {};
  var data = [];
  (merchants || []).forEach(function (m) {
    var item = buildMerchantMarkerDataItem(m, loc.lat, loc.lng);
    if (item) data.push(item);
  });
  if (!data.length) return;

  var mk = container._hcMkMap;
  if (mk && window.mapkit) {
    try {
      if (!container._hcMkMerchantAnnotations) container._hcMkMerchantAnnotations = [];
      var anns = data.map(function (d) {
        return createMapKitMerchantAnnotation(window.mapkit, d, container);
      });
      mk.addAnnotations(anns);
      container._hcMkMerchantAnnotations = container._hcMkMerchantAnnotations.concat(anns);
      syncMapKitMerchantClustering(container, mk.region);
    } catch (e) {
      console.warn('[HC offers map] addAnnotations failed', e);
    }
    return;
  }

  var lf = container._hcLeafletMap;
  if (lf && window.L) {
    try {
      if (!container._hcLeafletMerchantMarkers) container._hcLeafletMerchantMarkers = [];
      var cluster = container._hcLeafletClusterGroup;
      if (!cluster && typeof window.L.markerClusterGroup === 'function') {
        cluster = window.L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 56,
          spiderfyOnMaxZoom: true,
          zoomToBoundsOnClick: true,
          disableClusteringAtZoom: MAP_LEAFLET_DISABLE_CLUSTERING_AT_ZOOM,
        });
        lf.addLayer(cluster);
        container._hcLeafletClusterGroup = cluster;
      }
      data.forEach(function (d) {
        var marker = window.L.marker([d.lat, d.lng], {
          icon: leafletMerchantPinIcon(window.L, d, false),
        });
        marker.on('click', function (ev) {
          if (ev && ev.originalEvent) {
            window.L.DomEvent.stopPropagation(ev.originalEvent);
            window.L.DomEvent.preventDefault(ev.originalEvent);
          }
          showSelectedMapMerchant(container, d.merchant);
        });
        if (cluster) {
          cluster.addLayer(marker);
        } else {
          marker.addTo(lf);
        }
        container._hcLeafletMerchantMarkers.push({ marker: marker, mk: d });
      });
    } catch (e2) {
      console.warn('[HC offers map] leaflet marker add failed', e2);
    }
  }
}

function handleLiveMapRegionChange(container, center, spanLatDeg) {
  if (typeof container._hcOnMapRegionPanned !== 'function') return;
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;

  var last = container._hcLastRegionFetchCenter;
  if (last) {
    var movedLat = Math.abs(center.lat - last.lat);
    var movedLng = Math.abs(center.lng - last.lng);
    var threshold = Math.max(Number.isFinite(spanLatDeg) ? spanLatDeg : 0.05, 0.01) * 0.25;
    if (movedLat < threshold && movedLng < threshold) return;
  }

  if (container._hcRegionDebounce) {
    window.clearTimeout(container._hcRegionDebounce);
  }
  container._hcRegionDebounce = window.setTimeout(function () {
    container._hcLastRegionFetchCenter = { lat: center.lat, lng: center.lng };
    container._hcOnMapRegionPanned(center.lat, center.lng);
  }, OFFERS_MAP_PAN_DEBOUNCE_MS);
}

var offersLeafletLoadPromise = null;

function destroyOffersMapInstance(container) {
  if (container._hcRegionDebounce) {
    window.clearTimeout(container._hcRegionDebounce);
    container._hcRegionDebounce = null;
  }
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
  container._hcLeafletClusterGroup = null;
  container._hcLeafletMerchantMarkers = [];
  container._hcMkMerchantAnnotations = [];
  hideSelectedMapMerchant(container);
}

function focusOffersMap(container, lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  var lf = container._hcLeafletMap;
  if (lf && typeof lf.setView === 'function') {
    lf.setView([lat, lng], MAP_USER_ZOOM_LEAFLET, { animate: true });
    return;
  }

  var mk = container._hcMkMap;
  if (mk && window.mapkit) {
    try {
      var Coord = window.mapkit.Coordinate;
      var Region = window.mapkit.CoordinateRegion;
      var Span = window.mapkit.CoordinateSpan;
      var center = new Coord(lat, lng);
      var span = new Span(MAP_USER_SPAN_DEG, MAP_USER_SPAN_DEG);
      var region = new Region(center, span);
      if (typeof mk.setRegionAnimated === 'function') {
        mk.setRegionAnimated(region, true);
      } else {
        mk.region = region;
      }
    } catch (e) {
      console.warn('[HC offers map] focusOffersMap failed', e);
    }
  }
}

function leafletMapPinIcon(L, fillHex) {
  var html =
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36" aria-hidden="true">' +
    '<path fill="' +
    fillHex +
    '" stroke="#ffffff" stroke-width="1.5" d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z"/>' +
    '</svg>';
  return L.divIcon({
    className: 'hc-map-pin-icon',
    html: html,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -34],
  });
}

function resolveMerchantLogoUrl(m) {
  if (!m || typeof m !== 'object') return '';
  return (
    m.logoUrl ||
    m.logo ||
    m.small_logo_url ||
    m.smallLogoUrl ||
    m.large_logo_url ||
    m.largeLogoUrl ||
    ''
  );
}

function formatMerchantCardLocation(m) {
  if (!m || typeof m !== 'object') return '';
  var parts = [m.city, m.state, m.country || m.country_name || 'United States'].filter(
    function (part) {
      return typeof part === 'string' && part.trim().length > 0;
    }
  );
  if (parts.length) return parts.join(', ');
  var addressParts = [m.address, m.city, m.state].filter(function (part) {
    return typeof part === 'string' && part.trim().length > 0;
  });
  return addressParts.join(', ');
}

function normalizeMerchantMapName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isFeaturedMapMerchant(container, merchant) {
  if (!merchant) return false;
  var featured = (container && container._hcFeaturedMapOffers) || [];
  if (!featured.length) return false;
  var offerId = merchant.offerId || merchant.offer_id;
  if (offerId) {
    var idStr = String(offerId).trim();
    for (var i = 0; i < featured.length; i++) {
      var fid = featured[i] && (featured[i].offer_id || featured[i].offerId);
      if (fid && String(fid).trim() === idStr) return true;
    }
  }
  var name = normalizeMerchantMapName(merchant.name || merchant.merchantName);
  if (!name) return false;
  for (var j = 0; j < featured.length; j++) {
    var fname = normalizeMerchantMapName(
      (featured[j] && (featured[j].name || featured[j].merchantName)) || ''
    );
    if (fname && fname === name) return true;
  }
  return false;
}

function buildMerchantPinHtml(mk, selected) {
  var size = selected ? 44 : 40;
  var tipW = selected ? 18 : 16;
  var tipH = selected ? 11 : 10;
  var border = selected ? 3 : 2.5;
  var logoUrl = (mk && mk.logoUrl) || resolveMerchantLogoUrl(mk && mk.merchant);
  var name = (mk && mk.name) || (mk && mk.merchant && (mk.merchant.name || mk.merchant.merchantName)) || '?';
  var initial = String(name).trim().charAt(0).toUpperCase() || '?';
  var inner = logoUrl
    ? '<img data-hc-ph="store" src="' +
      escapeAttr(logoUrl) +
      '" alt="" class="hc-merchant-pin-img" />'
    : '<span class="hc-merchant-pin-fallback">' + escapeHtml(initial) + '</span>';
  return (
    '<div class="hc-merchant-pin' +
    (selected ? ' hc-merchant-pin--selected' : '') +
    '" style="--hc-pin-size:' +
    size +
    'px;--hc-pin-border:' +
    border +
    'px;--hc-pin-tip-w:' +
    tipW / 2 +
    'px;--hc-pin-tip-h:' +
    tipH +
    'px">' +
    '<div class="hc-merchant-pin-head">' +
    inner +
    '</div>' +
    '<div class="hc-merchant-pin-tip" aria-hidden="true"></div>' +
    '</div>'
  );
}

function leafletMerchantPinIcon(L, mk, selected) {
  return L.divIcon({
    className: 'hc-merchant-pin-icon',
    html: buildMerchantPinHtml(mk, !!selected),
    iconSize: selected ? [44, 55] : [40, 50],
    iconAnchor: selected ? [22, 55] : [20, 50],
  });
}

function buildMapCardHomecrowdBadgeHtml() {
  return (
    '<span class="hc-map-merchant-card-hc-badge" aria-hidden="true">' +
    '<img data-hc-ph="none" src="' +
    escapeAttr(iconTransparentUrl) +
    '" alt="" />' +
    '</span>'
  );
}

function buildSelectedMerchantCardHtml(merchant, recommended) {
  var name = (merchant && (merchant.name || merchant.merchantName)) || 'Store';
  var location = formatMerchantCardLocation(merchant);
  var logoUrl = resolveMerchantLogoUrl(merchant);
  return (
    '<div class="hc-map-merchant-card">' +
    '<button type="button" class="hc-map-merchant-card-logo-btn" data-hc-map-merchant-open="1">' +
    '<span class="hc-map-merchant-card-logo">' +
    (recommended ? buildMapCardHomecrowdBadgeHtml() : '') +
    (logoUrl
      ? '<img data-hc-ph="store" data-hc-square src="' + escapeAttr(logoUrl) + '" alt="" />'
      : '<span class="hc-map-merchant-card-logo-ph hc-img-ph hc-img-ph--store"></span>') +
    '</span>' +
    '</button>' +
    '<div class="hc-map-merchant-card-content">' +
    '<button type="button" class="hc-map-merchant-card-main" data-hc-map-merchant-open="1">' +
    '<span class="hc-map-merchant-card-name">' +
    escapeHtml(name) +
    '</span>' +
    (location
      ? '<span class="hc-map-merchant-card-loc">' + escapeHtml(location) + '</span>'
      : '') +
    '</button>' +
    '<button type="button" class="hc-map-merchant-card-directions" data-hc-map-directions="1">Get Directions</button>' +
    '</div>' +
    '</div>'
  );
}

function getMapUserLatLng(container) {
  if (container && container._hcMapUserLoc) {
    var loc = container._hcMapUserLoc;
    if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
      return { lat: Number(loc.lat), lng: Number(loc.lng) };
    }
  }
  var active = getActiveOfferLocation();
  if (active && Number.isFinite(Number(active.latitude)) && Number.isFinite(Number(active.longitude))) {
    return { lat: Number(active.latitude), lng: Number(active.longitude) };
  }
  return null;
}

function buildMerchantDirectionsDestination(merchant) {
  var point = pickMerchantLatLng(merchant);
  var name = (merchant && (merchant.name || merchant.merchantName)) || 'Store';
  var address = '';
  if (merchant) {
    if (merchant.address) {
      address = String(merchant.address);
      if (merchant.city) address += ', ' + merchant.city;
      if (merchant.state) address += ', ' + merchant.state;
    } else {
      address = formatMerchantCardLocation(merchant);
    }
  }
  var query = point ? point.lat + ',' + point.lng : address || name;
  return {
    name: name,
    address: address,
    query: query,
    lat: point ? point.lat : null,
    lng: point ? point.lng : null,
  };
}

function openMapDirectionsPicker(container, merchant) {
  openDirectionsPicker(
    buildMerchantDirectionsDestination(merchant),
    getMapUserLatLng(container)
  );
}

function hideSelectedMapMerchant(container) {
  if (!container) return;
  container._hcSelectedMapMerchant = null;
  var slot = container.querySelector('#hc-offers-map-merchant-card');
  if (slot) {
    slot.style.display = 'none';
    slot.hidden = true;
    slot.innerHTML = '';
  }
  syncSelectedMerchantPinStyles(container, null);
}

function openMapMerchantFromCard(merchant) {
  if (!merchant) return;
  var offerId = merchant.offerId || merchant.offer_id || merchant.id;
  var offerSource = merchant.offerSource || merchant.offer_source || '';
  var offerType = merchant.offerType || merchant.offer_type || '';
  if (offerSource === 'wildfire' || offerType === 'click' || offerType === 'click_sso') {
    openFeaturedClickStore(merchant);
    return;
  }
  if (offerId) {
    try {
      sessionStorage.setItem(
        'hc_offer_detail_initial',
        JSON.stringify({ offerId: String(offerId), offer: merchant })
      );
    } catch (_e) {}
    window.location.hash = '#/offers/' + encodeURIComponent(offerId);
  }
}

function showSelectedMapMerchant(container, merchant) {
  if (!container || !merchant) return;
  container._hcSelectedMapMerchant = merchant;
  container._hcIgnoreMapDismissUntil = Date.now() + 400;
  var slot = container.querySelector('#hc-offers-map-merchant-card');
  if (!slot) return;
  var recommended = isFeaturedMapMerchant(container, merchant);
  slot.innerHTML = buildSelectedMerchantCardHtml(merchant, recommended);
  slot.hidden = false;
  slot.style.display = 'block';
  var openBtns = slot.querySelectorAll('[data-hc-map-merchant-open]');
  openBtns.forEach(function (openBtn) {
    openBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openMapMerchantFromCard(merchant);
    });
  });
  var directionsBtn = slot.querySelector('[data-hc-map-directions]');
  if (directionsBtn) {
    // Both maps forward to the offer rather than launching the picker here —
    // the detail page carries its own "Get directions", so the address and the
    // rest of the offer stay in one place.
    directionsBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openMapMerchantFromCard(merchant);
    });
  }
  syncSelectedMerchantPinStyles(container, merchant);
  var location = pickMerchantLatLng(merchant);
  if (location) {
    focusOffersMap(container, location.lat, location.lng);
  }
}

function shouldIgnoreMapDismiss(container) {
  return !!(
    container &&
    container._hcIgnoreMapDismissUntil &&
    Date.now() < container._hcIgnoreMapDismissUntil
  );
}

function dismissSelectedMapMerchant(container) {
  if (shouldIgnoreMapDismiss(container)) return;
  hideSelectedMapMerchant(container);
}

function syncSelectedMerchantPinStyles(container, merchant) {
  var selectedKey = merchant ? offersMapStoreKey(merchant) : '';
  var leafletMarkers = container._hcLeafletMerchantMarkers || [];
  leafletMarkers.forEach(function (entry) {
    if (!entry || !entry.marker || !entry.mk) return;
    var key = entry.mk.key || (entry.mk.merchant ? offersMapStoreKey(entry.mk.merchant) : '');
    var selected = !!(selectedKey && key && String(selectedKey) === String(key));
    try {
      entry.marker.setIcon(leafletMerchantPinIcon(window.L, entry.mk, selected));
    } catch (_e) {}
  });
  var anns = container._hcMkMerchantAnnotations || [];
  anns.forEach(function (ann) {
    if (!ann) return;
    var key = ann._hcKey || '';
    var selected = !!(selectedKey && key && String(selectedKey) === String(key));
    var mk = ann._hcMarkerData;
    if (!mk) return;
    try {
      var html = buildMerchantPinHtml(mk, selected);
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      var next = tmp.firstElementChild;
      var el = ann.element;
      if (el && next) {
        el.className = next.className;
        el.setAttribute('style', next.getAttribute('style') || '');
        el.innerHTML = next.innerHTML;
      }
    } catch (_e2) {}
  });
}

function buildMerchantMarkerDataItem(m, userLat, userLng) {
  var p = pickMerchantLatLng(m);
  if (!p) return null;
  return {
    lat: p.lat,
    lng: p.lng,
    name: m.name || m.merchantName || '',
    subtitle: storeMapMerchantMapKitSubtitle(m, userLat, userLng),
    logoUrl: resolveMerchantLogoUrl(m),
    key: offersMapStoreKey(m),
    merchant: m,
  };
}

function createMapKitMerchantAnnotation(mapkit, mk, container) {
  var Coord = mapkit.Coordinate;
  var Ann = mapkit.Annotation;
  var factory = function () {
    var wrap = document.createElement('div');
    wrap.innerHTML = buildMerchantPinHtml(mk, false);
    var el = wrap.firstElementChild || wrap;
    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (container) showSelectedMapMerchant(container, mk.merchant);
    });
    return el;
  };
  var pinW = 40;
  // The teardrop is 25x28.5 in the design — 1.14 tall for its width — and the
  // point is the bottom of the shape, so the box is the shape.
  var pinH = 46;
  var ann = new Ann(new Coord(mk.lat, mk.lng), factory, {
    size: { width: pinW, height: pinH },
    anchorOffset: new DOMPoint(0, -pinH),
    calloutEnabled: false,
    animates: false,
    clusteringIdentifier: MAP_MERCHANT_CLUSTER_ID,
    collisionMode: mapkit.Annotation.CollisionMode
      ? mapkit.Annotation.CollisionMode.Circle
      : 'circle',
  });
  ann._hcMerchant = mk.merchant;
  ann._hcMarkerData = mk;
  ann._hcKey = mk.key;
  return ann;
}

function buildMapKitClusterAnnotation(mapkit, clusterAnnotation, getMap) {
  var members = clusterAnnotation.memberAnnotations || [];
  var count = members.length || 0;
  var size = count >= 25 ? 52 : count >= 10 ? 46 : 40;
  var factory = function () {
    var el = document.createElement('div');
    el.className = 'hc-map-cluster';
    el.style.setProperty('--hc-cluster-size', size + 'px');
    el.textContent = String(count);
    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      zoomMapKitToClusterMembers(typeof getMap === 'function' ? getMap() : null, mapkit, members);
    });
    return el;
  };
  var ann = new mapkit.Annotation(clusterAnnotation.coordinate, factory, {
    size: { width: size, height: size },
    anchorOffset: new DOMPoint(0, -size / 2),
    calloutEnabled: false,
    animates: false,
    clusteringIdentifier: MAP_MERCHANT_CLUSTER_ID,
  });
  ann._hcClusterMembers = members;
  return ann;
}

function zoomMapKitToClusterMembers(map, mapkit, members) {
  if (!map || !members || !members.length) return;
  try {
    if (typeof map.showItems === 'function') {
      var showOpts = { animate: true };
      if (mapkit.Padding) {
        showOpts.padding = new mapkit.Padding(48, 48, 48, 48);
      }
      map.showItems(members, showOpts);
      return;
    }
  } catch (e) {}
  try {
    var lats = [];
    var lngs = [];
    members.forEach(function (ann) {
      var c = ann && ann.coordinate;
      if (!c) return;
      if (Number.isFinite(c.latitude)) lats.push(c.latitude);
      if (Number.isFinite(c.longitude)) lngs.push(c.longitude);
    });
    if (!lats.length) return;
    var minLat = Math.min.apply(null, lats);
    var maxLat = Math.max.apply(null, lats);
    var minLng = Math.min.apply(null, lngs);
    var maxLng = Math.max.apply(null, lngs);
    var center = new mapkit.Coordinate((minLat + maxLat) / 2, (minLng + maxLng) / 2);
    var span = new mapkit.CoordinateSpan(
      Math.max((maxLat - minLat) * 1.6, 0.01),
      Math.max((maxLng - minLng) * 1.6, 0.01),
    );
    var region = new mapkit.CoordinateRegion(center, span);
    if (typeof map.setRegionAnimated === 'function') {
      map.setRegionAnimated(region, true);
    } else {
      map.region = region;
    }
  } catch (e2) {
    console.warn('[HC offers map] cluster zoom failed', e2);
  }
}

function wireMapSelectionHandlers(container, mapMount) {
  if (!container || container._hcMapSelectWired) return;
  container._hcMapSelectWired = true;
  if (mapMount) {
    mapMount.addEventListener('click', function (e) {
      if (
        e.target &&
        e.target.closest &&
        e.target.closest(
          '.hc-merchant-pin, .hc-map-cluster, .hc-map-merchant-card, .hc-offers-map-merchant-card, .marker-cluster',
        )
      ) {
        return;
      }
      dismissSelectedMapMerchant(container);
    });
  }
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

function ensureLeafletLoaded() {
  if (window.L && typeof window.L.markerClusterGroup === 'function') {
    return Promise.resolve(window.L);
  }
  if (offersLeafletLoadPromise) return offersLeafletLoadPromise;

  offersLeafletLoadPromise = new Promise(function (resolve, reject) {
    offersMapLinkOnce('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'leaflet');
    offersMapLinkOnce(
      'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
      'markercluster',
    );
    offersMapLinkOnce(
      'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
      'markercluster-default',
    );

    var urls = [];
    if (!window.L) {
      urls.push('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    }
    if (!window.L || typeof window.L.markerClusterGroup !== 'function') {
      urls.push('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js');
    }

    function finish() {
      if (!window.L) {
        reject(new Error('Leaflet is not available'));
        return;
      }
      if (typeof window.L.markerClusterGroup !== 'function') {
        console.warn('[HC offers map] MarkerCluster missing after load');
      } else {
        console.log('[HC offers map] Leaflet + MarkerCluster ready');
      }
      resolve(window.L);
    }

    if (urls.length === 0) {
      finish();
      return;
    }

    offersLoadScriptSequential(urls, 0, finish, function (err) {
      if (window.L) {
        console.warn('[HC offers map] script load issue, continuing with Leaflet', err);
        finish();
        return;
      }
      reject(err);
    });
  }).catch(function (e) {
    offersLeafletLoadPromise = null;
    throw e;
  });

  return offersLeafletLoadPromise;
}

function clearLeafletMapMount(mapMount) {
  if (!mapMount) return;
  try {
    if (mapMount._leaflet_id) mapMount._leaflet_id = null;
  } catch (e) {}
  mapMount.innerHTML = '';
}

function attachOffersLeafletBaseLayer(L, map) {
  var layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
    crossOrigin: true,
  });
  layer.on('tileerror', function (event) {
    console.warn(
      '[HC offers map] OSM tile failed',
      event && event.coords ? event.coords : '',
    );
  });
  layer.addTo(map);
  return 'osm';
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

function notifyMapRenderDone(container) {
  var cb = container._hcMapRenderDone;
  container._hcMapRenderDone = null;
  if (typeof cb === 'function') {
    try {
      cb();
    } catch (e) {
      console.warn('[HC offers map] render done callback failed', e);
    }
  }
  applyPendingMapMerchantSelection(container);
}

function consumePendingMapMerchantSelection() {
  try {
    var raw = sessionStorage.getItem('hc_map_select_merchant');
    if (!raw) return null;
    sessionStorage.removeItem('hc_map_select_merchant');
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_e) {
    return null;
  }
}

function flattenOfferMerchantForMap(merchant) {
  if (!merchant || typeof merchant !== 'object') return null;
  var store = merchant.stores && merchant.stores[0];
  var out = Object.assign({}, merchant);
  if (store && typeof store === 'object') {
    if (out.latitude == null && store.latitude != null) out.latitude = store.latitude;
    if (out.longitude == null && store.longitude != null) out.longitude = store.longitude;
    if (out.lat == null && store.lat != null) out.lat = store.lat;
    if (out.lng == null && store.lng != null) out.lng = store.lng;
    if (!out.address && store.address) out.address = store.address;
    if (!out.city && store.city) out.city = store.city;
    if (!out.state && store.state) out.state = store.state;
    if (!out.name && store.name) out.name = store.name;
    if (out.id == null && store.id != null) out.id = store.id;
  }
  return out;
}

function merchantMatchesMapSelection(m, selection) {
  if (!m || !selection) return false;
  var wanted = flattenOfferMerchantForMap(selection.merchant) || selection.merchant || {};
  var ids = [
    selection.offerId,
    wanted.offer_id,
    wanted.offerId,
    wanted.id,
    wanted.storeId,
  ]
    .filter(function (v) {
      return v != null && String(v).trim() !== '';
    })
    .map(function (v) {
      return String(v).trim();
    });
  var candidates = [m.id, m.storeId, m.offer_id, m.offerId]
    .filter(function (v) {
      return v != null && String(v).trim() !== '';
    })
    .map(function (v) {
      return String(v).trim();
    });
  for (var i = 0; i < candidates.length; i++) {
    if (ids.indexOf(candidates[i]) >= 0) return true;
  }
  var n1 = normalizeMerchantMapName(m.name || m.merchantName);
  var n2 = normalizeMerchantMapName(wanted.name || wanted.merchantName);
  if (!n1 || !n2 || n1 !== n2) return false;
  var p1 = pickMerchantLatLng(m);
  var p2 = pickMerchantLatLng(wanted);
  if (p1 && p2) {
    return Math.abs(p1.lat - p2.lat) < 0.002 && Math.abs(p1.lng - p2.lng) < 0.002;
  }
  return true;
}

function applyPendingMapMerchantSelection(container) {
  if (!container || !container._hcPendingMapSelect) return;
  var selection = container._hcPendingMapSelect;
  container._hcPendingMapSelect = null;
  var wanted = flattenOfferMerchantForMap(selection.merchant) || selection.merchant;
  var stores = container._hcMapStores || [];
  var match = null;
  for (var i = 0; i < stores.length; i++) {
    if (merchantMatchesMapSelection(stores[i], selection)) {
      match = stores[i];
      break;
    }
  }
  if (!match && wanted && pickMerchantLatLng(wanted)) {
    mergeOffersMapStores(container, [wanted]);
    addMerchantPinsToLiveMap(container, [wanted]);
    match = wanted;
  }
  if (!match) {
    console.warn('[HC offers map] pending merchant not found on map', selection);
    return;
  }
  showSelectedMapMerchant(container, match);
  var loc = pickMerchantLatLng(match);
  if (loc) {
    window.setTimeout(function () {
      focusOffersMap(container, loc.lat, loc.lng);
    }, 80);
  }
}

function renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData, showUserMarker) {
  if (showUserMarker === undefined) showUserMarker = true;
  var renderId = (container._hcLeafletRenderId = (container._hcLeafletRenderId || 0) + 1);
  ensureLeafletLoaded()
    .then(function (L) {
      if (renderId !== container._hcLeafletRenderId) return;
      destroyOffersMapInstance(container);
      clearLeafletMapMount(mapMount);
      mapMount.classList.remove('hc-offers-map-loading');
      mapMount.removeAttribute('aria-busy');
      mapMount.classList.add('hc-offers-map-osm-fallback');
      var map = L.map(mapMount, { maxZoom: 19 }).setView(
        [userLat, userLng],
        MAP_USER_ZOOM_LEAFLET,
      );
      container._hcLeafletMap = map;
      container._hcLeafletMerchantMarkers = [];
      container._hcMkMerchantAnnotations = [];
      attachOffersLeafletBaseLayer(L, map);

      var userIcon = leafletMapPinIcon(L, MAP_PIN_USER_COLOR);
      var userMarker = null;
      if (showUserMarker) {
        userMarker = L.marker([userLat, userLng], {
          icon: userIcon,
          zIndexOffset: 1000,
        }).addTo(map);
      }

      var clusterGroup =
        typeof L.markerClusterGroup === 'function'
          ? L.markerClusterGroup({
              showCoverageOnHover: false,
              maxClusterRadius: 56,
              spiderfyOnMaxZoom: true,
              zoomToBoundsOnClick: true,
              disableClusteringAtZoom: MAP_LEAFLET_DISABLE_CLUSTERING_AT_ZOOM,
            })
          : null;
      container._hcLeafletClusterGroup = clusterGroup;

      merchantMarkerData.forEach(function (mk) {
        var marker = L.marker([mk.lat, mk.lng], {
          icon: leafletMerchantPinIcon(L, mk, false),
        });
        marker.on('click', function (ev) {
          if (ev && ev.originalEvent) {
            L.DomEvent.stopPropagation(ev.originalEvent);
            L.DomEvent.preventDefault(ev.originalEvent);
          }
          showSelectedMapMerchant(container, mk.merchant);
        });
        if (clusterGroup) {
          clusterGroup.addLayer(marker);
        } else {
          marker.addTo(map);
        }
        container._hcLeafletMerchantMarkers.push({ marker: marker, mk: mk });
      });
      if (clusterGroup) {
        map.addLayer(clusterGroup);
      }

      wireMapSelectionHandlers(container, mapMount);
      map.on('click', function () {
        dismissSelectedMapMerchant(container);
      });

      if (merchantMarkerData.length > 0) {
        var box = computeMapKitRegionLikeStoreMap(
          showUserMarker ? userLat : NaN,
          showUserMarker ? userLng : NaN,
          merchantMarkerData,
        );
        map.fitBounds(
          [
            [box.centerLat - box.spanLat / 2, box.centerLng - box.spanLon / 2],
            [box.centerLat + box.spanLat / 2, box.centerLng + box.spanLon / 2],
          ],
          { animate: false },
        );
      } else {
        map.setView([userLat, userLng], MAP_USER_ZOOM_LEAFLET, { animate: false });
      }
      window.setTimeout(function () {
        if (renderId !== container._hcLeafletRenderId) return;
        if (container._hcLeafletMap !== map) return;
        try {
          map.invalidateSize();
          var fittedCenter = map.getCenter();
          var fittedBounds = map.getBounds();
          container._hcLastRegionFetchCenter = { lat: fittedCenter.lat, lng: fittedCenter.lng };
          logOffersMapViewportDistance(
            'Leaflet',
            fittedCenter.lat,
            Math.abs(fittedBounds.getNorth() - fittedBounds.getSouth()),
            Math.abs(fittedBounds.getEast() - fittedBounds.getWest()),
          );
          map.on('moveend', function () {
            var c = map.getCenter();
            var b = map.getBounds();
            logOffersMapViewportDistance(
              'Leaflet',
              c.lat,
              Math.abs(b.getNorth() - b.getSouth()),
              Math.abs(b.getEast() - b.getWest()),
            );
            handleLiveMapRegionChange(
              container,
              { lat: c.lat, lng: c.lng },
              Math.abs(b.getNorth() - b.getSouth()),
            );
          });
        } catch (e) {
          console.warn('[HC offers map] leaflet post-layout failed', e);
        }
        notifyMapRenderDone(container);
      }, 100);
    })
    .catch(function (err) {
      if (renderId !== container._hcLeafletRenderId) return;
      console.error('[HC offers map] Leaflet failed', err);
      destroyOffersMapInstance(container);
      mapMount.classList.remove('hc-offers-map-loading');
      mapMount.removeAttribute('aria-busy');
      mapMount.innerHTML =
        '<div class="hc-offers-map-unavailable">' +
        escapeHtml('Map could not be loaded. Please try again later.') +
        '</div>';
      notifyMapRenderDone(container);
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

function renderMapWithMapKit(container, mapMount, mapkit, userLat, userLng, merchantMarkerData, showUserMarker) {
  if (showUserMarker === undefined) showUserMarker = true;
  if (mapKitAuthFailureWasReported()) {
    console.warn('[HC offers map] MapKit auth failure before render, using OpenStreetMap fallback');
    renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData, showUserMarker);
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
  var annotations = [];
  var merchantAnnotations = [];
  if (showUserMarker) {
    annotations.push(
      new Mai(userCoord, {
        title: 'Your Location',
        color: MAP_PIN_USER_COLOR,
        calloutEnabled: false,
        titleVisibility: 'hidden',
        callout: calloutDel,
      }),
    );
  }

  merchantMarkerData.forEach(function (mk) {
    try {
      var ann = createMapKitMerchantAnnotation(mapkit, mk, container);
      annotations.push(ann);
      merchantAnnotations.push(ann);
    } catch (annErr) {
      var label = (mk.name || '').trim() || 'Partner store';
      var fallback = new Mai(new Coord(mk.lat, mk.lng), {
        title: label,
        subtitle: (mk.subtitle || '').trim(),
        color: MAP_PIN_MERCHANT_COLOR,
        calloutEnabled: false,
        titleVisibility: 'hidden',
        subtitleVisibility: 'hidden',
        clusteringIdentifier: MAP_MERCHANT_CLUSTER_ID,
      });
      fallback._hcMerchant = mk.merchant;
      fallback._hcMarkerData = mk;
      fallback._hcKey = mk.key;
      annotations.push(fallback);
      merchantAnnotations.push(fallback);
    }
  });
  container._hcMkMerchantAnnotations = merchantAnnotations;

  var regionBox = computeMapKitRegionLikeStoreMap(
    showUserMarker ? userLat : NaN,
    showUserMarker ? userLng : NaN,
    merchantMarkerData,
  );
  var mapCenterCoord = new Coord(regionBox.centerLat, regionBox.centerLng);
  var startSpan = new Span(regionBox.spanLat, regionBox.spanLon);
  var clusterAtStart =
    startSpan.latitudeDelta > MAPKIT_CLUSTER_MIN_LATITUDE_DELTA
      ? MAP_MERCHANT_CLUSTER_ID
      : null;
  merchantAnnotations.forEach(function (annotation) {
    annotation.clusteringIdentifier = clusterAtStart;
  });
  var M = mapkit.Map;

  function createMapAndAnnotations() {
    if (mapKitAuthFailureWasReported()) {
      console.warn('[HC offers map] MapKit auth failure detected, using OpenStreetMap fallback');
      renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData, showUserMarker);
      return;
    }
    var mapOpts = {
      region: new Region(mapCenterCoord, startSpan),
      mapType: 'standard',
      colorScheme: 'light',
      showsZoomControl: true,
      showsMapTypeControl: false,
      showsPointsOfInterest: true,
      annotationForCluster: function (clusterAnnotation) {
        return buildMapKitClusterAnnotation(mapkit, clusterAnnotation, function () {
          return container._hcMkMap || map;
        });
      },
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
      renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData, showUserMarker);
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
      renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData, showUserMarker);
      return;
    }
    container._hcMkMap = map;
    container._hcMkMerchantAnnotations = merchantAnnotations;
    try {
      map.addEventListener('error', onMapKitFallbackTrigger);
    } catch (e4) {}
    map.addAnnotations(annotations);
    try {
      var framed = new Region(mapCenterCoord, startSpan);
      if (typeof map.setRegionAnimated === 'function') {
        map.setRegionAnimated(framed, false);
      } else {
        map.region = framed;
      }
    } catch (regionErr) {}
    console.log('[HC offers map] annotations:', annotations.length);
    try {
      map.addEventListener('select', function (event) {
        var ann = event && event.annotation;
        if (!ann) return;
        if (ann._hcMerchant) {
          showSelectedMapMerchant(container, ann._hcMerchant);
          return;
        }
        var members = ann.memberAnnotations || ann._hcClusterMembers;
        if (members && members.length) {
          zoomMapKitToClusterMembers(map, mapkit, members);
          try {
            if (typeof map.deselectAnnotation === 'function') {
              map.deselectAnnotation(ann);
            } else {
              ann.selected = false;
            }
          } catch (eDeselect) {}
        }
      });
      map.addEventListener('deselect', function () {
        dismissSelectedMapMerchant(container);
      });
    } catch (selErr) {
      console.warn('[HC offers map] select listeners failed', selErr);
    }
    wireMapSelectionHandlers(container, mapMount);
    scheduleMapKitTileReflow(map);
    window.setTimeout(function () {
      try {
        var c = map.center;
        if (c) {
          container._hcLastRegionFetchCenter = { lat: c.latitude, lng: c.longitude };
        }
        var initialSpan = map.region && map.region.span;
        if (c && initialSpan) {
          logOffersMapViewportDistance(
            'MapKit',
            c.latitude,
            initialSpan.latitudeDelta,
            initialSpan.longitudeDelta,
          );
        }
        map.addEventListener('region-change-end', function () {
          try {
            var cc = map.center;
            var span = map.region && map.region.span;
            if (span) {
              syncMapKitMerchantClustering(container, map.region);
              logOffersMapViewportDistance(
                'MapKit',
                cc.latitude,
                span.latitudeDelta,
                span.longitudeDelta,
              );
            }
            handleLiveMapRegionChange(
              container,
              { lat: cc.latitude, lng: cc.longitude },
              span ? span.latitudeDelta : 0.05,
            );
          } catch (e5) {}
        });
      } catch (e6) {}
      notifyMapRenderDone(container);
    }, 150);
  }

  whenOffersMapMountLaidOut(mapMount, createMapAndAnnotations);
}

function initOffersMap(container, cardlinked) {
  var promptEl = container.querySelector('#hc-offers-location-prompt');
  var loadingEl = container.querySelector('#hc-offers-location-loading');
  var noStoresEl = container.querySelector('#hc-offers-no-stores');
  var mapShell = container.querySelector('#hc-offers-map-shell');
  var mapLocationWrap = container.querySelector('#hc-offers-map-location-wrap');
  var mapMount = container.querySelector('#hc-offers-map-mount');
  var mapSearchInput = container.querySelector('#hc-offers-map-search-input');
  var mapSearchBtn = container.querySelector('#hc-offers-map-search-btn');
  var mapSearchSuggestions = container.querySelector('#hc-offers-map-search-suggestions');
  var mapMyLocationBtn = container.querySelector('#hc-offers-map-my-location');
  var mapBusyOverlay = container.querySelector('#hc-offers-map-busy-overlay');
  var btn = container.querySelector('#hc-offers-enable-loc');
  if (!mapMount || !promptEl) return;

  var locationKnown = false;
  var hasUserMapLocation = false;
  var currentMapSuggestions = [];
  var mapSearchBlurTimer = null;

  container._hcCardlinkedStores = Array.isArray(cardlinked) ? cardlinked : [];

  function setNoStoresMessage(hasLocation) {
    var textEl = container.querySelector('#hc-offers-no-stores-text');
    if (!textEl) return;
    var canSearch = !!container.querySelector('#hc-offers-map-search-input');
    textEl.textContent = hasLocation
      ? 'There are no supported stores in your area.'
      : canSearch
        ? 'Search for a city or zip code to discover nearby stores.'
        : 'Enable location to discover nearby stores.';
  }

  function showNoStoresIfEmpty(list) {
    if (!noStoresEl) return;
    noStoresEl.style.display = Array.isArray(list) && list.length === 0 ? '' : 'none';
    if (Array.isArray(list) && list.length === 0) {
      setNoStoresMessage(hasUserMapLocation);
    }
  }

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
    locationKnown = true;
    if (loadingEl) loadingEl.style.display = 'none';
    promptEl.style.display = 'none';
    if (mapLocationWrap) mapLocationWrap.style.display = '';
    if (mapShell) mapShell.style.display = '';
    else mapMount.style.display = '';
  }

  function setLocationPromptMessage(message) {
    var textEl = container.querySelector('#hc-offers-location-prompt-text');
    if (textEl) {
      textEl.textContent = message || OFFERS_LOCATION_PROMPT_DEFAULT;
    }
  }

  function showPromptUI(message) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (message) setLocationPromptMessage(message);
    promptEl.style.display = '';
    if (mapLocationWrap) mapLocationWrap.style.display = 'none';
    if (mapShell) mapShell.style.display = 'none';
    else mapMount.style.display = 'none';
    mapMount.classList.remove('hc-offers-map-loading');
    mapMount.classList.remove('hc-offers-map-osm-fallback');
    mapMount.removeAttribute('aria-busy');
    mapMount.innerHTML = '';
  }

  function showLoadingUI() {
    if (loadingEl) loadingEl.style.display = '';
    promptEl.style.display = 'none';
    if (mapLocationWrap) mapLocationWrap.style.display = 'none';
    if (mapShell) mapShell.style.display = 'none';
    else mapMount.style.display = 'none';
  }

  function setMapShellLoading(active) {
    if (mapBusyOverlay) {
      mapBusyOverlay.style.display = active ? '' : 'none';
      mapBusyOverlay.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
    if (mapShell) {
      mapShell.classList.toggle('hc-offers-map-shell--busy', !!active);
    }
    if (active) hideMapSuggestions();
    if (mapSearchInput) mapSearchInput.disabled = !!active;
    if (mapSearchBtn) mapSearchBtn.disabled = !!active;
    if (mapMyLocationBtn) mapMyLocationBtn.disabled = !!active;
  }

  function setStoresGridLoading(active) {
    var grid = document.getElementById('hc-stores-grid');
    if (!grid) return;
    if (active) {
      grid.innerHTML = gridSkeletonHtml();
    }
  }

  function setMapRegionLoading(active) {
    var host = mapShell || mapMount;
    if (!host) return;
    var pill = host.querySelector('.hc-offers-map-region-loading');
    if (active) {
      if (!pill) {
        pill = document.createElement('div');
        pill.className = 'hc-offers-map-region-loading';
        pill.innerHTML =
          '<span class="hc-offers-map-region-loading-spinner" aria-hidden="true"></span>' +
          '<span>Finding offers…</span>';
        host.appendChild(pill);
      }
      pill.style.display = '';
    } else if (pill) {
      pill.style.display = 'none';
    }
  }

  function renderStoresGridFromList(list) {
    fillStoresGrid(document.getElementById('hc-stores-grid'), list, container);
  }

  function withUserDistances(list) {
    var loc = container._hcMapUserLoc;
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return list;
    return list.map(function (m) {
      var p = pickMerchantLatLng(m);
      if (!p) return m;
      var copy = {};
      for (var k in m) copy[k] = m[k];
      copy.distance = milesBetween(loc.lat, loc.lng, p.lat, p.lng);
      return copy;
    });
  }

  function fetchOffersForMapRegion(lat, lng) {
    container._hcPendingMapRegion = { lat: lat, lng: lng };
    if (container._hcMapRegionFetchInFlight) return;
    container._hcMapRegionFetchInFlight = true;
    setMapRegionLoading(true);

    function step() {
      var region = container._hcPendingMapRegion;
      container._hcPendingMapRegion = null;
      if (!region) {
        container._hcMapRegionFetchInFlight = false;
        setMapRegionLoading(false);
        return;
      }
      api
        .getOffers(1, MAP_OFFERS_PAGE_SIZE, { latitude: region.lat, longitude: region.lng }, { includeOnline: false })
        .then(function (raw) {
          var list = pickOliveMapStores(raw);
          var listWithDistances = withUserDistances(list);
          container._hcCardlinkedStores = listWithDistances;
          renderStoresGridFromList(listWithDistances);
          rebindStoresSearchClean(listWithDistances);
          showNoStoresIfEmpty(listWithDistances);
          var added = mergeOffersMapStores(container, listWithDistances);
          addMerchantPinsToLiveMap(container, added);
        })
        .catch(function (err) {
          console.warn('[HC offers map] region fetch failed', err);
        })
        .then(step);
    }
    step();
  }

  container._hcOnMapRegionPanned = fetchOffersForMapRegion;

  function restoreStoresGridFromCache() {
    var list = Array.isArray(container._hcCardlinkedStores) ? container._hcCardlinkedStores : [];
    fillStoresGrid(document.getElementById('hc-stores-grid'), list, container);
  }

  function setMapSearchLoading(active) {
    if (!mapSearchBtn) return;
    mapSearchBtn.disabled = !!active;
    mapSearchBtn.innerHTML = OFFERS_MAP_SEARCH_ICON_SVG;
  }

  function clearMapSearchBlurTimer() {
    if (mapSearchBlurTimer) {
      window.clearTimeout(mapSearchBlurTimer);
      mapSearchBlurTimer = null;
    }
  }

  function hideMapSuggestions() {
    clearMapSearchBlurTimer();
    currentMapSuggestions = [];
    if (!mapSearchSuggestions) return;
    mapSearchSuggestions.innerHTML = '';
    mapSearchSuggestions.style.display = 'none';
  }

  function renderMapSuggestions(query) {
    if (!mapSearchSuggestions) return;
    currentMapSuggestions = searchUSCities(query);
    if (!currentMapSuggestions.length) {
      hideMapSuggestions();
      return;
    }
    var html = '';
    currentMapSuggestions.forEach(function (suggestion, index) {
      html +=
        '<button type="button" class="hc-offers-map-search-suggestion" data-suggestion-index="' +
        String(index) +
        '">' +
        '<span class="hc-offers-map-search-suggestion-icon" aria-hidden="true">' +
        OFFERS_MAP_LOCATE_ICON_SVG +
        '</span>' +
        '<span class="hc-offers-map-search-suggestion-text">' +
        escapeHtml(suggestion.label) +
        '</span>' +
        '</button>';
    });
    mapSearchSuggestions.innerHTML = html;
    mapSearchSuggestions.style.display = '';
  }

  function updateMapSuggestionsFromInput() {
    if (!mapSearchInput || mapSearchInput.disabled) {
      hideMapSuggestions();
      return;
    }
    var query = (mapSearchInput.value || '').trim();
    if (query.length < 2) {
      hideMapSuggestions();
      return;
    }
    renderMapSuggestions(query);
  }

  function runMapLocationSearchAt(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve();
    if (mapSearchBtn && mapSearchBtn.disabled) return Promise.resolve();

    setMapSearchLoading(true);
    setMapShellLoading(true);
    setStoresGridLoading(true);
    hideMapSuggestions();
    focusOffersMap(container, lat, lng);

    return applyFreshLocation(lat, lng, {
      previewMap: false,
      persist: false,
    })
      .catch(function (err) {
        setMapShellLoading(false);
        restoreStoresGridFromCache();
        console.error('Map location search failed:', err);
        window.alert('Unable to search for that location. Please try again.');
      })
      .then(function () {
        setMapSearchLoading(false);
      });
  }

  function handleMapSuggestionSelection(index) {
    var suggestion = currentMapSuggestions[index];
    if (!suggestion || !suggestion.entry) return;
    if (mapSearchInput) {
      mapSearchInput.value = suggestion.label;
    }
    runMapLocationSearchAt(suggestion.entry.latitude, suggestion.entry.longitude);
  }

  function setMyLocationLoading(active) {
    if (!mapMyLocationBtn) return;
    mapMyLocationBtn.disabled = !!active;
    mapMyLocationBtn.classList.toggle('hc-offers-map-my-location--loading', !!active);
  }

  function renderMap(userLat, userLng, showUserMarker, onReady) {
    if (showUserMarker === undefined) showUserMarker = true;
    container._hcMapRenderDone = typeof onReady === 'function' ? onReady : null;
    if (showUserMarker && Number.isFinite(userLat) && Number.isFinite(userLng)) {
      container._hcMapUserLoc = { lat: userLat, lng: userLng };
    }
    mergeOffersMapStores(
      container,
      Array.isArray(container._hcCardlinkedStores) ? container._hcCardlinkedStores : [],
    );
    var merchants = Array.isArray(container._hcMapStores) ? container._hcMapStores : [];
    var merchantMarkerData = [];
    merchants.forEach(function (m) {
      var item = buildMerchantMarkerDataItem(m, userLat, userLng);
      if (item) merchantMarkerData.push(item);
    });

    var refreshingMap = !!(container._hcLeafletMap || container._hcMkMap);
    if (!refreshingMap) {
      mapMount.classList.add('hc-offers-map-loading');
      mapMount.setAttribute('aria-busy', 'true');
      mapMount.innerHTML = '<div class="hc-offers-map-skeleton"></div>';
    } else {
      mapMount.classList.remove('hc-offers-map-loading');
      mapMount.removeAttribute('aria-busy');
    }

    console.log('[HC offers map] renderMap start', userLat, userLng, 'merchant pins', merchantMarkerData.length);
    container._hcOsmFallbackDone = false;
    if (!shouldUseMapKitJs()) {
      console.log('[HC offers map] non-iOS/non-Safari → OpenStreetMap (Leaflet)');
      renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData, showUserMarker);
      return;
    }
    resolveMapKitTokenAsync().then(function (mkToken) {
      if (!mkToken) {
        console.warn('[HC offers map] no MapKit token, using OpenStreetMap fallback');
        renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData, showUserMarker);
        return;
      }
      if (!tokenLooksLikeMapKitJwt(mkToken)) {
        console.warn('[HC offers map] token is not a JWT, using OpenStreetMap fallback');
        renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData, showUserMarker);
        return;
      }
      ensureMapKitLoaded(mkToken)
        .then(function (mapkit) {
          if (mapKitAuthFailureWasReported()) {
            console.warn('[HC offers map] MapKit reported invalid token, using OpenStreetMap fallback');
            renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData, showUserMarker);
            return;
          }
          try {
            renderMapWithMapKit(
              container,
              mapMount,
              mapkit,
              userLat,
              userLng,
              merchantMarkerData,
              showUserMarker,
            );
          } catch (e) {
            console.error('[HC offers map] renderMapWithMapKit threw', e);
            renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData, showUserMarker);
          }
        })
        .catch(function (err) {
          console.error('[HC offers map] ensureMapKitLoaded failed', err);
          renderMapWithLeaflet(container, mapMount, userLat, userLng, merchantMarkerData, showUserMarker);
        });
    });
  }

  function showMapWithDefaultCenter() {
    hasUserMapLocation = false;
    showMapUI();
    var pendingMerchant =
      container._hcPendingMapSelect &&
      flattenOfferMerchantForMap(container._hcPendingMapSelect.merchant);
    var pendingPoint = pendingMerchant && pickMerchantLatLng(pendingMerchant);
    if (pendingPoint) {
      renderMap(pendingPoint.lat, pendingPoint.lng, false);
    } else {
      renderMap(OFFERS_DEFAULT_MAP_LAT, OFFERS_DEFAULT_MAP_LNG, false);
    }
    showNoStoresIfEmpty(container._hcCardlinkedStores);
  }

  function applyStoredLocationFallback() {
    try {
      var raw = readStoredOfferLocationRaw();
      if (!raw) return Promise.resolve(false);
      var o = JSON.parse(raw);
      if (o && o.lat != null && o.lng != null) {
        return applyFreshLocation(Number(o.lat), Number(o.lng), {
          persist: false,
        }).then(function () {
          return true;
        });
      }
    } catch (e) {}
    return Promise.resolve(false);
  }

  function applyFreshLocation(lat, lng, options) {
    if (lat == null || lng == null) return Promise.resolve();
    options = options || {};
    hasUserMapLocation = true;
    setActiveOfferLocation(lat, lng);
    container._hcMapUserLoc = { lat: Number(lat), lng: Number(lng) };
    container._hcLastRegionFetchCenter = { lat: Number(lat), lng: Number(lng) };
    if (options.persist !== false) {
      persistOfferLocation(lat, lng);
    }
    setStoresGridLoading(true);

    var previewMap = options.previewMap !== false;
    if (previewMap) {
      showMapUI();
      setMapShellLoading(true);
      if (container._hcLeafletMap || container._hcMkMap) {
        focusOffersMap(container, lat, lng);
      } else {
        renderMap(lat, lng, true);
      }
    }

    return api
      .getOffers(1, MAP_OFFERS_PAGE_SIZE, { latitude: lat, longitude: lng }, { includeOnline: false })
      .then(function (raw) {
        var list = pickOliveMapStores(raw);
        console.log(
          '[HC offers map] fetched stores',
          list.length,
          'requestedPageSize',
          MAP_OFFERS_PAGE_SIZE,
          'pagination',
          raw && raw.pagination ? JSON.stringify(raw.pagination) : '',
        );
        resetOffersMapStores(container);
        container._hcCardlinkedStores = list;
        fillStoresGrid(document.getElementById('hc-stores-grid'), list, container);
        rebindStoresSearchClean(list);
        showNoStoresIfEmpty(list);
      })
      .catch(function () {
        if (noStoresEl) noStoresEl.style.display = 'none';
      })
      .then(function () {
        showMapUI();
        return new Promise(function (resolve) {
          renderMap(lat, lng, true, function () {
            setMapShellLoading(false);
            resolve();
          });
        });
      });
  }

  function handleMapLocationSearch() {
    if (!mapSearchInput || !mapSearchBtn) return;
    var query = (mapSearchInput.value || '').trim();
    if (!query) return;
    if (mapSearchBtn.disabled) return;
    var result = lookupUSCity(query);
    if (!result) {
      hideMapSuggestions();
      window.alert('Could not find that city or zip code. Please try another search.');
      return;
    }
    runMapLocationSearchAt(result.latitude, result.longitude);
  }

  function handleRecenterToMyLocation() {
    if (!navigator.geolocation) {
      window.alert('Location services are not supported in this browser.');
      return;
    }
    if (mapMyLocationBtn && mapMyLocationBtn.disabled) return;

    setMyLocationLoading(true);
    setMapShellLoading(true);
    setStoresGridLoading(true);
    requestOfferGeolocation(
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      function (pos) {
        if (mapSearchInput) mapSearchInput.value = '';
        hideMapSuggestions();
        setLocationPromptMessage(OFFERS_LOCATION_PROMPT_DEFAULT);
        applyFreshLocation(pos.coords.latitude, pos.coords.longitude)
          .then(function () {
            setMyLocationLoading(false);
          })
          .catch(function () {
            setMyLocationLoading(false);
            setMapShellLoading(false);
          });
      },
      function (err) {
        setMyLocationLoading(false);
        var stored = getStoredOfferLocation();
        if (stored) {
          applyFreshLocation(stored.latitude, stored.longitude, { persist: false })
            .catch(function () {
              setMapShellLoading(false);
            });
          return;
        }
        setMapShellLoading(false);
        restoreStoresGridFromCache();
        alertGeolocationFailure(err);
      },
    );
  }

  function rebindStoresSearchClean(list) {
    var oldInput = document.getElementById('hc-search-stores');
    if (oldInput && oldInput.parentNode) {
      var fresh = oldInput.cloneNode(true);
      oldInput.parentNode.replaceChild(fresh, oldInput);
    }
    bindSearch('hc-search-stores', 'hc-stores-grid', list);
  }

  function alertGeolocationFailure(err) {
    var code = err && err.code;
    var message = err && err.message;
    try {
      console.warn('[HC offers geo] getCurrentPosition failed', code, message || '');
    } catch (e) {}
    function show(state) {
      if (code === 1 && state === 'denied') {
        window.alert(OFFERS_LOCATION_PROMPT_DENIED);
        return;
      }
      if (code === 1 && state === 'granted') {
        window.alert(OFFERS_LOCATION_PROMPT_SYSTEM_BLOCKED);
        return;
      }
      if (code === 1 && !state) {
        window.alert(OFFERS_LOCATION_PROMPT_DENIED);
        return;
      }
      if (code === 2) {
        window.alert(OFFERS_LOCATION_PROMPT_SYSTEM_BLOCKED);
        return;
      }
      window.alert(OFFERS_LOCATION_PROMPT_GENERIC);
    }
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      try {
        navigator.permissions
          .query({ name: 'geolocation' })
          .then(function (status) {
            show(status && status.state);
          })
          .catch(function () {
            show(null);
          });
        return;
      } catch (e) {}
    }
    show(null);
  }

  function requestOfferGeolocation(options, onSuccess, onError) {
    if (!navigator.geolocation) {
      if (onError) onError({ code: 0 });
      return;
    }
    var opts = options || { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
    var lowAccuracyRetryDone = false;

    function fail(err) {
      var code = err && err.code;
      // Safari / desktop often return POSITION_UNAVAILABLE (2) or TIMEOUT (3)
      // when GPS high-accuracy fails; Wi-Fi / cell fix still works without it.
      if (!lowAccuracyRetryDone && (code === 2 || code === 3) && opts.enableHighAccuracy !== false) {
        lowAccuracyRetryDone = true;
        try {
          console.warn('[HC offers geo] retry getCurrentPosition without high accuracy', code);
        } catch (e1) {}
        try {
          navigator.geolocation.getCurrentPosition(onSuccess, fail, {
            enableHighAccuracy: false,
            timeout: Math.max(Number(opts.timeout) || 0, 20000),
            maximumAge: 60000,
          });
          return;
        } catch (e2) {
          if (onError) onError(e2);
          return;
        }
      }
      if (onError) onError(err);
    }

    try {
      navigator.geolocation.getCurrentPosition(onSuccess, fail, opts);
    } catch (e) {
      if (onError) onError(e);
    }
  }

  function kickOffParallelGpsRequest() {
    if (locationKnown) return;
    if (!navigator.geolocation) {
      applyStoredLocationFallback().then(function (usedStored) {
        if (!usedStored) showMapWithDefaultCenter();
      });
      return;
    }
    function requestGrantedLocation() {
      showLoadingUI();
      requestOfferGeolocation(
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        function (pos) {
          if (mapSearchInput) mapSearchInput.value = '';
          hideMapSuggestions();
          applyFreshLocation(pos.coords.latitude, pos.coords.longitude);
        },
        function () {
          if (locationKnown) return;
          applyStoredLocationFallback().then(function (usedStored) {
            if (!usedStored) showMapWithDefaultCenter();
          });
        },
      );
    }
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      try {
        navigator.permissions
          .query({ name: 'geolocation' })
          .then(function (status) {
            if (status && status.state === 'denied') {
              applyStoredLocationFallback().then(function (usedStored) {
                if (!usedStored) showMapWithDefaultCenter();
              });
              return;
            }
            requestGrantedLocation();
          })
          .catch(function () {
            requestGrantedLocation();
          });
      } catch (e) {
        requestGrantedLocation();
      }
    } else {
      requestGrantedLocation();
    }
  }

  kickOffParallelGpsRequest();

  if (btn && !btn._hcLocClickBound) {
    btn._hcLocClickBound = true;
    btn.addEventListener('click', function () {
      if (!navigator.geolocation) {
        return;
      }
      btn.disabled = true;
      showLoadingUI();
      requestOfferGeolocation(
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        function (pos) {
          btn.disabled = false;
          if (mapSearchInput) mapSearchInput.value = '';
          hideMapSuggestions();
          setLocationPromptMessage(OFFERS_LOCATION_PROMPT_DEFAULT);
          applyFreshLocation(pos.coords.latitude, pos.coords.longitude);
        },
        function (err) {
          btn.disabled = false;
          showMapWithDefaultCenter();
          if (err && err.code === 1) {
            alertGeolocationFailure(err);
          }
        },
      );
    });
  }

  if (mapSearchBtn && !mapSearchBtn._hcMapSearchBound) {
    mapSearchBtn._hcMapSearchBound = true;
    mapSearchBtn.addEventListener('click', handleMapLocationSearch);
  }

  if (mapSearchSuggestions && !mapSearchSuggestions._hcMapSuggestionsBound) {
    mapSearchSuggestions._hcMapSuggestionsBound = true;
    mapSearchSuggestions.addEventListener('mousedown', function (e) {
      var item = e.target && e.target.closest && e.target.closest('.hc-offers-map-search-suggestion');
      if (!item) return;
      e.preventDefault();
      clearMapSearchBlurTimer();
    });
    mapSearchSuggestions.addEventListener('click', function (e) {
      var item = e.target && e.target.closest && e.target.closest('.hc-offers-map-search-suggestion');
      if (!item) return;
      var index = Number(item.getAttribute('data-suggestion-index'));
      if (!Number.isFinite(index)) return;
      handleMapSuggestionSelection(index);
    });
  }

  if (mapSearchInput && !mapSearchInput._hcMapSearchBound) {
    mapSearchInput._hcMapSearchBound = true;
    mapSearchInput.addEventListener('input', updateMapSuggestionsFromInput);
    mapSearchInput.addEventListener('focus', updateMapSuggestionsFromInput);
    mapSearchInput.addEventListener('blur', function () {
      clearMapSearchBlurTimer();
      mapSearchBlurTimer = window.setTimeout(function () {
        hideMapSuggestions();
      }, 150);
    });
    mapSearchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        hideMapSuggestions();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleMapLocationSearch();
      }
    });
  }

  if (mapMyLocationBtn && !mapMyLocationBtn._hcMapMyLocationBound) {
    mapMyLocationBtn._hcMapMyLocationBound = true;
    mapMyLocationBtn.addEventListener('click', handleRecenterToMyLocation);
  }
}

function bindSearch(inputId, gridId, allMerchants, container) {
  var input = document.getElementById(inputId);
  if (!input) return;
  var isOnline = inputId.indexOf('online') >= 0;
  var tabLabel = isOnline ? 'Online' : 'Stores';
  var headerId = isOnline ? 'hc-online-search-header' : 'hc-stores-search-header';
  var tabContentId = isOnline ? 'hc-tab-online' : 'hc-tab-stores';
  var searchAnalyticsTimer = null;
  var serverSearchTimer = null;
  var serverSearchRequestId = 0;

  function setHeader(html) {
    var header = document.getElementById(headerId);
    if (header) header.innerHTML = html;
  }

  function setSearching(active) {
    var tab = document.getElementById(tabContentId);
    if (!tab) return;
    if (active) tab.classList.add('hc-tab--searching');
    else tab.classList.remove('hc-tab--searching');
  }

  function renderResultHeader(count, query) {
    setHeader(
      '<div class="hc-search-header-text">' +
        count +
        ' results for "' +
        escapeHtml(query) +
        '"</div>'
    );
  }

  input.addEventListener('input', function () {
    var q = this.value.toLowerCase().trim();
    var grid = document.getElementById(gridId);
    if (searchAnalyticsTimer) {
      clearTimeout(searchAnalyticsTimer);
      searchAnalyticsTimer = null;
    }
    var trimmed = (this.value || '').trim();
    if (trimmed.length >= 2) {
      var marketplaceTab = isOnline ? 'online' : 'stores';
      var qt = trimmed.slice(0, 200);
      searchAnalyticsTimer = setTimeout(function () {
        analytics.trackEmbedSearch(qt, marketplaceTab);
      }, 700);
    }
    if (!q) {
      if (serverSearchTimer) {
        clearTimeout(serverSearchTimer);
        serverSearchTimer = null;
      }
      serverSearchRequestId++;
      setHeader('');
      setSearching(false);
      grid.innerHTML = '';
      allMerchants.forEach(function (m) {
        grid.innerHTML += renderMerchantCard(m, merchantCardOptionsFor(grid));
      });
      if (isOnline && container) renderOnlineLoadMore(container);
      return;
    }
    setSearching(true);
    if (isOnline && container) {
      var slot = container.querySelector('#hc-online-load-more');
      if (slot) slot.innerHTML = '';
    }

    // Online tab: the client only has the first page of merchants loaded, so
    // client-side filtering misses anything past the alphabetical first page.
    // Hit /api/wildfire/offers/?q=... server-side; the feed is cached.
    if (isOnline) {
      if (serverSearchTimer) {
        clearTimeout(serverSearchTimer);
      }
      var requestId = ++serverSearchRequestId;
      setHeader(
        '<div class="hc-search-header-text">Searching "' + escapeHtml(q) + '"...</div>'
      );
      grid.innerHTML = '';
      serverSearchTimer = setTimeout(function () {
        api
          .getWildfireOffers(1, 200, q)
          .then(function (resp) {
            if (requestId !== serverSearchRequestId) return;
            var list = pickWildfireList(resp) || [];
            renderResultHeader(list.length, q);
            grid.innerHTML = '';
            list.forEach(function (m) {
              grid.innerHTML += renderMerchantCard(m, merchantCardOptionsFor(grid));
            });
          })
          .catch(function (err) {
            if (requestId !== serverSearchRequestId) return;
            console.error('Wildfire search failed:', err && err.message);
            setHeader(
              '<div class="hc-search-header-text">Search failed. Try again.</div>'
            );
            grid.innerHTML = '';
          });
      }, 300);
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
    renderResultHeader(filtered.length, q);
    grid.innerHTML = '';
    filtered.forEach(function (m) {
      grid.innerHTML += renderMerchantCard(m, merchantCardOptionsFor(grid));
    });
  });
}

function renderFeaturedGrid(items) {
  var html = '<div class="hc-featured-grid">';
  items.forEach(function (f) {
    var gridOid = f.offer_id || f.id ? String(f.offer_id || f.id) : '';
    var featuredPayload = escapeAttr(
      JSON.stringify({
        offerId: gridOid || '',
        name: f.name || '',
        logoUrl: f.small_logo_url || '',
        logo: f.small_logo_url || '',
        large_logo_url: f.large_logo_url || '',
        summary: f.summary || '',
        description: f.summary || '',
        offerType: 'card_linked',
        reach: 'state',
        isOnline: false,
      }),
    );
    html +=
      '<div class="hc-featured-grid-item"' +
      (gridOid ? ' data-offer-id="' + escapeAttr(gridOid) + '"' : '') +
      ' data-featured-offer="' +
      featuredPayload +
      '"' +
      '>';
    html += renderPointMultiplierBadgeHtml(f, 'block', true);
    html += '<div class="hc-featured-grid-row">';
    if (f.small_logo_url) {
      html +=
        '<img data-hc-ph="store" class="hc-featured-grid-logo" draggable="false" src="' +
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

function formatDistanceMiles(d) {
  if (!Number.isFinite(d)) return '';
  if (d < 0.1) return '<0.1 mi';
  if (d < 10) return d.toFixed(1) + ' mi';
  return Math.round(d) + ' mi';
}

/**
 * @param {object} merchant
 * @param {{ layout?: 'card'|'row' }} [options] 'row' is the Shop screen's
 *   full-width list under the map (Figma 1421:9208); everywhere else keeps the
 *   two-up card.
 */
function renderMerchantCard(merchant, options) {
  var rowLayout = !!(options && options.layout === 'row');
  var logoUrl = merchant.logoUrl || merchant.logo || '';
  var name = merchant.name || merchant.merchantName || 'Unknown';
  var isOnline = !!(merchant.isOnline || merchant.reach === 'online_only');
  var location = '';
  if (!isOnline && merchant.city && merchant.state) {
    location = merchant.city + ', ' + merchant.state;
  }
  var distance = '';
  if (!isOnline) {
    var userLoc = getActiveOfferLocation();
    var userLat = userLoc ? Number(userLoc.latitude) : NaN;
    var userLng = userLoc ? Number(userLoc.longitude) : NaN;
    var d = merchantDistanceMiles(merchant, userLat, userLng);
    if (Number.isFinite(d)) distance = formatDistanceMiles(d);
  }
  var offerType = merchant.offerSource === 'wildfire' || merchant.wildfireMerchantId ? 'wildfire' : 'olive';
  var detailId = offerType === 'olive' && merchant.offerId ? String(merchant.offerId) : '';
  var wildfireId = merchant.wildfireMerchantId || '';
  var html =
    '<div class="hc-merchant-card' +
    (rowLayout ? ' hc-merchant-row' : '') +
    '"' +
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
        isOnline: isOnline,
        cashback: merchant.cashback || merchant.points || '',
      }),
    ) +
    '">';
  // The design's local rows carry no multiplier chip; as a block element it
  // would also land between the artwork and the text.
  if (!rowLayout) html += renderPointMultiplierBadgeHtml(merchant, 'block');
  if (logoUrl) {
    html +=
      '<div class="hc-merchant-img-wrap"><img data-hc-ph="store"' +
      // Only the row tile is square; the two-up card's wrapper is 100x80.
      (rowLayout ? ' data-hc-square' : '') +
      ' class="hc-merchant-img" loading="lazy" decoding="async" src="' +
      escapeAttr(logoUrl) +
      '" alt="' +
      escapeAttr(name) +
      '" /></div>';
  } else {
    html +=
      '<div class="hc-merchant-img-wrap"><div class="hc-merchant-no-logo">' +
      '<img data-hc-ph="none" class="hc-merchant-no-logo-icon" src="' + escapeAttr(shopIconUrl) + '" alt="" aria-hidden="true" />' +
      '<div class="hc-merchant-no-logo-name">' + escapeHtml(name) + '</div>' +
      '</div></div>';
  }
  html += '<div class="hc-merchant-card-info">';
  if (rowLayout) {
    html += '<div class="hc-merchant-row-name">' + escapeHtml(name) + '</div>';
  }
  if (location || distance) {
    var line = location && distance ? location + ' · ' + distance : location || distance;
    html += '<div class="hc-merchant-location">' + escapeHtml(line) + '</div>';
  }
  html += '</div>';
  if (rowLayout) {
    html +=
      '<span class="hc-merchant-row-chevron" aria-hidden="true">' + rowChevronSvg + '</span>';
  }
  html += '</div>';
  return html;
}

async function handleOffersMarketplaceCardClick(card) {
  if (!card) return;
  var offerId = card.getAttribute('data-offer-id');
  var offerType = card.getAttribute('data-offer-type');
  var featuredOfferRaw = card.getAttribute('data-featured-offer');
  var merchantTitle = '';
  try {
    var merchantRaw = card.getAttribute('data-merchant');
    if (merchantRaw) {
      var merchantParsed = JSON.parse(merchantRaw);
      merchantTitle = merchantParsed.name || merchantParsed.merchantName || '';
    }
  } catch (e) {}

  if (featuredOfferRaw) {
    try {
      sessionStorage.setItem(
        'hc_offer_detail_initial',
        JSON.stringify({
          offerId: offerId || '',
          offer: JSON.parse(featuredOfferRaw),
        }),
      );
    } catch (e) {}
  }

  if (offerId && card.classList.contains('hc-online-card')) {
    var onlineMerchantId = card.getAttribute('data-merchant-id');
    if (onlineMerchantId) {
      var wildfireRedirectUrl = api.buildWildfireRedirectUrl(onlineMerchantId);
      if (wildfireRedirectUrl) {
        showFullscreenSpinner();
        analytics.trackEmbedOfferLinkClick({
          entry_point: 'embed_marketplace',
          flow: 'wildfire_tracking',
          merchant_id: onlineMerchantId,
          offer_source: 'wildfire',
        });
        window.location.href = wildfireRedirectUrl;
        return;
      }
      // No redirect URL - user may be logged out
      showError('Please log in to access this offer');
      return;
    }
    try {
      var trackResult = await api.trackOfferClick(offerId).catch(function () {
        return null;
      });
      var trackUrl = trackResult && (trackResult.tracking_url || trackResult.trackingUrl);
      if (trackUrl) {
        if (trackUrl.indexOf('http') !== 0) trackUrl = 'https://' + trackUrl;
        analytics.trackEmbedOfferLinkClick({
          entry_point: 'embed_marketplace',
          flow: 'olive_tracking',
          offer_id: offerId,
          offer_source: 'olive',
        });
        openExternalUrl(trackUrl, merchantTitle);
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

  if (!offerId && featuredOfferRaw) {
    window.location.hash = '#/offers/featured';
    return;
  }

  var merchantId = card.getAttribute('data-merchant-id');
  if (merchantId) {
    var redirectUrl = api.buildWildfireRedirectUrl(merchantId);
    if (redirectUrl) {
      showFullscreenSpinner();
      analytics.trackEmbedOfferLinkClick({
        entry_point: 'embed_marketplace',
        flow: 'wildfire_tracking',
        merchant_id: merchantId,
        offer_source: 'wildfire',
      });
      window.location.href = redirectUrl;
      return;
    }
    // No redirect URL available - user may be logged out or session expired
    hideFullscreenSpinner();
    showError('Please log in to access this offer');
    return;
  }
  // No merchant ID - this shouldn't happen but show error
  showError('Unable to open this offer. Please try again.');
}

function openExternalUrl(url, title) {
  // Homecrowd-own native shell: hand off to a top-level native WebView.
  // Only triggers when our specific bridge is present, not when a
  // third-party app wraps us in a generic WebView.
  if (hasNativeBridge()) {
    postToNative('homecrowd:open-merchant-webview', { url: url, title: title || '' });
    return;
  }

  // Show a spinner during the server-side header check. Runtime detection
  // alone can't tell a CSP-blocked frame parked at chrome-error://... from
  // a successful cross-origin load (both throw SecurityError when read).
  // The server-side check reads actual response headers and is reliable.
  showFullscreenSpinner();

  api
    .checkEmbeddable(url)
    .then(function (verdict) {
      if (verdict && verdict.embeddable) {
        hideFullscreenSpinner();
        // Iframe overlay still has its own timeout/about-blank fallback as
        // belt-and-suspenders for cases where headers look OK but the
        // merchant page still fails to render (e.g., third-party cookie
        // issues inside a host-app WebView).
        showWebviewOverlay(url, {
          title: title,
          onFallback: function () {
            showFullscreenSpinner();
            window.location.href = url;
          },
        });
        return;
      }
      // Headers say no — go top-level. Spinner stays up until the WebView
      // navigates away.
      window.location.href = url;
    })
    .catch(function (err) {
      console.warn('checkEmbeddable failed, falling back to top-level nav:', err && err.message);
      window.location.href = url;
    });
}

var fullscreenSpinnerEl = null;
function showFullscreenSpinner() {
  if (fullscreenSpinnerEl) return;
  fullscreenSpinnerEl = document.createElement('div');
  fullscreenSpinnerEl.className = 'hc-route-spinner-overlay';
  fullscreenSpinnerEl.innerHTML = LoadingSpinner({ text: 'Opening...' });
  document.body.appendChild(fullscreenSpinnerEl);
}
function hideFullscreenSpinner() {
  if (fullscreenSpinnerEl) {
    fullscreenSpinnerEl.remove();
    fullscreenSpinnerEl = null;
  }
  // Belt-and-suspenders: if bfcache restored the DOM but reset the
  // module-scoped reference, query and remove any stray overlay so we
  // don't leave a spinner orphaned on the page.
  var stale = document.querySelectorAll('.hc-route-spinner-overlay');
  for (var i = 0; i < stale.length; i++) stale[i].remove();
}

// When the user navigates away via window.location.href and then hits
// "back" in the host app (e.g., the Boise State app's back button), the
// embed page is restored from bfcache with its DOM state intact —
// including a lingering spinner. Drop it on pageshow so the user isn't
// staring at a stale loading overlay.
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', function () {
    hideFullscreenSpinner();
  });
}
