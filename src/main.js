if (import.meta.env.DEV) {
  import('./dev-client-log.js');
}
import * as api from './api.js';
import { postToNative, onNativeMessage } from './bridge.js';
import { navigate, getRoute, onRouteChange, startRouter } from './router.js';
import { renderLogin } from './views/login.js';
import { renderRewards } from './views/rewards.js';
import logoUrl from './assets/header.png';
import { renderCards } from './views/cards.js';
import { renderRewardDetail } from './views/reward-detail.js';
import { resolveCardLinkStatus } from './cardLinkStatus.js';
import { renderOffers } from './views/offers.js';
import { renderOfferDetail } from './views/offer-detail.js';
import { renderRedemptionConfirmation } from './views/redemption-confirmation.js';
import { renderRedemptionThanks, finalizeStripeThanksReturn } from './views/redemption-thanks.js';
import { renderHome } from './views/home.js';
import { renderProfile } from './views/profile.js';
import { renderAccountSettings } from './views/account-settings.js';
import { renderProfileDetails } from './views/profile-details.js';
import { renderNotificationSettings } from './views/notification-settings.js';
import { renderSecuritySettings } from './views/security-settings.js';
import { renderChangePassword } from './views/change-password.js';
import { renderInviteFriend } from './views/invite-friend.js';
import { renderActivityLog } from './views/activity-log.js';
import LoadingSpinner from './base-components/LoadingSpinner.js';
import { preloadMapKitForEmbed } from './mapkit-embed.js';

var appEl = document.getElementById('app');
var user = null;
var lastAutologinTokenApplied = '';
var suppressPartnerAutologinAfterLogout = false;

var hostConfig =
  typeof window.__HC_EMBED_HOST_CONFIG__ === 'object' && window.__HC_EMBED_HOST_CONFIG__ !== null
    ? window.__HC_EMBED_HOST_CONFIG__
    : null;
var params = new URLSearchParams(window.location.search);
var schoolId = (hostConfig && hostConfig.schoolId) || params.get('schoolId') || '';
var partnerToken = (hostConfig && hostConfig.token) || params.get('token') || '';
var initialView = (hostConfig && hostConfig.view) || params.get('view') || 'home';

var postLoginStripeThanksId = null;

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
  } catch (e) { }

  document.documentElement.style.removeProperty('--hc-primary');
}

async function applyAutologinToken(token, view, nextSchoolId) {
  if (!token) {
    return false;
  }
  if (suppressPartnerAutologinAfterLogout) {
    return false;
  }

  if (
    user &&
    api.isAuthenticated() &&
    lastAutologinTokenApplied &&
    lastAutologinTokenApplied === token
  ) {
    return true;
  }

  api.clearTokens();
  user = null;
  lastAutologinTokenApplied = '';

  try {
    await api.loginWithPartnerTokenAndSchool(token, nextSchoolId || schoolId);
    user = await api.fetchCurrentUser();
    lastAutologinTokenApplied = token;
    postToNative('homecrowd:login', { user: user });
    preloadMapKitForEmbed();
    navigate('/' + (view || initialView));
    return true;
  } catch (e) {
    api.clearTokens();
    user = null;
    lastAutologinTokenApplied = '';
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
    if (suppressPartnerAutologinAfterLogout) {
      return;
    }
    partnerToken = config.token;
    if (config.schoolId) {
      schoolId = String(config.schoolId);
    }
    applyAutologinToken(partnerToken, config.view || 'rewards', config.schoolId || schoolId).then(function (didLogin) {
      if (!didLogin) {
        navigate('/login');
      }
    });
    return;
  }
  if (config.view) {
    if (
      suppressPartnerAutologinAfterLogout &&
      config.view !== 'login'
    ) {
      return;
    }
    navigate('/' + config.view);
  }
});

// Listen for navigation commands from native layer
onNativeMessage('homecrowd:navigate', function (data) {
  if (data && data.view) {
    if (suppressPartnerAutologinAfterLogout && data.view !== 'login') {
      return;
    }
    navigate('/' + data.view);
  }
});

