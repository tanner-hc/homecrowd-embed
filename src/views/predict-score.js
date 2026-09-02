import * as api from '../api.js';
import { openBottomSheet } from '../base-components/BottomSheetModal.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { showError } from '../base-components/toastApi.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import plusSvg from '../assets/icons/stepper-plus.svg?raw';
import minusSvg from '../assets/icons/stepper-minus.svg?raw';
import infoSvg from '../assets/icons/info-outline.svg?raw';
import giftSvg from '../assets/icon-gift-outline.svg?raw';
import gamesSvg from '../assets/icon-games.svg?raw';
import personSvg from '../assets/icons/person.svg?raw';

var MAX_SCORE = 999;
var activeSheet = null;
var onRoute = null;

function svgClass(raw, className) {
  return String(raw).replace(/^<svg\s/i, '<svg class="' + className + '" ');
}

function formatEventTime(value) {
  if (!value) return '';
  var parts = String(value).split(':');
  var hour = parseInt(parts[0], 10);
  var minute = parts[1] || '00';
  if (Number.isNaN(hour)) return '';
  var suffix = hour >= 12 ? 'PM' : 'AM';
  var hour12 = hour % 12;
  if (hour12 === 0) hour12 = 12;
  return hour12 + ':' + minute + ' ' + suffix;
}

function predictionBadgeHtml() {
  return (
    '<div class="hc-predict-badge">' +
    svgClass(String(gamesSvg).replace(/#00C8FF/gi, 'currentColor'), 'hc-predict-badge-icon') +
    '<span>Prediction</span></div>'
  );
}

function teamLogoHtml(name, logoUrl) {
  if (logoUrl) {
    return (
      '<img data-hc-ph="school" src="' +
      escapeAttr(logoUrl) +
      '" alt="" class="hc-predict-team-logo" />'
    );
  }
  return '<div class="hc-predict-team-logo hc-predict-team-logo--empty" aria-hidden="true"></div>';
}

function stepperHtml(side, value) {
  return (
    '<div class="hc-predict-stepper">' +
    '<button type="button" class="hc-predict-step" data-hc-predict-step="' +
    side +
    ':-1" aria-label="Decrease"' +
    (value <= 0 ? ' disabled' : '') +
    '>' +
    svgClass(minusSvg, 'hc-predict-step-icon') +
    '</button>' +
    '<div class="hc-predict-score" data-hc-predict-score="' +
    side +
    '">' +
    escapeHtml(String(value)) +
    '</div>' +
    '<button type="button" class="hc-predict-step" data-hc-predict-step="' +
    side +
    ':1" aria-label="Increase"' +
    (value >= MAX_SCORE ? ' disabled' : '') +
    '>' +
    svgClass(plusSvg, 'hc-predict-step-icon') +
    '</button>' +
    '</div>'
  );
}

function scoreOnlyHtml(value) {
  return (
    '<div class="hc-predict-score hc-predict-score--readonly">' +
    escapeHtml(String(value)) +
    '</div>'
  );
}

function teamColHtml(side, name, logoUrl, score, readonly) {
  return (
    '<div class="hc-predict-team">' +
    teamLogoHtml(name, logoUrl) +
    '<div class="hc-predict-team-name">' +
    escapeHtml(name || '') +
    '</div>' +
    (readonly ? scoreOnlyHtml(score) : stepperHtml(side, score)) +
    '</div>'
  );
}

function paintScores(root, scores) {
  ['home', 'away'].forEach(function (side) {
    var label = root.querySelector('[data-hc-predict-score="' + side + '"]');
    if (label) label.textContent = String(scores[side]);
    var minus = root.querySelector('[data-hc-predict-step="' + side + ':-1"]');
    var plus = root.querySelector('[data-hc-predict-step="' + side + ':1"]');
    if (minus) minus.disabled = scores[side] <= 0;
    if (plus) plus.disabled = scores[side] >= MAX_SCORE;
  });
}

function closePredictScoreSheet() {
  if (onRoute) {
    window.removeEventListener('hashchange', onRoute);
    onRoute = null;
  }
  if (activeSheet && typeof activeSheet.close === 'function') {
    var sheet = activeSheet;
    activeSheet = null;
    sheet.close();
    return;
  }
  activeSheet = null;
}

function readPrediction(event) {
  var pred = event && event.my_prediction;
  if (!pred || typeof pred !== 'object') return null;
  var home = Number(pred.home_score);
  var away = Number(pred.away_score);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home: home, away: away };
}

function parseIsoMs(value) {
  if (!value) return null;
  var ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function wallClockMs(date, hour, minute, second) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  var ms = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    hour,
    minute,
    second
  );
  return Number.isFinite(ms) ? ms : null;
}

