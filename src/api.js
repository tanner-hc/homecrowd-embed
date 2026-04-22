var EMBED_BASE = '/api/embed/v1';
var hostname = window.location.hostname;
var baseUrl =
  hostname === 'localhost' || hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : 'https://api.gethomecrowd.com';
var accessToken = null;
var refreshToken = null;

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
      message = parsed.detail || message;
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
  var data = await request(EMBED_BASE + '/auth/login/', {
    method: 'POST',
    body: JSON.stringify(
      schoolId
        ? { token: token, schoolId: schoolId }
        : { token: token }
    ),
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

export async function logout() {
  try {
    await request(EMBED_BASE + '/auth/logout/', { method: 'POST' });
  } catch (e) {
    // ignore
  }
  clearTokens();
}

// --- Rewards ---

export async function getRewardsSummary() {
  return request(EMBED_BASE + '/rewards/summary/');
}

export async function getRewardsCatalog() {
  return request(EMBED_BASE + '/rewards/catalog/');
}

export async function getWeeklyLeaderboard() {
  return request(EMBED_BASE + '/rewards/leaderboard/');
}

export async function getRewardsActivity() {
  return request(EMBED_BASE + '/rewards/activity/');
}

export async function redeemReward(rewardId, quantity) {
  return request(EMBED_BASE + '/rewards/redeem/', {
    method: 'POST',
    body: JSON.stringify({ rewardId: rewardId, quantity: quantity || 1 }),
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

export async function getOffers(page, pageSize, latitude, longitude) {
  var params = 'page=' + (page || 1) + '&pageSize=' + (pageSize || 50);
  if (latitude && longitude) {
    params += '&latitude=' + latitude + '&longitude=' + longitude;
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
  return request('/api/wildfire/offers/?' + params);
}

export async function trackWildfireClick(merchantId) {
  return request('/api/wildfire/track-click/?merchant_id=' + encodeURIComponent(merchantId));
}

export async function getFeaturedOffers(offerType) {
  var params = offerType ? '?offer_type=' + offerType : '';
  return request('/api/merchant/featured-offers/' + params);
}
