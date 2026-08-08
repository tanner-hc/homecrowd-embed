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

export default { isIOS };
