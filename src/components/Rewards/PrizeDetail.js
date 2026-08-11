import { escapeAttr, escapeHtml } from '../../base-components/html.js';
import { formatNumber } from '../../formatNumber.js';
import { buildAppHeaderHtml } from '../../base-components/AppHeader.js';
import dateSvg from '../../assets/icon-date-fill.svg?raw';
import locationSvg from '../../assets/icon-location.svg?raw';
import medalSvg from '../../assets/icon-medal.svg?raw';
import rankMedalSvg from '../../assets/icon-medal-rank.svg?raw';
import shieldSvg from '../../assets/icons/shield.svg?raw';
import personSvg from '../../assets/icons/person.svg?raw';
import chevronLeftSvg from '../../assets/icons/chevron-left.svg?raw';
import { enableDragScroll } from '../../base-components/dragScroll.js';

// How many rows the leaderboard shows before "View all" is tapped.
var COLLAPSED_ROWS = 5;
var MAX_ROWS = 100;

var DEFAULT_HOW_TO_WIN =
  'Shop at your usual stores using your linked card to earn points automatically. ' +
  'Climb the leaderboard and finish in first place before the competition ends to win.';

function periodLabel(meta) {
  return meta && meta.periodKind === 'overall' ? 'Season Prize' : 'Weekly Prize';
}

