var EMBED_BASE = '/api/embed/v1';

function resolveApiBaseUrl() {
  var env =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL;
  if (env) {
    return String(env).replace(/\/$/, '');
  }
  var h = window.location.hostname || '';
  if (h === 'embed.gethomecrowd.com') {
    return 'https://api.gethomecrowd.com';
  }
  var isDevHost =
    h === 'localhost' ||
    h === '127.0.0.1' ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h);
  if (isDevHost) {
    return '';
  }
  return 'https://api.gethomecrowd.com';
}

var baseUrl = resolveApiBaseUrl();
var accessToken = null;
var refreshToken = null;
var wildfireAppId = '';

function normalizeWildfireAppId(value) {
  if (value == null) return '';
  var normalized = String(value).trim();
  if (!normalized) return '';
  return normalized;
}

export function setEmbedContext(context) {
  var next = context && typeof context === 'object' ? context : {};
  wildfireAppId = normalizeWildfireAppId(next.wildfireAppId);
}

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh || null;
  sessionStorage.setItem('hc_access_token', access);
  if (refresh) sessionStorage.setItem('hc_refresh_token', refresh);
}

export function getAccessToken() {
  if (!accessToken) {
    accessToken = sessionStorage.getItem('hc_access_token');
  }
  return accessToken;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  sessionStorage.removeItem('hc_access_token');
  sessionStorage.removeItem('hc_refresh_token');
}

export function isAuthenticated() {
  return getAccessToken() != null;
}

async function refreshAccessToken() {
  var rt = refreshToken || sessionStorage.getItem('hc_refresh_token');
  if (!rt) return false;

  try {
    var res = await fetch(baseUrl + EMBED_BASE + '/auth/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: rt }),
    });
    if (!res.ok) return false;
    var data = await res.json();
    setTokens(data.access, rt);
    return true;
  } catch (e) {
    return false;
  }
}

async function request(path, options) {
  options = options || {};
  var token = getAccessToken();
  var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (typeof window !== 'undefined' && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    headers['X-Homecrowd-Client'] = 'mobile';
  }
  if (wildfireAppId) {
    headers['X-Homecrowd-Wildfire-App-Id'] = wildfireAppId;
  }

  var res = await fetch(baseUrl + path, Object.assign({}, options, { headers: headers }));

  if (res.status === 401 && token) {
    var refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = 'Bearer ' + getAccessToken();
      res = await fetch(baseUrl + path, Object.assign({}, options, { headers: headers }));
    } else {
      clearTokens();
      window.location.hash = '#/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    var body = await res.text();
    var message = 'Request failed (' + res.status + ')';
    try {
      var parsed = JSON.parse(body);
      if (typeof parsed.detail === 'string') {
        message = parsed.detail;
      } else if (parsed.detail != null) {
        message = String(parsed.detail);
      } else if (parsed && typeof parsed === 'object') {
        var parts = [];
        Object.keys(parsed).forEach(function (k) {
          var v = parsed[k];
          if (Array.isArray(v)) parts.push(v.join(' '));
          else if (typeof v === 'string') parts.push(v);
        });
        if (parts.length) message = parts.join(' ');
      }
    } catch (e) { }
    throw new Error(message);
  }

  return res.json();
}

// --- Auth ---

export async function login(email, password) {
  var token = 'email:' + email + ':' + password;
  var data = await request(EMBED_BASE + '/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ token: token }),
  });
  setTokens(data.access, data.refresh);
  return data;
}

export async function loginWithPartnerToken(token) {
  return loginWithPartnerTokenAndSchool(token);
}

