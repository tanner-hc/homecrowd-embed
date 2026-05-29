if (import.meta.env.DEV) {
  import('./dev-client-log.js');
}
import * as api from './api.js';
import * as analytics from './analytics.js';
import { postToNative, onNativeMessage } from './bridge.js';
import { navigate, getRoute, onRouteChange, startRouter, nextNavEpoch } from './router.js';
import { renderLogin } from './views/login.js';
import { renderHome } from './views/home.js';
import { renderRewards } from './views/rewards.js';
import logoUrl from './assets/header.png';
import { renderCards } from './views/cards.js';
import { renderLinkCards } from './views/link-cards.js';
import { renderRewardDetail } from './views/reward-detail.js';
import { resolveCardLinkStatus } from './cardLinkStatus.js';
import { showDailyLoginBonusModal } from './daily-login-bonus.js';
import {
  buildOverallRewardContext,
  buildWeeklyRewardContext,
  leaderboardContextToEmbedProduct,
} from './weekly-reward.js';
import { renderOffers } from './views/offers.js';
import { renderOfferDetail } from './views/offer-detail.js';
import { renderRedemptionConfirmation } from './views/redemption-confirmation.js';
import { renderRedemptionThanks, finalizeStripeThanksReturn } from './views/redemption-thanks.js';
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
import { renderPreviewScreen } from './views/preview-screen.js';
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
var dailyVisitCheckInProgress = false;
var dailyVisitForegroundReady = false;

var hostConfig =
  typeof window.__HC_EMBED_HOST_CONFIG__ === 'object' && window.__HC_EMBED_HOST_CONFIG__ !== null
    ? window.__HC_EMBED_HOST_CONFIG__
    : null;
var params = new URLSearchParams(window.location.search);
function getSchoolIdFromConfig(config) {
  if (!config || typeof config !== 'object') return '';
  return String(config.schoolId || config.school_id || '').trim();
}
var schoolId =
  getSchoolIdFromConfig(hostConfig) || params.get('schoolId') || params.get('school_id') || '';
var partnerToken = (hostConfig && hostConfig.token) || params.get('token') || '';
var initialView = (hostConfig && hostConfig.view) || params.get('view') || 'home';

var postLoginStripeThanksId = null;
var pendingSchoolAuthContext = null;
var pendingSchoolEmailConfirmationId = '';
var schoolEmailConfirmationPollTimer = null;
var pendingAutoRaffleModal = null;
var pendingDailyBonusModal = null;
var holdOnboardingModals = true;
var pendingPasswordLinkStorageKey = 'hc_embed_pending_school_link';
var pendingLoginEmailStorageKey = 'hc_embed_pending_login_email';

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

function readPendingPasswordLink() {
  try {
    var raw = window.sessionStorage.getItem(pendingPasswordLinkStorageKey);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.token) return null;
    return parsed;
  } catch (_e) {
    return null;
  }
}

function writePendingPasswordLink(token, linkedEmail) {
  try {
    window.sessionStorage.setItem(
      pendingPasswordLinkStorageKey,
      JSON.stringify({
        token: token,
        schoolId: schoolId || '',
        linkedEmail: linkedEmail || '',
      }),
    );
  } catch (_e) { }
}

function clearPendingPasswordLink() {
  try {
    window.sessionStorage.removeItem(pendingPasswordLinkStorageKey);
  } catch (_e) { }
}

function readPendingLoginEmail() {
  try {
    return (window.sessionStorage.getItem(pendingLoginEmailStorageKey) || '').trim();
  } catch (_e) {
    return '';
  }
}

function writePendingLoginEmail(email) {
  try {
    window.sessionStorage.setItem(pendingLoginEmailStorageKey, String(email || '').trim());
  } catch (_e) { }
}

function clearPendingLoginEmail() {
  try {
    window.sessionStorage.removeItem(pendingLoginEmailStorageKey);
  } catch (_e) { }
}

