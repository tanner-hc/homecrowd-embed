import * as api from '../api.js';
import { navigate } from '../router.js';

var chartUpIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23 6L13.5 15.5L8.5 10.5L1 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 6H23V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var activityIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function renderHalfCircleGauge(value, max, percentage, opts) {
  opts = opts || {};
  var W = 300;
  var strokeWidth = 9;
  var capPad = strokeWidth / 9;
  var arcTopPadding = 4;
  var gapPx = 12;
  var svgHeight = 170;
  var vbW = W;
  var vbH = svgHeight + capPad * 6;
  var cx = vbW / 2;
  var r = vbW / 2 - capPad;
  var cy = capPad + arcTopPadding + r;

  var t = Math.max(0, Math.min(1, percentage / 100));
  var startAngle = -180;
  var endAngle = 0;
  var rawSplit = startAngle + (endAngle - startAngle) * t;
  var gapDeg = (gapPx / r) * (180 / Math.PI);
  var halfGap = gapDeg / 2;
  var useGap = t > 0 && t < 1;

  var blueEnd = useGap ? rawSplit - halfGap : rawSplit;
  var greyStart = useGap ? rawSplit + halfGap : rawSplit;

  var progressPath = t <= 0 ? '' : arcPathD(cx, cy, r, startAngle, Math.min(endAngle, blueEnd));
  var trackPath = t >= 1 ? '' : arcPathD(cx, cy, r, Math.max(startAngle, greyStart), endAngle);

  var primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--hc-primary').trim() || '#00C8FF';

  var svg = '<svg width="' + W + '" height="' + svgHeight + '" viewBox="0 0 ' + vbW + ' ' + vbH + '" xmlns="http://www.w3.org/2000/svg">';
  if (trackPath) {
    svg += '<path d="' + trackPath + '" stroke="#D2D2D2" stroke-width="' + strokeWidth + '" stroke-linecap="round" fill="none" opacity="0.35"/>';
  }
  if (progressPath) {
    svg += '<path d="' + progressPath + '" stroke="' + primaryColor + '" stroke-width="' + strokeWidth + '" stroke-linecap="round" fill="none"/>';
  }
  svg += '</svg>';

  var centerText = (value || 0).toLocaleString();
  var label = opts.label || 'Lifetime points';
  var tierName = opts.tierName || '';
  var bottomLeft = opts.bottomLeft || '';
  var bottomRight = opts.bottomRight || '';

  var html = '<div class="hc-gauge">';
  if (tierName) {
    html += '<div class="hc-gauge-tier-badge">' + escapeHtml(tierName) + '</div>';
  }
  html += '<div class="hc-gauge-svg">' + svg + '</div>';
  html += '<div class="hc-gauge-center">';
  html += '<div class="hc-gauge-value">' + centerText + '</div>';
  html += '<div class="hc-gauge-label">' + escapeHtml(label) + '</div>';
  html += '</div>';
  html += '<div class="hc-gauge-footer">';
  html += '<div class="hc-gauge-footer-left">' + escapeHtml(bottomLeft) + '</div>';
  html += '<div class="hc-gauge-footer-right">' + escapeHtml(bottomRight) + '</div>';
  html += '</div>';
  html += '</div>';
  return html;
}

function arcPathD(cx, cy, r, startDeg, endDeg) {
  if (Math.abs(endDeg - startDeg) < 0.001) return '';
  var toRad = function (d) { return (d * Math.PI) / 180; };
  var sx = cx + r * Math.cos(toRad(startDeg));
  var sy = cy + r * Math.sin(toRad(startDeg));
  var ex = cx + r * Math.cos(toRad(endDeg));
  var ey = cy + r * Math.sin(toRad(endDeg));
  return 'M ' + sx + ' ' + sy + ' A ' + r + ' ' + r + ' 0 0 1 ' + ex + ' ' + ey;
}

export function renderHome(container, user) {
  container.innerHTML = '<div class="hc-spinner"></div>';
  loadHome(container, user);
}

