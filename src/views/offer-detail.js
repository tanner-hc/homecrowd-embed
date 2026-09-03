import * as api from '../api.js';
import { openDirectionsPicker } from '../mapDirections.js';
import * as analytics from '../analytics.js';
import { openMerchantUrl } from '../open-merchant-url.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { buildAppHeaderHtml, attachAppHeader } from '../base-components/AppHeader.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import LinkedCardNotice from '../base-components/LinkedCardNotice.js';
import storeFilledSvg from '../assets/icons/store-filled.svg?raw';
import locationSvg from '../assets/icon-location.svg?raw';
import crossIconUrl from '../assets/icons/cross.png';
import checkmarkIconUrl from '../assets/icons/checkmark.svg';

var PREFERRED_CARD_KEY = 'hc_preferred_card_id';

export function renderOfferDetail(container, offerId) {
  container.innerHTML =
    '<div class="hc-shop-detail">' +
    buildAppHeaderHtml({ showBack: true }) +
    '<div class="hc-shop-detail-body">' +
    LoadingSpinner({ text: 'Loading shop...' }) +
    '</div></div>';

  attachAppHeader(container, {
    showBack: true,
    onBackPress: function () {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      navigate('/offers');
    },
  });

  loadShopDetail(container, offerId);
}

function consumeInitialOfferPayload(offerId) {
  try {
    var raw = sessionStorage.getItem('hc_offer_detail_initial');
    if (!raw) return null;
    sessionStorage.removeItem('hc_offer_detail_initial');
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    var savedId = parsed.offerId != null ? String(parsed.offerId) : '';
    if (savedId && offerId && savedId !== String(offerId)) return null;
    return parsed;
  } catch (_e) {
    return null;
  }
}

function consumeInitialOffer(offerId) {
  var parsed = consumeInitialOfferPayload(offerId);
  return parsed && parsed.offer && typeof parsed.offer === 'object' ? parsed.offer : null;
}

function getPreferredCardId() {
  try {
    return localStorage.getItem(PREFERRED_CARD_KEY) || '';
  } catch (_e) {
    return '';
  }
}

function setPreferredCardId(cardId) {
  try {
    if (cardId == null || cardId === '') {
      localStorage.removeItem(PREFERRED_CARD_KEY);
      return;
    }
    localStorage.setItem(PREFERRED_CARD_KEY, String(cardId));
  } catch (_e) {}
}

function listActiveCards(cards) {
  var list = Array.isArray(cards) ? cards.slice() : [];
  return list.filter(function (c) {
    if (!c) return false;
    var status = String(c.status || 'active').toLowerCase();
    return status === 'active';
  });
}

function pickDisplayCard(cards) {
  var active = listActiveCards(cards);
  if (!active.length) {
    setPreferredCardId('');
    return null;
  }
  var preferredId = getPreferredCardId();
  if (preferredId) {
    var matched = active.find(function (c) {
      return String(c.id) === String(preferredId);
    });
    if (matched) return matched;
  }
  return active[0];
}

function pickLogo(offer) {
  if (!offer) return '';
  return (
    offer.logoUrl ||
    offer.logo ||
    offer.large_logo_url ||
    offer.small_logo_url ||
    offer.largeLogoUrl ||
    offer.smallLogoUrl ||
    ''
  );
}

function pickName(offer) {
  return (offer && (offer.name || offer.merchantName || offer.merchant_name)) || 'Store';
}

function pickCategories(offer) {
  if (!offer) return '';
  if (offer.summary && String(offer.summary).trim()) {
    var first = String(offer.summary).split(/\n/)[0].trim();
    if (first.length <= 80) return first;
  }
  if (Array.isArray(offer.categories) && offer.categories.length) {
    return offer.categories.join(', ');
  }
  if (offer.category_name) return String(offer.category_name);
  if (offer.category) return String(offer.category);
  if (offer.shopCategoryLabel) return String(offer.shopCategoryLabel);
  var channel = String(offer.shopChannel || offer.channel || '').toLowerCase();
  if (channel === 'online' || channel === 'in_app') return 'Online shopping';
  if (isClickOffer(offer)) return 'Online shopping';
  return 'In-person shopping';
}

function isNewOffer(offer) {
  return !!(
    offer &&
    (offer.is_new || offer.isNew || offer.new || offer.badge === 'new')
  );
}

function isClickOffer(offer) {
  if (!offer) return false;
  var t = String(offer.offerType || offer.offer_type || '').toLowerCase();
  return t === 'click' || t === 'click_sso' || t === 'online';
}

function isWildfireOffer(offer) {
  if (!offer) return false;
  if (isClickOffer(offer)) return true;
  var source = String(offer.offerSource || offer.offer_source || '').toLowerCase();
  if (source === 'wildfire') return true;
  return !!(offer.wildfireMerchantId || offer.wildfire_merchant_id);
}