export async function loginWithPartnerTokenAndSchool(token, schoolId) {
  var payload =
    token && String(token).indexOf('autologin:') === 0
      ? { token: token }
      : schoolId
        ? { token: token, schoolId: schoolId }
        : { token: token };
  var data = await request(EMBED_BASE + '/auth/login/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setTokens(data.access, data.refresh);
  return data;
}

export async function fetchSchoolConfig(schoolId) {
  return request('/api/school/merchants-page-config/' + encodeURIComponent(schoolId) + '/');
}

export async function fetchCurrentUser() {
  return request(EMBED_BASE + '/auth/me/');
}

export async function getUserProfile() {
  return request('/api/users/users/profile/');
}

export async function updateUserProfile(payload) {
  return request('/api/users/users/profile/', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getEmbedMapKitJsToken() {
  return request(EMBED_BASE + '/mapkit-js-token/');
}

export async function logout() {
  try {
    await request(EMBED_BASE + '/auth/logout/', { method: 'POST' });
  } catch (e) {
    // ignore
  }
  clearTokens();
}

export async function resendVerificationEmail() {
  return request('/api/users/resend-verification-email/', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function changePassword(payload) {
  return request('/api/auth/change-password/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// --- Rewards ---

export async function getRewardsSummary() {
  return request(EMBED_BASE + '/rewards/summary/');
}

export async function getRewardsCatalog() {
  return request(EMBED_BASE + '/rewards/catalog/');
}

export async function getRewardDetail(rewardId) {
  return request('/api/rewards/rewards/' + encodeURIComponent(rewardId) + '/');
}

export async function createRedemptionMain(payload) {
  return request('/api/rewards/redemptions/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function placeAuctionBid(auctionId, bidAmount) {
  return request('/api/rewards/auctions/' + encodeURIComponent(auctionId) + '/bid/', {
    method: 'POST',
    body: JSON.stringify({ bid_amount: bidAmount }),
  });
}

export async function getRaffleTickets() {
  return request(EMBED_BASE + '/rewards/raffle-tickets/?available=true');
}

export async function getRaffleTicketsList() {
  return request('/api/rewards/raffle-tickets/?available=true');
}

export async function getWeeklyLeaderboard() {
  return request(EMBED_BASE + '/rewards/leaderboard/');
}

export async function getRewardsActivity() {
  return request(EMBED_BASE + '/rewards/activity/');
}

export async function getUserActivityLog(options) {
  options = options || {};
  var q = '';
  if (options.limit) {
    q = '?limit=' + encodeURIComponent(String(options.limit));
  }
  var data = await request('/api/rewards/user/activity/' + q);
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.activity_log)) {
    return data.activity_log;
  }
  return [];
}

export async function getOliveTransactions() {
  return request('/api/olive/listTransactions');
}

export async function redeemReward(rewardId, quantity) {
  return request(EMBED_BASE + '/rewards/redeem/', {
    method: 'POST',
    body: JSON.stringify({ rewardId: rewardId, quantity: quantity || 1 }),
  });
}

export function buildStripeReturnUrls() {
  var loc = window.location;
  var base = loc.origin + loc.pathname + loc.search;
  var sep = base.indexOf('?') >= 0 ? '&' : '?';
  var h = loc.hash || '#/rewards';
  return {
    success_url: base + sep + 'stripe_success=1&session_id={CHECKOUT_SESSION_ID}' + h,
    cancel_url: base + sep + 'stripe_cancel=1' + h,
  };
}

export async function createStripeRewardCheckoutSession(rewardId) {
  var urls = buildStripeReturnUrls();
  return request(EMBED_BASE + '/rewards/stripe-checkout/', {
    method: 'POST',
    body: JSON.stringify({
      reward_id: rewardId,
      success_url: urls.success_url,
      cancel_url: urls.cancel_url,
    }),
  });
}

// --- Cards ---

export async function getCards() {
  return request(EMBED_BASE + '/cards/');
}

export async function createCardLinkSession() {
  return request(EMBED_BASE + '/cards/link-session/', { method: 'POST' });
}

export async function deactivateCard(cardId) {
  return request(EMBED_BASE + '/cards/' + encodeURIComponent(cardId) + '/deactivate/', {
    method: 'POST',
  });
}

// --- Offers ---

export async function getOffers(page, pageSize, userLocationOrLat, longitude) {
  var params = 'page=' + (page || 1) + '&pageSize=' + (pageSize || 50);
  var lat;
  var lon;
  if (
    userLocationOrLat &&
    typeof userLocationOrLat === 'object' &&
    userLocationOrLat.latitude != null &&
    userLocationOrLat.longitude != null
  ) {
    lat = userLocationOrLat.latitude;
    lon = userLocationOrLat.longitude;
  } else {
    lat = userLocationOrLat;
    lon = longitude;
  }
  if (lat != null && lon != null && String(lat).trim() !== '' && String(lon).trim() !== '') {
    params +=
      '&latitude=' +
      encodeURIComponent(String(lat)) +
      '&longitude=' +
      encodeURIComponent(String(lon));
  }
  return request('/api/olive/offers/?' + params);
}

export async function getOfferDetails(offerId) {
  return request('/api/olive/offers/' + encodeURIComponent(offerId) + '/');
}

export async function trackOfferClick(offerId) {
  return request('/api/olive/track-click/?offer_id=' + encodeURIComponent(offerId));
}

export async function getWildfireOffers(page, pageSize) {
  var params = 'page=' + (page || 1) + '&pageSize=' + (pageSize || 50);
  if (wildfireAppId) {
    params += '&wildfire_app_id=' + encodeURIComponent(wildfireAppId);
  }
  return request('/api/wildfire/offers/?' + params);
}

export async function trackWildfireClick(merchantId) {
  var params = 'merchant_id=' + encodeURIComponent(merchantId);
  if (wildfireAppId) {
    params += '&wildfire_app_id=' + encodeURIComponent(wildfireAppId);
  }
  return request('/api/wildfire/track-click/?' + params);
}

export async function getFeaturedOffers(offerType) {
  var params = offerType ? '?offer_type=' + offerType : '';
  return request('/api/merchant/featured-offers/' + params);
}

export async function getLeaderboard() {
  return request('/api/users/leaderboard/');
}

export async function getUserPointsSummary(userId) {
  return request('/api/users/users/' + encodeURIComponent(userId) + '/points_summary/');
}

export async function getRaffleTicketsSummary() {
  return request('/api/rewards/raffle-tickets/summary/');
}

export async function getRaffleEntriesSummary() {
  return request('/api/rewards/raffle-entries/summary/');
}

export async function getReferralCampaign() {
  return request('/api/users/users/referral-campaign/');
}

export async function getManagedLinks() {
  return request('/api/users/managed-links/');
}

export async function sendReferralInviteEmail(email) {
  var clean = String(email || '').trim();
  return request('/api/users/users/invite-friend/', {
    method: 'POST',
    body: JSON.stringify({ email: clean }),
  });
}

export async function submitSupportMessage(message, context) {
  var payload = Object.assign({ message: String(message || '').trim() }, context || {});
  return request('/api/users/contact-support/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getContent(options) {
  options = options || {};
  var params = [];
  if (options.content_type) {
    params.push('content_type=' + encodeURIComponent(String(options.content_type)));
  }
  if (options.status != null) {
    params.push('status=' + encodeURIComponent(String(options.status)));
  } else {
    params.push('status=active');
  }
  if (options.featured !== undefined) {
    params.push('featured=' + encodeURIComponent(String(options.featured)));
  }
  var query = params.length ? '?' + params.join('&') : '';
  return request('/api/content/' + query);
}

export async function getContentItem(contentId) {
  return request('/api/content/' + encodeURIComponent(contentId) + '/');
}

export async function incrementContentView(contentId) {
  return request('/api/content/' + encodeURIComponent(contentId) + '/increment_view_count/', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
