import * as api from '../api.js';
import { navigate } from '../router.js';
import NavHeader from '../base-components/NavHeader.js';
import MainButton from '../base-components/MainButton.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { showSuccess, showError } from '../base-components/toastApi.js';
import { escapeHtml } from '../base-components/html.js';
import { getCheckInLocation } from '../locationUtils.js';

function formatDistance(meters) {
  if (meters == null) return '';
  if (meters < 1000) return Math.round(meters) + ' m';
  return (meters / 1000).toFixed(1) + ' km';
}

function formatCheckInTime(value) {
  if (!value) return '';
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function locationFailMessage() {
  return 'Could not get GPS. Allow location access and try again.';
}

function renderLocationCard(location) {
  var alreadyCheckedIn = !!location.already_checked_in;
  var checkedAt = formatCheckInTime(location.my_check_in && location.my_check_in.created_at);
  var html = '';
  html += '<div class="hc-check-in-card" data-location-id="' + escapeHtml(location.id) + '">';
  html += '<div class="hc-check-in-card-header">';
  html += '<div class="hc-check-in-location-name">' + escapeHtml(location.name || '') + '</div>';
  if (alreadyCheckedIn) {
    html += '<div class="hc-check-in-badge">Checked in</div>';
  }
  html += '</div>';
  if (location.address) {
    html +=
      '<div class="hc-check-in-location-address">' + escapeHtml(location.address) + '</div>';
  }
  html +=
    '<div class="hc-check-in-location-meta">Within ' +
    escapeHtml(String(location.radius_meters || 100)) +
    ' m of the spot</div>';
  if (alreadyCheckedIn) {
    html +=
      '<div class="hc-check-in-already">Already checked in' +
      (checkedAt ? ' · ' + escapeHtml(checkedAt) : '') +
      '</div>';
  }
  html += MainButton({
    id: 'hc-check-in-btn-' + location.id,
    text: alreadyCheckedIn ? "You're already checked in" : 'Check In',
    loadingText: 'Checking in...',
    disabled: alreadyCheckedIn,
    className: 'hc-check-in-btn' + (alreadyCheckedIn ? ' hc-check-in-btn--done' : ''),
  });
  html += '</div>';
  return html;
}

function bindCheckInActions(container, locations) {
  locations.forEach(function (location) {
    if (location.already_checked_in) return;
    var btn = container.querySelector('#hc-check-in-btn-' + location.id);
    if (!btn) return;
    btn.addEventListener('click', function () {
      handleCheckIn(container, location);
    });
  });
}

async function handleCheckIn(container, location) {
  if (location.already_checked_in) return;
  var btn = container.querySelector('#hc-check-in-btn-' + location.id);
  var allButtons = container.querySelectorAll('.hc-check-in-btn:not(.hc-check-in-btn--done)');
  var originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>Checking in...</span>';
  }
  allButtons.forEach(function (other) {
    if (other !== btn) other.disabled = true;
  });

  try {
    var coords = await getCheckInLocation();
    if (!coords || coords.latitude == null || coords.longitude == null) {
      showError(locationFailMessage());
      return;
    }

    var response = await api.createCheckIn({
      location_id: location.id,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    if (response && response.success) {
      var distance = response.check_in && response.check_in.distance_meters;
      showSuccess(
        distance != null
          ? 'Checked in at ' + location.name + ' (' + formatDistance(distance) + ' away)'
          : 'Checked in at ' + location.name
      );
      await loadCheckIn(container);
      return;
    }

    var farDistance = response && response.check_in && response.check_in.distance_meters;
    showError(
      farDistance != null
        ? 'Too far — ' +
            formatDistance(farDistance) +
            ' away (need within ' +
            location.radius_meters +
            ' m)'
        : (response && response.message) || 'Too far from this location'
    );
  } catch (error) {
    var data = error && error.body;
    var distance = data && data.check_in && data.check_in.distance_meters;
    if (data && data.already_checked_in) {
      showError(
        (Array.isArray(data.already_checked_in) && data.already_checked_in[0]) ||
          "You're already checked in"
      );
      await loadCheckIn(container);
      return;
    }
    if (distance != null) {
      showError(
        'Too far — ' +
          formatDistance(distance) +
          ' away (need within ' +
          location.radius_meters +
          ' m)'
      );
    } else {
      showError((error && error.message) || 'Check-in failed');
    }
  } finally {
    if (!container.querySelector('#hc-check-in-root')) return;
    allButtons.forEach(function (other) {
      other.disabled = false;
    });
    if (btn && originalHtml && !btn.classList.contains('hc-check-in-btn--done')) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }
}

async function loadCheckIn(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading locations...' });
  try {
    var response = await api.getCheckInLocations();
    var locations = Array.isArray(response && response.locations) ? response.locations : [];
    renderCheckInContent(container, locations);
  } catch (err) {
    container.innerHTML =
      '<div class="hc-check-in-page">' +
      NavHeader({ title: 'Check In', backButtonId: 'hc-check-in-back' }) +
      '<div class="hc-alert-error">' +
      escapeHtml((err && err.message) || 'Failed to load locations') +
      '</div></div>';
    var backErr = document.getElementById('hc-check-in-back');
    if (backErr) {
      backErr.addEventListener('click', function () {
        navigate('/profile');
      });
    }
  }
}

function renderCheckInContent(container, locations) {
  var html = '';
  html += '<div id="hc-check-in-root" class="hc-check-in-page">';
  html += NavHeader({ title: 'Check In', backButtonId: 'hc-check-in-back' });
  html += '<div class="hc-check-in-scroll">';
  html +=
    '<p class="hc-check-in-subtitle">Confirm you are at a set location. Location access is required.</p>';

  if (!locations.length) {
    html += '<div class="hc-check-in-empty">';
    html += '<div class="hc-check-in-empty-title">No locations yet</div>';
    html +=
      '<div class="hc-check-in-empty-text">Ask a superuser to add check-in spots in the web dashboard.</div>';
    html += '</div>';
  } else {
    locations.forEach(function (location) {
      html += renderLocationCard(location);
    });
  }

  html += '</div></div>';
  container.innerHTML = html;

  var backBtn = document.getElementById('hc-check-in-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate('/profile');
    });
  }

  bindCheckInActions(container, locations);
}

export function renderCheckIn(container) {
  loadCheckIn(container);
}
