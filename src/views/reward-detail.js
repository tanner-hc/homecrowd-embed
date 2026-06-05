import * as api from '../api.js';
import { canPayWithStripeEmbed } from '../rewardPricing.js';
import { resolveCardLinkStatus } from '../cardLinkStatus.js';
import { formatDisplayNumber } from '../formatNumber.js';
import RafflePill, { attachRafflePillAuction } from '../base-components/RafflePill.js';
import MainButton from '../base-components/MainButton.js';
import NavHeader from '../base-components/NavHeader.js';
import { buildRewardsLinkCardBanner } from '../rewardsLinkCardBanner.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { showSuccess, showError } from '../base-components/toastApi.js';
import { writeRedemptionConfirmAndNavigate } from './redemption-confirmation.js';
import { parsePeriodEndTimestamp } from '../rewardPeriodCountdown.js';
import { isRewardBeforeStart } from '../rewardStartLock.js';
import { createPrizeFinalizeModalWatcher } from '../prizeFinalizeModal.js';
import {
  buildOverallRewardContext,
  buildWeeklyCountdownLabel,
  buildWeeklyLeaderboardHtml,
  buildWeeklyRewardContext,
} from '../weekly-reward.js';

var weeklyDetailLiveCleanup = null;

export function renderRewardDetail(container, ctx) {
  if (weeklyDetailLiveCleanup) {
    weeklyDetailLiveCleanup();
    weeklyDetailLiveCleanup = null;
  }
  var product = normalizeProduct(ctx.product);
  var summary = ctx.summary;
  var currentUser = ctx.currentUser || null;
  var cardLinkStatus = ctx.cardLinkStatus || 'unknown';
  var ticketsResponse = ctx.ticketsResponse;
  var weeklyReward = ctx.weeklyReward || null;

  var html = buildDetailHtml(product, summary, currentUser, cardLinkStatus, ticketsResponse, weeklyReward);
  container.innerHTML = html;
  bindDetailEvents(container, product, summary, currentUser, cardLinkStatus, ticketsResponse, weeklyReward);
}

function normalizeProduct(p) {
  if (!p) return null;
  var ri = p.raffle_info || p.raffleInfo;
  var ai = p.auction_info || p.auctionInfo;
  var rt = (p.redemption_type || p.redemptionType || '').toLowerCase();
  var pts = p.points_cost != null ? p.points_cost : p.pointsCost;
  var cents = p.cash_price_cents != null ? p.cash_price_cents : p.cashPriceCents;
  var enabled =
    p.enabled !== false &&
    p.is_active !== false &&
    (!p.has_inventory || p.inventory_count == null || p.inventory_count > 0);

  return {
    id: p.id,
    title: p.title,
    description: p.description,
    points_cost: pts,
    pointsCost: pts,
    cash_price_cents: cents,
    cashPriceCents: cents,
    reward_type: p.reward_type || p.rewardType,
    redemption_type: rt,
    redemptionType: rt,
    is_active: p.is_active !== false,
    is_locked: !!(p.is_locked || p.isLocked),
    images: p.images || [],
    image_url: p.image_url || p.imageUrl,
    imageUrl: p.image_url || p.imageUrl,
    raffle_info: ri,
    raffleInfo: ri,
    auction_info: ai,
    auctionInfo: ai,
    enabled: enabled,
    has_inventory: p.has_inventory,
    inventory_count: p.inventory_count,
  };
}

function getAvailablePoints(summary) {
  if (!summary) return 0;
  return summary.availablePoints != null ? summary.availablePoints : summary.available_points || 0;
}

function isEarlyReleaseUser(u) {
  return !!(u && u.activeSchool && u.activeSchool.earlyRelease);
}

function countUniversalTickets(ticketsResponse) {
  var t = ticketsResponse && (ticketsResponse.results || ticketsResponse);
  if (!Array.isArray(t)) return 0;
  return t.filter(function (x) {
    return !x.raffle;
  }).length;
}

function parseDateEndOfDay(dateStr) {
  if (!dateStr) return null;
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

function isPastEvent(product) {
  if (product.redemption_type === 'raffle' && product.raffle_info && product.raffle_info.drawing_date) {
    var d = parseDateEndOfDay(product.raffle_info.drawing_date);
    return d ? d < new Date() : false;
  }
  if (product.redemption_type === 'auction' && product.auction_info && product.auction_info.end_date) {
    var d2 = parseDateEndOfDay(product.auction_info.end_date);
    return d2 ? d2 < new Date() : false;
  }
  return false;
}

function formatLongDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function collectImageUrls(product, getUrl) {
  if (product.images && product.images.length > 0) {
    var sorted = product.images.slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    });
    var out = [];
    sorted.forEach(function (img) {
      var path = img.image_path || img.imagePath;
      if (path) out.push(getUrl(path));
    });
    return out.filter(Boolean);
  }
  if (product.image_url || product.imageUrl) {
    return [getUrl(product.image_url || product.imageUrl)];
  }
  return [];
}

