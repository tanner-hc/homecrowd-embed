import * as api from './api.js';
import { postToNative, onNativeMessage } from './bridge.js';
import { navigate, getRoute, onRouteChange, startRouter } from './router.js';
import { renderLogin } from './views/login.js';
import { renderRewards } from './views/rewards.js';
import logoUrl from './assets/header.png';
import { renderCards } from './views/cards.js';
import { renderRewardDetail } from './views/reward-detail.js';
import { renderOffers } from './views/offers.js';
import { renderOfferDetail } from './views/offer-detail.js';

var appEl = document.getElementById('app');
var user = null;

// Read config from URL params (set by native when loading the WebView URL)
var params = new URLSearchParams(window.location.search);
var schoolId = params.get('schoolId') || '';
var partnerToken = params.get('token') || '';
var initialView = params.get('view') || 'rewards';

async function applySchoolConfig(nextSchoolId) {
  schoolId = nextSchoolId || '';
  if (!schoolId) {
    document.documentElement.style.removeProperty('--hc-primary');
    return;
  }

  try {
    var config = await api.fetchSchoolConfig(schoolId);
    if (config && config.primaryColor) {
      document.documentElement.style.setProperty('--hc-primary', config.primaryColor);
      return;
    }
  } catch (e) {}

  document.documentElement.style.removeProperty('--hc-primary');
}

async function applyAutologinToken(token, view, nextSchoolId) {
  if (!token) {
    return false;
  }

  api.clearTokens();
  user = null;

  try {
    await api.loginWithPartnerTokenAndSchool(token, nextSchoolId || schoolId);
    user = await api.fetchCurrentUser();
    postToNative('homecrowd:login', { user: user });
    navigate('/' + (view || initialView));
    return true;
  } catch (e) {
    api.clearTokens();
    user = null;
    postToNative('homecrowd:error', { message: 'Auto-login failed' });
    return false;
  }
}

// Listen for runtime config from native layer
onNativeMessage('homecrowd:configure', function (config) {
  if (config.schoolId) {
    applySchoolConfig(config.schoolId);
  }
  if (config.token) {
    partnerToken = config.token;
    applyAutologinToken(partnerToken, config.view || 'rewards', config.schoolId || schoolId).then(function (didLogin) {
      if (!didLogin && config.view) {
        navigate('/login');
      }
    });
  }
  if (config.view) {
    navigate('/' + config.view);
  }
});

// Listen for navigation commands from native layer
onNativeMessage('homecrowd:navigate', function (data) {
  if (data && data.view) {
    navigate('/' + data.view);
  }
});

async function init() {
  await applySchoolConfig(schoolId);
  if (partnerToken) {
    await applyAutologinToken(partnerToken, initialView, schoolId);
  }

  if (api.isAuthenticated()) {
    try {
      user = await api.fetchCurrentUser();
      postToNative('homecrowd:login', { user: user });
    } catch (e) {
      api.clearTokens();
    }
  }

  onRouteChange(function (route) {
    postToNative('homecrowd:route-change', { route: route });
    render(route);
  });
  startRouter();

  if (!user && getRoute() !== '/login') {
    navigate('/login');
  } else if (user && (getRoute() === '/login' || getRoute() === '/')) {
    navigate('/' + initialView);
  }

  // Tell the native app we're ready
  postToNative('homecrowd:ready');
}

function render(route) {
  if (!user && route !== '/login') {
    navigate('/login');
    return;
  }
  if (user && route === '/login') {
    navigate('/' + initialView);
    return;
  }

  if (route === '/login') {
    appEl.innerHTML = '';
    renderLogin(appEl, function (u) {
      user = u;
      postToNative('homecrowd:login', { user: u });
      navigate('/rewards');
    });
    return;
  }

  // Reward detail route: /rewards/:id
  var detailMatch = route.match(/^\/rewards\/(.+)$/);
  if (detailMatch) {
    var rewardId = detailMatch[1];
    var contentEl = renderLayout(route);
    contentEl.innerHTML = '<div class="hc-spinner"></div>';
    Promise.all([api.getRewardsSummary(), api.getRewardsCatalog()]).then(function (results) {
      var summary = results[0];
      var catalog = results[1];
      var reward = catalog.find(function (r) { return String(r.id) === rewardId; });
      if (reward) {
        renderRewardDetail(contentEl, reward, summary);
      } else {
        contentEl.innerHTML = '<div class="hc-alert-error">Reward not found</div>';
      }
    }).catch(function (err) {
      contentEl.innerHTML = '<div class="hc-alert-error">Failed to load: ' + (err.message || 'Unknown error') + '</div>';
    });
    return;
  }

  // Offer detail route: /offers/:id
  var offerMatch = route.match(/^\/offers\/(.+)$/);
  if (offerMatch) {
    var offerIdParam = offerMatch[1];
    var contentEl = renderLayout(route);
    renderOfferDetail(contentEl, offerIdParam);
    return;
  }

  // Authenticated layout
  var contentEl = renderLayout(route);

  if (route === '/cards') {
    renderCards(contentEl);
  } else if (route === '/offers') {
    renderOffers(contentEl);
  } else {
    renderRewards(contentEl);
  }
}

function renderLayout(route) {
  appEl.innerHTML = '\
    <div class="hc-embed">\
      <div class="hc-header">\
        <img src="' + logoUrl + '" alt="Homecrowd" class="hc-header-logo" />\
      </div>\
      <nav class="hc-nav">\
        <a href="#/rewards" class="hc-nav-link' + (route.indexOf('/rewards') === 0 ? ' active' : '') + '">Rewards</a>\
        <a href="#/offers" class="hc-nav-link' + (route.indexOf('/offers') === 0 ? ' active' : '') + '">Offers</a>\
        <a href="#/cards" class="hc-nav-link' + (route === '/cards' ? ' active' : '') + '">Cards</a>\
      </nav>\
      <main id="hc-content" class="hc-content"></main>\
      <button id="hc-logout-btn" class="hc-logout-fixed">Log out</button>\
    </div>';

  document.getElementById('hc-logout-btn').addEventListener('click', async function () {
    await api.logout();
    user = null;
    postToNative('homecrowd:logout');
    navigate('/login');
  });

  return document.getElementById('hc-content');
}

init();
