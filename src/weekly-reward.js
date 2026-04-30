import * as api from './api.js';
import lottie from 'lottie-web';
import confettiAnimation from './assets/Confetti.json';
import { escapeHtml, escapeAttr } from './base-components/html.js';

function normalizeMediaUrl(url) {
  if (!url) return null;
  if (typeof url === 'string' && url.indexOf('s3://app.gethomecrowd.com/') === 0) {
    return url.replace('s3://app.gethomecrowd.com/', 'https://app.gethomecrowd.com/');
  }
  if (typeof url === 'string' && url.indexOf('s3://') === 0) {
    return url.replace('s3://', 'https://');
  }
  return url;
}

function pickPrize(leaderboardRes) {
  if (!leaderboardRes || typeof leaderboardRes !== 'object') return null;
  return (
    leaderboardRes.weekly_prize ||
    leaderboardRes.weekly_reward ||
    leaderboardRes.week_prize ||
    leaderboardRes.prize ||
    null
  );
}

function pickRewardId(prize) {
  if (!prize || typeof prize !== 'object') return null;
  return prize.reward_id || prize.rewardId || null;
}

function pickRows(leaderboardRes) {
  if (!leaderboardRes || typeof leaderboardRes !== 'object') return [];
  if (Array.isArray(leaderboardRes.leaderboard)) return leaderboardRes.leaderboard;
  if (Array.isArray(leaderboardRes.leaderboard_rows)) return leaderboardRes.leaderboard_rows;
  if (Array.isArray(leaderboardRes.leaderboardRows)) return leaderboardRes.leaderboardRows;
  return [];
}

function pickWeekEndsAt(leaderboardRes, prize) {
  if (leaderboardRes) {
    if (leaderboardRes.week_ends_at) return leaderboardRes.week_ends_at;
    if (leaderboardRes.weekEndsAt) return leaderboardRes.weekEndsAt;
  }
  if (prize && typeof prize === 'object') {
    return prize.week_end_date || prize.weekEndDate || null;
  }
  return null;
}

function resolveTargetMs(weekEndsAt, prize) {
  if (weekEndsAt) {
    var directMs = new Date(weekEndsAt).getTime();
    if (Number.isFinite(directMs)) return directMs;
  }
  var fallbackDate = prize && typeof prize === 'object' ? prize.week_end_date || prize.weekEndDate : null;
  if (fallbackDate) {
    var fallbackMs = new Date(String(fallbackDate) + 'T23:59:59').getTime();
    if (Number.isFinite(fallbackMs)) return fallbackMs;
  }
  return null;
}

function getWinnerName(winner) {
  if (!winner) return '';
  if (typeof winner === 'string') return winner.trim();
  return String(
    winner.name ||
      winner.full_name ||
      winner.fullName ||
      winner.display_name ||
      winner.displayName ||
      winner.username ||
      '',
  ).trim();
}

function formatLeaderboardName(fullName) {
  var parts = String(fullName || '')
    .trim()
    .split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return parts[0] + ' ' + parts[parts.length - 1].charAt(0) + '.';
}

function rankSuffix(rank) {
  var r = Number(rank);
  if (r === 1) return 'st';
  if (r === 2) return 'nd';
  if (r === 3) return 'rd';
  return 'th';
}

function topLeaderboardRow(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows.reduce(function (best, row) {
    var bestPoints = Number(best && best.points) || 0;
    var rowPoints = Number(row && row.points) || 0;
    return rowPoints > bestPoints ? row : best;
  }, rows[0]);
}

