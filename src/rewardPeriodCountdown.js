export var DEFAULT_PERIOD_END_TIME = '16:00:00';

function normalizeTimeForParse(value) {
  if (!value) return DEFAULT_PERIOD_END_TIME;
  var raw = String(value);
  if (/^\d{2}:\d{2}/.test(raw)) {
    return raw.length >= 8 ? raw.slice(0, 8) : raw.slice(0, 5) + ':00';
  }
  return DEFAULT_PERIOD_END_TIME;
}

export function parsePeriodEndTimestamp(raw, fallbackDateOnly, fallbackEndTime) {
  var endTime = normalizeTimeForParse(fallbackEndTime);
  if (raw) {
    var str = String(raw);
    if (str.indexOf('T') !== -1) {
      var ms = new Date(str).getTime();
      if (Number.isFinite(ms)) return ms;
    }
    var datePart = str.split('T')[0];
    var msDate = new Date(datePart + 'T' + endTime).getTime();
    if (Number.isFinite(msDate)) return msDate;
  }
  if (fallbackDateOnly) {
    var msFallback = new Date(String(fallbackDateOnly) + 'T' + endTime).getTime();
    if (Number.isFinite(msFallback)) return msFallback;
  }
  return null;
}

export function formatPeriodCountdown(endTimestampMs, nowMs, labels) {
  labels = labels || {};
  var contextLabel = labels.contextLabel || 'Period';
  var endedText = labels.endedText;
  var prefix = labels.prefix || 'Ends in';
  if (!endTimestampMs || !Number.isFinite(endTimestampMs)) return '';
  var now = nowMs != null ? nowMs : Date.now();
  var delta = endTimestampMs - now;
  if (delta <= 0) {
    return endedText || contextLabel + ' period ended';
  }
  var days = Math.floor(delta / 86400000);
  var hours = Math.floor((delta % 86400000) / 3600000);
  var minutes = Math.floor((delta % 3600000) / 60000);
  var seconds = Math.floor((delta % 60000) / 1000);
  if (days > 0) return prefix + ': ' + days + 'd ' + hours + 'h ' + minutes + 'm ' + seconds + 's';
  if (hours > 0) return prefix + ': ' + hours + 'h ' + minutes + 'm ' + seconds + 's';
  if (minutes > 0) return prefix + ': ' + minutes + 'm ' + seconds + 's';
  return prefix + ': ' + seconds + 's';
}

export function formatPeriodEndLocal(endTimestampMs) {
  if (!endTimestampMs || !Number.isFinite(endTimestampMs)) return '';
  return new Date(endTimestampMs).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
