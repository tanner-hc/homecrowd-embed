import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import {
  pickSchoolDisplay,
  pickSchoolLogoUrl,
} from '../school-contribution.js';
import plusSvg from '../assets/icons/stepper-plus.svg?raw';
import lockSvg from '../assets/icons/settings/lock.svg?raw';
import checkSvg from '../assets/icons/check.svg?raw';
import { openPredictScoreSheet } from './predict-score.js';
import { openBottomSheet } from '../base-components/BottomSheetModal.js';

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function todayStamp() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function nowTimeStamp() {
  var d = new Date();
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}

function schoolIdOf(user) {
  var school = user && (user.active_school || user.activeSchool);
  if (!school || typeof school !== 'object') return '';
  return String(school.id || school.schoolId || school.school_id || '').trim();
}

function formatEventDate(value) {
  if (!value) return '';
  var date = new Date(String(value) + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatEventTime(value) {
  if (!value) return 'TBD';
  var parts = String(value).split(':');
  var hour = parseInt(parts[0], 10);
  var minute = parts[1] || '00';
  if (Number.isNaN(hour)) return 'TBD';
  var suffix = hour >= 12 ? 'PM' : 'AM';
  var hour12 = hour % 12;
  if (hour12 === 0) hour12 = 12;
  return hour12 + ':' + minute + ' ' + suffix;
}

var CHECK_IN_OPENS_BEFORE_MS = 15 * 60 * 1000;

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

function checkInOpensMs(event) {
  var iso = parseIsoMs(event && event.check_in_opens_at);
  if (iso != null) return iso;
  var startMs = eventStartMs(event);
  return startMs == null ? null : startMs - CHECK_IN_OPENS_BEFORE_MS;
}

function checkInClosesMs(event) {
  var iso = parseIsoMs(event && event.check_in_closes_at);
  if (iso != null) return iso;
  var date = String((event && event.date) || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  var ms = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)) + 1,
    0,
    0,
    0
  );
  return Number.isFinite(ms) ? ms : null;
}

