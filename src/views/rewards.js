import * as api from '../api.js';
import * as analytics from '../analytics.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { buildAppHeaderHtml, attachAppHeader } from '../base-components/AppHeader.js';
import { buildPurchasesFootnoteHtml } from '../purchasesFootnote.js';
import { escapeHtml } from '../base-components/html.js';
import { getNavEpoch } from '../router.js';
import {
  buildOverallRewardContext,
  buildPrizeCountdownLabel,
  buildWeeklyCountdownLabel,
  buildWeeklyRewardContext,
} from '../weekly-reward.js';
import {
  buildPrizeCardHtml,
  bindPrizeCards,
  bindPrizeCardCountdowns,
} from '../components/Rewards/PrizeCard.js';
import { buildRewardSectionsHtml } from '../components/Rewards/RewardListRow.js';
import {
  buildPointsMilestonesCardHtml,
  bindPointsMilestonesCard,
  normalizeMilestones,
} from '../components/Dashboard/PointsMilestonesCard.js';
var weeklyCountdownCleanup = null;

export function renderRewards(container, routeEpoch) {
  container.innerHTML = LoadingSpinner({
    text: 'Loading rewards...',
    className: 'hc-rewards-loading',
  });
  loadRewards(container, routeEpoch);
}

function normalizeMediaUrl(url) {
  if (!url) return null;
  if (typeof url === 'string' && url.indexOf('s3://') === 0) {
    return url.replace('s3://', 'https://');
  }
  return url;
}

function pickNestedDate(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  var i;
  for (i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = obj[k];
    if (v !== undefined && v !== null && String(v).length > 0) {
      return String(v);
    }
  }
  return null;
}

function normalizeReward(r) {
  var raffleSrc = r.raffle_info || r.raffleInfo || null;
  var auctionSrc = r.auction_info || r.auctionInfo || null;

  var raffle_info = raffleSrc ? Object.assign({}, raffleSrc) : {};
  var auction_info = auctionSrc ? Object.assign({}, auctionSrc) : {};

  var flatDrawing =
    pickNestedDate(r, ['drawing_date', 'drawingDate', 'raffle_drawing_date', 'raffleDrawingDate']);
  var flatStart =
    pickNestedDate(r, ['start_date', 'startDate', 'raffle_start_date', 'raffleStartDate']);
  var flatAuctionEnd =
    pickNestedDate(r, [
      'auction_end_date',
      'auctionEndDate',
      'auction_end',
      'auctionEnd',
      'ends_at',
      'endsAt',
      'end_date',
      'endDate',
      'auction_closes_at',
      'auctionClosesAt',
    ]) || null;

  var nestedDrawing =
    pickNestedDate(raffle_info, ['drawing_date', 'drawingDate']) || flatDrawing;
  var nestedStart =
    pickNestedDate(raffle_info, ['start_date', 'startDate']) || flatStart;
  var nestedAuctionEnd =
    pickNestedDate(auction_info, ['end_date', 'endDate', 'ends_at', 'endsAt']) || flatAuctionEnd;

  if (nestedDrawing) {
    raffle_info.drawing_date = nestedDrawing;
  }
  if (nestedStart) {
    raffle_info.start_date = nestedStart;
  }
  if (nestedAuctionEnd) {
    auction_info.end_date = nestedAuctionEnd;
  }

  var redemption_type = (r.redemption_type || r.redemptionType || '').toLowerCase();
  if (!redemption_type || redemption_type === 'general') {
    var hasR = !!(raffle_info && raffle_info.drawing_date);
    var hasA = !!(auction_info && auction_info.end_date);
    if (hasR && !hasA) {
      redemption_type = 'raffle';
    } else if (hasA && !hasR) {
      redemption_type = 'auction';
    } else if (hasR && hasA) {
      redemption_type = 'raffle';
    } else {
      var wt = String(r.reward_type || r.rewardType || '').toLowerCase();
      if (wt.indexOf('raffle') >= 0) redemption_type = 'raffle';
      else if (wt.indexOf('auction') >= 0) redemption_type = 'auction';
    }
  }

  return {
    id: r.id,
    title: r.title,
    description: r.description,
    points_cost: r.points_cost != null ? r.points_cost : r.pointsCost,
    cash_price_cents: r.cash_price_cents != null ? r.cash_price_cents : r.cashPriceCents,
    reward_type: r.reward_type || r.rewardType,
    redemption_type: redemption_type,
    raffle_info: Object.keys(raffle_info).length ? raffle_info : null,
    auction_info: Object.keys(auction_info).length ? auction_info : null,
    images: r.images || [],
    image_url: r.image_url || r.imageUrl,
    is_featured: !!(r.isFeatured || r.is_featured),
    is_locked: !!(r.is_locked || r.isLocked),
    is_active: r.is_active !== false && r.enabled !== false,
  };
}

