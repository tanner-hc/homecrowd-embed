import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import NavHeader from '../base-components/NavHeader.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';

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

export async function openTravel() {
  navigate('/travel');
}

export function renderTravel(container) {
  clearTravelResizeObserver();
  container.innerHTML =
    '<div class="hc-travel-view">' +
    NavHeader({ title: 'Travel', backButtonId: 'hc-travel-back' }) +
    '<div class="hc-travel-body" id="hc-travel-body">' +
    LoadingSpinner({ text: 'Loading Travel...' }) +
    '</div>' +
    '</div>';

  var backBtn = container.querySelector('#hc-travel-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      clearTravelResizeObserver();
      navigate('/profile');
    });
  }

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

    bodyEl.innerHTML =
      '<iframe class="hc-travel-iframe" src="' +
      escapeAttr(travelUrl) +
      '" title="Travel" scrolling="yes" ' +
      'allow="clipboard-write; payment; geolocation; fullscreen"></iframe>';

    var iframeEl = bodyEl.querySelector('.hc-travel-iframe');
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
