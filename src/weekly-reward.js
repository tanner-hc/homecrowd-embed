import * as api from './api.js';
import lottie from 'lottie-web';
import confettiAnimation from './assets/Confetti.json';
import trophyIconSvg from './assets/icons/trophy.svg?raw';
import headerLogoUrl from './assets/header.png';
import { escapeHtml, escapeAttr } from './base-components/html.js';
import NavHeader from './base-components/NavHeader.js';
import {
  buildWinnerAlertFromWebSocketMessage,
  hasWinnerAlertBeenShown,
  markWinnerAlertBeenShown,
  pickUnshownWinnerAlert,
} from './winnerAlert.js';
import {
  formatPeriodCountdown,
  formatPeriodEndLocal,
  parsePeriodEndTimestamp,
} from './rewardPeriodCountdown.js';
import { createPrizeFinalizeModalWatcher } from './prizeFinalizeModal.js';

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
  return parsePeriodEndTimestamp(
    weekEndsAt,
    prize && typeof prize === 'object' ? prize.week_end_date || prize.weekEndDate : null,
    prize && typeof prize === 'object' ? prize.week_end_time || prize.weekEndTime : null,
  );
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

function isPrizeFinalized(prize) {
  if (!prize || typeof prize !== 'object') return false;
  if (prize.is_finalized === true || prize.isFinalized === true) return true;
  var winnerName = prize.winner_name || prize.winnerName;
  return prize.is_active === false && !!winnerName;
}

function isPlaceholderPrize(prize) {
  if (!prize || typeof prize !== 'object') return true;
  if (prize.id != null || prize.id === 0) return false;
  if (pickRewardId(prize)) return false;
  var title = String(prize.title || prize.cover_title || prize.coverTitle || '').toLowerCase();
  return title.indexOf('no reward') >= 0;
}

function isWeeklyPrizeVisible(prize) {
  if (!prize) return false;
  if (typeof prize === 'string') return !!String(prize).trim();
  if (isPlaceholderPrize(prize)) return false;
  if (prize.is_active === false && !isPrizeFinalized(prize)) return false;
  return true;
}

function isOverallPrizeVisible(prize) {
  if (!prize) return false;
  if (typeof prize === 'string') return !!String(prize).trim();
  if (isPlaceholderPrize(prize)) return false;
  if (prize.is_active === false && !isPrizeFinalized(prize)) return false;
  return true;
}

function resolveFinalizedWeeklyWinnerInfo(leaderboardRes, prize) {
  var lastWeekWinner =
    leaderboardRes && (leaderboardRes.last_week_prize_winner || leaderboardRes.lastWeekPrizeWinner);
  var fromLastWeek = getWinnerName(lastWeekWinner);
  if (fromLastWeek) {
    var fromLastWeekPoints =
      lastWeekWinner && typeof lastWeekWinner === 'object'
        ? Number(
            lastWeekWinner.winning_points != null
              ? lastWeekWinner.winning_points
              : lastWeekWinner.points,
          )
        : NaN;
    return {
      name: fromLastWeek,
      points: Number.isFinite(fromLastWeekPoints) && fromLastWeekPoints > 0 ? fromLastWeekPoints : null,
    };
  }

  if (isPrizeFinalized(prize)) {
    var finalizedName = getWinnerName(prize.winner_name || prize.winnerName || '');
    var fromPrize = Number(
      prize.winner_points != null ? prize.winner_points : prize.winning_points,
    );
    if (finalizedName) {
      return {
        name: finalizedName,
        points: Number.isFinite(fromPrize) && fromPrize > 0 ? fromPrize : null,
      };
    }
  }

  return { name: '', points: null };
}

function resolvePeriodLeaderInfo(rows) {
  var topRow = topLeaderboardRow(rows);
  if (!topRow) return { name: '', points: null };
  var points = Number(topRow.points);
  return {
    name: getWinnerName(topRow),
    points: Number.isFinite(points) ? points : null,
  };
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
    (prize && typeof prize === 'object' && (prize.overall_ends_at || prize.end_date || prize.endDate)) ||
    (leaderboardRes && (leaderboardRes.overall_period_ends_at || leaderboardRes.overallPeriodEndsAt)) ||
    null;
  return parsePeriodEndTimestamp(
    raw,
    prize && typeof prize === 'object' ? prize.end_date || prize.endDate : null,
    prize && typeof prize === 'object' ? prize.end_time || prize.endTime : null,
  );
}

