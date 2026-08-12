// Squares off a logo inside a square tile.
//
// The Eat local rows (60x60) and the offer detail hero (112x112) are square white
// plates. A logo is scaled until its longer side fills the plate, and the plate's
// white fills the shorter axis, so the composite always reads as a square whether
// the source art was wider, taller, or smaller than the plate.
//
// Which side is longer is a property of the decoded bitmap, so it cannot be known
// when the HTML string is built — it has to be read on load. One capture-phase
// listener on the document catches every image regardless of which of the ~9
// innerHTML call sites wrote the markup: load does not bubble from <img>, but it
// does capture. That also covers the row images, which are loading="lazy" and sit
// [hidden] past the first 15 until "Show more", so they can decode minutes after
// their markup lands — a render-time hook would read naturalWidth as 0.
//
// Images opt in with `data-hc-square`; see img[data-hc-square] in styles.css.

var installed = false;

function handleLoad(e) {
  var img = e && e.target;
  if (!img || img.tagName !== 'IMG') return;
  if (!img.hasAttribute('data-hc-square')) return;
  // imageFallback.js swaps a failed image for a transparent 1x1 pixel, and that
  // pixel fires load like any other. Squaring it would blow 1px up to the whole
  // plate. The flag is set before the src swap, so it is always here in time.
  if (img.getAttribute('data-hc-ph-applied') === '1') return;

  var w = img.naturalWidth;
  var h = img.naturalHeight;
  // 0 for a broken bitmap, and for an SVG with no intrinsic size on browsers that
  // report it that way. No usable ratio, so leave the base rule to fit it as
  // before. The `> 1` form also rejects NaN and undefined.
  if (!(w > 1) || !(h > 1)) return;

  // Both set every time, so a changed src re-squares rather than keeping a stale
  // class, and the two can never both be present. An exactly square image takes
  // the --wide path, which fills the plate identically.
  img.classList.toggle('hc-img-square--tall', h > w);
  img.classList.toggle('hc-img-square--wide', h <= w);
}

export function installSquareImages() {
  if (installed) return;
  if (typeof document === 'undefined' || !document.addEventListener) return;
  installed = true;
  document.addEventListener('load', handleLoad, true);
}

export default { installSquareImages };
