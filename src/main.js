import * as api from './api.js';
import { postToNative, onNativeMessage } from './bridge.js';
import { navigate, getRoute, onRouteChange, startRouter } from './router.js';
import { renderLogin } from './views/login.js';
import { renderHome } from './views/home.js';
import { renderRewards } from './views/rewards.js';
import logoUrl from './assets/header.png';
import { renderCards } from './views/cards.js';
import { renderRewardDetail } from './views/reward-detail.js';
import { renderOffers } from './views/offers.js';
import { renderOfferDetail } from './views/offer-detail.js';
import { renderProfile } from './views/profile.js';

var appEl = document.getElementById('app');
var user = null;

// Read config from URL params (set by native when loading the WebView URL)
var params = new URLSearchParams(window.location.search);
var schoolId = params.get('schoolId') || '';
var partnerToken = params.get('token') || '';
var initialView = params.get('view') || 'home';

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

function cleanupOverlays() {
  var overlay = document.getElementById('hc-points-overlay-global');
  if (overlay) overlay.remove();
}

function render(route) {
  cleanupOverlays();
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
      navigate('/home');
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

  if (route === '/home') {
    renderHome(contentEl, user);
  } else if (route === '/cards') {
    renderCards(contentEl);
  } else if (route === '/offers') {
    renderOffers(contentEl);
  } else if (route === '/profile') {
    renderProfile(contentEl, user, function () {
      user = null;
      postToNative('homecrowd:logout');
      navigate('/login');
    });
  } else if (route === '/rewards') {
    renderRewards(contentEl);
  } else {
    renderHome(contentEl, user);
  }
}

