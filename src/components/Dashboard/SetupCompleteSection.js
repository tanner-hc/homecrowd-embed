import lottie from 'lottie-web';
import { escapeHtml } from '../../base-components/html.js';
import confettiAnimation from '../../assets/Confetti_small.json';

function formatPoints(points) {
  return (Number(points) || 0).toLocaleString('en-US');
}

export function buildSetupCompleteSectionHtml(points) {
  var pointsLabel = formatPoints(points);
  var body = "You've earned " + pointsLabel + ' pts. From here, just shop as usual.';
  return (
    '<div class="hc-setup-complete">' +
    '<div class="hc-setup-complete-card">' +
    '<div class="hc-setup-complete-confetti" id="hc-setup-complete-confetti" aria-hidden="true"></div>' +
    '<div class="hc-setup-complete-title">Setup complete</div>' +
    '<div class="hc-setup-complete-body">' +
    escapeHtml(body) +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

export function mountSetupCompleteConfetti(container) {
  var el = container && container.querySelector('#hc-setup-complete-confetti');
  if (!el) return function () {};
  var anim = lottie.loadAnimation({
    container: el,
    renderer: 'svg',
    loop: false,
    autoplay: true,
    animationData: confettiAnimation,
  });
  return function () {
    if (anim) anim.destroy();
  };
}

export default { buildSetupCompleteSectionHtml, mountSetupCompleteConfetti };
