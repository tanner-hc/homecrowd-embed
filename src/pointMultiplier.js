export function getPointMultiplierValue(item) {
  if (!item || typeof item !== 'object') return null;
  var raw = item.pointMultiplier != null ? item.pointMultiplier : item.point_multiplier;
  var num = parseFloat(raw);
  if (Number.isNaN(num) || num <= 1) return null;
  return num;
}

export function formatPointMultiplierLabel(value) {
  var normalized = Number(value);
  if (Number.isNaN(normalized) || normalized <= 1) return '';
  if (Number.isInteger(normalized)) return normalized + 'X';
  return normalized.toFixed(2).replace(/\.?0+$/, '') + 'X';
}

export function renderPointMultiplierBadgeHtml(item, variant, compact) {
  var multiplier = getPointMultiplierValue(item);
  if (!multiplier) return '';
  var classes = ['hc-point-multiplier-badge'];
  if (variant === 'overlay') classes.push('hc-point-multiplier-badge--overlay');
  else classes.push('hc-point-multiplier-badge--block');
  if (compact) classes.push('hc-point-multiplier-badge--compact');
  var label = formatPointMultiplierLabel(multiplier);
  return (
    '<span class="' +
    classes.join(' ') +
    '" aria-label="' +
    label +
    '">' +
    label +
    '</span>'
  );
}