function pickWildfireMerchantId(offer) {
  if (!offer) return '';
  return (
    offer.wildfireMerchantId ||
    offer.wildfire_merchant_id ||
    offer.merchantId ||
    offer.merchant_id ||
    (isWildfireOffer(offer) ? offer.offer_id || offer.offerId || '' : '') ||
    ''
  );
}

function pickOliveOfferId(offer) {
  if (!offer || isWildfireOffer(offer)) return '';
  return offer.offer_id || offer.offerId || offer.id || '';
}

// The linked/unlinked states differ only in what the pill does, so the copy stays
// card-agnostic. Shared with the store map via LinkedCardNotice.
function buildLinkedCardHtml(card) {
  var linked = !!(card && card.last4);
  return (
    '<div class="hc-shop-detail-card-slot" data-shop-card-slot>' +
    LinkedCardNotice(
      linked
        ? { actionLabel: 'Manage', actionAttr: 'data-shop-manage-card' }
        : { actionLabel: 'Link', actionAttr: 'data-shop-link-card' }
    ) +
    '</div>'
  );
}

function pickExclusions(offer) {
  if (!offer) return [];
  var list = offer.exclusions || offer.Exclusions || [];
  if (!Array.isArray(list)) return [];
  var seen = {};
  var out = [];
  list.forEach(function (item) {
    var text = String(item || '').trim();
    if (!text) return;
    var key = text.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    out.push(text);
  });
  return out;
}

function formatDaysOfWeek(daysAvailability) {
  if (!daysAvailability || !daysAvailability.length) return 'Every day';
  var sortedDays = daysAvailability
    .map(function (d) {
      return Number(d);
    })
    .filter(function (d) {
      return Number.isFinite(d) && d >= 0 && d <= 6;
    })
    .slice()
    .sort(function (a, b) {
      return a - b;
    });
  if (!sortedDays.length || sortedDays.length === 7) return 'Every day';

  var dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  if (sortedDays.length === 5 && sortedDays[0] === 1 && sortedDays[4] === 5) {
    return 'Monday - Friday';
  }
  if (sortedDays.length === 2 && sortedDays.indexOf(0) >= 0 && sortedDays.indexOf(6) >= 0) {
    return 'Saturday - Sunday';
  }

  var isConsecutive = true;
  for (var i = 1; i < sortedDays.length; i++) {
    if (sortedDays[i] !== sortedDays[i - 1] + 1) {
      if (!(sortedDays[i - 1] === 6 && sortedDays[i] === 0)) {
        isConsecutive = false;
        break;
      }
    }
  }
  if (isConsecutive && sortedDays.length > 2) {
    return (
      dayNames[sortedDays[0]] +
      ' - ' +
      dayNames[sortedDays[sortedDays.length - 1]]
    );
  }
  return sortedDays
    .map(function (day) {
      return dayNames[day];
    })
    .join(', ');
}

function formatRedemptionLimit(offer) {
  if (!offer) return 'Unlimited redemptions';
  var limit = Number(offer.redeemLimitPerUser);
  if (!limit) return 'Unlimited redemptions';

  var interval = String(offer.redeemLimitPerUserInterval || 'month').toLowerCase();
  var intervalCount = Number(offer.redeemLimitPerUserIntervalCount) || 1;

  if (interval === 'lifetime' || interval === 'offer') {
    return limit + ' redemption' + (limit > 1 ? 's' : '') + ' for this offer';
  }

  var intervalText = interval;
  if (interval === 'day') {
    intervalText = intervalCount === 1 ? 'day' : intervalCount + ' days';
  } else if (interval === 'week') {
    intervalText = intervalCount === 1 ? 'week' : intervalCount + ' weeks';
  } else if (interval === 'month') {
    intervalText = intervalCount === 1 ? 'month' : intervalCount + ' months';
  } else if (interval === 'year') {
    intervalText = intervalCount === 1 ? 'year' : intervalCount + ' years';
  }

  var redemptionText = limit === 1 ? '1 redemption' : limit + ' redemptions';
  return redemptionText + ' per ' + intervalText;
}

