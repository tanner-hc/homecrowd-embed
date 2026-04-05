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
    ]);
    var summary = results[0];
    var catalog = results[1];

    var html = '';

    // Screen title (matches ScreenTitle component)
    html += '<div class="hc-screen-title">';
    html += '<div class="hc-screen-title-text">Rewards</div>';
    html += '<div class="hc-screen-title-subtitle">Auctions and raffles for exclusive perks</div>';
    html += '</div>';

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

    // Points overlay (floating at bottom, matches PointsOverlay component)
    html += '<div class="hc-points-overlay">';
    html += '<div class="hc-points-overlay-value">' + (summary.availablePoints || 0).toLocaleString() + '</div>';
    html += '<div class="hc-points-overlay-label">Available points</div>';
    html += '</div>';

    container.innerHTML = html;

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
