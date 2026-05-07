import * as api from './api.js';

function ingestEvents(events) {
  return api.postAnalyticsEvents(events).catch(function () {
    return null;
  });
}

export function routePathOnly(route) {
  var raw = route || '';
  var q = raw.indexOf('?');
  var p = q >= 0 ? raw.slice(0, q) : raw;
  return p.replace(/^#/, '').replace(/^\/?/, '/') || '/';
}

export function trackEmbedScreen(route) {
  var path = routePathOnly(route);
  if (path === '') path = '/';
  return ingestEvents([
    {
      event_type: 'screen_visit',
      payload: { screen: path },
    },
  ]);
}

export function trackEmbedSearch(query, marketplaceTab) {
  var q = String(query || '').trim();
  if (q.length < 2) {
    return Promise.resolve(null);
  }
  return ingestEvents([
    {
      event_type: 'search',
      payload: {
        query: q.slice(0, 200),
        marketplace_tab: marketplaceTab,
      },
    },
  ]);
}

export function offerEmbedPayload(offer) {
  if (!offer || typeof offer !== 'object') {
    return {};
  }
  return {
    offer_id: offer.offerId != null ? offer.offerId : offer.id,
    offer_source: offer.offerSource,
    offer_type: offer.offerType,
    merchant_label: offer.merchantName || offer.name,
  };
}

export function trackEmbedOfferDetailView(offer) {
  return ingestEvents([
    {
      event_type: 'offer_detail_view',
      payload: offerEmbedPayload(offer),
    },
  ]);
}

export function trackEmbedOfferLinkClick(extra) {
  var payload =
    extra && typeof extra === 'object' ? Object.assign({}, extra) : {};
  return ingestEvents([
    {
      event_type: 'offer_link_click',
      payload: payload,
    },
  ]);
}

function pickRewardSchoolId(rewardProduct, fallbackUser) {
  if (!rewardProduct || typeof rewardProduct !== 'object') {
    var u0 = fallbackUser;
    var asch0 = u0 && (u0.active_school || u0.activeSchool);
    if (asch0 != null && typeof asch0 === 'object' && asch0.id != null && asch0.id !== '')
      return String(asch0.id);
    return null;
  }
  var school = rewardProduct.school;
  var sid =
    school != null && typeof school === 'object'
      ? school.id
      : rewardProduct.school_id != null
        ? rewardProduct.school_id
        : rewardProduct.schoolId;
  if (sid != null && sid !== '') return String(sid);
  var u = fallbackUser;
  var asch = u && (u.active_school || u.activeSchool);
  if (asch != null && typeof asch === 'object' && asch.id != null && asch.id !== '')
    return String(asch.id);
  return null;
}

function rewardAnalyticsPayload(rewardProduct, fallbackUser) {
  var rid =
    rewardProduct &&
    typeof rewardProduct === 'object' &&
    (rewardProduct.id ??
      rewardProduct.reward_id ??
      rewardProduct.rewardId);
  if (rid == null || rid === '') return null;
  var title =
    rewardProduct.title || rewardProduct.name || rewardProduct.product_title || '';
  return {
    reward_id: String(rid),
    reward_title: String(title).slice(0, 200),
    school_id: pickRewardSchoolId(rewardProduct, fallbackUser),
    redemption_type:
      rewardProduct && rewardProduct.redemption_type != null
        ? rewardProduct.redemption_type
        : null,
    points_cost:
      rewardProduct &&
      typeof rewardProduct.points_cost === 'number'
        ? rewardProduct.points_cost
        : null,
  };
}

export function trackEmbedRewardClick(rewardProduct, fallbackUser) {
  var payload = rewardAnalyticsPayload(rewardProduct, fallbackUser);
  if (!payload) return Promise.resolve(null);
  return ingestEvents([
    {
      event_type: 'reward_click',
      payload: payload,
    },
  ]);
}

export function trackEmbedRewardDetailView(rewardProduct, fallbackUser) {
  var payload = rewardAnalyticsPayload(rewardProduct, fallbackUser);
  if (!payload) return Promise.resolve(null);
  if (String(payload.reward_id).indexOf('weekly-') === 0) return Promise.resolve(null);
  return ingestEvents([
    {
      event_type: 'reward_detail_view',
      payload: payload,
    },
  ]);
}
