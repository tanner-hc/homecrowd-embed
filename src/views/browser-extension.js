import * as api from '../api.js';
import { navigate } from '../router.js';
import { postToNative, onNativeMessage, requestNativeExtensionEnabled } from '../bridge.js';
import NavHeader from '../base-components/NavHeader.js';
import ScreenTitle from '../base-components/ScreenTitle.js';
import MainButton from '../base-components/MainButton.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import NoExtraCostFooter from '../base-components/NoExtraCostFooter.js';
import PointsPerDollarBanner from '../base-components/PointsPerDollarBanner.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import {
  getHeaderLogoUrl,
  getProgramName,
  getSchoolName,
  hasCustomHeaderLogo,
} from '../brand.js';
import { renderPointMultiplierBadgeHtml } from '../pointMultiplier.js';
import { showError } from '../base-components/toastApi.js';
import { showPointsEarnedToast } from '../base-components/PointsEarnedToast.js';
import extensionBodyImg from '../assets/images/extension-body.png';
import safariThinUrl from '../assets/icons/safari-thin.png';
import offerThinUrl from '../assets/icons/offer-thin.png';
import safariIconRaw from '../assets/icons/safari.svg?raw';
import bagSvg from '../assets/icons/bag.svg?raw';
import chevronLeftSvg from '../assets/icons/chevron-left.svg?raw';
import safariBgUrl from '../assets/link_card/background.png';
import presentIconUrl from '../assets/link_card/present.png';
import hcIconUrl from '../assets/logos/icon.png';
import {
  userExtensionEnabled,
  syncExtensionEnabledFromNative,
  markUserExtensionEnabled,
  extensionFlagTrue,
} from '../extension-status.js';
import {
  syncSetupTaskRewards,
  claimSetupTaskReward,
  getSetupRewardPoints,
} from '../setup-rewards.js';

var EXTENSION_URL = 'https://app.gethomecrowd.com/extension-download/';

function buildExtensionHeaderHtml(opts) {
  opts = opts || {};
  var html = '';
  html += ScreenTitle({
    title: 'Safari extension',
    subtitle: 'Offers appear as you browse in Safari',
    className: 'hc-be-header',
  });
  if (opts.afterTitleHtml) {
    html += opts.afterTitleHtml;
  }
  html +=
    '<div class="hc-be-body-image-wrap">' +
    '<img data-hc-ph="none" class="hc-be-body-image" src="' +
    extensionBodyImg +
    '" alt="Find offers. Earn points. Offers show up automatically as you browse in Safari." />' +
    '<div class="hc-be-body-image-logo" data-be-body-logo aria-hidden="true"></div>' +
    '</div>';
  var compassSvg =
    '<img data-hc-ph="none" src="' + safariThinUrl + '" alt="" class="hc-be-step-img hc-be-step-img--safari" />';
  var tagSvg =
    '<img data-hc-ph="none" src="' + offerThinUrl + '" alt="" class="hc-be-step-img" />';
  var trophySvg =
    '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M9 4h14v6a7 7 0 0 1-14 0V4Z" stroke="#1d6dff" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M9 7H5a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4h1" stroke="#1d6dff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M23 7h4a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4h-1" stroke="#1d6dff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M16 18v5" stroke="#1d6dff" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M11 28h10a1 1 0 0 0 1-1v-2a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v2a1 1 0 0 0 1 1z" stroke="#1d6dff" stroke-width="2" stroke-linejoin="round"/>' +
    '</svg>';
  if (opts.beforeStepsHtml) {
    html += opts.beforeStepsHtml;
  }
  html += '<div class="hc-be-steps-card">';
  var steps = [
    { svg: compassSvg, num: '1.', title: 'Browse in Safari', body: 'Visit your favorite stores like you normally do.' },
    { svg: tagSvg, num: '2.', title: 'See offers', body: 'We&rsquo;ll notify you when a brand is in network.' },
    { svg: trophySvg, num: '3.', title: 'Earn points', body: 'Complete your purchase and earn points. <span class="hc-be-step-body-muted">*points may take up to 24 hours to appear.</span>' },
  ];
  for (var i = 0; i < steps.length; i++) {
    var s = steps[i];
    html += '<div class="hc-be-step">';
    html += '<div class="hc-be-step-icon">' + s.svg + '</div>';
    html +=
      '<div class="hc-be-step-title"><span class="hc-be-step-num">' +
      s.num +
      '</span> ' +
      s.title +
      '</div>';
    html += '<div class="hc-be-step-body">' + s.body + '</div>';
    html += '</div>';
    if (i < steps.length - 1) {
      html += '<div class="hc-be-step-divider" aria-hidden="true"></div>';
    }
  }
  html += '</div>';
  html += NoExtraCostFooter({ className: 'hc-be-steps-footer' });
  return html;
}

