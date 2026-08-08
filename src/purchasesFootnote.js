/**
 * Closing note shown at the bottom of the home and rewards screens.
 * Figma 1216:13717 — centred Grey 4 text on a narrow measure, and it stays put
 * whether or not the user has any transactions yet.
 */
export function buildPurchasesFootnoteHtml() {
  return (
    '<div class="hc-page-footnote">' +
    'Purchases show up here after you shop at a participating store.' +
    '</div>'
  );
}

export default { buildPurchasesFootnoteHtml };
