import { navigate } from '../router.js';
import headerUrl from '../assets/header.png';
import previewRewardUrl from '../assets/images/reward.png';
import starSvg from '../assets/icons/star.svg?raw';
import lockSvg from '../assets/icons/lock.svg?raw';
import CurvedLogoCarouselHtml, {
  mountCurvedLogoCarousel,
} from '../base-components/CurvedLogoCarousel.js';
import { buildAppHeaderHtml } from '../base-components/AppHeader.js';
import { escapeAttr, escapeHtml } from '../base-components/html.js';
import {
  getEmbedSchoolId,
  getHeaderLogoUrl,
  getInAppAccentColor,
  getInAppColor,
  getSchoolMarkUrl,
  getSchoolName,
  hasCustomHeaderLogo,
  hasSchoolBrand,
} from '../brand.js';

var IPHONE_STATUS_ICONS =
  '<svg class="hc-get-started-iphone-signal" viewBox="0 0 17 12" aria-hidden="true">' +
  '<rect x="0" y="7.5" width="3" height="4.5" rx="0.6" fill="currentColor"/>' +
  '<rect x="4.5" y="5" width="3" height="7" rx="0.6" fill="currentColor"/>' +
  '<rect x="9" y="2.5" width="3" height="9.5" rx="0.6" fill="currentColor"/>' +
  '<rect x="13.5" y="0" width="3" height="12" rx="0.6" fill="currentColor"/>' +
  '</svg>' +
  '<svg class="hc-get-started-iphone-wifi" viewBox="0 0 16 12" aria-hidden="true">' +
  '<path d="M8 9.6a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7z" fill="currentColor"/>' +
  '<path d="M4.15 7.35a5.45 5.45 0 0 1 7.7 0l-1.2 1.2a3.75 3.75 0 0 0-5.3 0l-1.2-1.2z" fill="currentColor"/>' +
  '<path d="M1.2 4.45a9.6 9.6 0 0 1 13.6 0l-1.25 1.25a7.85 7.85 0 0 0-11.1 0L1.2 4.45z" fill="currentColor"/>' +
  '</svg>' +
  '<svg class="hc-get-started-iphone-battery" viewBox="0 0 27 13" aria-hidden="true">' +
  '<rect x="0.6" y="1.1" width="22.2" height="10.8" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.4"/>' +
  '<rect x="2.2" y="2.7" width="19" height="7.6" rx="1.4" fill="currentColor"/>' +
  '<path d="M23.8 4.6c.9.4 1.5 1.2 1.5 2.1s-.6 1.7-1.5 2.1V4.6z" fill="currentColor" opacity="0.4"/>' +
  '</svg>';

var PREVIEW_POINTS = 1000;
var PREVIEW_MILESTONES = [
  { label: '1,500', at: 22 },
  { label: '5,000', at: 56 },
  { label: '10,000', at: 100 },
];

function readSchoolIdFromUrl() {
  var params = new URLSearchParams(window.location.search);
  return String(
    params.get('schoolId') || params.get('schoolID') || params.get('school_id') || '',
  )
    .trim()
    .replace(/^\/+|\/+$/g, '');
}

function buildPreviewMarkerHtml(milestone, reached) {
  return (
    '<span class="hc-milestones-marker' +
    (reached ? ' hc-milestones-marker--reached' : '') +
    '" style="left:' +
    milestone.at +
    '%">' +
    starSvg +
    '</span>'
  );
}

function buildPreviewScaleHtml(milestone, isLast) {
  return (
    '<span class="hc-milestones-scale-label' +
    (isLast ? ' hc-milestones-scale-label--last' : '') +
    '" style="left:' +
    milestone.at +
    '%">' +
    escapeHtml(milestone.label) +
    '</span>'
  );
}

