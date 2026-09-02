import lottie from 'lottie-web';
import { escapeAttr, escapeHtml } from './html.js';
import { showPointsEarnedToast } from './PointsEarnedToast.js';
import { pickSchoolLogoUrl } from '../school-contribution.js';
import * as api from '../api.js';
import hcIconUrl from '../assets/logos/icon.png';
import confettiAnimation from '../assets/Confetti_small2.json';

var LOGO_DURATION_MS = 900;
var LOGO_SCALE_FROM = 0.72;
var TITLE_DELAY_MS = 420;
var TITLE_DURATION_MS = 180;
var TITLE_TRANSLATE_FROM = 10;
var SUBTITLE_DELAY_MS = 540;
var SUBTITLE_DURATION_MS = 160;
var SUBTITLE_TRANSLATE_FROM = 8;
var BUTTON_DELAY_MS = 660;
var BUTTON_DURATION_MS = 180;
var BUTTON_TRANSLATE_FROM = 12;
var CONFETTI_DELAY_MS = 250;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animateValue(from, to, duration, delay, onFrame) {
  var start = null;
  var rafId = 0;
  var cancelled = false;
  var started = false;

  function frame(now) {
    if (cancelled) return;
    if (start == null) start = now;
    var elapsed = now - start - delay;
    if (elapsed < 0) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    if (!started) {
      started = true;
      onFrame(from);
    }
    var t = Math.min(1, elapsed / duration);
    var e = easeOutCubic(t);
    onFrame(from + (to - from) * e);
    if (t < 1) rafId = requestAnimationFrame(frame);
  }

  if (delay <= 0) {
    onFrame(from);
    started = true;
  }
  rafId = requestAnimationFrame(frame);
  return function () {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}

function setFadeSlide(el, opacity, translateY) {
  if (!el) return;
  el.style.opacity = String(opacity);
  el.style.transform = 'translateY(' + translateY + 'px)';
}

function setLogo(el, opacity, scale) {
  if (!el) return;
  el.style.opacity = String(opacity);
  el.style.transform = 'scale(' + scale + ')';
}

function resolveSuccessLogoUrl(options) {
  if (options.logoUrl) return options.logoUrl;
  var schoolLogo = pickSchoolLogoUrl(options.user);
  if (schoolLogo) return schoolLogo;
  return hcIconUrl;
}

/**
 * Shared milestone success screen (card linked / check-in / etc).
 * @param {HTMLElement} container
 * @param {{
 *   title?: string,
 *   subtitle?: string,
 *   points?: number,
 *   primaryLabel?: string,
 *   secondaryLabel?: string,
 *   onPrimary?: function,
 *   onSecondary?: function,
 *   logoUrl?: string,
 *   user?: object,
 * }} options
 * @returns {function} cleanup
 */
export function renderSuccessCelebration(container, options) {
  options = options || {};
  var title = options.title || '';
  var subtitle = options.subtitle || '';
  var points = Number(options.points) || 0;
  var primaryLabel = options.primaryLabel || 'Continue';
  var secondaryLabel = options.secondaryLabel || '';
  var logoUrl = resolveSuccessLogoUrl(options);
  var cancelled = false;
  var cleanups = [];
  var confettiAnim = null;
  var confettiTimer = 0;
  var toastApi = null;

  var secondaryHtml = secondaryLabel
    ? '<button type="button" class="hc-add-card-cta hc-add-card-cta--secondary" data-success-secondary>' +
      escapeHtml(secondaryLabel) +
      '</button>'
    : '';

  container.innerHTML =
    '<div class="hc-add-card-page hc-add-card-page--success">' +
    '<div class="hc-add-card-success">' +
    '<div class="hc-add-card-success-toast" data-success-toast></div>' +
    '<div class="hc-add-card-success-content">' +
    '<div class="hc-add-card-success-logo-stage">' +
    '<div class="hc-add-card-success-logo-wrap" data-success-logo>' +
    '<img data-hc-ph="school" src="' +
    escapeAttr(logoUrl) +
    '" alt="" class="hc-add-card-success-logo" />' +
    '</div>' +
    '<div class="hc-add-card-success-confetti" data-success-confetti aria-hidden="true"></div>' +
    '</div>' +
    '<h1 class="hc-add-card-success-title" data-success-title>' +
    escapeHtml(title) +
    '</h1>' +
    '<p class="hc-add-card-success-subtitle" data-success-subtitle>' +
    escapeHtml(subtitle) +
    '</p>' +
    '</div>' +
    '<div class="hc-add-card-success-actions" data-success-actions>' +
    '<button type="button" class="hc-add-card-cta" data-success-primary>' +
    escapeHtml(primaryLabel) +
    '</button>' +
    secondaryHtml +
    '</div>' +
    '</div>' +
    '</div>';

  var logoEl = container.querySelector('[data-success-logo]');
  var titleEl = container.querySelector('[data-success-title]');
  var subtitleEl = container.querySelector('[data-success-subtitle]');
  var actionsEl = container.querySelector('[data-success-actions]');
  var confettiEl = container.querySelector('[data-success-confetti]');
  var toastWrap = container.querySelector('[data-success-toast]');
  var primaryBtn = container.querySelector('[data-success-primary]');
  var secondaryBtn = container.querySelector('[data-success-secondary]');

  setLogo(logoEl, 0, LOGO_SCALE_FROM);
  setFadeSlide(titleEl, 0, TITLE_TRANSLATE_FROM);
  setFadeSlide(subtitleEl, 0, SUBTITLE_TRANSLATE_FROM);
  setFadeSlide(actionsEl, 0, BUTTON_TRANSLATE_FROM);

  cleanups.push(
    animateValue(0, 1, LOGO_DURATION_MS, 0, function (p) {
      setLogo(logoEl, p, LOGO_SCALE_FROM + (1 - LOGO_SCALE_FROM) * p);
    })
  );
  cleanups.push(
    animateValue(0, 1, TITLE_DURATION_MS, TITLE_DELAY_MS, function (p) {
      setFadeSlide(titleEl, p, TITLE_TRANSLATE_FROM * (1 - p));
    })
  );
  cleanups.push(
    animateValue(0, 1, SUBTITLE_DURATION_MS, SUBTITLE_DELAY_MS, function (p) {
      setFadeSlide(subtitleEl, p, SUBTITLE_TRANSLATE_FROM * (1 - p));
    })
  );
  cleanups.push(
    animateValue(0, 1, BUTTON_DURATION_MS, BUTTON_DELAY_MS, function (p) {
      setFadeSlide(actionsEl, p, BUTTON_TRANSLATE_FROM * (1 - p));
    })
  );

  if (confettiEl) {
    confettiTimer = window.setTimeout(function () {
      confettiAnim = lottie.loadAnimation({
        container: confettiEl,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        animationData: confettiAnimation,
      });
    }, CONFETTI_DELAY_MS);
  }

  if (points > 0 && toastWrap) {
    toastApi = showPointsEarnedToast(toastWrap, {
      points: points,
      duration: 10000,
      onHide: function () {
        toastApi = null;
      },
    });
  }

  if (primaryBtn) {
    primaryBtn.addEventListener('click', function () {
      if (typeof options.onPrimary === 'function') options.onPrimary();
    });
  }
  if (secondaryBtn) {
    secondaryBtn.addEventListener('click', function () {
      if (typeof options.onSecondary === 'function') options.onSecondary();
    });
  }

  if (!options.logoUrl && !pickSchoolLogoUrl(options.user)) {
    api
      .fetchCurrentUser()
      .then(function (user) {
        if (cancelled) return;
        var schoolLogo = pickSchoolLogoUrl(user);
        if (!schoolLogo) return;
        var img = container.querySelector('.hc-add-card-success-logo');
        if (img) img.src = schoolLogo;
      })
      .catch(function () {});
  }

  return function cleanup() {
    cancelled = true;
    window.clearTimeout(confettiTimer);
    cleanups.forEach(function (fn) {
      try {
        fn();
      } catch (_e) {}
    });
    if (confettiAnim) {
      confettiAnim.destroy();
      confettiAnim = null;
    }
    if (toastApi && typeof toastApi.hide === 'function') {
      toastApi.hide();
    }
  };
}

export default { renderSuccessCelebration };
