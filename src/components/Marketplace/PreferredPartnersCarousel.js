import { escapeAttr, escapeHtml } from '../../base-components/html.js';
import * as api from '../../api.js';

var AUTO_MS = 3000;

function pickList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.results)) return raw.results;
  return [];
}

function isOnlineOffer(item) {
  var t = String((item && item.offer_type) || '').toLowerCase();
  return t === 'click' || t === 'click_sso' || t === 'online';
}

/**
 * @param {object} item
 * @param {'online'|'in_person'} [channel]
 */
export function normalizePreferredPartner(item, channel) {
  if (!item) return null;
  var resolvedChannel =
    channel || (isOnlineOffer(item) ? 'online' : 'in_person');
  var large = item.large_logo_url || item.largeLogoUrl || '';
  var small = item.small_logo_url || item.smallLogoUrl || large || '';
  if (!large && !small) return null;
  return {
    id: item.id,
    name: item.name || '',
    largeLogoUrl: large || small,
    smallLogoUrl: small || large,
    summary: item.summary || '',
    offerId: item.offer_id || item.offerId || null,
    offerType: item.offer_type || (resolvedChannel === 'online' ? 'click' : 'card_linked'),
    channel: resolvedChannel,
    badgeLabel: resolvedChannel === 'online' ? 'Online' : 'In-person',
    preferredOrder:
      Number(
        item.preferred_order != null
          ? item.preferred_order
          : item.preferredOrder != null
            ? item.preferredOrder
            : item.top_order != null
              ? item.top_order
              : item.topOrder
      ) || 0,
    raw: item,
  };
}

/**
 * Normalize preferred-partner featured offers (is_preferred_partner).
 * @param {*} raw
 */
export function normalizePreferredPartners(raw) {
  var seen = {};
  var merged = [];
  pickList(raw)
    .filter(function (m) {
      return (
        m &&
        m.is_active !== false &&
        (m.is_preferred_partner === true || m.isPreferredPartner === true)
      );
    })
    .map(function (m) {
      return normalizePreferredPartner(m);
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return (b.preferredOrder || 0) - (a.preferredOrder || 0);
    })
    .forEach(function (item) {
      var key = item.id != null ? String(item.id) : item.name;
      if (!key || seen[key]) return;
      seen[key] = true;
      merged.push(item);
    });
  return merged;
}

export async function fetchPreferredPartners() {
  var raw = await api.getFeaturedOffers(null, { is_preferred_partner: true }).catch(function () {
    return [];
  });
  return normalizePreferredPartners(raw);
}

function pickSubtitle(partner) {
  var summary = String((partner && partner.summary) || '').trim();
  if (summary) {
    var firstLine = summary.split(/\n/)[0].trim();
    if (firstLine.length > 52) return firstLine.slice(0, 49) + '…';
    return firstLine;
  }
  return partner && partner.channel === 'online'
    ? 'Shop online and earn'
    : 'Shop in person and earn';
}

/**
 * Single carousel card (reusable).
 * @param {object} partner
 */
export function buildPreferredPartnerCardHtml(partner) {
  if (!partner) return '';
  var payload = escapeAttr(
    JSON.stringify({
      id: partner.id,
      name: partner.name,
      offer_id: partner.offerId,
      offer_type: partner.offerType,
      channel: partner.channel,
      small_logo_url: partner.smallLogoUrl,
      large_logo_url: partner.largeLogoUrl,
    })
  );

  return (
    '<button type="button" class="hc-pp-card" data-pp-partner="' +
    payload +
    '" aria-label="' +
    escapeAttr(partner.name || 'Partner') +
    '">' +
    '<span class="hc-pp-card-media" aria-hidden="true">' +
    '<img src="' +
    escapeAttr(partner.largeLogoUrl) +
    '" alt="" class="hc-pp-card-img" />' +
    '<span class="hc-pp-card-shade"></span>' +
    '</span>' +
    '<span class="hc-pp-card-badge">' +
    escapeHtml(partner.badgeLabel || 'Online') +
    '</span>' +
    '<span class="hc-pp-card-meta">' +
    (partner.smallLogoUrl
      ? '<img src="' +
        escapeAttr(partner.smallLogoUrl) +
        '" alt="" class="hc-pp-card-logo" />'
      : '<span class="hc-pp-card-logo hc-pp-card-logo--ph"></span>') +
    '<span class="hc-pp-card-copy">' +
    '<span class="hc-pp-card-name">' +
    escapeHtml(partner.name || '') +
    '</span>' +
    '<span class="hc-pp-card-sub">' +
    escapeHtml(pickSubtitle(partner)) +
    '</span>' +
    '</span>' +
    '</span>' +
    '</button>'
  );
}