function eventStartMs(event) {
  var iso = parseIsoMs(event && event.starts_at);
  if (iso != null) return iso;
  var date = String((event && event.date) || '').trim();
  var time = String((event && event.time) || '').trim();
  var hour = 0;
  var minute = 0;
  var second = 0;
  if (time) {
    var parts = time.split(':');
    hour = parseInt(parts[0], 10);
    minute = parseInt(parts[1] || '0', 10);
    second = parseInt(parts[2] || '0', 10);
    if (Number.isNaN(hour) || Number.isNaN(minute) || Number.isNaN(second)) {
      hour = 0;
      minute = 0;
      second = 0;
    }
  }
  return wallClockMs(date, hour, minute, second);
}

function predictionLockMs(event) {
  var iso = parseIsoMs(event && event.prediction_locks_at);
  if (iso != null) return iso;
  var date = String((event && event.date) || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!String((event && event.time) || '').trim()) {
    return wallClockMs(date, 23, 59, 59);
  }
  return eventStartMs(event);
}

function isPredictionOpen(event) {
  var lockMs = predictionLockMs(event);
  if (lockMs == null) return false;
  return Date.now() < lockMs;
}

function toScore(value) {
  if (value == null || value === '') return null;
  var n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasFinalScore(event) {
  return toScore(event && event.home_score) != null && toScore(event && event.away_score) != null;
}

function resultsSubtitle(event, payload) {
  var homeScore =
    payload && Number.isFinite(Number(payload.home_score))
      ? Number(payload.home_score)
      : Number(event && event.home_score);
  var awayScore =
    payload && Number.isFinite(Number(payload.away_score))
      ? Number(payload.away_score)
      : Number(event && event.away_score);
  var homeName = (event && event.home_name) || '';
  var awayName = (event && event.opponent_name) || '';
  return homeName + ' ' + homeScore + ' · ' + awayName + ' ' + awayScore;
}

function displayRowName(row) {
  if (row && row.is_you) return 'You';
  var name = String(
    (row && (row.display_name || row.displayName || row.name)) || ''
  ).trim();
  return name || 'User';
}

function predictedScoreLabel(row) {
  var home = Number(row && row.home_score);
  var away = Number(row && row.away_score);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return '';
  return home + '–' + away;
}

function rankBadgeHtml(rank) {
  var n = Number(rank);
  if (n >= 1 && n <= 3) {
    var tone = n === 1 ? 'gold' : n === 2 ? 'silver' : 'bronze';
    return (
      '<span class="hc-predict-lb-medal hc-predict-lb-medal--' +
      tone +
      '" aria-hidden="true">' +
      '<svg viewBox="0 0 26 28" width="26" height="28" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M13 1.4L22.4 4.8v8.2c0 6.2-4.3 11.4-9.4 13.6C8 24.4 3.6 19.2 3.6 13V4.8L13 1.4z" fill="currentColor"/>' +
      '</svg>' +
      '<span class="hc-predict-lb-medal-num">' +
      n +
      '</span></span>'
    );
  }
  return '<span class="hc-predict-lb-rank">' + escapeHtml(String(rank || '')) + '</span>';
}

function resultsAvatarHtml(row) {
  var url = String((row && (row.avatar_url || row.avatarUrl)) || '').trim();
  if (url) {
    return (
      '<span class="hc-predict-lb-avatar"><img data-hc-ph="person" src="' +
      escapeAttr(url) +
      '" alt="" /></span>'
    );
  }
  return (
    '<span class="hc-predict-lb-avatar hc-predict-lb-avatar--ph">' +
    personSvg +
    '</span>'
  );
}

function resultsRowHtml(row) {
  return (
    '<div class="hc-predict-lb-row' +
    (row && row.is_you ? ' hc-predict-lb-row--you' : '') +
    '">' +
    '<div class="hc-predict-lb-left">' +
    rankBadgeHtml(row && row.rank) +
    resultsAvatarHtml(row) +
    '<span class="hc-predict-lb-name">' +
    escapeHtml(displayRowName(row)) +
    '</span></div>' +
    '<span class="hc-predict-lb-score">' +
    escapeHtml(predictedScoreLabel(row)) +
    '</span></div>'
  );
}

function buildResultsBodyHtml(rows) {
  var list =
    rows && rows.length
      ? rows.map(resultsRowHtml).join('')
      : '<div class="hc-predict-lb-empty">No predictions yet</div>';
  return (
    '<div class="hc-predict-body-wrap hc-predict-body-wrap--results">' +
    '<div class="hc-predict-lb">' +
    list +
    '</div></div>'
  );
}

function buildComposeBodyHtml(event, scores) {
  return (
    '<div class="hc-predict-body-wrap">' +
    '<div class="hc-predict-match">' +
    teamColHtml('home', event.home_name, event.home_logo, scores.home, false) +
    '<div class="hc-predict-match-rule" aria-hidden="true"></div>' +
    teamColHtml('away', event.opponent_name, event.opponent_logo, scores.away, false) +
    '</div>' +
    '<div class="hc-predict-info">' +
    '<div class="hc-predict-info-row">' +
    svgClass(infoSvg, 'hc-predict-info-icon') +
    '<div class="hc-predict-info-copy">' +
    '<div class="hc-predict-info-title">How it works</div>' +
    '<div class="hc-predict-info-text">Predict the final score before tipoff. One prediction, locked at tip.</div>' +
    '</div></div>' +
    '<div class="hc-predict-info-rule" aria-hidden="true"></div>' +
    '<div class="hc-predict-info-row">' +
    svgClass(giftSvg, 'hc-predict-info-icon') +
    '<div class="hc-predict-info-copy">' +
    '<div class="hc-predict-info-title">Scoring</div>' +
    '<div class="hc-predict-info-text">Closer predictions earn more points. Nail the exact score and get max points plus the Oracle badge.</div>' +
    '</div></div>' +
    '</div></div>'
  );
}

function buildViewBodyHtml(event, scores) {
  return (
    '<div class="hc-predict-body-wrap hc-predict-body-wrap--view">' +
    '<div class="hc-predict-match hc-predict-match--view">' +
    teamColHtml('home', event.home_name, event.home_logo, scores.home, true) +
    '<div class="hc-predict-match-rule" aria-hidden="true"></div>' +
    teamColHtml('away', event.opponent_name, event.opponent_logo, scores.away, true) +
    '</div></div>'
  );
}

function openViewSheet(event, scores) {
  activeSheet = openBottomSheet({
    iconHtml: predictionBadgeHtml(),
    title: 'Your prediction',
    subtitle: 'Submitted',
    bodyHtml: buildViewBodyHtml(event, scores),
    primaryButton: {
      label: 'Done',
      onPress: function () {
        activeSheet = null;
      },
    },
    onClose: function () {
      activeSheet = null;
      if (onRoute) {
        window.removeEventListener('hashchange', onRoute);
        onRoute = null;
      }
    },
  });

  var root = activeSheet && activeSheet.root;
  if (root) {
    root.classList.add('hc-predict-sheet-root', 'hc-predict-sheet-root--view');
    var sheetEl = root.querySelector('.hc-bs-sheet');
    if (sheetEl) sheetEl.classList.add('hc-predict-sheet');
  }
}

function markPredictSheet(root, extraClass) {
  if (!root) return;
  root.classList.add('hc-predict-sheet-root');
  if (extraClass) root.classList.add(extraClass);
  var sheetEl = root.querySelector('.hc-bs-sheet');
  if (sheetEl) sheetEl.classList.add('hc-predict-sheet');
}

function openResultsSheet(event) {
  activeSheet = openBottomSheet({
    iconHtml: predictionBadgeHtml(),
    title: 'Prediction results',
    subtitle: resultsSubtitle(event),
    bodyHtml:
      '<div class="hc-predict-body-wrap hc-predict-body-wrap--results">' +
      LoadingSpinner({ text: 'Loading results...' }) +
      '</div>',
    primaryButton: {
      label: 'Done',
      onPress: function () {
        activeSheet = null;
      },
    },
    onClose: function () {
      activeSheet = null;
      if (onRoute) {
        window.removeEventListener('hashchange', onRoute);
        onRoute = null;
      }
    },
  });

  var root = activeSheet && activeSheet.root;
  markPredictSheet(root, 'hc-predict-sheet-root--results');

  if (!event.id) {
    showError('Could not load prediction results');
    closePredictScoreSheet();
    return;
  }

  api
    .getScheduleEventPredictions(event.id)
    .then(function (payload) {
      if (!activeSheet) return;
      if (payload && Number.isFinite(Number(payload.home_score))) {
        event.home_score = Number(payload.home_score);
      }
      if (payload && Number.isFinite(Number(payload.away_score))) {
        event.away_score = Number(payload.away_score);
      }
      var subtitleEl = root && root.querySelector('.hc-bs-subtitle');
      if (subtitleEl) subtitleEl.textContent = resultsSubtitle(event, payload);
      activeSheet.updateBody(buildResultsBodyHtml((payload && payload.results) || []));
    })
    .catch(function (err) {
      showError((err && err.message) || 'Could not load prediction results');
      closePredictScoreSheet();
    });
}

function openComposeSheet(event, options) {
  options = options || {};
  var scores = { home: 0, away: 0 };
  var lockTime = formatEventTime(event.time);
  var lockLabel = lockTime ? 'Locks at ' + lockTime : 'Locks at tipoff';

  activeSheet = openBottomSheet({
    iconHtml: predictionBadgeHtml(),
    title: 'Predict the score',
    subtitle: lockLabel,
    bodyHtml: buildComposeBodyHtml(event, scores),
    primaryButton: {
      label: 'Confirm prediction',
      closeOnPress: false,
      onPress: function (close) {
        if (!event.id || !activeSheet) return;
        activeSheet.setPrimaryLoading(true);
        api
          .createScheduleEventPrediction(event.id, {
            home_score: scores.home,
            away_score: scores.away,
          })
          .then(function (res) {
            var prediction =
              (res && res.prediction) ||
              { home_score: scores.home, away_score: scores.away };
            event.already_predicted = true;
            event.my_prediction = {
              home_score: Number(prediction.home_score),
              away_score: Number(prediction.away_score),
            };
            if (typeof options.onSaved === 'function') {
              options.onSaved(event);
            }
            if (activeSheet) activeSheet.setPrimaryLoading(false);
            close(function () {
              activeSheet = null;
            });
          })
          .catch(function (err) {
            if (activeSheet) activeSheet.setPrimaryLoading(false);
            showError((err && err.message) || 'Could not save prediction');
          });
      },
    },
    secondaryButton: {
      label: 'Cancel',
      onPress: function () {
        activeSheet = null;
      },
    },
    onClose: function () {
      activeSheet = null;
      if (onRoute) {
        window.removeEventListener('hashchange', onRoute);
        onRoute = null;
      }
    },
  });

  var root = activeSheet && activeSheet.root;
  if (root) {
    root.classList.add('hc-predict-sheet-root');
    var sheetEl = root.querySelector('.hc-bs-sheet');
    if (sheetEl) sheetEl.classList.add('hc-predict-sheet');
    root.addEventListener('click', function (e) {
      var step = e.target.closest('[data-hc-predict-step]');
      if (!step || !root.contains(step) || step.disabled) return;
      var parts = String(step.getAttribute('data-hc-predict-step') || '').split(':');
      var side = parts[0];
      var delta = parseInt(parts[1], 10);
      if ((side === 'home' || side === 'away') && delta) {
        scores[side] = Math.max(0, Math.min(MAX_SCORE, scores[side] + delta));
        paintScores(root, scores);
      }
    });
  }
}

export function openPredictScoreSheet(event, options) {
  closePredictScoreSheet();
  event = event || {};
  options = options || {};

  if (hasFinalScore(event)) {
    openResultsSheet(event);
  } else if (readPrediction(event) || event.already_predicted) {
    var existing = readPrediction(event);
    openViewSheet(event, existing || { home: 0, away: 0 });
  } else if (!isPredictionOpen(event)) {
    showError('Predictions lock when the game starts');
    return;
  } else {
    openComposeSheet(event, options);
  }

  onRoute = function () {
    closePredictScoreSheet();
  };
  window.addEventListener('hashchange', onRoute);
}
