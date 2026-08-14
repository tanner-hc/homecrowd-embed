import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { buildAppHeaderHtml, attachAppHeader } from '../base-components/AppHeader.js';
import SearchBar from '../base-components/SearchBar.js';
import { escapeHtml } from '../base-components/html.js';
import { buildTransactionItemHtml } from '../components/Dashboard/TransactionItem.js';

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

/**
 * The activity log is ledger rows; the home list is transactions. This maps the
 * former onto the latter's shape so both screens can render through the same
 * component — one row design, not two that drift apart.
 *
 * `amount` is deliberately left undefined: a ledger row has points but no dollar
 * figure, and TransactionItem omits the money line when it is absent.
 */
function toTransactionShape(entry) {
  var points = Number(entry.points) || 0;
  var metadata = entry.metadata || {};
  var mapped = {
    id: entry.id,
    points_earned: points,
    points: points,
    date: entry.date,
    transaction_date: entry.date,
    description: entry.description,
    merchant_name: entry.merchant_name || (entry.merchant && entry.merchant.name) || '',
    // Passed straight through: TransactionItem does its own bonus detection off
    // these, so card draws and campaign bonuses pick their branch without this
    // mapper duplicating the rules.
    activity_kind: entry.activity_kind,
    display_title: entry.display_title,
    metadata: metadata,
  };

  // The server resolves the source and the merchant's artwork the same way it does
  // for the home list, so Olive and Wildfire rows carry their real logo here too.
  // metadata.source is the fallback for a backend that predates those fields.
  mapped.source = entry.source || (metadata.source === 'access_travel' ? 'travel' : '');
  mapped.merchant_logo_url = entry.merchant_logo_url || null;
  if (mapped.source === 'travel') {
    mapped.travel_merchant_name = entry.merchant_name || '';
  }
  // Redemptions and other spends have no merchant — the reward title is the
  // subject of the row.
  if (!mapped.merchant_name) {
    mapped.merchant_name = getDisplayTitle(entry);
  }
  return mapped;
}

/**
 * Home reads the card nickname / scheme / last4 off the transaction, none of which
 * a ledger row carries. The source is all we have, so it is all we claim — anything
 * else falls back to the program name, which is what the row did before.
 */
function activityPaymentLabel(transaction) {
  if (transaction.source === 'travel' || transaction.travel_merchant_name) return 'Travel';
  if (transaction.source === 'wildfire') return 'Online';
  return '';
}

/** Same source home uses, so fallback avatars match between the two screens. */
function resolveSchoolLogoUrl(user) {
  var school = user && (user.active_school || user.activeSchool);
  if (!school) return '';
  var url = school.image || school.banner_image || school.bannerImage || '';
  return typeof url === 'string' ? url.trim() : '';
}

function buildActivityRowsHtml(entries, formatDate, schoolLogoUrl) {
  if (!entries.length) {
    return '';
  }
  var html = '';
  var i;
  for (i = 0; i < entries.length; i++) {
    html += buildTransactionItemHtml(toTransactionShape(entries[i]), {
      getPaymentMethod: activityPaymentLabel,
      formatDate: formatDate,
      schoolLogoUrl: schoolLogoUrl,
    });
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
  var currentUser = null;
  var availablePoints = 0;
  try {
    // The header carries the avatar and points balance the same way /cards and
    // /home do; neither lookup is worth failing the page for.
    var loaded = await Promise.all([
      // 50 is the server's cap (apps/rewards/views.py: limit defaults to 10 and is
      // min()'d to 50). Without it this page — the full history — asked for fewer
      // rows than home's preview does, so older entries silently fell off.
      api.getUserActivityLog({ limit: 50 }),
      api.fetchCurrentUser().catch(function () {
        return null;
      }),
      api.getRewardsSummary().catch(function () {
        return null;
      }),
    ]);
    activityData = loaded[0] || [];
    currentUser = loaded[1];
    var summary = loaded[2];
    availablePoints =
      (summary &&
        (summary.availablePoints != null
          ? summary.availablePoints
          : summary.available_points)) ||
      0;
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
  html += buildAppHeaderHtml({ showBack: true, user: currentUser, points: availablePoints });
  html += '<div class="hc-al-body">';
  html += '<div class="hc-al-sticky-block">';
  html += '<div class="hc-al-search-wrap">';
  html += SearchBar({
    id: 'hc-al-search',
    // The design's copy is "Search anything", but that belongs to the Shop screen
    // where it is true. This field only searches activity, so it says so.
    placeholder: 'Search activity',
    variant: 'pill',
  });
  html += '</div>';
  html += '</div>';
  html += '<div id="hc-al-list" class="hc-al-list"></div>';
  html += '</div></div>';

  container.innerHTML = html;

  var listEl = document.getElementById('hc-al-list');
  var schoolLogoUrl = resolveSchoolLogoUrl(currentUser);
  function paintList() {
    var filtered = filterActivity(activityData, searchText);
    var rows = buildActivityRowsHtml(filtered, formatDate, schoolLogoUrl);
    if (rows) {
      listEl.innerHTML = rows;
    } else {
      listEl.innerHTML = buildEmptyHtml(activityData.length > 0, searchText);
    }
  }

  paintList();

  attachAppHeader(container, {
    showBack: true,
    user: currentUser,
    points: availablePoints,
    // Reachable from both the profile menu and home's "View all", so step back
    // to wherever the user actually came from rather than a fixed screen.
    onBackPress: function () {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      navigate('/profile');
    },
  });
  var searchEl = document.getElementById('hc-al-search');
  if (searchEl) {
    searchEl.addEventListener('input', function () {
      searchText = searchEl.value || '';
      paintList();
    });
  }
}
