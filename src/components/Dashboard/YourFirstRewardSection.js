import { escapeAttr, escapeHtml } from '../../base-components/html.js';

var STORAGE_KEY = 'hc_embed_first_reward_id';
var IMAGE_SIZE = 140;

function formatPts(value) {
  return (Number(value) || 0).toLocaleString('en-US') + ' pts';
}

function normalizeMediaUrl(url) {
  if (!url) return null;
  var s = String(url).trim();
  if (!s) return null;
  return s;
}

function resolveRewardImage(reward) {
  if (!reward) return null;
  if (reward.image_url) return normalizeMediaUrl(reward.image_url);
  if (Array.isArray(reward.images) && reward.images.length > 0) {
    var primary = reward.images.find(function (img) {
      return img.is_primary;
    }) || reward.images[0];
    return normalizeMediaUrl(
      (primary && (primary.image_path || primary.url || primary.image)) || null
    );
  }
  return normalizeMediaUrl(reward.cover_image_url || reward.cover_image || null);
}

function isPointReward(reward) {
  if (!reward) return false;
  var type = String(reward.redemption_type || '').toLowerCase();
  if (type === 'raffle' || type === 'auction') return false;
  if (reward.raffle_info) return false;
  return true;
}

function pickDefaultReward(list) {
  var active = list.filter(function (r) {
    return (
      isPointReward(r) &&
      r.is_active !== false &&
      !r.is_locked &&
      Number(r.points_cost) > 0
    );
  });
  if (!active.length) return null;
  return active.slice().sort(function (a, b) {
    return Number(a.points_cost) - Number(b.points_cost);
  })[0];
}

export function isPointRewardItem(reward) {
  return isPointReward(reward);
}

export function pickFirstReward(list, savedId) {
  var usable = (list || []).filter(function (r) {
    return r && r.is_active !== false && isPointReward(r);
  });
  var saved = savedId
    ? usable.find(function (r) {
        return String(r.id) === String(savedId);
      })
    : null;
  return saved && isPointReward(saved) ? saved : pickDefaultReward(usable);
}

export function readSavedFirstRewardId() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch (_e) {
    return '';
  }
}

export function saveFirstRewardId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch (_e) { }
}

/**
 * @param {{
 *   reward: object,
 *   currentPoints?: number,
 *   setupIncomplete?: boolean,
 *   loading?: boolean,
 * }} props
 */
export function buildYourFirstRewardSectionHtml(props) {
  props = props || {};
  if (props.loading) {
    return (
      '<div class="hc-first-reward">' +
      '<div class="hc-first-reward-header">' +
      '<div class="hc-first-reward-title">Your first reward</div>' +
      '</div>' +
      '<div class="hc-first-reward-loader" aria-hidden="true"></div>' +
      '</div>'
    );
  }

  var reward = props.reward;
  if (!reward) return '';

  var targetPoints = Number(reward.points_cost) || 0;
  var earned = Math.max(0, Number(props.currentPoints) || 0);
  var progress = targetPoints > 0 ? Math.min(1, earned / targetPoints) : 0;
  var imageUrl = resolveRewardImage(reward);
  var hint = props.setupIncomplete ? "Finish setup and you're halfway there." : null;
  var pct = Math.min(Math.max(progress * 100, 0), 100);

  return (
    '<div class="hc-first-reward" data-first-reward-id="' +
    escapeAttr(String(reward.id || '')) +
    '">' +
    '<div class="hc-first-reward-header">' +
    '<div class="hc-first-reward-title">Your first reward</div>' +
    '<button type="button" class="hc-first-reward-view-all" data-first-reward-view-all="1">View all</button>' +
    '</div>' +
    '<div class="hc-first-reward-card" role="button" tabindex="0" data-first-reward-open="1">' +
    '<div class="hc-first-reward-top">' +
    '<div class="hc-first-reward-image-wrap">' +
    (imageUrl
      ? '<img src="' +
        escapeAttr(imageUrl) +
        '" alt="" class="hc-first-reward-image" />'
      : '<div class="hc-first-reward-image hc-first-reward-image--ph"></div>') +
    '</div>' +
    '<div class="hc-first-reward-copy">' +
    '<div class="hc-first-reward-name">' +
    escapeHtml(reward.title || 'Reward') +
    '</div>' +
    '<button type="button" class="hc-first-reward-change" data-first-reward-change="1">Change</button>' +
    '</div>' +
    '</div>' +
    '<div class="hc-first-reward-track">' +
    '<div class="hc-first-reward-fill" style="width:' +
    pct +
    '%"></div>' +
    '</div>' +
    '<div class="hc-first-reward-points-row">' +
    '<span>' +
    escapeHtml(formatPts(earned)) +
    '</span>' +
    '<span>' +
    escapeHtml(formatPts(targetPoints)) +
    '</span>' +
    '</div>' +
    (hint ? '<div class="hc-first-reward-hint">' + escapeHtml(hint) + '</div>' : '') +
    '</div>' +
    '</div>'
  );
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   rewards: object[],
 *   currentReward: object|null,
 *   onViewAll?: function,
 *   onPressReward?: function(object),
 *   onRewardChange?: function(object),
 * }} options
 */
export function bindYourFirstRewardSection(root, options) {
  options = options || {};
  if (!root) return;
  var rewards = Array.isArray(options.rewards) ? options.rewards : [];
  var current = options.currentReward || null;

  var viewAll = root.querySelector('[data-first-reward-view-all]');
  if (viewAll) {
    viewAll.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof options.onViewAll === 'function') options.onViewAll();
    });
  }

  var openBtn = root.querySelector('[data-first-reward-open]');
  if (openBtn) {
    function openReward(e) {
      if (e.target && e.target.closest && e.target.closest('[data-first-reward-change]')) {
        return;
      }
      if (current && typeof options.onPressReward === 'function') {
        options.onPressReward(current);
      }
    }
    openBtn.addEventListener('click', openReward);
    openBtn.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openReward(e);
    });
  }

  var changeBtn = root.querySelector('[data-first-reward-change]');
  if (changeBtn) {
    changeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!rewards.length) return;
      var idx = rewards.findIndex(function (r) {
        return String(r.id) === String(current && current.id);
      });
      var next = rewards[(idx + 1) % rewards.length];
      if (!next) return;
      saveFirstRewardId(next.id);
      if (typeof options.onRewardChange === 'function') {
        options.onRewardChange(next);
      }
    });
  }
}

export default {
  buildYourFirstRewardSectionHtml,
  bindYourFirstRewardSection,
  pickFirstReward,
  readSavedFirstRewardId,
  saveFirstRewardId,
  isPointRewardItem,
};
