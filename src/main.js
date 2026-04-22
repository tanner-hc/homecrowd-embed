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
import { renderContent } from './views/content.js';
import { renderContentDetail } from './views/content-detail.js';
import { renderAccountSettings } from './views/account-settings.js';
import { renderProfileDetails } from './views/profile-details.js';
import { renderNotificationSettings } from './views/notification-settings.js';
import { renderSecuritySettings } from './views/security-settings.js';
import { renderChangePassword } from './views/change-password.js';
import { renderInviteFriend } from './views/invite-friend.js';
import { renderActivityLog } from './views/activity-log.js';
import { renderBrowserExtension } from './views/browser-extension.js';
import { renderSupport } from './views/support.js';
import LoadingSpinner from './base-components/LoadingSpinner.js';
import { preloadMapKitForEmbed } from './mapkit-embed.js';
import houseFilledSvg from './assets/icons/house-filled.svg?raw';
import giftFilledSvg from './assets/icons/gift-filled.svg?raw';
import bagSvg from './assets/icons/bag.svg?raw';
import playFilledSvg from './assets/icons/play-filled.svg?raw';
import personSvg from './assets/icons/person.svg?raw';

var appEl = document.getElementById('app');
var user = null;
var profileUserForTabs = null;
var profileUserForTabsLoading = false;
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
    profileUserForTabs = null;
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

  // Load full profile (contains school feature flags like content_active).
  refreshProfileUserForTabs();
}

function routePathOnly(route) {
  var q = route.indexOf('?');
  return q >= 0 ? route.slice(0, q) : route;
}

function refreshProfileUserForTabs() {
  if (profileUserForTabsLoading || !user) return;
  profileUserForTabsLoading = true;
  api
    .getUserProfile()
    .then(function (profile) {
      profileUserForTabs = profile || null;
      var route = getRoute();
      if (route) render(route);
    })
    .catch(function () { })
    .finally(function () {
      profileUserForTabsLoading = false;
    });
}

function isContentTabEnabled(currentUser) {
  var sourceUser = profileUserForTabs && typeof profileUserForTabs === 'object'
    ? profileUserForTabs
    : currentUser;
  if (!sourceUser || typeof sourceUser !== 'object') return false;
  var school = sourceUser.active_school || sourceUser.activeSchool;
  if (!school || typeof school !== 'object') return false;
  if (school.content_active === true) return true;
  if (school.contentActive === true) return true;
  return false;
}

function tabSvgInline(raw) {
  return String(raw).replace(/^<svg\s/i, '<svg class="hc-tab-icon-svg" ');
}

function buildBottomTabBarHtml(pathOnly, contentTabEnabled) {
  var homeActive = pathOnly === '/home' ? ' active' : '';
  var rewardsActive = pathOnly === '/rewards' ? ' active' : '';
  var contentActive =
    contentTabEnabled && pathOnly === '/content' ? ' active' : '';
  var offersActive = pathOnly === '/offers' ? ' active' : '';
  var profileActive =
    pathOnly === '/profile' ||
    pathOnly === '/cards' ||
    pathOnly === '/account-settings' ||
    pathOnly === '/profile-details' ||
    pathOnly === '/notification-settings' ||
    pathOnly === '/security-settings' ||
    pathOnly === '/change-password' ||
    pathOnly === '/invite-friend' ||
    pathOnly === '/activity-log' ||
    pathOnly === '/browser-extension' ||
    pathOnly === '/support'
      ? ' active'
      : '';

  var html =
    '<nav class="hc-tab-bar" role="navigation" aria-label="Main">' +
    '<a href="#/home" class="hc-tab-link' +
    homeActive +
    '">' +
    '<span class="hc-tab-icon-wrap">' +
    tabSvgInline(houseFilledSvg) +
    '</span><span class="hc-tab-label">Home</span></a>' +
    '<a href="#/rewards" class="hc-tab-link' +
    rewardsActive +
    '">' +
    '<span class="hc-tab-icon-wrap">' +
    tabSvgInline(giftFilledSvg) +
    '</span><span class="hc-tab-label">Rewards</span></a>';

  if (contentTabEnabled) {
    html +=
      '<a href="#/content" class="hc-tab-link' +
      contentActive +
      '">' +
      '<span class="hc-tab-icon-wrap">' +
      tabSvgInline(playFilledSvg) +
      '</span><span class="hc-tab-label">Content</span></a>';
  }

  html +=
    '<a href="#/offers" class="hc-tab-link' +
    offersActive +
    '">' +
    '<span class="hc-tab-icon-wrap">' +
    tabSvgInline(bagSvg) +
    '</span><span class="hc-tab-label">Offers</span></a>' +
    '<a href="#/profile" class="hc-tab-link' +
    profileActive +
    '">' +
    '<span class="hc-tab-icon-wrap">' +
    tabSvgInline(personSvg) +
    '</span><span class="hc-tab-label">Profile</span></a>' +
    '</nav>';

  return '<div class="hc-tab-bar-shell">' + html + '</div>';
}

