export function escapeHtml(s) {
  if (s == null || s === undefined) {
    return '';
  }
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(s) {
  if (s == null || s === undefined) {
    return '';
  }
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function joinClasses() {
  var parts = [];
  for (var i = 0; i < arguments.length; i++) {
    var a = arguments[i];
    if (a && typeof a === 'string' && a.trim() !== '') {
      parts.push(a.trim());
    }
  }
  return parts.join(' ').trim();
}
