import * as api from '../api.js';
import Header from '../base-components/Header.js';
import MainButton from '../base-components/MainButton.js';
import { escapeAttr, escapeHtml } from '../base-components/html.js';

function sortSchoolsForPicker(schools) {
  var list = Array.isArray(schools) ? schools.slice() : [];
  var withLogos = [];
  var withoutLogos = [];
  list.forEach(function (school) {
    if (school && school.image && String(school.image).trim()) {
      withLogos.push(school);
    } else {
      withoutLogos.push(school);
    }
  });
  withLogos.sort(function (a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  withoutLogos.sort(function (a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  return withLogos.concat(withoutLogos);
}

function schoolSelectionShellHtml(state) {
  var schoolsHtml = '';
  if (!state.loading && !state.schools.length) {
    schoolsHtml =
      '<div class="hc-school-selection-empty">No schools available right now.</div>';
  } else if (!state.loading) {
    schoolsHtml = state.schools
      .map(function (school) {
        var id = String(school.id || '');
        var selected = id === state.selectedSchoolId;
        var disabled = state.lockedSchoolId && id !== state.lockedSchoolId;
        var imageHtml = school.image
          ? '<img src="' +
            escapeAttr(String(school.image)) +
            '" alt="" class="hc-school-selection-card-image" />'
          : '';
        var location = [school.city, school.state].filter(Boolean).join(', ');
        return (
          '<button type="button" class="hc-school-selection-card' +
          (selected ? ' hc-school-selection-card--selected' : '') +
          (disabled ? ' hc-school-selection-card--disabled' : '') +
          '" data-school-id="' +
          escapeAttr(id) +
          '"' +
          (disabled ? ' disabled' : '') +
          '>' +
          '<span class="hc-school-selection-card-main">' +
          imageHtml +
          '<span class="hc-school-selection-card-copy">' +
          '<span class="hc-school-selection-card-name">' +
          escapeHtml(school.name || 'School') +
          '</span>' +
          '<span class="hc-school-selection-card-location">' +
          escapeHtml(location) +
          '</span>' +
          '</span>' +
          '</span>' +
          '<span class="hc-school-selection-radio' +
          (selected ? ' hc-school-selection-radio--selected' : '') +
          '">' +
          (selected ? '<span class="hc-school-selection-radio-inner"></span>' : '') +
          '</span>' +
          '</button>'
        );
      })
      .join('');
  }

  var loadingHtml = state.loading
    ? '<div class="hc-school-selection-loading">Loading schools...</div>'
    : schoolsHtml;

  return (
    '<div class="hc-school-selection-shell">' +
    Header() +
    '<div class="hc-school-selection-fixed">' +
    '<div class="hc-school-selection-heading">' +
    '<h1 class="hc-school-selection-title">Select Your School</h1>' +
    '<p class="hc-school-selection-subtitle">Choose your school to connect with your campus community</p>' +
    '</div>' +
    (state.error
      ? '<div class="hc-alert-error hc-school-selection-error">' + escapeHtml(state.error) + '</div>'
      : '') +
    '</div>' +
    '<div class="hc-school-selection-list">' +
    loadingHtml +
    '</div>' +
    '<div class="hc-school-selection-footer">' +
    MainButton({
      id: 'hc-school-selection-continue',
      text: 'Continue',
      loading: state.submitting,
      loadingText: 'Saving...',
      disabled: !state.selectedSchoolId || state.loading,
      className: 'hc-school-selection-continue-btn',
    }) +
    '</div>' +
    '</div>'
  );
}

export function renderSchoolSelection(container, options) {
  options = options || {};
  var onComplete = typeof options.onComplete === 'function' ? options.onComplete : null;
  var lockedSchoolId = options.schoolId ? String(options.schoolId).trim() : '';
  var state = {
    loading: true,
    submitting: false,
    error: '',
    schools: [],
    selectedSchoolId: lockedSchoolId || '',
    lockedSchoolId: lockedSchoolId,
  };

  function render() {
    container.innerHTML = schoolSelectionShellHtml(state);
    if (!state.loading) {
      var cards = container.querySelectorAll('[data-school-id]');
      cards.forEach(function (card) {
        card.addEventListener('click', function () {
          var id = String(card.getAttribute('data-school-id') || '').trim();
          if (!id) return;
          if (state.lockedSchoolId && id !== state.lockedSchoolId) return;
          state.selectedSchoolId = id;
          state.error = '';
          render();
        });
      });
    }

    var continueBtn = document.getElementById('hc-school-selection-continue');
    if (continueBtn) {
      continueBtn.addEventListener('click', async function () {
        if (!state.selectedSchoolId || state.submitting || state.loading) return;
        state.submitting = true;
        state.error = '';
        render();
        try {
          var result = await api.assignSchool(state.selectedSchoolId);
          if (onComplete) {
            await onComplete(state.selectedSchoolId, result);
          }
        } catch (err) {
          state.submitting = false;
          state.error = (err && err.message) || 'Failed to assign school. Please try again.';
          render();
        }
      });
    }
  }

  api
    .fetchPublicSchools()
    .then(function (response) {
      var list = (response && response.results) || response || [];
      state.schools = sortSchoolsForPicker(list);
      if (state.lockedSchoolId) {
        var lockedMatch = state.schools.find(function (school) {
          return String(school && school.id) === state.lockedSchoolId;
        });
        if (!lockedMatch) {
          state.error = 'Assigned school is unavailable. Please try again later.';
          state.selectedSchoolId = '';
        }
      }
    })
    .catch(function (err) {
      state.error = (err && err.message) || 'Failed to load schools.';
    })
    .finally(function () {
      state.loading = false;
      render();
    });

  render();
}
