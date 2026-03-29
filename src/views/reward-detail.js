import * as api from '../api.js';

export function renderRewardDetail(container, reward, summary) {
  var html = '';

  // Back button
  html += '<div class="hc-detail-nav">';
  html += '<button id="hc-back-btn" class="hc-back-btn">← Rewards</button>';
  html += '</div>';

  // Image
  if (reward.imageUrl) {
    html += '<div class="hc-detail-image-wrap"><img class="hc-detail-image" src="' + escapeAttr(reward.imageUrl) + '" alt="' + escapeAttr(reward.title) + '" /></div>';
  } else {
    html += '<div class="hc-detail-image-wrap"><div class="hc-detail-image-placeholder">No Image</div></div>';
  }

  // Title and category
  html += '<div class="hc-detail-header">';
  html += '<div class="hc-detail-title">' + escapeHtml(reward.title) + '</div>';
  html += '<div class="hc-detail-category">Merchandise</div>';
  html += '</div>';

  // Description
  if (reward.description) {
    html += '<div class="hc-detail-description">';
    html += '<div class="hc-detail-desc-text">' + escapeHtml(reward.description) + '</div>';
    html += '</div>';
  }

  // Cost info
  html += '<div class="hc-detail-cost-section">';
  html += '<div class="hc-detail-cost-row"><span class="hc-detail-cost-label">Cost</span><span class="hc-detail-cost-value">' + (reward.pointsCost || 0).toLocaleString() + ' points</span></div>';
  html += '<div class="hc-detail-cost-row"><span class="hc-detail-cost-label">Your balance</span><span class="hc-detail-cost-value">' + (summary.availablePoints || 0).toLocaleString() + ' points</span></div>';
  html += '</div>';

  // Bottom spacer for fixed button
  html += '<div style="height:100px"></div>';

  // Redeem button (fixed at bottom)
  var canRedeem = reward.enabled !== false && summary.availablePoints >= reward.pointsCost;
  html += '<div class="hc-detail-bottom">';
  html += '<button id="hc-detail-redeem" class="hc-btn hc-btn-primary hc-btn-large"' + (canRedeem ? '' : ' disabled') + '>' + (canRedeem ? 'Redeem — ' + (reward.pointsCost || 0).toLocaleString() + ' pts' : 'Not enough points') + '</button>';
  html += '</div>';

  // Confirm modal
  html += '<div id="hc-redeem-modal" class="hc-modal-overlay" style="display:none"><div class="hc-modal"><div class="hc-modal-title">Redeem Reward</div><div id="hc-redeem-modal-text" class="hc-modal-text"></div><div class="hc-modal-actions"><button id="hc-redeem-cancel" class="hc-btn hc-btn-secondary">Cancel</button><button id="hc-redeem-confirm" class="hc-btn hc-btn-primary">Confirm</button></div></div></div>';

  // Toast
  html += '<div id="hc-toast" class="hc-toast" style="display:none"></div>';

  container.innerHTML = html;

  // Back button
  document.getElementById('hc-back-btn').addEventListener('click', function () {
    window.location.hash = '#/rewards';
  });

  // Redeem button
  var redeemBtn = document.getElementById('hc-detail-redeem');
  if (canRedeem) {
    redeemBtn.addEventListener('click', function () {
      document.getElementById('hc-redeem-modal-text').innerHTML =
        'Are you sure you want to redeem <strong>' + escapeHtml(reward.title) + '</strong> for <strong>' + (reward.pointsCost || 0).toLocaleString() + ' points</strong>?';
      document.getElementById('hc-redeem-modal').style.display = 'flex';
    });
  }

  // Modal handlers
  document.getElementById('hc-redeem-cancel').addEventListener('click', function () {
    document.getElementById('hc-redeem-modal').style.display = 'none';
  });

  document.getElementById('hc-redeem-modal').addEventListener('click', function (e) {
    if (e.target === e.currentTarget) {
      e.currentTarget.style.display = 'none';
    }
  });

  document.getElementById('hc-redeem-confirm').addEventListener('click', async function () {
    var confirmBtn = this;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Redeeming...';

    try {
      await api.redeemReward(reward.id);
      document.getElementById('hc-redeem-modal').style.display = 'none';
      showToast('Redeemed "' + reward.title + '" successfully!');
      setTimeout(function () {
        window.location.hash = '#/rewards';
      }, 1500);
    } catch (err) {
      showToast('Failed to redeem: ' + (err.message || 'Unknown error'));
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm';
    }
  });
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