function buildDetailHtml(product, summary, currentUser, cardLinkStatus, ticketsResponse, weeklyReward) {
  var getUrl = function (path) {
    if (!path) return null;
    if (typeof path === 'string' && path.indexOf('s3://') === 0) {
      return path.replace('s3://', 'https://');
    }
    if (typeof path === 'string' && path.indexOf('s3://app.gethomecrowd.com/') === 0) {
      return path.replace('s3://app.gethomecrowd.com/', 'https://app.gethomecrowd.com/');
    }
    return path;
  };

  var isEarlyRelease = isEarlyReleaseUser(currentUser);
  var showLockedBanner = !isEarlyRelease && cardLinkStatus === 'unlinked';
  var availablePts = getAvailablePoints(summary);
  var ticketCount = countUniversalTickets(ticketsResponse);

  var isPast = isPastEvent(product);
  var isEventType = product.redemption_type === 'raffle' || product.redemption_type === 'auction';
  var completed = isEventType ? isPast : !product.is_active;
  var timeLocked = isRewardBeforeStart(product);
  var cardLockedActive = !isEarlyRelease && cardLinkStatus === 'unlinked';
  var isLocked = product.is_locked || timeLocked;

  var redemptionType = product.redemption_type || '';
  var stripeCents = Number(product.cash_price_cents);
  var canPayWithStripe = canPayWithStripeEmbed({
    enabled: product.enabled,
    cashPriceCents: product.cash_price_cents,
    redemptionType: redemptionType,
  }) && !weeklyReward;
  var isCardOnly = redemptionType === 'card';
  var detailCashOk =
    Number.isFinite(stripeCents) &&
    stripeCents >= 50 &&
    (redemptionType === 'first' || redemptionType === 'card') &&
    !weeklyReward;

  var userId = currentUser && currentUser.id ? String(currentUser.id) : '';
  var raffleInfo = product.raffle_info;
  var auctionInfo = product.auction_info;

  var userWonAuction =
    redemptionType === 'auction' &&
    auctionInfo &&
    auctionInfo.status === 'ended' &&
    auctionInfo.final_winner &&
    String(auctionInfo.final_winner) === userId;

  var userWonRaffle =
    redemptionType === 'raffle' &&
    raffleInfo &&
    raffleInfo.status === 'completed' &&
    raffleInfo.winner &&
    String(raffleInfo.winner) === userId;

  var raffleCompletedByStatus = redemptionType === 'raffle' && raffleInfo && raffleInfo.status === 'completed';
  var raffleDrawingPassed =
    redemptionType === 'raffle' &&
    raffleInfo &&
    raffleInfo.drawing_date &&
    (function() { var d = parseDateEndOfDay(raffleInfo.drawing_date); return d ? new Date() >= d : false; })();
  var raffleCompleteButNotDrawn = raffleDrawingPassed && !raffleCompletedByStatus;

  var userEntries = (raffleInfo && raffleInfo.user_entries) || 0;
  var participated = userEntries > 0;
  var userLostRaffle = raffleCompletedByStatus && participated && !userWonRaffle;
  var userDidntParticipate = raffleCompletedByStatus && !participated;

  var canRedeemPts = availablePts >= (product.points_cost || 0);
  var canEnterRaffle =
    redemptionType === 'raffle' &&
    canRedeemPts &&
    !isLocked &&
    !raffleDrawingPassed &&
    !raffleCompletedByStatus;

  var hideMainProductBlock =
    redemptionType === 'raffle' && raffleInfo && raffleInfo.status === 'completed' && userWonRaffle;

  var images = collectImageUrls(product, getUrl);

  var html = '';

  html += '<div class="hc-product-detail' + (completed ? ' hc-product-detail--completed' : '') + '">';

  html += '<div class="hc-product-detail-nav-sticky">';
  html += NavHeader({
    title: 'Rewards',
    backButtonId: 'hc-back-btn',
  });
  html += '</div>';

  html += '<div class="hc-product-detail-scroll">';

  html += '<div class="' + (completed ? 'hc-product-completed-wrap' : '') + '">';
  html += buildCarouselHtml(images);
  html += '</div>';

  html += '<div class="hc-detail-header' + (completed ? ' hc-product-completed-wrap' : '') + '">';
  html += '<div class="hc-detail-title">' + escapeHtml(product.title) + '</div>';
  html +=
    '<div class="hc-detail-category">' +
    escapeHtml(capitalize(product.reward_type || 'merchandise')) +
    '</div>';

  if (!isEarlyRelease && !weeklyReward) {
    html += '<div class="hc-product-points-row">';
    if (redemptionType === 'card') {
      if (detailCashOk) {
        html +=
          '<span class="hc-product-cash">' + escapeHtml('$' + (stripeCents / 100).toFixed(2)) + '</span>';
      } else if (!weeklyReward) {
        html += '<span class="hc-product-points-muted">Card price not set</span>';
      }
    } else {
      html +=
        '<span class="hc-product-points">' +
        formatDisplayNumber(product.points_cost || 0) +
        ' points</span>';
      if (detailCashOk) {
        html += '<span class="hc-product-or"> or </span>';
        html +=
          '<span class="hc-product-cash">' +
          escapeHtml('$' + (stripeCents / 100).toFixed(2)) +
          '</span>';
      }
    }
    html += '</div>';
  }
  html += '</div>';

  if (timeLocked && redemptionType === 'raffle' && raffleInfo && raffleInfo.start_date) {
    html += '<div class="hc-product-drawing-date">';
    html += '<div class="hc-product-drawing-label">Opens</div>';
    html += '<div class="hc-product-drawing-value">' + escapeHtml(formatLongDate(raffleInfo.start_date)) + '</div>';
    html += '</div>';
  }

  if (redemptionType === 'raffle' && raffleInfo && raffleInfo.drawing_date) {
    html += '<div class="hc-product-drawing-date">';
    html += '<div class="hc-product-drawing-label">Drawing Date</div>';
    html += '<div class="hc-product-drawing-value">' + escapeHtml(formatLongDate(raffleInfo.drawing_date)) + '</div>';
    html += '</div>';
  }

  if (
    redemptionType === 'raffle' &&
    raffleInfo &&
    !(raffleInfo.status === 'completed' && raffleInfo.winner && String(raffleInfo.winner) === userId)
  ) {
    html += '<div class="hc-product-raffle-entries">';
    html +=
      '<span class="hc-product-raffle-entries-text">' +
      (isPast ? 'You had' : 'You have') +
      ' <strong class="hc-product-raffle-count">' +
      formatDisplayNumber(userEntries) +
      '</strong> ' +
      (userEntries === 1 ? 'entry' : 'entries') +
      ' in this raffle</span>';
    html += '</div>';
  }

  if (redemptionType === 'auction' && auctionInfo && userWonAuction) {
    html += '<div class="hc-product-winner-auction">';
    html += '<div class="hc-product-winner-emoji">🏆</div>';
    html += '<div class="hc-product-winner-title">Congratulations, You Won!</div>';
    html +=
      '<div class="hc-product-winner-sub">You won this auction with a bid of <strong>' +
      formatDisplayNumber(auctionInfo.current_highest_bid || 0) +
      '</strong> points</div>';
    html += '<div class="hc-product-winner-contact">You will be contacted with more details</div>';
    html += '</div>';
  }

  if (redemptionType === 'raffle' && raffleInfo && raffleInfo.status === 'completed' && userWonRaffle) {
    html += '<div class="hc-product-winner-raffle">';
    html += '<div class="hc-product-winner-emoji">🎉</div>';
    html += '<div class="hc-product-winner-title">Congratulations, You Won!</div>';
    html += '<div class="hc-product-winner-sub">You won the raffle drawing for this prize!</div>';
    html += '<div class="hc-product-winner-contact">You will be contacted with more details</div>';
    html += '</div>';
    html += '<div class="hc-product-raffle-entries">';
    html +=
      '<span class="hc-product-raffle-entries-text">You had <strong class="hc-product-raffle-count">' +
      formatDisplayNumber(userEntries) +
      '</strong> ' +
      (userEntries === 1 ? 'entry' : 'entries') +
      ' in this raffle</span>';
    html += '</div>';
  }

  if (!hideMainProductBlock) {
    html += '<div class="' + (completed ? 'hc-product-completed-wrap' : '') + '">';
    if (redemptionType === 'auction' && auctionInfo) {
      html += buildAuctionBidStatusHtml(auctionInfo);
      html += buildAuctionPillHtml(auctionInfo);
    }
    if (product.description) {
      html += '<div class="hc-product-desc-wrap">';
      html += '<div class="hc-detail-desc-text">' + nlToBr(escapeHtml(product.description)) + '</div>';
      html += '</div>';
    }
    if (weeklyReward) {
      html += buildWeeklyDetailHtml(weeklyReward);
    }
    html += '</div>';
  }

  if (completed) {
    html += '<div class="hc-product-ended-banner">';
    html += '<div class="hc-product-ended-title">This Event Has Ended</div>';
    if (redemptionType === 'raffle' && raffleInfo && raffleInfo.drawing_date) {
      html +=
        '<div class="hc-product-ended-date">Drawing was on ' +
        escapeHtml(formatLongDate(raffleInfo.drawing_date)) +
        '</div>';
    }
    if (redemptionType === 'auction' && auctionInfo && auctionInfo.end_date) {
      html +=
        '<div class="hc-product-ended-date">Auction ended on ' +
        escapeHtml(formatLongDate(auctionInfo.end_date)) +
        '</div>';
    }
    if (auctionInfo && auctionInfo.final_winner) {
      html += '<div class="hc-product-ended-note">Winner will be notified via email</div>';
    }
    html += '</div>';
  }

  html += '<div class="hc-product-detail-spacer"></div>';
  html += '</div>';

  html += buildBottomBarHtml({
    product: product,
    summary: summary,
    showLockedBanner: showLockedBanner,
    currentUser: currentUser,
    canPayWithStripe: canPayWithStripe && !cardLockedActive && !isLocked,
    isCardOnly: isCardOnly,
    stripeCents: stripeCents,
    redemptionType: redemptionType,
    cardLockedActive: cardLockedActive,
    isLocked: isLocked,
    isEarlyRelease: isEarlyRelease,
    ticketCount: ticketCount,
    availablePts: availablePts,
    completed: completed,
    userWonAuction: userWonAuction,
    userWonRaffle: userWonRaffle,
    raffleCompleteButNotDrawn: raffleCompleteButNotDrawn,
    userLostRaffle: userLostRaffle,
    userDidntParticipate: userDidntParticipate,
    canEnterRaffle: canEnterRaffle,
    canRedeemPts: canRedeemPts,
    auctionInfo: auctionInfo,
    auctionExpired:
      redemptionType === 'auction' &&
      auctionInfo &&
      auctionInfo.end_date &&
      (function() { var d = parseDateEndOfDay(auctionInfo.end_date); return d ? new Date() >= d : false; })(),
    weeklyReward: weeklyReward,
  });

  html += '</div>';

  return html;
}

