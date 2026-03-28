import * as api from './api.js';
import { postToNative, onNativeMessage } from './bridge.js';
import { navigate, getRoute, onRouteChange, startRouter } from './router.js';
import { renderLogin } from './views/login.js';
import { renderRewards } from './views/rewards.js';
import logoUrl from './assets/header.png';
import { renderCards } from './views/cards.js';

var appEl = document.getElementById('app');
var user = null;

// Read config from URL params (set by native when loading the WebView URL)
var params = new URLSearchParams(window.location.search);

var baseUrl = params.get('baseUrl') || 'https://api.gethomecrowd.com';
api.configure(baseUrl);

var primaryColor = params.get('primaryColor');
if (primaryColor) {
  document.documentElement.style.setProperty('--hc-primary', '#' + primaryColor);
}

var partnerToken = params.get('token') || '';
var initialView = params.get('view') || 'rewards';

// Listen for runtime config from native layer
onNativeMessage('homecrowd:configure', function (config) {
  if (config.baseUrl) {
    baseUrl = config.baseUrl;
    api.configure(baseUrl);
  }
  if (config.primaryColor) {
    document.documentElement.style.setProperty('--hc-primary', '#' + config.primaryColor);
  }
  if (config.token) {
    partnerToken = config.token;
    api.loginWithPartnerToken(partnerToken).then(function () {
      return api.fetchCurrentUser();
    }).then(function (u) {
      user = u;
      postToNative('homecrowd:login', { user: u });
      navigate('/' + (config.view || 'rewards'));
    }).catch(function () {
      postToNative('homecrowd:error', { message: 'Auto-login failed' });
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
  if (partnerToken && !api.isAuthenticated()) {
    try {
      await api.loginWithPartnerToken(partnerToken);
    } catch (e) {
      postToNative('homecrowd:error', { message: 'Auto-login failed' });
    }
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

  // Authenticated layout
  var contentEl = renderLayout(route);

  if (route === '/cards') {
    renderCards(contentEl);
  } else {
    renderRewards(contentEl);
  }
}

function renderLayout(route) {
  var initials = '?';
  var displayName = '';
  if (user) {
    initials = ((user.firstName || user.name || user.email || '?')[0] || '?').toUpperCase();
    displayName = (user.firstName && user.lastName)
      ? user.firstName + ' ' + user.lastName
      : (user.name || user.email || '');
  }

  appEl.innerHTML = '\
    <div class="hc-embed">\
      <div class="hc-header">\
        <img src="' + logoUrl + '" alt="Homecrowd" class="hc-header-logo" />\
      </div>\
      <nav class="hc-nav">\
        <a href="#/rewards" class="hc-nav-link' + (route === '/rewards' ? ' active' : '') + '">Rewards</a>\
        <a href="#/cards" class="hc-nav-link' + (route === '/cards' ? ' active' : '') + '">Cards</a>\
        <div class="hc-nav-user">\
          <div class="hc-nav-avatar">' + escapeHtml(initials) + '</div>\
          <span>' + escapeHtml(displayName) + '</span>\
        </div>\
        <button id="hc-logout-btn" class="hc-nav-logout">Log out</button>\
      </nav>\
      <main id="hc-content" class="hc-content"></main>\
    </div>';

  document.getElementById('hc-logout-btn').addEventListener('click', async function () {
    await api.logout();
    user = null;
    postToNative('homecrowd:logout');
    navigate('/login');
  });

  return document.getElementById('hc-content');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

init();