function formatOfferEndDate(dateString) {
  if (!dateString) return 'No expiration date';
  var date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'No expiration date';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function pickOliveImportantTerms(offer) {
  if (!offer) return [];
  var terms = [];
  terms.push('Valid Days: ' + formatDaysOfWeek(offer.daysAvailability));
  terms.push('Redemption Limit: ' + formatRedemptionLimit(offer));

  if (Number(offer.budget) > 0) {
    terms.push('Budget: Subject to merchant budget - offer may end early');
  }
  if (Number(offer.purchaseAmount) > 0) {
    terms.push('Minimum Purchase: $' + offer.purchaseAmount);
  }

  var trigger = String(offer.redemptionTrigger || '');
  if (trigger && trigger !== 'minimum_purchase_amount') {
    var activation = '';
    if (trigger === 'cumulative_purchase_amount') {
      activation = 'Based on cumulative purchases';
    } else if (trigger === 'purchase_frequency') {
      activation =
        'After ' + (offer.purchaseFrequency || 'multiple') + ' purchases';
    } else if (trigger === 'click' || trigger === 'click_sso') {
      activation = 'Click to activate offer';
    } else if (trigger === 'mobile') {
      activation = 'Mobile activation required';
    }
    if (activation) terms.push('Activation: ' + activation);
  }

  terms.push('Offer Expires: ' + formatOfferEndDate(offer.endDate));
  return terms;
}

function buildExclusionsListHtml(title, items) {
  return (
    '<div class="hc-shop-detail-tip hc-shop-detail-tip--exclusions">' +
    '<span class="hc-shop-detail-tip-icon" aria-hidden="true">' +
    '<img data-hc-ph="none" src="' +
    escapeAttr(crossIconUrl) +
    '" alt="" class="hc-shop-detail-tip-icon-img" />' +
    '</span>' +
    '<div class="hc-shop-detail-tip-copy">' +
    '<div class="hc-shop-detail-tip-title">' +
    escapeHtml(title) +
    '</div>' +
    '<ul class="hc-shop-detail-exclusions">' +
    items
      .map(function (text) {
        return '<li>' + escapeHtml(text) + '</li>';
      })
      .join('') +
    '</ul>' +
    '</div></div>'
  );
}

function buildExclusionsHtml(offer) {
  if (!isWildfireOffer(offer)) {
    return buildExclusionsListHtml('Exclusions', pickOliveImportantTerms(offer));
  }

  var exclusions = pickExclusions(offer);
  if (!exclusions.length) {
    return (
      '<div class="hc-shop-detail-tip">' +
      '<span class="hc-shop-detail-tip-icon" aria-hidden="true">' +
      '<img data-hc-ph="none" src="' +
      escapeAttr(crossIconUrl) +
      '" alt="" class="hc-shop-detail-tip-icon-img" />' +
      '</span>' +
      '<div class="hc-shop-detail-tip-copy">' +
      '<div class="hc-shop-detail-tip-title">Some purchases won&rsquo;t earn points</div>' +
      '<div class="hc-shop-detail-tip-sub">Certain product categories and purchases using promo codes may not qualify.</div>' +
      '</div></div>'
    );
  }
  return buildExclusionsListHtml('Exclusions', exclusions);
}

function pickAcceptedCardCarriers(offer) {
  if (!offer) return [];
  var schemes = [];

  function addSchemes(maybeSchemes) {
    if (!Array.isArray(maybeSchemes)) return;
    maybeSchemes.forEach(function (s) {
      schemes.push(s);
    });
  }

  addSchemes(offer.supportedSchemes || offer.supported_schemes);

  if (Array.isArray(offer.stores)) {
    offer.stores.forEach(function (store) {
      if (!store) return;
      addSchemes(store.supportedSchemes || store.supported_schemes);
    });
  }

  addSchemes(offer.store && (offer.store.supportedSchemes || offer.store.supported_schemes));
  addSchemes(
    offer.merchant && (offer.merchant.supportedSchemes || offer.merchant.supported_schemes)
  );

  if (!schemes.length) return [];

  var hasVisa = false;
  var hasMastercard = false;

  schemes.forEach(function (s) {
    var v = String(s || '').toLowerCase();
    if (v === 'visa') hasVisa = true;
    if (v === 'mastercard' || v === 'master' || v === 'mc') hasMastercard = true;
  });

  var out = [];
  if (hasVisa) out.push('Visa');
  if (hasMastercard) out.push('Mastercard');
  return out;
}

function buildAcceptedCardCarriersHtml(offer) {
  var items = pickAcceptedCardCarriers(offer);
  if (!items.length) return '';
  return (
    '<div class="hc-shop-detail-tip hc-shop-detail-tip--accepted-cards">' +
    '<span class="hc-shop-detail-tip-icon" aria-hidden="true">' +
    '<img data-hc-ph="none" src="' +
    escapeAttr(checkmarkIconUrl) +
    '" alt="" class="hc-shop-detail-tip-icon-img" />' +
    '</span>' +
    '<div class="hc-shop-detail-tip-copy">' +
    '<div class="hc-shop-detail-tip-title">Accepted cards</div>' +
    '<ul class="hc-shop-detail-exclusions">' +
    items
      .map(function (text) {
        return '<li>' + escapeHtml(text) + '</li>';
      })
      .join('') +
    '</ul>' +
    '</div>' +
    '</div>'
  );
}

function truncateDescription(text, maxLen) {
  var full = String(text || '').trim();
  if (!full) return { short: '', full: '', needsExpand: false };
  var limit = Number(maxLen) > 0 ? Number(maxLen) : 72;
  if (full.length <= limit) {
    return { short: full, full: full, needsExpand: false };
  }
  var cut = full.slice(0, limit);
  var lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > Math.floor(limit * 0.5)) cut = cut.slice(0, lastSpace);
  return { short: cut.replace(/[.,;:\s]+$/, '') + '…', full: full, needsExpand: true };
}

