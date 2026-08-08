/**
 * Shared phone/email helpers for contact-detail inputs.
 *
 * `formatPhoneNumber` was lifted verbatim from profile-details.js, which is now
 * a consumer, so the phone field behaves the same everywhere in the app.
 */

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Digits only, e.g. "(801) 555-0147" -> "8015550147". */
export function phoneDigits(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

/** Progressive US formatting, safe to run on every keystroke. */
export function formatPhoneNumber(value) {
  var phoneNumber = phoneDigits(value);
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

/** A complete US number: exactly 10 digits, and no leading 0 or 1 area code. */
export function isValidPhone(value) {
  var digits = phoneDigits(value);
  if (digits.length !== 10) return false;
  return !/^[01]/.test(digits);
}

export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim());
}

export default { phoneDigits, formatPhoneNumber, isValidPhone, isValidEmail };
