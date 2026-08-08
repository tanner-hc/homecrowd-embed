import * as api from '../api.js';
import * as analytics from '../analytics.js';
import { hasNativeBridge, postToNative } from '../bridge.js';
import { showWebviewOverlay } from '../webview-overlay.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { buildAppHeaderHtml, attachAppHeader } from '../base-components/AppHeader.js';
import { openBottomSheet } from '../base-components/BottomSheetModal.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import cardFilledSvg from '../assets/icons/card-filled.svg?raw';
import storeSvg from '../assets/icons/store.svg?raw';
import crossIconUrl from '../assets/icons/cross.png';
import checkmarkSvg from '../assets/icons/checkmark.svg?raw';

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

function consumeInitialOffer(offerId) {
  try {
    var raw = sessionStorage.getItem('hc_offer_detail_initial');
    if (!raw) return null;
    sessionStorage.removeItem('hc_offer_detail_initial');
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    var savedId = parsed.offerId != null ? String(parsed.offerId) : '';
    if (savedId && offerId && savedId !== String(offerId)) return null;
    return parsed.offer && typeof parsed.offer === 'object' ? parsed.offer : null;
  } catch (_e) {
    return null;
  }
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
  var active = list.filter(function (c) {
    return c && String(c.status || '').toLowerCase() === 'active';
  });
  return active.length ? active : list.filter(Boolean);
}

