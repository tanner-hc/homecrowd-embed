import * as api from '../api.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { buildDashboardHalfCircleGaugeHtml } from '../base-components/DashboardHalfCircleGauge.js';
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
  var showIntroHelp = !checkedItems.linkCard || !checkedItems.safariExtension || !checkedItems.firstPurchase;
  var html = '<div class="hc-dash-checkbox-wrap">';
  rows.forEach(function (row) {
    var done = !!checkedItems[row.key];
    var showHelpIcon = row.key === 'linkCard' && showIntroHelp;
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
    if (showHelpIcon) {
      html +=
        '<button type="button" class="hc-dash-help-btn" data-intro-open="1" aria-label="Open onboarding help">' +
        '<span class="hc-dash-help-icon" aria-hidden="true"></span>' +
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

function pickLastWeekWinner(raw) {
  if (!raw || typeof raw !== 'object') return null;
  var name =
    raw.display_name != null && String(raw.display_name).trim()
      ? String(raw.display_name).trim()
      : raw.displayName != null && String(raw.displayName).trim()
        ? String(raw.displayName).trim()
        : raw.name != null && String(raw.name).trim()
          ? String(raw.name).trim()
          : '';
  if (!name) return null;
  var pts = raw.points != null ? Number(raw.points) : 0;
  return { name: name, points: Number.isFinite(pts) ? pts : 0 };
}

function buildLastWeekWinnerHtml(winner) {
  if (!winner) return '';
  var ptsLine =
    winner.points === 1 ? '1 point' : String(winner.points || 0) + ' points';
  return (
    '<div class="hc-home-lb-winner">' +
    '<div class="hc-home-lb-winner-label">Last week\'s winner</div>' +
    '<div class="hc-home-lb-winner-name">' +
    escapeHtml(winner.name) +
    '</div>' +
    '<div class="hc-home-lb-winner-meta">' +
    escapeHtml(ptsLine) +
    '</div>' +
    '</div>'
  );
}

function buildLeaderboardRows(items, leaderboardActive) {
  if (!leaderboardActive) {
    return (
      '<div class="hc-home-empty">' +
      '<div class="hc-home-empty-title">Leaderboard unavailable</div>' +
      '<div class="hc-home-empty-sub">Your school has turned off the weekly leaderboard.</div>' +
      '</div>'
    );
  }
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
  var leaderboardActive = ctx.leaderboardActive !== false;
  var lastWeekWinner = ctx.lastWeekWinner || null;
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
    '<div class="hc-home-stat-value ' +
    (leaderboardActive ? 'hc-home-stat-value--pos' : 'hc-home-stat-value--muted') +
    '">' +
    (leaderboardActive ? '+ ' + escapeHtml(String(weeklyPts)) + ' pts' : '—') +
    '</div>' +
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
    '<div class="hc-home-lb-sub">' +
    escapeHtml(
      leaderboardActive
        ? 'Weekly prize winner is determined each Saturday at 4:00 PM MT for your school.'
        : 'Leaderboard is not enabled for your school.',
    ) +
    '</div>' +
    (leaderboardActive ? buildLastWeekWinnerHtml(lastWeekWinner) : '') +
    '<div class="hc-home-lb-spacer"></div>' +
    buildLeaderboardRows(leaderboardTop, leaderboardActive) +
    '</div>' +
    buildIntroModalHtml() +
    '</div>'
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
  var leaderboardActive = true;
  var leaderboardList = [];
  var lastWeekWinner = null;
  if (leaderboardRes && leaderboardRes.success) {
    leaderboardActive = leaderboardRes.leaderboard_active !== false;
    leaderboardList =
      leaderboardActive && Array.isArray(leaderboardRes.leaderboard)
        ? leaderboardRes.leaderboard
        : [];
    if (leaderboardActive) {
      var rawWinner =
        leaderboardRes.last_week_prize_winner != null
          ? leaderboardRes.last_week_prize_winner
          : leaderboardRes.lastWeekPrizeWinner;
      lastWeekWinner = pickLastWeekWinner(rawWinner);
    }
  }
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
    leaderboardActive: leaderboardActive,
    lastWeekWinner: lastWeekWinner,
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
      var introModal = container.querySelector('#hc-intro-modal');
      var embedRoot = container.closest('.hc-embed');
      if (introModal && embedRoot && introModal.parentNode !== embedRoot) {
        embedRoot.appendChild(introModal);
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