function resolveFinalizedOverallWinnerInfo(prize) {
  if (!prize || typeof prize !== 'object') return { name: '', points: null };
  var winnerName = getWinnerName(prize.winner_name || prize.winnerName || '');
  if (!winnerName) return { name: '', points: null };
  var fromPrize = Number(
    prize.winner_points != null ? prize.winner_points : prize.winning_points,
  );
  return {
    name: winnerName,
    points: Number.isFinite(fromPrize) && fromPrize > 0 ? fromPrize : null,
  };
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
  if (!isWeeklyPrizeVisible(prize)) return null;
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
  var finalizedWinnerInfo = resolveFinalizedWeeklyWinnerInfo(leaderboardRes, prizeForMeta);
  var periodLeaderInfo = resolvePeriodLeaderInfo(rows);

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
      (afterCutoff && finalizedWinnerInfo.name
        ? 'Winner: ' + finalizedWinnerInfo.name
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
    winnerName: getWinnerName(prizeForMeta.winner_name || prizeForMeta.winnerName || ''),
    winnerPoints: afterCutoff ? finalizedWinnerInfo.points : null,
    candidateWinnerName: periodLeaderInfo.name,
    candidateWinnerPoints: periodLeaderInfo.points,
    targetMs: targetMs,
    periodKind: 'weekly',
    prizeId: prizeForMeta.id != null ? String(prizeForMeta.id) : null,
    weekEndDateOnly: prizeForMeta.week_end_date || prizeForMeta.weekEndDate || null,
    weekEndTime: prizeForMeta.week_end_time || prizeForMeta.weekEndTime || null,
  };
}

export async function buildOverallRewardContext(leaderboardRes) {
  var prize = pickOverallPrize(leaderboardRes);
  if (!isOverallPrizeVisible(prize)) return null;
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
  var oFinalizedWinnerInfo = resolveFinalizedOverallWinnerInfo(oPrizeForMeta);
  var oPeriodLeaderInfo = resolvePeriodLeaderInfo(oRows);

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
      (oAfterCutoff && oFinalizedWinnerInfo.name
        ? 'Winner: ' + oFinalizedWinnerInfo.name
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
    winnerName: getWinnerName(oPrizeForMeta.winner_name || oPrizeForMeta.winnerName || ''),
    winnerPoints: oAfterCutoff ? oFinalizedWinnerInfo.points : null,
    candidateWinnerName: oPeriodLeaderInfo.name,
    candidateWinnerPoints: oPeriodLeaderInfo.points,
    targetMs: oTargetMs,
    periodKind: 'overall',
    prizeId: oPrizeForMeta.id != null ? String(oPrizeForMeta.id) : null,
    periodEndsAt: oPrizeForMeta.overall_ends_at || oPrizeForMeta.end_date || oPrizeForMeta.endDate || null,
    periodEndDateOnly: oPrizeForMeta.end_date || oPrizeForMeta.endDate || null,
    periodEndTime: oPrizeForMeta.end_time || oPrizeForMeta.endTime || null,
  };
}

export function buildLeaderboardModalOptions(meta, leaderboardRes) {
  if (!meta) return null;
  var isOverall = meta.periodKind === 'overall';
  var prize = isOverall ? pickOverallPrize(leaderboardRes) : pickPrize(leaderboardRes);
  var contextLabel = isOverall ? 'Overall' : 'Weekly';
  var weekEndsAt = pickWeekEndsAt(leaderboardRes, prize);
  return {
    leaderboardType: isOverall ? 'overall' : 'weekly',
    contextLabel: contextLabel,
    rows: Array.isArray(meta.rows) ? meta.rows.slice() : [],
    rewardTitle: meta.title || '',
    rewardDescription: meta.description || '',
    rewardImageUrl: meta.imageUrl || null,
    periodEndsAt: isOverall
      ? (meta.periodEndsAt || (prize && (prize.overall_ends_at || prize.end_date || prize.endDate)) || null)
      : meta.weekEndsAt || weekEndsAt || null,
    periodEndDateOnly: isOverall
      ? meta.periodEndDateOnly || (prize && (prize.end_date || prize.endDate)) || null
      : meta.weekEndDateOnly || (prize && (prize.week_end_date || prize.weekEndDate)) || null,
    periodEndTime:
      meta.periodEndTime ||
      meta.weekEndTime ||
      (prize && (prize.end_time || prize.week_end_time || prize.weekEndTime)) ||
      null,
    prizeId: meta.prizeId || (prize && prize.id != null ? String(prize.id) : null),
    initialWinnerName: getWinnerName(
      (prize && (prize.winner_name || prize.winnerName)) || meta.winnerName || '',
    ),
    prizeTitle: meta.title || '',
  };
}

