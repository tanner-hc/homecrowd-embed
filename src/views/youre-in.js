import lottie from 'lottie-web';
import { navigate } from '../router.js';
import { escapeAttr, escapeHtml } from '../base-components/html.js';
import {
  fetchSetupRewardPoints,
  getDefaultSetupRewardPoints,
  getSetupRewardPoints,
} from '../setup-rewards.js';
import { getPendingSignupSchool } from './find-your-school.js';
import confettiAnimation from '../assets/Confetti_small2.json';
import chevronLeftSvg from '../assets/icons/chevron-left.svg?raw';
import headerUrl from '../assets/header.png';

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

function animateElement(el, from, to, duration, delay, onFrame) {
  if (!el) return function () {};
  var start = null;
  var rafId = 0;
  var cancelled = false;

  function frame(now) {
    if (cancelled) return;
    if (start == null) start = now;
    var elapsed = now - start - delay;
    if (elapsed < 0) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    var t = Math.min(1, elapsed / duration);
    var e = easeOutCubic(t);
    onFrame(el, from, to, e);
    if (t < 1) rafId = requestAnimationFrame(frame);
  }

  onFrame(el, from, to, 0);
  rafId = requestAnimationFrame(frame);
  return function () {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}

function setFadeSlide(el, opacity, translateY) {
  el.style.opacity = String(opacity);
  el.style.transform = 'translateY(' + translateY + 'px)';
}

function setLogo(el, opacity, scale) {
  el.style.opacity = String(opacity);
  el.style.transform = 'scale(' + scale + ')';
}

export function renderYoureIn(container) {
  var school = getPendingSignupSchool() || {};
  var schoolName = school.name || 'your school';
  var logoUrl = school.image ? String(school.image) : '';
  var signupPoints =
    Number(getSetupRewardPoints().profile) || getDefaultSetupRewardPoints().profile || 0;
  var cleanups = [];
  var confettiAnim = null;
  var confettiTimer = 0;

  function subtitleText(points) {
    if (points > 0) {
      return (
        'Create your account and get ' +
        points +
        ' pts, your first points for ' +
        schoolName +
        '.'
      );
    }
    return 'Create your account to start earning points for ' + schoolName + '.';
  }

  function buttonText(points) {
    return points > 0 ? 'Create account +' + points + ' pts' : 'Create account';
  }

  container.innerHTML =
    '<div class="hc-youre-in">' +
    '<div class="hc-youre-in-nav">' +
    '<button type="button" id="hc-youre-in-back" class="hc-youre-in-back" aria-label="Back">' +
    chevronLeftSvg +
    '</button>' +
    '<img src="' +
    escapeAttr(headerUrl) +
    '" alt="Homecrowd" class="hc-youre-in-nav-logo" />' +
    '<span class="hc-youre-in-nav-spacer" aria-hidden="true"></span>' +
    '</div>' +
    '<div class="hc-youre-in-content">' +
    '<div class="hc-youre-in-logo-stage">' +
    '<div class="hc-youre-in-logo-wrap" id="hc-youre-in-logo">' +
    (logoUrl
      ? '<img src="' +
        escapeAttr(logoUrl) +
        '" alt="" class="hc-youre-in-school-logo" />'
      : '<div class="hc-youre-in-school-logo-placeholder" aria-hidden="true"></div>') +
    '</div>' +
    '<div class="hc-youre-in-confetti" id="hc-youre-in-confetti" aria-hidden="true"></div>' +
    '</div>' +
    '<h1 class="hc-youre-in-title" id="hc-youre-in-title">You\'re in!</h1>' +
    '<p class="hc-youre-in-subtitle" id="hc-youre-in-subtitle">' +
    escapeHtml(subtitleText(signupPoints)) +
    '</p>' +
    '</div>' +
    '<div class="hc-youre-in-actions" id="hc-youre-in-actions">' +
    '<button type="button" id="hc-youre-in-cta" class="hc-youre-in-btn">' +
    escapeHtml(buttonText(signupPoints)) +
    '</button>' +
    '</div>' +
    '</div>';

  var backBtn = container.querySelector('#hc-youre-in-back');
  var logoEl = container.querySelector('#hc-youre-in-logo');
  var titleEl = container.querySelector('#hc-youre-in-title');
  var subtitleEl = container.querySelector('#hc-youre-in-subtitle');
  var actionsEl = container.querySelector('#hc-youre-in-actions');
  var ctaBtn = container.querySelector('#hc-youre-in-cta');
  var confettiEl = container.querySelector('#hc-youre-in-confetti');

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate('/find-your-school');
    });
  }

  cleanups.push(
    animateElement(
      logoEl,
      { o: 0, s: LOGO_SCALE_FROM },
      { o: 1, s: 1 },
      LOGO_DURATION_MS,
      0,
      function (el, from, to, e) {
        setLogo(el, from.o + (to.o - from.o) * e, from.s + (to.s - from.s) * e);
      }
    )
  );
  cleanups.push(
    animateElement(
      titleEl,
      { o: 0, y: TITLE_TRANSLATE_FROM },
      { o: 1, y: 0 },
      TITLE_DURATION_MS,
      TITLE_DELAY_MS,
      function (el, from, to, e) {
        setFadeSlide(el, from.o + (to.o - from.o) * e, from.y + (to.y - from.y) * e);
      }
    )
  );
  cleanups.push(
    animateElement(
      subtitleEl,
      { o: 0, y: SUBTITLE_TRANSLATE_FROM },
      { o: 1, y: 0 },
      SUBTITLE_DURATION_MS,
      SUBTITLE_DELAY_MS,
      function (el, from, to, e) {
        setFadeSlide(el, from.o + (to.o - from.o) * e, from.y + (to.y - from.y) * e);
      }
    )
  );
  cleanups.push(
    animateElement(
      actionsEl,
      { o: 0, y: BUTTON_TRANSLATE_FROM },
      { o: 1, y: 0 },
      BUTTON_DURATION_MS,
      BUTTON_DELAY_MS,
      function (el, from, to, e) {
        setFadeSlide(el, from.o + (to.o - from.o) * e, from.y + (to.y - from.y) * e);
      }
    )
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

  fetchSetupRewardPoints().then(function (rewards) {
    var points = Number(rewards && rewards.profile) || 0;
    if (subtitleEl) subtitleEl.textContent = subtitleText(points);
    if (ctaBtn) ctaBtn.textContent = buttonText(points);
  });

  if (ctaBtn) {
    ctaBtn.addEventListener('click', function () {
      navigate('/create-account');
    });
  }

  return function cleanup() {
    window.clearTimeout(confettiTimer);
    cleanups.forEach(function (fn) {
      if (typeof fn === 'function') fn();
    });
    if (confettiAnim) {
      confettiAnim.destroy();
      confettiAnim = null;
    }
  };
}
