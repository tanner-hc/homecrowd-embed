import * as api from '../api.js';
import { navigate } from '../router.js';
import { postToNative } from '../bridge.js';
import NavHeader from '../base-components/NavHeader.js';
import ScreenTitle from '../base-components/ScreenTitle.js';
import MainButton from '../base-components/MainButton.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import PointsPerDollarBanner from '../base-components/PointsPerDollarBanner.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { showError } from '../base-components/toastApi.js';
import extensionBodyImg from '../assets/images/extension-body.png';
import safariThinUrl from '../assets/icons/safari-thin.png';
import offerThinUrl from '../assets/icons/offer-thin.png';
import safariIconRaw from '../assets/icons/safari.svg?raw';

var EXTENSION_URL = 'https://app.gethomecrowd.com/extension-download/';

function extensionFlagTrue(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.is_extension_enabled === true) return true;
  if (obj.isExtensionEnabled === true) return true;
  return false;
}

function extensionOnFromTier(user) {
  if (!user || typeof user !== 'object') return false;
  var t =
    user.currentTier != null
      ? user.currentTier
      : user.current_tier != null
        ? user.current_tier
        : null;
  if (!t || typeof t !== 'object') return false;
  var o = t.onboarding_status || t.onboardingStatus;
  if (!o || typeof o !== 'object') return false;
  return !!(o.extension_installed || o.extensionInstalled);
}

function userExtensionEnabled(embedUser, profileUser) {
  if (extensionFlagTrue(embedUser)) return true;
  if (extensionFlagTrue(profileUser)) return true;
  if (extensionOnFromTier(embedUser)) return true;
  return false;
}

