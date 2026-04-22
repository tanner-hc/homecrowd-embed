import * as api from '../api.js';

export function renderRewards(container) {
  container.innerHTML = '<div class="hc-spinner"></div>';
  loadRewards(container);
}

async function loadRewards(container) {
  try {
    var results = await Promise.all([
      api.getRewardsSummary(),
      api.getRewardsCatalog(),
      api.getWeeklyLeaderboard().catch(function () {
        return null;
      }),
    ]);
    var summary = results[0];
    var catalog = results[1];
    var leaderboard = results[2];

    var html = '';

    // Screen title (matches ScreenTitle component)
    html += '<div class="hc-screen-title">';
    html += '<div class="hc-screen-title-text">Rewards</div>';
    html += '<div class="hc-screen-title-subtitle">Auctions and raffles for exclusive perks</div>';
    html += '</div>';

    if (leaderboard && leaderboard.success && leaderboard.leaderboard_active !== false) {
      html += '<div class="hc-section-title-text">Weekly leaderboard</div>';
      html += '<p class="hc-leaderboard-subtitle">Rankings for your school. Weekly prize winner is set each Saturday at 4:00 PM MT.</p>';
      if (leaderboard.last_week_prize_winner) {
        var w = leaderboard.last_week_prize_winner;
        html += '<div class="hc-last-week-winner">';
        html +=
          '<div class="hc-last-week-winner-label">Last week\'s winner</div>';
        html += '<div class="hc-last-week-winner-name">' + escapeHtml(w.display_name || w.name) + '</div>';
        html +=
          '<div class="hc-last-week-winner-meta">' +
          (w.points === 1 ? '1 point' : w.points + ' points') +
          '</div>';
        html += '</div>';
      }
      if (leaderboard.leaderboard && leaderboard.leaderboard.length > 0) {
        html += '<div class="hc-leaderboard-list">';
        leaderboard.leaderboard.forEach(function (row) {
          var rankSuffix =
            row.rank === 1 ? 'st' : row.rank === 2 ? 'nd' : row.rank === 3 ? 'rd' : 'th';
          html += '<div class="hc-leaderboard-row' + (row.rank === 1 ? ' hc-leaderboard-row-top' : '') + '">';
          html += '<div class="hc-leaderboard-row-main">';
          html +=
            '<div class="hc-leaderboard-name">' +
            escapeHtml(row.display ? row.display.top_left : row.name) +
            '</div>';
          html +=
            '<div class="hc-leaderboard-points">' +
            (row.points === 1 ? '1 point' : row.points + ' points') +
            '</div>';
          html += '</div>';
          html +=
            '<div class="hc-leaderboard-rank">' +
            row.rank +
            rankSuffix +
            ' Place</div>';
          html += '</div>';
        });
        html += '</div>';
      } else {
        html += '<div class="hc-leaderboard-empty">No points earned yet this week at your school.</div>';
      }
      html += '<div class="hc-leaderboard-spacer"></div>';
    } else if (leaderboard && leaderboard.success && leaderboard.leaderboard_active === false) {
      html += '<div class="hc-section-title-text">Weekly leaderboard</div>';
      html +=
        '<p class="hc-leaderboard-subtitle">Leaderboard is not enabled for your school.</p>';
      html += '<div class="hc-leaderboard-spacer"></div>';
    }

    // Reward cards list
    if (!catalog || catalog.length === 0) {
      html += '<div class="hc-empty">';
      html += '<div class="hc-empty-title">No Rewards Available</div>';
      html += '<div class="hc-empty-text">No rewards are currently available. Check back later!</div>';
      html += '</div>';
    } else {
      html += '<div class="hc-rewards-list">';
      catalog.forEach(function (reward) {
        html += '<div class="hc-reward-card" data-reward-id="' + escapeAttr(reward.id) + '">';

        // Image section (left)
        if (reward.imageUrl) {
          html += '<img class="hc-reward-image" src="' + escapeAttr(reward.imageUrl) + '" alt="' + escapeAttr(reward.title) + '" />';
        } else {
          html += '<div class="hc-reward-image-placeholder"><span class="hc-placeholder-text">No Image</span></div>';
        }

        // Info section (right)
        html += '<div class="hc-reward-info">';
        html += '<div class="hc-reward-title">' + escapeHtml(reward.title) + '</div>';
        html += '<div class="hc-reward-points"><span class="hc-reward-points-value">' + (reward.pointsCost || 0).toLocaleString() + '</span> <span class="hc-reward-points-label">points</span></div>';
        html += '<div class="hc-reward-spacer"></div>';
        html += '</div>';

        html += '</div>';
      });
      html += '</div>';
    }

    container.innerHTML = html;

    // Points overlay — append to body so backdrop-filter blurs content behind it
    var existingOverlay = document.getElementById('hc-points-overlay-global');
    if (existingOverlay) existingOverlay.remove();
    var overlay = document.createElement('div');
    overlay.id = 'hc-points-overlay-global';
    overlay.className = 'hc-points-overlay';
    overlay.innerHTML = '<div class="hc-points-overlay-value">' + (summary.availablePoints || 0).toLocaleString() + '</div>' +
      '<div class="hc-points-overlay-label"> Available points</div>';
    document.body.appendChild(overlay);

    // Bind reward card clicks — navigate to detail
    container.addEventListener('click', function (e) {
      var card = e.target.closest('[data-reward-id]');
      if (!card) return;
      var rewardId = card.getAttribute('data-reward-id');
      window.location.hash = '#/rewards/' + rewardId;
    });
  } catch (err) {
    container.innerHTML = '<div class="hc-alert-error">Failed to load rewards: ' + escapeHtml(err.message) + '</div>';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
