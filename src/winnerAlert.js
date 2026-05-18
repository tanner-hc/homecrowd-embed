const STORAGE_KEY = 'hcWinnerAlertShownKeys';
const MAX_STORED_KEYS = 100;

function readShownKeys() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    var parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (_e) {
    return new Set();
  }
}

function writeShownKeys(keys) {
  var arr = [];
  keys.forEach(function (key) {
    arr.push(key);
  });
  if (arr.length > MAX_STORED_KEYS) {
    arr = arr.slice(arr.length - MAX_STORED_KEYS);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

export function hasWinnerAlertBeenShown(key) {
  if (!key) return true;
  return readShownKeys().has(key);
}

export function markWinnerAlertBeenShown(key) {
  if (!key) return;
  var keys = readShownKeys();
  keys.add(key);
  writeShownKeys(keys);
}

export function buildWeeklyWinnerAlertKey(source) {
  if (!source) return null;
  return (
    'weekly-prize:' +
    (source.prize_id || source.prizeId || source.week_ended_at || source.week_end_date || 'unknown') +
    ':' +
    (source.name || source.display_name || source.winner_name || 'unknown')
  );
}

export function buildOverallWinnerAlertKey(source) {
  if (!source) return null;
  return (
    'overall-prize:' +
    (source.prize_id || source.prizeId || source.end_date || 'unknown') +
    ':' +
    (source.name || source.display_name || source.winner_name || 'unknown')
  );
}

function parseSortMs(value) {
  if (!value) return 0;
  var ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function buildWinnerAlertFromLeaderboard(leaderboardRes) {
  if (!leaderboardRes || leaderboardRes.success === false) return null;

  var candidates = [];
  var weekly = leaderboardRes.last_week_prize_winner;
  if (weekly && (weekly.name || weekly.display_name)) {
    candidates.push({
      kind: 'weekly',
      key: buildWeeklyWinnerAlertKey(weekly),
      winnerName: weekly.display_name || weekly.name,
      winnerPoints: weekly.points != null ? weekly.points : weekly.winning_points,
      prizeTitle:
        weekly.prize_title ||
        weekly.cover_title ||
        (leaderboardRes.weekly_prize && leaderboardRes.weekly_prize.title) ||
        (leaderboardRes.weekly_prize && leaderboardRes.weekly_prize.cover_title),
      winnerBadgeLabel: 'Weekly Winner',
      sortAt: weekly.week_ended_at || weekly.week_end_date,
    });
  }

  var overall = leaderboardRes.last_overall_prize_winner;
  if (overall && (overall.name || overall.display_name)) {
    candidates.push({
      kind: 'overall',
      key: buildOverallWinnerAlertKey(overall),
      winnerName: overall.display_name || overall.name,
      winnerPoints: overall.points != null ? overall.points : overall.winning_points,
      prizeTitle:
        overall.prize_title ||
        overall.cover_title ||
        (leaderboardRes.overall_prize && leaderboardRes.overall_prize.title) ||
        (leaderboardRes.overall_prize && leaderboardRes.overall_prize.cover_title),
      winnerBadgeLabel: 'Overall Winner',
      sortAt: overall.end_date,
    });
  }

  if (!candidates.length) return null;
  candidates.sort(function (a, b) {
    return parseSortMs(b.sortAt) - parseSortMs(a.sortAt);
  });
  return candidates[0];
}

export function pickUnshownWinnerAlert(leaderboardRes) {
  var candidate = buildWinnerAlertFromLeaderboard(leaderboardRes);
  if (!candidate || !candidate.key) return null;
  if (hasWinnerAlertBeenShown(candidate.key)) return null;
  return candidate;
}

export function buildWinnerAlertFromWebSocketMessage(message) {
  if (!message || typeof message !== 'object') return null;

  if (message.type === 'weekly_prize_finalized') {
    var prize = message.weekly_prize;
    if (!prize || !prize.winner_name) return null;
    return {
      kind: 'weekly',
      key: buildWeeklyWinnerAlertKey({
        prize_id: prize.id,
        week_end_date: prize.week_end_date,
        winner_name: prize.winner_name,
      }),
      winnerName: prize.winner_name,
      winnerPoints: prize.winner_points != null ? prize.winner_points : prize.winning_points,
      prizeTitle: prize.title || prize.cover_title,
      winnerBadgeLabel: 'Weekly Winner',
    };
  }

  if (message.type === 'overall_prize_finalized') {
    var overallPrize = message.overall_prize;
    if (!overallPrize || !overallPrize.winner_name) return null;
    return {
      kind: 'overall',
      key: buildOverallWinnerAlertKey({
        prize_id: overallPrize.id,
        end_date: overallPrize.end_date,
        winner_name: overallPrize.winner_name,
      }),
      winnerName: overallPrize.winner_name,
      winnerPoints:
        overallPrize.winner_points != null ? overallPrize.winner_points : overallPrize.winning_points,
      prizeTitle: overallPrize.title || overallPrize.cover_title,
      winnerBadgeLabel: 'Overall Winner',
    };
  }

  return null;
}