function completeLoginState(nextUser, tokenUsed) {
  if (schoolEmailConfirmationPollTimer) {
    window.clearInterval(schoolEmailConfirmationPollTimer);
    schoolEmailConfirmationPollTimer = null;
  }
  pendingSchoolEmailConfirmationId = '';
  pendingAutoRaffleModal = null;
  pendingDailyBonusModal = null;
  holdOnboardingModals = true;
  user = nextUser;
  profileUserForTabs = null;
  suppressPartnerAutologinAfterLogout = false;
  if (tokenUsed) {
    lastAutologinTokenApplied = tokenUsed;
  }
  postToNative('homecrowd:login', { user: nextUser });
  preloadMapKitForEmbed();
  scheduleDailyVisitCheck();
  refreshProfileUserForTabs();
}

function startSchoolEmailConfirmationPolling(confirmationId) {
  pendingSchoolEmailConfirmationId = String(confirmationId || '').trim();
  if (!pendingSchoolEmailConfirmationId) return;
  if (schoolEmailConfirmationPollTimer) {
    window.clearInterval(schoolEmailConfirmationPollTimer);
    schoolEmailConfirmationPollTimer = null;
  }
  var isChecking = false;
  schoolEmailConfirmationPollTimer = window.setInterval(function () {
    if (isChecking || !pendingSchoolEmailConfirmationId) return;
    isChecking = true;
    api
      .getSchoolAuthEmailConfirmationStatus(pendingSchoolEmailConfirmationId)
      .then(function (statusData) {
        if (!statusData || statusData.expired || statusData.consumed) {
          if (schoolEmailConfirmationPollTimer) {
            window.clearInterval(schoolEmailConfirmationPollTimer);
            schoolEmailConfirmationPollTimer = null;
          }
          pendingSchoolEmailConfirmationId = '';
          return;
        }
        if (!statusData.approved) {
          return;
        }
        return api
          .consumeSchoolAuthEmailConfirmation(pendingSchoolEmailConfirmationId)
          .then(function (consumeData) {
            if (!consumeData || !consumeData.access) return;
            return api.fetchCurrentUser().then(function (nextUser) {
              completeLoginState(
                nextUser,
                pendingSchoolAuthContext && pendingSchoolAuthContext.token
                  ? pendingSchoolAuthContext.token
                  : '',
              );
              navigate('/' + initialView);
            });
          });
      })
      .catch(function () { })
      .finally(function () {
        isChecking = false;
      });
  }, 4000);
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
    scheduleDailyVisitCheck();
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

async function resolveSchoolPartnerFlow(token, view, nextSchoolId) {
  if (!token || suppressPartnerAutologinAfterLogout) {
    return false;
  }
  try {
    var statusResult = await api.getSchoolAuthStatus(token, nextSchoolId || schoolId);
    if (statusResult && statusResult.canAutoLogin) {
      var authResult = await api.completeSchoolAuth({
        token: token,
        schoolId: nextSchoolId || schoolId || '',
        mode: 'primary',
        acceptedTerms: true,
      });
      if (authResult && authResult.access) {
        var authUser = await api.fetchCurrentUser();
        pendingSchoolAuthContext = {
          token: token,
          schoolEmail: statusResult.schoolEmail || '',
          schoolId: statusResult.schoolId || nextSchoolId || schoolId || '',
        };
        completeLoginState(authUser, token);
        navigate('/' + (view || initialView));
        return true;
      }
    }
    pendingSchoolAuthContext = {
      token: token,
      schoolEmail: (statusResult && statusResult.schoolEmail) || '',
      schoolId: (statusResult && statusResult.schoolId) || nextSchoolId || schoolId || '',
    };
    navigate('/preview');
    return false;
  } catch (_e) {
    return applyAutologinToken(token, view, nextSchoolId);
  }
}

async function handleAlternateSchoolChoice(selectedEmail) {
  if (!pendingSchoolAuthContext || !pendingSchoolAuthContext.token) {
    throw new Error('Missing school auth context');
  }
  var payload = {
    token: pendingSchoolAuthContext.token,
    schoolId: pendingSchoolAuthContext.schoolId || schoolId || '',
    mode: 'alternate',
    email: selectedEmail,
    acceptedTerms: true,
  };
  var result = await api.completeSchoolAuth(payload);
  if (result && result.requiresEmailConfirmation) {
    startSchoolEmailConfirmationPolling(result.confirmationId);
    return {
      emailConfirmationSent: true,
      message: 'Confirmation email sent. Open email, approve sign in, then return to embed.',
    };
  }
  if (result && result.requiresPassword) {
    return {
      requiresPassword: true,
      email: result.email || selectedEmail,
    };
  }
  if (result && result.access) {
    var nextUser = await api.fetchCurrentUser();
    completeLoginState(nextUser, pendingSchoolAuthContext.token);
    navigate('/' + initialView);
    return;
  }
  throw new Error('Could not sign in with selected email');
}

async function handlePreviewPasswordSignIn(email, password) {
  if (!pendingSchoolAuthContext || !pendingSchoolAuthContext.token) {
    throw new Error('Missing school auth context');
  }
  var emailValue = String(email || '').trim().toLowerCase();
  var passwordValue = String(password || '');
  if (!emailValue || !passwordValue) {
    throw new Error('Enter email and password');
  }
  await api.login(emailValue, passwordValue);
  await api.linkSchoolEmail({
    token: pendingSchoolAuthContext.token,
    schoolId: pendingSchoolAuthContext.schoolId || schoolId || '',
  });
  var nextUser = await api.fetchCurrentUser();
  completeLoginState(nextUser, pendingSchoolAuthContext.token);
  navigate('/' + initialView);
}

async function handlePreviewForgotPassword(email) {
  var emailValue = String(email || '').trim().toLowerCase();
  if (!emailValue) {
    throw new Error('Missing email');
  }
  await api.forgotPassword(emailValue);
}

// Listen for runtime config from native layer
onNativeMessage('homecrowd:configure', function (config) {
  var configSchoolId = getSchoolIdFromConfig(config);
  if (config && (config.wildfireAppId || config.wildfire_app_id)) {
    wildfireAppId = String(config.wildfireAppId || config.wildfire_app_id || '');
    api.setEmbedContext({ wildfireAppId: wildfireAppId });
  }
  if (configSchoolId) {
    applySchoolConfig(configSchoolId);
  }
  if (config.token) {
    if (suppressPartnerAutologinAfterLogout) {
      return;
    }
    partnerToken = config.token;
    if (configSchoolId) {
      schoolId = configSchoolId;
    }
    resolveSchoolPartnerFlow(partnerToken, config.view || 'rewards', configSchoolId || schoolId).then(function (didLogin) {
      if (!didLogin) {
        if (!pendingSchoolAuthContext) {
          navigate('/login');
        }
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

window.addEventListener('homecrowd:walkthrough-complete', function () {
  holdOnboardingModals = false;
  flushPendingAutoRaffleModal();
  flushPendingDailyBonusModal();
});

window.addEventListener('homecrowd:home-ready', function (event) {
  var detail = event && event.detail ? event.detail : {};
  if (!detail.showInstructionOverlay) {
    holdOnboardingModals = false;
    flushPendingAutoRaffleModal();
    flushPendingDailyBonusModal();
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

function getDailyVisitStorageKey() {
  var userKey = user && (user.id || user.user_id || user.email);
  return 'last_daily_visit_check:' + String(userKey || 'anonymous');
}

function getDailyVisitStorageValue(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_e) {
    return null;
  }
}

function setDailyVisitStorageValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_e) { }
}

function removeDailyVisitStorageValue(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (_e) { }
}

function showBonusModal(title, message) {
  var overlay = document.createElement('div');
  overlay.className = 'hc-modal-overlay';
  overlay.innerHTML =
    '<div class="hc-modal" style="text-align:center;">' +
    '<div style="font-size:32px;margin-bottom:12px;">🎉</div>' +
    '<div class="hc-modal-title">' + title + '</div>' +
    '<div class="hc-modal-text">' + message + '</div>' +
    '<div class="hc-modal-actions" style="justify-content:center;">' +
    '<button class="hc-btn hc-btn-primary hc-btn-large" style="min-width:120px;" data-bonus-close="1">Awesome!</button>' +
    '</div>' +
    '</div>';

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  overlay.addEventListener('click', function (e) {
    if (e.target && (e.target.closest('[data-bonus-close]') || e.target === overlay)) close();
  });

  document.body.appendChild(overlay);
}

function showDailyBonus(dailyBonus) {
  console.log('🎯 [embed] Daily visit bonus received:', dailyBonus);
  if (!dailyBonus) {
    console.log('🎯 [embed] No daily bonus in response');
    return;
  }
  if (holdOnboardingModals) {
    console.log('🎯 [embed] Deferring daily bonus until onboarding complete');
    pendingDailyBonusModal = dailyBonus;
    return;
  }
  if (showDailyLoginBonusModal(dailyBonus)) {
    console.log('🎯 [embed] Showing daily bonus modal with raffle list');
    return;
  }
  console.log('🎯 [embed] Daily bonus had no awarded value:', dailyBonus);
}

function showRaffleEntryModal(count, titles) {
  var msg = titles && titles.length > 0
    ? "You've been entered into: <strong>" + titles.join(', ') + '</strong>!'
    : "You've been entered into " + count + ' raffle' + (count > 1 ? 's' : '') + '!';
  showBonusModal("You're In!", msg);
}

function flushPendingAutoRaffleModal() {
  if (!pendingAutoRaffleModal) return;
  var payload = pendingAutoRaffleModal;
  pendingAutoRaffleModal = null;
  showRaffleEntryModal(payload.count, payload.titles);
}

function flushPendingDailyBonusModal() {
  if (!pendingDailyBonusModal) return;
  var payload = pendingDailyBonusModal;
  pendingDailyBonusModal = null;
  showDailyBonus(payload);
}

async function checkDailyVisit() {
  console.log('🎯 [embed] checkDailyVisit called, user:', user && user.email);
  if (!user) {
    console.log('🎯 [embed] No user, skipping daily visit check');
    return;
  }

  if (dailyVisitCheckInProgress) {
    console.log('🎯 [embed] Daily visit check already in progress, skipping');
    return;
  }

  var today = new Date().toDateString();
  var storageKey = getDailyVisitStorageKey();
  var lastCheck = getDailyVisitStorageValue(storageKey);
  console.log('🎯 [embed] Daily visit storage key:', storageKey);
  console.log('🎯 [embed] Last daily visit check:', lastCheck, 'Today:', today);

  if (lastCheck === today) {
    console.log('🎯 [embed] Already checked daily visit today, skipping');
    return;
  }

  dailyVisitCheckInProgress = true;

  try {
    setDailyVisitStorageValue(storageKey, today);
    console.log('🎯 [embed] Recording daily visit...');
    var response = await api.recordDailyVisit();
    console.log('🎯 [embed] Daily visit response:', response);
    if (response && response.daily_bonus) {
      showDailyBonus(response.daily_bonus);
    } else {
      console.log('🎯 [embed] No daily_bonus in daily visit response');
    }
  } catch (error) {
    console.error('🎯 [embed] Failed to record daily visit:', error);
    removeDailyVisitStorageValue(storageKey);
  } finally {
    dailyVisitCheckInProgress = false;
  }
}

function scheduleDailyVisitCheck() {
  console.log('🎯 [embed] Scheduling daily visit check');
  window.setTimeout(function () {
    checkDailyVisit();
  }, 2000);
}

function setupDailyVisitForegroundCheck() {
  dailyVisitForegroundReady = true;
  document.addEventListener('visibilitychange', function () {
    console.log('🎯 [embed] visibilitychange:', document.visibilityState);
    if (document.visibilityState === 'visible' && user && dailyVisitForegroundReady) {
      checkDailyVisit();
    }
  });
  window.addEventListener('focus', function () {
    console.log('🎯 [embed] window focus');
    if (user && dailyVisitForegroundReady) {
      checkDailyVisit();
    }
  });
}

async function init() {
  handleStripeReturnQuery();
  var injected = window.__HC_EMBED_HOST_CONFIG__;
  if (injected && typeof injected === 'object') {
    var injectedSchoolId = getSchoolIdFromConfig(injected);
    if (injectedSchoolId) {
      schoolId = injectedSchoolId;
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
    await resolveSchoolPartnerFlow(partnerToken, initialView, schoolId);
  } else if (api.isAuthenticated()) {
    try {
      user = await api.fetchCurrentUser();
      postToNative('homecrowd:login', { user: user });
      preloadMapKitForEmbed();
      scheduleDailyVisitCheck();
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
    analytics.trackEmbedScreen(route);
    render(route);
  });
  window.addEventListener('homecrowd:embed-logout', function () {
    suppressPartnerAutologinAfterLogout = true;
    user = null;
    profileUserForTabs = null;
    lastAutologinTokenApplied = '';
    if (schoolEmailConfirmationPollTimer) {
      window.clearInterval(schoolEmailConfirmationPollTimer);
      schoolEmailConfirmationPollTimer = null;
    }
    pendingSchoolEmailConfirmationId = '';
    pendingAutoRaffleModal = null;
    pendingDailyBonusModal = null;
    holdOnboardingModals = true;
    clearPendingPasswordLink();
    clearPendingLoginEmail();
    api.clearTokens();
    postToNative('homecrowd:logout');
    if (partnerToken) {
      navigate('/preview');
    } else {
      navigate('/login');
    }
    api.logout().catch(function () { });
  });
  startRouter();
  setupDailyVisitForegroundCheck();

  if (!user && getRoute() !== '/login' && getRoute() !== '/preview') {
    if (partnerToken) {
      navigate('/preview');
    } else {
      navigate('/login');
    }
  } else if (user && (getRoute() === '/login' || getRoute() === '/' || getRoute() === '/preview')) {
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
    pathOnly === '/cards/link' ||
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
    '<a href="#/offers" class="hc-tab-link' +
    offersActive +
    '">' +
    '<span class="hc-tab-icon-wrap">' +
    tabSvgInline(bagSvg) +
    '</span><span class="hc-tab-label">Offers</span></a>';

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
    '<a href="#/rewards" class="hc-tab-link' +
    rewardsActive +
    '">' +
    '<span class="hc-tab-icon-wrap">' +
    tabSvgInline(giftFilledSvg) +
    '</span><span class="hc-tab-label">Rewards</span></a>' +
    '<a href="#/profile" class="hc-tab-link' +
    profileActive +
    '">' +
    '<span class="hc-tab-icon-wrap">' +
    tabSvgInline(personSvg) +
    '</span><span class="hc-tab-label">Profile</span></a>' +
    '</nav>';

  return '<div class="hc-tab-bar-shell">' + html + '</div>';
}

function lockStaticChromeDrag() {
  var chromeEls = appEl.querySelectorAll('.hc-sticky-top, .hc-tab-bar-shell');
  chromeEls.forEach(function (chromeEl) {
    chromeEl.addEventListener(
      'touchmove',
      function (event) {
        event.preventDefault();
      },
      { passive: false }
    );
  });
}

function removeRewardsPointsOverlay() {
  var el = document.getElementById('hc-rewards-points-overlay');
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

function cleanupOverlays() {
  var overlay = document.getElementById('hc-points-overlay-global');
  if (overlay) overlay.remove();
}

function render(route) {
  var routeEpoch = nextNavEpoch();
  removeRewardsPointsOverlay();
  if (!user && route !== '/login' && route !== '/preview') {
    navigate(partnerToken ? '/preview' : '/login');
    return;
  }
  if (user && (route === '/login' || route === '/preview')) {
    navigate('/' + initialView);
    return;
  }

  if (route === '/login') {
    var pendingLink = readPendingPasswordLink();
    var pendingEmail = readPendingLoginEmail();
    var noticeText = pendingLink
      ? 'Account exists. Enter password to continue.'
      : '';
    appEl.innerHTML = '';
    renderLogin(appEl, async function (u, loginMeta) {
      var assignSchoolId =
        (loginMeta && loginMeta.signupSchoolId
          ? String(loginMeta.signupSchoolId).trim()
          : '') || schoolId;
      var linkData = readPendingPasswordLink();
      if (linkData && linkData.token) {
        try {
          await api.linkSchoolEmail({
            token: linkData.token,
            schoolId: linkData.schoolId || schoolId || '',
          });
          clearPendingPasswordLink();
          clearPendingLoginEmail();
        } catch (_e) { }
      }
      if (assignSchoolId) {
        try {
          var assignResult = await api.assignSchool(assignSchoolId);
          u = await api.fetchCurrentUser();
          if (assignResult && assignResult.auto_raffle_entries > 0) {
            pendingAutoRaffleModal = {
              count: assignResult.auto_raffle_entries,
              titles: assignResult.raffle_titles,
            };
          }
        } catch (e) { }
      }
      completeLoginState(u);
      navigate('/' + initialView);
    }, {
      schoolId: schoolId,
      initialEmail: pendingEmail,
      lockEmail: !!pendingLink,
      notice: noticeText,
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
        var qIdx = route.indexOf('?');
        var params = new URLSearchParams(qIdx >= 0 ? route.slice(qIdx + 1) : '');
        var wantWeekly = params.get('weekly') === '1';
        var wantOverall = params.get('overall') === '1';

        function emptyCtx(product, weeklyReward) {
          return {
            summary: summary,
            product: product,
            currentUser: currentUser,
            paymentCards: paymentCards,
            ticketsResponse: ticketsResponse,
            weeklyReward: weeklyReward || null,
          };
        }

        function loadCatalogFallback() {
          return api.getRewardsCatalog().then(function (catalogRaw) {
            var list = Array.isArray(catalogRaw) ? catalogRaw : (catalogRaw && catalogRaw.results) || [];
            var found = list.find(function (r) {
              return String(r.id) === rewardId;
            });
            return emptyCtx(found, null);
          });
        }

        function loadStandardProduct() {
          return api
            .getRewardDetail(rewardId)
            .catch(function () {
              return null;
            })
            .then(function (product) {
              if (product && product.id) {
                return emptyCtx(product, null);
              }
              return loadCatalogFallback();
            });
        }

        if (wantWeekly || wantOverall) {
          return api
            .getLeaderboard()
            .catch(function () {
              return null;
            })
            .then(function (lb) {
              if (!lb) return loadStandardProduct();
              var pCtx = wantWeekly ? buildWeeklyRewardContext(lb) : buildOverallRewardContext(lb);
              return pCtx.then(function (w) {
                if (w && String(w.rewardId) === String(rewardId)) {
                  var prod = leaderboardContextToEmbedProduct(w);
                  if (prod && prod.id) {
                    return emptyCtx(prod, w);
                  }
                }
                return loadStandardProduct();
              });
            });
        }

        return loadStandardProduct();
      })
      .then(function (ctx) {
        if (!ctx || !ctx.product || !ctx.product.id) {
          contentEl.innerHTML = '<div class="hc-alert-error">Reward not found</div>';
          return;
        }
        analytics.trackEmbedRewardDetailView(ctx.product, ctx.currentUser);
        renderRewardDetail(contentEl, {
          product: ctx.product,
          summary: ctx.summary,
          currentUser: ctx.currentUser,
          cardLinkStatus: resolveCardLinkStatus(ctx.currentUser, ctx.paymentCards) || 'unknown',
          ticketsResponse: ctx.ticketsResponse,
          weeklyReward: ctx.weeklyReward || null,
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
  } else if (pathOnly === '/cards/link') {
    renderLinkCards(contentEl);
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
  } else if (pathOnly === '/preview') {
    var previewCtx = pendingSchoolAuthContext || {
      token: partnerToken || '',
      schoolEmail: '',
      schoolId: schoolId || '',
    };
    pendingSchoolAuthContext = previewCtx;
    renderPreviewScreen(contentEl, {
      schoolEmail: previewCtx.schoolEmail || '',
      onPrimaryChoice: async function () {
        if (!previewCtx.token) {
          throw new Error('Missing school token');
        }
        var authResult = await api.completeSchoolAuth({
          token: previewCtx.token,
          schoolId: previewCtx.schoolId || schoolId || '',
          mode: 'primary',
          acceptedTerms: true,
        });
        if (!authResult || !authResult.access) {
          throw new Error('Could not sign in with school email');
        }
        var nextUser = await api.fetchCurrentUser();
        completeLoginState(nextUser, previewCtx.token);
        navigate('/' + initialView);
      },
      onAlternateChoice: function (email) {
        return handleAlternateSchoolChoice(email);
      },
      onPasswordChoice: function (email, password) {
        return handlePreviewPasswordSignIn(email, password);
      },
      onForgotPassword: function (email) {
        return handlePreviewForgotPassword(email);
      },
    });
  } else if (pathOnly === '/offers') {
    renderOffers(contentEl);
  } else {
    renderRewards(contentEl, routeEpoch);
  }
}

var tabIcons = {
  home: '<svg width="24" height="26" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.99023 22.57V10.1408C1.99023 9.77471 2.07222 9.42819 2.23619 9.1012C2.40016 8.77422 2.62609 8.50491 2.91399 8.29327L10.6143 2.46188C11.0176 2.15396 11.478 2 11.9957 2C12.5133 2 12.9766 2.15396 13.3856 2.46188L21.086 8.29184C21.3748 8.50348 21.6008 8.77326 21.7638 9.1012C21.9277 9.42819 22.0097 9.77471 22.0097 10.1408V22.57C22.0097 22.9533 21.8672 23.2874 21.5822 23.5724C21.2971 23.8575 20.963 24 20.5798 24H15.7408C15.4128 24 15.1383 23.8894 14.9171 23.6682C14.6959 23.4461 14.5854 23.1716 14.5854 22.8446V16.0251C14.5854 15.6981 14.4748 15.424 14.2536 15.2029C14.0315 14.9807 13.7569 14.8697 13.4299 14.8697H10.57C10.243 14.8697 9.96896 14.9807 9.74779 15.2029C9.52567 15.424 9.41461 15.6981 9.41461 16.0251V22.846C9.41461 23.173 9.30402 23.4471 9.08286 23.6682C8.86169 23.8894 8.58761 24 8.26063 24H3.4202C3.03697 24 2.70283 23.8575 2.41779 23.5724C2.13275 23.2874 1.99023 22.9533 1.99023 22.57Z" fill="currentColor"/></svg>',
  rewards: '<svg width="24" height="26" viewBox="0 0 25 26" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.83506 2.00004C6.76331 1.98908 4.74638 3.9841 5.66715 6.46142H2.19232C1.61088 6.46142 1.05326 6.6924 0.642116 7.10354C0.230976 7.51468 0 8.0723 0 8.65374V10.8461C0 11.1368 0.115488 11.4156 0.321058 11.6212C0.526628 11.8267 0.805441 11.9422 1.09616 11.9422H10.9616H13.1539H23.0194C23.3101 11.9422 23.5889 11.8267 23.7945 11.6212C24.0001 11.4156 24.1155 11.1368 24.1155 10.8461V8.65374C24.1155 8.0723 23.8846 7.51468 23.4734 7.10354C23.0623 6.6924 22.5047 6.46142 21.9232 6.46142H18.4484C19.7309 2.87697 14.9078 0.344842 12.6826 3.43602L12.0578 4.2691L11.433 3.41409C10.7424 2.43851 9.78872 2.01101 8.83506 2.00004ZM8.76929 4.2691C9.74487 4.2691 10.2381 5.45295 9.54756 6.14353C8.85698 6.83412 7.67313 6.34084 7.67313 5.36526C7.67313 5.07454 7.78862 4.79573 7.99419 4.59016C8.19976 4.38459 8.47857 4.2691 8.76929 4.2691ZM15.3463 4.2691C16.3218 4.2691 16.8151 5.45295 16.1245 6.14353C15.4339 6.83412 14.2501 6.34084 14.2501 5.36526C14.2501 5.07454 14.3656 4.79573 14.5712 4.59016C14.7767 4.38459 15.0555 4.2691 15.3463 4.2691ZM1.09616 13.0384V21.8077C1.09616 22.3891 1.32714 22.9467 1.73828 23.3579C2.14942 23.769 2.70704 24 3.28848 24H20.8271C21.4085 24 21.9661 23.769 22.3773 23.3579C22.7884 22.9467 23.0194 22.3891 23.0194 21.8077V13.0384H13.1539H10.9616H1.09616Z" fill="currentColor"/></svg>',
  offers: '<svg width="24" height="26" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.4055 2C19.9942 2.00005 20.5632 2.2126 21.0078 2.59859C21.4524 2.98458 21.7427 3.51807 21.8255 4.101L21.8462 4.29167L22.9157 21.4028C22.9561 22.0448 22.7417 22.6769 22.3191 23.162C21.8965 23.647 21.2998 23.9459 20.6582 23.9939L20.4749 24H3.52391C2.88066 24 2.26331 23.7465 1.80572 23.2944C1.34813 22.8423 1.08719 22.2281 1.07947 21.5849L1.08313 21.4028L2.15258 4.29167C2.18936 3.70386 2.43712 3.1491 2.85031 2.72941C3.26349 2.30971 3.81431 2.0533 4.40147 2.00733L4.59213 2H19.4055ZM15.6655 6.88889C15.3661 6.88893 15.0772 6.99884 14.8535 7.19776C14.6297 7.39669 14.4868 7.6708 14.4518 7.96811L14.4432 8.11111C14.4432 8.75942 14.1857 9.38117 13.7273 9.83959C13.2689 10.298 12.6471 10.5556 11.9988 10.5556C11.3505 10.5556 10.7287 10.298 10.2703 9.83959C9.8119 9.38117 9.55436 8.75942 9.55436 8.11111C9.55436 7.78696 9.42559 7.47608 9.19638 7.24687C8.96716 7.01766 8.65629 6.88889 8.33213 6.88889C8.00798 6.88889 7.6971 7.01766 7.46789 7.24687C7.23868 7.47608 7.10991 7.78696 7.10991 8.11111C7.10991 9.40772 7.62499 10.6512 8.54183 11.5681C9.45868 12.4849 10.7022 13 11.9988 13C13.2954 13 14.5389 12.4849 15.4558 11.5681C16.3726 10.6512 16.8877 9.40772 16.8877 8.11111C16.8877 7.78696 16.7589 7.47608 16.5297 7.24687C16.3005 7.01766 15.9896 6.88889 15.6655 6.88889Z" fill="currentColor"/></svg>',
  profile: '<svg width="24" height="26" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.11111 6.88889C7.11111 5.59227 7.62619 4.34877 8.54303 3.43192C9.45988 2.51508 10.7034 2 12 2C13.2966 2 14.5401 2.51508 15.457 3.43192C16.3738 4.34877 16.8889 5.59227 16.8889 6.88889C16.8889 8.1855 16.3738 9.42901 15.457 10.3459C14.5401 11.2627 13.2966 11.7778 12 11.7778C10.7034 11.7778 9.45988 11.2627 8.54303 10.3459C7.62619 9.42901 7.11111 8.1855 7.11111 6.88889ZM7.11111 14.2222C5.49034 14.2222 3.93596 14.8661 2.7899 16.0121C1.64385 17.1582 1 18.7126 1 20.3333C1 21.3058 1.38631 22.2384 2.07394 22.9261C2.76158 23.6137 3.69421 24 4.66667 24H19.3333C20.3058 24 21.2384 23.6137 21.9261 22.9261C22.6137 22.2384 23 21.3058 23 20.3333C23 18.7126 22.3562 17.1582 21.2101 16.0121C20.064 14.8661 18.5097 14.2222 16.8889 14.2222H7.11111Z" fill="currentColor"/></svg>'
};

function renderLayout(route) {
  var pathOnly = routePathOnly(route);
  var contentTabEnabled = isContentTabEnabled(user);
  var isRewardDetailPage =
    /^\/rewards\/[^/]+$/.test(pathOnly) ||
    /^\/rewards\/[^/]+\/confirm$/.test(pathOnly) ||
    /^\/rewards\/[^/]+\/thanks$/.test(pathOnly);
  var isRewardsListPage = pathOnly === '/rewards';
  var isOfferDetailPage = /^\/offers\/[^/]+$/.test(pathOnly);
  var isContentDetailPage = /^\/content\/[^/]+$/.test(pathOnly);
  var isPreviewPage = pathOnly === '/preview';
  var hideTabBar = isRewardDetailPage || isOfferDetailPage || isContentDetailPage || isPreviewPage;
  var flushTopContentClass =
    pathOnly === '/invite-friend' || pathOnly === '/support' || pathOnly === '/cards/link'
      ? ' hc-content--flush-top'
      : '';

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
    (isRewardsListPage ? ' hc-content--rewards-list' : '') +
    (hideTabBar ? '' : ' hc-content--with-tab-bar') +
    flushTopContentClass +
    '"></main>' +
    tabBarHtml +
    '</div>';

  lockStaticChromeDrag();

  return document.getElementById('hc-content');
}

init();