async function loadHome(container, user) {
  try {
    var results = await Promise.all([
      api.getRewardsSummary(),
      api.getRewardsActivity(),
      api.getCards().catch(function () { return []; }),
    ]);
    var summary = results[0];
    var activity = results[1] || [];
    var cards = (results[2] || []).filter(function (c) { return c.status === 'active'; });

    var weeklyPoints = calculateWeeklyPoints(activity);
    var streak = calculateStreak(activity);

    var html = '';

    // Welcome section (matches WelcomeSection component exactly)
    html += '<div class="hc-welcome">';
    html += '<div class="hc-welcome-label">Welcome back!</div>';
    html += '<div class="hc-welcome-name">' + escapeHtml((user.firstName || '') + ' ' + (user.lastName || '')).trim() + '</div>';
    html += '</div>';

    // Combined container (matches combinedContainer style)
    var tier = user.currentTier || null;
    var gaugeValue, gaugeMax, gaugePct, gaugeOpts;

    if (tier && tier.type === 'onboarding') {
      gaugeValue = tier.current || 0;
      gaugeMax = tier.target || 3;
      gaugePct = tier.progress || 0;
      var remaining = gaugeMax - gaugeValue;
      gaugeOpts = {
        label: gaugeValue === 1 ? 'Task completed' : 'Tasks completed',
        tierName: tier.name || '',
        bottomLeft: tier.next_tier ? 'Progress to ' + tier.next_tier : 'Progress to Next Tier',
        bottomRight: remaining === 0 ? 'All tasks complete!' : remaining + ' task' + (remaining === 1 ? '' : 's') + ' to go',
      };
    } else if (tier && tier.type === 'points') {
      gaugeValue = user.lifetimePoints || tier.current || 0;
      gaugeMax = tier.target || 100;
      gaugePct = tier.progress || 0;
      gaugeOpts = {
        label: tier.is_max ? 'Lifetime Points' : 'Points earned',
        tierName: tier.name || '',
        bottomLeft: tier.is_max ? (tier.name + ' Tier') : (tier.next_tier ? 'Progress to ' + tier.next_tier : 'Progress to Next Tier'),
        bottomRight: tier.is_max ? 'Max tier reached!' : ((gaugeMax - gaugeValue) + ' points to go'),
      };
    } else {
      gaugeValue = (summary.availablePoints || 0) + (summary.redeemedPoints || 0);
      gaugeMax = Math.max(gaugeValue, 100);
      gaugePct = gaugeMax > 0 ? (gaugeValue / gaugeMax) * 100 : 0;
      gaugeOpts = { label: 'Lifetime points', tierName: '', bottomLeft: '', bottomRight: '' };
    }

    html += '<div class="hc-combined-container">';

    // HalfCircleGauge
    html += renderHalfCircleGauge(gaugeValue, gaugeMax, Math.min(gaugePct, 100), gaugeOpts);

    // Onboarding checklist inside combined container (matches checkboxContainer)
    if (cards.length === 0) {
      html += '<div class="hc-checkbox-container">';
      html += renderCheckboxItem(false, 'Link a card', 'cards');
      html += '</div>';
    }

    html += '</div>';

    // Stats tiles (matches statsContainer — row with gap 16)
    html += '<div class="hc-stats-row">';

    html += '<div class="hc-stat-tile">';
    html += '<div class="hc-stat-tile-top">';
    html += '<div class="hc-stat-label">This week</div>';
    html += '<div class="hc-stat-icon hc-stat-icon-green">' + chartUpIcon + '</div>';
    html += '</div>';
    html += '<div class="hc-stat-value hc-stat-earned">+ ' + formatNumber(weeklyPoints) + ' pts</div>';
    html += '</div>';

    html += '<div class="hc-stat-tile">';
    html += '<div class="hc-stat-tile-top">';
    html += '<div class="hc-stat-label">Streak</div>';
    html += '<div class="hc-stat-icon hc-stat-icon-red">' + activityIcon + '</div>';
    html += '</div>';
    html += '<div class="hc-stat-value hc-stat-streak">' + streak + ' days</div>';
    html += '</div>';

    html += '</div>';

    // Recent activity title (matches recentActivityTitle — Baikal-Book 16px)
    html += '<div class="hc-section-header">';
    html += '<div class="hc-section-title">Recent activity</div>';
    html += '</div>';

    // Search bar (matches SearchBar component)
    html += '<div class="hc-search-wrap"><input id="hc-search-activity" class="hc-search-input" type="text" placeholder="Search" /></div>';

    // Spacer (matches View style={{ height: scale(20) }})
    html += '<div style="height:20px"></div>';

    if (activity.length === 0) {
      html += '<div class="hc-empty">';
      html += '<div class="hc-empty-title">No recent activity</div>';
      html += '<div class="hc-empty-text">Start shopping to see your transactions here!</div>';
      html += '</div>';
    } else {
      html += '<div id="hc-activity-list" class="hc-activity-list">';
      activity.slice(0, 30).forEach(function (item) {
        html += renderActivityItem(item);
      });
      html += '</div>';
    }

    container.innerHTML = html;

    // Bind onboarding action
    container.addEventListener('click', function (e) {
      var actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      var action = actionBtn.getAttribute('data-action');
      if (action === 'cards') navigate('/cards');
    });

    // Bind search
    var searchInput = document.getElementById('hc-search-activity');
    if (searchInput && activity.length > 0) {
      searchInput.addEventListener('input', function () {
        var q = this.value.toLowerCase().trim();
        var list = document.getElementById('hc-activity-list');
        if (!list) return;
        var items = q
          ? activity.filter(function (item) {
              return (item.description || '').toLowerCase().indexOf(q) >= 0;
            })
          : activity.slice(0, 30);
        list.innerHTML = '';
        if (items.length === 0) {
          list.innerHTML = '<div class="hc-empty"><div class="hc-empty-title">No transactions match your search</div><div class="hc-empty-text">Try adjusting your search</div></div>';
        } else {
          items.forEach(function (item) { list.innerHTML += renderActivityItem(item); });
        }
      });
    }
  } catch (err) {
    container.innerHTML = '<div class="hc-alert-error">Failed to load: ' + escapeHtml(err.message) + '</div>';
  }
}

