import { getEmbedSchoolId } from './brand.js';

var EMBED_BASE = '/api/embed/v1';
var MAP_OFFERS_PAGE_SIZE_DEFAULT = 300;

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
var impersonateUserId = null;

function embedClientContext() {
  return { client_surface: 'embed', platform: 'web' };
}

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
  localStorage.setItem('hc_access_token', access);
  if (refresh) localStorage.setItem('hc_refresh_token', refresh);
  sessionStorage.removeItem('hc_access_token');
  sessionStorage.removeItem('hc_refresh_token');
}

export function setImpersonation(userId) {
  impersonateUserId = userId ? String(userId).trim() : '';
  if (impersonateUserId) {
    sessionStorage.setItem('hc_impersonate_user_id', impersonateUserId);
  } else {
    sessionStorage.removeItem('hc_impersonate_user_id');
  }
}

export function getImpersonationUserId() {
  if (!impersonateUserId) {
    impersonateUserId = sessionStorage.getItem('hc_impersonate_user_id') || '';
  }
  return impersonateUserId || '';
}

function withImpersonationParam(path, userId) {
  if (!userId) return path;
  var joiner = path.indexOf('?') >= 0 ? '&' : '?';
  return path + joiner + 'impersonate_user_id=' + encodeURIComponent(userId);
}