function isWithinCheckInWindow(event, nowMs) {
  var opensMs = checkInOpensMs(event);
  var closesMs = checkInClosesMs(event);
  if (opensMs == null || closesMs == null) return false;
  var now = nowMs != null ? nowMs : Date.now();
  return now >= opensMs && now < closesMs;
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

function isPredictionOpen(event, nowMs) {
  var lockMs = predictionLockMs(event);
  if (lockMs == null) return false;
  var now = nowMs != null ? nowMs : Date.now();
  return now < lockMs;
}

function canCheckIn(event, nowMs) {
  return !!(
    event &&
    event.check_in_enabled &&
    !event.already_checked_in &&
    isWithinCheckInWindow(event, nowMs)
  );
}

function formatWindowTime(ms) {
  if (ms == null) return '';
  var date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function openCheckInUnavailableModal(event) {
  var opensMs = checkInOpensMs(event);
  var closesMs = checkInClosesMs(event);
  var tooEarly = opensMs != null && Date.now() < opensMs;
  var title = tooEarly ? "Check-in isn't open yet" : 'Check-in is closed';
  var text = tooEarly
    ? 'You can check in starting 15 minutes before kickoff. Come back during the window below.'
    : 'The check-in window for this game has ended.';
  var opens = formatWindowTime(opensMs) || 'TBD';
  var closes = formatWindowTime(closesMs) || 'TBD';

  openBottomSheet({
    title: 'Check in',
    subtitle: title,
    bodyHtml:
      '<div class="hc-game-checkin-window">' +
      '<p class="hc-game-checkin-window-text">' +
      escapeHtml(text) +
      '</p>' +
      '<div class="hc-game-checkin-window-times">' +
      '<div class="hc-game-checkin-window-row">' +
      '<span>Opens</span><strong>' +
      escapeHtml(opens) +
      '</strong></div>' +
      '<div class="hc-game-checkin-window-row">' +
      '<span>Closes</span><strong>' +
      escapeHtml(closes) +
      '</strong></div>' +
      '</div></div>',
    primaryButton: {
      label: 'Back to games',
    },
  });
}

function toScore(value) {
  if (value == null || value === '') return null;
  var n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasFinalScore(event) {
  return toScore(event && event.home_score) != null && toScore(event && event.away_score) != null;
}

function isPastEvent(event, today) {
  return String((event && event.date) || '') < today;
}

function svgClass(raw, className) {
  return String(raw).replace(/^<svg\s/i, '<svg class="' + className + '" ');
}

function teamBlockHtml(name, logoUrl) {
  var logo = logoUrl
    ? '<img data-hc-ph="school" src="' +
      escapeAttr(logoUrl) +
      '" alt="" class="hc-games-team-logo" />'
    : '<div class="hc-games-team-logo hc-games-team-logo--empty"></div>';
  return (
    '<div class="hc-games-team">' +
    logo +
    '<div class="hc-games-team-name">' +
    escapeHtml(name || '') +
    '</div>' +
    '</div>'
  );
}

function cardHtml(event, expanded, checkInOpen) {
  var points = Number.isFinite(Number(event.check_in_points))
    ? Number(event.check_in_points)
    : 500;
  var checkInLabel = event.already_checked_in
    ? 'Checked in'
    : checkInOpen
      ? 'Check-in +' + points + ' pts'
      : 'Check-in';
  var statusIcon = event.already_checked_in
    ? svgClass(checkSvg, 'hc-games-check')
    : checkInOpen
      ? ''
      : svgClass(lockSvg, 'hc-games-lock');
  var hasPrediction = !!(event.already_predicted || event.my_prediction);
  var scored = hasFinalScore(event);
  var predictLocked = !scored && !hasPrediction && !isPredictionOpen(event);
  var predictLabel = scored
    ? 'Prediction results'
    : hasPrediction
      ? 'Your prediction'
      : 'Predict the score';
  var showPredict = scored || hasPrediction || isPredictionOpen(event);
  var showCheckIn = true;
  var actions = '';
  if (showPredict || showCheckIn) {
    actions =
      '<div class="hc-games-card-actions' +
      (showPredict && showCheckIn ? '' : ' hc-games-card-actions--single') +
      '">';
    if (showPredict) {
      actions +=
        '<button type="button" class="hc-games-btn hc-games-btn--ghost" data-hc-games-predict="' +
        escapeAttr(String(event.id || '')) +
        '"' +
        (predictLocked ? ' disabled' : '') +
        '>' +
        predictLabel +
        '</button>';
    }
    if (showCheckIn) {
      actions +=
        '<button type="button" class="hc-games-btn hc-games-btn--primary" data-hc-games-checkin="' +
        escapeAttr(String(event.id || '')) +
        '">Check in</button>';
    }
    actions += '</div>';
  }
  return (
    '<article class="hc-games-card' +
    (expanded || scored || hasPrediction || showPredict || showCheckIn
      ? ' hc-games-card--expanded'
      : '') +
    '">' +
    '<div class="hc-games-card-match">' +
    teamBlockHtml(event.home_name, event.home_logo) +
    '<div class="hc-games-card-time">' +
    escapeHtml(formatEventTime(event.time)) +
    '</div>' +
    teamBlockHtml(event.opponent_name, event.opponent_logo) +
    '</div>' +
    '<div class="hc-games-card-rule"></div>' +
    '<div class="hc-games-card-meta">' +
    '<span>' +
    escapeHtml(formatEventDate(event.date)) +
    '</span>' +
    '<span>' +
    escapeHtml(event.location_name || '') +
    '</span>' +
    '<span class="hc-games-card-checkin">' +
    escapeHtml(checkInLabel) +
    statusIcon +
    '</span>' +
    '</div>' +
    actions +
    '</article>'
  );
}

function chromeHtml(tab) {
  var upcomingOn = tab !== 'past';
  return (
    '<div class="hc-games-sticky">' +
    '<div class="hc-games-top">' +
    '<h1 class="hc-app-header-title">Games</h1>' +
    '<button type="button" class="hc-app-header-circle" data-hc-games-add aria-label="Add">' +
    svgClass(plusSvg, 'hc-games-plus') +
    '</button>' +
    '</div>' +
    '<div class="hc-games-segments" role="tablist">' +
    '<button type="button" class="hc-games-seg' +
    (upcomingOn ? ' hc-games-seg--on' : '') +
    '" data-hc-games-tab="upcoming">Upcoming</button>' +
    '<button type="button" class="hc-games-seg' +
    (!upcomingOn ? ' hc-games-seg--on' : '') +
    '" data-hc-games-tab="past">Past</button>' +
    '</div>' +
    '</div>'
  );
}

function listHtml(events, tab) {
  if (!events.length) {
    return (
      '<div class="hc-games-empty">' +
      (tab === 'past' ? 'No past games' : 'No upcoming games') +
      '</div>'
    );
  }
  var nowMs = Date.now();
  var firstOpen = -1;
  var i;
  for (i = 0; i < events.length; i++) {
    if (canCheckIn(events[i], nowMs)) {
      firstOpen = i;
      break;
    }
  }
  return events
    .map(function (event, index) {
      var open = canCheckIn(event, nowMs);
      return cardHtml(event, index === firstOpen && open, open);
    })
    .join('');
}

function bind(container, state) {
  container.querySelectorAll('[data-hc-games-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = btn.getAttribute('data-hc-games-tab') || 'upcoming';
      if (state.tab === next) return;
      state.tab = next;
      paint(container, state);
    });
  });
  container.querySelectorAll('[data-hc-games-predict]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-hc-games-predict');
      if (!id) return;
      var event = (state.events || []).find(function (row) {
        return String(row.id) === String(id);
      });
      if (!event) return;
      if (
        !hasFinalScore(event) &&
        !event.already_predicted &&
        !event.my_prediction &&
        !isPredictionOpen(event)
      ) {
        return;
      }
      openPredictScoreSheet(event, {
        onSaved: function (saved) {
          if (!saved || !saved.id) return;
          var i;
          for (i = 0; i < state.events.length; i++) {
            if (String(state.events[i].id) === String(saved.id)) {
              state.events[i].already_predicted = true;
              state.events[i].my_prediction = saved.my_prediction;
              break;
            }
          }
          paint(container, state);
        },
      });
    });
  });
  container.querySelectorAll('[data-hc-games-checkin]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-hc-games-checkin');
      if (!id) return;
      var event = (state.events || []).find(function (row) {
        return String(row.id) === String(id);
      });
      if (!event) return;
      if (event.already_checked_in) {
        try {
          sessionStorage.setItem('hc_game_checkin', JSON.stringify(event));
        } catch (e) {}
        navigate('/games/' + encodeURIComponent(id) + '/check-in');
        return;
      }
      if (!event.check_in_enabled) {
        openBottomSheet({
          title: 'Check in',
          subtitle: 'Check-in is disabled for this game',
          bodyHtml: '<p style="margin:0; font-family: \'Baikal-Book\', var(--hc-font); color:#888888;">This game does not have check-in enabled.</p>',
          primaryButton: { label: 'Back to games' },
        });
        return;
      }
      if (!canCheckIn(event)) {
        openCheckInUnavailableModal(event);
        return;
      }
      try {
        sessionStorage.setItem('hc_game_checkin', JSON.stringify(event));
      } catch (e) {}
      navigate('/games/' + encodeURIComponent(id) + '/check-in');
    });
  });
}

