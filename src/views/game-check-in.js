import * as api from '../api.js';
import { navigate, getRoute } from '../router.js';
import PageHeader from '../base-components/PageHeader.js';
import MainButton from '../base-components/MainButton.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { showError } from '../base-components/toastApi.js';
import { escapeHtml } from '../base-components/html.js';
import { renderSuccessCelebration } from '../base-components/SuccessCelebration.js';
import { getCheckInLocation } from '../locationUtils.js';
import { ensureMapLibreLoaded, OPENFREEMAP_STYLE_URL } from '../openfreemap.js';

var RADIUS_SOURCE = 'hc-game-checkin-radius';
var RADIUS_FILL = 'hc-game-checkin-radius-fill';
var RADIUS_LINE = 'hc-game-checkin-radius-line';
var FALLBACK_CENTER = [-98.35, 39.5];
var CHECK_IN_POINTS = 500;
var CHECK_IN_OPENS_BEFORE_MS = 15 * 60 * 1000;
var active = null;

function schoolIdOf(user) {
  var school = user && (user.active_school || user.activeSchool);
  if (!school || typeof school !== 'object') return '';
  return String(school.id || school.schoolId || school.school_id || '').trim();
}

function toNumber(value) {
  var n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: raw.id,
    date: raw.date || '',
    time: raw.time || '',
    location_name: raw.location_name || '',
    latitude: toNumber(raw.latitude),
    longitude: toNumber(raw.longitude),
    check_in_radius_m: toNumber(raw.check_in_radius_m) || 150,
    check_in_points: toNumber(raw.check_in_points) || 500,
    check_in_enabled: !!raw.check_in_enabled,
    already_checked_in: !!raw.already_checked_in,
    starts_at: raw.starts_at || '',
    check_in_opens_at: raw.check_in_opens_at || '',
    check_in_closes_at: raw.check_in_closes_at || '',
  };
}

