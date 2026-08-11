import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { escapeHtml } from '../base-components/html.js';
import { buildTiersModalHtml } from '../base-components/TiersModal.js';
import { buildAppHeaderHtml, attachAppHeader } from '../base-components/AppHeader.js';
import { showPointsEarnedToast } from '../base-components/PointsEarnedToast.js';
import {
  buildPrizeCountdownLabel,
  buildWeeklyRewardContext,
} from '../weekly-reward.js';
import {
  buildPrizeCardHtml,
  bindPrizeCards,
  bindPrizeCardCountdowns,
} from '../components/Rewards/PrizeCard.js';
import {
  fetchSetupRewardPoints,
  getSetupRewardPoints,
  syncSetupTaskRewards,
} from '../setup-rewards.js';
import { isIOS } from '../platform.js';
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
  buildPointsMilestonesCardHtml,
  bindPointsMilestonesCard,
  normalizeMilestones,
} from '../components/Dashboard/PointsMilestonesCard.js';
import {
  buildHomeFeaturedStoresHtml,
  bindHomeFeaturedStores,
  normalizeOnlineStores,
  openFeaturedStore,
} from '../components/Dashboard/HomeFeaturedStores.js';
import { buildTransactionItemHtml } from '../components/Dashboard/TransactionItem.js';
import { buildPurchasesFootnoteHtml } from '../purchasesFootnote.js';
import {
  userExtensionEnabled,
  userHasLinkedCard,
  syncExtensionEnabledFromNative,
} from '../extension-status.js';

var prizeCountdownCleanup = null;

var SETUP_COMPLETE_SHOWN_KEY = '@setup_complete_celebration_shown';
var SETUP_CHECKLIST_SEEN_KEY = '@setup_checklist_seen';
// Home shows a preview; the full history lives on /activity-log.
var HOME_RECENT_ACTIVITY_LIMIT = 6;

