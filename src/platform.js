/**
 * True for iPhone / iPad / iPod (including iPadOS desktop UA).
 */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  var ua = String(navigator.userAgent || '');
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1) {
    return true;
  }
  return false;
}

export function isAndroid() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(String(navigator.userAgent || ''));
}

export function shouldShowAppleSignIn() {
  if (isAndroid()) return false;
  if (isIOS()) return true;
  if (typeof navigator === 'undefined') return false;
  return /Macintosh/i.test(String(navigator.userAgent || ''));
}

export default { isIOS, isAndroid, shouldShowAppleSignIn };
