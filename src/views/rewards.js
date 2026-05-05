import * as api from '../api.js';
import { resolveCardLinkStatus } from '../cardLinkStatus.js';
import { formatDisplayNumber } from '../formatNumber.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import ScreenTitle from '../base-components/ScreenTitle.js';
import EmptyState from '../base-components/EmptyState.js';
import Button from '../base-components/Button.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { getNavEpoch } from '../router.js';
import {
  buildWeeklyCountdownLabel,
  buildWeeklyRewardContext,
  connectWeeklyPrizeWebSocket,
  showWeeklyWinnerModal,
} from '../weekly-reward.js';

var weeklySocketCleanup = null;
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
  var nestedAuctionEnd =
    pickNestedDate(auction_info, ['end_date', 'endDate', 'ends_at', 'endsAt']) || flatAuctionEnd;

  if (nestedDrawing) {
    raffle_info.drawing_date = nestedDrawing;
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

function getEventDate(reward) {
  var ri = reward.raffle_info || reward.raffleInfo;
  var ai = reward.auction_info || reward.auctionInfo;

  var fromRaffle = ri && pickNestedDate(ri, ['drawing_date', 'drawingDate']);
  if (fromRaffle) {
    return fromRaffle;
  }

  var fromAuction = ai && pickNestedDate(ai, ['end_date', 'endDate', 'ends_at', 'endsAt']);
  if (fromAuction) {
    return fromAuction;
  }

  return (
    pickNestedDate(reward, [
      'drawing_date',
      'drawingDate',
      'eventDate',
      'auction_end_date',
      'auctionEndDate',
      'ends_at',
      'endsAt',
      'end_date',
      'endDate',
    ]) || null
  );
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

function isMoreThanWeekAway(dateStr) {
  if (!dateStr) return false;
  var date = new Date(dateStr);
  var weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  return date > weekFromNow;
}

function organizeRewardsByDate(rewards) {
  var now = new Date();
  var sections = [];
  var past = [];
  var upcoming = {};
  var noDate = [];

  rewards.forEach(function (reward) {
    var eventDate = getEventDate(reward);

    if (!eventDate) {
      noDate.push(reward);
    } else {
      var date = new Date(eventDate);
      if (date < now) {
        past.push(Object.assign({}, reward, { eventDate: eventDate }));
      } else {
        var dateKey = formatDate(eventDate);
        if (!upcoming[dateKey]) {
          upcoming[dateKey] = {
            title: dateKey,
            data: [],
            rawDate: eventDate,
          };
        }
        upcoming[dateKey].data.push(Object.assign({}, reward, { eventDate: eventDate }));
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
  var eventDate = item.eventDate || getEventDate(item);
  var isTimeLocked = !isPast && isMoreThanWeekAway(eventDate);
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
    if (item.redemption_type === 'weekly') {
      html +=
        '<span class="hc-reward-weekly-countdown"' +
        (Number.isFinite(item.weeklyTargetMs)
          ? ' data-weekly-target-ms="' + escapeAttr(String(item.weeklyTargetMs)) + '"'
          : '') +
        '>' +
        escapeHtml(item.weeklyCountdownLabel || item.description || 'Weekly reward') +
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
    title: weeklyReward.title || 'Weekly Reward',
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

function formatWeeklyCountdownFromTarget(targetMs) {
  if (!Number.isFinite(targetMs)) return '';
  var delta = Math.max(0, targetMs - Date.now());
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
      var label = formatWeeklyCountdownFromTarget(targetMs);
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
  if (weeklySocketCleanup) {
    weeklySocketCleanup();
    weeklySocketCleanup = null;
  }
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

    var sections = organizeRewardsByDate(formattedRewards);

    var html = '';

    html += '<div class="hc-rewards-page-inner">';

    html += '<div class="hc-screen-title">';
    html += ScreenTitle({
      title: 'Rewards',
      subtitle: 'Auctions and raffles for exclusive perks',
    });
    html += '</div>';

    if (!isEarlyRelease && cardLinkStatus === 'unlinked') {
      html += '<div class="hc-rewards-locked-banner">';
      html += '<div class="hc-rewards-locked-banner-text">';
      html += '<div class="hc-rewards-locked-banner-title">Link a card to unlock rewards</div>';
      html +=
        '<div class="hc-rewards-locked-banner-subtitle">You can browse, but you won\'t be able to redeem rewards until a card is linked.</div>';
      html += '</div>';
      html += Button({
        title: 'Link card',
        variant: 'primary',
        className: 'hc-rewards-link-card-btn',
      });
      html += '</div>';
    }

    if (weeklyReward) {
      var weeklyRewardItem = buildWeeklyRewardListItem(weeklyReward);
      html += '<div class="hc-rewards-section hc-rewards-weekly-section">';
      html += '<div class="hc-section-header hc-rewards-section-header">';
      html += '<div class="hc-section-title">Weekly Reward</div>';
      html += '</div>';
      if (weeklyRewardItem) {
        html += '<div class="hc-rewards-list">';
        html += buildRewardCardHtml(
          weeklyRewardItem,
          { title: 'Weekly Reward', isPast: false },
          cardLinkStatus,
          isEarlyRelease,
          getImageUrl,
        );
        html += '</div>';
      }
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

    container.onclick = function (e) {
      var weeklyRewardCard = e.target.closest('.hc-rewards-weekly-section [data-reward-id]');
      if (weeklyRewardCard) {
        var weeklyRewardId = weeklyRewardCard.getAttribute('data-reward-id');
        if (weeklyRewardId) window.location.hash = '#/rewards/' + encodeURIComponent(weeklyRewardId) + '?weekly=1';
        return;
      }
      var card = e.target.closest('[data-reward-id]');
      if (!card) return;
      var rewardId = card.getAttribute('data-reward-id');
      window.location.hash = '#/rewards/' + rewardId;
    };

    var linkBtn = container.querySelector('.hc-rewards-link-card-btn');
    if (linkBtn) {
      linkBtn.onclick = function (ev) {
        ev.stopPropagation();
        window.location.hash = '#/cards';
      };
    }
    weeklySocketCleanup = connectWeeklyPrizeWebSocket({
      enabled: leaderboardActive,
      onMessage: function (message) {
        if (!message || message.type !== 'weekly_prize_finalized') return;
        showWeeklyWinnerModal(message.weekly_prize || null, weeklyReward && weeklyReward.title);
        loadRewards(container, getNavEpoch());
      },
    });
  } catch (err) {
    removeFloatingPointsOverlay();
    if (routeEpoch !== getNavEpoch() || !container.isConnected) {
      return;
    }
    container.innerHTML =
      '<div class="hc-alert-error">Failed to load rewards: ' + escapeHtml(err.message) + '</div>';
  }
}