/**
 * @param {{
 *   partners?: object[],
 *   loading?: boolean,
 *   title?: string,
 *   viewAllLabel?: string,
 * }} props
 */
export function buildPreferredPartnersCarouselHtml(props) {
  props = props || {};
  var title = props.title || 'Preferred Partners';
  var viewAllLabel = props.viewAllLabel || 'View all';
  var partners = Array.isArray(props.partners) ? props.partners : [];

  if (props.loading) {
    return (
      '<div class="hc-pp" data-pp-root>' +
      '<div class="hc-pp-header">' +
      '<div class="hc-pp-title">' +
      escapeHtml(title) +
      '</div>' +
      '</div>' +
      '<div class="hc-pp-skeleton" aria-hidden="true"></div>' +
      '</div>'
    );
  }

  if (!partners.length) return '';

  var loop = partners.length > 1;
  var sets = loop ? 3 : 1;
  var slidesHtml = '';
  for (var set = 0; set < sets; set++) {
    partners.forEach(function (partner, i) {
      slidesHtml +=
        '<div class="hc-pp-slide" data-pp-logical="' +
        escapeAttr(String(i)) +
        '" data-pp-set="' +
        escapeAttr(String(set)) +
        '">' +
        buildPreferredPartnerCardHtml(partner) +
        '</div>';
    });
  }

  return (
    '<div class="hc-pp" data-pp-root' +
    (loop ? ' data-pp-loop="1"' : '') +
    ' data-pp-count="' +
    escapeAttr(String(partners.length)) +
    '">' +
    '<div class="hc-pp-header">' +
    '<div class="hc-pp-title">' +
    escapeHtml(title) +
    '</div>' +
    '<button type="button" class="hc-pp-view-all" data-pp-view-all>' +
    escapeHtml(viewAllLabel) +
    '</button>' +
    '</div>' +
    '<div class="hc-pp-track" data-pp-track>' +
    slidesHtml +
    '</div>' +
    '</div>'
  );
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   onViewAll?: function,
 *   onPartnerPress?: function(object),
 *   autoplayMs?: number,
 * }} handlers
 * @returns {{ destroy: function }}
 */