function buildShopDetailHtml(offer, card) {
  var name = pickName(offer);
  var logo = pickLogo(offer);
  var categories = pickCategories(offer);
  var descParts = truncateDescription(categories, 72);
  var showNew = isNewOffer(offer);
  var initials = name
    .split(/\s+/)
    .map(function (w) {
      return w[0] || '';
    })
    .join('')
    .slice(0, 2)
    .toUpperCase();
  var isOlive = !isWildfireOffer(offer);
  var showInStoreTip = isOlive;
  var linkedCardHtml = isOlive ? buildLinkedCardHtml(card) : '';

  var catsHtml = '';
  if (descParts.full) {
    if (descParts.needsExpand) {
      catsHtml =
        '<button type="button" class="hc-shop-detail-cats hc-shop-detail-cats--expandable" data-shop-desc-toggle aria-expanded="false">' +
        '<span class="hc-shop-detail-cats-text" data-shop-desc-text>' +
        escapeHtml(descParts.short) +
        '</span>' +
        '<span class="hc-shop-detail-cats-more" data-shop-desc-more> more</span>' +
        '</button>';
    } else {
      catsHtml =
        '<p class="hc-shop-detail-cats">' + escapeHtml(descParts.full) + '</p>';
    }
  }

  return (
    '<div class="hc-shop-detail-scroll">' +
    '<div class="hc-shop-detail-hero">' +
    '<div class="hc-shop-detail-logo-wrap">' +
    (logo
      ? '<img data-hc-ph="store" data-hc-square src="' +
        escapeAttr(logo) +
        '" alt="" class="hc-shop-detail-logo" />'
      : '<span class="hc-shop-detail-logo-ph">' + escapeHtml(initials || '?') + '</span>') +
    '</div>' +
    '<h1 class="hc-shop-detail-name">' +
    escapeHtml(name) +
    '</h1>' +
    catsHtml +
    (showNew ? '<span class="hc-shop-detail-new">New</span>' : '') +
    '</div>' +
    linkedCardHtml +
    // In-person order: the store tip leads, exclusions follow, address last.
    '<div class="hc-shop-detail-tips">' +
    (showInStoreTip
      ? '<div class="hc-shop-detail-tip">' +
        '<span class="hc-shop-detail-tip-icon" aria-hidden="true">' +
        storeFilledSvg +
        '</span>' +
        '<div class="hc-shop-detail-tip-copy">' +
        '<div class="hc-shop-detail-tip-title">Shopping in the app or store?</div>' +
        '<div class="hc-shop-detail-tip-sub">Use your linked card to earn points.</div>' +
        '</div></div>'
      : '') +
    buildExclusionsHtml(offer) +
    buildAcceptedCardCarriersHtml(offer) +
    buildAddressHtml(offer) +
    '</div>' +
    '</div>' +
    '<div class="hc-shop-detail-footer">' +
    // In-person taps open the map picker, not a store link, so the label says so.
    '<button type="button" class="hc-shop-detail-shop-btn" data-shop-now>' +
    (shouldOpenDirections(offer) ? 'Get directions' : 'Shop now') +
    '</button>' +
    '</div>'
  );
}

