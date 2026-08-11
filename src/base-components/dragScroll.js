// Click-and-drag scrolling for the horizontal snap carousels.
//
// The tracks are native `overflow-x: auto` scrollers with their scrollbars
// hidden, which is right on touch but leaves a desktop pointer with no way to
// move them: there is no bar to grab and a mouse has no horizontal wheel axis.
// This adds mouse/pen dragging and leaves touch alone, so native momentum and
// scroll-snap keep behaving exactly as they do today.

/**
 * @param {HTMLElement} track the scroll container
 * @returns {function()} teardown
 */
export function enableDragScroll(track) {
  if (!track || track.getAttribute('data-hc-drag-scroll') === '1') {
    return function () {};
  }
  track.setAttribute('data-hc-drag-scroll', '1');

  var dragging = false;
  var startX = 0;
  var startLeft = 0;
  var moved = false;
  var snap = '';

  function overflows() {
    return track.scrollWidth - track.clientWidth > 1;
  }

  // Images are natively draggable, so a press on the artwork would start a
  // file drag instead of a scroll.
  function onDragStart(e) {
    if (dragging) e.preventDefault();
  }

  function onPointerDown(e) {
    if (e.pointerType === 'touch') return;
    if (e.button != null && e.button !== 0) return;
    if (!overflows()) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startLeft = track.scrollLeft;
    // Snap fights a live drag, so it is suspended until the pointer is up.
    snap = track.style.scrollSnapType;
    track.style.scrollSnapType = 'none';
    track.style.cursor = 'grabbing';
  }

  function onPointerMove(e) {
    if (!dragging) return;
    var dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 3) {
      moved = true;
      if (track.setPointerCapture && e.pointerId != null) {
        try {
          track.setPointerCapture(e.pointerId);
        } catch (err) {
          /* capture is best effort */
        }
      }
    }
    if (moved) {
      e.preventDefault();
      track.scrollLeft = startLeft - dx;
    }
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    track.style.cursor = overflows() ? 'grab' : '';
    // Restoring snap lets the browser settle on the nearest slide.
    track.style.scrollSnapType = snap;
  }

  // A drag that ends on a slide must not read as a tap on it.
  function onClick(e) {
    if (!moved) return;
    moved = false;
    e.preventDefault();
    e.stopPropagation();
  }

  track.style.cursor = overflows() ? 'grab' : '';
  track.addEventListener('dragstart', onDragStart);
  track.addEventListener('pointerdown', onPointerDown);
  track.addEventListener('pointermove', onPointerMove);
  track.addEventListener('click', onClick, true);
  // On window, not the track: if pointer capture was refused, a release
  // outside the track would otherwise leave snap disabled mid-drag.
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  return function destroy() {
    track.removeAttribute('data-hc-drag-scroll');
    track.removeEventListener('dragstart', onDragStart);
    track.removeEventListener('pointerdown', onPointerDown);
    track.removeEventListener('pointermove', onPointerMove);
    track.removeEventListener('click', onClick, true);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    track.style.cursor = '';
  };
}

export default { enableDragScroll };