function resolveWinnerInfo(leaderboardRes, rows, prize) {
  var topRow = topLeaderboardRow(rows);
  var lastWeekWinner =
    leaderboardRes && (leaderboardRes.last_week_prize_winner || leaderboardRes.lastWeekPrizeWinner);
  var winnerName =
    getWinnerName(topRow) ||
    getWinnerName(lastWeekWinner) ||
    getWinnerName(prize && typeof prize === 'object' ? prize.winner_name || prize.winnerName : '');
  var fromPrize =
    prize && typeof prize === 'object'
      ? Number(prize.winner_points != null ? prize.winner_points : prize.winning_points)
      : NaN;
  var fromTopRow = topRow ? Number(topRow.points) : NaN;
  var fromLastWinner =
    lastWeekWinner && typeof lastWeekWinner === 'object'
      ? Number(lastWeekWinner.winning_points != null ? lastWeekWinner.winning_points : lastWeekWinner.points)
      : NaN;
  var winnerPoints = Number.isFinite(fromPrize) && fromPrize > 0
    ? fromPrize
    : Number.isFinite(fromTopRow)
      ? fromTopRow
      : Number.isFinite(fromLastWinner)
        ? fromLastWinner
        : null;
  return { name: winnerName, points: winnerPoints };
}

function pickRewardImage(reward) {
  if (!reward || typeof reward !== 'object') return null;
  if (reward.image_url || reward.imageUrl) return normalizeMediaUrl(reward.image_url || reward.imageUrl);
  var images = Array.isArray(reward.images) ? reward.images : [];
  var primary = null;
  for (var i = 0; i < images.length; i += 1) {
    if (images[i].is_primary || images[i].isPrimary) {
      primary = images[i];
      break;
    }
  }
  if (!primary && images.length) primary = images[0];
  return primary ? normalizeMediaUrl(primary.image_path || primary.imagePath) : null;
}

export async function buildWeeklyRewardContext(leaderboardRes) {
  var prize = pickPrize(leaderboardRes);
  if (!prize) return null;
  if (typeof prize === 'string') {
    return {
      title: prize,
      subtitle: 'Top points earner in your school wins this week',
      rewardId: null,
      imageUrl: null,
      terms: '',
      rows: pickRows(leaderboardRes),
      weekEndsAt: pickWeekEndsAt(leaderboardRes, null),
      winnerName: '',
      winnerPoints: null,
    candidateWinnerName: '',
    candidateWinnerPoints: null,
      targetMs: null,
    };
  }

  var rewardId = pickRewardId(prize);
  var imageUrl = normalizeMediaUrl(
    prize.resolved_image_url ||
      prize.cover_image_url ||
      prize.coverImageUrl ||
      prize.image_url ||
      prize.imageUrl ||
      prize.cover_image ||
      null,
  );

  if (rewardId && !imageUrl) {
    try {
      var reward = await api.getRewardDetail(String(rewardId));
      imageUrl = pickRewardImage(reward);
    } catch (_e) { }
  }

  var rows = pickRows(leaderboardRes);
  var weekEndsAt = pickWeekEndsAt(leaderboardRes, prize);
  var targetMs = resolveTargetMs(weekEndsAt, prize);
  var afterCutoff = Number.isFinite(targetMs) && Date.now() >= targetMs;
  var winnerInfo = resolveWinnerInfo(leaderboardRes, rows, prize);

  return {
    title: prize.cover_title || prize.coverTitle || prize.title || prize.name || 'Weekly reward',
    subtitle:
      (afterCutoff && winnerInfo.name
        ? 'Winner: ' + winnerInfo.name
        : prize.subtitle || prize.description || prize.cover_text || prize.coverText) ||
      'Top points earner in your school wins this week',
    rewardId: rewardId,
    imageUrl: imageUrl,
    terms: prize.terms || '',
    rows: rows,
    weekEndsAt: weekEndsAt,
    winnerName: afterCutoff ? winnerInfo.name : '',
    winnerPoints: afterCutoff ? winnerInfo.points : null,
    candidateWinnerName: winnerInfo.name,
    candidateWinnerPoints: winnerInfo.points,
    targetMs: targetMs,
  };
}