export function openWeeklyLeaderboardModalFromHome(meta, leaderboardRes) {
  return api
    .getLeaderboard()
    .catch(function () {
      return leaderboardRes || null;
    })
    .then(function (freshRes) {
      var lb = freshRes && freshRes.success !== false ? freshRes : leaderboardRes;
      var isOverall = meta && meta.periodKind === 'overall';
      var build = isOverall ? buildOverallRewardContext : buildWeeklyRewardContext;
      return build(lb).then(function (freshMeta) {
        var payload = buildLeaderboardModalOptions(freshMeta || meta, lb);
        if (payload) openWeeklyLeaderboardModal(payload);
      });
    });
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
  var leaderboardType = opts.leaderboardType === 'overall' ? 'overall' : 'weekly';
  var contextLabel = opts.contextLabel || (leaderboardType === 'overall' ? 'Overall' : 'Weekly');
  var periodEndsAt = opts.periodEndsAt || null;
  var periodEndDateOnly = opts.periodEndDateOnly || null;
  var periodEndTime = opts.periodEndTime || null;
  var prizeId = opts.prizeId || null;
  var prizeTitle = opts.prizeTitle != null ? String(opts.prizeTitle) : rewardTitle;
  var winnerName = String(opts.initialWinnerName || '').trim();
  var periodEndTimestamp = parsePeriodEndTimestamp(periodEndsAt, periodEndDateOnly, periodEndTime);
  var periodEndedRefreshDone = false;
  var countdownTimer = null;
  var pollTimer = null;
  var finalizeWatcher = null;

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

  function countdownCardHtml(nowMs) {
    if (!periodEndTimestamp || !Number.isFinite(periodEndTimestamp)) return '';
    var isEnded = nowMs >= periodEndTimestamp;
    var label = formatPeriodCountdown(periodEndTimestamp, nowMs, {
      contextLabel: contextLabel,
      endedText: contextLabel + ' period ended',
    });
    var localLabel = formatPeriodEndLocal(periodEndTimestamp);
    var html = '<div class="hc-weekly-lb-countdown-card">';
    html +=
      '<div class="hc-weekly-lb-countdown-eyebrow">' +
      escapeHtml(contextLabel + ' reward') +
      '</div>';
    html +=
      '<div class="hc-weekly-lb-countdown-value' +
      (isEnded ? ' hc-weekly-lb-countdown-value--ended' : '') +
      '">' +
      escapeHtml(label) +
      '</div>';
    if (localLabel) {
      html +=
        '<div class="hc-weekly-lb-countdown-sub">' +
        escapeHtml((isEnded ? 'Ended ' : 'Ends ') + localLabel) +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function winnerCardHtml() {
    if (!winnerName) return '';
    return (
      '<div class="hc-weekly-lb-winner-card">' +
      '<div class="hc-weekly-lb-winner-eyebrow">' +
      escapeHtml(contextLabel + ' Winner') +
      '</div>' +
      '<div class="hc-weekly-lb-winner-name">' +
      escapeHtml(winnerName) +
      '</div>' +
      '</div>'
    );
  }

  function renderBody() {
    var inner = overlay.querySelector('.hc-weekly-lb-modal-inner');
    if (!inner) return;
    var nowMs = Date.now();
    inner.innerHTML =
      countdownCardHtml(nowMs) +
      winnerCardHtml() +
      rewardHeroHtml() +
      '<div class="hc-weekly-lb-leaderboard-wrap">' +
      leaderboardSectionHtml(rows) +
      '</div>';
  }

  function applyPrizeFromLeaderboard(res) {
    if (!res || res.success === false) return;
    var prize = leaderboardType === 'overall' ? pickOverallPrize(res) : pickPrize(res);
    if (!prize) return;
    if (leaderboardType === 'overall') {
      rows = pickOverallRows(res);
      if (prize.end_date) periodEndDateOnly = prize.end_date;
      if (prize.overall_ends_at || prize.end_date) {
        periodEndsAt = prize.overall_ends_at || prize.end_date;
      }
      if (prize.end_time) periodEndTime = prize.end_time;
    } else {
      rows = pickRows(res);
      if (res.week_ends_at || res.weekEndsAt) {
        periodEndsAt = res.week_ends_at || res.weekEndsAt;
      } else if (prize.week_end_date) {
        periodEndDateOnly = prize.week_end_date;
      }
      if (prize.week_end_time) periodEndTime = prize.week_end_time;
    }
    if (prize.id != null) prizeId = String(prize.id);
    var nextWinner = getWinnerName(prize.winner_name || prize.winnerName || '');
    if (nextWinner) {
      winnerName = nextWinner;
    }
    periodEndTimestamp = parsePeriodEndTimestamp(periodEndsAt, periodEndDateOnly, periodEndTime);
    if (finalizeWatcher && typeof finalizeWatcher.updateContext === 'function') {
      finalizeWatcher.updateContext({
        periodEndsAt: periodEndsAt,
        periodEndDateOnly: periodEndDateOnly,
        periodEndTime: periodEndTime,
        prizeId: prizeId,
        prizeTitle: prizeTitle,
      });
      if (winnerName && typeof finalizeWatcher.onWinnerNameUpdate === 'function') {
        finalizeWatcher.onWinnerNameUpdate(winnerName);
      }
    }
    renderBody();
  }

  function refreshLeaderboard() {
    return api.getLeaderboard().then(applyPrizeFromLeaderboard).catch(function () {});
  }

  function schedulePeriodEndRefresh() {
    if (!periodEndTimestamp || !Number.isFinite(periodEndTimestamp)) return;
    var trigger = function () {
      if (periodEndedRefreshDone) return;
      periodEndedRefreshDone = true;
      refreshLeaderboard();
    };
    var msUntilEnd = periodEndTimestamp - Date.now();
    if (msUntilEnd <= 0) {
      trigger();
      return;
    }
    window.setTimeout(trigger, msUntilEnd + 500);
  }

  function startPolling() {
    if (!periodEndTimestamp || !Number.isFinite(periodEndTimestamp)) return;
    if (Date.now() < periodEndTimestamp || winnerName) return;
    pollTimer = window.setInterval(function () {
      if (winnerName) {
        window.clearInterval(pollTimer);
        pollTimer = null;
        return;
      }
      refreshLeaderboard();
    }, 15000);
  }

  var overlay = document.createElement('div');
  overlay.className = 'hc-weekly-lb-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML =
    '<div class="hc-weekly-lb-modal-header">' +
    '<div class="hc-header"><img src="' +
    escapeAttr(headerLogoUrl) +
    '" alt="Homecrowd" class="hc-header-logo" /></div>' +
    NavHeader({ title: 'Home', backButtonId: 'hc-weekly-lb-back' }) +
    '</div>' +
    '<div class="hc-weekly-lb-modal-scroll">' +
    '<div class="hc-weekly-lb-modal-inner"></div>' +
    '</div>';

  function teardown() {
    if (countdownTimer) window.clearInterval(countdownTimer);
    if (pollTimer) window.clearInterval(pollTimer);
    if (finalizeWatcher && typeof finalizeWatcher.destroy === 'function') finalizeWatcher.destroy();
    countdownTimer = null;
    pollTimer = null;
    finalizeWatcher = null;
  }

  function close() {
    teardown();
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  renderBody();

  if (periodEndTimestamp && Number.isFinite(periodEndTimestamp)) {
    countdownTimer = window.setInterval(function () {
      var card = overlay.querySelector('.hc-weekly-lb-countdown-card');
      if (!card) return;
      var nowMs = Date.now();
      var replacement = document.createElement('div');
      replacement.innerHTML = countdownCardHtml(nowMs);
      var nextCard = replacement.firstElementChild;
      if (nextCard) card.replaceWith(nextCard);
    }, 1000);
  }

  finalizeWatcher = createPrizeFinalizeModalWatcher({
    enabled: true,
    leaderboardType: leaderboardType,
    periodEndsAt: periodEndsAt,
    periodEndDateOnly: periodEndDateOnly,
    periodEndTime: periodEndTime,
    prizeId: prizeId,
    initialWinnerName: '',
    prizeTitle: prizeTitle,
  });

  schedulePeriodEndRefresh();
  startPolling();
  refreshLeaderboard();

  var backBtn = overlay.querySelector('#hc-weekly-lb-back');
  if (backBtn) {
    backBtn.addEventListener('click', close);
  }

  document.body.appendChild(overlay);
}

export function buildWeeklyCountdownLabel(meta) {
  if (!meta) return '';
  var contextLabel = meta.periodKind === 'overall' ? 'Overall' : 'Weekly';
  var targetMs =
    meta.targetMs != null
      ? meta.targetMs
      : parsePeriodEndTimestamp(
          meta.periodEndsAt || meta.weekEndsAt,
          meta.periodEndDateOnly || meta.weekEndDateOnly,
          meta.periodEndTime || meta.weekEndTime,
        );
  return formatPeriodCountdown(targetMs, Date.now(), {
    contextLabel: contextLabel,
    endedText: contextLabel + ' period ended',
  });
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

export function showWeeklyWinnerModal(prize, fallbackTitle, options) {
  var opts = options || {};
  var prizeKind = opts.prizeKind === 'overall' ? 'overall' : 'weekly';
  var message =
    prizeKind === 'overall'
      ? { type: 'overall_prize_finalized', overall_prize: prize }
      : { type: 'weekly_prize_finalized', weekly_prize: prize };
  var alert = opts.alert || buildWinnerAlertFromWebSocketMessage(message);
  if (!alert && prize) {
    alert = {
      kind: prizeKind,
      key: null,
      winnerName: prize.winner_name || prize.winnerName || '',
      winnerPoints: prize.winner_points != null ? prize.winner_points : prize.winning_points,
      prizeTitle:
        (prize.cover_title || prize.coverTitle || prize.title || prize.name) ||
        fallbackTitle ||
        (prizeKind === 'overall' ? 'Overall reward' : 'Weekly reward'),
      winnerBadgeLabel: prizeKind === 'overall' ? 'Overall Winner' : 'Weekly Winner',
    };
  }
  if (!alert) return;
  var key = opts.alertKey != null ? opts.alertKey : alert.key;
  if (!opts.force && key && hasWinnerAlertBeenShown(key)) return;
  if (key) markWinnerAlertBeenShown(key);

  var winnerName = alert.winnerName || (prize && (prize.winner_name || prize.winnerName));
  var prizeTitle =
    alert.prizeTitle ||
    (prize && (prize.cover_title || prize.coverTitle || prize.title || prize.name)) ||
    fallbackTitle ||
    (prizeKind === 'overall' ? 'Overall reward' : 'Weekly reward');

  var winnerBadgeLabel =
    opts.winnerBadgeLabel != null
      ? String(opts.winnerBadgeLabel)
      : alert.winnerBadgeLabel ||
        (prizeKind === 'overall' ? 'Overall Winner' : 'Weekly Winner');

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

export function tryShowMissedWinnerModalFromLeaderboard(leaderboardRes, fallbackWeeklyTitle, fallbackOverallTitle) {
  var alert = pickUnshownWinnerAlert(leaderboardRes);
  if (!alert) return false;
  markWinnerAlertBeenShown(alert.key);
  var fallbackTitle =
    alert.kind === 'overall' ? fallbackOverallTitle || 'Overall reward' : fallbackWeeklyTitle || 'Weekly reward';
  showWeeklyWinnerModal(
    {
      winner_name: alert.winnerName,
      winner_points: alert.winnerPoints,
      title: alert.prizeTitle,
    },
    fallbackTitle,
    {
      prizeKind: alert.kind,
      alert: alert,
      alertKey: alert.key,
    },
  );
  return true;
}