var HOMECROWD_ACTIVITY_KINDS = {
  setup_task_reward: true,
  incentive_campaign: true,
  homecrowd_bonus: true,
  card_draw: true,
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

function buildHomeRecentActivityBodyHtml(transactions) {
  // mergeRecentActivity already sorts newest-first, so this is the 6 most
  // recent. "View all" opens /activity-log for the rest.
  var list = (Array.isArray(transactions) ? transactions : []).slice(
    0,
    HOME_RECENT_ACTIVITY_LIMIT
  );
  if (!list.length) {
    return (
      '<div class="hc-home-activity-empty">' +
      '<div class="hc-home-activity-empty-title">No purchases yet</div>' +
      '<div class="hc-home-activity-empty-sub">When you shop in-person, in-app, or in the extension your transactions will show up here</div>' +
      '</div>'
    );
  }
  var html = '';
  var i;
  for (i = 0; i < list.length; i++) {
    html += buildTransactionItemHtml(list[i], {
      getPaymentMethod: getPaymentMethodHome,
      formatDate: formatTransactionDateHome,
    });
  }
  return html;
}

function mountHomeRecentActivity(container) {
  var txs = container._hcHomeRecentTransactions;
  if (!Array.isArray(txs)) txs = [];
  var viewAllEl = container.querySelector('#hc-home-activity-view-all');
  if (viewAllEl) {
    viewAllEl.addEventListener('click', function () {
      navigate('/activity-log');
    });
  }
  var bodyEl = container.querySelector('#hc-home-activity-body');
  if (!bodyEl) return;
  bodyEl.innerHTML = buildHomeRecentActivityBodyHtml(txs);
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
  if (!storageGet(checklistKey)) return false;

  var TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  var now = Date.now();
  var raw = storageGet(shownKey);
  if (!raw) {
    storageSet(shownKey, String(now));
    return true;
  }

  var startedAt = Number(raw);
  // Legacy flag was '1' (hide forever after first paint). Keep those dismissed.
  if (!Number.isFinite(startedAt) || startedAt <= 1) return false;
  return now - startedAt < TWENTY_FOUR_HOURS_MS;
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

/**
 * The rewards screen's prize card, reused so both screens match. Home shows the
 * weekly prize only — the season prize lives on the rewards screen.
 */
/**
 * First featured, still-redeemable reward from the catalogue. `enabled` already
 * folds in is_active and inventory, so it is the right gate here.
 */
function pickFeaturedReward(catalogRes) {
  var list = Array.isArray(catalogRes)
    ? catalogRes
    : (catalogRes && catalogRes.results) || [];
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (r && r.id != null && (r.isFeatured || r.is_featured) && r.enabled !== false) {
      return r;
    }
  }
  return null;
}

/**
 * The headline tile. A featured reward takes the slot when there is one; the
 * weekly prize is the fallback so the spot is never empty.
 */
function buildRewardTilesHtml(ctx) {
  if (ctx.featuredReward) {
    return (
      '<div class="hc-prize-cards hc-home-prize-cards">' +
      buildPrizeCardHtml({
        label: 'Active Reward',
        title: ctx.featuredReward.title,
        imageUrl: ctx.featuredReward.imageUrl || ctx.featuredReward.image_url,
        rewardId: ctx.featuredReward.id,
      }) +
      '</div>'
    );
  }

  var showWeeklyTile = ctx.leaderboardSectionActive && ctx.weeklyReward && ctx.weeklyReward.rewardId;
  if (!showWeeklyTile) return '';
  return (
    '<div class="hc-prize-cards hc-home-prize-cards">' +
    buildPrizeCardHtml({
      kind: 'weekly',
      title: ctx.weeklyReward.title,
      imageUrl: ctx.weeklyReward.imageUrl,
      statusText: buildPrizeCountdownLabel(ctx.weeklyReward),
      targetMs: ctx.weeklyReward.targetMs,
      rewardId: ctx.weeklyReward.rewardId,
    }) +
    '</div>'
  );
}

function buildHomeHtml(ctx) {
  var user = ctx.user;
  var userTier = ctx.userTier;
  var showUnlockSetup = ctx.showUnlockSetup;
  var showSetupComplete = ctx.showSetupComplete;
  var includeSafariSetup = ctx.includeSafariSetup !== false;
  var setupRewardPoints = ctx.setupRewardPoints || getSetupRewardPoints();
  var setupCompletePoints =
    (Number(setupRewardPoints.profile) || 0) +
    (Number(setupRewardPoints.linkCard) || 0) +
    (includeSafariSetup ? Number(setupRewardPoints.safariExtension) || 0 : 0);

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

  var setupHtml = '';
  if (showUnlockSetup) {
    setupHtml = buildUnlockSetupSectionHtml({
      profileDone: true,
      linkCardDone: ctx.linkCardDone,
      safariDone: ctx.safariDone,
      includeSafari: includeSafariSetup,
      rewardPoints: setupRewardPoints,
    });
  } else if (showSetupComplete) {
    setupHtml = buildSetupCompleteSectionHtml(setupCompletePoints);
  }

  var milestonesMarginClass =
    showUnlockSetup || showSetupComplete ? ' hc-home-section--tight' : ' hc-home-section--spaced';

  var milestonesHtml =
    '<div class="hc-home-milestones-wrap' +
    milestonesMarginClass +
    '" id="hc-home-milestones-wrap">' +
    buildPointsMilestonesCardHtml({
      points: lifetimePts,
      milestones: ctx.milestones,
      logoUrl: resolveSchoolLogoUrl(user),
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
    '<div class="hc-home-activity-header">' +
    '<div class="hc-home-activity-title">Recent activity</div>' +
    '<button type="button" class="hc-home-activity-view-all" id="hc-home-activity-view-all">View all</button>' +
    '</div>' +
    '<div id="hc-home-activity-body" class="hc-home-activity-body"></div>' +
    '</div>';

  var activityFootnoteHtml = buildPurchasesFootnoteHtml();

  var tiersModalHtml = buildTiersModalHtml({
    tiers: Array.isArray(ctx.tierConfigTiers) ? ctx.tierConfigTiers : [],
    currentTierName: userTier && userTier.name,
    currentTierLevel: userTier && userTier.level,
  });

  return (
    '<div class="hc-home">' +
    buildAppHeaderHtml({
      title: 'Home',
      user: user,
      points: availablePts,
    }) +
    '<div class="hc-home-page-pad">' +
    buildWelcomeSectionHtml(user, { setupIncomplete: showUnlockSetup }) +
    (setupHtml ? '<div class="hc-home-setup-wrap">' + setupHtml + '</div>' : '') +
    milestonesHtml +
    buildRewardTilesHtml(ctx) +
    featuredHtml +
    recentActivityHtml +
    activityFootnoteHtml +
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
    // Shop online row: first 20 of the online catalog, same as Marketplace.
    // Over-fetched because logo-less merchants are dropped in normalization.
    api.getWildfireOffers(1, 60).catch(function () {
      return null;
    }),
    api.getFirstRewards().catch(function () {
      return null;
    }),
    // Featured rewards headline the page in place of the weekly prize tile.
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
  var firstRewardsRes = parallel[8];
  var rewardsCatalogRes = parallel[9];

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
  var includeSafariSetup = isIOS();
  var hasSafari = includeSafariSetup
    ? userExtensionEnabled(latestUser, profileUser, syncResult)
    : true;

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
  // Only the weekly prize is shown here, so the season context is not built —
  // it costs a reward-detail fetch that nothing on this screen reads.
  var weeklyReward = null;
  if (leaderboardSectionActive) {
    weeklyReward = await buildWeeklyRewardContext(leaderboardRes).catch(function () {
      return null;
    });
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

  var featuredStores = normalizeOnlineStores(featuredRes, 20);

  return {
    user: latestUser,
    userTier: pickUserTier(latestUser),
    linkCardDone: hasLinkedCard,
    safariDone: hasSafari,
    includeSafariSetup: includeSafariSetup,
    showUnlockSetup: showUnlockSetup,
    showSetupComplete: showSetupComplete,
    setupRewardPoints: setupRewardPoints,
    transactions: transactionsForList,
    leaderboardSectionActive: leaderboardSectionActive,
    weeklyReward: weeklyReward,
    featuredReward: pickFeaturedReward(rewardsCatalogRes),
    tierConfigTiers: tierConfigTiers,
    pointsSummary: pointsSummary,
    milestones: normalizeMilestones(firstRewardsRes),
    rewardsLoading: false,
    featuredStores: featuredStores,
    featuredLoading: false,
    syncToastPoints: syncToastPoints,
  };
}

function bindHomeInteractions(container, ctx) {
  attachAppHeader(container, { user: ctx.user });

  var confettiCleanup = null;
  if (ctx.showSetupComplete) {
    confettiCleanup = mountSetupCompleteConfetti(container);
  }

  var unlockRoot = container.querySelector('.hc-unlock-setup');
  if (unlockRoot) {
    bindUnlockSetupSection(unlockRoot, {
      onPressLinkCard: function () {
        navigate('/cards/link-intro');
      },
      onPressSafari: function () {
        navigate('/browser-extension');
      },
    });
  }

  var milestonesRoot = container.querySelector('.hc-milestones');
  if (milestonesRoot) {
    // The row and the Redeem pill both open the reward's own page; redeeming is
    // confirmed from there rather than dropping straight into the redeem flow.
    var openFirstReward = function (id) {
      navigate('/first-rewards/' + encodeURIComponent(id) + '?from=home');
    };
    bindPointsMilestonesCard(milestonesRoot, {
      onPressMilestone: openFirstReward,
      onRedeem: openFirstReward,
    });
  }

  var featuredRoot = container.querySelector('.hc-featured-stores');
  if (featuredRoot) {
    bindHomeFeaturedStores(featuredRoot, {
      onSeeAll: function () {
        navigate('/offers/all-shops?channel=online');
      },
      // Open the store itself, the same as the Shop screen's row — these used
      // to dump the user on /offers regardless of which tile they tapped.
      onStorePress: function (id) {
        var store = (ctx.featuredStores || []).find(function (s) {
          return String(s.id) === String(id);
        });
        if (!openFeaturedStore(store)) {
          navigate('/offers/all-shops?channel=online');
        }
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

  bindPrizeCards(container, {
    onPress: function (rewardId) {
      // A featured reward is an ordinary catalogue reward, so it routes to the
      // normal detail page rather than the weekly-prize route.
      if (ctx.featuredReward) {
        if (!rewardId) return;
        window.location.hash = '#/rewards/' + encodeURIComponent(rewardId) + '?from=home';
        return;
      }
      if (!ctx.weeklyReward) return;
      window.location.hash = buildRewardDetailHash(ctx.weeklyReward, 'home');
    },
  });

  if (prizeCountdownCleanup) prizeCountdownCleanup();
  var stopCountdowns = bindPrizeCardCountdowns(container);
  prizeCountdownCleanup = function () {
    stopCountdowns();
    prizeCountdownCleanup = null;
  };
  window.addEventListener(
    'hashchange',
    function () {
      if (prizeCountdownCleanup) prizeCountdownCleanup();
    },
    { once: true },
  );

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