function buildExtensionContentHtml(enabled, installButtonId) {
  var inner = '';
  inner += '<div class="hc-be-content">';
  if (enabled) {
    inner += '<div class="hc-be-enabled-badge" aria-hidden="true">\u2713</div>';
    inner += '<div class="hc-be-title">Extension is installed</div>';
    inner += '<div class="hc-be-actions">';
    inner += MainButton({
      id: installButtonId,
      text: 'View Instructions',
    });
    inner += '</div>';
  } else {
    inner += '<div class="hc-be-actions">';
    inner += MainButton({
      id: installButtonId,
      text: 'Install Extension',
    });
    inner += '</div>';
  }
  inner += '</div>';
  inner += buildPopularOffersPlaceholder();
  return inner;
}

function buildPopularOffersPlaceholder() {
  return (
    '<div class="hc-be-popular">' +
    '<div class="hc-be-popular-header">' +
    '<h1 class="hc-bc-screen-title hc-be-popular-title">Popular offers</h1>' +
    '</div>' +
    '<div class="hc-be-popular-list" data-be-popular-list>' +
    popularOffersSkeletonHtml() +
    '</div>' +
    '</div>'
  );
}

function popularOffersSkeletonHtml() {
  var row =
    '<div class="hc-be-popular-row hc-be-popular-row--skeleton" aria-hidden="true">' +
    '<div class="hc-be-popular-logo hc-skeleton-shimmer"></div>' +
    '<div class="hc-be-popular-meta">' +
    '<div class="hc-be-popular-name hc-skeleton-line hc-skeleton-shimmer"></div>' +
    '<div class="hc-be-popular-cashback hc-skeleton-line hc-skeleton-shimmer"></div>' +
    '</div>' +
    '</div>';
  var html = '';
  for (var i = 0; i < 4; i++) html += row;
  return html;
}

function getOfferCashback(offer) {
  if (!offer) return '';
  var raw = offer.cashback != null ? offer.cashback : offer.points;
  if (raw == null || String(raw).trim() === '') return '';
  return 'Up to ' + raw + '% back';
}

function renderPopularOffersHtml(merchants) {
  if (!merchants || !merchants.length) {
    return '<div class="hc-be-popular-empty">No offers available right now.</div>';
  }
  var html = '';
  for (var i = 0; i < merchants.length; i++) {
    var m = merchants[i];
    var name = m.name || m.merchantName || 'Unknown';
    var logo = m.logoUrl || m.logo || '';
    var merchantId = m.wildfireMerchantId || m.id || '';
    var cashback = getOfferCashback(m);
    html += '<button type="button" class="hc-be-popular-row" data-be-popular-row';
    if (merchantId) {
      html += ' data-merchant-id="' + escapeAttr(String(merchantId)) + '"';
    }
    html += '>';
    html += '<span class="hc-be-popular-logo-wrap">';
    if (logo) {
      html +=
        '<img data-hc-ph="store" class="hc-be-popular-logo" src="' +
        escapeAttr(logo) +
        '" alt="' +
        escapeAttr(name) +
        '" />';
    } else {
      html += '<div class="hc-be-popular-logo hc-be-popular-logo--placeholder"></div>';
    }
    html += renderPointMultiplierBadgeHtml(m, 'overlay', true);
    html += '</span>';
    html += '<div class="hc-be-popular-meta">';
    html += '<div class="hc-be-popular-name">' + escapeHtml(name) + '</div>';
    if (cashback) {
      html += '<div class="hc-be-popular-cashback">' + escapeHtml(cashback) + '</div>';
    }
    html += '</div>';
    html +=
      '<div class="hc-be-popular-pill"><span>In Safari</span>' +
      '<span class="hc-be-popular-pill-icon">' +
      safariIconRaw +
      '</span></div>';
    html += '<span class="hc-be-popular-chevron" aria-hidden="true">›</span>';
    html += '</button>';
  }
  return html;
}

