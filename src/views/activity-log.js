import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import NavHeader from '../base-components/NavHeader.js';
import { escapeHtml } from '../base-components/html.js';

function formatUsdFromCents(cents) {
  if (cents == null || cents === '') return null;
  var n = Number(cents);
  if (!Number.isFinite(n)) return null;
  return '$' + (n / 100).toFixed(2);
}

function formatDateLabel(dateString) {
  if (!dateString) return '';
  var date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  var now = new Date();
  var diffTime = Math.abs(now - date);
  var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return diffDays + ' days ago';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDisplayTitle(entry) {
  if (entry.redemption && entry.redemption.reward_title) {
    return entry.redemption.reward_title;
  }
  if (entry.redemption && entry.redemption.reward && entry.redemption.reward.title) {
    return entry.redemption.reward.title;
  }
  if (entry.description) return entry.description;
  if (entry.merchant && entry.merchant.name) return entry.merchant.name;
  if (entry.merchant_name) return entry.merchant_name;
  var tt = entry.transaction_type;
  if (tt === 'earned') {
    if (entry.earning_source === 'transaction') return 'Points Earned';
    if (entry.earning_source === 'bonus') return 'Bonus Points';
    if (entry.earning_source === 'referral') return 'Referral Bonus';
    if (entry.earning_source === 'signup') return 'Signup Bonus';
    return 'Points Earned';
  }
  if (tt === 'spent') {
    var isStripe =
      entry.activity_kind === 'stripe_card_purchase' ||
      (entry.redemption && entry.redemption.payment_method === 'stripe');
    if (entry.spending_source === 'redemption' && isStripe) return 'Card purchase';
    if (entry.spending_source === 'redemption') return 'Reward Redemption';
    return 'Points Spent';
  }
  if (tt === 'adjustment') return 'Manual Adjustment';
  if (tt === 'expired') return 'Points Expired';
  if (tt === 'refund') return 'Points Refunded';
  return 'Transaction';
}

function getSubtitle(entry, formatDate) {
  var isStripeCardPurchase =
    entry.activity_kind === 'stripe_card_purchase' ||
    (entry.redemption && entry.redemption.payment_method === 'stripe');
  var date = formatDate(entry.date);
  if (isStripeCardPurchase) {
    var usd = formatUsdFromCents(entry.redemption && entry.redemption.amount_paid_cents);
    if (usd && entry.external_transaction_id) {
      return date + ' • ' + usd + ' • Stripe';
    }
    if (usd) return date + ' • ' + usd + ' • Stripe';
  }
  if (entry.external_transaction_id) {
    return date + ' • ID: ' + entry.external_transaction_id;
  }
  return date;
}

function getPointsClass(entry) {
  var tt = entry.transaction_type;
  if (entry.activity_kind === 'stripe_card_purchase' || (entry.redemption && entry.redemption.payment_method === 'stripe')) {
    return 'hc-al-pts--stripe';
  }
  switch (tt) {
    case 'earned':
      return 'hc-al-pts--earned';
    case 'spent':
      return 'hc-al-pts--spent';
    case 'adjustment':
      return 'hc-al-pts--adjustment';
    case 'expired':
      return 'hc-al-pts--expired';
    case 'refund':
      return 'hc-al-pts--refund';
    default:
      return 'hc-al-pts--default';
  }
}

function getPointsDisplay(entry) {
  var isStripeCardPurchase =
    entry.activity_kind === 'stripe_card_purchase' ||
    (entry.redemption && entry.redemption.payment_method === 'stripe');
  var isTicketRedemption = entry.redemption && entry.redemption.used_ticket === true;
  if (isStripeCardPurchase) {
    var usd = formatUsdFromCents(entry.redemption && entry.redemption.amount_paid_cents);
    return usd || '—';
  }
  if (isTicketRedemption) {
    var c = entry.redemption.ticket_count;
    return c + ' ' + (c === 1 ? 'ticket' : 'tickets');
  }
  var icon = '•';
  switch (entry.transaction_type) {
    case 'earned':
      icon = '+';
      break;
    case 'spent':
      icon = '-';
      break;
    case 'adjustment':
      icon = '±';
      break;
    case 'expired':
      icon = '⏰';
      break;
    case 'refund':
      icon = '↩';
      break;
    default:
      break;
  }
  var pts = entry.points != null ? Math.abs(Number(entry.points)) : 0;
  return icon + String(pts);
}

function filterActivity(activityData, searchText) {
  if (!searchText || !String(searchText).trim()) {
    return activityData;
  }
  var term = String(searchText).trim().toLowerCase();
  return activityData.filter(function (entry) {
    var title =
      (entry.redemption &&
        entry.redemption.reward &&
        entry.redemption.reward.title) ||
      (entry.merchant && entry.merchant.name) ||
      entry.merchant_name ||
      entry.description ||
      '';
    return (
      String(title).toLowerCase().indexOf(term) >= 0 ||
      String(entry.transaction_type || '')
        .toLowerCase()
        .indexOf(term) >= 0 ||
      (entry.earning_source && String(entry.earning_source).toLowerCase().indexOf(term) >= 0) ||
      (entry.spending_source && String(entry.spending_source).toLowerCase().indexOf(term) >= 0)
    );
  });
}

function buildActivityRowsHtml(entries, formatDate) {
  if (!entries.length) {
    return '';
  }
  var html = '';
  var i;
  for (i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var title = getDisplayTitle(entry);
    var raffle =
      entry.redemption && entry.redemption.redemption_type === 'raffle'
        ? ' <span class="hc-al-raffle">(raffle)</span>'
        : '';
    var sub = getSubtitle(entry, formatDate);
    var ptsClass = getPointsClass(entry);
    var ptsText = getPointsDisplay(entry);
    var balance = entry.balance_after != null ? String(entry.balance_after) : '—';
    var key = entry.id != null ? String(entry.id) : 'i' + i;
    html +=
      '<div class="hc-al-row" data-entry-id="' +
      escapeHtml(key) +
      '">' +
      '<div class="hc-al-row-left">' +
      '<div class="hc-al-row-title">' +
      escapeHtml(title) +
      raffle +
      '</div>' +
      '<div class="hc-al-row-sub">' +
      escapeHtml(sub) +
      '</div>' +
      '</div>' +
      '<div class="hc-al-row-right">' +
      '<div class="hc-al-pts ' +
      ptsClass +
      '">' +
      escapeHtml(ptsText) +
      '</div>' +
      '<div class="hc-al-balance">Balance: ' +
      escapeHtml(balance) +
      '</div>' +
      '</div>' +
      '</div>';
  }
  return html;
}

function buildEmptyHtml(hasAnyData, searchText) {
  var st = String(searchText || '').trim();
  if (!hasAnyData) {
    return (
      '<div class="hc-al-empty">' +
      '<div class="hc-al-empty-title">No activity yet</div>' +
      '<div class="hc-al-empty-sub">Start earning and spending points to see your activity here!</div>' +
      '</div>'
    );
  }
  if (st) {
    return (
      '<div class="hc-al-empty">' +
      '<div class="hc-al-empty-title">No activity matches your search</div>' +
      '<div class="hc-al-empty-sub">Try adjusting your search</div>' +
      '</div>'
    );
  }
  return (
    '<div class="hc-al-empty">' +
    '<div class="hc-al-empty-title">No activity yet</div>' +
    '<div class="hc-al-empty-sub">Start earning and spending points to see your activity here!</div>' +
    '</div>'
  );
}

export function renderActivityLog(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading your activity...' });
  loadActivityLog(container);
}

async function loadActivityLog(container) {
  var activityData = [];
  try {
    activityData = await api.getUserActivityLog();
  } catch (err) {
    container.innerHTML =
      '<div class="hc-alert-error">' + escapeHtml(err.message || 'Failed to load') + '</div>';
    return;
  }

  function formatDate(d) {
    return formatDateLabel(d);
  }

  var searchText = '';

  var html = '';
  html += '<div class="hc-activity-log">';
  html += '<div class="hc-account-settings-nav">';
  html += NavHeader({
    title: 'Activity Log',
    backButtonId: 'hc-al-back',
  });
  html += '</div>';
  html += '<div class="hc-al-body">';
  html += '<div class="hc-al-sticky-block">';
  html += '<div class="hc-al-search-wrap">';
  html +=
    '<input type="search" id="hc-al-search" class="hc-input hc-al-search" placeholder="Search activity" autocomplete="off" />';
  html += '</div>';
  html += '</div>';
  html += '<div id="hc-al-list" class="hc-al-list"></div>';
  html += '</div></div>';

  container.innerHTML = html;

  var listEl = document.getElementById('hc-al-list');
  function paintList() {
    var filtered = filterActivity(activityData, searchText);
    var rows = buildActivityRowsHtml(filtered, formatDate);
    if (rows) {
      listEl.innerHTML = rows;
    } else {
      listEl.innerHTML = buildEmptyHtml(activityData.length > 0, searchText);
    }
  }

  paintList();

  document.getElementById('hc-al-back').addEventListener('click', function () {
    navigate('/profile');
  });
  var searchEl = document.getElementById('hc-al-search');
  if (searchEl) {
    searchEl.addEventListener('input', function () {
      searchText = searchEl.value || '';
      paintList();
    });
  }
}
