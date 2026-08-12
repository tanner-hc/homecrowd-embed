import * as api from '../api.js';
import * as analytics from '../analytics.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { buildAppHeaderHtml, attachAppHeader } from '../base-components/AppHeader.js';
import { buildPurchasesFootnoteHtml } from '../purchasesFootnote.js';
import { escapeHtml } from '../base-components/html.js';
import { getNavEpoch } from '../router.js';
import {
  getRewardEndDate,
  getRewardStartDate,
  isFeaturedRewardLive,
  parseDateEndOfDay,
  parseRewardDate,
} from '../reward-window.js';
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
import {
  buildRewardListHtml,
  buildRewardSectionsHtml,
} from '../components/Rewards/RewardListRow.js';
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
 * Catalogue order, in three tiers:
 *
 *   1. Live and timed — soonest to close first, because those are the ones with
 *      a deadline worth acting on.
 *   2. Not open yet — soonest to open first.
 *   3. No schedule at all — plain rewards that are always available, so they sit
 *      at the bottom where they are not competing with anything time-bound.
 *
 * Rewards that have already closed are dropped, the rule groupRewardsByDate
 * applied back when this list was grouped under date headings.
 *
 * @param {Array<object>} rewards
 * @param {number} nowMs
 */
function orderRewardsForCatalogue(rewards, nowMs) {
  function openMs(r) {
    var d = parseRewardDate(getRewardStartDate(r));
    return d ? d.getTime() : null;
  }
  function closeMs(r) {
    var d = parseDateEndOfDay(getRewardEndDate(r));
    return d ? d.getTime() : null;
  }
  function tierOf(r) {
    var opens = openMs(r);
    if (opens != null && opens > nowMs) return 1;
    return closeMs(r) != null ? 0 : 2;
  }

  var rows = rewards.filter(function (r) {
    var closesAt = closeMs(r);
    return !(closesAt != null && closesAt < nowMs);
  });

  // Decorate with the original index so the dateless tier keeps the order it
  // arrived in — Array.prototype.sort is only stable per spec since ES2019, and
  // there is nothing meaningful to sort those by anyway.
  return rows
    .map(function (r, index) {
      return { reward: r, index: index, tier: tierOf(r) };
    })
    .sort(function (a, b) {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.tier === 0) return closeMs(a.reward) - closeMs(b.reward);
      if (a.tier === 1) return openMs(a.reward) - openMs(b.reward);
      return a.index - b.index;
    })
    .map(function (entry) {
      return entry.reward;
    });
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

    // One clock for the whole render, so the featured slot and the catalogue
    // below can never disagree about what is still open.
    var nowMs = Date.now();

    // Featured rewards lead the page, above the prizes, and are held back from
    // the catalogue below so they never appear twice.
    // Featured is a flag, not a schedule: a flagged raffle whose drawing has
    // passed, or that has not opened yet, must not hold the top slot.
    var featuredRewards = formattedRewards.filter(function (r) {
      return isFeaturedRewardLive(r, nowMs);
    });
    // Ids actually rendered at the top, so the catalogue can exclude exactly
    // those and no more.
    var featuredIds = {};
    featuredRewards.forEach(function (r) {
      featuredIds[String(r.id)] = true;
    });
    if (featuredRewards.length) {
      html += '<div class="hc-prize-cards hc-rewards-featured">';
      featuredRewards.forEach(function (r) {
        html += buildPrizeCardHtml({
          label: 'Featured Reward',
          title: r.title,
          imageUrl: getRewardImageUrl(r, getImageUrl),
          rewardId: r.id,
        });
      });
      html += '</div>';
    }

    if (weeklyRewardItem || overallRewardItem) {
      // Two prizes sit side by side; a lone one still spans the full width, and
      // at full width it is the taller layout the design uses for the featured
      // card rather than the paired one.
      var prizesPaired = !!(weeklyRewardItem && overallRewardItem);
      html +=
        '<div class="hc-prize-cards' + (prizesPaired ? ' hc-prize-cards--pair' : '') + '">';
      if (weeklyRewardItem) {
        html += buildPrizeCardHtml({
          kind: 'weekly',
          title: weeklyReward.title,
          imageUrl: weeklyReward.imageUrl,
          statusText: buildPrizeCountdownLabel(weeklyReward),
          targetMs: weeklyReward.targetMs,
          rewardId: weeklyReward.rewardId,
          compact: prizesPaired,
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
          compact: prizesPaired,
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
    // Excludes what the featured slot is showing, not everything flagged
    // featured: a flagged reward that has not opened yet fails the window check
    // above, and keying this off `is_featured` would drop it from the page
    // altogether rather than listing it here with its "Opens ..." pill.
    var otherRewards = formattedRewards.filter(function (r) {
      return r && r.id != null && r.is_active !== false && !featuredIds[String(r.id)];
    });
    if (otherRewards.length) {
      var rewardRows = orderRewardsForCatalogue(otherRewards, nowMs).map(function (r) {
        // A reward whose window has not opened shows when it will instead
        // of an action it cannot take yet.
        var startsAt = parseRewardDate(getRewardStartDate(r));
        var notOpenYet = !!startsAt && startsAt.getTime() > nowMs;
        return {
          id: r.id,
          title: r.title,
          pointsCost: r.points_cost,
          imageUrl: getRewardImageUrl(r, getImageUrl),
          redemptionType: r.redemption_type,
          redeemable: isRewardRedeemable(r, availablePoints, nowMs),
          opensLabel: notOpenYet
            ? 'Opens ' +
              startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '',
        };
      });
      html += '<div class="hc-rewards-other">';
      html += '<div class="hc-rewards-other-title">Prizes</div>';
      // Grouping under "Friday, Sep 25" style headings is off for now — the
      // catalogue is one flat grid. Restore by swapping the two lines below and
      // rebuilding sections with groupRewardsByDate().
      // html += buildRewardSectionsHtml(rewardSections);
      html += buildRewardListHtml(rewardRows);
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
      var openFirstReward = function (id) {
        window.location.hash = '#/first-rewards/' + encodeURIComponent(id) + '?from=rewards';
      };
      bindPointsMilestonesCard(milestonesRoot, {
        onPressMilestone: openFirstReward,
        onRedeem: openFirstReward,
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

