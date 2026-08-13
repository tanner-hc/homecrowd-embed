import { escapeAttr } from '../../base-components/html.js';
// Not card-draw-card.png: that one is tilted with a drop shadow baked in, built
// for the full-screen draw hero. Flat and upright for this thumbnail, exported
// from Figma 1423:10345 at 4x.
import cardArtUrl from '../../assets/daily-draw-card.png';

/**
 * "Daily Card Draw" entry point at the bottom of the Rewards screen
 * (Figma 1423:10334).
 *
 * The draw itself lives at /card-draw, which owns the once-per-day rule — a
 * repeat call comes back as a normal 200 with already_drawn: true. So this card
 * always offers the draw rather than trying to predict eligibility, and the
 * draw screen says whether today's card is still there.
 */
export function buildDailyCardDrawHtml() {
  return (
    '<div class="hc-daily-draw">' +
    '<div class="hc-daily-draw-row">' +
    '<img data-hc-ph="gift" class="hc-daily-draw-art" src="' +
    escapeAttr(cardArtUrl) +
    '" alt="" />' +
    '<div class="hc-daily-draw-text">' +
    '<div class="hc-daily-draw-title">Daily Card Draw</div>' +
    '<div class="hc-daily-draw-sub">' +
    'Every card has something in it. Points, a boost, sometimes a real prize.' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<button type="button" class="hc-daily-draw-cta" data-daily-draw="1">' +
    'Reveal today&rsquo;s card' +
    '</button>' +
    '</div>'
  );
}

/**
 * @param {HTMLElement} root any ancestor of the card
 * @param {{ onPress?: function }} handlers
 */
export function bindDailyCardDraw(root, handlers) {
  handlers = handlers || {};
  if (!root) return;
  var cta = root.querySelector('[data-daily-draw]');
  if (!cta || typeof handlers.onPress !== 'function') return;
  cta.addEventListener('click', function () {
    handlers.onPress();
  });
}

export default { buildDailyCardDrawHtml, bindDailyCardDraw };
