import { navigate } from '../router.js';
import chevronLeftSvg from '../assets/icons/chevron-left.svg?raw';
import cardFilledSvg from '../assets/icons/card-filled.svg?raw';
import bagSvg from '../assets/icons/bag.svg?raw';
import starSvg from '../assets/icons/star.svg?raw';
import headerUrl from '../assets/header.png';

var STEPS = [
  {
    key: 'link',
    icon: 'card',
    title: 'You link your card',
    description: 'No charge, no fees. Your card<br>number is never stored.',
  },
  {
    key: 'shop',
    icon: 'bag',
    title: 'You shop like you always do',
    description: 'Pay as usual at participating stores.<br>Nothing extra to do.',
  },
  {
    key: 'store',
    icon: 'store',
    title: 'The store gives back',
    description: "Stores share a small part of each<br>sale. That's what funds everything.",
  },
  {
    key: 'earn',
    icon: 'star',
    title: 'You get points, your school gets support',
    description: 'Every qualifying purchase pays<br>both of you.',
  },
];

var RAIL_WIDTH = 29;
var RAIL_HEIGHT = 306;
var ICON_SIZE = 16;
var ICON_GAP = 66;
var RAIL_PAD_V = (RAIL_HEIGHT - ICON_SIZE * 4 - ICON_GAP * 3) / 2;
var STEP_STRIDE = ICON_SIZE + ICON_GAP;

var TITLE_DELAY_MS = 0;
var TITLE_DURATION_MS = 700;
var TITLE_TRANSLATE_FROM = 10;

var SUBTITLE_DELAY_MS = 220;
var SUBTITLE_DURATION_MS = 650;
var SUBTITLE_TRANSLATE_FROM = 8;

var BUTTON_DELAY_MS = 160;
var BUTTON_DURATION_MS = 700;
var BUTTON_TRANSLATE_FROM = 12;

var STEP_START_DELAY_MS = 550;
var STEP_STAGGER_MS = 750;
var STEP_DURATION_MS = 650;
var STEP_TRANSLATE_FROM = 10;

var RAIL_GROW_DURATION_MS = 650;

