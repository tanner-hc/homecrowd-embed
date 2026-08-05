import * as api from '../api.js';
import { computeSchoolCashback, pickSchoolName } from '../school-contribution.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { escapeHtml } from '../base-components/html.js';
import { buildTiersModalHtml } from '../base-components/TiersModal.js';
import { buildAppHeaderHtml, mountAppHeader } from '../base-components/AppHeader.js';
import { buildPointsEarnedBannerHtml } from '../base-components/PointsEarnedBanner.js';
import { showPointsEarnedToast } from '../base-components/PointsEarnedToast.js';
import {
  buildOverallRewardContext,
  buildWeeklyRewardContext,
  buildWeeklyRewardHomeTileHtml,
} from '../weekly-reward.js';
import {
  fetchSetupRewardPoints,
  getSetupRewardPoints,
  syncSetupTaskRewards,
} from '../setup-rewards.js';
import { buildWelcomeSectionHtml } from '../components/Dashboard/WelcomeSection.js';
import {
  buildUnlockSetupSectionHtml,
  bindUnlockSetupSection,
} from '../components/Dashboard/UnlockSetupSection.js';
import {
  buildSetupCompleteSectionHtml,
  mountSetupCompleteConfetti,
} from '../components/Dashboard/SetupCompleteSection.js';
import {
  buildYourFirstRewardSectionHtml,
  bindYourFirstRewardSection,
  pickFirstReward,
  readSavedFirstRewardId,
  isPointRewardItem,
} from '../components/Dashboard/YourFirstRewardSection.js';
import {
  buildHomeFeaturedStoresHtml,
  bindHomeFeaturedStores,
  normalizeFeaturedStores,
} from '../components/Dashboard/HomeFeaturedStores.js';
import { buildTransactionItemHtml } from '../components/Dashboard/TransactionItem.js';
import {
  userExtensionEnabled,
  userHasLinkedCard,
  syncExtensionEnabledFromNative,
} from '../extension-status.js';

var SETUP_COMPLETE_SHOWN_KEY = '@setup_complete_celebration_shown';
var SETUP_CHECKLIST_SEEN_KEY = '@setup_checklist_seen';

var HOMECROWD_ACTIVITY_KINDS = {
  setup_task_reward: true,
  incentive_campaign: true,
  homecrowd_bonus: true,
};

function isHomecrowdActivityEntry(entry) {
  if (!entry) return false;
  if (HOMECROWD_ACTIVITY_KINDS[entry.activity_kind]) return true;
  var metadata = entry.metadata || {};
  return (
    metadata.source === 'setup_task_reward' ||
    metadata.source === 'incentive_campaign' ||
    metadata.incentive_type === 'campaign_bonus' ||
    !!(metadata.campaign_id && entry.earning_source === 'bonus')
  );
}

function mapHomecrowdActivityEntry(entry) {
  return {
    id: 'hc-' + entry.id,
    isHomecrowdBonus: true,
    activity_kind: entry.activity_kind || 'homecrowd_bonus',
    display_title: entry.display_title,
    description: entry.description,
    points_earned: entry.points,
    points: entry.points,
    transaction_date: entry.date,
    date: entry.date,
    metadata: entry.metadata,
    setup_task: entry.setup_task || (entry.metadata && entry.metadata.setup_task),
    issuer: entry.issuer || 'homecrowd',
  };
}

function mapHomecrowdActivityEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter(isHomecrowdActivityEntry)
    .map(mapHomecrowdActivityEntry);
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
    badge_url: t.badge_url || t.badgeUrl || null,
  };
}

