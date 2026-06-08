import * as api from '../api.js';
import * as analytics from '../analytics.js';
import { resolveCardLinkStatus } from '../cardLinkStatus.js';
import { formatDisplayNumber } from '../formatNumber.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import ScreenTitle from '../base-components/ScreenTitle.js';
import EmptyState from '../base-components/EmptyState.js';
import Button from '../base-components/Button.js';
import { buildRewardsLinkCardBanner } from '../rewardsLinkCardBanner.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { getNavEpoch } from '../router.js';
import {
  buildOverallRewardContext,
  buildWeeklyCountdownLabel,
  buildWeeklyRewardContext,
  openWeeklyLeaderboardModalFromHome,
} from '../weekly-reward.js';
import { getRewardEndDate, getRewardStartDate, isRewardBeforeStart } from '../rewardStartLock.js';
var weeklyCountdownCleanup = null;

function removeFloatingPointsOverlay() {
  var el = document.getElementById('hc-rewards-points-overlay');
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

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
    is_locked: !!(r.is_locked || r.isLocked),
    is_active: r.is_active !== false && r.enabled !== false,
  };
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

function formatDate(dateStr) {
  if (!dateStr) return null;
  var date = new Date(dateStr);
  var options = { weekday: 'long', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function organizeRewardsByDate(rewards) {
  var now = new Date();
  var sections = [];
  var past = [];
  var upcoming = {};
  var noDate = [];

  rewards.forEach(function (reward) {
    var sortDate = getRewardStartDate(reward);
    var endDate = getRewardEndDate(reward);

    if (!sortDate) {
      noDate.push(reward);
    } else {
      var closedAt = endDate ? new Date(endDate) : null;
      if (closedAt && closedAt < now) {
        past.push(Object.assign({}, reward, { eventDate: endDate }));
      } else {
        var dateKey = formatDate(sortDate);
        if (!upcoming[dateKey]) {
          upcoming[dateKey] = {
            title: dateKey,
            data: [],
            rawDate: sortDate,
          };
        }
        upcoming[dateKey].data.push(Object.assign({}, reward, { eventDate: sortDate }));
      }
    }
  });

  if (past.length > 0) {
    var sortedPast = past
      .sort(function (a, b) {
        return new Date(b.eventDate) - new Date(a.eventDate);
      })
      .slice(0, 2);
    sections.push({
      title: 'Recently Closed',
      data: sortedPast,
      isPast: true,
    });
  }

  var upcomingSections = Object.values(upcoming).sort(function (a, b) {
    return new Date(a.rawDate) - new Date(b.rawDate);
  });
  upcomingSections.forEach(function (s) {
    sections.push(s);
  });

  if (noDate.length > 0) {
    sections.push({
      title: 'More Rewards',
      data: noDate,
      isAlwaysAvailable: true,
    });
  }

  return sections;
}

function buildRewardCardHtml(item, section, cardLinkStatus, isEarlyRelease, getImageUrl) {
  var isPast = section.isPast || false;
  var isTimeLocked = !isPast && isRewardBeforeStart(item);
  var isCardLocked = !isEarlyRelease && cardLinkStatus === 'unlinked';
  var isLocked = item.is_locked || isTimeLocked;

  var imageUrl = getRewardImageUrl(item, getImageUrl);

  var cashCents = Number(item.cash_price_cents);
  var cashPriceLabel =
    Number.isFinite(cashCents) &&
    cashCents >= 50 &&
    (item.redemption_type === 'first' || item.redemption_type === 'card')
      ? '$' + (cashCents / 100).toFixed(2)
      : null;

  var html = '';
  html +=
    '<div class="hc-reward-card' +
    (isPast ? ' hc-reward-card--past' : '') +
    '" data-reward-id="' +
    escapeAttr(item.id) +
    '">';

  html += '<div class="hc-reward-image-section">';
  if (imageUrl) {
    html +=
      '<img class="hc-reward-image" src="' +
      escapeAttr(imageUrl) +
      '" alt="' +
      escapeAttr(item.title) +
      '" />';
  } else {
    html += '<div class="hc-reward-image-placeholder"><span class="hc-placeholder-text">No Image</span></div>';
  }
  html += '</div>';

  html += '<div class="hc-reward-info">';
  html += '<div class="hc-reward-title">' + escapeHtml(item.title) + '</div>';

  if (!isEarlyRelease) {
    html += '<div class="hc-reward-points-row">';
    if (item.redemption_type === 'weekly' || item.redemption_type === 'overall') {
      html +=
        '<span class="hc-reward-weekly-countdown"' +
        (Number.isFinite(item.weeklyTargetMs)
          ? ' data-weekly-target-ms="' + escapeAttr(String(item.weeklyTargetMs)) + '"'
          : '') +
        ' data-weekly-period-kind="' +
        escapeAttr(item.redemption_type === 'overall' ? 'overall' : 'weekly') +
        '"' +
        '>' +
        escapeHtml(
          item.weeklyCountdownLabel ||
            item.description ||
            (item.redemption_type === 'overall' ? 'Overall Leaderboard' : 'Weekly Leaderboard'),
        ) +
        '</span>';
    } else if (item.redemption_type === 'card') {
      if (cashPriceLabel) {
        html += '<span class="hc-reward-cash-price">' + escapeHtml(cashPriceLabel) + '</span>';
      } else {
        html += '<span class="hc-reward-points-label hc-reward-points-label--solo">Price not set</span>';
      }
    } else {
      html +=
        '<span class="hc-reward-points-value">' +
        formatDisplayNumber(item.points_cost) +
        '</span>';
      html += '<span class="hc-reward-points-label">points</span>';
      if (cashPriceLabel) {
        html += '<span class="hc-reward-points-sep"> or </span>';
        html += '<span class="hc-reward-cash-price">' + escapeHtml(cashPriceLabel) + '</span>';
      }
    }
    html += '</div>';
  }

  html += '<div class="hc-reward-spacer"></div>';

  html += '<div class="hc-reward-bottom">';
  html += '<div class="hc-reward-badges">';
  if (item.redemption_type === 'raffle' || item.redemption_type === 'auction') {
    html +=
      '<span class="hc-reward-type-badge hc-reward-type-badge--' +
      escapeAttr(item.redemption_type) +
      '">' +
      (item.redemption_type === 'raffle' ? 'RAFFLE' : 'AUCTION') +
      '</span>';
  }
  if (isCardLocked && !isPast) {
    html += '<span class="hc-reward-card-required">Card required</span>';
  }
  html += '</div>';

  if (isLocked && !isPast) {
    html += '<div class="hc-reward-lock-badge" aria-hidden="true">';
    html +=
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 11V8a5 5 0 10-10 0v3M5 11h14v10H5V11z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    html += '</div>';
  }
  html += '</div>';

  html += '</div></div>';
  return html;
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

function formatWeeklyCountdownFromTarget(targetMs, periodKind) {
  return buildWeeklyCountdownLabel({
    targetMs: targetMs,
    periodKind: periodKind === 'overall' ? 'overall' : 'weekly',
  });
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

function attachWeeklyCountdown(container) {
  if (weeklyCountdownCleanup) {
    weeklyCountdownCleanup();
    weeklyCountdownCleanup = null;
  }
  var nodes = Array.prototype.slice.call(container.querySelectorAll('[data-weekly-target-ms]'));
  if (!nodes.length) return;

  function update() {
    if (!container.isConnected) {
      if (weeklyCountdownCleanup) weeklyCountdownCleanup();
      return;
    }
    nodes.forEach(function (node) {
      var targetMs = Number(node.getAttribute('data-weekly-target-ms'));
      var periodKind = node.getAttribute('data-weekly-period-kind') || 'weekly';
      var label = formatWeeklyCountdownFromTarget(targetMs, periodKind);
      if (label) node.textContent = label;
    });
  }

  update();
  var timer = window.setInterval(update, 1000);
  weeklyCountdownCleanup = function () {
    window.clearInterval(timer);
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
  removeFloatingPointsOverlay();
  if (weeklyCountdownCleanup) {
    weeklyCountdownCleanup();
    weeklyCountdownCleanup = null;
  }
  try {
    var results = await Promise.all([
      api.getRewardsSummary(),
      api.getRewardsCatalog(),
      api.fetchCurrentUser(),
      api.getCards().catch(function () {
        return null;
      }),
      api.getLeaderboard().catch(function () {
        return null;
      }),
    ]);
    var summary = results[0];
    var catalogRaw = results[1];
    var currentUser = results[2];
    var paymentCards = results[3];
    var leaderboardRes = results[4];

    var resolvedCardLinkStatus = resolveCardLinkStatus(currentUser, paymentCards);
    var cardLinkStatus = resolvedCardLinkStatus || 'unknown';

    var isEarlyRelease =
      !!(currentUser && currentUser.active_school && currentUser.active_school.early_release);

    var ticketCount = 0;
    if (isEarlyRelease && currentUser && currentUser.id) {
      try {
        var ticketsResponse = await api.getRaffleTickets();
        var tickets = ticketsResponse.results || ticketsResponse;
        if (Array.isArray(tickets)) {
          ticketCount = tickets.filter(function (ticket) {
            return !ticket.raffle;
          }).length;
        }
      } catch (tErr) {}
    }

    var catalog = Array.isArray(catalogRaw)
      ? catalogRaw
      : (catalogRaw && catalogRaw.results) || [];
    var formattedRewards = catalog.map(normalizeReward);
    var leaderboardActive = !leaderboardRes || leaderboardRes.leaderboard_active !== false;
    var weeklyReward = leaderboardActive ? await buildWeeklyRewardContext(leaderboardRes) : null;
    var overallReward = leaderboardActive ? await buildOverallRewardContext(leaderboardRes) : null;
    var sections = organizeRewardsByDate(formattedRewards);

    var html = '';

    html += '<div class="hc-rewards-page">';
    html += '<div class="hc-rewards-page-pad">';

    html += '<div class="hc-screen-title">';
    html += ScreenTitle({
      title: 'Rewards',
      subtitle: 'Auctions and raffles for exclusive perks',
    });
    html += '</div>';

    if (!isEarlyRelease && cardLinkStatus === 'unlinked') {
      html += buildRewardsLinkCardBanner(currentUser);
    }

    var weeklyRewardItem = weeklyReward ? buildWeeklyRewardListItem(weeklyReward) : null;
    var overallRewardItem = overallReward ? buildOverallRewardListItem(overallReward) : null;
    if (weeklyRewardItem) {
      html += '<div class="hc-rewards-section hc-rewards-weekly-section">';
      html += '<div class="hc-section-header hc-rewards-section-header">';
      html += '<div class="hc-section-title">Weekly Leaderboard</div>';
      html += '</div>';
      html += '<div class="hc-rewards-list">';
      html += buildRewardCardHtml(
        weeklyRewardItem,
        { title: 'Weekly Leaderboard', isPast: false },
        cardLinkStatus,
        isEarlyRelease,
        getImageUrl,
      );
      html += '</div>';
      html += '</div>';
    }

    if (overallRewardItem) {
      html += '<div class="hc-rewards-section hc-rewards-overall-section">';
      html += '<div class="hc-section-header hc-rewards-section-header">';
      html += '<div class="hc-section-title">Overall Leaderboard</div>';
      html += '</div>';
      html += '<div class="hc-rewards-list">';
      html += buildRewardCardHtml(
        overallRewardItem,
        { title: 'Overall Leaderboard', isPast: false },
        cardLinkStatus,
        isEarlyRelease,
        getImageUrl,
      );
      html += '</div>';
      html += '</div>';
    }

    function getImageUrl(path) {
      return normalizeMediaUrl(path);
    }

    if (sections.length === 0) {
      html += EmptyState({
        title: 'No Rewards Available',
        subtitle:
          currentUser && currentUser.active_school && currentUser.active_school.name
            ? 'No auctions or raffles are currently available for ' +
              currentUser.active_school.name +
              '. Check back later!'
            : 'Please select a school to view available rewards.',
        className: 'hc-empty--rewards',
        iconChar: '🎁',
      });
    } else {
      sections.forEach(function (section) {
        html += '<div class="hc-rewards-section">';
        html += '<div class="hc-section-header hc-rewards-section-header">';
        html +=
          '<div class="hc-section-title' +
          (section.isPast ? ' hc-section-title--past' : '') +
          '">' +
          escapeHtml(section.title) +
          '</div>';
        html += '</div>';
        html += '<div class="hc-rewards-list">';
        section.data.forEach(function (item) {
          html += buildRewardCardHtml(item, section, cardLinkStatus, isEarlyRelease, getImageUrl);
        });
        html += '</div></div>';
      });
    }

    html += '</div>';
    html += '</div>';

    var availablePts =
      summary.availablePoints != null ? summary.availablePoints : summary.available_points;
    var displayNum = isEarlyRelease ? ticketCount : Number(availablePts) || 0;
    var displaySuffix = isEarlyRelease ? ' Raffle tickets' : ' Available points';

    html += '<div id="hc-rewards-points-overlay" class="hc-points-overlay hc-points-overlay--floating">';
    html += '<div class="hc-points-overlay-inner">';
    html +=
      '<span class="hc-points-overlay-num">' +
      formatDisplayNumber(displayNum) +
      '</span><span class="hc-points-overlay-suffix">' +
      escapeHtml(displaySuffix) +
      '</span>';
    html += '</div></div>';

    if (routeEpoch !== getNavEpoch() || !container.isConnected) {
      return;
    }

    container.innerHTML = html;

    var pointsOverlay = container.querySelector('#hc-rewards-points-overlay');
    if (pointsOverlay && document.body) {
      document.body.appendChild(pointsOverlay);
    }

    attachWeeklyCountdown(container);

    container._hcLeaderboardRes = leaderboardRes || null;
    container.onclick = function (e) {
      var weeklyRewardCard = e.target.closest('.hc-rewards-weekly-section [data-reward-id]');
      if (weeklyRewardCard) {
        var weeklyRewardId = weeklyRewardCard.getAttribute('data-reward-id');
        if (weeklyRewardId) {
          analytics.trackEmbedRewardClick(
            lookupRewardForClick(weeklyRewardId, formattedRewards, weeklyRewardItem, overallRewardItem),
            currentUser,
          );
          openWeeklyLeaderboardModalFromHome(weeklyReward, container._hcLeaderboardRes);
        }
        return;
      }
      var overallRewardCard = e.target.closest('.hc-rewards-overall-section [data-reward-id]');
      if (overallRewardCard) {
        var overallRewardId = overallRewardCard.getAttribute('data-reward-id');
        if (overallRewardId) {
          analytics.trackEmbedRewardClick(
            lookupRewardForClick(overallRewardId, formattedRewards, weeklyRewardItem, overallRewardItem),
            currentUser,
          );
          openWeeklyLeaderboardModalFromHome(overallReward, container._hcLeaderboardRes);
        }
        return;
      }
      var card = e.target.closest('[data-reward-id]');
      if (!card) return;
      var rewardId = card.getAttribute('data-reward-id');
      analytics.trackEmbedRewardClick(
        lookupRewardForClick(rewardId, formattedRewards, weeklyRewardItem, overallRewardItem),
        currentUser,
      );
      window.location.hash = '#/rewards/' + encodeURIComponent(rewardId);
    };

    var linkBtn = container.querySelector('.hc-stores-link-card-btn');
    if (linkBtn) {
      linkBtn.onclick = function (ev) {
        ev.stopPropagation();
        window.location.hash = '#/cards';
      };
    }
  } catch (err) {
    removeFloatingPointsOverlay();
    if (routeEpoch !== getNavEpoch() || !container.isConnected) {
      return;
    }
    container.innerHTML =
      '<div class="hc-alert-error">Failed to load rewards: ' + escapeHtml(err.message) + '</div>';
  }
}