function assertImpersonationReadOnly(options, userId) {
  if (!userId) return;
  var method = String((options && options.method) || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  var err = new Error('Impersonation is read-only');
  err.status = 403;
  throw err;
}

export function getAccessToken() {
  if (!accessToken) {
    accessToken =
      localStorage.getItem('hc_access_token') ||
      sessionStorage.getItem('hc_access_token');
  }
  return accessToken;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  impersonateUserId = null;
  localStorage.removeItem('hc_access_token');
  localStorage.removeItem('hc_refresh_token');
  sessionStorage.removeItem('hc_access_token');
  sessionStorage.removeItem('hc_refresh_token');
  sessionStorage.removeItem('hc_impersonate_user_id');
}

export function isAuthenticated() {
  return getAccessToken() != null;
}

async function refreshAccessToken() {
  var rt =
    refreshToken ||
    localStorage.getItem('hc_refresh_token') ||
    sessionStorage.getItem('hc_refresh_token');
  if (!rt) return false;

  try {
    var res = await fetch(baseUrl + EMBED_BASE + '/auth/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: rt }),
    });
    if (!res.ok) return false;
    var data = await res.json();
    setTokens(data.access, data.refresh || rt);
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
  var activeImpersonationUserId = getImpersonationUserId();
  if (activeImpersonationUserId) {
    headers['X-Homecrowd-Impersonate-User-Id'] = activeImpersonationUserId;
  }
  assertImpersonationReadOnly(options, activeImpersonationUserId);
  if (typeof window !== 'undefined' && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    headers['X-Homecrowd-Client'] = 'mobile';
  }

  var requestPath = withImpersonationParam(path, activeImpersonationUserId);
  var res = await fetch(baseUrl + requestPath, Object.assign({}, options, { headers: headers }));

  if (res.status === 401 && token) {
    var refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = 'Bearer ' + getAccessToken();
      res = await fetch(baseUrl + requestPath, Object.assign({}, options, { headers: headers }));
    } else {
      clearTokens();
      window.location.hash = '#/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    var body = await res.text();
    var message = 'Request failed (' + res.status + ')';
    var parsed = null;
    try {
      parsed = JSON.parse(body);
      if (typeof parsed.error === 'string' && parsed.error) {
        message = parsed.error;
      } else if (typeof parsed.message === 'string' && parsed.message) {
        message = parsed.message;
      } else if (typeof parsed.detail === 'string') {
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
    var reqErr = new Error(message);
    reqErr.status = res.status;
    reqErr.body = parsed;
    throw reqErr;
  }

  return res.json();
}

async function requestMultipart(path, options) {
  options = options || {};
  var token = getAccessToken();
  var headers = Object.assign({}, options.headers || {});
  if (token) headers['Authorization'] = 'Bearer ' + token;
  var activeImpersonationUserId = getImpersonationUserId();
  if (activeImpersonationUserId) {
    headers['X-Homecrowd-Impersonate-User-Id'] = activeImpersonationUserId;
  }
  assertImpersonationReadOnly(options, activeImpersonationUserId);
  if (typeof window !== 'undefined' && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    headers['X-Homecrowd-Client'] = 'mobile';
  }

  var requestPath = withImpersonationParam(path, activeImpersonationUserId);
  var res = await fetch(baseUrl + requestPath, Object.assign({}, options, { headers: headers }));

  if (res.status === 401 && token) {
    var refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = 'Bearer ' + getAccessToken();
      res = await fetch(baseUrl + requestPath, Object.assign({}, options, { headers: headers }));
    } else {
      clearTokens();
      window.location.hash = '#/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    var body = await res.text();
    var message = 'Request failed (' + res.status + ')';
    var parsed = null;
    try {
      parsed = JSON.parse(body);
      if (typeof parsed.error === 'string' && parsed.error) {
        message = parsed.error;
      } else if (typeof parsed.message === 'string' && parsed.message) {
        message = parsed.message;
      } else if (typeof parsed.detail === 'string') {
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
    var reqErr = new Error(message);
    reqErr.status = res.status;
    reqErr.body = parsed;
    throw reqErr;
  }

  return res.json();
}

// --- Auth ---

export async function login(email, password) {
  var token = 'email:' + email + ':' + password;
  var data = await request(EMBED_BASE + '/auth/login/', {
    method: 'POST',
    body: JSON.stringify({
      token: token,
      client_context: embedClientContext(),
    }),
  });
  setTokens(data.access, data.refresh);
  return data;
}

export async function register(userData) {
  var data = await request('/api/auth/register/', {
    method: 'POST',
    body: JSON.stringify(userData || {}),
  });
  if (data && data.tokens) {
    setTokens(data.tokens.access, data.tokens.refresh);
  }
  return data;
}

export async function checkEmailExists(email) {
  var data = await request('/api/auth/check-email-exists/', {
    method: 'POST',
    body: JSON.stringify({
      email: String(email || '').trim().toLowerCase(),
    }),
  });
  return !!(data && data.email_exists === true);
}

export async function assignSchool(schoolId) {
  return request('/api/assign-school/', {
    method: 'POST',
    body: JSON.stringify({ school_id: schoolId }),
  });
}

export async function loginWithPartnerToken(token) {
  return loginWithPartnerTokenAndSchool(token);
}

export async function loginWithPartnerTokenAndSchool(token, schoolId) {
  var payload = { token: token, client_context: embedClientContext() };
  if (schoolId) {
    payload.schoolId = schoolId;
  }
  var data = await request(EMBED_BASE + '/auth/login/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setTokens(data.access, data.refresh);
  return data;
}

export async function getSchoolAuthStatus(token, schoolId) {
  var payload = { token: token };
  if (schoolId) {
    payload.schoolId = schoolId;
  }
  return request(EMBED_BASE + '/auth/school-auth-status/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function completeSchoolAuth(payload) {
  var body = Object.assign({}, payload || {});
  return request(EMBED_BASE + '/auth/school-auth/', {
    method: 'POST',
    body: JSON.stringify(body),
  }).then(function (data) {
    if (data && data.access) {
      setTokens(data.access, data.refresh);
    }
    return data;
  });
}

export async function getSchoolAuthEmailConfirmationStatus(confirmationId) {
  return request(EMBED_BASE + '/auth/school-auth-email-confirmation-status/', {
    method: 'POST',
    body: JSON.stringify({ confirmationId: confirmationId }),
  });
}

export async function consumeSchoolAuthEmailConfirmation(confirmationId) {
  return request(EMBED_BASE + '/auth/school-auth-email-confirmation-consume/', {
    method: 'POST',
    body: JSON.stringify({ confirmationId: confirmationId }),
  }).then(function (data) {
    if (data && data.access) {
      setTokens(data.access, data.refresh);
    }
    return data;
  });
}

export async function linkSchoolEmail(payload) {
  return request(EMBED_BASE + '/auth/link-school-email/', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export async function fetchSchoolConfig(schoolId) {
  var id = String(schoolId || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!id) {
    throw new Error('School id is required');
  }
  return request('/api/school/merchants-page-config/' + encodeURIComponent(id) + '/');
}

export async function fetchPublicSchools(includeInactive) {
  var path = '/api/school/public-schools/';
  if (includeInactive) {
    path += '?include_inactive=true';
  }
  return request(path);
}

export async function submitSchoolAvailabilityNotify(schoolId, email) {
  return request(
    '/api/school/availability-notify/' + encodeURIComponent(String(schoolId)) + '/',
    {
      method: 'POST',
      body: JSON.stringify({ email: String(email || '').trim() }),
    }
  );
}

export async function fetchSetupTaskRewards() {
  return request('/api/rewards/setup-task-rewards/');
}

export async function claimSetupTaskReward(task) {
  return request('/api/rewards/setup-task-rewards/claim/', {
    method: 'POST',
    body: JSON.stringify({ task: String(task || '') }),
  });
}

export async function syncSetupTaskRewards() {
  return request('/api/rewards/setup-task-rewards/sync/', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getApiOrigin() {
  return baseUrl || window.location.origin;
}

export async function createTravelSession() {
  return request('/api/travel/session/', {
    method: 'POST',
    body: JSON.stringify({}),
  });
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
    body: JSON.stringify({ school_id: getEmbedSchoolId() || undefined }),
  });
}

export async function changePassword(payload) {
  return request('/api/auth/change-password/', {
    method: 'POST',
    body: JSON.stringify(
      Object.assign({}, payload || {}, { school_id: getEmbedSchoolId() || undefined }),
    ),
  });
}

export async function forgotPassword(email) {
  return request('/api/auth/forgot-password/', {
    method: 'POST',
    body: JSON.stringify({
      email: email,
      school_id: getEmbedSchoolId() || undefined,
    }),
  });
}

export async function resetPassword(payload) {
  return request('/api/auth/reset-password/', {
    method: 'POST',
    body: JSON.stringify(
      Object.assign({}, payload || {}, { school_id: getEmbedSchoolId() || undefined }),
    ),
  });
}

// --- Rewards ---

export async function getRewardsSummary() {
  return request(EMBED_BASE + '/rewards/summary/');
}

export async function getRewardsCatalog() {
  return request(EMBED_BASE + '/rewards/catalog/');
}

export async function getFirstRewards() {
  return request(EMBED_BASE + '/rewards/first-rewards/');
}

export async function getFirstReward(rewardId) {
  return request(
    EMBED_BASE + '/rewards/first-rewards/' + encodeURIComponent(rewardId) + '/'
  );
}

export async function redeemFirstReward(rewardId, payload) {
  return request(
    EMBED_BASE + '/rewards/first-rewards/' + encodeURIComponent(rewardId) + '/redeem/',
    {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }
  );
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

export async function updateCardNickname(cardId, nickname) {
  return request(EMBED_BASE + '/cards/' + encodeURIComponent(cardId) + '/nickname/', {
    method: 'PATCH',
    body: JSON.stringify({ nickname: nickname }),
  });
}

export async function createOliveMember() {
  return request('/api/olive/createMember', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function addCardDirect(cardData) {
  return request('/api/olive/addCardDirect', {
    method: 'POST',
    body: JSON.stringify(cardData),
  });
}

// --- Offers ---

export async function getOffers(page, pageSize, userLocation, options) {
  var size = pageSize == null ? MAP_OFFERS_PAGE_SIZE_DEFAULT : pageSize;
  var params = 'page=' + (page || 1) + '&pageSize=' + encodeURIComponent(String(size));
  if (
    userLocation &&
    userLocation.latitude != null &&
    userLocation.longitude != null
  ) {
    params +=
      '&latitude=' +
      encodeURIComponent(String(userLocation.latitude)) +
      '&longitude=' +
      encodeURIComponent(String(userLocation.longitude));
  }
  if (options && options.includeOnline === false) {
    params += '&includeOnline=false';
  }
  return request('/api/olive/offers/?' + params);
}

export async function getOfferDetails(offerId) {
  return request('/api/olive/offers/' + encodeURIComponent(offerId) + '/');
}

export async function trackOfferClick(offerId) {
  return request('/api/olive/track-click/?offer_id=' + encodeURIComponent(offerId));
}

export async function getWildfireOffers(page, pageSize, query) {
  var params = 'page=' + (page || 1) + '&pageSize=' + (pageSize || 50);
  if (wildfireAppId) {
    params += '&wildfire_app_id=' + encodeURIComponent(wildfireAppId);
  }
  if (query && String(query).trim()) {
    params += '&q=' + encodeURIComponent(String(query).trim());
  }
  return request('/api/wildfire/offers/?' + params);
}

export async function getWildfireMerchantDetail(merchantId) {
  var params = 'merchant_id=' + encodeURIComponent(merchantId);
  if (wildfireAppId) {
    params += '&wildfire_app_id=' + encodeURIComponent(wildfireAppId);
  }
  return request('/api/wildfire/merchant/?' + params);
}

export async function trackWildfireClick(merchantId) {
  var params = 'merchant_id=' + encodeURIComponent(merchantId);
  if (wildfireAppId) {
    params += '&wildfire_app_id=' + encodeURIComponent(wildfireAppId);
  }
  return request('/api/wildfire/track-click/?' + params);
}

export function buildWildfireRedirectUrl(merchantId) {
  var token = getAccessToken();
  if (!token) return null;
  var params =
    'merchant_id=' + encodeURIComponent(merchantId) + '&t=' + encodeURIComponent(token);
  if (wildfireAppId) {
    params += '&wildfire_app_id=' + encodeURIComponent(wildfireAppId);
  }
  return baseUrl + '/api/wildfire/redirect/?' + params;
}

export async function getFeaturedOffers(offerType, extraParams) {
  var params = new URLSearchParams();
  if (offerType) params.set('offer_type', offerType);
  if (extraParams && typeof extraParams === 'object') {
    Object.keys(extraParams).forEach(function (key) {
      var val = extraParams[key];
      if (val === undefined || val === null || val === '') return;
      params.set(key, String(val));
    });
  }
  var qs = params.toString();
  return request('/api/merchant/featured-offers/' + (qs ? '?' + qs : ''));
}

export async function checkEmbeddable(url) {
  return request('/api/embed/check-frameable/?url=' + encodeURIComponent(url));
}

export async function getLeaderboard() {
  return request(EMBED_BASE + '/rewards/leaderboard/');
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

export async function recordDailyVisit() {
  console.log('🎯 [embed] POST /api/rewards/daily-login/');
  return request('/api/rewards/daily-login/', {
    method: 'POST',
  });
}

/**
 * Daily Card Draw. The server owns the randomness and the once-per-day rule, so
 * a repeat call is a normal 200 with already_drawn: true rather than an error.
 * @returns {Promise<{success:boolean, already_drawn:boolean, points_awarded:number, new_balance:number}>}
 */
/**
 * Today's card-draw state without drawing. Lets the screen open already settled
 * when the day's card has been taken.
 * @returns {Promise<{already_drawn:boolean, disabled:boolean, points_awarded:number}>}
 */
export async function getCardDrawStatus() {
  return request('/api/rewards/card-draw/');
}

export async function drawCard() {
  return request('/api/rewards/card-draw/', {
    method: 'POST',
  });
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
    body: JSON.stringify({
      email: clean,
      school_id: getEmbedSchoolId() || undefined,
    }),
  });
}

export async function submitSupportMessage(message, context) {
  var payload = Object.assign({ message: String(message || '').trim() }, context || {});
  return request('/api/users/contact-support/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadReceipt(file, notes, context, transactionAmount, transactionDate) {
  var formData = new FormData();
  formData.append('receipt', file);
  var trimmedNotes = String(notes || '').trim();
  if (trimmedNotes) {
    formData.append('notes', trimmedNotes);
  }
  if (transactionAmount != null && String(transactionAmount).trim() !== '') {
    formData.append('transaction_amount', String(transactionAmount).trim());
  }
  if (transactionDate != null && String(transactionDate).trim() !== '') {
    formData.append('transaction_date', String(transactionDate).trim());
  }
  Object.keys(context || {}).forEach(function (key) {
    var value = context[key];
    if (value != null) {
      formData.append(key, String(value));
    }
  });
  return requestMultipart('/api/users/upload-receipt/', {
    method: 'POST',
    body: formData,
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

export async function postAnalyticsEvents(events) {
  var list = Array.isArray(events) ? events : [];
  if (!list.length) return { accepted: 0 };
  return request('/api/analytics/events/', {
    method: 'POST',
    body: JSON.stringify({
      events: list,
      client_surface: 'embed',
    }),
  });
}