function paint(container, state) {
  var today = todayStamp();
  var filtered = (state.events || []).filter(function (event) {
    var past = isPastEvent(event, today);
    return state.tab === 'past' ? past : !past;
  });
  container.innerHTML =
    '<div class="hc-games">' +
    chromeHtml(state.tab) +
    '<div class="hc-games-body">' +
    (state.loading
      ? LoadingSpinner({ text: 'Loading games...' })
      : listHtml(filtered, state.tab)) +
    '</div>' +
    '</div>';
  bind(container, state);
}

function flattenEvents(schedules, eventsBySchedule, user) {
  var homeName = pickSchoolDisplay(user);
  var homeLogo = pickSchoolLogoUrl(user);
  var rows = [];
  (schedules || []).forEach(function (sport) {
    var list = eventsBySchedule[sport.id] || [];
    list.forEach(function (event) {
      rows.push({
        id: event.id,
        date: event.date || '',
        time: event.time || '',
        location_name: event.location_name || '',
        latitude: Number.isFinite(Number(event.latitude)) ? Number(event.latitude) : null,
        longitude: Number.isFinite(Number(event.longitude)) ? Number(event.longitude) : null,
        check_in_radius_m: Number.isFinite(Number(event.check_in_radius_m))
          ? Number(event.check_in_radius_m)
          : 150,
        check_in_enabled: !!event.check_in_enabled,
        check_in_points: Number.isFinite(Number(event.check_in_points))
          ? Number(event.check_in_points)
          : 500,
        already_checked_in: !!event.already_checked_in,
        already_predicted: !!event.already_predicted,
        my_prediction: event.my_prediction || null,
        home_score: toScore(event.home_score),
        away_score: toScore(event.away_score),
        opponent_name: event.opponent_name || '',
        opponent_logo: event.logo_url || event.opponent_logo_url || '',
        home_name: homeName,
        home_logo: homeLogo,
        starts_at: event.starts_at || '',
        prediction_locks_at: event.prediction_locks_at || '',
        check_in_opens_at: event.check_in_opens_at || '',
        check_in_closes_at: event.check_in_closes_at || '',
      });
    });
  });
  rows.sort(function (a, b) {
    var dateCmp = String(a.date).localeCompare(String(b.date));
    if (dateCmp !== 0) return dateCmp;
    return String(a.time || '99').localeCompare(String(b.time || '99'));
  });
  return rows;
}

export function renderGames(container) {
  var state = { tab: 'upcoming', events: [], loading: true };
  paint(container, state);

  Promise.all([
    api.getUserProfile().catch(function () {
      return null;
    }),
    api.fetchCurrentUser().catch(function () {
      return null;
    }),
  ])
    .then(function (pair) {
      var user = pair[0] || pair[1];
      var schoolId = schoolIdOf(user);
      if (!schoolId) return { user: user, schedules: [] };
      return api.getSportSchedules(schoolId).then(function (schedules) {
        return { user: user, schedules: schedules };
      });
    })
    .then(function (payload) {
      var schedules = payload.schedules || [];
      if (!schedules.length) {
        state.events = [];
        state.loading = false;
        paint(container, state);
        return null;
      }
      return Promise.all(
        schedules.map(function (sport) {
          return api.getScheduleEvents(sport.id).then(function (events) {
            return { id: sport.id, events: events };
          });
        })
      ).then(function (bundles) {
        var byId = {};
        bundles.forEach(function (bundle) {
          byId[bundle.id] = bundle.events;
        });
        state.events = flattenEvents(schedules, byId, payload.user);
        state.loading = false;
        paint(container, state);
      });
    })
    .catch(function () {
      state.events = [];
      state.loading = false;
      paint(container, state);
    });
}