async function loadShopDetail(container, offerId) {
  var body = container.querySelector('.hc-shop-detail-body');
  if (!body) return;

  try {
    var initialPayload = consumeInitialOfferPayload(offerId);
    var initialOffer =
      initialPayload && initialPayload.offer && typeof initialPayload.offer === 'object'
        ? initialPayload.offer
        : null;
    var preloadWildlink = !!(initialPayload && initialPayload.preloadWildlink);
    var offer = null;
    var canFetchById = offerId && offerId !== 'featured' && offerId !== 'unknown';
    var wildfireHint = !!(initialOffer && isWildfireOffer(initialOffer));
    var merchantIdHint = pickWildfireMerchantId(initialOffer) || (wildfireHint ? offerId : '');

    var wildlinkPromise = null;
    if ((wildfireHint || preloadWildlink) && merchantIdHint && api.getAccessToken()) {
      wildlinkPromise = api.trackWildfireClick(merchantIdHint).catch(function (err) {
        console.warn(
          '[HC shop-now] wildlink preload failed',
          err && err.message ? err.message : err
        );
        return null;
      });
    }

    var oliveOfferId =
      (initialOffer && !isWildfireOffer(initialOffer) && (initialOffer.offer_id || initialOffer.offerId)) ||
      '';
    if (oliveOfferId && String(oliveOfferId) === String(offerId)) {
      oliveOfferId = '';
    }

    var parallel = await Promise.all([
      wildfireHint || preloadWildlink
        ? Promise.resolve(null)
        : canFetchById
          ? api.getOfferDetails(offerId).catch(function (err) {
              console.warn(
                '[HC shop-now] getOfferDetails(routeId) failed',
                offerId,
                err && err.message ? err.message : err
              );
              return null;
            })
          : Promise.resolve(null),
      oliveOfferId
        ? api.getOfferDetails(oliveOfferId).catch(function (err) {
            console.warn(
              '[HC shop-now] getOfferDetails(offer_id) failed',
              oliveOfferId,
              err && err.message ? err.message : err
            );
            return null;
          })
        : Promise.resolve(null),
      api.getCards().catch(function () {
        return [];
      }),
      api.fetchCurrentUser().catch(function () {
        return null;
      }),
      merchantIdHint
        ? api.getWildfireMerchantDetail(merchantIdHint).catch(function (err) {
            console.warn(
              '[HC shop-now] getWildfireMerchantDetail failed',
              merchantIdHint,
              err && err.message ? err.message : err
            );
            return null;
          })
        : Promise.resolve(null),
    ]);

    var fetched = parallel[0] || parallel[1];
    var cards = parallel[2];
    var user = parallel[3];
    var wildfireDetail = parallel[4] && parallel[4].merchant ? parallel[4].merchant : null;

    if (wildfireDetail) {
      offer = Object.assign({}, initialOffer || {}, wildfireDetail, {
        offer_type: 'click',
        offerType: 'click',
        offerSource: 'wildfire',
        offer_source: 'wildfire',
      });
    } else if (fetched) {
      offer = Object.assign({}, initialOffer || {}, fetched);
    } else {
      offer = initialOffer;
    }

    // Callers can pin the exact artwork the user tapped (the preferred-partner
    // card passes its small mark). Applied after the merge because fetched
    // merchant data carries its own logo and would otherwise win.
    var logoOverride = initialPayload && initialPayload.logoOverride;
    if (offer && logoOverride) {
      offer = Object.assign({}, offer, { logoUrl: logoOverride });
    }

    if (!offer) {
      throw new Error('Shop not found');
    }

    if (isWildfireOffer(offer) && !wildlinkPromise) {
      var mid = pickWildfireMerchantId(offer);
      if (mid && api.getAccessToken()) {
        wildlinkPromise = api.trackWildfireClick(mid).catch(function (err) {
          console.warn(
            '[HC shop-now] wildlink preload failed',
            err && err.message ? err.message : err
          );
          return null;
        });
      }
    }

    var card = pickDisplayCard(cards);
    console.log('[HC shop-now] detail loaded', {
      name: offer.name || offer.merchantName,
      id: offer.id,
      offer_id: offer.offer_id,
      offerId: offer.offerId,
      offer_type: offer.offer_type || offer.offerType,
      website: offer.website,
      exclusions: pickExclusions(offer).length,
      hasInitial: !!initialOffer,
      hasFetched: !!fetched,
      hasWildfireDetail: !!wildfireDetail,
      wildlinkPreload: !!wildlinkPromise,
    });
    body.innerHTML = buildShopDetailHtml(offer, card);

    analytics.trackEmbedOfferDetailView(offer);
    bindShopDetailActions(container, {
      offer: offer,
      wildlinkPromise: wildlinkPromise,
    });
  } catch (err) {
    body.innerHTML =
      '<div class="hc-shop-detail-error">' +
      escapeHtml((err && err.message) || 'Failed to load shop') +
      '</div>';
  }
}

function openExternalUrl(url, title) {
  console.log('[HC shop-now] openExternalUrl start', { url: url, title: title || '' });
  if (!url) {
    console.warn('[HC shop-now] openExternalUrl aborted: empty url');
    return;
  }
  openMerchantUrl(url, title, { showSpinner: showFullscreenSpinner });
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
  var stale = document.querySelectorAll('.hc-route-spinner-overlay');
  for (var i = 0; i < stale.length; i++) stale[i].remove();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', function () {
    hideFullscreenSpinner();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') hideFullscreenSpinner();
  });
  window.addEventListener('focus', function () {
    hideFullscreenSpinner();
  });
}

function pickShopWebsite(offer) {
  if (!offer) return '';
  var store = offer.stores && offer.stores[0];
  return (
    offer.website ||
    offer.offerPublisherAffiliateLinkUrl ||
    offer.redemptionInstructionUrl ||
    (store && store.website) ||
    ''
  );
}

function pickStoreLatLng(offer) {
  if (!offer) return null;
  var store = offer.stores && offer.stores[0];
  var lat = Number(
    offer.latitude != null
      ? offer.latitude
      : offer.lat != null
        ? offer.lat
        : store && (store.latitude != null ? store.latitude : store.lat)
  );
  var lng = Number(
    offer.longitude != null
      ? offer.longitude
      : offer.lng != null
        ? offer.lng
        : store && (store.longitude != null ? store.longitude : store.lng)
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: lat, lng: lng };
}

