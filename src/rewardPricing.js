var STRIPE_MIN_CENTS = 50;

export function hasValidUsdPrice(reward) {
  var cents = Number(reward && reward.cashPriceCents);
  return Number.isFinite(cents) && cents >= STRIPE_MIN_CENTS;
}

export function formatRewardListPriceText(reward) {
  var pts = (reward && reward.pointsCost) || 0;
  var rt = (reward && reward.redemptionType) || '';
  var usd = hasValidUsdPrice(reward);
  var cents = Number(reward.cashPriceCents);
  if (rt === 'card' && usd) {
    return '$' + (cents / 100).toFixed(2) + ' USD';
  }
  if (usd && pts <= 0 && (rt === 'first' || rt === 'card')) {
    return '$' + (cents / 100).toFixed(2) + ' USD';
  }
  if (rt === 'first' && usd && pts > 0) {
    return pts.toLocaleString() + ' pts · $' + (cents / 100).toFixed(2);
  }
  return pts.toLocaleString() + ' points';
}

export function canPayWithStripeEmbed(reward) {
  var rt = (reward && reward.redemptionType) || '';
  return (
    reward &&
    reward.enabled !== false &&
    hasValidUsdPrice(reward) &&
    (rt === 'first' || rt === 'card')
  );
}