function attachWeeklyRewardDetailLiveUpdates(container, initialReward) {
  var state = Object.assign({}, initialReward);
  var periodEndedRefreshDone = false;
  var countdownTimer = null;
  var pollTimer = null;
  var periodEndTimer = null;
  var finalizeWatcher = null;

  function getPeriodFields() {
    var isOverall = state.periodKind === 'overall';
    return {
      periodEndsAt: isOverall ? state.periodEndsAt : state.weekEndsAt,
      periodEndDateOnly: isOverall ? state.periodEndDateOnly : state.weekEndDateOnly,
      periodEndTime: isOverall ? state.periodEndTime : state.weekEndTime,
    };
  }

  function getPeriodEndTimestamp() {
    var fields = getPeriodFields();
    return parsePeriodEndTimestamp(fields.periodEndsAt, fields.periodEndDateOnly, fields.periodEndTime);
  }

  function startCountdownTimer() {
    if (countdownTimer) window.clearInterval(countdownTimer);
    var countdownEl = container.querySelector('.hc-weekly-countdown-text');
    if (!countdownEl) return;
    countdownTimer = window.setInterval(function () {
      countdownEl.textContent = buildWeeklyCountdownLabel(state);
    }, 1000);
  }

  function replaceWeeklySection() {
    var section = container.querySelector('.hc-weekly-detail-section');
    if (!section) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = buildWeeklyDetailHtml(state);
    var next = wrap.firstElementChild;
    if (next) section.replaceWith(next);
    startCountdownTimer();
  }

  function syncFinalizeWatcher() {
    if (!finalizeWatcher || typeof finalizeWatcher.updateContext !== 'function') return;
    var fields = getPeriodFields();
    finalizeWatcher.updateContext({
      periodEndsAt: fields.periodEndsAt,
      periodEndDateOnly: fields.periodEndDateOnly,
      periodEndTime: fields.periodEndTime,
      prizeId: state.prizeId,
      prizeTitle: state.title || '',
    });
    if (state.winnerName && typeof finalizeWatcher.onWinnerNameUpdate === 'function') {
      finalizeWatcher.onWinnerNameUpdate(state.winnerName);
    }
  }

  function refreshFromApi() {
    return api
      .getLeaderboard()
      .then(function (lb) {
        if (!lb || lb.success === false) return null;
        var build =
          state.periodKind === 'overall' ? buildOverallRewardContext : buildWeeklyRewardContext;
        return build(lb);
      })
      .then(function (next) {
        if (!next || String(next.rewardId) !== String(state.rewardId)) return;
        Object.assign(state, next);
        replaceWeeklySection();
        syncFinalizeWatcher();
        if (state.winnerName && pollTimer) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
      })
      .catch(function () {});
  }

  function schedulePeriodEndRefresh() {
    var ts = getPeriodEndTimestamp();
    if (!ts || !Number.isFinite(ts)) return;
    var trigger = function () {
      if (periodEndedRefreshDone) return;
      periodEndedRefreshDone = true;
      refreshFromApi();
    };
    var msUntilEnd = ts - Date.now();
    if (msUntilEnd <= 0) {
      trigger();
      return;
    }
    periodEndTimer = window.setTimeout(trigger, msUntilEnd + 500);
  }

  function startPolling() {
    var ts = getPeriodEndTimestamp();
    if (!ts || !Number.isFinite(ts)) return;
    if (Date.now() < ts || state.winnerName) return;
    pollTimer = window.setInterval(function () {
      if (state.winnerName) {
        window.clearInterval(pollTimer);
        pollTimer = null;
        return;
      }
      refreshFromApi();
    }, 15000);
  }

  var periodFields = getPeriodFields();
  finalizeWatcher = createPrizeFinalizeModalWatcher({
    enabled: true,
    leaderboardType: state.periodKind === 'overall' ? 'overall' : 'weekly',
    periodEndsAt: periodFields.periodEndsAt,
    periodEndDateOnly: periodFields.periodEndDateOnly,
    periodEndTime: periodFields.periodEndTime,
    prizeId: state.prizeId,
    initialWinnerName: state.winnerName || '',
    prizeTitle: state.title || '',
  });

  startCountdownTimer();
  schedulePeriodEndRefresh();
  startPolling();
  refreshFromApi();

  return function teardownWeeklyDetailLive() {
    if (countdownTimer) window.clearInterval(countdownTimer);
    if (pollTimer) window.clearInterval(pollTimer);
    if (periodEndTimer) window.clearTimeout(periodEndTimer);
    if (finalizeWatcher && typeof finalizeWatcher.destroy === 'function') finalizeWatcher.destroy();
    countdownTimer = null;
    pollTimer = null;
    periodEndTimer = null;
    finalizeWatcher = null;
  };
}