export function mountPreferredPartnersCarousel(root, handlers) {
  handlers = handlers || {};
  if (!root) return { destroy: function () {} };

  var track = root.querySelector('[data-pp-track]');
  var slides = track ? Array.prototype.slice.call(track.querySelectorAll('.hc-pp-slide')) : [];
  var realCount = Number(root.getAttribute('data-pp-count')) || 0;
  var loop = root.getAttribute('data-pp-loop') === '1' && realCount > 1;
  var index = loop ? realCount : 0;
  var timer = null;
  var paused = false;
  var destroyed = false;
  var resumeTimer = null;
  var settleTimer = null;
  var jumping = false;
  var autoAnimating = false;
  var autoMs = handlers.autoplayMs != null ? handlers.autoplayMs : AUTO_MS;

  function getGap() {
    if (!track) return 12;
    try {
      var style = window.getComputedStyle(track);
      var g = parseFloat(style.columnGap || style.gap);
      if (Number.isFinite(g)) return g;
    } catch (_e) {}
    return 12;
  }

  function getPaddingLeft() {
    if (!track) return 0;
    try {
      var pad = parseFloat(window.getComputedStyle(track).paddingLeft);
      return Number.isFinite(pad) ? pad : 0;
    } catch (_e) {
      return 0;
    }
  }

  function slideOffset(i) {
    var gap = getGap();
    var left = 0;
    for (var j = 0; j < i; j++) {
      left += slides[j].offsetWidth + gap;
    }
    return left;
  }

  function scrollLeftForIndex(i) {
    if (!track || !slides.length) return 0;
    var left = getPaddingLeft() + slideOffset(i);
    return Math.max(0, left + slides[i].offsetWidth / 2 - track.clientWidth / 2);
  }

  function setScrollLeft(left, smooth) {
    if (!track) return;
    if (smooth && typeof track.scrollTo === 'function') {
      track.scrollTo({ left: left, behavior: 'smooth' });
      return;
    }
    track.scrollLeft = left;
  }

  function goTo(nextIndex, smooth) {
    if (!track || !slides.length) return;
    var max = slides.length - 1;
    index = Math.max(0, Math.min(max, nextIndex));
    setScrollLeft(scrollLeftForIndex(index), !!smooth);
  }

  function isOutsideMiddle(i) {
    return i < realCount || i >= realCount * 2;
  }

  function jumpToMiddleClone(logicalIndex) {
    if (!track || !loop) return;
    var logical = ((logicalIndex % realCount) + realCount) % realCount;
    jumping = true;
    var prevSnap = track.style.scrollSnapType;
    var prevOverflow = track.style.overflowX;
    track.style.scrollSnapType = 'none';
    track.style.overflowX = 'hidden';
    index = realCount + logical;
    track.scrollLeft = scrollLeftForIndex(index);
    void track.offsetWidth;
    track.style.overflowX = prevOverflow || '';
    track.style.scrollSnapType = prevSnap || '';
    window.requestAnimationFrame(function () {
      if (destroyed) return;
      // Re-assert in case momentum fought the jump.
      track.scrollLeft = scrollLeftForIndex(index);
      jumping = false;
    });
  }

  function normalizeLoopPosition() {
    if (!loop || jumping || !slides.length) return;
    if (!isOutsideMiddle(index)) return;
    jumpToMiddleClone(index);
  }

  function nearestIndex() {
    if (!track || !slides.length) return 0;
    var best = 0;
    var bestDist = Infinity;
    var sl = track.scrollLeft;
    for (var i = 0; i < slides.length; i++) {
      var dist = Math.abs(scrollLeftForIndex(i) - sl);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  function syncIndexFromScroll() {
    if (!track || !slides.length || jumping) return;
    index = nearestIndex();
  }

  function onScrollFrame() {
    if (jumping || destroyed || !track) return;
    syncIndexFromScroll();
    // During autoplay's smooth step into the next clone, wait until it finishes.
    if (autoAnimating) return;
    if (loop && isOutsideMiddle(index)) {
      normalizeLoopPosition();
    }
  }

  function stopAuto() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function startAuto() {
    stopAuto();
    if (destroyed || paused || !slides.length || slides.length < 2) return;
    timer = window.setInterval(function () {
      if (destroyed || paused || jumping) return;
      autoAnimating = true;
      goTo(index + 1, true);
      if (settleTimer) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(function () {
        autoAnimating = false;
        syncIndexFromScroll();
        normalizeLoopPosition();
      }, 480);
    }, autoMs);
  }

  function pauseTemporarily() {
    paused = true;
    autoAnimating = false;
    stopAuto();
    if (resumeTimer) window.clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(function () {
      paused = false;
      startAuto();
    }, autoMs);
  }

  var viewAll = root.querySelector('[data-pp-view-all]');
  if (viewAll && typeof handlers.onViewAll === 'function') {
    viewAll.addEventListener('click', function (e) {
      e.preventDefault();
      handlers.onViewAll();
    });
  }

  root.querySelectorAll('[data-pp-partner]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (typeof handlers.onPartnerPress !== 'function') return;
      var raw = btn.getAttribute('data-pp-partner');
      var partner = null;
      try {
        partner = JSON.parse(raw);
      } catch (_e) {
        return;
      }
      if (partner) handlers.onPartnerPress(partner);
    });
  });

  if (track) {
    track.addEventListener(
      'scroll',
      function () {
        onScrollFrame();
      },
      { passive: true }
    );
    track.addEventListener(
      'pointerdown',
      function () {
        pauseTemporarily();
      },
      { passive: true }
    );
    track.addEventListener(
      'touchstart',
      function () {
        pauseTemporarily();
      },
      { passive: true }
    );
    track.addEventListener(
      'wheel',
      function () {
        pauseTemporarily();
      },
      { passive: true }
    );
  }

  window.requestAnimationFrame(function () {
    if (destroyed) return;
    goTo(index, false);
    startAuto();
  });

  return {
    destroy: function () {
      destroyed = true;
      stopAuto();
      if (resumeTimer) window.clearTimeout(resumeTimer);
      if (settleTimer) window.clearTimeout(settleTimer);
    },
  };
}

export default {
  normalizePreferredPartner,
  normalizePreferredPartners,
  fetchPreferredPartners,
  buildPreferredPartnerCardHtml,
  buildPreferredPartnersCarouselHtml,
  mountPreferredPartnersCarousel,
};
