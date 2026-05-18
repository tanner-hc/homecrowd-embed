import {
  parsePeriodEndTimestamp,
} from './rewardPeriodCountdown.js';
import {
  applyWinnerAlertIfNew,
  buildOverallWinnerAlertKey,
  buildWeeklyWinnerAlertKey,
  buildWinnerAlertFromWebSocketMessage,
  hasWinnerAlertBeenShown,
  markWinnerAlertBeenShown,
} from './winnerAlert.js';
import { connectWeeklyPrizeWebSocket, showWeeklyWinnerModal } from './weekly-reward.js';

var FINALIZE_MODAL_GRACE_MS = 30 * 60 * 1000;

function buildPrizeWinnerAlertKey(leaderboardType, fields) {
  if (!fields || !fields.winnerName) return null;
  if (leaderboardType === 'overall') {
    return buildOverallWinnerAlertKey({
      prize_id: fields.prizeId,
      end_date: fields.periodEndsAt,
      winner_name: fields.winnerName,
    });
  }
  return buildWeeklyWinnerAlertKey({
    prize_id: fields.prizeId,
    week_end_date: fields.periodEndDateOnly || fields.periodEndsAt,
    winner_name: fields.winnerName,
  });
}

function isWithinFinalizeGrace(periodEndTimestamp, nowMs) {
  var now = nowMs != null ? nowMs : Date.now();
  if (!periodEndTimestamp || !Number.isFinite(periodEndTimestamp)) return true;
  if (now < periodEndTimestamp) return true;
  return now <= periodEndTimestamp + FINALIZE_MODAL_GRACE_MS;
}

export function createPrizeFinalizeModalWatcher(options) {
  var opts = options || {};
  var leaderboardType = opts.leaderboardType === 'overall' ? 'overall' : 'weekly';
  var periodEndsAt = opts.periodEndsAt;
  var periodEndDateOnly = opts.periodEndDateOnly;
  var periodEndTime = opts.periodEndTime;
  var periodEndTimestamp = parsePeriodEndTimestamp(periodEndsAt, periodEndDateOnly, periodEndTime);
  var knownWinner = String(opts.initialWinnerName || '').trim();
  var liveModalShown = !!knownWinner;
  var prizeId = opts.prizeId;
  var prizeTitle = opts.prizeTitle || '';
  var enabled = opts.enabled !== false;
  var processedWsJson = null;

  function recomputePeriodEndTimestamp() {
    periodEndTimestamp = parsePeriodEndTimestamp(periodEndsAt, periodEndDateOnly, periodEndTime);
  }

  function openLiveModal(snapshot) {
    var trimmed = String((snapshot && snapshot.winnerName) || '').trim();
    if (!enabled || !trimmed || liveModalShown) return;
    if (periodEndTimestamp && Date.now() < periodEndTimestamp) return;
    if (!isWithinFinalizeGrace(periodEndTimestamp)) return;

    var alertKey = buildPrizeWinnerAlertKey(leaderboardType, {
      prizeId: prizeId,
      periodEndsAt: periodEndsAt,
      periodEndDateOnly: periodEndDateOnly,
      winnerName: trimmed,
    });
    if (alertKey) markWinnerAlertBeenShown(alertKey);
    knownWinner = trimmed;
    liveModalShown = true;
    showWeeklyWinnerModal(
      {
        winner_name: trimmed,
        title: (snapshot && snapshot.prizeTitle) || prizeTitle,
      },
      prizeTitle,
      {
        prizeKind: leaderboardType,
        force: true,
        winnerBadgeLabel: leaderboardType === 'overall' ? 'Overall Winner' : 'Weekly Winner',
      },
    );
  }

  function tryShowLiveModal(winnerName) {
    openLiveModal({ winnerName: winnerName, prizeTitle: prizeTitle });
  }

  function handleWsMessage(message) {
    if (!message || !enabled) return;
    var json = JSON.stringify(message);
    if (processedWsJson === json) return;

    var alert = buildWinnerAlertFromWebSocketMessage(message);
    if (!alert || !alert.key) return;

    var expectedKind = leaderboardType === 'overall' ? 'overall' : 'weekly';
    if (alert.kind !== expectedKind) {
      processedWsJson = json;
      return;
    }

    if (!isWithinFinalizeGrace(periodEndTimestamp)) {
      markWinnerAlertBeenShown(alert.key);
      processedWsJson = json;
      return;
    }

    if (hasWinnerAlertBeenShown(alert.key) || liveModalShown) {
      processedWsJson = json;
      return;
    }

    applyWinnerAlertIfNew(message, function (wsAlert) {
      knownWinner = wsAlert.winnerName || knownWinner;
      liveModalShown = true;
      showWeeklyWinnerModal(
        {
          winner_name: wsAlert.winnerName,
          title: wsAlert.prizeTitle || prizeTitle,
        },
        prizeTitle,
        {
          prizeKind: leaderboardType,
          force: true,
          alert: wsAlert,
          alertKey: wsAlert.key,
          winnerBadgeLabel: wsAlert.winnerBadgeLabel,
        },
      );
    });
    processedWsJson = json;
  }

  var wsCleanup = connectWeeklyPrizeWebSocket({
    enabled: enabled,
    prizeType: leaderboardType,
    onMessage: handleWsMessage,
  });

  return {
    destroy: function () {
      if (typeof wsCleanup === 'function') wsCleanup();
    },
    onWinnerNameUpdate: tryShowLiveModal,
    updateContext: function (next) {
      next = next || {};
      if (next.leaderboardType != null) {
        leaderboardType = next.leaderboardType === 'overall' ? 'overall' : 'weekly';
      }
      if (next.periodEndsAt !== undefined) periodEndsAt = next.periodEndsAt;
      if (next.periodEndDateOnly !== undefined) periodEndDateOnly = next.periodEndDateOnly;
      if (next.periodEndTime !== undefined) periodEndTime = next.periodEndTime;
      if (next.prizeId !== undefined) prizeId = next.prizeId;
      if (next.prizeTitle !== undefined) prizeTitle = next.prizeTitle || '';
      recomputePeriodEndTimestamp();
    },
  };
}
