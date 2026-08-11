// Global <img> load-failure fallback.
//
// Every image in the app can fail: remote merchant logos rot, S3 links expire,
// reward artwork 404s. Rather than patching each of the ~100 call sites with its
// own onerror, one capture-phase listener on the document catches them all --
// error events from <img> do not bubble, but they do capture.
//
// When an image fails we keep the very same element (so its classes, box size
// and border radius are untouched) and swap it for a light gray tile with a
// centered icon: the src becomes a transparent 1x1 pixel and `.hc-img-ph` in
// styles.css paints the fill plus the per-kind icon. Because the replacement
// pixel is a data: URI and the element is flagged as already handled, a
// placeholder can never re-trigger the handler.
//
// Call sites pick the icon with `data-hc-ph="<kind>"`, e.g.
//   '<img data-hc-ph="store" src="' + escapeAttr(logoUrl) + '" ... />'
// Valid kinds are store, gift, person, school, card, image and none ("none"
// hides the image instead of drawing a tile, for decorative bundled glyphs).
// Sites with no attribute fall back to a guess based on their class names.

var TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

var KINDS = {
  store: 1,
  gift: 1,
  person: 1,
  school: 1,
  card: 1,
  image: 1,
  none: 1,
};

// Checked in order, so the more specific class fragments come first.
var CLASS_HINTS = [
  ['avatar', 'person'],
  ['prize', 'gift'],
  ['reward', 'gift'],
  ['school', 'school'],
  ['brand', 'school'],
  ['merchant', 'store'],
  ['shop', 'store'],
  ['store', 'store'],
  ['partner', 'store'],
  ['logo', 'store'],
];

var installed = false;

function guessKind(img) {
  var className = '';
  try {
    className = String(img.className || '').toLowerCase();
  } catch (e) {
    className = '';
  }
  for (var i = 0; i < CLASS_HINTS.length; i += 1) {
    if (className.indexOf(CLASS_HINTS[i][0]) !== -1) {
      return CLASS_HINTS[i][1];
    }
  }
  return 'image';
}

export function applyImagePlaceholder(img, kind) {
  if (!img || img.tagName !== 'IMG') return;
  if (img.getAttribute('data-hc-ph-applied') === '1') return;
  img.setAttribute('data-hc-ph-applied', '1');

  var resolved = kind && KINDS[kind] ? kind : guessKind(img);

  // A placeholder is a silent failure by design, which makes a genuinely broken
  // URL easy to miss. In dev the console is piped to the terminal by
  // dev-client-log.js, so the dead URL shows up next to the request log.
  if (import.meta.env && import.meta.env.DEV) {
    console.warn(
      '[hc-img] image failed to load, showing "' +
        resolved +
        '" placeholder: ' +
        (img.getAttribute('src') || '(empty src)')
    );
  }

  // Drop any per-site handler so the transparent pixel below cannot loop back
  // into this code, and drop srcset so the browser does not retry a candidate.
  img.onerror = null;
  img.removeAttribute('srcset');
  img.className = img.className
    ? img.className + ' hc-img-ph hc-img-ph--' + resolved
    : 'hc-img-ph hc-img-ph--' + resolved;
  img.setAttribute('src', TRANSPARENT_PIXEL);
}

function handleError(e) {
  var target = e && e.target;
  // Capture-phase document listeners also see <script> and <link> failures.
  if (!target || target.tagName !== 'IMG') return;
  applyImagePlaceholder(target, target.getAttribute('data-hc-ph'));
}

export function installImageFallback() {
  if (installed) return;
  if (typeof document === 'undefined' || !document.addEventListener) return;
  installed = true;
  document.addEventListener('error', handleError, true);
}
