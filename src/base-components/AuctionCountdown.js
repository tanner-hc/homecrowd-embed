import { escapeHtml } from './html.js';
import { computeTimeLeft, formatCountdownLine, formatEndDateShort } from './countdownUtils.js';

function statusClass(status, isExpired) {
  switch (status) {
    case 'completed':
      return 'hc-bc-auction-pill--completed';
    case 'cancelled':
      return 'hc-bc-auction-pill--cancelled';
    case 'draft':
      return 'hc-bc-auction-pill--draft';
    default:
      return isExpired ? 'hc-bc-auction-pill--completed' : 'hc-bc-auction-pill--active';
  }
}

function renderCountdownText(endDate, status) {
  if (status !== 'active') {
    var state = status === 'completed' ? 'Ended' : 'Cancelled';
    return 'Auction ' + state + ': ' + formatEndDateShort(endDate);
  }
  var t = computeTimeLeft(endDate);
  if (t.isExpired) {
    return 'Auction Ended';
  }
  return 'Auction ends in: ' + formatCountdownLine(t);
}

export default function AuctionCountdown(props) {
  props = props || {};
  var endDate = props.endDate;
  var status = props.status || 'active';
  var t = computeTimeLeft(endDate);
  var main = renderCountdownText(endDate, status);
  var dateLine = formatEndDateShort(endDate);

  var pillCls = 'hc-bc-auction-pill ' + statusClass(status, t.isExpired);

  var sub =
    status === 'active' && !t.isExpired
      ? '<span class="hc-bc-auction-pill-sub">' + escapeHtml(dateLine) + '</span>'
      : '';

  return (
    '<div class="' +
    pillCls +
    '" data-hc-auction-countdown="' +
    escapeHtml(String(endDate || '')) +
    '" data-hc-auction-status="' +
    escapeHtml(status) +
    '">' +
    '<span class="hc-bc-auction-pill-main" data-role="main">' +
    escapeHtml(main) +
    '</span>' +
    sub +
    '</div>'
  );
}

export function attachAuctionCountdown(root) {
  if (!root || !root.querySelectorAll) {
    return function () {};
  }
  var nodes = root.querySelectorAll('[data-hc-auction-countdown]');
  var timers = [];

  nodes.forEach(function (el) {
    function tick() {
      var end = el.getAttribute('data-hc-auction-countdown');
      var st = el.getAttribute('data-hc-auction-status') || 'active';
      var mainEl = el.querySelector('[data-role="main"]');
      var subEl = el.querySelector('.hc-bc-auction-pill-sub');
      if (!mainEl) {
        return;
      }
      mainEl.textContent = renderCountdownText(end, st);
      if (st === 'active') {
        var tt = computeTimeLeft(end);
        if (subEl && !tt.isExpired) {
          subEl.textContent = formatEndDateShort(end);
          subEl.style.display = '';
        } else if (subEl) {
          subEl.style.display = 'none';
        }
        el.className = 'hc-bc-auction-pill ' + statusClass(st, tt.isExpired);
      }
    }
    tick();
    var id = window.setInterval(tick, 1000);
    timers.push(id);
  });

  return function detach() {
    timers.forEach(function (id) {
      window.clearInterval(id);
    });
  };
}