function pickStoreMapsQuery(offer) {
  if (!offer) return '';
  var store = offer.stores && offer.stores[0];
  var address = offer.address || (store && store.address) || '';
  if (address) return String(address).trim();
  var name = pickName(offer);
  var city = offer.city || (store && store.city) || '';
  var state = offer.state || (store && store.state) || '';
  var loc = [city, state].filter(Boolean).join(', ');
  if (name && loc) return name + ' ' + loc;
  if (loc) return loc;
  return name !== 'Store' ? name : '';
}

/**
 * Full postal address for display, as opposed to pickStoreMapsQuery which is
 * built for routing and falls back to the merchant name.
 */
function pickStoreDisplayAddress(offer) {
  if (!offer) return '';
  var store = offer.stores && offer.stores[0];
  var pick = function (key) {
    return offer[key] || (store && store[key]) || '';
  };
  var street = pickStoreStreetAddress(offer);
  var city = pick('city');
  var state = pick('state');
  var postal = pick('postcode') || pick('postal_code') || pick('zip');
  var region = [state, postal].filter(Boolean).join(' ');
  return [street, city, region].filter(Boolean).join(', ');
}

/** In-person only — an online offer has no address worth showing. */
function buildAddressHtml(offer) {
  if (!offer || isClickOffer(offer)) return '';
  var address = pickStoreDisplayAddress(offer);
  if (!address) return '';
  return (
    '<div class="hc-shop-detail-tip">' +
    '<span class="hc-shop-detail-tip-icon" aria-hidden="true">' +
    locationSvg +
    '</span>' +
    '<div class="hc-shop-detail-tip-copy">' +
    '<div class="hc-shop-detail-tip-title">Address</div>' +
    '<div class="hc-shop-detail-tip-sub">' +
    escapeHtml(address) +
    '</div>' +
    '</div></div>'
  );
}

/** A street address on the offer or its first store — not the name fallback. */
function pickStoreStreetAddress(offer) {
  if (!offer) return '';
  var store = offer.stores && offer.stores[0];
  var address = offer.address || (store && store.address) || '';
  return String(address || '').trim();
}

/**
 * Destination descriptor for the shared directions picker. Coordinates route
 * most precisely, so they win; the address is still carried through for the
 * sheet's subtitle and as the fallback query.
 */
function buildOfferDirectionsDestination(offer) {
  var point = pickStoreLatLng(offer);
  var street = pickStoreStreetAddress(offer);
  var query = point ? point.lat + ',' + point.lng : pickStoreMapsQuery(offer);
  return {
    name: pickName(offer),
    address: street,
    query: query,
    lat: point ? point.lat : null,
    lng: point ? point.lng : null,
  };
}

/**
 * Directions make sense when the offer is not an online click-through and we
 * actually know where it is. Deliberately keyed off isClickOffer rather than
 * isWildfireOffer: the latter is true for any offer merely carrying a wildfire
 * merchant id, which a card-linked restaurant can still have.
 */
function shouldOpenDirections(offer) {
  if (!offer || isClickOffer(offer)) return false;
  return !!(pickStoreLatLng(offer) || pickStoreStreetAddress(offer));
}

function buildStoreMapsUrl(offer) {
  var point = pickStoreLatLng(offer);
  if (point) {
    return (
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(point.lat + ',' + point.lng)
    );
  }
  var query = pickStoreMapsQuery(offer);
  if (!query) return '';
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}

function openOliveOfferOnBigMap(offer) {
  if (!offer) return;
  var store = offer.stores && offer.stores[0];
  var merchant = Object.assign({}, offer);
  if (store && typeof store === 'object') {
    if (merchant.latitude == null && store.latitude != null) merchant.latitude = store.latitude;
    if (merchant.longitude == null && store.longitude != null) merchant.longitude = store.longitude;
    if (merchant.lat == null && store.lat != null) merchant.lat = store.lat;
    if (merchant.lng == null && store.lng != null) merchant.lng = store.lng;
    if (!merchant.address && store.address) merchant.address = store.address;
    if (!merchant.city && store.city) merchant.city = store.city;
    if (!merchant.state && store.state) merchant.state = store.state;
  }
  var offerId =
    pickOliveOfferId(offer) ||
    offer.id ||
    (store && (store.id || store.storeId)) ||
    '';
  try {
    sessionStorage.setItem(
      'hc_map_select_merchant',
      JSON.stringify({
        offerId: offerId != null ? String(offerId) : '',
        merchant: merchant,
      })
    );
  } catch (_e) {}
  navigate('/offers/map');
}

