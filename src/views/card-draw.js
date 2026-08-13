import * as api from '../api.js';
import { navigate } from '../router.js';
import { showError, showSuccess } from '../base-components/toastApi.js';
import { formatNumber } from '../formatNumber.js';
import cardArtUrl from '../assets/card-draw-card.png';
import { escapeAttr } from '../base-components/html.js';

/**
 * Daily Card Draw — Figma 1249:19474.
 *
 * The server owns the award and the once-per-day rule
 * (POST /rewards/card-draw/), so this screen only reflects what comes back —
 * `already_drawn` is a normal response, not an error.
 *
 * The reveal is a 3D flip: the card turns on its Y axis, swelling slightly at
 * the midpoint so it reads as lifting off the page, and the prize face lands
 * face-up with the points scaling in. Figma has no keyframe data for this (the
 * prototype animates frame-to-frame), so the timing here is ours.
 */
export function renderCardDraw(container) {
  var submitting = false;
  var drawn = false;

  container.innerHTML =
    '<div class="hc-card-draw">' +
    '<div class="hc-card-draw-logo" role="img" aria-label="Homecrowd"></div>' +
    '<div class="hc-card-draw-copy">' +
    '<h1 class="hc-card-draw-title">Daily Card Draw</h1>' +
    '<p class="hc-card-draw-sub" data-cd-sub>Come back every day for a prize!</p>' +
    '</div>' +
    '<div class="hc-card-draw-stage">' +
    '<div class="hc-card-draw-card" data-cd-card>' +
    '<div class="hc-card-draw-face hc-card-draw-face--front">' +
    '<img data-hc-ph="gift" class="hc-card-draw-art" src="' +
    escapeAttr(cardArtUrl) +
    '" alt="" />' +
    '</div>' +
    '<div class="hc-card-draw-face hc-card-draw-face--back">' +
    '<div class="hc-card-draw-prize" data-cd-prize>' +
    '<span class="hc-card-draw-prize-value" data-cd-value></span>' +
    '<span class="hc-card-draw-prize-unit">pts</span>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="hc-card-draw-actions">' +
    '<button type="button" class="hc-card-draw-cta" data-cd-draw>Draw Your Card</button>' +
    '<button type="button" class="hc-card-draw-later" data-cd-later>Maybe later</button>' +
    '</div>' +
    '</div>';

  var drawBtn = container.querySelector('[data-cd-draw]');
  var laterBtn = container.querySelector('[data-cd-later]');
  var cardEl = container.querySelector('[data-cd-card]');
  var prizeEl = container.querySelector('[data-cd-prize]');
  var valueEl = container.querySelector('[data-cd-value]');
  var subEl = container.querySelector('[data-cd-sub]');
  var stageEl = container.querySelector('.hc-card-draw-stage');

  function prefersReducedMotion() {
    return !!(
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /**
   * A burst of paper from behind the card as it lands.
   *
   * Built from plain spans rather than a canvas: a couple of dozen nodes for
   * about a second is cheaper than standing up a render loop, and it removes
   * itself afterwards so nothing is left animating on the page. Skipped
   * entirely under reduced motion.
   */
  var CONFETTI_COLORS = ['#00c8ff', '#ffd54a', '#ff7bac', '#7ae582', '#ffffff'];
  var CONFETTI_PIECES = 28;
  var CONFETTI_MS = 1100;

  function burstConfetti() {
    if (!stageEl || prefersReducedMotion()) return;

    var layer = document.createElement('div');
    layer.className = 'hc-card-draw-confetti';
    layer.setAttribute('aria-hidden', 'true');

    for (var i = 0; i < CONFETTI_PIECES; i++) {
      var piece = document.createElement('span');
      piece.className = 'hc-card-draw-confetti-piece';
      // Spread evenly around the card, jittered so it doesn't read as a ring.
      var angle = (i / CONFETTI_PIECES) * Math.PI * 2 + Math.random() * 0.4;
      var distance = 90 + Math.random() * 130;
      piece.style.setProperty('--hc-cf-dx', Math.cos(angle) * distance + 'px');
      // Biased downward at the end of the arc so it falls rather than hangs.
      piece.style.setProperty(
        '--hc-cf-dy',
        Math.sin(angle) * distance + 60 + Math.random() * 60 + 'px'
      );
      piece.style.setProperty('--hc-cf-rot', Math.round(Math.random() * 720 - 360) + 'deg');
      piece.style.animationDelay = Math.round(Math.random() * 120) + 'ms';
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      layer.appendChild(piece);
    }

    stageEl.appendChild(layer);
    window.setTimeout(function () {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }, CONFETTI_MS + 400);
  }

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate('/profile');
  }

  function settle(label) {
    drawn = true;
    drawBtn.disabled = true;
    drawBtn.textContent = label;
    laterBtn.textContent = 'Done';
  }

  /** Show the prize face outright, no flip — the turn already happened today. */
  function showSettledPoints(points) {
    valueEl.textContent = '+' + formatNumber(points);
    cardEl.classList.add('is-revealed');
    prizeEl.classList.add('is-in');
  }

  /** Flip to the prize face, then pop the number in once it lands. */
  function revealPoints(points) {
    valueEl.textContent = '+' + formatNumber(points);

    if (prefersReducedMotion()) {
      cardEl.classList.add('is-revealed');
      prizeEl.classList.add('is-in');
      return;
    }

    cardEl.classList.add('is-flipping');
    cardEl.addEventListener(
      'animationend',
      function () {
        // Hold the flipped transform after the animation is removed, so the
        // face can't snap back if the class is ever cleared.
        cardEl.classList.add('is-revealed');
        prizeEl.classList.add('is-in');
        burstConfetti();
      },
      { once: true }
    );
  }

  // Open in whatever state today is already in, so a card drawn earlier shows
  // turned over with its points rather than inviting a draw that cannot happen.
  // Failure is not worth blocking on — the draw itself is still guarded by the
  // server, so the worst case is the button reporting already-drawn on tap.
  api
    .getCardDrawStatus()
    .then(function (state) {
      if (!state || !container.isConnected) return;
      if (state.disabled) {
        subEl.textContent = 'The card draw is not available right now.';
        settle('Unavailable');
        return;
      }
      if (state.already_drawn) {
        showSettledPoints(Number(state.points_awarded) || 0);
        subEl.textContent = 'You have already drawn today. Come back tomorrow!';
        settle('Come back tomorrow');
      }
    })
    .catch(function () {});

  if (laterBtn) {
    laterBtn.addEventListener('click', goBack);
  }

  if (drawBtn) {
    drawBtn.addEventListener('click', async function () {
      // The server is the real guard; this only stops a double-tap firing two
      // requests before the first resolves.
      if (submitting || drawn) return;
      submitting = true;
      drawBtn.disabled = true;
      drawBtn.textContent = 'Drawing...';

      try {
        var res = await api.drawCard();

        if (res && res.already_drawn) {
          subEl.textContent = 'You have already drawn today. Come back tomorrow!';
          settle('Come back tomorrow');
          return;
        }

        var points = Number(res && res.points_awarded) || 0;
        revealPoints(points);
        subEl.textContent = 'Added to your balance.';
        settle('Come back tomorrow');
        showSuccess('You earned ' + formatNumber(points) + ' points');
      } catch (err) {
        // Leave the button usable so a network blip can be retried.
        submitting = false;
        drawBtn.disabled = false;
        drawBtn.textContent = 'Draw Your Card';
        showError((err && err.message) || "That didn't go through. Please try again.");
        return;
      }

      submitting = false;
    });
  }
}

export default { renderCardDraw };