var STORE_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path fill="currentColor" d="M64 160v288a32 32 0 0 0 32 32h96V320h128v160h96a32 32 0 0 0 32-32V160z"/>' +
  '<path fill="currentColor" d="M480 80H32a16 16 0 0 0-12.44 26.16L64 160h384l44.44-53.84A16 16 0 0 0 480 80z"/>' +
  '</svg>';

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function railHeightForCount(count) {
  if (count <= 0) return 0;
  return RAIL_PAD_V * 2 + ICON_SIZE * count + ICON_GAP * Math.max(0, count - 1);
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

function stepIconHtml(type) {
  if (type === 'card') return cardFilledSvg;
  if (type === 'bag') return bagSvg;
  if (type === 'store') return STORE_ICON_SVG;
  return starSvg;
}

function parsePreferredCardType(query) {
  var params = new URLSearchParams(query || '');
  var type = String(params.get('type') || params.get('preferredCardType') || '').trim();
  return type || null;
}

/**
 * @param {HTMLElement} container
 * @param {{ query?: string }} [opts]
 */
export function renderLinkCardIntro(container, opts) {
  opts = opts || {};
  var preferredCardType = parsePreferredCardType(opts.query);
  var cleanups = [];

  var iconsHtml = STEPS.map(function (step, index) {
    var spaced = index < STEPS.length - 1 ? ' hc-lci-icon-slot--spaced' : '';
    return (
      '<div class="hc-lci-icon-slot' +
      spaced +
      '">' +
      '<span class="hc-lci-icon">' +
      stepIconHtml(step.icon) +
      '</span></div>'
    );
  }).join('');

  var stepsHtml = STEPS.map(function (step, index) {
    var spaced = index < STEPS.length - 1 ? ' hc-lci-step--spaced' : '';
    return (
      '<div class="hc-lci-step' +
      spaced +
      '" data-lci-step="' +
      index +
      '">' +
      '<div class="hc-lci-step-title">' +
      step.title +
      '</div>' +
      '<div class="hc-lci-step-desc">' +
      step.description +
      '</div></div>'
    );
  }).join('');

  container.innerHTML =
    '<div class="hc-lci-page">' +
    '<div class="hc-lci-nav">' +
    '<button type="button" class="hc-lci-back" id="hc-lci-back" aria-label="Back">' +
    chevronLeftSvg +
    '</button>' +
    '<img src="' +
    headerUrl +
    '" alt="HomeCrowd" class="hc-lci-logo" />' +
    '<div class="hc-lci-nav-spacer" aria-hidden="true"></div>' +
    '</div>' +
    '<div class="hc-lci-scroll">' +
    '<div class="hc-lci-scroll-inner">' +
    '<h1 class="hc-lci-title" data-lci-title>This never costs<br>you anything</h1>' +
    '<p class="hc-lci-subtitle" data-lci-subtitle>The stores fund the points.<br>Here\'s the whole idea:</p>' +
    '<div class="hc-lci-steps-row">' +
    '<div class="hc-lci-rail" data-lci-rail>' +
    iconsHtml +
    '</div>' +
    '<div class="hc-lci-steps-text">' +
    stepsHtml +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="hc-lci-footer" data-lci-footer>' +
    '<button type="button" class="hc-lci-cta" id="hc-lci-cta">Link Card</button>' +
    '</div>' +
    '</div>';

  var titleEl = container.querySelector('[data-lci-title]');
  var subtitleEl = container.querySelector('[data-lci-subtitle]');
  var footerEl = container.querySelector('[data-lci-footer]');
  var railEl = container.querySelector('[data-lci-rail]');
  var stepEls = container.querySelectorAll('[data-lci-step]');

  setFadeSlide(titleEl, 0, TITLE_TRANSLATE_FROM);
  setFadeSlide(subtitleEl, 0, SUBTITLE_TRANSLATE_FROM);
  setFadeSlide(footerEl, 0, BUTTON_TRANSLATE_FROM);
  stepEls.forEach(function (el) {
    setFadeSlide(el, 0, STEP_TRANSLATE_FROM);
  });
  if (railEl) {
    railEl.style.height = '0px';
    railEl.style.opacity = '0';
  }

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
      setFadeSlide(footerEl, p, BUTTON_TRANSLATE_FROM * (1 - p));
    })
  );

  STEPS.forEach(function (_, index) {
    var delay = STEP_START_DELAY_MS + index * STEP_STAGGER_MS;
    cleanups.push(
      animateValue(0, 1, STEP_DURATION_MS, delay, function (p) {
        setFadeSlide(stepEls[index], p, STEP_TRANSLATE_FROM * (1 - p));
      })
    );
  });

  var holdMs = Math.max(0, STEP_STAGGER_MS - RAIL_GROW_DURATION_MS);
  var railHeights = [0, 1, 2, 3, 4].map(railHeightForCount);
  for (var ri = 0; ri < 4; ri++) {
    (function (fromH, toH, delay) {
      cleanups.push(
        animateValue(fromH, toH, RAIL_GROW_DURATION_MS, delay, function (h) {
          if (!railEl) return;
          railEl.style.height = h + 'px';
          railEl.style.opacity = h > 0 ? '1' : '0';
        })
      );
    })(
      railHeights[ri],
      railHeights[ri + 1],
      STEP_START_DELAY_MS + ri * (RAIL_GROW_DURATION_MS + holdMs)
    );
  }

  var backBtn = container.querySelector('#hc-lci-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      navigate('/home');
    });
  }

  var cta = container.querySelector('#hc-lci-cta');
  if (cta) {
    cta.addEventListener('click', function () {
      var href = '/cards/link';
      if (preferredCardType) {
        href += '?type=' + encodeURIComponent(preferredCardType);
      }
      navigate(href);
    });
  }

  return function cleanup() {
    cleanups.forEach(function (fn) {
      try {
        fn();
      } catch (_e) {}
    });
  };
}