function pickDisplayCard(cards) {
  var active = listActiveCards(cards);
  if (!active.length) return null;
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

function cardBrandLabel(card) {
  var raw = String(
    (card && (card.brand || card.scheme || card.network || card.card_brand || card.type)) || ''
  ).toLowerCase();
  if (raw.indexOf('master') >= 0 || raw === 'mc') return 'Mastercard';
  if (raw.indexOf('amex') >= 0 || raw.indexOf('american') >= 0) return 'Amex';
  if (raw.indexOf('discover') >= 0) return 'Discover';
  if (raw.indexOf('visa') >= 0 || !raw) return 'Visa';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function pickAvatar(user) {
  if (!user) return '';
  return (
    user.avatar_url ||
    user.avatarUrl ||
    user.profile_image ||
    user.profileImage ||
    ''
  );
}

function buildLinkedCardHtml(card, avatarUri) {
  if (card && card.last4) {
    return (
      '<div class="hc-shop-detail-card-slot" data-shop-card-slot>' +
      '<div class="hc-shop-detail-card-banner">' +
      '<div class="hc-shop-detail-card-banner-main">' +
      '<span class="hc-shop-detail-card-icon" aria-hidden="true">' +
      cardFilledSvg +
      '</span>' +
      '<div class="hc-shop-detail-card-copy">' +
      '<div class="hc-shop-detail-card-title">Use ' +
      escapeHtml(cardBrandLabel(card)) +
      ' •••• ' +
      escapeHtml(String(card.last4)) +
      '</div>' +
      '<div class="hc-shop-detail-card-sub">Pay with this linked card to earn points</div>' +
      '</div>' +
      '<button type="button" class="hc-shop-detail-card-cta" data-shop-manage-card>Manage</button>' +
      '</div>' +
      (avatarUri
        ? '<img src="' +
          escapeAttr(avatarUri) +
          '" alt="" class="hc-shop-detail-card-avatar" />'
        : '') +
      '</div></div>'
    );
  }

  return (
    '<div class="hc-shop-detail-card-slot" data-shop-card-slot>' +
    '<div class="hc-shop-detail-card-banner">' +
    '<div class="hc-shop-detail-card-banner-main">' +
    '<span class="hc-shop-detail-card-icon" aria-hidden="true">' +
    cardFilledSvg +
    '</span>' +
    '<div class="hc-shop-detail-card-copy">' +
    '<div class="hc-shop-detail-card-title">Link a card to earn</div>' +
    '<div class="hc-shop-detail-card-sub">Pay with a linked card to earn points</div>' +
    '</div>' +
    '<button type="button" class="hc-shop-detail-card-cta" data-shop-link-card>Link</button>' +
    '</div>' +
    (avatarUri
      ? '<img src="' +
        escapeAttr(avatarUri) +
        '" alt="" class="hc-shop-detail-card-avatar" />'
      : '') +
    '</div></div>'
  );
}

function buildCardPickerBodyHtml(cards, selectedId) {
  var rows = (cards || [])
    .map(function (card) {
      var selected = String(card.id) === String(selectedId);
      var label =
        cardBrandLabel(card) +
        ' •••• ' +
        String(card.last4 || '') +
        (card.nickname ? ' · ' + card.nickname : '');
      return (
        '<button type="button" class="hc-shop-card-pick' +
        (selected ? ' hc-shop-card-pick--selected' : '') +
        '" data-shop-pick-card="' +
        escapeAttr(String(card.id)) +
        '">' +
        '<span class="hc-shop-card-pick-icon" aria-hidden="true">' +
        cardFilledSvg +
        '</span>' +
        '<span class="hc-shop-card-pick-label">' +
        escapeHtml(label) +
        '</span>' +
        (selected
          ? '<span class="hc-shop-card-pick-check" aria-hidden="true">' +
            checkmarkSvg +
            '</span>'
          : '') +
        '</button>'
      );
    })
    .join('');

  return (
    '<div class="hc-shop-card-picker">' +
    rows +
    '<button type="button" class="hc-shop-card-pick hc-shop-card-pick--add" data-shop-pick-add>' +
    '<span class="hc-shop-card-pick-label">Add another card</span>' +
    '</button>' +
    '</div>'
  );
}

function buildShopDetailHtml(offer, card, user) {
  var name = pickName(offer);
  var logo = pickLogo(offer);
  var categories = pickCategories(offer);
  var showNew = isNewOffer(offer);
  var avatarUri = pickAvatar(user);
  var initials = name
    .split(/\s+/)
    .map(function (w) {
      return w[0] || '';
    })
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    '<div class="hc-shop-detail-scroll">' +
    '<div class="hc-shop-detail-hero">' +
    '<div class="hc-shop-detail-logo-wrap">' +
    (logo
      ? '<img src="' +
        escapeAttr(logo) +
        '" alt="" class="hc-shop-detail-logo" />'
      : '<span class="hc-shop-detail-logo-ph">' + escapeHtml(initials || '?') + '</span>') +
    '</div>' +
    '<h1 class="hc-shop-detail-name">' +
    escapeHtml(name) +
    '</h1>' +
    (categories
      ? '<p class="hc-shop-detail-cats">' + escapeHtml(categories) + '</p>'
      : '') +
    (showNew ? '<span class="hc-shop-detail-new">New</span>' : '') +
    '</div>' +
    buildLinkedCardHtml(card, avatarUri) +
    '<div class="hc-shop-detail-tips">' +
    '<div class="hc-shop-detail-tip">' +
    '<span class="hc-shop-detail-tip-icon" aria-hidden="true">' +
    '<img src="' +
    escapeAttr(crossIconUrl) +
    '" alt="" class="hc-shop-detail-tip-icon-img" />' +
    '</span>' +
    '<div class="hc-shop-detail-tip-copy">' +
    '<div class="hc-shop-detail-tip-title">Some purchases won&rsquo;t earn points</div>' +
    '<div class="hc-shop-detail-tip-sub">Certain product categories and purchases using promo codes may not qualify.</div>' +
    '</div></div>' +
    '<div class="hc-shop-detail-tip">' +
    '<span class="hc-shop-detail-tip-icon" aria-hidden="true">' +
    storeSvg +
    '</span>' +
    '<div class="hc-shop-detail-tip-copy">' +
    '<div class="hc-shop-detail-tip-title">Shopping in the app or store?</div>' +
    '<div class="hc-shop-detail-tip-sub">Use your linked card to earn points.</div>' +
    '</div></div>' +
    '</div>' +
    '</div>' +
    '<div class="hc-shop-detail-footer">' +
    '<button type="button" class="hc-shop-detail-shop-btn" data-shop-now>Shop now</button>' +
    '</div>'
  );
}

async function loadShopDetail(container, offerId) {
  var body = container.querySelector('.hc-shop-detail-body');
  if (!body) return;

  try {
    var initialOffer = consumeInitialOffer(offerId);
    var offer = null;
    var canFetchById = offerId && offerId !== 'featured' && offerId !== 'unknown';
    var oliveOfferId =
      (initialOffer && (initialOffer.offer_id || initialOffer.offerId)) || '';
    if (oliveOfferId && String(oliveOfferId) === String(offerId)) {
      oliveOfferId = '';
    }

    var parallel = await Promise.all([
      canFetchById
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
    ]);

    var fetched = parallel[0] || parallel[1];
    var cards = parallel[2];
    var user = parallel[3];

    if (fetched) {
      offer = Object.assign({}, initialOffer || {}, fetched);
    } else {
      offer = initialOffer;
    }

    if (!offer) {
      throw new Error('Shop not found');
    }

    var card = pickDisplayCard(cards);
    console.log('[HC shop-now] detail loaded', {
      name: offer.name || offer.merchantName,
      id: offer.id,
      offer_id: offer.offer_id,
      offerId: offer.offerId,
      offer_type: offer.offer_type || offer.offerType,
      website: offer.website,
      hasInitial: !!initialOffer,
      hasFetched: !!fetched,
    });
    body.innerHTML = buildShopDetailHtml(offer, card, user);

    analytics.trackEmbedOfferDetailView(offer);
    bindShopDetailActions(container, {
      offer: offer,
      cards: listActiveCards(cards),
      user: user,
      selectedCard: card,
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
  if (url.indexOf('http') !== 0) url = 'https://' + url;

  if (hasNativeBridge()) {
    console.log('[HC shop-now] notify native bridge', url);
    try {
      postToNative('homecrowd:open-url', { url: url, title: title || '' });
    } catch (e1) {
      console.warn('[HC shop-now] open-url post failed', e1);
    }
    try {
      postToNative('homecrowd:open-merchant-webview', { url: url, title: title || '' });
    } catch (e2) {
      console.warn('[HC shop-now] open-merchant-webview post failed', e2);
    }
  }

  console.log('[HC shop-now] top-level navigate', url);
  showFullscreenSpinner();
  window.location.href = url;
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

async function handleShopNow(offer, btn) {
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
    if (isWildfireOffer(offer)) {
      var merchantId = pickWildfireMerchantId(offer);
      var hasToken = !!api.getAccessToken();
      var wildfireUrl = merchantId ? api.buildWildfireRedirectUrl(merchantId) : null;
      console.log('[HC shop-now] wildfire branch', {
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
        } catch (analyticsErr) {
          console.warn('[HC shop-now] analytics error', analyticsErr);
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
    btn.textContent = original || 'Shop now';
  }
}

function refreshLinkedCardBanner(container, state) {
  var slot = container.querySelector('[data-shop-card-slot]');
  if (!slot) return;
  var html = buildLinkedCardHtml(state.selectedCard, pickAvatar(state.user));
  slot.outerHTML = html;
  bindCardBannerActions(container, state);
}

function openCardPicker(container, state) {
  var cards = state.cards || [];
  var selectedId = state.selectedCard && state.selectedCard.id;
  var sheet = openBottomSheet({
    title: 'Choose a card',
    bodyHtml: buildCardPickerBodyHtml(cards, selectedId),
    secondaryButton: {
      label: 'Manage cards',
      onPress: function () {
        navigate('/cards');
      },
    },
  });

  var root = sheet && sheet.root;
  if (!root) return;

  root.querySelectorAll('[data-shop-pick-card]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-shop-pick-card');
      var next = cards.find(function (c) {
        return String(c.id) === String(id);
      });
      if (!next) return;
      setPreferredCardId(next.id);
      state.selectedCard = next;
      refreshLinkedCardBanner(container, state);
      if (typeof sheet.close === 'function') sheet.close();
    });
  });

  var addBtn = root.querySelector('[data-shop-pick-add]');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      if (typeof sheet.close === 'function') {
        sheet.close(function () {
          navigate('/cards/link-intro');
        });
      } else {
        navigate('/cards/link-intro');
      }
    });
  }
}

function bindCardBannerActions(container, state) {
  var manageBtn = container.querySelector('[data-shop-manage-card]');
  if (manageBtn) {
    manageBtn.addEventListener('click', function () {
      if ((state.cards || []).length) {
        openCardPicker(container, state);
        return;
      }
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
  var shopBtn = container.querySelector('[data-shop-now]');
  console.log('[HC shop-now] bind button', {
    found: !!shopBtn,
    hasOffer: !!(state && state.offer),
    offerName: state && state.offer && (state.offer.name || state.offer.merchantName),
  });
  if (shopBtn) {
    shopBtn.addEventListener('click', function () {
      console.log('[HC shop-now] button clicked');
      handleShopNow(state.offer, shopBtn);
    });
  }
}
