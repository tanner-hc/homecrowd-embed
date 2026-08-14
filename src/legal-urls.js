import { getEmbedSchoolId } from './brand.js';
import { getPendingSignupSchool } from './views/find-your-school.js';

export var TERMS_URL = 'https://app.gethomecrowd.com/terms-and-conditions/';
export var PRIVACY_URL = 'https://app.gethomecrowd.com/privacy-policy/';

function schoolIdFromUrl() {
  try {
    var params = new URLSearchParams(window.location.search);
    return String(
      params.get('schoolId') || params.get('schoolID') || params.get('school_id') || '',
    )
      .trim()
      .replace(/^\/+|\/+$/g, '');
  } catch (_e) {
    return '';
  }
}

function schoolIdFromSession() {
  try {
    return String(sessionStorage.getItem('hc_embed_pending_signup_school_id') || '')
      .trim()
      .replace(/^\/+|\/+$/g, '');
  } catch (_e) {
    return '';
  }
}

function normalizeSchoolId(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
}

function resolveLegalSchoolId() {
  var schoolId = normalizeSchoolId(getEmbedSchoolId());
  if (schoolId) return schoolId;
  schoolId = schoolIdFromUrl();
  if (schoolId) return schoolId;
  var pending = getPendingSignupSchool();
  schoolId = normalizeSchoolId(pending && pending.id);
  if (schoolId) return schoolId;
  return schoolIdFromSession();
}

function withSchoolId(url) {
  var schoolId = resolveLegalSchoolId();
  if (!schoolId) return url;
  try {
    var parsed = new URL(url);
    parsed.searchParams.set('schoolId', schoolId);
    return parsed.toString();
  } catch (_e) {
    var joiner = url.indexOf('?') >= 0 ? '&' : '?';
    return url + joiner + 'schoolId=' + encodeURIComponent(schoolId);
  }
}

export function getTermsUrl() {
  return withSchoolId(TERMS_URL);
}

export function getPrivacyUrl() {
  return withSchoolId(PRIVACY_URL);
}
