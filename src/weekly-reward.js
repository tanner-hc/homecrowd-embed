import * as api from './api.js';
import lottie from 'lottie-web';
import confettiAnimation from './assets/Confetti.json';
import trophyIconSvg from './assets/icons/trophy.svg?raw';
import { escapeHtml, escapeAttr } from './base-components/html.js';

function normalizeMediaUrl(url) {
  if (url == null || url === '') return null;
  if (typeof url === 'string') {
    url = url.trim();
    if (!url) return null;
  }
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
  var r = prize.reward_id || prize.rewardId || prize.reward;
  if (r == null) return null;
  return typeof r === 'object' && r != null && r.id != null ? r.id : r;
}

export function leaderboardContextToEmbedProduct(ctx) {
  if (!ctx || ctx.rewardId == null) return null;
  var rid = ctx.rewardId;
  var idStr = typeof rid === 'object' && rid != null && rid.id != null ? String(rid.id) : String(rid);
  if (!idStr) return null;
  var isOverall = ctx.periodKind === 'overall';
  return {
    id: idStr,
    title: ctx.title,
    description: ctx.description,
    points_cost: 0,
    pointsCost: 0,
    reward_type: isOverall ? 'overall_reward' : 'weekly_reward',
    redemption_type: isOverall ? 'overall' : 'weekly',
    is_active: true,
    enabled: true,
    is_locked: false,
    image_url: ctx.imageUrl,
    imageUrl: ctx.imageUrl,
    images: [],
  };
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
  var r = Number(rank) || 0;
  var mod100 = r % 100;
  if (mod100 >= 10 && mod100 <= 20) return 'th';
  var mod10 = r % 10;
  if (mod10 === 1) return 'st';
  if (mod10 === 2) return 'nd';
  if (mod10 === 3) return 'rd';
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

function pickOverallPrize(leaderboardRes) {
  if (!leaderboardRes || typeof leaderboardRes !== 'object') return null;
  return leaderboardRes.overall_prize || leaderboardRes.overall_reward || null;
}

function pickOverallRows(leaderboardRes) {
  if (!leaderboardRes || typeof leaderboardRes !== 'object') return [];
  if (Array.isArray(leaderboardRes.overall_leaderboard)) return leaderboardRes.overall_leaderboard;
  if (Array.isArray(leaderboardRes.overall_leaderboard_rows)) {
    return leaderboardRes.overall_leaderboard_rows;
  }
  if (Array.isArray(leaderboardRes.overallLeaderboard)) return leaderboardRes.overallLeaderboard;
  if (Array.isArray(leaderboardRes.overallLeaderboardRows)) return leaderboardRes.overallLeaderboardRows;
  return [];
}

function resolveOverallPeriodTargetMs(leaderboardRes, prize) {
  var raw =
    (leaderboardRes && (leaderboardRes.overall_period_ends_at || leaderboardRes.overallPeriodEndsAt)) ||
    (prize && typeof prize === 'object' && (prize.end_date || prize.endDate)) ||
    null;
  if (!raw) return null;
  var ms = new Date(raw).getTime();
  if (Number.isFinite(ms)) return ms;
  var d = String(raw).trim();
  if (d) {
    var ms2 = new Date(d + 'T23:59:59').getTime();
    if (Number.isFinite(ms2)) return ms2;
  }
  return null;
}

function resolveOverallWinnerInfo(rows, prize) {
  var topRow = topLeaderboardRow(rows);
  var winnerName =
    getWinnerName(topRow) ||
    getWinnerName(prize && typeof prize === 'object' ? prize.winner_name || prize.winnerName : '');
  var fromPrize =
    prize && typeof prize === 'object'
      ? Number(prize.winner_points != null ? prize.winner_points : prize.winning_points)
      : NaN;
  var fromTopRow = topRow ? Number(topRow.points) : NaN;
  var winnerPoints =
    Number.isFinite(fromPrize) && fromPrize > 0
      ? fromPrize
      : Number.isFinite(fromTopRow)
        ? fromTopRow
        : null;
  return { name: String(winnerName || '').trim(), points: winnerPoints };
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
    var stringTitle = prize.trim();
    if (!stringTitle) return null;
    return {
      title: stringTitle,
      subtitle: 'Top points earner in your school wins this week',
      description: '',
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
      periodKind: 'weekly',
    };
  }

  var rewardId = pickRewardId(prize);
  var prizeForMeta = prize;
  if (rewardId) {
    try {
      var rewardDoc = await api.getRewardDetail(String(rewardId));
      var mergeExtra = {};
      var resolvedFromApi = pickRewardImage(rewardDoc);
      if (resolvedFromApi) mergeExtra.resolved_image_url = resolvedFromApi;
      if (rewardDoc.description && String(rewardDoc.description).trim()) {
        mergeExtra.resolved_description = String(rewardDoc.description).trim();
      }
      if (rewardDoc.title && String(rewardDoc.title).trim()) {
        mergeExtra.resolved_reward_title = String(rewardDoc.title).trim();
      }
      if (Object.keys(mergeExtra).length > 0) {
        prizeForMeta = Object.assign({}, prize, mergeExtra);
      }
    } catch (_e) { }
  }

  var imageUrl = normalizeMediaUrl(
    prizeForMeta.resolved_image_url ||
      prizeForMeta.cover_image_url ||
      prizeForMeta.coverImageUrl ||
      prizeForMeta.image_url ||
      prizeForMeta.imageUrl ||
      prizeForMeta.cover_image ||
      null,
  );

  var rows = pickRows(leaderboardRes);
  var weekEndsAt = pickWeekEndsAt(leaderboardRes, prizeForMeta);
  var targetMs = resolveTargetMs(weekEndsAt, prizeForMeta);
  var afterCutoff = Number.isFinite(targetMs) && Date.now() >= targetMs;
  var winnerInfo = resolveWinnerInfo(leaderboardRes, rows, prizeForMeta);

  var rewardIdStr = rewardId != null ? String(rewardId).trim() : '';
  var imageUrlStr = imageUrl != null ? String(imageUrl).trim() : '';
  if (!rewardIdStr && !imageUrlStr) return null;

  return {
    title:
      prizeForMeta.resolved_reward_title ||
      prizeForMeta.title ||
      prizeForMeta.name ||
      prizeForMeta.cover_title ||
      prizeForMeta.coverTitle ||
      'Reward',
    subtitle:
      (afterCutoff && winnerInfo.name
        ? 'Winner: ' + winnerInfo.name
        : prizeForMeta.subtitle ||
          prizeForMeta.description ||
          prizeForMeta.cover_text ||
          prizeForMeta.coverText) ||
      'Top points earner in your school wins this week',
    description: String(
      prizeForMeta.resolved_description ||
        prizeForMeta.description ||
        prizeForMeta.cover_text ||
        prizeForMeta.coverText ||
        prizeForMeta.body ||
        '',
    ).trim(),
    rewardId: rewardId,
    imageUrl: imageUrl,
    terms: prizeForMeta.terms || '',
    rows: rows,
    weekEndsAt: weekEndsAt,
    winnerName: afterCutoff ? winnerInfo.name : '',
    winnerPoints: afterCutoff ? winnerInfo.points : null,
    candidateWinnerName: winnerInfo.name,
    candidateWinnerPoints: winnerInfo.points,
    targetMs: targetMs,
    periodKind: 'weekly',
  };
}