function handleStripeReturnQuery() {
  var sp = new URLSearchParams(window.location.search);
  if (sp.get('stripe_success') === '1') {
    postLoginStripeThanksId = finalizeStripeThanksReturn();
    sp.delete('stripe_success');
    sp.delete('session_id');
    var qs = sp.toString();
    var clean = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
    window.history.replaceState(null, '', clean);
    if (!postLoginStripeThanksId) {
      window.alert(
        'Purchase successful! Thank you for your purchase. Your reward is being processed.',
      );
    }
  } else if (sp.get('stripe_cancel') === '1') {
    window.alert('Checkout was canceled.');
    sp.delete('stripe_cancel');
    var qs2 = sp.toString();
    var clean2 = window.location.pathname + (qs2 ? '?' + qs2 : '') + window.location.hash;
    window.history.replaceState(null, '', clean2);
  }
}

async function init() {
  handleStripeReturnQuery();
  var injected = window.__HC_EMBED_HOST_CONFIG__;
  if (injected && typeof injected === 'object') {
    if (injected.schoolId) {
      schoolId = String(injected.schoolId);
    }
    if (injected.token) {
      partnerToken = injected.token;
    }
    if (injected.view) {
      initialView = injected.view;
    }
  }
  await applySchoolConfig(schoolId);
  if (partnerToken) {
    await applyAutologinToken(partnerToken, initialView, schoolId);
  } else if (api.isAuthenticated()) {
    try {
      user = await api.fetchCurrentUser();
      postToNative('homecrowd:login', { user: user });
      preloadMapKitForEmbed();
    } catch (e) {
      api.clearTokens();
      user = null;
    }
  }

  if (postLoginStripeThanksId) {
    window.location.hash = '#/rewards/' + encodeURIComponent(postLoginStripeThanksId) + '/thanks';
    postLoginStripeThanksId = null;
  }

  onRouteChange(function (route) {
    postToNative('homecrowd:route-change', { route: route });
    render(route);
  });
  window.addEventListener('homecrowd:embed-logout', function () {
    suppressPartnerAutologinAfterLogout = true;
    user = null;
    lastAutologinTokenApplied = '';
    api.clearTokens();
    postToNative('homecrowd:logout');
    navigate('/login');
    api.logout().catch(function () { });
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

function routePathOnly(route) {
  var q = route.indexOf('?');
  return q >= 0 ? route.slice(0, q) : route;
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
      suppressPartnerAutologinAfterLogout = false;
      postToNative('homecrowd:login', { user: u });
      preloadMapKitForEmbed();
      navigate('/home');
    });
    return;
  }

  var pathOnly = routePathOnly(route);

  var thanksMatch = pathOnly.match(/^\/rewards\/([^/]+)\/thanks$/);
  if (thanksMatch) {
    var thanksRewardId = thanksMatch[1];
    var thanksContentEl = renderLayout(route);
    renderRedemptionThanks(thanksContentEl, thanksRewardId);
    return;
  }

  var confirmMatch = pathOnly.match(/^\/rewards\/([^/]+)\/confirm$/);
  if (confirmMatch) {
    var confirmRewardId = confirmMatch[1];
    var confirmContentEl = renderLayout(route);
    renderRedemptionConfirmation(confirmContentEl, confirmRewardId);
    return;
  }

  var detailMatch = pathOnly.match(/^\/rewards\/([^/]+)$/);
  if (detailMatch) {
    var rewardId = detailMatch[1];
    var contentEl = renderLayout(route);
    contentEl.innerHTML = LoadingSpinner({ text: 'Loading reward...' });
    Promise.all([
      api.getRewardsSummary(),
      api.fetchCurrentUser(),
      api.getCards().catch(function () {
        return null;
      }),
      api.getRaffleTicketsList().catch(function () {
        return null;
      }),
    ])
      .then(function (parts) {
        var summary = parts[0];
        var currentUser = parts[1];
        var paymentCards = parts[2];
        var ticketsResponse = parts[3];
        return api
          .getRewardDetail(rewardId)
          .catch(function () {
            return null;
          })
          .then(function (product) {
            if (product && product.id) {
              return { summary: summary, product: product, currentUser: currentUser, paymentCards: paymentCards, ticketsResponse: ticketsResponse };
            }
            return api.getRewardsCatalog().then(function (catalogRaw) {
              var list = Array.isArray(catalogRaw) ? catalogRaw : (catalogRaw && catalogRaw.results) || [];
              var found = list.find(function (r) {
                return String(r.id) === rewardId;
              });
              return {
                summary: summary,
                product: found,
                currentUser: currentUser,
                paymentCards: paymentCards,
                ticketsResponse: ticketsResponse,
              };
            });
          });
      })
      .then(function (ctx) {
        if (!ctx || !ctx.product || !ctx.product.id) {
          contentEl.innerHTML = '<div class="hc-alert-error">Reward not found</div>';
          return;
        }
        renderRewardDetail(contentEl, {
          product: ctx.product,
          summary: ctx.summary,
          currentUser: ctx.currentUser,
          cardLinkStatus: resolveCardLinkStatus(ctx.currentUser, ctx.paymentCards) || 'unknown',
          ticketsResponse: ctx.ticketsResponse,
        });
      })
      .catch(function (err) {
        contentEl.innerHTML =
          '<div class="hc-alert-error">Failed to load: ' + (err.message || 'Unknown error') + '</div>';
      });
    return;
  }

  // Offer detail route: /offers/:id
  var offerMatch = pathOnly.match(/^\/offers\/(.+)$/);
  if (offerMatch) {
    var offerIdParam = offerMatch[1];
    var contentEl = renderLayout(route);
    renderOfferDetail(contentEl, offerIdParam);
    return;
  }

  // Authenticated layout
  var contentEl = renderLayout(route);

  if (pathOnly === '/home') {
    renderHome(contentEl);
  } else if (pathOnly === '/cards') {
    renderCards(contentEl);
  } else if (pathOnly === '/profile') {
    renderProfile(contentEl);
  } else if (pathOnly === '/account-settings') {
    renderAccountSettings(contentEl);
  } else if (pathOnly === '/profile-details') {
    renderProfileDetails(contentEl);
  } else if (pathOnly === '/notification-settings') {
    renderNotificationSettings(contentEl);
  } else if (pathOnly === '/security-settings') {
    renderSecuritySettings(contentEl);
  } else if (pathOnly === '/change-password') {
    renderChangePassword(contentEl);
  } else if (pathOnly === '/invite-friend') {
    renderInviteFriend(contentEl);
  } else if (pathOnly === '/activity-log') {
    renderActivityLog(contentEl);
  } else if (pathOnly === '/offers') {
    renderOffers(contentEl);
  } else {
    renderRewards(contentEl);
  }
}