async function handleShopNow(offer, btn, wildlinkPromise) {
  console.log('[HC shop-now] click', {
    hasOffer: !!offer,
    hasBtn: !!btn,
    name: offer && (offer.name || offer.merchantName),
    id: offer && offer.id,
    offer_id: offer && offer.offer_id,
    offerId: offer && offer.offerId,
    offer_type: offer && (offer.offer_type || offer.offerType),
    offer_source: offer && (offer.offer_source || offer.offerSource),
    website: offer && offer.website,
    wildfireMerchantId: offer && (offer.wildfireMerchantId || offer.wildfire_merchant_id),
    isClick: isClickOffer(offer),
    isWildfire: isWildfireOffer(offer),
    hasWildlinkPromise: !!wildlinkPromise,
    keys: offer ? Object.keys(offer) : [],
  });

  if (!offer || !btn) {
    console.warn('[HC shop-now] aborted: missing offer or button');
    return;
  }
  var original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Opening...';

  try {
    // In-person first: an offer with a physical location has nothing to open
    // online, so hand its address to the user's map app. This sits ahead of the
    // wildfire branch because isWildfireOffer() is true for any offer carrying a
    // merchant id, which would otherwise swallow card-linked stores.
    if (shouldOpenDirections(offer)) {
      console.log('[HC shop-now] in-person → directions picker');
      try {
        analytics.trackEmbedOfferLinkClick(
          Object.assign({}, analytics.offerEmbedPayload(offer), {
            entry_point: 'embed_shop_detail_shop_now',
            flow: 'olive_directions',
          })
        );
      } catch (analyticsErr0) {
        console.warn('[HC shop-now] analytics error', analyticsErr0);
      }
      openDirectionsPicker(buildOfferDirectionsDestination(offer));
      return;
    }

    if (isWildfireOffer(offer)) {
      var merchantId = pickWildfireMerchantId(offer);
      var hasToken = !!api.getAccessToken();
      var trackingUrl = null;

      if (wildlinkPromise) {
        var preloadResult = await wildlinkPromise.catch(function () {
          return null;
        });
        trackingUrl =
          preloadResult &&
          (preloadResult.tracking_url || preloadResult.trackingUrl || null);
        console.log('[HC shop-now] wildlink preload result', {
          hasUrl: !!trackingUrl,
          success: preloadResult && preloadResult.success,
        });
      }

      if (!trackingUrl && merchantId && hasToken) {
        var trackResult = await api.trackWildfireClick(merchantId).catch(function (err) {
          console.warn(
            '[HC shop-now] trackWildfireClick error',
            err && err.message ? err.message : err
          );
          return null;
        });
        trackingUrl =
          trackResult && (trackResult.tracking_url || trackResult.trackingUrl);
      }

      if (trackingUrl) {
        try {
          analytics.trackEmbedOfferLinkClick(
            Object.assign({}, analytics.offerEmbedPayload(offer), {
              entry_point: 'embed_shop_detail_shop_now',
              flow: 'wildfire_vanity',
            })
          );
        } catch (analyticsErr) {
          console.warn('[HC shop-now] analytics error', analyticsErr);
        }
        openExternalUrl(trackingUrl, pickName(offer));
        return;
      }

      var wildfireUrl = merchantId ? api.buildWildfireRedirectUrl(merchantId) : null;
      console.log('[HC shop-now] wildfire branch fallback redirect', {
        merchantId: merchantId,
        hasToken: hasToken,
        hasTokenUrl: !!wildfireUrl,
        wildfireUrl: wildfireUrl,
      });
      if (wildfireUrl) {
        try {
          analytics.trackEmbedOfferLinkClick(
            Object.assign({}, analytics.offerEmbedPayload(offer), {
              entry_point: 'embed_shop_detail_shop_now',
              flow: 'wildfire_redirect',
            })
          );
        } catch (analyticsErr2) {
          console.warn('[HC shop-now] analytics error', analyticsErr2);
        }
        openExternalUrl(wildfireUrl, pickName(offer));
        return;
      }
      console.warn('[HC shop-now] wildfire: no redirect url', {
        merchantId: merchantId,
        hasToken: hasToken,
      });
      if (!hasToken) {
        window.alert('Please log in to open this store.');
        return;
      }
      if (!merchantId) {
        window.alert('Unable to open this store right now. Please try again.');
        return;
      }
    }

    // Card-linked with no known location: nothing to navigate to, so fall back
    // to the in-app map where the user can find nearby stores.
    if (!isWildfireOffer(offer) && !isClickOffer(offer)) {
      console.log('[HC shop-now] olive, no location → big map');
      try {
        analytics.trackEmbedOfferLinkClick(
          Object.assign({}, analytics.offerEmbedPayload(offer), {
            entry_point: 'embed_shop_detail_shop_now',
            flow: 'olive_map',
          })
        );
      } catch (analyticsErr3) {
        console.warn('[HC shop-now] analytics error', analyticsErr3);
      }
      openOliveOfferOnBigMap(offer);
      return;
    }

    var oliveId = pickOliveOfferId(offer);
    console.log('[HC shop-now] olive track id', oliveId);
    if (oliveId && isClickOffer(offer)) {
      var trackResult = await api.trackOfferClick(oliveId).catch(function (err) {
        console.warn('[HC shop-now] trackOfferClick error', err && err.message ? err.message : err);
        return null;
      });
      console.log('[HC shop-now] trackOfferClick result', trackResult);
      var trackUrl =
        trackResult && (trackResult.tracking_url || trackResult.trackingUrl);
      if (trackUrl) {
        console.log('[HC shop-now] using olive tracking url', trackUrl);
        analytics.trackEmbedOfferLinkClick(
          Object.assign({}, analytics.offerEmbedPayload(offer), {
            entry_point: 'embed_shop_detail_shop_now',
            flow: 'olive_tracking',
          })
        );
        openExternalUrl(trackUrl, pickName(offer));
        return;
      }
    }

    var shopUrl = pickShopWebsite(offer);
    if (!shopUrl && oliveId) {
      console.log('[HC shop-now] fetching offer details for website', oliveId);
      var details = await api.getOfferDetails(oliveId).catch(function (err) {
        console.warn(
          '[HC shop-now] getOfferDetails on shop-now failed',
          err && err.message ? err.message : err
        );
        return null;
      });
      if (details) {
        Object.assign(offer, details);
        shopUrl = pickShopWebsite(offer);
        console.log('[HC shop-now] details website', shopUrl || '(empty)', details);
      }
    }

    console.log('[HC shop-now] website', shopUrl || '(empty)');
    if (shopUrl) {
      analytics.trackEmbedOfferLinkClick(
        Object.assign({}, analytics.offerEmbedPayload(offer), {
          entry_point: 'embed_shop_detail_shop_now',
          flow: 'direct_or_fallback',
        })
      );
      openExternalUrl(shopUrl, pickName(offer));
      return;
    }

    var mapsUrl = buildStoreMapsUrl(offer);
    console.log('[HC shop-now] maps url', mapsUrl || '(empty)');
    if (mapsUrl) {
      analytics.trackEmbedOfferLinkClick(
        Object.assign({}, analytics.offerEmbedPayload(offer), {
          entry_point: 'embed_shop_detail_shop_now',
          flow: 'store_maps',
        })
      );
      openExternalUrl(mapsUrl, pickName(offer));
      return;
    }

    console.error('[HC shop-now] no openable url found for offer', offer);
    window.alert('Unable to open this store right now. Please try again.');
  } catch (err) {
    console.error('[HC shop-now] unexpected error', err);
    window.alert('Unable to open this store right now. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent =
      original || (shouldOpenDirections(offer) ? 'Get directions' : 'Shop now');
  }
}

function bindCardBannerActions(container, state) {
  var manageBtn = container.querySelector('[data-shop-manage-card]');
  if (manageBtn) {
    manageBtn.addEventListener('click', function () {
      navigate('/cards');
    });
  }
  var linkBtn = container.querySelector('[data-shop-link-card]');
  if (linkBtn) {
    linkBtn.addEventListener('click', function () {
      navigate('/cards/link-intro');
    });
  }
}

function bindShopDetailActions(container, state) {
  state = state || {};
  bindCardBannerActions(container, state);

  var descToggle = container.querySelector('[data-shop-desc-toggle]');
  if (descToggle) {
    var fullDesc = pickCategories(state.offer);
    var shortParts = truncateDescription(fullDesc, 72);
    descToggle.addEventListener('click', function () {
      var expanded = descToggle.getAttribute('aria-expanded') === 'true';
      var textEl = descToggle.querySelector('[data-shop-desc-text]');
      var moreEl = descToggle.querySelector('[data-shop-desc-more]');
      if (!textEl) return;
      if (expanded) {
        textEl.textContent = shortParts.short;
        if (moreEl) moreEl.hidden = false;
        descToggle.setAttribute('aria-expanded', 'false');
      } else {
        textEl.textContent = shortParts.full;
        if (moreEl) moreEl.hidden = true;
        descToggle.setAttribute('aria-expanded', 'true');
      }
    });
  }

  var shopBtn = container.querySelector('[data-shop-now]');
  console.log('[HC shop-now] bind button', {
    found: !!shopBtn,
    hasOffer: !!(state && state.offer),
    offerName: state && state.offer && (state.offer.name || state.offer.merchantName),
    hasWildlinkPromise: !!(state && state.wildlinkPromise),
  });
  if (shopBtn) {
    shopBtn.addEventListener('click', function () {
      console.log('[HC shop-now] button clicked');
      handleShopNow(state.offer, shopBtn, state.wildlinkPromise);
    });
  }
}
