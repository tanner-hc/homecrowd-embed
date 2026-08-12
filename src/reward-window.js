/**
 * When a reward is live.
 *
 * Shared by the rewards page and the home screen so the featured slot on both
 * shows the same thing. Tolerates the two payload shapes in play: the rewards
 * page passes rows through its own normalizeReward first, while home reads the
 * catalogue response as it arrives, where the same fields can be camelCase or
 * only present flat.
 */

/**
 * A bare YYYY-MM-DD parses as UTC midnight, which lands on the previous day in
 * any timezone behind UTC — "Sep 25" would read as Sep 24. Take those as local
 * calendar days; leave real timestamps alone.
 */
export function parseRewardDate(dateStr) {
  if (!dateStr) return null;
  var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  if (parts) {
    return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  }
  var d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/** A date-only value closes at the end of that day, not at its midnight. */
export function parseDateEndOfDay(dateStr) {
  var d = parseRewardDate(dateStr);
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

function firstValue(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (var i = 0; i < keys.length; i++) {
    var v = obj[keys[i]];
    if (v !== undefined && v !== null && String(v).length) return v;
  }
  return null;
}

function infoBlocks(reward) {
  if (!reward || typeof reward !== 'object') return [];
  return [
    reward.raffle_info,
    reward.raffleInfo,
    reward.auction_info,
    reward.auctionInfo,
  ].filter(Boolean);
}

/** When entries open. Null means "no start gate". */
export function getRewardStartDate(reward) {
  var blocks = infoBlocks(reward);
  for (var i = 0; i < blocks.length; i++) {
    var found = firstValue(blocks[i], ['start_date', 'startDate']);
    if (found) return found;
  }
  return firstValue(reward, ['start_date', 'startDate']);
}

/** The drawing date for a raffle, the close for an auction. Null means "no end". */
export function getRewardEndDate(reward) {
  var blocks = infoBlocks(reward);
  for (var i = 0; i < blocks.length; i++) {
    var found = firstValue(blocks[i], [
      'drawing_date',
      'drawingDate',
      'end_date',
      'endDate',
    ]);
    if (found) return found;
  }
  return firstValue(reward, ['drawing_date', 'drawingDate', 'end_date', 'endDate']);
}

/**
 * Whether a reward's window is open right now.
 *
 * A plain reward carries no dates and is always open — those are redeemed on the
 * spot, so there is nothing to be early or late for. A raffle or auction is open
 * only between its start and its drawing/close; the end is inclusive of the whole
 * day when it is date-only.
 *
 * @param {object} reward
 * @param {number} [nowMs]
 */
export function isRewardWindowOpen(reward, nowMs) {
  var now = nowMs == null ? Date.now() : nowMs;

  var start = parseRewardDate(getRewardStartDate(reward));
  if (start && start.getTime() > now) return false;

  var end = parseDateEndOfDay(getRewardEndDate(reward));
  if (end && end.getTime() < now) return false;

  return true;
}

/**
 * The gate for the featured slot: flagged, enabled, and inside its window.
 *
 * `is_active` is the rewards page's field and `enabled` is the catalogue's; both
 * are checked so either payload works, and both default to true when absent.
 */
export function isFeaturedRewardLive(reward, nowMs) {
  if (!reward || reward.id == null) return false;
  if (!(reward.is_featured || reward.isFeatured)) return false;
  if (reward.is_active === false || reward.enabled === false) return false;
  return isRewardWindowOpen(reward, nowMs);
}

export default {
  parseRewardDate,
  parseDateEndOfDay,
  getRewardStartDate,
  getRewardEndDate,
  isRewardWindowOpen,
  isFeaturedRewardLive,
};