function buildWeeklyDetailHtml(weeklyReward) {
  if (!weeklyReward) return '';
  var isOverall = weeklyReward.periodKind === 'overall';
  var html = '<div class="hc-weekly-detail-section">';
  var countdownLabel = buildWeeklyCountdownLabel(weeklyReward);
  if (countdownLabel) {
    html += '<div class="hc-weekly-countdown-badge">';
    html += '<span class="hc-weekly-countdown-text">' + escapeHtml(countdownLabel) + '</span>';
    html += '</div>';
  }
  if (weeklyReward.winnerName) {
    html += '<div class="hc-weekly-winner-badge-inline">';
    html +=
      '<div class="hc-weekly-winner-inline-title">' +
      escapeHtml(isOverall ? 'Overall Winner' : 'Weekly Winner') +
      '</div>';
    html += '<div class="hc-weekly-winner-inline-name">' + escapeHtml(weeklyReward.winnerName) + '</div>';
    html += '</div>';
  }
  if (weeklyReward.terms) {
    html += '<div class="hc-weekly-detail-card">';
    html += '<div class="hc-weekly-detail-title">Terms</div>';
    html += '<div class="hc-weekly-detail-body">' + nlToBr(escapeHtml(weeklyReward.terms)) + '</div>';
    html += '</div>';
  }
  if (weeklyReward.rows && weeklyReward.rows.length) {
    html += '<div class="hc-weekly-detail-card">';
    html +=
      '<div class="hc-weekly-detail-title">' +
      escapeHtml(isOverall ? 'Overall leaderboard' : 'Weekly leaderboard') +
      '</div>';
    html += buildWeeklyLeaderboardHtml(weeklyReward.rows, 10);
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function buildCarouselHtml(urls) {
  var spacer = '<div class="hc-carousel-spacer" aria-hidden="true"></div>';
  var inner = '';
  if (!urls.length) {
    inner =
      '<div class="hc-carousel">' +
      spacer +
      '<div class="hc-carousel-slide"><div class="hc-carousel-ph">No Image</div></div>' +
      spacer +
      '</div>';
    return '<div class="hc-product-carousel-bleed">' + inner + '</div>';
  }
  inner = '<div class="hc-carousel">' + spacer;
  urls.forEach(function (url) {
    inner +=
      '<div class="hc-carousel-slide"><div class="hc-carousel-img-wrap"><img class="hc-carousel-img" src="' +
      escapeAttr(url) +
      '" alt="" /></div></div>';
  });
  inner += spacer + '</div>';
  if (urls.length > 1) {
    inner += '<div class="hc-carousel-dots">';
    urls.forEach(function (_, i) {
      inner += '<span class="hc-carousel-dot' + (i === 0 ? ' active' : '') + '"></span>';
    });
    inner += '</div>';
  }
  return '<div class="hc-product-carousel-bleed">' + inner + '</div>';
}

function buildAuctionBidStatusHtml(auctionInfo) {
  var ub = auctionInfo.user_current_bid;
  var ch = auctionInfo.current_highest_bid;
  if (ub == null || ub === '') return '';
  var winning = Number(ub) === Number(ch);
  var cls = winning ? 'hc-auction-bid-status--win' : 'hc-auction-bid-status--out';
  var title = winning ? "You're the highest bidder!" : "You've been outbid";
  return '<div class="hc-auction-bid-status ' + cls + '">' + escapeHtml(title) + '</div>';
}

function buildAuctionPillHtml(auctionInfo) {
  if (!auctionInfo || !auctionInfo.end_date) return '';
  return RafflePill({
    type: 'auction',
    auctionInfo: auctionInfo,
    status: auctionInfo.status || 'active',
  });
}

function buildBottomBarHtml(o) {
  var product = o.product;
  var rt = o.redemptionType;
  if (o.weeklyReward) {
    return '<div class="hc-detail-bottom hc-detail-bottom--empty" id="hc-detail-bottom"></div>';
  }
  var hideFooter =
    (o.completed && rt !== 'auction' && rt !== 'raffle') ||
    (rt === 'auction' && o.userWonAuction) ||
    (rt === 'raffle' && o.userWonRaffle);

  if (hideFooter) {
    return '<div class="hc-detail-bottom hc-detail-bottom--empty" id="hc-detail-bottom"></div>';
  }

  var html = '<div class="hc-detail-bottom hc-product-bottom" id="hc-detail-bottom">';

  if (o.showLockedBanner) {
    html += buildRewardsLinkCardBanner(o.currentUser);
  }

  if (rt === 'auction' && o.auctionInfo) {
    if (o.userWonAuction) {
      html += '</div>';
      return html;
    }
    var minBid = o.auctionInfo.current_highest_bid
      ? Number(o.auctionInfo.current_highest_bid) + Number(o.auctionInfo.minimum_increment || 0)
      : Number(o.auctionInfo.starting_bid || 0);
    var afford = o.availablePts >= minBid;
    var auctionDisabled =
      o.auctionExpired || !afford || o.cardLockedActive || o.isLocked || o.auctionInfo.status !== 'active';
    var btnLabel = o.isLocked ? 'Locked' : o.auctionExpired ? 'Auction Ended' : afford ? 'Place Bid' : 'Minimum Bid: ' + formatDisplayNumber(minBid) + ' pts';

    html += '<div id="hc-bid-panel" style="display:none" class="hc-bid-panel">';
    html += '<div class="hc-bid-row">Current Bid: ' + formatDisplayNumber(o.auctionInfo.current_highest_bid || o.auctionInfo.starting_bid) + ' pts</div>';
    html += '<div class="hc-bid-row hc-bid-row--muted">Minimum Bid: ' + formatDisplayNumber(minBid) + ' pts</div>';
    html +=
      '<input type="number" id="hc-bid-input" class="hc-bid-input" placeholder="Enter bid amount" />';
    html += MainButton({ id: 'hc-bid-submit', text: 'Submit Bid' });
    html += '</div>';

    html += MainButton({
      id: 'hc-place-bid-toggle',
      text: btnLabel,
      disabled: auctionDisabled,
    });
    html += '</div>';
    return html;
  }

  if (rt === 'raffle') {
    if (o.userWonRaffle) {
      html += '</div>';
      return html;
    }
    if (o.raffleCompleteButNotDrawn || o.userLostRaffle || o.userDidntParticipate) {
      html += '<div class="hc-raffle-ended-msg">';
      html +=
        '<div class="hc-raffle-ended-title">' +
        (o.userLostRaffle ? 'Thanks for participating!' : 'Raffle Complete') +
        '</div>';
      html +=
        '<div class="hc-raffle-ended-sub">' +
        (o.userLostRaffle
          ? "You didn't win this time, but keep trying!"
          : 'This raffle has ended. Check out our other active raffles for a chance to win!') +
        '</div>';
      html += '</div>';
      html += '</div>';
      return html;
    }


    var raffleDisabled = !o.canEnterRaffle || o.cardLockedActive || o.isLocked;
    html += MainButton({
      id: 'hc-redeem-raffle',
      disabled: raffleDisabled,
      text: o.isLocked ? 'Locked' : '',
      html: o.isLocked
        ? null
        : 'Redeem for&nbsp;<strong>' +
          formatDisplayNumber(product.points_cost || 0) +
          ' pts</strong>',
    });
    html += '</div>';
    return html;
  }

  html += '<div class="hc-checkout-actions">';
  if (!o.isCardOnly) {
    var redeemDisabled = !o.canRedeemPts || o.cardLockedActive || o.isLocked;
    html += MainButton({
      id: 'hc-detail-redeem',
      disabled: redeemDisabled,
      text: o.isLocked ? 'Locked' : '',
      html: o.isLocked
        ? null
        : 'Redeem for&nbsp;<strong>' +
          formatDisplayNumber(product.points_cost || 0) +
          ' pts</strong>',
    });
  }
  if (o.canPayWithStripe) {
    html += MainButton({
      id: 'hc-detail-stripe',
      outlined: true,
      className: 'hc-stripe-pay',
      text: 'Pay $' + (o.stripeCents / 100).toFixed(2) + ' with card',
    });
  }
  html += '</div>';
  html += '</div>';
  return html;
}

function bindDetailEvents(container, product, summary, currentUser, cardLinkStatus, ticketsResponse, weeklyReward) {
  var backBtn = document.getElementById('hc-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      window.location.hash = '#/rewards';
    });
  }

  var linkBtn = container.querySelector('.hc-stores-link-card-btn');
  if (linkBtn) {
    linkBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      window.location.hash = '#/cards';
    });
  }

  initCarouselDots(container);
  syncDetailScrollPadding(container);

  attachRafflePillAuction(container);

  if (weeklyReward) {
    weeklyDetailLiveCleanup = attachWeeklyRewardDetailLiveUpdates(container, weeklyReward);
    window.addEventListener(
      'hashchange',
      function () {
        if (weeklyDetailLiveCleanup) {
          weeklyDetailLiveCleanup();
          weeklyDetailLiveCleanup = null;
        }
      },
      { once: true },
    );
  }

  var stripeCents = Number(product.cash_price_cents != null ? product.cash_price_cents : product.cashPriceCents);
  var cardLockedActive = !isEarlyReleaseUser(currentUser) && cardLinkStatus === 'unlinked';
  var timeLocked = isRewardBeforeStart(product);
  var isLocked = product.is_locked || timeLocked;

  var stripeBtn = document.getElementById('hc-detail-stripe');
  var canPayStripeCalc = canPayWithStripeEmbed({
    enabled: product.enabled,
    cashPriceCents: product.cash_price_cents != null ? product.cash_price_cents : product.cashPriceCents,
    redemptionType: product.redemption_type || product.redemptionType,
  });
  if (stripeBtn && canPayStripeCalc && !cardLockedActive && !isLocked) {
    stripeBtn.addEventListener('click', function () {
      var avail = getAvailablePoints(summary);
      writeRedemptionConfirmAndNavigate(product, {
        availablePoints: avail,
        availableTickets: 0,
        payWithStripe: true,
        useRaffleTicket: false,
      });
    });
  }

  var redeemBtn = document.getElementById('hc-detail-redeem');
  var ptsCost = product.points_cost || 0;
  var avail = getAvailablePoints(summary);
  var rtRedeem = product.redemption_type || '';
  if (
    redeemBtn &&
    avail >= ptsCost &&
    ptsCost > 0 &&
    rtRedeem !== 'auction' &&
    rtRedeem !== 'raffle' &&
    rtRedeem !== 'card'
  ) {
    redeemBtn.addEventListener('click', function () {
      writeRedemptionConfirmAndNavigate(product, {
        availablePoints: avail,
        availableTickets: 0,
        payWithStripe: false,
        useRaffleTicket: false,
      });
    });
  }

  var ticketCount = countUniversalTickets(ticketsResponse);

  var rafflePts = document.getElementById('hc-redeem-pts');
  if (rafflePts) {
    rafflePts.addEventListener('click', function () {
      if (rafflePts.disabled) return;
      writeRedemptionConfirmAndNavigate(product, {
        availablePoints: avail,
        availableTickets: ticketCount,
        payWithStripe: false,
        useRaffleTicket: false,
      });
    });
  }


  var raffleSingle = document.getElementById('hc-redeem-raffle');
  if (raffleSingle) {
    raffleSingle.addEventListener('click', function () {
      if (raffleSingle.disabled) return;
      writeRedemptionConfirmAndNavigate(product, {
        availablePoints: avail,
        availableTickets: ticketCount,
        payWithStripe: false,
        useRaffleTicket: false,
      });
    });
  }

  var bidToggle = document.getElementById('hc-place-bid-toggle');
  var bidPanel = document.getElementById('hc-bid-panel');
  if (bidToggle && bidPanel) {
    bidToggle.addEventListener('click', function () {
      if (bidToggle.disabled) return;
      bidPanel.style.display = bidPanel.style.display === 'none' ? 'block' : 'none';
      bidToggle.style.display = bidPanel.style.display === 'block' ? 'none' : 'block';
      syncDetailScrollPadding(container);
    });
  }

  var bidSubmit = document.getElementById('hc-bid-submit');
  if (bidSubmit && product.auction_info) {
    bidSubmit.addEventListener('click', async function () {
      var input = document.getElementById('hc-bid-input');
      var raw = input && input.value;
      var amt = parseFloat(raw);
      if (!raw || isNaN(amt) || amt <= 0) {
        showError('Please enter a valid bid amount.');
        return;
      }
      bidSubmit.disabled = true;
      try {
        await api.placeAuctionBid(product.auction_info.id, amt);
        showSuccess('Bid placed!');
        window.location.reload();
      } catch (err) {
        showError(err.message || 'Bid failed.');
        bidSubmit.disabled = false;
      }
    });
  }
}

