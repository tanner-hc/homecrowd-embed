import { escapeHtml } from './html.js';

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function arcPath(cx, cy, r, startAngleDeg, endAngleDeg, sweepFlag) {
  sweepFlag = sweepFlag || '1';
  if (Math.abs(endAngleDeg - startAngleDeg) < 0.001) return '';

  function toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  var start = {
    x: cx + r * Math.cos(toRad(startAngleDeg)),
    y: cy + r * Math.sin(toRad(startAngleDeg)),
  };
  var end = {
    x: cx + r * Math.cos(toRad(endAngleDeg)),
    y: cy + r * Math.sin(toRad(endAngleDeg)),
  };

  return 'M ' + start.x + ' ' + start.y + ' A ' + r + ' ' + r + ' 0 0 ' + sweepFlag + ' ' + end.x + ' ' + end.y;
}

export function buildDashboardHalfCircleGaugeHtml(o) {
  o = o || {};
  var percentage = o.percentage != null ? Number(o.percentage) : 50;
  var value = o.value;
  var displayValue = o.displayValue;
  var label = o.label != null ? String(o.label) : 'Lifetime points';
  var bottomLeftText = o.bottomLeftText != null ? String(o.bottomLeftText) : 'Progress to Next Prize';
  var bottomRightText = o.bottomRightText != null ? String(o.bottomRightText) : '';
  var strokeWidth = o.strokeWidth != null ? Number(o.strokeWidth) : 9;
  var progressColor = o.progressColor || '#00C8FF';
  var trackColor = o.trackColor || '#D2D2D2';
  var rightOpacity = o.rightOpacity != null ? o.rightOpacity : 0.35;
  var arcTopPadding = o.arcTopPadding != null ? Number(o.arcTopPadding) : 6;
  var gapPx = o.gapPx != null ? Number(o.gapPx) : 6;
  var svgHeight = o.svgHeight != null ? Number(o.svgHeight) : 200;
  var centerTextTop = o.centerTextTop != null ? Number(o.centerTextTop) : 60;
  var currentTierName = o.currentTierName != null ? String(o.currentTierName) : '';

  var t = clamp01(percentage / 100);
  var W = 340;
  var capPad = strokeWidth / 9;
  var vbW = W;
  var vbH = svgHeight + capPad * 6;
  var cx = vbW / 2;
  var r = vbW / 2 - capPad;
  var cy = capPad + arcTopPadding + r;
  var startAngle = -180;
  var endAngle = 0;
  var rawSplit = startAngle + (endAngle - startAngle) * t;
  var gapDeg = (gapPx / r) * (180 / Math.PI);
  var halfGap = gapDeg / 2;
  var useGap = t > 0 && t < 1;
  var blueEnd = useGap ? rawSplit - halfGap : rawSplit;
  var greyStart = useGap ? rawSplit + halfGap : rawSplit;
  var bluePath = t <= 0 ? '' : arcPath(cx, cy, r, startAngle, Math.min(endAngle, blueEnd), '1');
  var greyPath = t >= 1 ? '' : arcPath(cx, cy, r, Math.max(startAngle, greyStart), endAngle, '1');

  var centerText = '';
  if (typeof displayValue === 'string') {
    centerText = displayValue;
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    centerText = value.toLocaleString();
  }

  var padTop = currentTierName ? 30 : 10;
  var padBottom = 15;

  var svgInner = '';
  if (greyPath) {
    svgInner +=
      '<path d="' +
      greyPath +
      '" stroke="' +
      trackColor +
      '" stroke-width="' +
      strokeWidth +
      '" stroke-linecap="round" fill="none" opacity="' +
      rightOpacity +
      '"/>';
  }
  if (bluePath) {
    svgInner +=
      '<path d="' +
      bluePath +
      '" stroke="' +
      progressColor +
      '" stroke-width="' +
      strokeWidth +
      '" stroke-linecap="round" fill="none"/>';
  }

  var tierBadge = '';
  if (currentTierName) {
    tierBadge =
      '<div class="hc-dash-tier-badge"><span class="hc-dash-tier-badge-text">' +
      escapeHtml(currentTierName) +
      '</span></div>';
  }

  return (
    '<div class="hc-dash-gauge-card" style="padding-top:' +
    padTop +
    'px;padding-bottom:' +
    padBottom +
    'px">' +
    tierBadge +
    '<div class="hc-dash-gauge-svg-wrap">' +
    '<svg width="' +
    W +
    '" height="' +
    svgHeight +
    '" viewBox="0 0 ' +
    vbW +
    ' ' +
    vbH +
    '" class="hc-dash-gauge-svg" aria-hidden="true">' +
    svgInner +
    '</svg></div>' +
    '<div class="hc-dash-gauge-center" style="top:' +
    centerTextTop +
    'px">' +
    (centerText ? '<div class="hc-dash-gauge-big">' + escapeHtml(centerText) + '</div>' : '') +
    '<div class="hc-dash-gauge-label">' +
    escapeHtml(label) +
    '</div></div>' +
    '<div class="hc-dash-gauge-footer">' +
    '<span class="hc-dash-gauge-footer-left">' +
    escapeHtml(bottomLeftText) +
    '</span>' +
    '<span class="hc-dash-gauge-footer-right">' +
    escapeHtml(bottomRightText) +
    '</span></div></div>'
  );
}