function buildExtensionHeaderHtml(opts) {
  opts = opts || {};
  var puzzleSvg =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M14.5 3a1.5 1.5 0 0 0-1.5 1.5V6H8.75A1.75 1.75 0 0 0 7 7.75V11H5.5a1.5 1.5 0 1 0 0 3H7v3.25C7 18.216 7.784 19 8.75 19H12v-1.5a1.5 1.5 0 1 1 3 0V19h3.25A1.75 1.75 0 0 0 20 17.25V13h-1.5a1.5 1.5 0 1 1 0-3H20V7.75A1.75 1.75 0 0 0 18.25 6H16V4.5A1.5 1.5 0 0 0 14.5 3Z" fill="#1d6dff"/>' +
    '</svg>';
  var clockSvg =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9" stroke="#1d6dff" stroke-width="2"/>' +
    '<path d="M12 7v5l3 2" stroke="#1d6dff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
  var html = '';
  html += ScreenTitle({
    title: 'Safari extension',
    subtitle: 'Offers appear as you browse in Safari',
    className: 'hc-be-header',
  });
  if (opts.afterTitleHtml) {
    html += opts.afterTitleHtml;
  }
  html += '<div class="hc-be-info-card-code">';
  html += '<div class="hc-be-info-item hc-be-info-item--primary">';
  html += '<div class="hc-be-info-icon hc-be-info-icon--puzzle">' + puzzleSvg + '</div>';
  html += '<div class="hc-be-info-text">';
  html += '<div class="hc-be-info-heading">Shop in Safari. Earn automatically.</div>';
  html +=
    '<div class="hc-be-info-body">We&rsquo;ll find and apply offers for you as you browse participating sites in Safari.</div>';
  html += '</div>';
  html += '</div>';
  html += '<div class="hc-be-info-divider" aria-hidden="true"></div>';
  html += '<div class="hc-be-info-item hc-be-info-item--secondary">';
  html += '<div class="hc-be-info-icon hc-be-info-icon--clock">' + clockSvg + '</div>';
  html += '<div class="hc-be-info-text">';
  html +=
    '<div class="hc-be-info-body">Points may take <span class="hc-be-info-emphasis">up to 24 hours</span> to appear.</div>';
  html += '</div>';
  html += '</div>';
  html += '</div>';
  html +=
    '<img class="hc-be-body-image" src="' +
    extensionBodyImg +
    '" alt="Find offers. Earn points. Offers show up automatically as you browse in Safari." />';
  var compassSvg =
    '<img src="' + safariThinUrl + '" alt="" class="hc-be-step-img hc-be-step-img--safari" />';
  var tagSvg =
    '<img src="' + offerThinUrl + '" alt="" class="hc-be-step-img" />';
  var trophySvg =
    '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M9 4h14v6a7 7 0 0 1-14 0V4Z" stroke="#1d6dff" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M9 7H5a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4h1" stroke="#1d6dff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M23 7h4a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4h-1" stroke="#1d6dff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M16 18v5" stroke="#1d6dff" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M11 28h10a1 1 0 0 0 1-1v-2a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v2a1 1 0 0 0 1 1z" stroke="#1d6dff" stroke-width="2" stroke-linejoin="round"/>' +
    '</svg>';
  html += '<div class="hc-be-steps-card">';
  var steps = [
    { svg: compassSvg, num: '1.', title: 'Browse in Safari', body: 'Visit your favorite stores like you normally do.' },
    { svg: tagSvg, num: '2.', title: 'See offers', body: 'We&rsquo;ll notify you when a better offer is available.' },
    { svg: trophySvg, num: '3.', title: 'Earn points', body: 'Complete your purchase and earn automatically.' },
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
    if (logo) {
      html +=
        '<img class="hc-be-popular-logo" src="' +
        escapeAttr(logo) +
        '" alt="' +
        escapeAttr(name) +
        '" />';
    } else {
      html += '<div class="hc-be-popular-logo hc-be-popular-logo--placeholder"></div>';
    }
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
  } catch (_err) {
    if (!rootEl.isConnected) return;
    listEl.innerHTML = '<div class="hc-be-popular-empty">Couldn&rsquo;t load offers.</div>';
  }
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
  var profileUser = null;
  try {
    profileUser = await api.getUserProfile();
  } catch (_e) {
    profileUser = null;
  }
  var enabled = userExtensionEnabled(embedUser, profileUser);
  var installId = 'hc-offers-ext-install';
  panelEl.innerHTML =
    '<div class="hc-browser-extension hc-browser-extension--inline">' +
    '<div class="hc-be-body">' +
    buildExtensionHeaderHtml({ afterTitleHtml: PointsPerDollarBanner({ attached: true }) }) +
    buildExtensionContentHtml(enabled, installId) +
    '</div></div>';
  bindExtensionInstallButton(document.getElementById(installId));
  var popularEl = panelEl.querySelector('.hc-be-popular');
  bindPopularOffers(popularEl);
  populatePopularOffers(popularEl);
}

export function renderBrowserExtension(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading...' });
  loadBrowserExtension(container);
}

async function loadBrowserExtension(container) {
  var embedUser;
  try {
    embedUser = await api.fetchCurrentUser();
  } catch (err) {
    container.innerHTML =
      '<div class="hc-alert-error">' + escapeHtml(err.message || 'Failed to load') + '</div>';
    return;
  }

  var profileUser = null;
  try {
    profileUser = await api.getUserProfile();
  } catch (_e) {
    profileUser = null;
  }

  var enabled = userExtensionEnabled(embedUser, profileUser);
  var html = '';
  html += '<div class="hc-browser-extension">';
  html += '<div class="hc-account-settings-nav">';
  html += NavHeader({
    title: 'Browser Extension',
    backButtonId: 'hc-be-back',
  });
  html += '</div>';
  html += '<div class="hc-be-body">';
  html += buildExtensionHeaderHtml();
  html += buildExtensionContentHtml(enabled, 'hc-be-install');
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  var backBtn = document.getElementById('hc-be-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate('/profile');
    });
  }

  bindExtensionInstallButton(document.getElementById('hc-be-install'));
  var popularEl = container.querySelector('.hc-be-popular');
  bindPopularOffers(popularEl);
  populatePopularOffers(popularEl);
}
