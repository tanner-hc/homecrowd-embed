import * as api from './api.js';

var DEFAULT_SETUP_REWARD_POINTS = {
  profile: 15,
  linkCard: 25,
  safariExtension: 45,
};

var cachedSetupRewardPoints = Object.assign({}, DEFAULT_SETUP_REWARD_POINTS);

function normalizeRewards(data) {
  var linkCardRaw =
    data && data.link_card != null
      ? data.link_card
      : data && data.linkCard != null
        ? data.linkCard
        : DEFAULT_SETUP_REWARD_POINTS.linkCard;
  var safariRaw =
    data && data.safari_extension != null
      ? data.safari_extension
      : data && data.safariExtension != null
        ? data.safariExtension
        : DEFAULT_SETUP_REWARD_POINTS.safariExtension;
  return {
    profile:
      Number(data && data.profile != null ? data.profile : DEFAULT_SETUP_REWARD_POINTS.profile) ||
      0,
    linkCard: Number(linkCardRaw) || 0,
    safariExtension: Number(safariRaw) || 0,
  };
}

export function getSetupRewardPoints() {
  return Object.assign({}, cachedSetupRewardPoints);
}

export function getDefaultSetupRewardPoints() {
  return Object.assign({}, DEFAULT_SETUP_REWARD_POINTS);
}

export async function fetchSetupRewardPoints() {
  try {
    var data = await api.fetchSetupTaskRewards();
    cachedSetupRewardPoints = normalizeRewards(data);
  } catch (_e) { }
  return getSetupRewardPoints();
}

export async function claimSetupTaskReward(task) {
  var apiTask =
    task === 'linkCard'
      ? 'link_card'
      : task === 'safariExtension'
        ? 'safari_extension'
        : task;
  var result = await api.claimSetupTaskReward(apiTask);
  if (result && result.rewards) {
    cachedSetupRewardPoints = normalizeRewards(result.rewards);
  }
  return result;
}

export async function syncSetupTaskRewards() {
  var result = await api.syncSetupTaskRewards();
  if (result && result.rewards) {
    cachedSetupRewardPoints = normalizeRewards(result.rewards);
  }
  return result;
}