export function buildWeeklyRewardCardHtml(meta, className) {
  if (!meta) return '';
  var clickable = meta.rewardId ? ' data-weekly-reward-id="' + escapeAttr(meta.rewardId) + '"' : '';
  var cls = className ? ' ' + className : '';
  var html = '<div class="hc-weekly-reward-card' + cls + '"' + clickable + '>';
  html += '<div class="hc-weekly-reward-copy">';
  html += '<div class="hc-weekly-reward-label">Weekly reward</div>';
  html += '<div class="hc-weekly-reward-title">' + escapeHtml(meta.title || 'Weekly reward') + '</div>';
  html += '<div class="hc-weekly-reward-subtitle">' + escapeHtml(meta.subtitle || '') + '</div>';
  html += '</div>';
  if (meta.imageUrl) {
    html +=
      '<div class="hc-weekly-reward-image-wrap"><img class="hc-weekly-reward-image" src="' +
      escapeAttr(meta.imageUrl) +
      '" alt="' +
      escapeAttr(meta.title || 'Weekly reward') +
      '" /></div>';
  } else {
    html += '<div class="hc-weekly-reward-image-wrap hc-weekly-reward-image-wrap--empty">Gift</div>';
  }
  html += '</div>';
  return html;
}

export function buildWeeklyCountdownLabel(meta) {
  if (!meta || !Number.isFinite(meta.targetMs)) return '';
  var delta = Math.max(0, meta.targetMs - Date.now());
  if (delta <= 0) return 'Weekly draw ended';
  var days = Math.floor(delta / 86400000);
  var hours = Math.floor((delta % 86400000) / 3600000);
  var minutes = Math.floor((delta % 3600000) / 60000);
  var seconds = Math.floor((delta % 60000) / 1000);
  if (days > 0) return 'Ends in: ' + days + 'd ' + hours + 'h ' + minutes + 'm ' + seconds + 's';
  if (hours > 0) return 'Ends in: ' + hours + 'h ' + minutes + 'm ' + seconds + 's';
  if (minutes > 0) return 'Ends in: ' + minutes + 'm ' + seconds + 's';
  return 'Ends in: ' + seconds + 's';
}