function bindPopularOffers(rootEl) {
  if (!rootEl) return;
  rootEl.addEventListener('click', function (ev) {
    var row = ev.target.closest && ev.target.closest('[data-be-popular-row]');
    if (!row || !rootEl.contains(row)) return;
    var merchantId = row.getAttribute('data-merchant-id');
    if (!merchantId) return;
    var url = api.buildWildfireRedirectUrl(merchantId);
    if (!url) return;
    try {
      postToNative('homecrowd:open-url', { url: url });
    } catch (_e) {}
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (_w) {}
  });
}

async function populatePopularOffers(rootEl) {
  if (!rootEl) return;
  var listEl = rootEl.querySelector('[data-be-popular-list]');
  if (!listEl) return;
  try {
    var raw = await api.getWildfireOffers(1, 4);
    if (!rootEl.isConnected) return;
    var items = [];
    if (raw) {
      if (Array.isArray(raw.click)) items = raw.click;
      else if (Array.isArray(raw.results)) items = raw.results;
      else if (Array.isArray(raw)) items = raw;
    }
    listEl.innerHTML = renderPopularOffersHtml(items.slice(0, 4));
    setBodyImageLogo(items[0]);
  } catch (_err) {
    if (!rootEl.isConnected) return;
    listEl.innerHTML = '<div class="hc-be-popular-empty">Couldn&rsquo;t load offers.</div>';
  }
}

function setBodyImageLogo(offer) {
  var slot = document.querySelector('[data-be-body-logo]');
  if (!slot) return;
  var logo = offer && (offer.logoUrl || offer.logo);
  if (!logo) return;
  slot.innerHTML =
    '<img data-hc-ph="store" src="' + escapeAttr(logo) + '" alt="" />';
}

