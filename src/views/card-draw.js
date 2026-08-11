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

  function prefersReducedMotion() {
    return !!(
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
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
      },
      { once: true }
    );
  }

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
