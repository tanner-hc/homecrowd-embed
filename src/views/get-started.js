import { navigate } from '../router.js';
import headerUrl from '../assets/header.png';
import cardScreenSvg from '../assets/signIn_flow/card_screen.svg?raw';
import CurvedLogoCarouselHtml, {
  mountCurvedLogoCarousel,
} from '../base-components/CurvedLogoCarousel.js';
import { escapeAttr, escapeHtml } from '../base-components/html.js';
import {
  darkenHex,
  getEmbedSchoolId,
  getSchoolColor,
  getSchoolName,
  getWelcomeScreenImageUrl,
  hasSchoolBrand,
} from '../brand.js';

var CARD_SCREEN_PRIMARY = '#003DA5';
var CARD_SCREEN_DARK = '#052C6F';
var CARD_SCREEN_DARKEN = 0.32;

function readSchoolIdFromUrl() {
  var params = new URLSearchParams(window.location.search);
  return String(
    params.get('schoolId') || params.get('schoolID') || params.get('school_id') || '',
  )
    .trim()
    .replace(/^\/+|\/+$/g, '');
}

function tintCardScreenSvg(svg, primaryHex) {
  var primary = String(primaryHex || '').trim();
  if (!primary) return svg;
  var dark = darkenHex(primary, CARD_SCREEN_DARKEN) || primary;
  return svg
    .split(CARD_SCREEN_PRIMARY)
    .join(primary)
    .split(CARD_SCREEN_PRIMARY.toLowerCase())
    .join(primary)
    .split(CARD_SCREEN_DARK)
    .join(dark)
    .split(CARD_SCREEN_DARK.toLowerCase())
    .join(dark);
}

export function renderGetStarted(container) {
  var schoolMode = hasSchoolBrand() || !!getEmbedSchoolId() || !!readSchoolIdFromUrl();
  var welcomeImageUrl = getWelcomeScreenImageUrl();
  var schoolColor = schoolMode ? getSchoolColor() : '';
  var schoolName = schoolMode ? getSchoolName() : '';
  var brandSchool = schoolName ? String(schoolName).trim().toUpperCase() : '';
  var rootClass = schoolMode ? 'hc-get-started hc-get-started--school' : 'hc-get-started';
  var rootStyle = schoolColor
    ? ' style="--hc-get-started-primary: ' + escapeAttr(schoolColor) + ';"'
    : '';
  var phoneSvg = tintCardScreenSvg(cardScreenSvg, schoolColor);

  container.innerHTML =
    '<div class="' +
    rootClass +
    '"' +
    rootStyle +
    '>' +
    '<div class="hc-get-started-top">' +
    '<img src="' +
    escapeAttr(headerUrl) +
    '" alt="Homecrowd" class="hc-get-started-logo" />' +
    '<h1 class="hc-get-started-headline">Turn everyday spending<br />into team support</h1>' +
    '<p class="hc-get-started-subtitle">No extra cost. No donations. Just the purchases<br />you already make.</p>' +
    '</div>' +
    (schoolMode
      ? '<div class="hc-get-started-carousel-spacer" aria-hidden="true"></div>'
      : CurvedLogoCarouselHtml()) +
    '<div class="hc-get-started-hero">' +
    '<div class="hc-get-started-phone">' +
    '<div class="hc-get-started-hero-img" aria-hidden="true">' +
    phoneSvg +
    '</div>' +
    (welcomeImageUrl
      ? '<img src="' +
        escapeAttr(welcomeImageUrl) +
        '" alt="" class="hc-get-started-welcome-img" />'
      : '') +
    '<div class="hc-get-started-card-brand" aria-hidden="true">' +
    (brandSchool
      ? '<div class="hc-get-started-card-school">' + escapeHtml(brandSchool) + '</div>'
      : '') +
    '<div class="hc-get-started-card-homecrowd">HOMECROWD</div>' +
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
  if (schoolMode) {
    var spacer = container.querySelector('.hc-get-started-carousel-spacer');
    if (spacer) {
      function syncSpacerHeight() {
        var screenWidth = spacer.clientWidth || window.innerWidth || 390;
        var logoSize = 78;
        var radius = screenWidth * 0.95;
        var dip = radius * (1 - Math.cos(0.78));
        spacer.style.height = 8 + logoSize + dip + 8 + 'px';
      }
      syncSpacerHeight();
      window.addEventListener('resize', syncSpacerHeight);
      destroyCarousel = function () {
        window.removeEventListener('resize', syncSpacerHeight);
      };
    }
  } else {
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
