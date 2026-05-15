import * as api from '../api.js';
import { computeSchoolCashback, pickSchoolName } from '../school-contribution.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { buildDashboardHalfCircleGaugeHtml } from '../base-components/DashboardHalfCircleGauge.js';
import { buildTiersModalHtml } from '../base-components/TiersModal.js';
import {
  buildOverallRewardContext,
  buildWeeklyRewardContext,
  buildWeeklyRewardHomeTileHtml,
  connectWeeklyPrizeWebSocket,
  openWeeklyLeaderboardModal,
  showWeeklyWinnerModal,
} from '../weekly-reward.js';
import chartUpIconSvg from '../assets/icons/chart-up.svg?raw';
import activityIconSvg from '../assets/icons/activity.svg?raw';
import checkmarkIconSvg from '../assets/icons/checkmark.svg?raw';
import cardImageUrl from '../assets/intro_images/card.png';
import linkCardImageUrl from '../assets/intro_images/link_card.png';
import screenOneImageUrl from '../assets/intro_images/screen_one.png';
import arrowDownImageUrl from '../assets/intro_images/arrow_down.png';
import downloadExtImageUrl from '../assets/intro_images/download_ext.png';
import screenTwoImageUrl from '../assets/intro_images/screen_two.png';
import screenThreeImageUrl from '../assets/intro_images/screen_three.png';

var instructionOverlayEl = null;
var instructionTabBarEl = null;
var instructionTabGuardHandler = null;
var instructionRepositionHandler = null;
var instructionScrollEl = null;
var weeklySocketCleanup = null;
var overallSocketCleanup = null;
var curvedArrowSvgHtml =
  '<svg class="hc-global-instruction-arrow-svg" viewBox="0 0 140 160" fill="none" aria-hidden="true">' +
  '<path d="M38 14 C28 45 25 85 45 105 C60 120 86 118 108 112" stroke="#00B8D4" stroke-width="13" stroke-opacity="0.35" stroke-linecap="round" stroke-linejoin="round"></path>' +
  '<path d="M90 98 L110 112 L92 130" stroke="#00B8D4" stroke-width="13" stroke-opacity="0.35" stroke-linecap="round" stroke-linejoin="round"></path>' +
  '<path d="M38 14 C28 45 25 85 45 105 C60 120 86 118 108 112" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"></path>' +
  '<path d="M90 98 L110 112 L92 130" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"></path>' +
  '</svg>';

function svgAddClass(svgRaw, className) {
  return String(svgRaw).replace(/^<svg\s/i, '<svg class="' + className + '" ');
}

var TIER_BADGE_BASE_URL = 'https://app.gethomecrowd.com/assets/badge-images';

