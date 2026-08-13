import { escapeAttr, escapeHtml } from '../../base-components/html.js';
import closeSvg from '../../assets/icons/close-x.svg?raw';

/**
 * How long the card stays away once dismissed. It explains what the screen is
 * for rather than announcing something new, so it comes back — just not on the
 * very next visit.
 */
var DISMISS_WINDOW_MS = 2 * 60 * 60 * 1000;
var DISMISS_KEY = 'hc_shop_earn_dismissed_at';

function readDismissedAt() {
  try {
    var at = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 ? at : 0;
  } catch (_e) {
    // Storage can throw outright in private mode; treat that as never dismissed.
    return 0;
  }
}

function markDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch (_e) {}
}

/**
 * Whether the card is still inside its dismissal window.
 *
 * @param {number} [nowMs]
 */
export function isShopEarnCardHidden(nowMs) {
  var now = nowMs == null ? Date.now() : nowMs;
  var at = readDismissedAt();
  if (!at) return false;
  // A stored timestamp in the future — a clock change, or another device —
  // would otherwise hide the card until that time passes.
  if (at > now) return false;
  return now - at < DISMISS_WINDOW_MS;
}

/**
 * The "Earn as you shop" intro card at the top of the Shop screen (Figma
 * 1421:9134).
 *
 * Returns nothing while the card is inside its dismissal window, so the caller
 * does not have to know about that — the rest of the page closes up on its own
 * because the section below carries the gap as a margin.
 *
 * @param {{ logos?: string[] }} props up to three store marks for the cluster
 */
export function buildShopEarnCardHtml(props) {
  if (isShopEarnCardHidden()) return '';
  props = props || {};
  var logos = (Array.isArray(props.logos) ? props.logos : [])
    .filter(Boolean)
    .slice(0, 3);

  var logosHtml = logos.length
    ? '<div class="hc-shop-earn-logos" aria-hidden="true">' +
      logos
        .map(function (url) {
          return (
            '<span class="hc-shop-earn-logo">' +
            '<img data-hc-ph="store" src="' +
            escapeAttr(String(url)) +
            '" alt="" />' +
            '</span>'
          );
        })
        .join('') +
      '</div>'
    : '';

  return (
    '<div class="hc-shop-earn" data-shop-earn="1">' +
    '<button type="button" class="hc-shop-earn-close" data-shop-earn-close="1" aria-label="Dismiss">' +
    '<span class="hc-shop-earn-close-icon" aria-hidden="true">' +
    closeSvg +
    '</span>' +
    '</button>' +
    logosHtml +
    '<div class="hc-shop-earn-body">' +
    '<div class="hc-shop-earn-text">' +
    '<div class="hc-shop-earn-title">' +
    escapeHtml('Earn as you shop') +
    '</div>' +
    '<div class="hc-shop-earn-sub">' +
    escapeHtml('Pay like you always do, you earn points and support your team!') +
    '</div>' +
    '</div>' +
    '<button type="button" class="hc-shop-earn-cta" data-shop-earn-cta="1">Explore stores</button>' +
    '</div>' +
    '</div>'
  );
}

/**
 * @param {HTMLElement} root any ancestor of the card
 * @param {{ onExplore?: function }} handlers
 */
export function bindShopEarnCard(root, handlers) {
  handlers = handlers || {};
  if (!root) return;
  var card = root.querySelector('[data-shop-earn]');
  if (!card) return;

  var close = card.querySelector('[data-shop-earn-close]');
  if (close) {
    close.addEventListener('click', function () {
      markDismissed();
      card.remove();
    });
  }

  var cta = card.querySelector('[data-shop-earn-cta]');
  if (cta && typeof handlers.onExplore === 'function') {
    cta.addEventListener('click', function () {
      handlers.onExplore();
    });
  }
}

export default { buildShopEarnCardHtml, bindShopEarnCard, isShopEarnCardHidden };
