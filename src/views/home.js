import * as api from '../api.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { buildDashboardHalfCircleGaugeHtml } from '../base-components/DashboardHalfCircleGauge.js';
import chartUpIconSvg from '../assets/icons/chart-up.svg?raw';
import activityIconSvg from '../assets/icons/activity.svg?raw';
import checkmarkIconSvg from '../assets/icons/checkmark.svg?raw';

function svgAddClass(svgRaw, className) {
  return String(svgRaw).replace(/^<svg\s/i, '<svg class="' + className + '" ');
}

function pickUserTier(u) {
  if (!u || typeof u !== 'object') return null;
  var t = u.currentTier != null ? u.currentTier : u.current_tier != null ? u.current_tier : null;
  if (!t || typeof t !== 'object') return null;
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
  };
}

function pickLifetimePoints(u) {
  if (!u) return 0;
  var v = u.lifetimePoints != null ? u.lifetimePoints : u.lifetime_points;
  return Number.isFinite(Number(v)) ? Number(v) : 0;
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

function calculateWeeklyPoints(leaderboardRes, leaderboardList, userId) {
  if (leaderboardRes && leaderboardRes.user_stats && leaderboardRes.user_stats.points != null) {
    return Number(leaderboardRes.user_stats.points) || 0;
  }
  if (!userId || !Array.isArray(leaderboardList)) return 0;
  var me = leaderboardList.find(function (item) {
    return String(item.id) === String(userId);
  });
  return me && me.points != null ? Number(me.points) : 0;
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
  var html = '<div class="hc-dash-checkbox-wrap">';
  rows.forEach(function (row) {
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
    html += '</div></div>';
  });
  html += '</div>';
  return html;
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

function buildLeaderboardRows(items) {
  if (!items.length) {
    return (
      '<div class="hc-home-empty">' +
      '<div class="hc-home-empty-title">No points earned yet this week</div>' +
      '<div class="hc-home-empty-sub">Be the first at your school to earn points this week!</div>' +
      '</div>'
    );
  }
  var html = '';
  items.forEach(function (item) {
    var top = item.rank === 1 ? ' hc-home-lb-row--top' : '';
    html += '<div class="hc-home-lb-row' + top + '">';
    html += '<div class="hc-home-lb-left">';
    html += '<div class="hc-home-lb-name">' + escapeHtml(formatLeaderboardName(item.name)) + '</div>';
    html +=
      '<div class="hc-home-lb-points">' +
      escapeHtml(String(item.points)) +
      ' ' +
      (item.points === 1 ? 'point' : 'points') +
      '</div>';
    html += '</div>';
    html += '<div class="hc-home-lb-right">';
    html +=
      '<div class="hc-home-lb-rank">' +
      escapeHtml(String(item.rank)) +
      escapeHtml(rankSuffix(item.rank)) +
      ' Place</div>';
    html += '</div></div>';
  });
  return html;
}

function buildHomeHtml(ctx) {
  var user = ctx.user;
  var userTier = ctx.userTier;
  var checkedItems = ctx.checkedItems;
  var leaderboardTop = ctx.leaderboardTop;
  var weeklyPts = ctx.weeklyPoints;
  var streak = ctx.streakDays;
  var bannerUrl = ctx.bannerUrl;
  var schoolHeroIsLogo = ctx.schoolHeroIsLogo;

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
    '<div class="hc-home-stat-value hc-home-stat-value--pos">+ ' +
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

  return (
    '<div class="hc-home">' +
    '<div class="hc-home-page-pad">' +
    '<div class="hc-home-welcome-block">' +
    '<div class="hc-home-welcome-hi">Welcome back!</div>' +
    '<div class="hc-home-welcome-name">' +
    escapeHtml(displayName) +
    '</div></div>' +
    combined +
    stats +
    '<div class="hc-home-lb-title">Weekly leaderboard</div>' +
    '<div class="hc-home-lb-sub">Winner announced Saturday at 4:00 PM MT</div>' +
    '<div class="hc-home-lb-spacer"></div>' +
    buildLeaderboardRows(leaderboardTop) +
    '</div></div>'
  );
}

async function fetchDashboardPayload() {
  var freshUser = await api.fetchCurrentUser();
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

  var leaderboardRes = await api.getLeaderboard().catch(function () {
    return null;
  });
  var leaderboardList =
    leaderboardRes && leaderboardRes.success && Array.isArray(leaderboardRes.leaderboard)
      ? leaderboardRes.leaderboard
      : [];
  var top = leaderboardList.slice(0, 10);
  var weeklyPoints = calculateWeeklyPoints(leaderboardRes, leaderboardList, freshUser && freshUser.id);
  var schoolHero = resolveSchoolHeroImage(freshUser);

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

  return {
    user: freshUser,
    userTier: userTier,
    checkedItems: checkedItems,
    leaderboardTop: top,
    weeklyPoints: weeklyPoints,
    streakDays: 0,
    bannerUrl: schoolHero.url,
    schoolHeroIsLogo: schoolHero.isLogo,
  };
}

function loadHome(container) {
  container.innerHTML = LoadingSpinner({
    text: 'Loading your activity...',
    className: 'hc-home-loading',
  });
  fetchDashboardPayload()
    .then(function (ctx) {
      container.innerHTML = buildHomeHtml(ctx);
    })
    .catch(function (err) {
      container.innerHTML =
        '<div class="hc-alert-error hc-home-error">' +
        escapeHtml(err.message || 'Failed to load') +
        '</div>';
    });
}

export function renderHome(container) {
  loadHome(container);
}
