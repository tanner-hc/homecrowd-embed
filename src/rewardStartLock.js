export function getRewardStartDate(reward) {
  var ri = reward && (reward.raffle_info || reward.raffleInfo);
  var ai = reward && (reward.auction_info || reward.auctionInfo);
  if (ri && (ri.start_date || ri.startDate)) {
    return ri.start_date || ri.startDate;
  }
  if (ai && (ai.start_date || ai.startDate)) {
    return ai.start_date || ai.startDate;
  }
  return null;
}

export function getRewardEndDate(reward) {
  var ri = reward && (reward.raffle_info || reward.raffleInfo);
  var ai = reward && (reward.auction_info || reward.auctionInfo);
  if (ri && (ri.drawing_date || ri.drawingDate)) {
    return ri.drawing_date || ri.drawingDate;
  }
  if (ai && (ai.end_date || ai.endDate)) {
    return ai.end_date || ai.endDate;
  }
  return null;
}

export function isRewardBeforeStart(reward, now) {
  var startDate = getRewardStartDate(reward);
  if (!startDate) return false;
  var startMs = new Date(startDate).getTime();
  if (!Number.isFinite(startMs)) return false;
  var nowMs = (now || new Date()).getTime();
  return nowMs < startMs;
}
