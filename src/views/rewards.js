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
      api.getRewardsActivity(),
    ]);
    var summary = results[0];
    var catalog = results[1];
    var activity = results[2];

    var html = '';

    // Screen title (matches ScreenTitle component)
    html += '<div class="hc-screen-title">';
    html += '<div class="hc-screen-title-text">Rewards</div>';
    html += '<div class="hc-screen-title-subtitle">Browse and redeem your rewards</div>';
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
        var canRedeem = reward.enabled !== false && summary.availablePoints >= reward.pointsCost;

        html += '<div class="hc-reward-card" data-redeem-id="' + escapeAttr(reward.id) + '" data-redeem-title="' + escapeAttr(reward.title) + '" data-redeem-cost="' + reward.pointsCost + '"' + (canRedeem ? '' : ' style="opacity:0.6;pointer-events:none"') + '>';

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

    // Activity section
    if (activity && activity.length > 0) {
      html += '<div class="hc-screen-title" style="margin-top:24px">';
      html += '<div class="hc-section-title-text">Recent Activity</div>';
      html += '</div>';
      html += '<div class="hc-activity-card"><ul class="hc-activity-list">';
      activity.slice(0, 10).forEach(function (item) {
        var isEarn = item.type === 'earn';
        var pointsClass = item.pointsDelta > 0 ? 'positive' : 'negative';
        var prefix = item.pointsDelta > 0 ? '+' : '';

        html += '<li class="hc-activity-item">';
        html += '<div class="hc-activity-icon ' + (isEarn ? 'earn' : 'redeem') + '">' + (isEarn ? '+' : '-') + '</div>';
        html += '<div class="hc-activity-details">';
        html += '<div class="hc-activity-title">' + escapeHtml(item.description || (isEarn ? 'Points earned' : 'Points redeemed')) + '</div>';
        html += '<div class="hc-activity-date">' + new Date(item.createdAt).toLocaleDateString() + '</div>';
        html += '</div>';
        html += '<div class="hc-activity-points ' + pointsClass + '">' + prefix + item.pointsDelta.toLocaleString() + '</div>';
        html += '</li>';
      });
      html += '</ul></div>';
    }

    // Points overlay (floating at bottom, matches PointsOverlay component)
    html += '<div class="hc-points-overlay">';
    html += '<div class="hc-points-overlay-value">' + (summary.availablePoints || 0).toLocaleString() + '</div>';
    html += '<div class="hc-points-overlay-label">Available points</div>';
    html += '</div>';

    // Confirm modal
    html += '<div id="hc-redeem-modal" class="hc-modal-overlay" style="display:none"><div class="hc-modal"><div class="hc-modal-title">Redeem Reward</div><div id="hc-redeem-modal-text" class="hc-modal-text"></div><div class="hc-modal-actions"><button id="hc-redeem-cancel" class="hc-btn hc-btn-secondary">Cancel</button><button id="hc-redeem-confirm" class="hc-btn hc-btn-primary">Confirm</button></div></div></div>';

    // Toast
    html += '<div id="hc-toast" class="hc-toast" style="display:none"></div>';

    container.innerHTML = html;

    // Bind redeem cards
    var redeemTarget = null;
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-redeem-id]');
      if (btn && !btn.style.opacity) {
        redeemTarget = {
          id: btn.getAttribute('data-redeem-id'),
          title: btn.getAttribute('data-redeem-title'),
          cost: btn.getAttribute('data-redeem-cost'),
        };
        document.getElementById('hc-redeem-modal-text').innerHTML =
          'Are you sure you want to redeem <strong>' + escapeHtml(redeemTarget.title) + '</strong> for <strong>' + Number(redeemTarget.cost).toLocaleString() + ' points</strong>?';
        document.getElementById('hc-redeem-modal').style.display = 'flex';
      }
    });

    document.getElementById('hc-redeem-cancel').addEventListener('click', function () {
      document.getElementById('hc-redeem-modal').style.display = 'none';
      redeemTarget = null;
    });

    document.getElementById('hc-redeem-modal').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) {
        e.currentTarget.style.display = 'none';
        redeemTarget = null;
      }
    });

    document.getElementById('hc-redeem-confirm').addEventListener('click', async function () {
      if (!redeemTarget) return;
      var confirmBtn = this;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Redeeming...';

      try {
        await api.redeemReward(redeemTarget.id);
        document.getElementById('hc-redeem-modal').style.display = 'none';
        showToast('Redeemed "' + redeemTarget.title + '" successfully!');
        redeemTarget = null;
        loadRewards(container);
      } catch (err) {
        showToast('Failed to redeem: ' + (err.message || 'Unknown error'));
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm';
      }
    });
  } catch (err) {
    container.innerHTML = '<div class="hc-alert-error">Failed to load rewards: ' + escapeHtml(err.message) + '</div>';
  }
}

function showToast(msg) {
  var el = document.getElementById('hc-toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(function () { el.style.display = 'none'; }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