function renderCheckboxItem(checked, label, action) {
  var html = '<div class="hc-checkbox-row">';
  html += '<div class="hc-checkbox' + (checked ? ' hc-checkbox-checked' : '') + '">';
  if (checked) html += '<span class="hc-checkmark">✓</span>';
  html += '</div>';
  html += '<div class="hc-checkbox-label' + (checked ? ' hc-checkbox-label-checked' : '') + '">' + escapeHtml(label) + '</div>';
  if (!checked) {
    html += '<button class="hc-action-btn" data-action="' + action + '">Go</button>';
  }
  html += '</div>';
  return html;
}

function calculateWeeklyPoints(activity) {
  var now = new Date();
  var day = now.getDay();
  var diff = now.getDate() - day + (day === 0 ? -6 : 1);
  var startOfWeek = new Date(now);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  var total = 0;
  (activity || []).forEach(function (item) {
    if (item.type === 'earn' && item.createdAt) {
      var d = new Date(item.createdAt);
      if (d >= startOfWeek) total += Math.abs(item.pointsDelta || 0);
    }
  });
  return total;
}

function calculateStreak(activity) {
  if (!activity || activity.length === 0) return 0;

  // Only count earned items
  var earned = activity.filter(function (a) { return a.type === 'earn' && a.createdAt; });
  if (earned.length === 0) return 0;

  var sorted = earned.slice().sort(function (a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  var byDate = {};
  sorted.forEach(function (t) {
    var key = new Date(t.createdAt).toDateString();
    byDate[key] = true;
  });

  var streak = 0;
  var d = new Date();
  d.setDate(d.getDate() - 1);

  while (true) {
    var key = d.toDateString();
    if (byDate[key]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function renderActivityItem(item) {
  var isEarn = item.type === 'earn' || item.type === 'adjustment';
  var sign = isEarn ? '+' : '-';
  var colorClass = isEarn ? 'hc-activity-positive' : 'hc-activity-negative';
  var points = Math.abs(item.pointsDelta || 0);
  var desc = item.description || (isEarn ? 'Points earned' : 'Points redeemed');
  var date = formatDate(item.createdAt);

  var html = '<div class="hc-activity-item">';
  html += '<div class="hc-activity-info">';
  html += '<div class="hc-activity-desc">' + escapeHtml(desc) + '</div>';
  html += '<div class="hc-activity-date">' + escapeHtml(date) + '</div>';
  html += '</div>';
  html += '<div class="hc-activity-points ' + colorClass + '">' + sign + formatNumber(points) + '</div>';
  html += '</div>';
  return html;
}

function formatNumber(n) {
  return (n || 0).toLocaleString();
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  } catch (e) {
    return '';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
