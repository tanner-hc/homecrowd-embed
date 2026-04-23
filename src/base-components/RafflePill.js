import { escapeHtml } from './html.js';
import { computeTimeLeft, formatCountdownLine, formatDrawingDate } from './countdownUtils.js';

function rafflePillClass(status) {
  switch (status) {
    case 'completed':
      return 'hc-bc-raffle-pill hc-bc-raffle-pill--completed';
    case 'cancelled':
      return 'hc-bc-raffle-pill hc-bc-raffle-pill--cancelled';
    case 'draft':
      return 'hc-bc-raffle-pill hc-bc-raffle-pill--draft';
    default:
      return 'hc-bc-raffle-pill hc-bc-raffle-pill--active';
  }
}

function renderAuctionInner(auctionInfo, status) {
  var endDate = auctionInfo && auctionInfo.end_date;
  var t = computeTimeLeft(endDate);
  var countdown =
    status !== 'active' || t.isExpired ? 'Auction Ended' : formatCountdownLine(t);
  var bidAmount =
    (auctionInfo && auctionInfo.current_highest_bid) ||
    (auctionInfo && auctionInfo.starting_bid) ||
    '';
  var bidLabel = t.isExpired ? 'Winning Bid' : 'Current Bid';

  var endLabel = '';
  if (endDate) {
    endLabel =
      '<div class="hc-bc-raffle-auction-end">' +
      'Auction ends ' +
      escapeHtml(
        new Date(endDate).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
      ) +
      '</div>';
  }

  return (
    '<div class="hc-bc-raffle-auction" data-hc-raffle-auction-end="' +
    escapeHtml(String(endDate || '')) +
    '" data-hc-raffle-auction-status="' +
    escapeHtml(status || 'active') +
    '">' +
    endLabel +
    '<div class="hc-bc-raffle-countdown" data-role="countdown">' +
    escapeHtml(countdown) +
    '</div>' +
    '<div class="hc-bc-raffle-bid-label">' +
    escapeHtml(bidLabel) +
    '</div>' +
    '<div class="hc-bc-raffle-bid-amount">' +
    escapeHtml(String(bidAmount)) +
    ' pts</div>' +
    '</div>'
  );
}

export default function RafflePill(props) {
  props = props || {};
  var drawingDate = props.drawingDate;
  var status = props.status || 'active';
  var type = props.type || 'raffle';
  var auctionInfo = props.auctionInfo;

  if (type === 'auction' && auctionInfo) {
    return (
      '<div class="hc-bc-raffle-pill-wrap hc-bc-raffle-pill-wrap--auction">' +
      renderAuctionInner(auctionInfo, status) +
      '</div>'
    );
  }

  var label = 'Raffle - Drawing: ' + formatDrawingDate(drawingDate);

  return (
    '<div class="' +
    escapeHtml(rafflePillClass(status)) +
    '">' +
    '<span class="hc-bc-raffle-pill-text">' +
    escapeHtml(label) +
    '</span>' +
    '</div>'
  );
}

export function attachRafflePillAuction(root) {
  if (!root || !root.querySelectorAll) {
    return function () {};
  }
  var blocks = root.querySelectorAll('[data-hc-raffle-auction-end]');
  var timers = [];

  blocks.forEach(function (el) {
    function tick() {
      var end = el.getAttribute('data-hc-raffle-auction-end');
      var st = el.getAttribute('data-hc-raffle-auction-status') || 'active';
      var countdownEl = el.querySelector('[data-role="countdown"]');
      if (!countdownEl || st !== 'active') {
        return;
      }
      var t = computeTimeLeft(end);
      countdownEl.textContent =
        st !== 'active' || t.isExpired ? 'Auction Ended' : formatCountdownLine(t);
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