function pickLifetimePoints(u) {
  if (!u) return 0;
  var v = u.lifetimePoints != null ? u.lifetimePoints : u.lifetime_points;
  return Number.isFinite(Number(v)) ? Number(v) : 0;
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

function normalizeCards(cardsData) {
  var cards = cardsData && cardsData.results ? cardsData.results : cardsData;
  return Array.isArray(cards) ? cards : [];
}

function resolveSchoolPrimaryColor(user) {
  var school = user && (user.active_school || user.activeSchool);
  var raw = school && (school.primary_color || school.primaryColor);
  if (raw && /^#?[0-9a-fA-F]{6}$/i.test(String(raw).replace('#', ''))) {
    var s = String(raw).trim();
    return s.charAt(0) === '#' ? s : '#' + s;
  }
  return '#001C44';
}

function mergeUserSchoolColor(primaryUser, profileUser) {
  if (!primaryUser) return profileUser;
  var school = primaryUser.active_school || primaryUser.activeSchool;
  var profileSchool =
    profileUser && (profileUser.active_school || profileUser.activeSchool);
  if (!school && !profileSchool) return primaryUser;
  var color =
    (school && (school.primary_color || school.primaryColor)) ||
    (profileSchool && (profileSchool.primary_color || profileSchool.primaryColor)) ||
    '';
  if (!color) return primaryUser;
  var nextSchool = Object.assign({}, school || profileSchool || {}, {
    primary_color: color,
    primaryColor: color,
  });
  return Object.assign({}, primaryUser, {
    active_school: nextSchool,
    activeSchool: nextSchool,
  });
}

function resolveSchoolLogoUrl(user) {
  var school = user && (user.active_school || user.activeSchool);
  if (!school) return '';
  var url = school.image || school.banner_image || school.bannerImage || '';
  return typeof url === 'string' ? url.trim() : '';
}

function schoolFirstName(user) {
  var name = pickSchoolName(user);
  if (!name || name === 'your school') return undefined;
  return String(name).split(' ')[0];
}

function formatTransactionDateHome(dateString) {
  var date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function getPaymentMethodHome(transaction) {
  if (transaction.wildfire_merchant_id || transaction.wildfire_merchant_name) return 'Online';
  if (transaction.card_nickname) return transaction.card_nickname;
  var scheme = transaction.card_scheme;
  if (scheme) {
    var normalized = String(scheme)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    if (normalized === 'visa') return 'Visa';
    if (normalized === 'mastercard' || normalized === 'master' || normalized === 'mc') {
      return 'Mastercard';
    }
    if (normalized === 'amex' || normalized === 'americanexpress') return 'Amex';
    if (normalized === 'discover') return 'Discover';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  if (transaction.last4) return '•••• ' + transaction.last4;
  return '';
}

function mergeRecentActivity(purchases, bonuses) {
  var list = []
    .concat(Array.isArray(purchases) ? purchases : [])
    .concat(Array.isArray(bonuses) ? bonuses : []);
  list.sort(function (a, b) {
    var ta = new Date(pickTransactionDate(a) || 0).getTime();
    var tb = new Date(pickTransactionDate(b) || 0).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  return list;
}

function filterRecentTransactions(transactions, searchText) {
  var list = Array.isArray(transactions) ? transactions.slice() : [];
  var q = String(searchText || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter(function (t) {
    var blob = [
      t.display_title,
      t.merchant_name,
      t.wildfire_merchant_name,
      t.olive_merchant_name,
      t.reward_name,
      t.raw_descriptor,
      t.description,
      String(t.amount != null ? t.amount : ''),
      String(t.points_earned != null ? t.points_earned : t.points != null ? t.points : ''),
      getPaymentMethodHome(t),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return blob.indexOf(q) >= 0;
  });
}

function buildHomeRecentActivityBodyHtml(transactions, searchText) {
  var filtered = filterRecentTransactions(transactions, searchText);
  if (!transactions.length) {
    return (
      '<div class="hc-home-activity-empty">' +
      '<div class="hc-home-activity-empty-title">No purchases yet</div>' +
      '<div class="hc-home-activity-empty-sub">When you shop in-person, in-app, or in the extension your transactions will show up here</div>' +
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
    html += buildTransactionItemHtml(filtered[i], {
      getPaymentMethod: getPaymentMethodHome,
      formatDate: formatTransactionDateHome,
    });
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

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (_e) {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_e) { }
}

function resolveShowSetupComplete(userId, showUnlockSetup) {
  if (!userId) return false;
  var shownKey = SETUP_COMPLETE_SHOWN_KEY + ':' + userId;
  var checklistKey = SETUP_CHECKLIST_SEEN_KEY + ':' + userId;
  if (showUnlockSetup) {
    storageSet(checklistKey, '1');
    return false;
  }
  if (storageGet(shownKey)) return false;
  var sawChecklist = storageGet(checklistKey);
  storageSet(shownKey, '1');
  return !!sawChecklist;
}

function buildRewardDetailHash(rewardMeta, source) {
  if (!rewardMeta || rewardMeta.rewardId == null) return '#/rewards';
  var hash = '#/rewards/' + encodeURIComponent(rewardMeta.rewardId);
  var params = [];
  if (source) params.push('from=' + encodeURIComponent(source));
  if (rewardMeta.periodKind === 'weekly') params.push('weekly=1');
  if (rewardMeta.periodKind === 'overall') params.push('overall=1');
  return params.length ? hash + '?' + params.join('&') : hash;
}

function buildRewardTilesHtml(ctx) {
  var showWeeklyTile = ctx.leaderboardSectionActive && ctx.weeklyReward && ctx.weeklyReward.rewardId;
  var showOverallTile =
    ctx.leaderboardSectionActive && ctx.overallReward && ctx.overallReward.rewardId;
  if (!showWeeklyTile && !showOverallTile) return '';
  var html = '<div class="hc-home-reward-tiles-row">';
  if (showWeeklyTile) {
    html += buildWeeklyRewardHomeTileHtml(ctx.weeklyReward.title, ctx.weeklyReward.rewardId, {
      eyebrow: 'Weekly reward',
      tileKind: 'weekly',
    });
  }
  if (showOverallTile) {
    html += buildWeeklyRewardHomeTileHtml(ctx.overallReward.title, ctx.overallReward.rewardId, {
      eyebrow: 'Overall reward',
      tileKind: 'overall',
    });
  }
  html += '</div>';
  return html;
}

function buildHomeHtml(ctx) {
  var user = ctx.user;
  var userTier = ctx.userTier;
  var showUnlockSetup = ctx.showUnlockSetup;
  var showSetupComplete = ctx.showSetupComplete;
  var setupRewardPoints = ctx.setupRewardPoints || getSetupRewardPoints();
  var setupCompletePoints =
    (Number(setupRewardPoints.profile) || 0) +
    (Number(setupRewardPoints.linkCard) || 0) +
    (Number(setupRewardPoints.safariExtension) || 0);

  var lifetimePts =
    pickLifetimePoints(user) ||
    (ctx.pointsSummary &&
      (ctx.pointsSummary.total_points_earned != null
        ? ctx.pointsSummary.total_points_earned
        : ctx.pointsSummary.available_points)) ||
    0;

  var availablePts =
    (ctx.pointsSummary &&
      (ctx.pointsSummary.available_points != null
        ? ctx.pointsSummary.available_points
        : ctx.pointsSummary.availablePoints)) ||
    (user && (user.current_points != null ? user.current_points : user.available_points)) ||
    0;

  var hasTierConfig = Array.isArray(ctx.tierConfigTiers) && ctx.tierConfigTiers.length > 0;

  var setupHtml = '';
  if (showUnlockSetup) {
    setupHtml = buildUnlockSetupSectionHtml({
      profileDone: true,
      linkCardDone: ctx.linkCardDone,
      safariDone: ctx.safariDone,
      rewardPoints: setupRewardPoints,
    });
  } else if (showSetupComplete) {
    setupHtml = buildSetupCompleteSectionHtml(setupCompletePoints);
  }

  var firstRewardMarginClass =
    showUnlockSetup || showSetupComplete ? ' hc-home-section--tight' : ' hc-home-section--spaced';

  var firstRewardHtml =
    '<div class="hc-home-first-reward-wrap' +
    firstRewardMarginClass +
    '" id="hc-home-first-reward-wrap">' +
    buildYourFirstRewardSectionHtml({
      reward: ctx.firstReward,
      currentPoints: availablePts,
      setupIncomplete: showUnlockSetup,
      loading: ctx.rewardsLoading,
    }) +
    '</div>';

  var featuredHtml =
    '<div id="hc-home-featured-wrap">' +
    buildHomeFeaturedStoresHtml({
      stores: ctx.featuredStores,
      loading: ctx.featuredLoading,
    }) +
    '</div>';

  var recentActivityHtml =
    '<div class="hc-home-activity">' +
    '<div class="hc-home-activity-title">Recent activity</div>' +
    '<input type="search" id="hc-home-activity-search" class="hc-home-activity-search" placeholder="Search transactions" autocomplete="off" />' +
    '<div id="hc-home-activity-body" class="hc-home-activity-body"></div>' +
    '</div>';

  var tiersModalHtml = buildTiersModalHtml({
    tiers: Array.isArray(ctx.tierConfigTiers) ? ctx.tierConfigTiers : [],
    currentTierName: userTier && userTier.name,
    currentTierLevel: userTier && userTier.level,
  });

  return (
    '<div class="hc-home">' +
    buildAppHeaderHtml({
      user: user,
      points: availablePts,
    }) +
    '<div class="hc-home-page-pad">' +
    buildWelcomeSectionHtml(user) +
    buildPointsEarnedBannerHtml({
      points: lifetimePts,
      schoolAmount: ctx.schoolCashback,
      schoolName: schoolFirstName(user),
      logoUrl: resolveSchoolLogoUrl(user),
      backgroundColor: resolveSchoolPrimaryColor(user),
      clickable: hasTierConfig,
    }) +
    (setupHtml ? '<div class="hc-home-setup-wrap">' + setupHtml + '</div>' : '') +
    firstRewardHtml +
    featuredHtml +
    buildRewardTilesHtml(ctx) +
    recentActivityHtml +
    '</div>' +
    tiersModalHtml +
    '</div>'
  );
}

async function fetchDashboardPayload() {
  var parallel = await Promise.all([
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
    api.getCards().catch(function () {
      return { results: [] };
    }),
    fetchSetupRewardPoints().catch(function () {
      return getSetupRewardPoints();
    }),
    api.getUserActivityLog({ limit: 50 }).catch(function () {
      return [];
    }),
    api.getFeaturedOffers('click').catch(function () {
      return null;
    }),
    api.getRewardsCatalog().catch(function () {
      return null;
    }),
  ]);

  var freshUser = parallel[0];
  var oliveTransactionsRes = parallel[1];
  var profileUser = parallel[2];
  var leaderboardRes = parallel[3];
  var cardsData = parallel[4];
  var setupRewardPoints = parallel[5] || getSetupRewardPoints();
  var activityLogRes = parallel[6];
  var featuredRes = parallel[7];
  var rewardsCatalogRes = parallel[8];

  var latestUser = mergeUserSchoolColor(freshUser, profileUser);
  try {
    latestUser = (await syncExtensionEnabledFromNative(latestUser)) || latestUser;
  } catch (_extSync) {}
  var homecrowdActivity = mapHomecrowdActivityEntries(activityLogRes);
  var syncToastPoints = 0;
  var syncResult = null;

  try {
    syncResult = await syncSetupTaskRewards();
    if (syncResult && syncResult.rewards) {
      setupRewardPoints = getSetupRewardPoints();
    }
    if (syncResult && syncResult.total_points_awarded > 0) {
      syncToastPoints = Number(syncResult.total_points_awarded) || 0;
      var refreshedUser = await api.fetchCurrentUser().catch(function () {
        return null;
      });
      if (refreshedUser) {
        latestUser = mergeUserSchoolColor(refreshedUser, profileUser);
      }
      var refreshedActivity = await api.getUserActivityLog({ limit: 50 }).catch(function () {
        return [];
      });
      homecrowdActivity = mapHomecrowdActivityEntries(refreshedActivity);
    }
  } catch (_syncErr) {
    syncResult = null;
  }

  var schoolCashback = computeSchoolCashback(oliveTransactionsRes);
  var rawTx = getTransactionsArray(oliveTransactionsRes).map(function (t) {
    return Object.assign({}, t, {
      transaction_date: pickTransactionDate(t),
    });
  });
  var purchases = rawTx.slice().sort(function (a, b) {
    var ta = new Date(pickTransactionDate(a) || 0).getTime();
    var tb = new Date(pickTransactionDate(b) || 0).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  var transactionsForList = mergeRecentActivity(purchases.slice(0, 100), homecrowdActivity);

  var cards = normalizeCards(cardsData);
  var hasLinkedCard = userHasLinkedCard(latestUser, profileUser, cards, syncResult);
  var hasSafari = userExtensionEnabled(latestUser, profileUser, syncResult);

  var showUnlockSetup = !hasLinkedCard || !hasSafari;
  var showSetupComplete = resolveShowSetupComplete(
    latestUser && latestUser.id,
    showUnlockSetup
  );

  var pointsSummary = null;
  if (latestUser && latestUser.id) {
    pointsSummary = await api.getUserPointsSummary(latestUser.id).catch(function () {
      return null;
    });
  }

  var leaderboardSectionActive = !!(
    leaderboardRes &&
    leaderboardRes.success &&
    leaderboardRes.leaderboard_active !== false
  );
  var weeklyReward = null;
  var overallReward = null;
  if (leaderboardSectionActive) {
    var rewardPair = await Promise.all([
      buildWeeklyRewardContext(leaderboardRes).catch(function () {
        return null;
      }),
      buildOverallRewardContext(leaderboardRes).catch(function () {
        return null;
      }),
    ]);
    weeklyReward = rewardPair[0];
    overallReward = rewardPair[1];
  }

  var profileSchool =
    (profileUser && (profileUser.active_school || profileUser.activeSchool)) ||
    (latestUser && (latestUser.active_school || latestUser.activeSchool));
  var tierConfigTiers =
    profileSchool &&
    profileSchool.tier_config &&
    Array.isArray(profileSchool.tier_config.tiers)
      ? profileSchool.tier_config.tiers
      : [];

  var rewardsList = [];
  if (rewardsCatalogRes) {
    var rawRewards =
      rewardsCatalogRes.results ||
      rewardsCatalogRes.rewards ||
      (Array.isArray(rewardsCatalogRes) ? rewardsCatalogRes : []);
    rewardsList = (Array.isArray(rawRewards) ? rawRewards : []).filter(isPointRewardItem);
  }
  var firstReward = pickFirstReward(rewardsList, readSavedFirstRewardId());
  var featuredStores = normalizeFeaturedStores(featuredRes);

  return {
    user: latestUser,
    userTier: pickUserTier(latestUser),
    linkCardDone: hasLinkedCard,
    safariDone: hasSafari,
    showUnlockSetup: showUnlockSetup,
    showSetupComplete: showSetupComplete,
    setupRewardPoints: setupRewardPoints,
    schoolCashback: schoolCashback,
    transactions: transactionsForList,
    leaderboardSectionActive: leaderboardSectionActive,
    weeklyReward: weeklyReward,
    overallReward: overallReward,
    tierConfigTiers: tierConfigTiers,
    pointsSummary: pointsSummary,
    firstReward: firstReward,
    rewardsList: rewardsList,
    rewardsLoading: false,
    featuredStores: featuredStores,
    featuredLoading: false,
    syncToastPoints: syncToastPoints,
  };
}

function bindHomeInteractions(container, ctx) {
  mountAppHeader(container, { user: ctx.user });

  var confettiCleanup = null;
  if (ctx.showSetupComplete) {
    confettiCleanup = mountSetupCompleteConfetti(container);
  }

  var unlockRoot = container.querySelector('.hc-unlock-setup');
  if (unlockRoot) {
    bindUnlockSetupSection(unlockRoot, {
      onPressLinkCard: function () {
        navigate('/cards/link');
      },
      onPressSafari: function () {
        navigate('/browser-extension');
      },
    });
  }

  function remountFirstReward(reward) {
    var wrap = container.querySelector('#hc-home-first-reward-wrap');
    if (!wrap) return;
    var availablePts =
      (ctx.pointsSummary &&
        (ctx.pointsSummary.available_points != null
          ? ctx.pointsSummary.available_points
          : ctx.pointsSummary.availablePoints)) ||
      (ctx.user &&
        (ctx.user.current_points != null ? ctx.user.current_points : ctx.user.available_points)) ||
      0;
    wrap.innerHTML = buildYourFirstRewardSectionHtml({
      reward: reward,
      currentPoints: availablePts,
      setupIncomplete: ctx.showUnlockSetup,
    });
    bindFirstReward(reward);
  }

  function bindFirstReward(currentReward) {
    var root = container.querySelector('.hc-first-reward');
    if (!root) return;
    bindYourFirstRewardSection(root, {
      rewards: ctx.rewardsList,
      currentReward: currentReward,
      onViewAll: function () {
        navigate('/rewards');
      },
      onPressReward: function (reward) {
        if (reward && reward.id != null) {
          navigate('/rewards/' + encodeURIComponent(reward.id));
        } else {
          navigate('/rewards');
        }
      },
      onRewardChange: function (next) {
        remountFirstReward(next);
      },
    });
  }

  bindFirstReward(ctx.firstReward);

  var featuredRoot = container.querySelector('.hc-featured-stores');
  if (featuredRoot) {
    bindHomeFeaturedStores(featuredRoot, {
      onSeeAll: function () {
        navigate('/offers');
      },
      onStorePress: function () {
        navigate('/offers');
      },
    });
  }

  var tiersModal = container.querySelector('#hc-tiers-modal');
  if (tiersModal) {
    var tierBanner = container.querySelector('[data-action="open-tiers-modal"]');
    if (tierBanner) {
      tierBanner.addEventListener('click', function () {
        tiersModal.style.display = 'flex';
      });
    }
    tiersModal.addEventListener('click', function (e) {
      if (e.target.closest('[data-tiers-close="1"]')) {
        tiersModal.style.display = 'none';
      }
    });
  }

  var weeklyLbBtn = container.querySelector('[data-home-lb-tile="weekly"]');
  if (weeklyLbBtn) {
    weeklyLbBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (ctx.weeklyReward) {
        window.location.hash = buildRewardDetailHash(ctx.weeklyReward, 'home');
      }
    });
  }
  var overallLbBtn = container.querySelector('[data-home-lb-tile="overall"]');
  if (overallLbBtn) {
    overallLbBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (ctx.overallReward) {
        window.location.hash = buildRewardDetailHash(ctx.overallReward, 'home');
      }
    });
  }

  mountHomeRecentActivity(container);

  if (ctx.syncToastPoints > 0) {
    showPointsEarnedToast(container, { points: ctx.syncToastPoints });
  }

  window.dispatchEvent(
    new CustomEvent('homecrowd:home-ready', {
      detail: { showInstructionOverlay: false },
    })
  );

  return function cleanup() {
    if (typeof confettiCleanup === 'function') confettiCleanup();
  };
}

function loadHome(container) {
  if (typeof container._hcHomeCleanup === 'function') {
    container._hcHomeCleanup();
    container._hcHomeCleanup = null;
  }
  container.innerHTML = LoadingSpinner({
    text: 'Loading your activity...',
    className: 'hc-home-loading',
  });
  fetchDashboardPayload()
    .then(function (ctx) {
      container._hcHomeRecentTransactions = ctx.transactions || [];
      container.innerHTML = buildHomeHtml(ctx);
      container._hcHomeCleanup = bindHomeInteractions(container, ctx);
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