function removeRewardsPointsOverlay() {
  var el = document.getElementById('hc-rewards-points-overlay');
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

function render(route) {
  removeRewardsPointsOverlay();
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
      profileUserForTabs = null;
      suppressPartnerAutologinAfterLogout = false;
      postToNative('homecrowd:login', { user: u });
      preloadMapKitForEmbed();
      refreshProfileUserForTabs();
      navigate('/home');
    });
    return;
  }

  var pathOnly = routePathOnly(route);
  if (!profileUserForTabs && !profileUserForTabsLoading && user) {
    refreshProfileUserForTabs();
  }
  var contentTabEnabled = isContentTabEnabled(user);

  if (!contentTabEnabled && (pathOnly === '/content' || /^\/content\/[^/]+$/.test(pathOnly))) {
    navigate('/rewards');
    return;
  }

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

  // Content detail route: /content/:id
  var contentMatch = pathOnly.match(/^\/content\/(.+)$/);
  if (contentMatch) {
    var contentIdParam = contentMatch[1];
    var contentEl2 = renderLayout(route);
    renderContentDetail(contentEl2, contentIdParam);
    return;
  }

  // Authenticated layout
  var contentEl = renderLayout(route);

  if (pathOnly === '/home') {
    renderHome(contentEl);
  } else if (pathOnly === '/cards') {
    renderCards(contentEl);
  } else if (pathOnly === '/content') {
    renderContent(contentEl);
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
  } else if (pathOnly === '/browser-extension') {
    renderBrowserExtension(contentEl);
  } else if (pathOnly === '/support') {
    renderSupport(contentEl);
  } else if (pathOnly === '/offers') {
    renderOffers(contentEl);
  } else {
    renderRewards(contentEl);
  }
}

function renderLayout(route) {
  var pathOnly = routePathOnly(route);
  var contentTabEnabled = isContentTabEnabled(user);
  var isRewardDetailPage =
    /^\/rewards\/[^/]+$/.test(pathOnly) ||
    /^\/rewards\/[^/]+\/confirm$/.test(pathOnly) ||
    /^\/rewards\/[^/]+\/thanks$/.test(pathOnly);
  var isOfferDetailPage = /^\/offers\/[^/]+$/.test(pathOnly);
  var isContentDetailPage = /^\/content\/[^/]+$/.test(pathOnly);
  var hideTabBar = isRewardDetailPage || isOfferDetailPage || isContentDetailPage;

  var tabBarHtml = hideTabBar ? '' : buildBottomTabBarHtml(pathOnly, contentTabEnabled);

  appEl.innerHTML =
    '<div class="hc-embed">\
      <div class="hc-sticky-top' +
    (isRewardDetailPage ? ' hc-sticky-top--reward-detail' : '') +
    '">\
        <div class="hc-header">\
          <img src="' +
    logoUrl +
    '" alt="Homecrowd" class="hc-header-logo" />\
        </div>\
      </div>\
      <main id="hc-content" class="hc-content' +
    (isRewardDetailPage ? ' hc-content--reward-detail' : '') +
    (hideTabBar ? '' : ' hc-content--with-tab-bar') +
    '"></main>' +
    tabBarHtml +
    '</div>';

  return document.getElementById('hc-content');
}

init();
