import { escapeAttr, escapeHtml } from '../../base-components/html.js';
import closeSvg from '../../assets/icons/close-x.svg?raw';

/**
 * The "Earn as you shop" intro card at the top of the Shop screen (Figma
 * 1421:9134).
 *
 * Dismissing it only removes the node — there is no persistence, so it is back
 * on the next load. That is deliberate: it explains what the screen is for
 * rather than announcing something new, so it should keep greeting people who
 * have not linked a card yet.
 *
 * @param {{ logos?: string[] }} props up to three store marks for the cluster
 */
export function buildShopEarnCardHtml(props) {
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

export default { buildShopEarnCardHtml, bindShopEarnCard };