function capitalizeWord(word) {
  var normalized = String(word || '').toLowerCase();
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/** "Alex Smith" -> "Alex S.", matching the design's short names. */
export function formatLeaderboardName(row) {
  var fullName = String(
    (row &&
      (row.name ||
        row.full_name ||
        row.fullName ||
        row.display_name ||
        row.displayName ||
        row.username)) ||
      '',
  )
    .trim()
    .replace(/\s+/g, ' ');
  if (!fullName) return 'User';
  var parts = fullName.split(' ').filter(Boolean);
  if (parts.length === 1) return capitalizeWord(parts[0]);
  return (
    capitalizeWord(parts[0]) + ' ' + capitalizeWord(parts[parts.length - 1]).charAt(0) + '.'
  );
}

function pickRowUserId(row) {
  if (!row || typeof row !== 'object') return '';
  var raw = row.user_id != null ? row.user_id : row.userId != null ? row.userId : row.user;
  if (raw == null) raw = row.id;
  if (raw == null) return '';
  if (typeof raw === 'object') return raw.id != null ? String(raw.id) : '';
  return String(raw);
}

function pickRowAvatar(row) {
  if (!row || typeof row !== 'object') return '';
  return String(
    row.avatar_url || row.avatarUrl || row.profile_image || row.profileImage || '',
  ).trim();
}

/**
 * The leaderboard rows carry no "this is you" flag, so match on the user id
 * when the backend sends one and fall back to the display name.
 */
function isCurrentUserRow(row, currentUser) {
  if (!row || !currentUser) return false;
  var userId = currentUser.id != null ? String(currentUser.id) : '';
  var rowId = pickRowUserId(row);
  if (userId && rowId) return userId === rowId;
  var userName = String(
    currentUser.name || currentUser.full_name || currentUser.fullName || '',
  )
    .trim()
    .toLowerCase();
  if (!userName) return false;
  var rowName = String(
    (row.name || row.full_name || row.fullName || row.display_name || row.displayName || ''),
  )
    .trim()
    .toLowerCase();
  return !!rowName && rowName === userName;
}

function avatarHtml(row) {
  var url = pickRowAvatar(row);
  if (url) {
    return (
      '<span class="hc-prize-lb-avatar"><img data-hc-ph="person" src="' +
      escapeAttr(url) +
      '" alt="" /></span>'
    );
  }
  return '<span class="hc-prize-lb-avatar hc-prize-lb-avatar--ph">' + personSvg + '</span>';
}

/** Gold, silver and bronze medals for the podium; a plain number below it. */
function rankHtml(rank) {
  var n = Number(rank);
  if (n >= 1 && n <= 3) {
    var tone = n === 1 ? 'gold' : n === 2 ? 'silver' : 'bronze';
    return (
      '<span class="hc-prize-lb-medal hc-prize-lb-medal--' +
      tone +
      '" aria-hidden="true">' +
      rankMedalSvg +
      '</span>'
    );
  }
  return '<span class="hc-prize-lb-rank">' + escapeHtml(String(rank)) + '</span>';
}

function leaderboardRowHtml(row, rank, isYou) {
  return (
    '<div class="hc-prize-lb-row' +
    (isYou ? ' hc-prize-lb-row--you' : '') +
    '">' +
    '<div class="hc-prize-lb-left">' +
    rankHtml(rank) +
    avatarHtml(row) +
    '<span class="hc-prize-lb-name">' +
    escapeHtml(isYou ? 'You' : formatLeaderboardName(row)) +
    '</span>' +
    '</div>' +
    '<div class="hc-prize-lb-points">' +
    '<span class="hc-prize-lb-points-value">' +
    escapeHtml(formatNumber(Number(row && row.points) || 0)) +
    '</span>' +
    '<span class="hc-prize-lb-points-unit">pts</span>' +
    '</div>' +
    '</div>'
  );
}

/**
 * Top rows plus, when the current user ranks below them, their own row pinned
 * to the bottom — the design's highlighted "You" entry.
 *
 * @param {object} meta weekly/overall reward context
 * @param {{ currentUser?: object, expanded?: boolean }} [options]
 */
export function buildPrizeLeaderboardHtml(meta, options) {
  options = options || {};
  var all = (Array.isArray(meta && meta.rows) ? meta.rows : []).slice(0, MAX_ROWS);
  if (!all.length) {
    return (
      '<div class="hc-prize-lb">' +
      buildLeaderboardHeaderHtml(false, false) +
      '<div class="hc-prize-lb-empty">No rankings yet.</div>' +
      '</div>'
    );
  }

  var expanded = !!options.expanded;
  var currentUser = options.currentUser || null;
  var youIndex = -1;
  var entries = all.map(function (row, idx) {
    var rank = row && row.rank != null ? row.rank : idx + 1;
    var isYou = isCurrentUserRow(row, currentUser);
    if (isYou && youIndex < 0) youIndex = idx;
    return { row: row, rank: rank, isYou: isYou && youIndex === idx };
  });

  var visible = expanded ? entries : entries.slice(0, COLLAPSED_ROWS);
  var rowsHtml = visible
    .map(function (entry) {
      return leaderboardRowHtml(entry.row, entry.rank, entry.isYou);
    })
    .join('');

  // Pinned below the cut so you can always see where you stand.
  if (!expanded && youIndex >= COLLAPSED_ROWS) {
    var you = entries[youIndex];
    rowsHtml += leaderboardRowHtml(you.row, you.rank, true);
  }

  return (
    '<div class="hc-prize-lb">' +
    buildLeaderboardHeaderHtml(all.length > COLLAPSED_ROWS, expanded) +
    '<div class="hc-prize-lb-rows">' +
    rowsHtml +
    '</div>' +
    '</div>'
  );
}

function buildLeaderboardHeaderHtml(showToggle, expanded) {
  return (
    '<div class="hc-prize-lb-header">' +
    '<span class="hc-prize-lb-title">Leaderboard</span>' +
    (showToggle
      ? '<button type="button" class="hc-prize-lb-toggle' +
        (expanded ? ' is-expanded' : '') +
        '" data-prize-lb-toggle="1">' +
        '<span class="hc-prize-lb-toggle-text">' +
        (expanded ? 'Show less' : 'View all') +
        '</span>' +
        '<span class="hc-prize-lb-toggle-icon" aria-hidden="true">' +
        chevronLeftSvg +
        '</span>' +
        '</button>'
      : '') +
    '</div>'
  );
}

function infoRowHtml(icon, title, body) {
  return (
    '<div class="hc-prize-detail-info-row">' +
    '<span class="hc-prize-detail-info-icon">' +
    icon +
    '</span>' +
    '<div class="hc-prize-detail-info-text">' +
    '<span class="hc-prize-detail-info-title">' +
    escapeHtml(title) +
    '</span>' +
    '<span class="hc-prize-detail-info-body">' +
    escapeHtml(body) +
    '</span>' +
    '</div>' +
    '</div>'
  );
}

function buildInfoHtml(meta) {
  var rows = '';
  if (meta.eventDateLabel) rows += infoRowHtml(dateSvg, 'Date', meta.eventDateLabel);
  if (meta.location) rows += infoRowHtml(locationSvg, 'Location', meta.location);
  rows += infoRowHtml(medalSvg, 'How to Win', meta.howToWin || DEFAULT_HOW_TO_WIN);
  if (meta.terms) rows += infoRowHtml(shieldSvg, 'Terms', meta.terms);
  return '<div class="hc-prize-detail-info">' + rows + '</div>';
}

/**
 * Peeking carousel over the prize artwork, with the countdown floating on the
 * centred slide. Prizes carry a single image today, so this is usually one
 * slide; extra images render as neighbours when they arrive.
 */
function buildMediaHtml(meta, countdownLabel) {
  var urls = (Array.isArray(meta.images) ? meta.images : []).filter(Boolean);
  if (!urls.length && meta.imageUrl) urls = [meta.imageUrl];

  var slides = urls.length
    ? urls
        .map(function (url) {
          return (
            '<div class="hc-prize-detail-slide">' +
            '<img data-hc-ph="gift" class="hc-prize-detail-img" src="' +
            escapeAttr(url) +
            '" alt="" /></div>'
          );
        })
        .join('')
    : '<div class="hc-prize-detail-slide">' +
      '<div class="hc-prize-detail-img hc-prize-detail-img--ph hc-img-ph hc-img-ph--gift"></div></div>';

  var dots = '';
  if (urls.length > 1) {
    dots = '<div class="hc-prize-detail-dots">';
    for (var i = 0; i < urls.length; i++) {
      dots += '<span class="hc-prize-detail-dot' + (i === 0 ? ' is-active' : '') + '"></span>';
    }
    dots += '</div>';
  }

  return (
    '<div class="hc-prize-detail-media">' +
    '<div class="hc-prize-detail-stage">' +
    '<div class="hc-prize-detail-track">' +
    slides +
    '</div>' +
    (countdownLabel
      ? '<div class="hc-prize-detail-countdown">' +
        '<span class="hc-prize-detail-countdown-text">' +
        escapeHtml(countdownLabel) +
        '</span>' +
        '</div>'
      : '') +
    '</div>' +
    dots +
    '</div>'
  );
}

/**
 * Everything below the artwork: badge, title, blurb, info card and leaderboard.
 * Split out so live leaderboard refreshes can swap it without touching the
 * carousel or the header.
 *
 * @param {object} meta
 * @param {{ currentUser?: object, expanded?: boolean }} [options]
 */
export function buildPrizeDetailContentHtml(meta, options) {
  options = options || {};
  return (
    '<div class="hc-prize-detail-content">' +
    '<div class="hc-prize-detail-body">' +
    '<span class="hc-prize-detail-badge">' +
    escapeHtml(periodLabel(meta)) +
    '</span>' +
    '<h1 class="hc-prize-detail-title">' +
    escapeHtml(meta.title || 'Prize') +
    '</h1>' +
    (meta.description
      ? '<p class="hc-prize-detail-desc">' + escapeHtml(meta.description) + '</p>'
      : '') +
    buildInfoHtml(meta) +
    '</div>' +
    buildPrizeLeaderboardHtml(meta, options) +
    '</div>'
  );
}

/**
 * Weekly / season prize detail screen.
 *
 * @param {object} meta weekly or overall reward context
 * @param {{
 *   currentUser?: object,
 *   points?: number,
 *   countdownLabel?: string,
 *   expanded?: boolean,
 * }} [options]
 */
export function buildPrizeDetailHtml(meta, options) {
  options = options || {};
  return (
    '<div class="hc-prize-detail">' +
    buildAppHeaderHtml({
      showBack: true,
      user: options.currentUser,
      points: options.points,
    }) +
    buildMediaHtml(meta, options.countdownLabel) +
    buildPrizeDetailContentHtml(meta, options) +
    '</div>'
  );
}

/**
 * Carousel dots + the leaderboard's View all toggle.
 *
 * @param {HTMLElement} root
 * @param {{ onToggleLeaderboard?: function(boolean) }} [options]
 */
export function bindPrizeDetail(root, options) {
  options = options || {};
  if (!root) return;

  var track = root.querySelector('.hc-prize-detail-track');
  if (track) enableDragScroll(track);
  var dots = root.querySelectorAll('.hc-prize-detail-dot');
  if (track && dots.length > 1) {
    track.addEventListener('scroll', function () {
      var index = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === index);
      });
    });
  }

  bindPrizeLeaderboardToggle(root, options.onToggleLeaderboard);
}

/**
 * Rebind only the View all control — used after the leaderboard section is
 * re-rendered, where re-running bindPrizeDetail would double up the carousel's
 * scroll listener.
 *
 * @param {HTMLElement} root
 * @param {function(boolean)} onToggle receives the next expanded state
 */
export function bindPrizeLeaderboardToggle(root, onToggle) {
  if (!root || typeof onToggle !== 'function') return;
  var toggle = root.querySelector('[data-prize-lb-toggle]');
  if (!toggle) return;
  toggle.addEventListener('click', function () {
    onToggle(!toggle.classList.contains('is-expanded'));
  });
}

export default {
  buildPrizeDetailHtml,
  buildPrizeDetailContentHtml,
  buildPrizeLeaderboardHtml,
  bindPrizeDetail,
  bindPrizeLeaderboardToggle,
  formatLeaderboardName,
};