function bindExtensionInstallButton(installBtn) {
  if (!installBtn) return;
  installBtn.addEventListener('click', function () {
    try {
      postToNative('homecrowd:open-url', { url: EXTENSION_URL });
      var child = null;
      try {
        child = window.open(EXTENSION_URL, '_blank', 'noopener,noreferrer');
        if (child) {
          try {
            child.opener = null;
          } catch (_op) {}
        }
      } catch (_wo) {}
      if (!child && window.top && window.top !== window) {
        try {
          child = window.top.open(EXTENSION_URL, '_blank', 'noopener,noreferrer');
          if (child) {
            try {
              child.opener = null;
            } catch (_op2) {}
          }
        } catch (_wt) {}
      }
      if (!child) {
        var a = document.createElement('a');
        a.href = EXTENSION_URL;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (_e) {
      showError('Failed to open extension page');
    }
  });
}

export async function mountBrowserExtensionInline(panelEl) {
  if (!panelEl) return;
  panelEl.innerHTML = LoadingSpinner({ text: 'Loading...' });
  var embedUser;
  try {
    embedUser = await api.fetchCurrentUser();
  } catch (err) {
    panelEl.innerHTML =
      '<div class="hc-alert-error">' + escapeHtml(err.message || 'Failed to load') + '</div>';
    return;
  }
  try {
    embedUser = (await syncExtensionEnabledFromNative(embedUser)) || embedUser;
  } catch (_extSync) {}
  var profileUser = null;
  try {
    profileUser = await api.getUserProfile();
  } catch (_e) {
    profileUser = null;
  }
  var syncResult = null;
  try {
    syncResult = await syncSetupTaskRewards();
  } catch (_syncErr) {
    syncResult = null;
  }
  var enabled = userExtensionEnabled(embedUser, profileUser, syncResult);
  var installId = 'hc-offers-ext-install';
  panelEl.innerHTML =
    '<div class="hc-browser-extension hc-browser-extension--inline">' +
    '<div class="hc-be-body">' +
    buildExtensionHeaderHtml({ beforeStepsHtml: PointsPerDollarBanner({ attached: true }) }) +
    buildExtensionContentHtml(enabled, installId) +
    '</div></div>';
  bindExtensionInstallButton(document.getElementById(installId));
  var popularEl = panelEl.querySelector('.hc-be-popular');
  bindPopularOffers(popularEl);
  populatePopularOffers(popularEl);
}

var SAFARI_POINTS_AWARDED_KEY = 'hc_setup_points_awarded_safariExtension';

function resolveSafariRewardPoints(result) {
  if (result && result.awarded && Number(result.points) > 0) {
    return Number(result.points);
  }
  var fromResult =
    Number(
      (result && result.rewards && (result.rewards.safari_extension != null
        ? result.rewards.safari_extension
        : result.rewards.safariExtension)) ||
        0
    ) || 0;
  if (fromResult > 0) return fromResult;
  return Number(getSetupRewardPoints().safariExtension) || 0;
}

function openExtensionDownloadUrl() {
  try {
    postToNative('homecrowd:open-url', { url: EXTENSION_URL });
  } catch (_e) {}
  var child = null;
  try {
    child = window.open(EXTENSION_URL, '_blank', 'noopener,noreferrer');
    if (child) {
      try {
        child.opener = null;
      } catch (_op) {}
    }
  } catch (_wo) {}
  if (!child && window.top && window.top !== window) {
    try {
      child = window.top.open(EXTENSION_URL, '_blank', 'noopener,noreferrer');
      if (child) {
        try {
          child.opener = null;
        } catch (_op2) {}
      }
    } catch (_wt) {}
  }
  if (!child) {
    var a = document.createElement('a');
    a.href = EXTENSION_URL;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

function renderSafariSuccess(container, earnedPoints) {
  var toastApi = null;
  container.innerHTML =
    '<div class="hc-safari-on hc-safari-on--success">' +
    '<div class="hc-safari-on-success">' +
    '<div class="hc-safari-on-success-toast" id="hc-safari-on-toast"></div>' +
    '<div class="hc-safari-on-success-content">' +
    '<img data-hc-ph="none" src="' +
    escapeAttr(hcIconUrl) +
    '" alt="" class="hc-safari-on-success-logo" data-safari-success-logo />' +
    '<h1 class="hc-safari-on-success-title" data-safari-success-title>You\'re<br>Earning on<br>Safari</h1>' +
    '<p class="hc-safari-on-success-subtitle" data-safari-success-subtitle>' +
    'Your eligible everyday purchases will now earn points for your school.' +
    '</p>' +
    '</div>' +
    '<div class="hc-safari-on-success-actions" data-safari-success-actions>' +
    '<button type="button" class="hc-safari-on-cta" id="hc-safari-on-home">Go to Dashboard</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  var toastWrap = container.querySelector('#hc-safari-on-toast');
  if (earnedPoints && toastWrap) {
    toastApi = showPointsEarnedToast(toastWrap, {
      points: earnedPoints,
      duration: 10000,
      onHide: function () {
        toastApi = null;
      },
    });
  }

  var homeBtn = container.querySelector('#hc-safari-on-home');
  if (homeBtn) {
    homeBtn.addEventListener('click', function () {
      navigate('/home');
    });
  }

  return function cleanup() {
    if (toastApi && typeof toastApi.hide === 'function') toastApi.hide();
  };
}

function renderSafariPrompt(container, onContinue) {
  container.innerHTML =
    '<div class="hc-safari-on hc-safari-on--prompt">' +
    '<div class="hc-safari-on-bg" style="background-image:url(' +
    escapeAttr(safariBgUrl) +
    ')"></div>' +
    '<div class="hc-safari-on-inner">' +
    '<div class="hc-safari-on-nav">' +
    '<button type="button" class="hc-safari-on-back" id="hc-safari-on-back" aria-label="Back">' +
    chevronLeftSvg +
    '</button>' +
    // School programs show their own mark here; the Homecrowd wordmark is the
    // fallback when no brand config came back.
    (hasCustomHeaderLogo()
      ? '<img data-hc-ph="school" src="' +
        escapeAttr(getHeaderLogoUrl()) +
        '" alt="' +
        escapeAttr(getSchoolName() || 'School brand') +
        '" class="hc-safari-on-logo hc-safari-on-logo--brand" />'
      : '<div class="hc-safari-on-logo" role="img" aria-label="Homecrowd"></div>') +
    '<div class="hc-safari-on-nav-spacer" aria-hidden="true"></div>' +
    '</div>' +
    '<div class="hc-safari-on-bottom">' +
    '<div class="hc-safari-on-card">' +
    '<h1 class="hc-safari-on-title">Turn on ' +
    escapeHtml(getProgramName() || 'HomeCrowd') +
    ' in Safari</h1>' +
    '<p class="hc-safari-on-subtitle">' +
    'Earn points for your school when you make qualifying purchases in Safari.' +
    '</p>' +
    '<div class="hc-safari-on-features">' +
    '<div class="hc-safari-on-feature">' +
    '<img data-hc-ph="none" src="' +
    escapeAttr(presentIconUrl) +
    '" alt="" class="hc-safari-on-feature-icon" width="28" height="28" />' +
    '<div class="hc-safari-on-feature-text">' +
    '<div class="hc-safari-on-feature-title">Earn in the background</div>' +
    '<div class="hc-safari-on-feature-desc">Eligible Safari purchases add points for your school.</div>' +
    '</div></div>' +
    '<div class="hc-safari-on-feature">' +
    '<span class="hc-safari-on-feature-icon-wrap" aria-hidden="true">' +
    bagSvg +
    '</span>' +
    '<div class="hc-safari-on-feature-text">' +
    '<div class="hc-safari-on-feature-title">Shop as usual</div>' +
    '<div class="hc-safari-on-feature-desc">Keep shopping in Safari the way you already do.</div>' +
    '</div></div>' +
    '</div>' +
    '<button type="button" class="hc-safari-on-cta" id="hc-safari-on-continue">Continue</button>' +
    '</div></div></div></div>';

  var backBtn = container.querySelector('#hc-safari-on-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      navigate('/profile');
    });
  }

  var continueBtn = container.querySelector('#hc-safari-on-continue');
  if (continueBtn) {
    continueBtn.addEventListener('click', function () {
      openExtensionDownloadUrl();
      if (typeof onContinue === 'function') onContinue();
    });
  }
}

async function maybeClaimSafariReward() {
  var awardedPoints = null;
  try {
    var already = null;
    try {
      already = localStorage.getItem(SAFARI_POINTS_AWARDED_KEY);
    } catch (_ls) {}
    if (already === '1') return null;

    try {
      localStorage.setItem(SAFARI_POINTS_AWARDED_KEY, 'pending');
    } catch (_ls2) {}

    var result = await claimSetupTaskReward('safariExtension');
    var points = resolveSafariRewardPoints(result);
    if (result && (result.awarded || result.already_claimed || result.alreadyClaimed)) {
      try {
        localStorage.setItem(SAFARI_POINTS_AWARDED_KEY, '1');
      } catch (_ls3) {}
      if (points > 0) awardedPoints = points;
    } else {
      try {
        localStorage.removeItem(SAFARI_POINTS_AWARDED_KEY);
      } catch (_ls4) {}
    }
  } catch (_claimErr) {
    try {
      localStorage.removeItem(SAFARI_POINTS_AWARDED_KEY);
    } catch (_ls5) {}
  }
  return awardedPoints;
}

async function checkExtensionConnected() {
  var embedUser = null;
  try {
    embedUser = await api.fetchCurrentUser();
  } catch (_e) {
    embedUser = null;
  }

  try {
    embedUser = (await syncExtensionEnabledFromNative(embedUser)) || embedUser;
  } catch (_extSync) {}

  if (!extensionFlagTrue(embedUser)) {
    try {
      var nativeEnabled = await requestNativeExtensionEnabled();
      if (nativeEnabled === true && embedUser) {
        try {
          await api.updateUserProfile({ is_extension_enabled: true });
        } catch (_upd) {}
        embedUser = markUserExtensionEnabled(embedUser);
      }
    } catch (_native) {}
  }

  var profileUser = null;
  try {
    profileUser = await api.getUserProfile();
  } catch (_e2) {
    profileUser = null;
  }

  var syncResult = null;
  try {
    syncResult = await syncSetupTaskRewards();
  } catch (_syncErr) {
    syncResult = null;
  }

  return {
    enabled: userExtensionEnabled(embedUser, profileUser, syncResult),
    embedUser: embedUser,
    profileUser: profileUser,
    syncResult: syncResult,
  };
}

var activeSafariScreenCleanup = null;

export function renderBrowserExtension(container) {
  if (typeof activeSafariScreenCleanup === 'function') {
    try {
      activeSafariScreenCleanup();
    } catch (_e) {}
    activeSafariScreenCleanup = null;
  }
  container.innerHTML = LoadingSpinner({ text: 'Loading...' });
  Promise.resolve(loadBrowserExtension(container)).then(function (cleanup) {
    if (typeof cleanup === 'function') {
      activeSafariScreenCleanup = cleanup;
    }
  });
}

async function loadBrowserExtension(container) {
  var shownSuccess = false;
  var successCleanup = null;
  var pollTimer = 0;
  var watching = false;
  var claimInFlight = false;
  var disposed = false;
  var unsubscribers = [];

  function cleanupWatchers() {
    disposed = true;
    watching = false;
    window.clearTimeout(pollTimer);
    pollTimer = 0;
    unsubscribers.forEach(function (fn) {
      try {
        fn();
      } catch (_e) {}
    });
    unsubscribers = [];
    if (typeof successCleanup === 'function') {
      successCleanup();
      successCleanup = null;
    }
  }

  async function showSuccessIfNeeded() {
    if (disposed || shownSuccess || !container.isConnected) return false;
    if (claimInFlight) return false;
    claimInFlight = true;
    try {
      var status = await checkExtensionConnected();
      if (disposed || !container.isConnected) return false;
      if (!status.enabled) return false;

      shownSuccess = true;
      watching = false;
      window.clearTimeout(pollTimer);
      var points = await maybeClaimSafariReward();
      if (disposed || !container.isConnected) return false;
      successCleanup = renderSafariSuccess(container, points);
      return true;
    } finally {
      claimInFlight = false;
    }
  }

  function schedulePoll(delayMs) {
    window.clearTimeout(pollTimer);
    if (disposed || shownSuccess || !watching) return;
    pollTimer = window.setTimeout(async function () {
      if (disposed || shownSuccess || !watching) return;
      var showed = await showSuccessIfNeeded();
      if (!showed && watching && !disposed) {
        schedulePoll(2500);
      }
    }, delayMs);
  }

  function startWatching(aggressive) {
    if (shownSuccess || disposed) return;
    watching = true;
    schedulePoll(aggressive ? 800 : 2000);
  }

  function onVisibility() {
    if (disposed || shownSuccess) return;
    if (document.visibilityState === 'visible') {
      showSuccessIfNeeded().then(function (showed) {
        if (!showed) startWatching(true);
      });
    }
  }

  function onWindowFocus() {
    if (disposed || shownSuccess) return;
    showSuccessIfNeeded().then(function (showed) {
      if (!showed) startWatching(true);
    });
  }

  function onPageshow() {
    if (disposed || shownSuccess) return;
    showSuccessIfNeeded();
  }

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onWindowFocus);
  window.addEventListener('pageshow', onPageshow);
  unsubscribers.push(function () {
    document.removeEventListener('visibilitychange', onVisibility);
  });
  unsubscribers.push(function () {
    window.removeEventListener('focus', onWindowFocus);
  });
  unsubscribers.push(function () {
    window.removeEventListener('pageshow', onPageshow);
  });

  var stopNative = onNativeMessage('homecrowd:extension-status', function (payload) {
    if (disposed || shownSuccess) return;
    var enabled =
      payload === true ||
      (payload &&
        (payload.enabled === true ||
          payload.isEnabled === true ||
          payload.is_extension_enabled === true));
    if (!enabled) return;
    showSuccessIfNeeded();
  });
  if (typeof stopNative === 'function') {
    unsubscribers.push(stopNative);
  }

  container.addEventListener(
    'hc:teardown',
    function () {
      cleanupWatchers();
    },
    { once: true }
  );

  var initial = await checkExtensionConnected();
  if (!container.isConnected) {
    cleanupWatchers();
    return;
  }

  if (initial.enabled) {
    shownSuccess = true;
    var points = await maybeClaimSafariReward();
    if (!container.isConnected) {
      cleanupWatchers();
      return;
    }
    successCleanup = renderSafariSuccess(container, points);
    return;
  }

  renderSafariPrompt(container, function () {
    startWatching(true);
  });
  startWatching(false);

  return cleanupWatchers;
}
