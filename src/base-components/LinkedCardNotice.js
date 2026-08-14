import cardFilledSvg from '../assets/icons/card-filled.svg?raw';
import closeXSvg from '../assets/icons/close-x.svg?raw';

/**
 * "Pay with a linked card to earn points" — Figma 1427:14539.
 *
 * Shared by the offer detail page and the full-screen store map so the two cannot
 * drift. The copy is deliberately card-agnostic: the design names no brand or last
 * four, and the same sentence then reads correctly whether or not a card is linked
 * — only the pill's job changes.
 *
 * @param {{
 *   actionLabel?: string,
 *   actionAttr?: string,   // data-* hook the caller binds its click handler to
 *   dismissible?: boolean, // adds the corner X (the map floats over content)
 *   className?: string,
 * }} [opts]
 */
export default function LinkedCardNotice(opts) {
  opts = opts || {};
  var actionLabel = opts.actionLabel || 'Manage';
  var actionAttr = opts.actionAttr || '';
  var extraClass = opts.className ? ' ' + opts.className : '';

  return (
    '<div class="hc-linked-card-notice' +
    (opts.dismissible ? ' hc-linked-card-notice--dismissible' : '') +
    extraClass +
    '">' +
    '<div class="hc-linked-card-notice-main">' +
    '<span class="hc-linked-card-notice-icon" aria-hidden="true">' +
    cardFilledSvg +
    '</span>' +
    '<div class="hc-linked-card-notice-copy">' +
    '<div class="hc-linked-card-notice-title">Pay with a linked card to earn points</div>' +
    '</div>' +
    '<button type="button" class="hc-linked-card-notice-cta" ' +
    actionAttr +
    '>' +
    actionLabel +
    '</button>' +
    '</div>' +
    (opts.dismissible
      ? '<button type="button" class="hc-linked-card-notice-dismiss" ' +
        'data-linked-card-dismiss aria-label="Dismiss">' +
        closeXSvg +
        '</button>'
      : '') +
    '</div>'
  );
}