export function buildWeeklyLeaderboardHtml(rows, limit) {
  var list = Array.isArray(rows) ? rows.slice(0, limit || 10) : [];
  if (!list.length) return '';
  var html = '<div class="hc-weekly-detail-leaderboard hc-weekly-detail-leaderboard--home">';
  list.forEach(function (row, idx) {
    var rank = row.rank != null ? row.rank : idx + 1;
    var points = Number(row.points) || 0;
    var top = Number(rank) === 1 ? ' hc-home-lb-row--top' : '';
    html += '<div class="hc-home-lb-row' + top + '">';
    html += '<div class="hc-home-lb-left">';
    html += '<div class="hc-home-lb-name">' + escapeHtml(formatLeaderboardName(getWinnerName(row) || 'Student')) + '</div>';
    html += '<div class="hc-home-lb-points">' + escapeHtml(String(points)) + ' ' + (points === 1 ? 'point' : 'points') + '</div>';
    html += '</div>';
    html += '<div class="hc-home-lb-right">';
    html += '<div class="hc-home-lb-rank">' + escapeHtml(String(rank)) + escapeHtml(rankSuffix(rank)) + ' Place</div>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function getWeeklyWebSocketUrl() {
  var h = window.location.hostname || '';
  if (h === 'embed.gethomecrowd.com') return 'wss://api.gethomecrowd.com/ws/weekly-prize/';
  var env =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL;
  if (env) {
    var base = String(env).replace(/\/$/, '');
    return base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + '/ws/weekly-prize/';
  }
  var port =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_PORT) || '8000';
  return 'ws://' + (h || 'localhost') + ':' + port + '/ws/weekly-prize/';
}

export function connectWeeklyPrizeWebSocket(options) {
  var opts = options || {};
  if (!opts.enabled) return function () {};
  var ws = null;
  var closed = false;
  var attempts = 0;
  var reconnectTimer = null;

  function connect() {
    if (closed || ws) return;
    var token = api.getAccessToken();
    if (!token) return;
    try {
      ws = new WebSocket(getWeeklyWebSocketUrl() + '?token=' + encodeURIComponent(token));
      ws.onmessage = function (event) {
        try {
          var data = JSON.parse(event.data);
          if (typeof opts.onMessage === 'function') opts.onMessage(data);
        } catch (_e) { }
      };
      ws.onopen = function () {
        attempts = 0;
      };
      ws.onclose = function (event) {
        ws = null;
        if (closed || event.code === 1000 || attempts >= 5) return;
        var timeout = Math.min(1000 * Math.pow(2, attempts), 10000);
        attempts += 1;
        reconnectTimer = window.setTimeout(connect, timeout);
      };
      ws.onerror = function () {};
    } catch (_e) { }
  }

  connect();

  return function () {
    closed = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    if (ws) {
      ws.close(1000, 'Manual disconnect');
      ws = null;
    }
  };
}

function winnerAlertKey(prize) {
  if (!prize || typeof prize !== 'object') return 'weekly-prize:unknown';
  return 'weekly-prize:' + (prize.id || prize.week_end_date || 'unknown') + ':' + (prize.winner_name || 'unknown');
}

export function showWeeklyWinnerModal(prize, fallbackTitle, options) {
  var opts = options || {};
  var key = winnerAlertKey(prize);
  if (!window.__hcWeeklyWinnerAlertShownKeys) window.__hcWeeklyWinnerAlertShownKeys = new Set();
  if (!opts.force && window.__hcWeeklyWinnerAlertShownKeys.has(key)) return;
  window.__hcWeeklyWinnerAlertShownKeys.add(key);

  var winnerName = prize && (prize.winner_name || prize.winnerName);
  var winnerPoints = prize && (prize.winner_points != null ? prize.winner_points : prize.winning_points);
  var prizeTitle =
    (prize && (prize.cover_title || prize.coverTitle || prize.title || prize.name)) ||
    fallbackTitle ||
    'Weekly reward';

  var overlay = document.createElement('div');
  overlay.className = 'hc-weekly-winner-modal';
  overlay.innerHTML =
    '<div class="hc-weekly-winner-backdrop" data-weekly-winner-close="1"></div>' +
    '<div class="hc-weekly-winner-card">' +
    '<div class="hc-weekly-winner-badge">Weekly Winner</div>' +
    '<div class="hc-weekly-winner-eyebrow">Congratulations to</div>' +
    '<div class="hc-weekly-winner-name">' +
    escapeHtml(winnerName || 'Winner not available') +
    '</div>' +
    '<div class="hc-weekly-winner-divider"></div>' +
    '<div class="hc-weekly-winner-section-label">Won</div>' +
    '<div class="hc-weekly-winner-prize">' +
    escapeHtml(prizeTitle) +
    '</div>' +
    '<div class="hc-weekly-winner-points">' +
    escapeHtml(typeof winnerPoints === 'number' ? winnerPoints + ' points' : winnerPoints != null ? String(winnerPoints) + ' points' : 'Points not available') +
    '</div>' +
    '<button type="button" class="hc-weekly-winner-button" data-weekly-winner-close="1">Awesome</button>' +
    '</div>' +
    '<div class="hc-weekly-winner-confetti-layer" aria-hidden="true"></div>';

  var animation = null;

  function close() {
    if (animation) {
      animation.destroy();
      animation = null;
    }
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  overlay.addEventListener('click', function (event) {
    if (event.target && event.target.closest('[data-weekly-winner-close="1"]')) close();
  });

  document.body.appendChild(overlay);
  var confettiEl = overlay.querySelector('.hc-weekly-winner-confetti-layer');
  if (confettiEl) {
    animation = lottie.loadAnimation({
      container: confettiEl,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      animationData: confettiAnimation,
    });
  }
}
