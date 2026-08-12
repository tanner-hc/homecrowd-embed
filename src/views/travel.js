import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { buildAppHeaderHtml, attachAppHeader } from '../base-components/AppHeader.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import planeSvg from '../assets/icons/travel-plane.svg?raw';

var travelResizeObserver = null;

function resolveTravelUrl(session) {
  if (!session || !session.embed_path) return null;
  var origin = api.getApiOrigin().replace(/\/$/, '');
  return origin + session.embed_path;
}

function clearTravelResizeObserver() {
  if (travelResizeObserver) {
    travelResizeObserver.disconnect();
    travelResizeObserver = null;
  }
}

function syncTravelIframeSize(bodyEl, iframeEl) {
  if (!bodyEl || !iframeEl) return;
  var height = Math.max(Math.floor(bodyEl.getBoundingClientRect().height), 320);
  iframeEl.style.height = height + 'px';
  iframeEl.style.width = '100%';
}

function bindTravelIframeSize(bodyEl, iframeEl) {
  clearTravelResizeObserver();
  syncTravelIframeSize(bodyEl, iframeEl);

  if (typeof ResizeObserver !== 'undefined') {
    travelResizeObserver = new ResizeObserver(function () {
      syncTravelIframeSize(bodyEl, iframeEl);
    });
    travelResizeObserver.observe(bodyEl);
  }

  window.addEventListener('resize', function onTravelResize() {
    if (!document.body.contains(iframeEl)) {
      window.removeEventListener('resize', onTravelResize);
      clearTravelResizeObserver();
      return;
    }
    syncTravelIframeSize(bodyEl, iframeEl);
  });
}

/**
 * Holds the spinner over the frame until it has actually painted.
 *
 * `load` fires on the element for cross-origin frames too, so this works
 * without touching the partner's document. The timeout is a backstop for a
 * frame that stalls — better to show whatever has rendered than to sit under a
 * spinner indefinitely.
 */
var TRAVEL_FRAME_TIMEOUT_MS = 12000;

function revealTravelFrameWhenReady(bodyEl, iframeEl) {
  if (!bodyEl || !iframeEl) return;
  var overlay = bodyEl.querySelector('[data-travel-loading]');
  var done = false;
  var timer = null;

  function reveal() {
    if (done) return;
    done = true;
    if (timer != null) window.clearTimeout(timer);
    iframeEl.classList.remove('hc-travel-iframe--loading');
    if (!overlay) return;
    overlay.classList.add('hc-travel-loading--done');
    window.setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 250);
  }

  iframeEl.addEventListener('load', reveal);
  timer = window.setTimeout(reveal, TRAVEL_FRAME_TIMEOUT_MS);
}

export async function openTravel() {
  navigate('/travel');
}

export function renderTravel(container) {
  clearTravelResizeObserver();
  container.innerHTML =
    '<div class="hc-travel-view">' +
    // Same header the other tab destinations use: title left, profile and
    // points right. attachAppHeader below fills in the user and balance.
    buildAppHeaderHtml({ title: 'Travel' }) +
    // Sits outside #hc-travel-body so it survives the iframe swap below.
    '<div class="hc-travel-earn">' +
    '<div class="hc-travel-earn-row">' +
    '<span class="hc-travel-earn-icon" aria-hidden="true">' +
    planeSvg +
    '</span>' +
    '<span class="hc-travel-earn-text">' +
    '<span class="hc-travel-earn-label">Earn points as you travel</span>' +
    '<span class="hc-travel-earn-pts">1 point per $1 spent</span>' +
    '</span>' +
    '</div>' +
    '</div>' +
    '<div class="hc-travel-body" id="hc-travel-body">' +
    // The spinner is an overlay from the start and the iframe slots in behind
    // it, so the same node covers both the session request and the iframe's own
    // load. Re-rendering it between the two would restart its animation.
    '<div class="hc-travel-loading" data-travel-loading>' +
    LoadingSpinner({ text: 'Loading Travel...' }) +
    '</div>' +
    '</div>' +
    '</div>';

  attachAppHeader(container);

  loadTravelFrame(container);
}

async function loadTravelFrame(container) {
  var bodyEl = container.querySelector('#hc-travel-body');
  if (!bodyEl) return;

  try {
    var session = await api.createTravelSession();
    var travelUrl = resolveTravelUrl(session);
    if (!travelUrl) {
      throw new Error('No travel session from server');
    }

    // Behind the overlay, and transparent until it has painted — otherwise the
    // partner's blank document shows as a white screen for the whole load.
    bodyEl.insertAdjacentHTML(
      'afterbegin',
      '<iframe class="hc-travel-iframe hc-travel-iframe--loading" src="' +
        escapeAttr(travelUrl) +
        '" title="Travel" scrolling="yes" ' +
        'allow="clipboard-write; payment; geolocation; fullscreen"></iframe>',
    );

    var iframeEl = bodyEl.querySelector('.hc-travel-iframe');
    revealTravelFrameWhenReady(bodyEl, iframeEl);
    requestAnimationFrame(function () {
      bindTravelIframeSize(bodyEl, iframeEl);
    });
  } catch (err) {
    clearTravelResizeObserver();
    bodyEl.innerHTML =
      '<div class="hc-alert-error">' +
      escapeHtml((err && err.message) || 'Failed to open Travel') +
      '</div>';
  }
}
