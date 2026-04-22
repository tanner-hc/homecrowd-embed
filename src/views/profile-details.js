import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import NavHeader from '../base-components/NavHeader.js';
import MainButton from '../base-components/MainButton.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { showSuccess, showError } from '../base-components/toastApi.js';

var US_STATES = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
];

function formatPhoneNumber(value) {
  var phoneNumber = String(value || '').replace(/[^\d]/g, '');
  if (phoneNumber.length === 0) return '';
  if (phoneNumber.length <= 3) return phoneNumber;
  if (phoneNumber.length <= 6) {
    return '(' + phoneNumber.slice(0, 3) + ') ' + phoneNumber.slice(3);
  }
  return (
    '(' +
    phoneNumber.slice(0, 3) +
    ') ' +
    phoneNumber.slice(3, 6) +
    '-' +
    phoneNumber.slice(6, 10)
  );
}

function pickProfileField(u, snake, camel) {
  if (!u || typeof u !== 'object') return '';
  var v = u[snake];
  if (v != null && v !== '') return v;
  if (camel && u[camel] != null && u[camel] !== '') return u[camel];
  return '';
}

function stateSelectOptionsHtml(selected) {
  var html = '<option value="">Select state</option>';
  var i;
  for (i = 0; i < US_STATES.length; i++) {
    var s = US_STATES[i];
    var sel = s === selected ? ' selected' : '';
    html += '<option value="' + escapeAttr(s) + '"' + sel + '>' + escapeHtml(s) + '</option>';
  }
  return html;
}

function parseApiError(err) {
  var msg = err && err.message ? String(err.message) : 'Failed to update profile';
  return msg;
}

export function renderProfileDetails(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading...' });
  loadProfileDetails(container);
}

async function loadProfileDetails(container) {
  var user;
  try {
    user = await api.getUserProfile();
  } catch (err) {
    container.innerHTML =
      '<div class="hc-alert-error">' + escapeHtml(parseApiError(err)) + '</div>';
    return;
  }

  var firstName = pickProfileField(user, 'first_name', 'firstName');
  var lastName = pickProfileField(user, 'last_name', 'lastName');
  var email = pickProfileField(user, 'email', 'email');
  var city = pickProfileField(user, 'city', 'city');
  var state = pickProfileField(user, 'state', 'state');
  var phoneRaw = pickProfileField(user, 'phone_number', 'phoneNumber');
  var phoneDisplay = formatPhoneNumber(phoneRaw);

  var html = '';
  html += '<div class="hc-profile-details">';
  html += '<div class="hc-account-settings-nav">';
  html += NavHeader({
    title: 'Profile Details',
    backButtonId: 'hc-pd-back',
  });
  html += '</div>';
  html += '<div class="hc-pd-form">';
  html += '<div class="hc-form-group hc-pd-field">';
  html += '<label class="hc-label" for="hc-pd-first">First Name</label>';
  html +=
    '<input id="hc-pd-first" class="hc-input hc-pd-input" type="text" autocomplete="given-name" placeholder="Enter your first name" value="' +
    escapeAttr(firstName) +
    '" />';
  html += '</div>';
  html += '<div class="hc-form-group hc-pd-field">';
  html += '<label class="hc-label" for="hc-pd-last">Last Name</label>';
  html +=
    '<input id="hc-pd-last" class="hc-input hc-pd-input" type="text" autocomplete="family-name" placeholder="Enter your last name" value="' +
    escapeAttr(lastName) +
    '" />';
  html += '</div>';
  html += '<div class="hc-form-group hc-pd-field hc-pd-email-group">';
  html += '<label class="hc-label" for="hc-pd-email">Email</label>';
  html += '<div class="hc-pd-email-wrap" id="hc-pd-email-wrap" role="button" tabindex="0">';
  html +=
    '<input id="hc-pd-email" class="hc-input hc-pd-input hc-pd-input--readonly" type="email" readonly value="' +
    escapeAttr(email) +
    '" placeholder="Enter your email address" autocomplete="email" />';
  html += '</div>';
  html +=
    '<div id="hc-pd-email-tooltip" class="hc-pd-email-tooltip" style="display:none" role="status">Contact support to update your email</div>';
  html += '</div>';
  html += '<div class="hc-form-group hc-pd-field">';
  html += '<label class="hc-label" for="hc-pd-city">City</label>';
  html +=
    '<input id="hc-pd-city" class="hc-input hc-pd-input" type="text" autocomplete="address-level2" placeholder="Enter your city" value="' +
    escapeAttr(city) +
    '" />';
  html += '</div>';
  html += '<div class="hc-form-group hc-pd-field">';
  html += '<label class="hc-label" for="hc-pd-state">State</label>';
  html += '<select id="hc-pd-state" class="hc-input hc-pd-input hc-pd-select">';
  html += stateSelectOptionsHtml(state);
  html += '</select>';
  html += '</div>';
  html += '<div class="hc-form-group hc-pd-field">';
  html += '<label class="hc-label" for="hc-pd-phone">Phone Number</label>';
  html +=
    '<input id="hc-pd-phone" class="hc-input hc-pd-input" type="tel" inputmode="numeric" maxlength="14" placeholder="(123) 456-7890" autocomplete="tel" value="' +
    escapeAttr(phoneDisplay) +
    '" />';
  html += '</div>';
  html += '<div class="hc-pd-actions">';
  html += MainButton({
    id: 'hc-pd-save',
    text: 'Save Changes',
    loadingText: 'Saving...',
  });
  html += '</div>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  var backBtn = document.getElementById('hc-pd-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate('/account-settings');
    });
  }

  var phoneEl = document.getElementById('hc-pd-phone');
  if (phoneEl) {
    phoneEl.addEventListener('input', function () {
      phoneEl.value = formatPhoneNumber(phoneEl.value);
    });
  }

  var emailWrap = document.getElementById('hc-pd-email-wrap');
  var emailTip = document.getElementById('hc-pd-email-tooltip');
  var emailTipTimer = null;
  function showEmailTip() {
    if (!emailTip) return;
    emailTip.style.display = 'block';
    if (emailTipTimer) window.clearTimeout(emailTipTimer);
    emailTipTimer = window.setTimeout(function () {
      emailTip.style.display = 'none';
      emailTipTimer = null;
    }, 3000);
  }
  if (emailWrap) {
    emailWrap.addEventListener('click', showEmailTip);
    emailWrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showEmailTip();
      }
    });
  }

  var saveBtn = document.getElementById('hc-pd-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async function () {
      var rawPhone = (phoneEl && phoneEl.value ? phoneEl.value : '').replace(/[^\d]/g, '');
      var payload = {
        first_name: (document.getElementById('hc-pd-first') || {}).value || '',
        last_name: (document.getElementById('hc-pd-last') || {}).value || '',
        email: (document.getElementById('hc-pd-email') || {}).value || '',
        city: (document.getElementById('hc-pd-city') || {}).value || null,
        state: (document.getElementById('hc-pd-state') || {}).value || null,
        phone_number: rawPhone === '' ? null : rawPhone,
      };
      if (payload.city === '') payload.city = null;
      if (payload.state === '') payload.state = null;

      saveBtn.disabled = true;
      var prevHtml = saveBtn.innerHTML;
      saveBtn.innerHTML =
        '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>Saving...</span>';
      try {
        await api.updateUserProfile(payload);
        showSuccess('Profile updated successfully');
        navigate('/account-settings');
      } catch (err) {
        showError(parseApiError(err));
        saveBtn.disabled = false;
        saveBtn.innerHTML = prevHtml;
      }
    });
  }
}