export async function buildOverallRewardContext(leaderboardRes) {
  var prize = pickOverallPrize(leaderboardRes);
  if (!prize) return null;
  if (typeof prize === 'string') {
    var oStringTitle = prize.trim();
    if (!oStringTitle) return null;
    return {
      title: oStringTitle,
      subtitle: 'Top points earner in your school wins this overall period',
      description: '',
      rewardId: null,
      imageUrl: null,
      terms: '',
      rows: pickOverallRows(leaderboardRes),
      weekEndsAt: null,
      winnerName: '',
      winnerPoints: null,
      candidateWinnerName: '',
      candidateWinnerPoints: null,
      targetMs: null,
      periodKind: 'overall',
    };
  }

  var oRewardId = pickRewardId(prize);
  var oPrizeForMeta = prize;
  if (oRewardId) {
    try {
      var oRewardDoc = await api.getRewardDetail(String(oRewardId));
      var oMergeExtra = {};
      var oResolvedFromApi = pickRewardImage(oRewardDoc);
      if (oResolvedFromApi) oMergeExtra.resolved_image_url = oResolvedFromApi;
      if (oRewardDoc.description && String(oRewardDoc.description).trim()) {
        oMergeExtra.resolved_description = String(oRewardDoc.description).trim();
      }
      if (oRewardDoc.title && String(oRewardDoc.title).trim()) {
        oMergeExtra.resolved_reward_title = String(oRewardDoc.title).trim();
      }
      if (Object.keys(oMergeExtra).length > 0) {
        oPrizeForMeta = Object.assign({}, prize, oMergeExtra);
      }
    } catch (_e) { }
  }

  var oImageUrl = normalizeMediaUrl(
    oPrizeForMeta.resolved_image_url ||
      oPrizeForMeta.cover_image_url ||
      oPrizeForMeta.coverImageUrl ||
      oPrizeForMeta.image_url ||
      oPrizeForMeta.imageUrl ||
      oPrizeForMeta.cover_image ||
      null,
  );

  var oRows = pickOverallRows(leaderboardRes);
  var oTargetMs = resolveOverallPeriodTargetMs(leaderboardRes, oPrizeForMeta);
  var oAfterCutoff = Number.isFinite(oTargetMs) && Date.now() >= oTargetMs;
  var oWinnerInfo = resolveOverallWinnerInfo(oRows, oPrizeForMeta);

  var oRewardIdStr = oRewardId != null ? String(oRewardId).trim() : '';
  var oImageUrlStr = oImageUrl != null ? String(oImageUrl).trim() : '';
  if (!oRewardIdStr && !oImageUrlStr) return null;

  return {
    title:
      oPrizeForMeta.resolved_reward_title ||
      oPrizeForMeta.title ||
      oPrizeForMeta.name ||
      oPrizeForMeta.cover_title ||
      oPrizeForMeta.coverTitle ||
      'Reward',
    subtitle:
      (oAfterCutoff && oWinnerInfo.name
        ? 'Winner: ' + oWinnerInfo.name
        : oPrizeForMeta.subtitle ||
          oPrizeForMeta.description ||
          oPrizeForMeta.cover_text ||
          oPrizeForMeta.coverText) ||
      'Top points earner in your school wins this overall period',
    description: String(
      oPrizeForMeta.resolved_description ||
        oPrizeForMeta.description ||
        oPrizeForMeta.cover_text ||
        oPrizeForMeta.coverText ||
        oPrizeForMeta.body ||
        '',
    ).trim(),
    rewardId: oRewardId,
    imageUrl: oImageUrl,
    terms: oPrizeForMeta.terms || '',
    rows: oRows,
    weekEndsAt: null,
    winnerName: oAfterCutoff ? oWinnerInfo.name : '',
    winnerPoints: oAfterCutoff ? oWinnerInfo.points : null,
    candidateWinnerName: oWinnerInfo.name,
    candidateWinnerPoints: oWinnerInfo.points,
    targetMs: oTargetMs,
    periodKind: 'overall',
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

var WEEKLY_HOME_TROPHY_SVG = (function () {
  var s = String(trophyIconSvg)
    .replace(/^\s*<\?xml[^?]*\?>\s*/i, '')
    .replace(/<!--([\s\S]*?)-->/g, '');
  return s.replace(/<svg(\s[^>]*)>/i, function (_m, attrs) {
    var cleaned = String(attrs)
      .replace(/\s+width="[^"]*"/gi, '')
      .replace(/\s+height="[^"]*"/gi, '');
    return (
      '<svg class="hc-weekly-reward-home-tile-trophy" aria-hidden="true" focusable="false"' +
      cleaned +
      '>'
    );
  });
})();

export function buildWeeklyRewardHomeTileHtml(title, rewardId, opts) {
  opts = opts || {};
  var idStr = rewardId != null ? String(rewardId).trim() : '';
  if (!idStr) return '';
  var name = String(title || '').trim();
  var eyebrow = opts.eyebrow != null ? String(opts.eyebrow) : 'Weekly reward';
  var tileKind = opts.tileKind === 'overall' ? 'overall' : 'weekly';
  var html =
    '<button type="button" class="hc-weekly-reward-home-tile" data-home-lb-tile="' +
    escapeAttr(tileKind) +
    '" data-reward-id="' +
    escapeAttr(idStr) +
    '">';
  html += '<span class="hc-weekly-reward-home-tile-header">';
  html += '<span class="hc-weekly-reward-home-tile-eyebrow">' + escapeHtml(eyebrow) + '</span>';
  html +=
    '<svg class="hc-weekly-reward-home-tile-chevron" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
  html += '</span>';
  html += '<span class="hc-weekly-reward-home-tile-icon-wrap">' + WEEKLY_HOME_TROPHY_SVG + '</span>';
  if (name) {
    html += '<span class="hc-weekly-reward-home-tile-title">' + escapeHtml(name) + '</span>';
  }
  html += '</button>';
  return html;
}

export function openWeeklyLeaderboardModal(options) {
  var opts = options || {};
  var rows = Array.isArray(opts.rows) ? opts.rows.slice() : [];
  var rewardTitle = opts.rewardTitle != null ? String(opts.rewardTitle) : '';
  var rewardDescription = opts.rewardDescription != null ? String(opts.rewardDescription) : '';
  var rewardImageUrl = opts.rewardImageUrl ? normalizeMediaUrl(opts.rewardImageUrl) : null;

  function leaderboardSectionHtml(list) {
    if (!list.length) {
      return '<p class="hc-weekly-lb-empty">No rankings yet.</p>';
    }
    return buildWeeklyLeaderboardHtml(list, 100);
  }

  function rewardHeroHtml() {
    var t = rewardTitle.trim();
    var d = rewardDescription.trim();
    if (!t && !d && !rewardImageUrl) return '';
    var html = '<div class="hc-weekly-lb-reward-hero">';
    if (rewardImageUrl) {
      html +=
        '<div class="hc-weekly-lb-image-frame"><img class="hc-weekly-lb-reward-image" src="' +
        escapeAttr(rewardImageUrl) +
        '" alt=""/></div>';
    }
    if (t) {
      html += '<div class="hc-weekly-lb-reward-title">' + escapeHtml(t) + '</div>';
    }
    if (d) {
      html += '<div class="hc-weekly-lb-reward-desc">' + escapeHtml(d) + '</div>';
    }
    html += '</div>';
    return html;
  }

  var overlay = document.createElement('div');
  overlay.className = 'hc-weekly-lb-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML =
    '<div class="hc-weekly-lb-modal-header">' +
    '<button type="button" class="hc-weekly-lb-modal-back" data-weekly-lb-close="1"><span class="hc-weekly-lb-modal-back-icon" aria-hidden="true">‹</span><span>Home</span></button>' +
    '</div>' +
    '<div class="hc-weekly-lb-modal-scroll">' +
    '<div class="hc-weekly-lb-modal-inner">' +
    rewardHeroHtml() +
    '<div class="hc-weekly-lb-leaderboard-wrap">' +
    leaderboardSectionHtml(rows) +
    '</div></div></div>';

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  overlay.addEventListener('click', function (e) {
    if (e.target && e.target.closest('[data-weekly-lb-close="1"]')) close();
  });

  document.body.appendChild(overlay);
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

function getPrizeWebSocketUrl(prizeType) {
  var path = prizeType === 'overall' ? 'overall-prize' : 'weekly-prize';
  var h = window.location.hostname || '';
  if (h === 'embed.gethomecrowd.com') return 'wss://api.gethomecrowd.com/ws/' + path + '/';
  var env =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL;
  if (env) {
    var base = String(env).replace(/\/$/, '');
    return base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + '/ws/' + path + '/';
  }
  var port =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_PORT) || '8000';
  return 'ws://' + (h || 'localhost') + ':' + port + '/ws/' + path + '/';
}

export function connectWeeklyPrizeWebSocket(options) {
  var opts = options || {};
  var prizeType = opts.prizeType === 'overall' ? 'overall' : 'weekly';
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
      ws = new WebSocket(getPrizeWebSocketUrl(prizeType) + '?token=' + encodeURIComponent(token));
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

function winnerAlertKey(prize, prizeKind) {
  var kind = prizeKind === 'overall' ? 'overall-prize' : 'weekly-prize';
  if (!prize || typeof prize !== 'object') return kind + ':unknown';
  var idPart = prize.id || prize.week_end_date || prize.end_date || prize.endDate || 'unknown';
  return kind + ':' + idPart + ':' + (prize.winner_name || prize.winnerName || 'unknown');
}

export function showWeeklyWinnerModal(prize, fallbackTitle, options) {
  var opts = options || {};
  var prizeKind = opts.prizeKind === 'overall' ? 'overall' : 'weekly';
  var key = opts.alertKey != null ? opts.alertKey : winnerAlertKey(prize, prizeKind);
  if (!window.__hcWeeklyWinnerAlertShownKeys) window.__hcWeeklyWinnerAlertShownKeys = new Set();
  if (!opts.force && window.__hcWeeklyWinnerAlertShownKeys.has(key)) return;
  window.__hcWeeklyWinnerAlertShownKeys.add(key);

  var winnerName = prize && (prize.winner_name || prize.winnerName);
  var winnerPoints = prize && (prize.winner_points != null ? prize.winner_points : prize.winning_points);
  var prizeTitle =
    (prize && (prize.cover_title || prize.coverTitle || prize.title || prize.name)) ||
    fallbackTitle ||
    (prizeKind === 'overall' ? 'Overall reward' : 'Weekly reward');

  var winnerBadgeLabel =
    opts.winnerBadgeLabel != null ? String(opts.winnerBadgeLabel) : prizeKind === 'overall' ? 'Overall Winner' : 'Weekly Winner';

  var overlay = document.createElement('div');
  overlay.className = 'hc-weekly-winner-modal';
  overlay.innerHTML =
    '<div class="hc-weekly-winner-backdrop" data-weekly-winner-close="1"></div>' +
    '<div class="hc-weekly-winner-card">' +
    '<div class="hc-weekly-winner-badge">' +
    escapeHtml(winnerBadgeLabel) +
    '</div>' +
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
