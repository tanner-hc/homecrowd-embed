function parseIncentiveValue(raw, fallback) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  var parsed = parseInt(String(raw), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatRaffleTitle(title) {
  var trimmed = String(title || '').trim();
  if (!trimmed) return 'a raffle';
  return trimmed.toLowerCase().indexOf('raffle') >= 0 ? trimmed : trimmed + ' raffle';
}

function capitalizeFirst(s) {
  var text = String(s || '');
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function getReferralReward(campaign) {
  if (!campaign) {
    return {
      hasCampaign: false,
      amount: null,
      text: 'rewards',
      lowerText: 'rewards',
      profileSubtitle: 'Send an invite to a friend and earn rewards',
    };
  }

  var type = campaign.incentive_type || campaign.incentiveType || 'points';
  var raw = campaign.incentive_value != null ? campaign.incentive_value : campaign.incentiveValue;
  var fallbackAmount = type === 'points' ? 0 : 1;
  var amount = parseIncentiveValue(raw, fallbackAmount);
  var singular = amount === 1;
  var raffle = campaign.raffle || campaign.single_raffle || campaign.singleRaffle || null;
  var raffleTitle = raffle && (raffle.title || raffle.name);
  var raffleText = formatRaffleTitle(raffleTitle);
  var text;

  if (campaign.reward_text || campaign.rewardText) {
    text = String(campaign.reward_text || campaign.rewardText);
  } else if (type === 'points') {
    text = amount + ' point' + (singular ? '' : 's');
  } else if (type === 'raffle_entry') {
    text = (singular ? 'an entry' : amount + ' entries') + ' to ' + raffleText;
  } else if (type === 'raffle_ticket') {
    text = amount + ' raffle ' + (singular ? 'ticket' : 'tickets');
  } else {
    text = amount + ' ' + type;
  }

  var lowerText = text.charAt(0).toLowerCase() + text.slice(1);

  return {
    hasCampaign: true,
    amount: amount,
    type: type,
    text: text,
    lowerText: lowerText,
    displayText: capitalizeFirst(text),
    profileSubtitle: 'Send an invite to a friend and earn ' + lowerText,
  };
}