function tierBadgeUrlFromName(name) {
  if (!name || typeof name !== 'string') return null;
  var slug = String(name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  if (!slug) return null;
  return TIER_BADGE_BASE_URL + '/badge-' + slug + '.png';
}

function pickUserTier(u) {
  if (!u || typeof u !== 'object') return null;
  var t = u.currentTier != null ? u.currentTier : u.current_tier != null ? u.current_tier : null;
  if (!t || typeof t !== 'object') return null;
  var rawBadge = t.badge_url != null ? t.badge_url : t.badgeUrl;
  var badgeUrl =
    rawBadge != null && String(rawBadge).trim() !== '' ? String(rawBadge).trim() : tierBadgeUrlFromName(t.name);
  return {
    level: t.level,
    name: t.name,
    type: t.type,
    progress: t.progress != null ? Number(t.progress) : 0,
    current: t.current != null ? Number(t.current) : 0,
    target: t.target != null ? Number(t.target) : undefined,
    next_tier: t.next_tier != null ? t.next_tier : t.nextTier,
    is_max: !!(t.is_max || t.isMax),
    onboarding_status: t.onboarding_status || t.onboardingStatus,
    badge_url: badgeUrl || null,
  };
}

function pickLifetimePoints(u) {
  if (!u) return 0;
  var v = u.lifetimePoints != null ? u.lifetimePoints : u.lifetime_points;
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

function isInstructionComplete(user) {
  if (!user || typeof user !== 'object') return false;
  if (user.is_instruction_complete === true) return true;
  if (user.isInstructionComplete === true) return true;
  return false;
}

function getOnboardingChecks(tier) {
  var o = tier && (tier.onboarding_status || tier.onboardingStatus);
  if (!o) {
    return { linkCard: false, safariExtension: false, firstPurchase: false };
  }
  return {
    linkCard: !!(o.linked_card || o.linkedCard),
    safariExtension: !!(o.extension_installed || o.extensionInstalled),
    firstPurchase: !!(o.first_purchase || o.firstPurchase),
  };
}

var STATEMENT_PREFIXES = [
  /^pos\s+purchase\s+/i,
  /^purchase\s+/i,
  /^pos\s+debit\s+/i,
  /^pos\s+credit\s+/i,
  /^pos\s+/i,
  /^debit\s+/i,
  /^credit\s+/i,
  /^checkcard\s+/i,
  /^ach\s+payment\s+/i,
  /^ach\s+/i,
];

function stripStatementPrefixes(value) {
  if (!value || typeof value !== 'string') return '';
  var s = value.trim();
  var changed = true;
  while (changed) {
    changed = false;
    var i;
    for (i = 0; i < STATEMENT_PREFIXES.length; i++) {
      var re = STATEMENT_PREFIXES[i];
      var next = s.replace(re, '').trim();
      if (next !== s) {
        s = next;
        changed = true;
      }
    }
  }
  return s;
}

function titleCaseIfAllCapsShouting(value) {
  var t = value.trim();
  if (t.length < 2 || t.length > 80) return t;
  if (!/^[A-Z0-9\s&.'*-]+$/.test(t)) return t;
  return t
    .split(/\s+/)
    .map(function (word) {
      if (!word) return word;
      if (/^\d+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function transactionMerchantDisplayName(transaction) {
  if (!transaction) return '';
  var m = transaction.merchant;
  var raw =
    (m && m.name) ||
    transaction.merchant_name ||
    transaction.wildfire_merchant_name ||
    transaction.olive_merchant_name ||
    transaction.reward_name ||
    (typeof transaction.description === 'string' ? transaction.description.trim() : '') ||
    (typeof transaction.raw_descriptor === 'string' ? transaction.raw_descriptor.trim() : '') ||
    '';
  var stripped = stripStatementPrefixes(raw);
  return titleCaseIfAllCapsShouting(stripped);
}

function pickTransactionDate(transaction) {
  if (!transaction) return null;
  return (
    transaction.transaction_date ||
    transaction.transactionDate ||
    transaction.date ||
    transaction.created_at ||
    transaction.createdAt ||
    null
  );
}

function getTransactionsArray(transactionsRes) {
  if (!transactionsRes) return [];
  var txns = transactionsRes.transactions || transactionsRes.results || transactionsRes;
  return Array.isArray(txns) ? txns : [];
}

function filterTransactionsByDate(transactions, filter) {
  var now = new Date();
  var startOfWeek = new Date(now);
  var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var day = startOfWeek.getDay();
  var diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);
  if (!Array.isArray(transactions)) return [];
  return transactions.filter(function (transaction) {
    var d = pickTransactionDate(transaction);
    var transactionDate = new Date(d);
    if (filter === 'This week') return transactionDate >= startOfWeek;
    if (filter === 'This month') return transactionDate >= startOfMonth;
    return true;
  });
}

function calculateWeeklyPoints(leaderboardRes, leaderboardList, userId, transactions) {
  var lbOn =
    leaderboardRes &&
    leaderboardRes.success &&
    leaderboardRes.leaderboard_active !== false;
  if (lbOn && leaderboardRes.user_stats && leaderboardRes.user_stats.points != null) {
    return Number(leaderboardRes.user_stats.points) || 0;
  }
  if (lbOn && leaderboardRes.userStats && leaderboardRes.userStats.points != null) {
    return Number(leaderboardRes.userStats.points) || 0;
  }
  if (userId && Array.isArray(leaderboardList)) {
    var me = leaderboardList.find(function (item) {
      return String(item.id) === String(userId);
    });
    if (me && me.points != null) return Number(me.points) || 0;
  }
  var weekTxns = filterTransactionsByDate(transactions || [], 'This week');
  var sum = 0;
  var j;
  for (j = 0; j < weekTxns.length; j++) {
    var t = weekTxns[j];
    sum += Number(t.points_earned != null ? t.points_earned : t.pointsEarned) || 0;
  }
  return sum;
}

function formatTransactionDateHome(dateString) {
  var date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function getPaymentMethodHome(transaction) {
  if (transaction.wildfire_merchant_id || transaction.wildfire_merchant_name) return 'Online';
  if (transaction.card_nickname) return transaction.card_nickname;
  if (transaction.card_scheme) return transaction.card_scheme;
  if (transaction.last4) return '•••• ' + transaction.last4;
  return '';
}

function filterRecentTransactions(transactions, searchText) {
  var list = Array.isArray(transactions) ? transactions.slice() : [];
  var q = String(searchText || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter(function (t) {
    var blob = [
      transactionMerchantDisplayName(t),
      t.merchant_name,
      t.wildfire_merchant_name,
      t.olive_merchant_name,
      t.reward_name,
      t.raw_descriptor,
      t.description,
      String(t.amount != null ? t.amount : ''),
      String(t.points_earned != null ? t.points_earned : t.pointsEarned != null ? t.pointsEarned : ''),
      getPaymentMethodHome(t),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return blob.indexOf(q) >= 0;
  });
}

function buildHomeTransactionRowHtml(t) {
  var merchantLabel = transactionMerchantDisplayName(t);
  var dateRaw = pickTransactionDate(t);
  var method = getPaymentMethodHome(t);
  var dateLabel = formatTransactionDateHome(dateRaw);
  var payInfo = [method, dateLabel]
    .filter(function (part) { return !!part; })
    .map(escapeHtml)
    .join(' • ');
  var isStripe = !!(t.isStripeRewardPurchase || t.is_stripe_reward_purchase);
  var amt =
    t.amount != null && String(t.amount).trim() !== ''
      ? parseFloat(t.amount)
      : NaN;
  var amtStr = Number.isFinite(amt) ? amt.toFixed(2) : '0.00';
  var ptsRaw = Number(t.points_earned != null ? t.points_earned : t.pointsEarned);
  var ptsNum = Number.isFinite(ptsRaw) ? ptsRaw : 0;
  var ptsLine =
    ptsNum > 0
      ? '+' + String(ptsNum)
      : String(ptsNum || 0) + ' pts';
  var rightHtml = isStripe
    ? '<div class="hc-home-tx-stripe-only">$' + escapeHtml(amtStr) + '</div>'
    : '<div class="hc-home-tx-points">' +
      escapeHtml(ptsLine) +
      '</div>' +
      '<div class="hc-home-tx-amount">$' +
      escapeHtml(amtStr) +
      '</div>';
  return (
    '<div class="hc-home-tx-row">' +
    '<div class="hc-home-tx-left">' +
    '<div class="hc-home-tx-merchant">' +
    escapeHtml(merchantLabel || 'Purchase') +
    '</div>' +
    '<div class="hc-home-tx-meta">' +
    payInfo +
    '</div>' +
    '</div>' +
    '<div class="hc-home-tx-right">' +
    rightHtml +
    '</div>' +
    '</div>'
  );
}

function buildHomeRecentActivityBodyHtml(transactions, searchText) {
  var filtered = filterRecentTransactions(transactions, searchText);
  if (!transactions.length) {
    return (
      '<div class="hc-home-activity-empty">' +
      '<div class="hc-home-activity-empty-title">No purchases yet</div>' +
      '<div class="hc-home-activity-empty-sub">When you shop with a linked card, your transactions will show up here.</div>' +
      '</div>'
    );
  }
  if (!filtered.length) {
    return (
      '<div class="hc-home-activity-empty">' +
      '<div class="hc-home-activity-empty-title">No matches</div>' +
      '<div class="hc-home-activity-empty-sub">Try a different store name, amount, or keyword.</div>' +
      '</div>'
    );
  }
  var html = '';
  var i;
  for (i = 0; i < filtered.length; i++) {
    html += buildHomeTransactionRowHtml(filtered[i]);
  }
  return html;
}

function mountHomeRecentActivity(container) {
  var txs = container._hcHomeRecentTransactions;
  if (!Array.isArray(txs)) txs = [];
  var searchEl = container.querySelector('#hc-home-activity-search');
  var bodyEl = container.querySelector('#hc-home-activity-body');
  if (!searchEl || !bodyEl) return;
  function sync() {
    bodyEl.innerHTML = buildHomeRecentActivityBodyHtml(txs, searchEl.value);
  }
  searchEl.addEventListener('input', sync);
  sync();
}

function buildGaugeBlock(user, userTier) {
  var lifetime = pickLifetimePoints(user);
  var value =
    userTier && userTier.type === 'points'
      ? lifetime || (userTier.current != null ? userTier.current : 0)
      : userTier
        ? userTier.current || 0
        : 0;
  var max = !userTier ? 100 : userTier.target != null ? userTier.target : 100;
  var pct = !userTier ? 0 : userTier.progress != null ? Number(userTier.progress) : 0;
  var label = !userTier
    ? 'Loading...'
    : userTier.type === 'onboarding'
      ? (userTier.current || 0) === 1
        ? 'Task completed'
        : 'Tasks completed'
      : userTier.is_max
        ? 'Lifetime Points'
        : 'Points earned';
  var bottomLeft = !userTier
    ? 'Progress to Next Tier'
    : userTier.is_max
      ? (userTier.name || '') + ' Tier'
      : userTier.next_tier
        ? 'Progress to ' + userTier.next_tier
        : 'Progress to Next Tier';
  var bottomRight = '';
  if (userTier) {
    if (userTier.is_max) {
      bottomRight = 'Max tier reached!';
    } else if (userTier.type === 'onboarding') {
      var remOn = (userTier.target || 3) - (userTier.current || 0);
      bottomRight =
        remOn === 0 ? 'All tasks complete!' : remOn + ' task' + (remOn === 1 ? '' : 's') + ' to go';
    } else {
      var remPts = (userTier.target || 100) - (userTier.current || 0);
      bottomRight = remPts === 0 ? 'Goal reached!' : remPts + ' points to go';
    }
  }
  return buildDashboardHalfCircleGaugeHtml({
    value: value,
    max: max,
    percentage: pct,
    arcTopPadding: 4,
    gapPx: 12,
    label: label,
    bottomLeftText: bottomLeft,
    bottomRightText: bottomRight,
    progressColor: '#00C8FF',
    trackColor: '#D2D2D2',
    strokeWidth: 9,
    currentTierName: (userTier && userTier.name) || '',
    currentTierBadgeUrl: (userTier && userTier.badge_url) || '',
  });
}

function buildCheckboxSection(userTier, checkedItems) {
  if (
    !userTier ||
    userTier.type !== 'onboarding' ||
    userTier.current >= (userTier.target || 3)
  ) {
    return '';
  }
  var rows = [
    {
      key: 'linkCard',
      label: 'Link a card',
      href: '#/cards',
      showGo: !checkedItems.linkCard,
    },
    {
      key: 'safariExtension',
      label: 'Activate safari extension',
      href: '#/offers',
      showGo: !checkedItems.safariExtension,
    },
    {
      key: 'firstPurchase',
      label: 'Make first in network purchase',
      href: '#/offers',
      showGo: !checkedItems.firstPurchase,
    },
  ];
  var showIntroHelp = !checkedItems.linkCard || !checkedItems.safariExtension || !checkedItems.firstPurchase;
  var html = '<div class="hc-dash-checkbox-wrap">';
  rows.forEach(function (row, idx) {
    var done = !!checkedItems[row.key];
    html += '<div class="hc-dash-checkbox-item">';
    html += '<div class="hc-dash-checkbox-row">';
    html +=
      '<span class="hc-dash-checkbox-box' +
      (done ? ' hc-dash-checkbox-box--on' : '') +
      '">' +
      (done ? svgAddClass(checkmarkIconSvg, 'hc-dash-check-svg') : '') +
      '</span>';
    html +=
      '<span class="hc-dash-checkbox-label' +
      (done ? ' hc-dash-checkbox-label--done' : '') +
      '">' +
      escapeHtml(row.label) +
      '</span>';
    if (row.showGo) {
      html +=
        '<a class="hc-dash-go-btn" href="' +
        row.href +
        '">' +
        escapeHtml('Go') +
        '</a>';
    } else {
      html += '<span class="hc-dash-go-placeholder"></span>';
    }
    if (idx === 0 && showIntroHelp) {
      html +=
        '<button type="button" class="hc-dash-help-btn" data-intro-open="1" aria-label="Open onboarding help">' +
        '<svg class="hc-dash-help-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true">' +
        '<path d="M256 80a176 176 0 1 0 176 176A176 176 0 0 0 256 80z" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"/>' +
        '<path d="M200 202.29s.84-17.5 19.57-32.57C230.68 160.77 244 158.18 256 158c10.93-.14 20.69 1.67 26.53 4.45 10 4.76 29.47 16.38 29.47 41.09 0 26-17 37.81-36.37 50.8S251 281.43 251 296" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="28"/>' +
        '<circle cx="250" cy="348" r="20" fill="currentColor"/>' +
        '</svg>' +
        '</button>';
    }
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

function buildIntroModalHtml() {
  return (
    '<div id="hc-intro-modal" class="hc-intro-modal" aria-hidden="true">' +
    '<div class="hc-intro-modal-backdrop" data-intro-close="1"></div>' +
    '<div class="hc-intro-modal-sheet">' +
    '<div class="hc-intro-view">' +
    '<div class="hc-intro-slider-wrap">' +
    '<div id="hc-intro-track" class="hc-intro-track">' +
    '<section class="hc-intro-slide">' +
    '<div class="hc-intro-column hc-intro-column--first">' +
    '<img src="' +
    cardImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--card" />' +
    '<img src="' +
    linkCardImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--link-card" />' +
    '<img src="' +
    screenOneImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--screen-one" />' +
    '</div>' +
    '</section>' +
    '<section class="hc-intro-slide">' +
    '<div class="hc-intro-column hc-intro-column--second">' +
    '<img src="' +
    arrowDownImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--arrow-down" />' +
    '<img src="' +
    downloadExtImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--download-ext" />' +
    '<img src="' +
    screenTwoImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--screen-two" />' +
    '</div>' +
    '</section>' +
    '<section class="hc-intro-slide">' +
    '<div class="hc-intro-column hc-intro-column--third">' +
    '<img src="' +
    screenThreeImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--screen-three" />' +
    '</div>' +
    '</section>' +
    '</div>' +
    '</div>' +
    '<div class="hc-intro-bottom">' +
    '<div class="hc-intro-dots">' +
    '<span class="hc-intro-dot hc-intro-dot--active" data-index="0"></span>' +
    '<span class="hc-intro-dot" data-index="1"></span>' +
    '<span class="hc-intro-dot" data-index="2"></span>' +
    '</div>' +
    '<button type="button" id="hc-intro-continue" class="hc-intro-btn">Continue</button>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

function resolveSchoolHeroImage(user) {
  var school = user && (user.activeSchool || user.active_school);
  if (!school || typeof school !== 'object') return { url: '', isLogo: false };
  var banner =
    school.banner_image ||
    school.bannerImage ||
    school.banner_url ||
    school.bannerUrl ||
    '';
  if (typeof banner === 'string' && banner.trim().length > 0) {
    return { url: banner.trim(), isLogo: false };
  }
  var logo = school.image || school.imageUrl || school.logo || '';
  if (typeof logo === 'string' && logo.trim().length > 0) {
    return { url: logo.trim(), isLogo: true };
  }
  return { url: '', isLogo: false };
}

function buildHomeHtml(ctx) {
  var user = ctx.user;
  var userTier = ctx.userTier;
  var checkedItems = ctx.checkedItems;
  var weeklyPts = ctx.weeklyPoints;
  var streak = ctx.streakDays;
  var showWeeklyTile = ctx.leaderboardSectionActive && ctx.weeklyReward && ctx.weeklyReward.rewardId;
  var showOverallTile = ctx.leaderboardSectionActive && ctx.overallReward && ctx.overallReward.rewardId;
  var rewardTilesHtml = '';
  if (showWeeklyTile || showOverallTile) {
    rewardTilesHtml = '<div class="hc-home-reward-tiles-row">';
    if (showWeeklyTile) {
      rewardTilesHtml += buildWeeklyRewardHomeTileHtml(
        ctx.weeklyReward.title,
        ctx.weeklyReward.rewardId,
        { eyebrow: 'Weekly reward', tileKind: 'weekly' },
      );
    }
    if (showOverallTile) {
      rewardTilesHtml += buildWeeklyRewardHomeTileHtml(
        ctx.overallReward.title,
        ctx.overallReward.rewardId,
        { eyebrow: 'Overall reward', tileKind: 'overall' },
      );
    }
    rewardTilesHtml += '</div>';
  }
  var bannerUrl = ctx.bannerUrl;
  var schoolHeroIsLogo = ctx.schoolHeroIsLogo;
  var schoolCashback =
    typeof ctx.schoolCashback === 'number' && Number.isFinite(ctx.schoolCashback)
      ? ctx.schoolCashback
      : 0;
  var showSchoolContrib = schoolCashback > 0;
  var schoolName = pickSchoolName(user);

  var first = user && (user.firstName || user.first_name) ? user.firstName || user.first_name : '';
  var last = user && (user.lastName || user.last_name) ? user.lastName || user.last_name : '';
  var displayName = first && last ? first + ' ' + last : first || 'User';

  var gaugeHtml = buildGaugeBlock(user, userTier);

  var combined =
    '<div class="hc-dash-combined">' +
    gaugeHtml +
    buildCheckboxSection(userTier, checkedItems) +
    (bannerUrl
      ? '<div class="hc-dash-banner-wrap"><img class="hc-dash-banner-img' +
        (schoolHeroIsLogo ? ' hc-dash-banner-img--logo' : '') +
        '" src="' +
        escapeAttr(bannerUrl) +
        '" alt=""/></div>'
      : '') +
    '</div>';

  var stats =
    '<div class="hc-home-stats">' +
    '<div class="hc-home-stat-tile">' +
    '<div class="hc-home-stat-label">This week</div>' +
    '<div class="hc-home-stat-icon-wrap">' +
    '<span class="hc-home-stat-icon-inner hc-home-stat-icon-inner--week" aria-hidden="true">' +
    svgAddClass(chartUpIconSvg, 'hc-home-stat-svg') +
    '</span></div>' +
    '<div class="hc-home-stat-value hc-home-stat-value--pos">' +
    '+ ' +
    escapeHtml(String(weeklyPts)) +
    ' pts</div>' +
    '</div>' +
    '<div class="hc-home-stat-tile">' +
    '<div class="hc-home-stat-label">Streak</div>' +
    '<div class="hc-home-stat-icon-wrap">' +
    '<span class="hc-home-stat-icon-inner hc-home-stat-icon-inner--streak" aria-hidden="true">' +
    svgAddClass(activityIconSvg, 'hc-home-stat-svg') +
    '</span></div>' +
    '<div class="hc-home-stat-value hc-home-stat-value--danger">' +
    escapeHtml(String(streak)) +
    ' days</div>' +
    '</div>' +
    '</div>';

  var recentActivityHtml =
    '<div class="hc-home-activity">' +
    '<div class="hc-home-activity-title">Recent activity</div>' +
    '<input type="search" id="hc-home-activity-search" class="hc-home-activity-search" placeholder="Search transactions" autocomplete="off" />' +
    '<div id="hc-home-activity-body" class="hc-home-activity-body"></div>' +
    '</div>';

  var welcomeContribHtml = '';
  if (showSchoolContrib) {
    welcomeContribHtml =
      '<div class="hc-home-welcome-contrib">' +
      '<div class="hc-home-welcome-contrib-amt">$' +
      schoolCashback.toFixed(2) +
      '</div>' +
      '<div class="hc-home-welcome-contrib-label">Contributed to ' +
      escapeHtml(schoolName) +
      '</div></div>';
  }

  var tiersModalHtml = buildTiersModalHtml({
    tiers: Array.isArray(ctx.tierConfigTiers) ? ctx.tierConfigTiers : [],
    currentTierName: userTier && userTier.name,
    currentTierLevel: userTier && userTier.level,
  });

  return (
    '<div class="hc-home">' +
    '<div class="hc-home-page-pad">' +
    '<div class="hc-home-welcome-block">' +
    '<div class="hc-home-welcome-left">' +
    '<div class="hc-home-welcome-hi">Welcome back!</div>' +
    '<div class="hc-home-welcome-name">' +
    escapeHtml(displayName) +
    '</div></div>' +
    welcomeContribHtml +
    '</div>' +
    combined +
    rewardTilesHtml +
    stats +
    recentActivityHtml +
    '</div>' +
    buildIntroModalHtml() +
    tiersModalHtml +
    '</div>'
  );
}

function clearInstructionOverlay() {
  if (instructionTabBarEl) {
    instructionTabBarEl.classList.remove('hc-tab-bar-shell--locked');
  }
  if (instructionTabGuardHandler && instructionTabBarEl) {
    instructionTabBarEl.removeEventListener('click', instructionTabGuardHandler, true);
  }
  instructionTabGuardHandler = null;
  instructionTabBarEl = null;
  if (instructionOverlayEl && instructionOverlayEl.parentNode) {
    instructionOverlayEl.parentNode.removeChild(instructionOverlayEl);
  }
  if (instructionRepositionHandler) {
    window.removeEventListener('resize', instructionRepositionHandler);
    if (instructionScrollEl) {
      instructionScrollEl.removeEventListener('scroll', instructionRepositionHandler);
    }
  }
  instructionRepositionHandler = null;
  instructionScrollEl = null;
  instructionOverlayEl = null;
}

function mountInstructionOverlay(container) {
  clearInstructionOverlay();
  var embedRoot = container.closest('.hc-embed');
  if (!embedRoot) return;
  var tabBarShell = embedRoot.querySelector('.hc-tab-bar-shell');
  if (!tabBarShell) return;
  instructionTabBarEl = tabBarShell;
  instructionTabBarEl.classList.add('hc-tab-bar-shell--locked');
  instructionTabGuardHandler = function (event) {
    var link = event.target && event.target.closest ? event.target.closest('.hc-tab-link') : null;
    if (!link) return;
    var href = String(link.getAttribute('href') || '');
    if (href === '#/home') return;
    event.preventDefault();
    event.stopPropagation();
  };
  instructionTabBarEl.addEventListener('click', instructionTabGuardHandler, true);
  instructionOverlayEl = document.createElement('div');
  instructionOverlayEl.className = 'hc-global-instruction-overlay';
  instructionOverlayEl.innerHTML =
    '<div class="hc-global-instruction-backdrop"></div>' +
    '<div class="hc-global-instruction-inner">' +
    '<button type="button" class="hc-global-instruction-help" aria-label="Open onboarding help">' +
    '<span class="hc-global-instruction-help-icon" aria-hidden="true">?</span>' +
    '</button>' +
    '<div class="hc-global-instruction-hint" aria-hidden="true">' +
    '<div class="hc-global-instruction-text">Learn how it works</div>' +
    '<div class="hc-global-instruction-arrow">' +
    curvedArrowSvgHtml +
    '</div>' +
    '</div>' +
    '</div>';
  var targetHelpBtn = container.querySelector('[data-intro-open="1"]');
  var innerEl = instructionOverlayEl.querySelector('.hc-global-instruction-inner');
  var floatingHelpBtn = instructionOverlayEl.querySelector('.hc-global-instruction-help');
  var hintEl = instructionOverlayEl.querySelector('.hc-global-instruction-hint');
  var hintTextEl = instructionOverlayEl.querySelector('.hc-global-instruction-text');
  var hintArrowEl = instructionOverlayEl.querySelector('.hc-global-instruction-arrow');
  instructionRepositionHandler = function () {
    if (!targetHelpBtn || !innerEl || !floatingHelpBtn || !hintEl || !hintTextEl || !hintArrowEl) return;
    var targetRect = targetHelpBtn.getBoundingClientRect();
    var innerRect = innerEl.getBoundingClientRect();
    var centerX = targetRect.left + targetRect.width / 2 - innerRect.left - 6;
    var centerY = targetRect.top + targetRect.height / 2 - innerRect.top - 4;
    floatingHelpBtn.style.left = centerX - 21 + 'px';
    floatingHelpBtn.style.top = centerY - 21 + 'px';
    var arrowWidth = 100;
    var arrowHeight = 118;
    var arrowTipX = 110;
    var arrowTipY = 70;
    var arrowStartX = 27;
    var arrowTopGap = 12;
    var textGap = 8;
    var arrowLeft = centerX - arrowTipX;
    var arrowTop = centerY - arrowTipY - arrowTopGap;
    hintArrowEl.style.left = arrowLeft + 'px';
    hintArrowEl.style.top = arrowTop + 'px';
    hintArrowEl.style.width = arrowWidth + 'px';
    hintArrowEl.style.height = arrowHeight + 'px';
    var textWidth = hintTextEl.offsetWidth || 0;
    var textHeight = hintTextEl.offsetHeight || 0;
    var textLeft = arrowLeft + arrowStartX - textWidth / 2 - 6;
    var textTop = arrowTop - textHeight - textGap;
    hintTextEl.style.left = textLeft + 'px';
    hintTextEl.style.top = textTop + 'px';
  };
  var helpBtn = instructionOverlayEl.querySelector('.hc-global-instruction-help');
  if (helpBtn) {
    helpBtn.addEventListener('click', function () {
      clearInstructionOverlay();
      if (targetHelpBtn && typeof targetHelpBtn.click === 'function') {
        targetHelpBtn.click();
        return;
      }
      navigate('/intro?fromDashboard=1');
    });
  }
  embedRoot.appendChild(instructionOverlayEl);
  instructionScrollEl = container;
  window.addEventListener('resize', instructionRepositionHandler);
  if (instructionScrollEl) {
    instructionScrollEl.addEventListener('scroll', instructionRepositionHandler);
  }
  window.requestAnimationFrame(instructionRepositionHandler);
}

async function fetchDashboardPayload() {
  var dashPair = await Promise.all([
    api.fetchCurrentUser(),
    api.getOliveTransactions().catch(function () {
      return null;
    }),
    api.getUserProfile().catch(function () {
      return null;
    }),
    api.getLeaderboard().catch(function () {
      return null;
    }),
  ]);
  var freshUser = dashPair[0];
  var oliveTransactionsRes = dashPair[1];
  var profileUser = dashPair[2];
  var leaderboardRes = dashPair[3];
  var schoolCashback = computeSchoolCashback(oliveTransactionsRes);
  var rawTx = getTransactionsArray(oliveTransactionsRes);
  var sortedTx = rawTx.slice().sort(function (a, b) {
    var ta = new Date(pickTransactionDate(a) || 0).getTime();
    var tb = new Date(pickTransactionDate(b) || 0).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  var transactionsForList = sortedTx.slice(0, 100);
  var instructionComplete = isInstructionComplete(profileUser) || isInstructionComplete(freshUser);
  var userTier = pickUserTier(freshUser);
  var checkedItems;
  if (userTier && userTier.type === 'onboarding' && userTier.onboarding_status) {
    var os = userTier.onboarding_status || {};
    checkedItems = {
      linkCard: !!os.linked_card,
      safariExtension: !!os.extension_installed,
      firstPurchase: !!os.first_purchase,
    };
  } else if (!userTier || userTier.type !== 'onboarding') {
    checkedItems = {
      linkCard: true,
      safariExtension: true,
      firstPurchase: true,
    };
  } else {
    checkedItems = getOnboardingChecks(userTier);
  }

  var leaderboardList = [];
  if (leaderboardRes && leaderboardRes.success && leaderboardRes.leaderboard_active !== false) {
    leaderboardList = Array.isArray(leaderboardRes.leaderboard) ? leaderboardRes.leaderboard : [];
  }
  var weeklyPoints = calculateWeeklyPoints(
    leaderboardRes,
    leaderboardList,
    freshUser && freshUser.id,
    rawTx
  );
  var schoolHero = resolveSchoolHeroImage(freshUser);
  var showInstructionOverlay =
    !!userTier &&
    !instructionComplete &&
    userTier.type === 'onboarding' &&
    userTier.current < (userTier.target || 3) &&
    (!checkedItems.linkCard || !checkedItems.safariExtension || !checkedItems.firstPurchase);

  if (freshUser && freshUser.id) {
    try {
      await api.getUserPointsSummary(freshUser.id);
    } catch (_e) { }
    try {
      await api.getRaffleTicketsSummary();
    } catch (_e) { }
    try {
      await api.getRaffleEntriesSummary();
    } catch (_e) { }
  }

  var leaderboardSectionActive = !!(
    leaderboardRes &&
    leaderboardRes.success &&
    leaderboardRes.leaderboard_active !== false
  );
  var weeklyReward = null;
  var overallReward = null;
  if (leaderboardSectionActive) {
    try {
      weeklyReward = await buildWeeklyRewardContext(leaderboardRes);
    } catch (_e) {
      weeklyReward = null;
    }
    try {
      overallReward = await buildOverallRewardContext(leaderboardRes);
    } catch (_e2) {
      overallReward = null;
    }
  }

  var profileSchool = profileUser && (profileUser.active_school || profileUser.activeSchool);
  var tierConfigTiers =
    profileSchool && profileSchool.tier_config && Array.isArray(profileSchool.tier_config.tiers)
      ? profileSchool.tier_config.tiers
      : [];

  return {
    user: freshUser,
    userTier: userTier,
    checkedItems: checkedItems,
    weeklyPoints: weeklyPoints,
    streakDays: 0,
    bannerUrl: schoolHero.url,
    schoolHeroIsLogo: schoolHero.isLogo,
    showInstructionOverlay: showInstructionOverlay,
    schoolCashback: schoolCashback,
    transactions: transactionsForList,
    leaderboardSectionActive: leaderboardSectionActive,
    weeklyReward: weeklyReward,
    overallReward: overallReward,
    leaderboardRows: leaderboardList,
    tierConfigTiers: tierConfigTiers,
  };
}

function loadHome(container) {
  clearInstructionOverlay();
  if (weeklySocketCleanup) {
    weeklySocketCleanup();
    weeklySocketCleanup = null;
  }
  if (overallSocketCleanup) {
    overallSocketCleanup();
    overallSocketCleanup = null;
  }
  container.innerHTML = LoadingSpinner({
    text: 'Loading your activity...',
    className: 'hc-home-loading',
  });
  fetchDashboardPayload()
    .then(function (ctx) {
      container._hcHomeRecentTransactions = ctx.transactions || [];
      container.innerHTML = buildHomeHtml(ctx);
      var introModal = container.querySelector('#hc-intro-modal');
      var embedRoot = container.closest('.hc-embed');
      if (introModal && embedRoot && introModal.parentNode !== embedRoot) {
        embedRoot.appendChild(introModal);
      }

      var tiersModal = container.querySelector('#hc-tiers-modal');
      if (tiersModal) {
        var tierBadgeBtn = container.querySelector('[data-action="open-tiers-modal"]');
        if (tierBadgeBtn) {
          tierBadgeBtn.addEventListener('click', function () {
            tiersModal.style.display = 'flex';
          });
        }
        tiersModal.addEventListener('click', function (e) {
          if (e.target.closest('[data-tiers-close="1"]')) {
            tiersModal.style.display = 'none';
          }
        });
      }
      var introSliderWrap = introModal ? introModal.querySelector('.hc-intro-slider-wrap') : null;
      var introDots = introModal
        ? Array.prototype.slice.call(introModal.querySelectorAll('.hc-intro-dot'))
        : [];
      var introContinueBtn = introModal ? introModal.querySelector('#hc-intro-continue') : null;
      var introOpenButtons = Array.prototype.slice.call(container.querySelectorAll('[data-intro-open="1"]'));
      var introCloseButtons = introModal
        ? Array.prototype.slice.call(introModal.querySelectorAll('[data-intro-close="1"]'))
        : [];
      var currentSlide = 0;
      var totalSlides = 3;
      var instructionCompleteSaved = false;

      function markInstructionComplete() {
        if (instructionCompleteSaved) return;
        instructionCompleteSaved = true;
        api.updateUserProfile({ is_instruction_complete: true }).catch(function () { });
      }

      function updateDots() {
        introDots.forEach(function (dot, idx) {
          dot.classList.toggle('hc-intro-dot--active', idx === currentSlide);
        });
      }

      function updateSlidePosition(animated) {
        if (!introSliderWrap) return;
        var pageWidth = introSliderWrap.clientWidth || 0;
        introSliderWrap.scrollTo({
          left: pageWidth * currentSlide,
          behavior: animated ? 'smooth' : 'auto',
        });
        updateDots();
      }

      function openIntroModal() {
        if (!introModal) return;
        markInstructionComplete();
        currentSlide = 0;
        introModal.classList.add('is-open');
        introModal.setAttribute('aria-hidden', 'false');
        window.requestAnimationFrame(function () {
          updateSlidePosition(false);
        });
      }

      function closeIntroModal() {
        if (!introModal || !introModal.classList.contains('is-open')) return;
        introModal.classList.remove('is-open');
        window.setTimeout(function () {
          introModal.setAttribute('aria-hidden', 'true');
        }, 220);
      }

      introOpenButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          openIntroModal();
        });
      });

      introCloseButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          closeIntroModal();
        });
      });

      introDots.forEach(function (dot) {
        dot.addEventListener('click', function () {
          var idx = Number(dot.getAttribute('data-index'));
          if (!Number.isFinite(idx)) return;
          currentSlide = Math.max(0, Math.min(totalSlides - 1, idx));
          updateSlidePosition(true);
        });
      });

      if (introSliderWrap) {
        introSliderWrap.addEventListener('scroll', function () {
          var pageWidth = introSliderWrap.clientWidth || 0;
          if (!pageWidth) return;
          var idx = Math.round(introSliderWrap.scrollLeft / pageWidth);
          var normalizedIdx = Math.max(0, Math.min(totalSlides - 1, idx));
          if (normalizedIdx !== currentSlide) {
            currentSlide = normalizedIdx;
            updateDots();
          }
        });
      }

      if (introContinueBtn) {
        introContinueBtn.addEventListener('click', function () {
          if (currentSlide < totalSlides - 1) {
            currentSlide += 1;
            updateSlidePosition(true);
            return;
          }
          closeIntroModal();
        });
      }

      window.addEventListener('resize', function () {
        updateSlidePosition(false);
      });
      if (ctx.showInstructionOverlay) {
        window.requestAnimationFrame(function () {
          mountInstructionOverlay(container);
        });
      }
      container._hcWeeklyLbPayload =
        ctx.leaderboardSectionActive && ctx.weeklyReward && ctx.weeklyReward.rewardId
          ? {
            rows: ctx.leaderboardRows || [],
            rewardTitle: ctx.weeklyReward.title || '',
            rewardDescription: ctx.weeklyReward.description || '',
            rewardImageUrl: ctx.weeklyReward.imageUrl || null,
          }
          : null;
      container._hcOverallLbPayload =
        ctx.leaderboardSectionActive && ctx.overallReward && ctx.overallReward.rewardId
          ? {
            rows: (ctx.overallReward && ctx.overallReward.rows) || [],
            rewardTitle: ctx.overallReward.title || '',
            rewardDescription: ctx.overallReward.description || '',
            rewardImageUrl: ctx.overallReward.imageUrl || null,
          }
          : null;
      var weeklyLbBtn = container.querySelector('[data-home-lb-tile="weekly"]');
      if (weeklyLbBtn) {
        weeklyLbBtn.addEventListener('click', function () {
          var payload = container._hcWeeklyLbPayload;
          if (payload) openWeeklyLeaderboardModal(payload);
        });
      }
      var overallLbBtn = container.querySelector('[data-home-lb-tile="overall"]');
      if (overallLbBtn) {
        overallLbBtn.addEventListener('click', function () {
          var payload = container._hcOverallLbPayload;
          if (payload) openWeeklyLeaderboardModal(payload);
        });
      }
      mountHomeRecentActivity(container);
      var activeSchool = ctx.user && (ctx.user.activeSchool || ctx.user.active_school);
      var hasSchoolId = !!(activeSchool && activeSchool.id != null);
      var weeklyPrizeTitle = ctx.weeklyReward && ctx.weeklyReward.title ? ctx.weeklyReward.title : null;
      var overallPrizeTitle = ctx.overallReward && ctx.overallReward.title ? ctx.overallReward.title : null;
      weeklySocketCleanup = connectWeeklyPrizeWebSocket({
        enabled: hasSchoolId,
        prizeType: 'weekly',
        onMessage: function (message) {
          if (!message || message.type !== 'weekly_prize_finalized') return;
          showWeeklyWinnerModal(message.weekly_prize || null, weeklyPrizeTitle, { prizeKind: 'weekly' });
          loadHome(container);
        },
      });
      overallSocketCleanup = connectWeeklyPrizeWebSocket({
        enabled: hasSchoolId,
        prizeType: 'overall',
        onMessage: function (message) {
          if (!message || message.type !== 'overall_prize_finalized') return;
          showWeeklyWinnerModal(message.overall_prize || null, overallPrizeTitle, {
            prizeKind: 'overall',
            winnerBadgeLabel: 'Overall Winner',
          });
          loadHome(container);
        },
      });
    })
    .catch(function (err) {
      clearInstructionOverlay();
      container.innerHTML =
        '<div class="hc-alert-error hc-home-error">' +
        escapeHtml(err.message || 'Failed to load') +
        '</div>';
    });
}

export function renderHome(container) {
  loadHome(container);
}