function renderLayout(route) {
  var pathOnly = routePathOnly(route);
  var isRewardDetailPage =
    /^\/rewards\/[^/]+$/.test(pathOnly) ||
    /^\/rewards\/[^/]+\/confirm$/.test(pathOnly) ||
    /^\/rewards\/[^/]+\/thanks$/.test(pathOnly);
  var homeTabActive = pathOnly === '/home' ? ' active' : '';
  var rewardsTabActive = pathOnly === '/rewards' ? ' active' : '';
  var offersTabActive =
    pathOnly === '/offers' || /^\/offers\/[^/]+$/.test(pathOnly) ? ' active' : '';
  var profileTabActive =
    pathOnly === '/profile' ||
    pathOnly === '/account-settings' ||
    pathOnly === '/profile-details' ||
    pathOnly === '/notification-settings' ||
    pathOnly === '/security-settings' ||
    pathOnly === '/change-password' ||
    pathOnly === '/invite-friend' ||
    pathOnly === '/activity-log'
      ? ' active'
      : '';

  var tabsHtml = '';
  if (!isRewardDetailPage) {
    tabsHtml =
      '<nav class="hc-nav">\
        <a href="#/home" class="hc-nav-link' +
      homeTabActive +
      '">Home</a>\
        <a href="#/rewards" class="hc-nav-link' +
      rewardsTabActive +
      '">Rewards</a>\
        <a href="#/offers" class="hc-nav-link' +
      offersTabActive +
      '">Offers</a>\
        <a href="#/profile" class="hc-nav-link' +
      profileTabActive +
      '">Profile</a>\
      </nav>';
  }

  appEl.innerHTML =
    '<div class="hc-embed">\
      <div class="hc-sticky-top' +
    (isRewardDetailPage ? ' hc-sticky-top--reward-detail' : '') +
    '">\
        <div class="hc-header">\
          <img src="' +
    logoUrl +
    '" alt="Homecrowd" class="hc-header-logo" />\
        </div>' +
    tabsHtml +
    '\
      </div>\
      <main id="hc-content" class="hc-content' +
    (isRewardDetailPage ? ' hc-content--reward-detail' : '') +
    '"></main>\
    </div>';

  return document.getElementById('hc-content');
}

init();