function buildGetStartedHomePreviewHtml(logoUrl) {
  var markers = '';
  var scale = '';
  var i;
  for (i = 0; i < PREVIEW_MILESTONES.length; i++) {
    markers += buildPreviewMarkerHtml(PREVIEW_MILESTONES[i], i === 0);
    scale += buildPreviewScaleHtml(
      PREVIEW_MILESTONES[i],
      i === PREVIEW_MILESTONES.length - 1,
    );
  }

  return (
    '<div class="hc-get-started-home" aria-hidden="true">' +
    '<div class="hc-get-started-home-inner">' +
    buildAppHeaderHtml({ title: 'Home', points: PREVIEW_POINTS }) +
    '<div class="hc-get-started-home-body">' +
    '<div class="hc-milestones">' +
    '<div class="hc-milestones-top">' +
    '<div class="hc-milestones-head">' +
    '<div class="hc-milestones-head-text">' +
    '<div class="hc-milestones-label">You’ve earned</div>' +
    '<div class="hc-milestones-points-row">' +
    '<span class="hc-milestones-value">1,000</span>' +
    '<span class="hc-milestones-unit">pts</span>' +
    '</div>' +
    '</div>' +
    (logoUrl
      ? '<img data-hc-ph="school" src="' +
        escapeAttr(logoUrl) +
        '" alt="" class="hc-milestones-logo" />'
      : '') +
    '</div>' +
    '<div class="hc-milestones-progress">' +
    '<div class="hc-milestones-track">' +
    '<div class="hc-milestones-fill" style="width:calc((100% - 16px) * 0.22 + 8px)"></div>' +
    '<div class="hc-milestones-markers">' +
    markers +
    '</div>' +
    '</div>' +
    '<div class="hc-milestones-scale">' +
    scale +
    '</div>' +
    '</div>' +
    '<div class="hc-milestones-caption">Each goal you reach unlocks the next reward.</div>' +
    '</div>' +
    '<ul class="hc-milestones-rows">' +
    '<li class="hc-milestones-row hc-milestones-row--unlocked">' +
    '<div class="hc-milestones-thumb">' +
    '<img data-hc-ph="gift" src="' +
    escapeAttr(previewRewardUrl) +
    '" alt="" class="hc-milestones-thumb-img" />' +
    '</div>' +
    '<div class="hc-milestones-row-copy">' +
    '<div class="hc-milestones-row-text">' +
    '<span class="hc-milestones-eyebrow">Next reward</span>' +
    '<span class="hc-milestones-row-title">Athletics Facility Tour</span>' +
    '<span class="hc-milestones-row-points">1,000 / 1,500 pts</span>' +
    '</div>' +
    '<span class="hc-milestones-redeem">Redeem</span>' +
    '</div>' +
    '</li>' +
    '<li class="hc-milestones-row hc-get-started-home-row--locked">' +
    '<div class="hc-milestones-thumb">' +
    '<span class="hc-get-started-home-lock">' +
    lockSvg +
    '</span>' +
    '</div>' +
    '<div class="hc-milestones-row-copy">' +
    '<div class="hc-milestones-row-text">' +
    '<span class="hc-milestones-row-title">Basketball Practice Access</span>' +
    '<span class="hc-milestones-row-points">5,000 pts</span>' +
    '</div>' +
    '</div>' +
    '</li>' +
    '<li class="hc-milestones-row hc-get-started-home-row--locked">' +
    '<div class="hc-milestones-thumb">' +
    '<span class="hc-get-started-home-lock">' +
    lockSvg +
    '</span>' +
    '</div>' +
    '<div class="hc-milestones-row-copy">' +
    '<div class="hc-milestones-row-text">' +
    '<span class="hc-milestones-row-title">Sideline Experience</span>' +
    '<span class="hc-milestones-row-points">10,000 pts</span>' +
    '</div>' +
    '</div>' +
    '</li>' +
    '</ul>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

export function renderGetStarted(container) {
  var schoolMode = hasSchoolBrand() || !!getEmbedSchoolId() || !!readSchoolIdFromUrl();
  var schoolName = schoolMode ? getSchoolName() : '';
  // Branded embeds lead with the school's own program mark; the bundled
  // Homecrowd wordmark is the fallback when no brand config came back.
  var hasProgramLogo = schoolMode && hasCustomHeaderLogo();
  var logoUrl = hasProgramLogo ? getHeaderLogoUrl() : headerUrl;
  var logoAlt = hasProgramLogo ? schoolName || 'School brand' : 'Homecrowd';
  var logoClass = hasProgramLogo
    ? 'hc-get-started-logo hc-get-started-logo--brand'
    : 'hc-get-started-logo';
  var markUrl = getSchoolMarkUrl() || (hasProgramLogo ? getHeaderLogoUrl() : '');
  var inAppColor = getInAppColor();
  var inAppAccent = getInAppAccentColor();
  var rootClass = schoolMode ? 'hc-get-started hc-get-started--school' : 'hc-get-started';
  var inAppStyle =
    ' style="' +
    escapeAttr('--hc-app-primary: ' + inAppColor + '; --hc-app-accent: ' + inAppAccent) +
    ';"';

  container.innerHTML =
    '<div class="' +
    rootClass +
    '"' +
    inAppStyle +
    '>' +
    '<div class="hc-get-started-top">' +
    '<img data-hc-ph="school" src="' +
    escapeAttr(logoUrl) +
    '" alt="' +
    escapeAttr(logoAlt) +
    '" class="' +
    logoClass +
    '" />' +
    '<h1 class="hc-get-started-headline">Turn everyday spending<br />into team support</h1>' +
    '<p class="hc-get-started-subtitle">No extra cost. No donations. Just the purchases<br />you already make.</p>' +
    '</div>' +
    (schoolMode ? '' : CurvedLogoCarouselHtml()) +
    '<div class="hc-get-started-hero">' +
    '<div class="hc-get-started-phone">' +
    '<span class="hc-get-started-iphone-btn hc-get-started-iphone-btn--silent"></span>' +
    '<span class="hc-get-started-iphone-btn hc-get-started-iphone-btn--vol-up"></span>' +
    '<span class="hc-get-started-iphone-btn hc-get-started-iphone-btn--vol-down"></span>' +
    '<span class="hc-get-started-iphone-btn hc-get-started-iphone-btn--power"></span>' +
    '<div class="hc-get-started-iphone-screen">' +
    '<div class="hc-get-started-iphone-status">' +
    '<span class="hc-get-started-iphone-time">9:41</span>' +
    '<span class="hc-get-started-iphone-island"></span>' +
    '<span class="hc-get-started-iphone-icons">' +
    IPHONE_STATUS_ICONS +
    '</span>' +
    '</div>' +
    buildGetStartedHomePreviewHtml(markUrl) +
    '</div>' +
    '<div class="hc-get-started-hero-fade" aria-hidden="true"></div>' +
    '</div>' +
    '</div>' +
    '<div class="hc-get-started-actions">' +
    '<button type="button" id="hc-get-started-primary" class="hc-get-started-btn hc-get-started-btn--primary">Get Started</button>' +
    '<button type="button" id="hc-get-started-login" class="hc-get-started-btn hc-get-started-btn--secondary">Log in</button>' +
    '</div>' +
    '</div>';

  var destroyCarousel = null;
  if (!schoolMode) {
    destroyCarousel = mountCurvedLogoCarousel(
      container.querySelector('#hc-curved-logo-carousel'),
    );
  }

  var primaryBtn = container.querySelector('#hc-get-started-primary');
  var loginBtn = container.querySelector('#hc-get-started-login');

  if (primaryBtn) {
    primaryBtn.addEventListener('click', function () {
      navigate(schoolMode ? '/create-account' : '/find-your-school');
    });
  }
  if (loginBtn) {
    loginBtn.addEventListener('click', function () {
      navigate('/login');
    });
  }

  return function cleanup() {
    if (typeof destroyCarousel === 'function') destroyCarousel();
  };
}
