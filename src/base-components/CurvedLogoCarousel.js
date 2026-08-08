import boiseUrl from '../assets/signIn_flow/boise.png';
import utahUrl from '../assets/signIn_flow/utah.png';
import birdUrl from '../assets/signIn_flow/bird.png';
import cincinattiUrl from '../assets/signIn_flow/cincinatti.png';
import wvuUrl from '../assets/signIn_flow/wvu.png';

var TEAM_LOGOS = [boiseUrl, utahUrl, birdUrl, cincinattiUrl, wvuUrl];
var LOOP_LOGOS = TEAM_LOGOS.concat(TEAM_LOGOS);
var LOGO_COUNT = LOOP_LOGOS.length;
var STEP = 1 / LOGO_COUNT;
var STEP_MS = 1600;
var TRANSITION_MS = 700;
var MAX_ANGLE = 0.78;
var GAP = 1.7;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function layoutLogos(root, progress) {
  var screenWidth = root.clientWidth || window.innerWidth || 390;
  var logoSize = 78;
  var radius = screenWidth * 0.95;
  var dip = radius * (1 - Math.cos(MAX_ANGLE));
  var topPad = 8;
  var areaHeight = topPad + logoSize + dip + 8;
  var cx = screenWidth / 2;
  var angleSpan = 2 * MAX_ANGLE * GAP;

  root.style.height = areaHeight + 'px';

  var items = root.querySelectorAll('.hc-curved-logo');
  for (var i = 0; i < items.length; i += 1) {
    var t = (i / LOGO_COUNT + progress) % 1;
    var angle = (t - 0.5) * angleSpan;
    var absAngle = Math.abs(angle);
    var depth = Math.cos(Math.min(absAngle, MAX_ANGLE));
    var edgeFade = Math.max(0, 1 - absAngle / (MAX_ANGLE * 1.15));
    var itemScale = 0.58 + 0.42 * Math.cos(angle);
    var size = logoSize * Math.max(0.45, itemScale);
    var x = cx + radius * Math.sin(angle) - size / 2;
    var arcY = topPad + logoSize / 2 + radius * (1 - Math.cos(angle));
    var y = arcY - size / 2;
    var edgeBlur = Math.min(
      1,
      Math.max(0, (absAngle - MAX_ANGLE * 0.25) / (MAX_ANGLE * 0.75))
    );
    var blurPx = Math.round(edgeBlur * edgeBlur * 14);

    var el = items[i];
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.opacity = String(0.25 + 0.75 * edgeFade);
    el.style.zIndex = String(Math.round(depth * 100));
    el.style.filter = blurPx > 0 ? 'blur(' + blurPx + 'px)' : 'none';
  }
}

export function mountCurvedLogoCarousel(container) {
  if (!container) return function () {};

  var html = '';
  for (var i = 0; i < LOOP_LOGOS.length; i += 1) {
    html +=
      '<img class="hc-curved-logo" src="' +
      LOOP_LOGOS[i] +
      '" alt="" draggable="false" />';
  }
  container.innerHTML = html;

  var progress = 0;
  var stepIndex = 0;
  var rafId = 0;
  var intervalId = 0;
  var animStart = 0;
  var animFrom = 0;
  var animTo = 0;
  var animating = false;

  function paint(p) {
    layoutLogos(container, p);
  }

  function tickFrame(now) {
    if (!animating) return;
    var elapsed = now - animStart;
    var t = Math.min(1, elapsed / TRANSITION_MS);
    progress = animFrom + (animTo - animFrom) * easeOutCubic(t);
    paint(progress);
    if (t < 1) {
      rafId = requestAnimationFrame(tickFrame);
      return;
    }
    animating = false;
    if (animTo === 1) {
      progress = 0;
      paint(progress);
    }
  }

  function advance() {
    animFrom = stepIndex * STEP;
    stepIndex = (stepIndex + 1) % LOGO_COUNT;
    animTo = stepIndex === 0 ? 1 : stepIndex * STEP;
    progress = animFrom;
    animStart = performance.now();
    animating = true;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tickFrame);
  }

  paint(progress);

  function onResize() {
    paint(progress);
  }
  window.addEventListener('resize', onResize);

  intervalId = window.setInterval(advance, STEP_MS);

  return function destroy() {
    window.clearInterval(intervalId);
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    container.innerHTML = '';
  };
}

export default function CurvedLogoCarouselHtml() {
  return '<div class="hc-curved-logo-carousel" id="hc-curved-logo-carousel"></div>';
}