function syncDetailScrollPadding(container) {
  var scrollEl = container.querySelector('.hc-product-detail-scroll');
  var bottomEl = container.querySelector('#hc-detail-bottom');
  if (!scrollEl || !bottomEl) return;

  var applyPadding = function () {
    var height = bottomEl.getBoundingClientRect().height;
    scrollEl.style.paddingBottom = height
      ? Math.ceil(height + 16) + 'px'
      : '24px';
  };

  applyPadding();

  if (typeof ResizeObserver !== 'undefined') {
    var observer = new ResizeObserver(applyPadding);
    observer.observe(bottomEl);
    window.addEventListener(
      'hashchange',
      function () {
        observer.disconnect();
      },
      { once: true },
    );
  } else {
    window.addEventListener('resize', applyPadding);
    window.addEventListener(
      'hashchange',
      function () {
        window.removeEventListener('resize', applyPadding);
      },
      { once: true },
    );
  }
}

function initCarouselDots(container) {
  var carousel = container.querySelector('.hc-carousel');
  if (!carousel) return;
  var dots = container.querySelectorAll('.hc-carousel-dot');
  if (!dots.length) return;
  carousel.addEventListener('scroll', function () {
    var slides = carousel.querySelectorAll('.hc-carousel-slide');
    if (!slides.length) return;
    var cRect = carousel.getBoundingClientRect();
    var mid = cRect.left + cRect.width / 2;
    var best = 0;
    var bestDist = Infinity;
    slides.forEach(function (slide, i) {
      var r = slide.getBoundingClientRect();
      var sc = r.left + r.width / 2;
      var dist = Math.abs(sc - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    dots.forEach(function (d, i) {
      d.classList.toggle('active', i === best);
    });
  });
}

function capitalize(s) {
  if (!s) return '';
  return String(s)
    .split('_')
    .map(function (part) {
      return part ? part.charAt(0).toUpperCase() + part.slice(1) : '';
    })
    .join(' ');
}

function nlToBr(s) {
  return s.replace(/\n/g, '<br>');
}