function parseIsoMs(value) {
  if (!value) return null;
  var ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function eventStartMs(event) {
  var iso = parseIsoMs(event && event.starts_at);
  if (iso != null) return iso;
  var date = String((event && event.date) || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
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

function isCheckInWindowOpen(event) {
  if (!event || !event.check_in_enabled) return false;
  var opensMs = checkInOpensMs(event);
  var closesMs = checkInClosesMs(event);
  if (opensMs == null || closesMs == null) return false;
  var now = Date.now();
  return now >= opensMs && now < closesMs;
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

function bindCheckInBack() {
  var back = document.getElementById('hc-game-checkin-back');
  if (back) {
    back.addEventListener('click', function () {
      navigate('/games');
    });
  }
}

function watchCheckInRoute(session) {
  session.onRoute = function () {
    if (!/^\/games\/[^/]+\/check-in$/.test(getRoute())) {
      teardown();
    }
  };
  window.addEventListener('hashchange', session.onRoute);
}

function readCachedEvent(eventId) {
  try {
    var raw = sessionStorage.getItem('hc_game_checkin');
    if (!raw) return null;
    var event = normalizeEvent(JSON.parse(raw));
    if (!event || String(event.id) !== String(eventId)) return null;
    return event;
  } catch (e) {
    return null;
  }
}

function fetchEventById(eventId) {
  return Promise.all([
    api.getUserProfile().catch(function () {
      return null;
    }),
    api.fetchCurrentUser().catch(function () {
      return null;
    }),
  ]).then(function (pair) {
    var user = pair[0] || pair[1];
    var schoolId = schoolIdOf(user);
    if (!schoolId) return null;
    return api.getSportSchedules(schoolId).then(function (schedules) {
      return Promise.all(
        (schedules || []).map(function (sport) {
          return api.getScheduleEvents(sport.id);
        })
      ).then(function (lists) {
        var i;
        var j;
        var list;
        for (i = 0; i < lists.length; i++) {
          list = lists[i] || [];
          for (j = 0; j < list.length; j++) {
            if (String(list[j].id) === String(eventId)) {
              return normalizeEvent(list[j]);
            }
          }
        }
        return null;
      });
    });
  });
}

function circleFeature(lng, lat, radiusMeters) {
  var steps = 64;
  var coords = [];
  var earth = 6378137;
  var latRad = (lat * Math.PI) / 180;
  var i;
  var bearing;
  var dLat;
  var dLng;
  for (i = 0; i <= steps; i++) {
    bearing = (i / steps) * 2 * Math.PI;
    dLat = ((radiusMeters * Math.cos(bearing)) / earth) * (180 / Math.PI);
    dLng =
      ((radiusMeters * Math.sin(bearing)) / (earth * Math.cos(latRad))) * (180 / Math.PI);
    coords.push([lng + dLng, lat + dLat]);
  }
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

function venuePinElement() {
  var el = document.createElement('div');
  el.className = 'hc-game-checkin-pin';
  el.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36" aria-hidden="true">' +
    '<path fill="#00C8FF" stroke="#ffffff" stroke-width="1.5" d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z"/>' +
    '</svg>';
  return el;
}

function userPinElement() {
  var el = document.createElement('div');
  el.className = 'hc-game-checkin-user';
  el.setAttribute('aria-label', 'You');
  el.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48" aria-hidden="true">' +
    '<path fill="#4285F4" stroke="#ffffff" stroke-width="2" d="M20 1C9.507 1 1 9.507 1 20c0 14.5 19 27 19 27s19-12.5 19-27C39 9.507 30.493 1 20 1z"/>' +
    '<text x="20" y="23" text-anchor="middle" fill="#ffffff" font-family="Baikal-Medium, Helvetica, Arial, sans-serif" font-size="11" font-weight="600">You</text>' +
    '</svg>';
  return el;
}

function teardown() {
  if (!active) return;
  if (active.onRoute) {
    window.removeEventListener('hashchange', active.onRoute);
  }
  if (active.watchId && navigator.geolocation) {
    navigator.geolocation.clearWatch(active.watchId);
  }
  if (active.map && typeof active.map.remove === 'function') {
    try {
      active.map.remove();
    } catch (e) {}
  }
  if (typeof active.successCleanup === 'function') {
    try {
      active.successCleanup();
    } catch (e) {}
  }
  active = null;
}

function showCheckedInSuccess(container, points, user) {
  var awarded = Number(points) || CHECK_IN_POINTS;
  if (active) {
    if (active.watchId && navigator.geolocation) {
      navigator.geolocation.clearWatch(active.watchId);
      active.watchId = 0;
    }
    if (active.map && typeof active.map.remove === 'function') {
      try {
        active.map.remove();
      } catch (e) {}
      active.map = null;
    }
  }
  var cleanup = renderSuccessCelebration(container, {
    title: 'Checked in!',
    subtitle: 'You earned +' + awarded + ' pts for attending tonight\'s game.',
    points: awarded,
    user: user,
    primaryLabel: 'Done',
    onPrimary: function () {
      navigate('/games');
    },
  });
  if (active) {
    active.successCleanup = cleanup;
  }
  return cleanup;
}

function hasVenue(event) {
  return event && event.latitude != null && event.longitude != null;
}

function fitMap(session) {
  var map = session.map;
  if (!map) return;
  var event = session.event;
  var bounds = [];
  if (hasVenue(event)) {
    var radius = event.check_in_radius_m || 150;
    var earth = 6378137;
    var dLat = (radius / earth) * (180 / Math.PI);
    var dLng = dLat / Math.cos((event.latitude * Math.PI) / 180);
    bounds.push([event.longitude - dLng, event.latitude - dLat]);
    bounds.push([event.longitude + dLng, event.latitude + dLat]);
  }
  if (session.userLat != null && session.userLng != null) {
    bounds.push([session.userLng, session.userLat]);
  }
  if (!bounds.length) return;
  try {
    if (bounds.length === 1) {
      map.jumpTo({ center: bounds[0], zoom: 15 });
      return;
    }
    map.fitBounds(bounds, { padding: 48, maxZoom: 16, animate: false });
  } catch (e) {}
}

function setRadius(session) {
  var map = session.map;
  var event = session.event;
  if (!map || !hasVenue(event)) return;
  var data = {
    type: 'FeatureCollection',
    features: [circleFeature(event.longitude, event.latitude, event.check_in_radius_m || 150)],
  };
  var source = map.getSource(RADIUS_SOURCE);
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(RADIUS_SOURCE, { type: 'geojson', data: data });
  map.addLayer({
    id: RADIUS_FILL,
    type: 'fill',
    source: RADIUS_SOURCE,
    paint: {
      'fill-color': '#00C8FF',
      'fill-opacity': 0.18,
    },
  });
  map.addLayer({
    id: RADIUS_LINE,
    type: 'line',
    source: RADIUS_SOURCE,
    paint: {
      'line-color': '#00C8FF',
      'line-width': 2,
    },
  });
}

function setUserMarker(session) {
  if (!session.map || !session.maplibregl) return;
  if (session.userLat == null || session.userLng == null) return;
  if (session.userMarker) {
    session.userMarker.setLngLat([session.userLng, session.userLat]);
    return;
  }
  session.userMarker = new session.maplibregl.Marker({
    element: userPinElement(),
    anchor: 'bottom',
    offset: [0, 0],
  })
    .setLngLat([session.userLng, session.userLat])
    .addTo(session.map);
}

function setVenueMarker(session) {
  if (!session.map || !session.maplibregl || !hasVenue(session.event)) return;
  if (session.venueMarker) return;
  session.venueMarker = new session.maplibregl.Marker({
    element: venuePinElement(),
    anchor: 'bottom',
  })
    .setLngLat([session.event.longitude, session.event.latitude])
    .addTo(session.map);
}

function applyUserPoint(session, coords, shouldFit) {
  if (!coords) return;
  session.userLat = coords.latitude;
  session.userLng = coords.longitude;
  setUserMarker(session);
  if (shouldFit) fitMap(session);
}

function startWatch(session) {
  if (!navigator.geolocation) return;
  session.watchId = navigator.geolocation.watchPosition(
    function (pos) {
      var coords = pos && pos.coords;
      if (!coords) return;
      var lat = Number(coords.latitude);
      var lng = Number(coords.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      applyUserPoint(session, { latitude: lat, longitude: lng }, false);
    },
    function () {},
    { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 }
  );
}

function bindCheckIn(container, session) {
  var btn = container.querySelector('#hc-game-checkin-submit');
  if (!btn) return;
  btn.addEventListener('click', function () {
    handleCheckIn(container, session);
  });
}

async function handleCheckIn(container, session) {
  var btn = container.querySelector('#hc-game-checkin-submit');
  var originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>Checking in...</span>';
  }
  try {
    var coords =
      session.userLat != null && session.userLng != null
        ? { latitude: session.userLat, longitude: session.userLng }
        : await getCheckInLocation();
    if (!coords || coords.latitude == null || coords.longitude == null) {
      showError('Could not get GPS. Allow location access and try again.');
      return;
    }
    applyUserPoint(session, coords, true);
    if (!hasVenue(session.event)) {
      showError('This game has no check-in pin yet.');
      return;
    }
    if (session.event.already_checked_in) {
      showError("You're already checked in");
      return;
    }
    if (!isCheckInWindowOpen(session.event)) {
      var opensMs = checkInOpensMs(session.event);
      var tooEarly = opensMs != null && Date.now() < opensMs;
      showError(
        tooEarly
          ? 'Check-in opens 15 minutes before the game.'
          : 'Check-in is closed for this game.'
      );
      return;
    }
    var response = await api.createScheduleEventCheckIn(session.event.id, coords);
    session.event.already_checked_in = true;
    try {
      sessionStorage.setItem('hc_game_checkin', JSON.stringify(session.event));
    } catch (_e) {}
    var currentUser = null;
    try {
      currentUser = await api.fetchCurrentUser();
    } catch (_e) {}
    var awarded =
      response && response.points_awarded != null
        ? response.points_awarded
        : session.event.check_in_points || CHECK_IN_POINTS;
    showCheckedInSuccess(container, awarded, currentUser);
    return;
  } catch (error) {
    var data = error && error.body;
    if (data && data.already_checked_in) {
      session.event.already_checked_in = true;
      showError(
        (Array.isArray(data.already_checked_in) && data.already_checked_in[0]) ||
          "You're already checked in"
      );
      return;
    }
    if (data && data.too_early) {
      showError(
        (Array.isArray(data.too_early) && data.too_early[0]) ||
          'Check-in opens 15 minutes before the game.'
      );
      return;
    }
    showError((error && error.message) || 'Check-in failed');
    return;
  } finally {
    if (btn && originalHtml && getRoute().indexOf('/check-in') >= 0) {
      var stillOnMap = !!(container && container.querySelector('#hc-game-checkin-submit'));
      if (stillOnMap) {
        if (session.event && session.event.already_checked_in) {
          btn.innerHTML = "You're already checked in";
          btn.disabled = true;
        } else {
          btn.innerHTML = originalHtml;
          btn.disabled = false;
        }
      }
    }
  }
}

function paintError(container, message) {
  container.innerHTML =
    '<div class="hc-game-checkin">' +
    PageHeader({ title: 'Check in', backButtonId: 'hc-game-checkin-back' }) +
    '<div class="hc-alert-error">' +
    escapeHtml(message) +
    '</div></div>';
  bindCheckInBack();
}

function paintUnavailable(container, event) {
  var opensMs = checkInOpensMs(event);
  var closesMs = checkInClosesMs(event);
  var tooEarly = opensMs != null && Date.now() < opensMs;
  var opens = formatWindowTime(opensMs) || 'TBD';
  var closes = formatWindowTime(closesMs) || 'TBD';
  var title = tooEarly ? "Check-in isn't open yet" : 'Check-in is closed';
  var text = tooEarly
    ? 'You can check in starting 15 minutes before kickoff. Come back during the window below.'
    : 'The check-in window for this game has ended.';
  container.innerHTML =
    '<div class="hc-game-checkin hc-game-checkin--window">' +
    PageHeader({ title: 'Check in', backButtonId: 'hc-game-checkin-back' }) +
    '<div class="hc-game-checkin-window">' +
    '<h2 class="hc-game-checkin-window-title">' +
    escapeHtml(title) +
    '</h2>' +
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
    '</div></div>' +
    '<div class="hc-game-checkin-footer">' +
    MainButton({ id: 'hc-game-checkin-done', text: 'Back to games' }) +
    '</div></div>';
  bindCheckInBack();
  var done = document.getElementById('hc-game-checkin-done');
  if (done) {
    done.addEventListener('click', function () {
      navigate('/games');
    });
  }
  var session = { onRoute: null };
  active = session;
  watchCheckInRoute(session);
}

function paintScreen(container, event) {
  container.innerHTML =
    '<div class="hc-game-checkin">' +
    PageHeader({ title: 'Check in', backButtonId: 'hc-game-checkin-back' }) +
    '<div class="hc-game-checkin-map" id="hc-game-checkin-map"></div>' +
    '<div class="hc-game-checkin-footer">' +
    MainButton({
      id: 'hc-game-checkin-submit',
      text: event.already_checked_in ? "You're already checked in" : 'Check in',
      loadingText: 'Checking in...',
      disabled: !!event.already_checked_in,
    }) +
    '</div></div>';

  bindCheckInBack();

  var mount = document.getElementById('hc-game-checkin-map');
  var session = {
    event: event,
    map: null,
    maplibregl: null,
    userMarker: null,
    venueMarker: null,
    userLat: null,
    userLng: null,
    watchId: 0,
    onRoute: null,
    successCleanup: null,
  };
  active = session;
  if (!event.already_checked_in) {
    bindCheckIn(container, session);
  }

  watchCheckInRoute(session);

  ensureMapLibreLoaded()
    .then(function (maplibregl) {
      if (active !== session || !mount) return;
      var center = hasVenue(event)
        ? [event.longitude, event.latitude]
        : FALLBACK_CENTER;
      var zoom = hasVenue(event) ? 15 : 3;
      var map = new maplibregl.Map({
        container: mount,
        style: OPENFREEMAP_STYLE_URL,
        center: center,
        zoom: zoom,
        maxZoom: 18,
        attributionControl: false,
      });
      session.map = map;
      session.maplibregl = maplibregl;
      map.once('load', function () {
        if (active !== session) return;
        setRadius(session);
        setVenueMarker(session);
        setUserMarker(session);
        fitMap(session);
        map.resize();
      });
      window.setTimeout(function () {
        if (session.map) session.map.resize();
      }, 120);
    })
    .catch(function () {
      if (active !== session) return;
      if (mount) {
        mount.innerHTML =
          '<div class="hc-game-checkin-map-error">Map could not be loaded. Please try again later.</div>';
      }
    });

  getCheckInLocation().then(function (coords) {
    if (active !== session) return;
    applyUserPoint(session, coords, true);
  });
  startWatch(session);
}

export function renderGameCheckIn(container, eventId) {
  teardown();
  container.innerHTML = LoadingSpinner({ text: 'Loading check-in...' });
  var cached = readCachedEvent(eventId);
  var load = cached ? Promise.resolve(cached) : fetchEventById(eventId);
  load
    .then(function (event) {
      if (!event) {
        paintError(container, 'This game could not be found.');
        return;
      }
      if (event.already_checked_in) {
        paintScreen(container, event);
        return;
      }
      if (!isCheckInWindowOpen(event)) {
        paintUnavailable(container, event);
        return;
      }
      paintScreen(container, event);
    })
    .catch(function (err) {
      paintError(container, (err && err.message) || 'Failed to load check-in');
    });
}