/* Ported from the mobile app's utils/rewardStartLock so the embed orders and
   gates rewards on the same fields it does. */
function getRewardStartDate(r) {
  return (
    (r && r.raffle_info && r.raffle_info.start_date) ||
    (r && r.auction_info && r.auction_info.start_date) ||
    null
  );
}

function getRewardEndDate(r) {
  return (
    (r && r.raffle_info && r.raffle_info.drawing_date) ||
    (r && r.auction_info && r.auction_info.end_date) ||
    null
  );
}

/**
 * A bare YYYY-MM-DD parses as UTC midnight, which lands on the previous day in
 * any timezone behind UTC — "Sep 25" would label itself "Thursday, Sep 24". Read
 * those as local calendar days; leave real timestamps alone.
 */
function parseRewardDate(dateStr) {
  if (!dateStr) return null;
  var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  if (parts) {
    return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  }
  var d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/** A date-only value closes at the end of that day, not at its midnight. */
function parseDateEndOfDay(dateStr) {
  var d = parseRewardDate(dateStr);
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

/** "Friday, Sep 25" — the same heading mobile puts above each day's rewards. */
function formatSectionDate(dateStr) {
  var d = parseRewardDate(dateStr);
  if (!d) return null;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Adapted from the mobile organizeRewardsByDate. Rewards group under the day
 * they open, soonest first; ones carrying no date at all collect under
 * "Available" at the end. Anything whose raffle or auction has already closed is
 * dropped — it can no longer be entered, so it is not offered here.
 *
 * @returns {Array<{ title: string, rows: Array<object> }>}
 */
function groupRewardsByDate(rewards, nowMs) {
  var byDay = {};
  var order = [];
  var noDate = [];

  rewards.forEach(function (r) {
    var closedAt = parseDateEndOfDay(getRewardEndDate(r));
    if (closedAt && closedAt.getTime() < nowMs) return;

    var startDate = getRewardStartDate(r);
    var openKey = formatSectionDate(startDate);
    if (!openKey) {
      noDate.push(r);
      return;
    }
    if (!byDay[openKey]) {
      byDay[openKey] = {
        title: openKey,
        rawMs: parseRewardDate(startDate).getTime(),
        rows: [],
      };
      order.push(byDay[openKey]);
    }
    byDay[openKey].rows.push(r);
  });

  var sections = order.sort(function (a, b) {
    return a.rawMs - b.rawMs;
  });
  if (noDate.length) {
    sections = sections.concat([{ title: 'Available', rows: noDate }]);
  }
  return sections;
}

/**
 * Whether the Redeem chip reads as an available action. Matches the detail
 * screen's canRedeemPts/canEnterRaffle: a raffle entry costs the reward's
 * points_cost, so one comparison covers both. Auctions take a bid rather than a
 * redemption, so they never light up here.
 */
function isRewardRedeemable(r, availablePoints, nowMs) {
  if (!r || r.is_locked) return false;
  if (r.redemption_type === 'auction') return false;
  if (availablePoints < (r.points_cost || 0)) return false;
  if (r.redemption_type === 'raffle') {
    var drawing = parseDateEndOfDay(getRewardEndDate(r));
    if (drawing && drawing.getTime() < nowMs) return false;
  }
  return true;
}

function getRewardImageUrl(item, getImageUrl) {
  if (item.image_url) {
    return getImageUrl(item.image_url);
  }
  if (item.images && item.images.length > 0) {
    var primaryImage = null;
    var i;
    for (i = 0; i < item.images.length; i++) {
      if (item.images[i].is_primary || item.images[i].isPrimary) {
        primaryImage = item.images[i];
        break;
      }
    }
    if (!primaryImage) primaryImage = item.images[0];
    return getImageUrl(primaryImage.image_path || primaryImage.imagePath);
  }
  return null;
}

function buildWeeklyRewardListItem(weeklyReward) {
  if (!weeklyReward || !weeklyReward.rewardId) return null;
  return {
    id: weeklyReward.rewardId,
    title: weeklyReward.title || 'Weekly Leaderboard',
    description: weeklyReward.subtitle || '',
    points_cost: 0,
    cash_price_cents: null,
    reward_type: 'weekly_reward',
    redemption_type: 'weekly',
    raffle_info: null,
    auction_info: null,
    images: [],
    image_url: weeklyReward.imageUrl,
    is_locked: false,
    is_active: true,
    weeklyCountdownLabel: buildWeeklyCountdownLabel(weeklyReward) || weeklyReward.subtitle || '',
    weeklyTargetMs: weeklyReward.targetMs,
  };
}

function buildOverallRewardListItem(overallReward) {
  if (!overallReward || !overallReward.rewardId) return null;
  return {
    id: overallReward.rewardId,
    title: overallReward.title || 'Overall Leaderboard',
    description: overallReward.subtitle || '',
    points_cost: 0,
    cash_price_cents: null,
    reward_type: 'overall_reward',
    redemption_type: 'overall',
    raffle_info: null,
    auction_info: null,
    images: [],
    image_url: overallReward.imageUrl,
    is_locked: false,
    is_active: true,
    weeklyCountdownLabel: buildWeeklyCountdownLabel(overallReward) || overallReward.subtitle || '',
    weeklyTargetMs: overallReward.targetMs,
  };
}

function lookupRewardForClick(rewardIdStr, formattedRewards, weeklyRewardItem, overallRewardItem) {
  var idStr = rewardIdStr != null ? String(rewardIdStr) : '';
  if (!idStr) return null;
  if (
    weeklyRewardItem &&
    weeklyRewardItem.id != null &&
    String(weeklyRewardItem.id) === idStr
  ) {
    return weeklyRewardItem;
  }
  if (
    overallRewardItem &&
    overallRewardItem.id != null &&
    String(overallRewardItem.id) === idStr
  ) {
    return overallRewardItem;
  }
  var found =
    formattedRewards &&
    formattedRewards.find(function (r) {
      return String(r.id) === idStr;
    });
  if (found) return found;
  return {
    id: idStr,
    title: '',
    redemption_type: null,
    points_cost: null,
  };
}

function buildRewardDetailHash(rewardItem, source) {
  if (!rewardItem || rewardItem.id == null) return '#/rewards';
  var hash = '#/rewards/' + encodeURIComponent(rewardItem.id);
  var params = [];
  if (source) params.push('from=' + encodeURIComponent(source));
  if (rewardItem.redemption_type === 'weekly') params.push('weekly=1');
  if (rewardItem.redemption_type === 'overall') params.push('overall=1');
  return params.length ? hash + '?' + params.join('&') : hash;
}

function attachWeeklyCountdown(container) {
  if (weeklyCountdownCleanup) {
    weeklyCountdownCleanup();
    weeklyCountdownCleanup = null;
  }
  var stop = bindPrizeCardCountdowns(container);
  weeklyCountdownCleanup = function () {
    stop();
    weeklyCountdownCleanup = null;
  };
  window.addEventListener(
    'hashchange',
    function () {
      if (weeklyCountdownCleanup) weeklyCountdownCleanup();
    },
    { once: true },
  );
}

async function loadRewards(container, routeEpoch) {
  if (weeklyCountdownCleanup) {
    weeklyCountdownCleanup();
    weeklyCountdownCleanup = null;
  }
  try {
    var results = await Promise.all([
      api.getRewardsSummary(),
      api.getRewardsCatalog(),
      api.fetchCurrentUser(),
      api.getLeaderboard().catch(function () {
        return null;
      }),
      api.getFirstRewards().catch(function () {
        return null;
      }),
    ]);
    var summary = results[0];
    var catalogRaw = results[1];
    var currentUser = results[2];
    var leaderboardRes = results[3];
    var firstRewardsRes = results[4];

    var catalog = Array.isArray(catalogRaw)
      ? catalogRaw
      : (catalogRaw && catalogRaw.results) || [];
    var formattedRewards = catalog.map(normalizeReward);
    var leaderboardActive = !leaderboardRes || leaderboardRes.leaderboard_active !== false;
    var weeklyReward = leaderboardActive ? await buildWeeklyRewardContext(leaderboardRes) : null;
    var overallReward = leaderboardActive ? await buildOverallRewardContext(leaderboardRes) : null;

    var availablePoints =
      (summary && (summary.availablePoints != null
        ? summary.availablePoints
        : summary.available_points)) || 0;

    var html = '';

    html += '<div class="hc-rewards-page">';

    // Same header as home and shop: title left, profile + points right.
    html += buildAppHeaderHtml({
      title: 'Rewards',
      user: currentUser,
      points: availablePoints,
    });

    html += '<div class="hc-rewards-page-pad">';

    var weeklyRewardItem = weeklyReward ? buildWeeklyRewardListItem(weeklyReward) : null;
    var overallRewardItem = overallReward ? buildOverallRewardListItem(overallReward) : null;

    function getImageUrl(path) {
      return normalizeMediaUrl(path);
    }

    // Featured rewards lead the page, above the prizes, and are held back from
    // the catalogue below so they never appear twice.
    var featuredRewards = formattedRewards.filter(function (r) {
      return r && r.id != null && r.is_featured && r.is_active !== false;
    });
    if (featuredRewards.length) {
      html += '<div class="hc-prize-cards hc-rewards-featured">';
      featuredRewards.forEach(function (r) {
        html += buildPrizeCardHtml({
          label: 'Featured',
          title: r.title,
          imageUrl: getRewardImageUrl(r, getImageUrl),
          rewardId: r.id,
        });
      });
      html += '</div>';
    }

    if (weeklyRewardItem || overallRewardItem) {
      // Two prizes sit side by side; a lone one still spans the full width.
      html +=
        '<div class="hc-prize-cards' +
        (weeklyRewardItem && overallRewardItem ? ' hc-prize-cards--pair' : '') +
        '">';
      if (weeklyRewardItem) {
        html += buildPrizeCardHtml({
          kind: 'weekly',
          title: weeklyReward.title,
          imageUrl: weeklyReward.imageUrl,
          statusText: buildPrizeCountdownLabel(weeklyReward),
      targetMs: weeklyReward.targetMs,
          rewardId: weeklyReward.rewardId,
        });
      }
      if (overallRewardItem) {
        html += buildPrizeCardHtml({
          kind: 'overall',
          title: overallReward.title,
          imageUrl: overallReward.imageUrl,
          statusText: buildPrizeCountdownLabel(overallReward),
      targetMs: overallReward.targetMs,
          rewardId: overallReward.rewardId,
        });
      }
      html += '</div>';
    }

    var milestones = normalizeMilestones(firstRewardsRes);
    if (milestones.length) {
      html += '<div class="hc-rewards-unlock">';
      html += '<div class="hc-rewards-unlock-title">Unlock with points</div>';
      html += buildPointsMilestonesCardHtml({
        points: (firstRewardsRes && firstRewardsRes.earnedPoints) || 0,
        milestones: milestones,
        rowsOnly: true,
      });
      html += '</div>';
    }

    // The rest of the catalogue, under the ladder. The prize cards above are
    // leaderboard rewards and the ladder is the first-reward set, so neither
    // overlaps this list.
    var nowMs = Date.now();
    var otherRewards = formattedRewards.filter(function (r) {
      return r && r.id != null && r.is_active !== false && !r.is_featured;
    });
    if (otherRewards.length) {
      var rewardSections = groupRewardsByDate(otherRewards, nowMs).map(function (section) {
        return {
          title: section.title,
          rows: section.rows.map(function (r) {
            return {
              id: r.id,
              title: r.title,
              pointsCost: r.points_cost,
              imageUrl: getRewardImageUrl(r, getImageUrl),
              redemptionType: r.redemption_type,
              redeemable: isRewardRedeemable(r, availablePoints, nowMs),
            };
          }),
        };
      });
      html += '<div class="hc-rewards-other">';
      html += '<div class="hc-rewards-other-title">More rewards</div>';
      html += buildRewardSectionsHtml(rewardSections);
      html += '</div>';
    }
    html += buildPurchasesFootnoteHtml();
    html += '</div>';
    html += '</div>';

    if (routeEpoch !== getNavEpoch() || !container.isConnected) {
      return;
    }

    container.innerHTML = html;

    attachAppHeader(container, { user: currentUser });
    attachWeeklyCountdown(container);

    // Same lookup + analytics path the old weekly/overall tiles used, so the
    // prize cards land on the identical reward detail route.
    bindPrizeCards(container, {
      onPress: function (rewardId) {
        if (!rewardId) return;
        var clicked = lookupRewardForClick(
          rewardId,
          formattedRewards,
          weeklyRewardItem,
          overallRewardItem,
        );
        analytics.trackEmbedRewardClick(clicked, currentUser);
        window.location.hash = buildRewardDetailHash(clicked, 'rewards');
      },
    });

    var milestonesRoot = container.querySelector('.hc-milestones');
    if (milestonesRoot) {
      bindPointsMilestonesCard(milestonesRoot, {
        onPressMilestone: function (id) {
          window.location.hash = '#/first-rewards/' + encodeURIComponent(id) + '?from=rewards';
        },
        onRedeem: function (id) {
          window.location.hash =
            '#/first-rewards/' + encodeURIComponent(id) + '/redeem?from=rewards';
        },
      });
    }

    container._hcLeaderboardRes = leaderboardRes || null;
    container.onclick = function (e) {
      var card = e.target.closest('[data-reward-id]');
      if (!card) return;
      var rewardId = card.getAttribute('data-reward-id');
      var clickedReward = lookupRewardForClick(
        rewardId,
        formattedRewards,
        weeklyRewardItem,
        overallRewardItem,
      );
      analytics.trackEmbedRewardClick(
        clickedReward,
        currentUser,
      );
      window.location.hash = buildRewardDetailHash(clickedReward, 'rewards');
    };

    var linkBtn = container.querySelector('.hc-stores-link-card-btn');
    if (linkBtn) {
      linkBtn.onclick = function (ev) {
        ev.stopPropagation();
        window.location.hash = '#/cards/link-intro';
      };
    }
  } catch (err) {
    if (routeEpoch !== getNavEpoch() || !container.isConnected) {
      return;
    }
    container.innerHTML =
      '<div class="hc-alert-error">Failed to load rewards: ' + escapeHtml(err.message) + '</div>';
  }
}

