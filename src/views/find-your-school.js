import * as api from '../api.js';
import { navigate } from '../router.js';
import { openBottomSheet } from '../base-components/BottomSheetModal.js';
import { openGetNotifiedModal } from '../base-components/GetNotifiedModal.js';
import { escapeAttr, escapeHtml } from '../base-components/html.js';
import headerUrl from '../assets/header.png';
import pinErrorUrl from '../assets/signIn_flow/pin_error.png';
import chevronLeftSvg from '../assets/icons/chevron-left.svg?raw';
import chevronRightSvg from '../assets/icons/chevron-right.svg?raw';
import checkmarkSvg from '../assets/icons/checkmark.svg?raw';

export var PENDING_SIGNUP_SCHOOL_KEY = 'hc_embed_pending_signup_school';

export function setPendingSignupSchool(school) {
  try {
    sessionStorage.setItem(PENDING_SIGNUP_SCHOOL_KEY, JSON.stringify(school || null));
  } catch (_e) { }
}

export function getPendingSignupSchool() {
  try {
    var raw = sessionStorage.getItem(PENDING_SIGNUP_SCHOOL_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

export function clearPendingSignupSchool() {
  try {
    sessionStorage.removeItem(PENDING_SIGNUP_SCHOOL_KEY);
  } catch (_e) { }
}

function schoolRowHtml(school) {
  var location = [school.city, school.state].filter(Boolean).join(', ');
  var imageHtml = school.image
    ? '<img data-hc-ph="school" src="' +
      escapeAttr(String(school.image)) +
      '" alt="" class="hc-find-school-result-logo" />'
    : '';
  return (
    '<button type="button" class="hc-find-school-result" data-school-id="' +
    escapeAttr(String(school.id || '')) +
    '">' +
    '<span class="hc-find-school-result-logo-wrap">' +
    imageHtml +
    '</span>' +
    '<span class="hc-find-school-result-text">' +
    '<span class="hc-find-school-result-name">' +
    escapeHtml(school.name || '') +
    '</span>' +
    (location
      ? '<span class="hc-find-school-result-location">' +
        escapeHtml(location) +
        '</span>'
      : '') +
    '</span>' +
    '<span class="hc-find-school-result-chevron" aria-hidden="true">' +
    chevronRightSvg +
    '</span>' +
    '</button>'
  );
}

export function renderFindYourSchool(container) {
  var schools = [];
  var searchTerm = '';
  var loading = true;
  var activeSheet = null;

  container.innerHTML =
    '<div class="hc-find-school">' +
    '<div class="hc-find-school-nav">' +
    '<button type="button" id="hc-find-school-back" class="hc-find-school-back" aria-label="Back">' +
    chevronLeftSvg +
    '</button>' +
    '<img data-hc-ph="none" src="' +
    escapeAttr(headerUrl) +
    '" alt="Homecrowd" class="hc-find-school-logo" />' +
    '<span class="hc-find-school-nav-spacer" aria-hidden="true"></span>' +
    '</div>' +
    '<div class="hc-find-school-content">' +
    '<h1 class="hc-find-school-title">Find Your School</h1>' +
    '<p class="hc-find-school-subtitle">Select your university to see if Homecrowd is available for your favorite team</p>' +
    '<div class="hc-find-school-search">' +
    '<span class="hc-find-school-search-icon" aria-hidden="true">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="7" stroke="#C0C0C0" stroke-width="1.5"/><path d="M20 20L16.5 16.5" stroke="#C0C0C0" stroke-width="1.5" stroke-linecap="round"/></svg>' +
    '</span>' +
    '<input type="search" id="hc-find-school-input" class="hc-find-school-search-input" placeholder="Start typing to search" autocomplete="off" autocapitalize="none" autocorrect="off" />' +
    '</div>' +
    '<div id="hc-find-school-results" class="hc-find-school-results">' +
    '<div class="hc-find-school-loader" aria-hidden="true"></div>' +
    '</div>' +
    '</div>' +
    '</div>';

  var backBtn = container.querySelector('#hc-find-school-back');
  var input = container.querySelector('#hc-find-school-input');
  var resultsEl = container.querySelector('#hc-find-school-results');

  function closeActiveSheet() {
    if (activeSheet && typeof activeSheet.close === 'function') {
      activeSheet.close();
      activeSheet = null;
    }
  }

  function filteredSchools() {
    var query = String(searchTerm || '').trim().toLowerCase();
    if (!query) return [];
    return schools
      .filter(function (school) {
        var name = String((school && school.name) || '').toLowerCase();
        var city = String((school && school.city) || '').toLowerCase();
        var state = String((school && school.state) || '').toLowerCase();
        return name.indexOf(query) >= 0 || city.indexOf(query) >= 0 || state.indexOf(query) >= 0;
      })
      .sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
  }

  function renderResults() {
    if (!resultsEl) return;
    if (loading) {
      resultsEl.innerHTML = '<div class="hc-find-school-loader" aria-hidden="true"></div>';
      return;
    }
    var list = filteredSchools();
    if (!list.length) {
      resultsEl.innerHTML = '';
      return;
    }
    resultsEl.innerHTML =
      '<div class="hc-find-school-results-list">' +
      list.map(schoolRowHtml).join('') +
      '</div>';
  }

  function openUnavailableSheet(school) {
    closeActiveSheet();
    activeSheet = openBottomSheet({
      iconHtml:
        '<img data-hc-ph="none" src="' +
        escapeAttr(pinErrorUrl) +
        '" alt="" class="hc-find-school-pin-icon" />',
      title: 'Sorry, we are not\navailable here yet',
      subtitle:
        "We're not at your school yet. Get notified when Homecrowd becomes available.",
      primaryButton: {
        label: 'Notify me',
        onPress: function () {
          activeSheet = null;
          openNotifySheet(school);
        },
      },
      secondaryButton: {
        label: 'Choose another school',
      },
      onClose: function () {
        activeSheet = null;
      },
    });
  }

  function openNotifySheet(school) {
    closeActiveSheet();
    activeSheet = openGetNotifiedModal({
      schoolName: school && school.name,
      onSubmit: function (email) {
        return api.submitSchoolAvailabilityNotify(school.id, email);
      },
      onSuccess: function (name) {
        activeSheet = null;
        openSuccessSheet(name);
      },
      onClose: function () {
        activeSheet = null;
      },
    });
  }

  function openSuccessSheet(schoolName) {
    closeActiveSheet();
    activeSheet = openBottomSheet({
      iconHtml:
        '<span class="hc-find-school-success-icon" aria-hidden="true">' +
        checkmarkSvg +
        '</span>',
      title: "You're on the list",
      subtitle:
        "We'll email you the moment HomeCrowd launches at " +
        (schoolName || 'your school') +
        '.',
      subtitleClass: 'hc-bs-subtitle--success',
      primaryButton: {
        label: 'Choose another school',
      },
      onClose: function () {
        activeSheet = null;
      },
    });
  }

  function handleSelectSchool(school) {
    if (!school) return;
    if (school.is_active === false) {
      openUnavailableSheet(school);
      return;
    }
    setPendingSignupSchool(school);
    navigate('/youre-in');
  }

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate('/get-started');
    });
  }

  if (input) {
    input.addEventListener('input', function () {
      searchTerm = input.value || '';
      renderResults();
    });
  }

  if (resultsEl) {
    resultsEl.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-school-id]') : null;
      if (!btn) return;
      var id = btn.getAttribute('data-school-id');
      var school = null;
      for (var i = 0; i < schools.length; i += 1) {
        if (String(schools[i].id) === String(id)) {
          school = schools[i];
          break;
        }
      }
      handleSelectSchool(school);
    });
  }

  renderResults();

  api
    .fetchPublicSchools(true)
    .then(function (response) {
      var list = (response && response.results) || response || [];
      schools = Array.isArray(list) ? list : [];
      loading = false;
      renderResults();
    })
    .catch(function () {
      loading = false;
      renderResults();
      window.alert('Failed to load schools. Please try again.');
    });

  return function cleanup() {
    closeActiveSheet();
  };
}