var tabIcons = {
  home: '<svg width="24" height="26" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.99023 22.57V10.1408C1.99023 9.77471 2.07222 9.42819 2.23619 9.1012C2.40016 8.77422 2.62609 8.50491 2.91399 8.29327L10.6143 2.46188C11.0176 2.15396 11.478 2 11.9957 2C12.5133 2 12.9766 2.15396 13.3856 2.46188L21.086 8.29184C21.3748 8.50348 21.6008 8.77326 21.7638 9.1012C21.9277 9.42819 22.0097 9.77471 22.0097 10.1408V22.57C22.0097 22.9533 21.8672 23.2874 21.5822 23.5724C21.2971 23.8575 20.963 24 20.5798 24H15.7408C15.4128 24 15.1383 23.8894 14.9171 23.6682C14.6959 23.4461 14.5854 23.1716 14.5854 22.8446V16.0251C14.5854 15.6981 14.4748 15.424 14.2536 15.2029C14.0315 14.9807 13.7569 14.8697 13.4299 14.8697H10.57C10.243 14.8697 9.96896 14.9807 9.74779 15.2029C9.52567 15.424 9.41461 15.6981 9.41461 16.0251V22.846C9.41461 23.173 9.30402 23.4471 9.08286 23.6682C8.86169 23.8894 8.58761 24 8.26063 24H3.4202C3.03697 24 2.70283 23.8575 2.41779 23.5724C2.13275 23.2874 1.99023 22.9533 1.99023 22.57Z" fill="currentColor"/></svg>',
  rewards: '<svg width="24" height="26" viewBox="0 0 25 26" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.83506 2.00004C6.76331 1.98908 4.74638 3.9841 5.66715 6.46142H2.19232C1.61088 6.46142 1.05326 6.6924 0.642116 7.10354C0.230976 7.51468 0 8.0723 0 8.65374V10.8461C0 11.1368 0.115488 11.4156 0.321058 11.6212C0.526628 11.8267 0.805441 11.9422 1.09616 11.9422H10.9616H13.1539H23.0194C23.3101 11.9422 23.5889 11.8267 23.7945 11.6212C24.0001 11.4156 24.1155 11.1368 24.1155 10.8461V8.65374C24.1155 8.0723 23.8846 7.51468 23.4734 7.10354C23.0623 6.6924 22.5047 6.46142 21.9232 6.46142H18.4484C19.7309 2.87697 14.9078 0.344842 12.6826 3.43602L12.0578 4.2691L11.433 3.41409C10.7424 2.43851 9.78872 2.01101 8.83506 2.00004ZM8.76929 4.2691C9.74487 4.2691 10.2381 5.45295 9.54756 6.14353C8.85698 6.83412 7.67313 6.34084 7.67313 5.36526C7.67313 5.07454 7.78862 4.79573 7.99419 4.59016C8.19976 4.38459 8.47857 4.2691 8.76929 4.2691ZM15.3463 4.2691C16.3218 4.2691 16.8151 5.45295 16.1245 6.14353C15.4339 6.83412 14.2501 6.34084 14.2501 5.36526C14.2501 5.07454 14.3656 4.79573 14.5712 4.59016C14.7767 4.38459 15.0555 4.2691 15.3463 4.2691ZM1.09616 13.0384V21.8077C1.09616 22.3891 1.32714 22.9467 1.73828 23.3579C2.14942 23.769 2.70704 24 3.28848 24H20.8271C21.4085 24 21.9661 23.769 22.3773 23.3579C22.7884 22.9467 23.0194 22.3891 23.0194 21.8077V13.0384H13.1539H10.9616H1.09616Z" fill="currentColor"/></svg>',
  offers: '<svg width="24" height="26" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.4055 2C19.9942 2.00005 20.5632 2.2126 21.0078 2.59859C21.4524 2.98458 21.7427 3.51807 21.8255 4.101L21.8462 4.29167L22.9157 21.4028C22.9561 22.0448 22.7417 22.6769 22.3191 23.162C21.8965 23.647 21.2998 23.9459 20.6582 23.9939L20.4749 24H3.52391C2.88066 24 2.26331 23.7465 1.80572 23.2944C1.34813 22.8423 1.08719 22.2281 1.07947 21.5849L1.08313 21.4028L2.15258 4.29167C2.18936 3.70386 2.43712 3.1491 2.85031 2.72941C3.26349 2.30971 3.81431 2.0533 4.40147 2.00733L4.59213 2H19.4055ZM15.6655 6.88889C15.3661 6.88893 15.0772 6.99884 14.8535 7.19776C14.6297 7.39669 14.4868 7.6708 14.4518 7.96811L14.4432 8.11111C14.4432 8.75942 14.1857 9.38117 13.7273 9.83959C13.2689 10.298 12.6471 10.5556 11.9988 10.5556C11.3505 10.5556 10.7287 10.298 10.2703 9.83959C9.8119 9.38117 9.55436 8.75942 9.55436 8.11111C9.55436 7.78696 9.42559 7.47608 9.19638 7.24687C8.96716 7.01766 8.65629 6.88889 8.33213 6.88889C8.00798 6.88889 7.6971 7.01766 7.46789 7.24687C7.23868 7.47608 7.10991 7.78696 7.10991 8.11111C7.10991 9.40772 7.62499 10.6512 8.54183 11.5681C9.45868 12.4849 10.7022 13 11.9988 13C13.2954 13 14.5389 12.4849 15.4558 11.5681C16.3726 10.6512 16.8877 9.40772 16.8877 8.11111C16.8877 7.78696 16.7589 7.47608 16.5297 7.24687C16.3005 7.01766 15.9896 6.88889 15.6655 6.88889Z" fill="currentColor"/></svg>',
  profile: '<svg width="24" height="26" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.11111 6.88889C7.11111 5.59227 7.62619 4.34877 8.54303 3.43192C9.45988 2.51508 10.7034 2 12 2C13.2966 2 14.5401 2.51508 15.457 3.43192C16.3738 4.34877 16.8889 5.59227 16.8889 6.88889C16.8889 8.1855 16.3738 9.42901 15.457 10.3459C14.5401 11.2627 13.2966 11.7778 12 11.7778C10.7034 11.7778 9.45988 11.2627 8.54303 10.3459C7.62619 9.42901 7.11111 8.1855 7.11111 6.88889ZM7.11111 14.2222C5.49034 14.2222 3.93596 14.8661 2.7899 16.0121C1.64385 17.1582 1 18.7126 1 20.3333C1 21.3058 1.38631 22.2384 2.07394 22.9261C2.76158 23.6137 3.69421 24 4.66667 24H19.3333C20.3058 24 21.2384 23.6137 21.9261 22.9261C22.6137 22.2384 23 21.3058 23 20.3333C23 18.7126 22.3562 17.1582 21.2101 16.0121C20.064 14.8661 18.5097 14.2222 16.8889 14.2222H7.11111Z" fill="currentColor"/></svg>'
};

function renderLayout(route) {
  appEl.innerHTML = '\
    <div class="hc-embed">\
      <div class="hc-header">\
        <img src="' + logoUrl + '" alt="Homecrowd" class="hc-header-logo" />\
      </div>\
      <main id="hc-content" class="hc-content"></main>\
      <nav class="hc-tab-bar">\
        <a href="#/home" class="hc-tab' + (route === '/home' ? ' active' : '') + '">\
          <span class="hc-tab-icon">' + tabIcons.home + '</span>\
          <span class="hc-tab-label">Home</span>\
        </a>\
        <a href="#/rewards" class="hc-tab' + (route.indexOf('/rewards') === 0 ? ' active' : '') + '">\
          <span class="hc-tab-icon">' + tabIcons.rewards + '</span>\
          <span class="hc-tab-label">Rewards</span>\
        </a>\
        <a href="#/offers" class="hc-tab' + (route.indexOf('/offers') === 0 ? ' active' : '') + '">\
          <span class="hc-tab-icon">' + tabIcons.offers + '</span>\
          <span class="hc-tab-label">Offers</span>\
        </a>\
        <a href="#/profile" class="hc-tab' + (route === '/profile' || route === '/cards' ? ' active' : '') + '">\
          <span class="hc-tab-icon">' + tabIcons.profile + '</span>\
          <span class="hc-tab-label">Profile</span>\
        </a>\
      </nav>\
    </div>';

  return document.getElementById('hc-content');
}

init();
