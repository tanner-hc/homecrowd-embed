import { escapeAttr, escapeHtml } from '../../base-components/html.js';
import { getHeaderLogoUrl, getProgramName, hasCustomHeaderLogo } from '../../brand.js';
import hcIconUrl from '../../assets/logos/icon.png';

/**
 * Who issued a points row — the school's rewards program ("Utah Rewards") on a
 * branded embed, falling back to Homecrowd only when no brand config loaded.
 * These rows are the program's own bonuses, so they should carry its name.
 */
function issuerLabel() {
  return getProgramName() || 'Homecrowd';
}

/**
 * Avatar for rows with no merchant logo of their own.
 *
 * Prefers the signed-in user's own school mark, then the embed's header logo, then
 * the Homecrowd icon. The school mark is the better fit: the header logo is usually a
 * wordmark shaped for the top bar and reads badly at avatar size.
 *
 * Shown bare — no circle, no fill — because a school or program logo cropped into a
 * coloured disc reads as a different brand's badge. Unbranded embeds keep the
 * Homecrowd icon in its blue circle.
 *
 * @param {string} [schoolLogoUrl] from pickSchoolLogoUrl(user)
 */
function buildFallbackAvatarHtml(schoolLogoUrl) {
  var brandLogo = String(schoolLogoUrl || '').trim() ||
    (hasCustomHeaderLogo() ? getHeaderLogoUrl() : '');
  if (brandLogo) {
    return (
      '<div class="hc-tx-avatar hc-tx-avatar--brand">' +
      '<img data-hc-ph="school" src="' +
      escapeAttr(brandLogo) +
      '" alt="" class="hc-tx-brand-icon" />' +
      '</div>'
    );
  }
  return (
    '<div class="hc-tx-avatar hc-tx-avatar--hc">' +
    '<img data-hc-ph="none" src="' +
    escapeAttr(hcIconUrl) +
    '" alt="" class="hc-tx-hc-icon" />' +
    '</div>'
  );
}

/**
 * Where a purchase came from: 'olive' (in-person, card-linked), 'wildfire'
 * (online), or '' for anything else.
 *
 * The backend sends `source` outright; the id fields are the fallback so the
 * embed still behaves against a backend that predates that field. The merchant
 * name is deliberately not consulted — it prefers the Wildfire name and falls
 * back to the Olive one, so it cannot tell the two apart.
 */
function transactionSource(transaction) {
  if (!transaction) return '';
  var declared = String(transaction.source || '').trim().toLowerCase();
  if (declared === 'olive' || declared === 'wildfire') return declared;
  if (transaction.wildfire_merchant_id) return 'wildfire';
  if (String(transaction.olive_merchant_id || '').trim()) return 'olive';
  return '';
}

function transactionMerchantDisplayName(transaction) {
  if (!transaction) return '';
  var m = transaction.merchant;
  var raw =
    (m && m.name) ||
    transaction.merchant_name ||
    transaction.wildfire_merchant_name ||
    transaction.description ||
    '';
  return String(raw || 'Purchase').trim();
}

/**
 * @param {object} transaction
 * @param {{ getPaymentMethod?: function, formatDate?: function }} helpers
 */
export function buildTransactionItemHtml(transaction, helpers) {
  helpers = helpers || {};
  var formatDate =
    helpers.formatDate ||
    function (d) {
      if (!d) return '';
      var dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return '';
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
  var getPaymentMethod =
    helpers.getPaymentMethod ||
    function () {
      return '';
    };
  var schoolLogoUrl = helpers.schoolLogoUrl || '';

  var isHomecrowdBonus =
    transaction.isHomecrowdBonus ||
    transaction.activity_kind === 'setup_task_reward' ||
    transaction.activity_kind === 'incentive_campaign' ||
    transaction.activity_kind === 'homecrowd_bonus' ||
    transaction.activity_kind === 'card_draw' ||
    (transaction.metadata && transaction.metadata.source === 'setup_task_reward') ||
    (transaction.metadata && transaction.metadata.source === 'incentive_campaign') ||
    (transaction.metadata && transaction.metadata.incentive_type === 'campaign_bonus');

  if (isHomecrowdBonus) {
    var title =
      transaction.display_title ||
      transaction.description ||
      transaction.merchant_name ||
      issuerLabel() + ' bonus';
    var dateLabel = formatDate(transaction.transaction_date || transaction.date);
    var points = Number(transaction.points_earned != null ? transaction.points_earned : transaction.points) || 0;
    return (
      '<div class="hc-tx-row">' +
      buildFallbackAvatarHtml(schoolLogoUrl) +
      '<div class="hc-tx-left">' +
      '<div class="hc-tx-title">' +
      escapeHtml(title) +
      '</div>' +
      '<div class="hc-tx-sub">' +
      escapeHtml(dateLabel ? issuerLabel() + ' · ' + dateLabel : issuerLabel()) +
      '</div>' +
      '</div>' +
      '<div class="hc-tx-hc-pts">' +
      escapeHtml(points > 0 ? '+' + points + ' pts' : points + ' pts') +
      '</div>' +
      '</div>'
    );
  }

  var merchantLabel = transactionMerchantDisplayName(transaction);
  var paymentMethod = getPaymentMethod(transaction);
  var dateLabel2 = formatDate(transaction.transaction_date || transaction.date);
  var paymentInfo = paymentMethod
    ? paymentMethod + ' · ' + dateLabel2
    : dateLabel2
      ? issuerLabel() + ' · ' + dateLabel2
      : issuerLabel();
  var logoUrl =
    transaction.merchant_logo_url ||
    transaction.logo_url ||
    transaction.logoUrl ||
    transaction.small_logo_url ||
    (transaction.merchant && (transaction.merchant.logo_url || transaction.merchant.small_logo_url)) ||
    null;

  // Every merchant mark is squared off with white — Olive in-person, Wildfire
  // online, and Safari-extension purchases, which are Wildfire rows too (same
  // ingest, only the application id differs). Nothing here is cropped.
  var source = transactionSource(transaction);
  var avatarHtml = logoUrl && (source === 'olive' || source === 'wildfire')
    ? '<div class="hc-tx-avatar hc-tx-avatar--merchant"><img data-hc-ph="store" data-hc-square src="' +
      escapeAttr(logoUrl) +
      '" alt="" class="hc-tx-avatar-img" /></div>'
    : buildFallbackAvatarHtml(schoolLogoUrl);

  var rightHtml = '';
  if (transaction.isStripeRewardPurchase) {
    rightHtml =
      '<div class="hc-tx-stripe">$' +
      escapeHtml(
        transaction.amount ? parseFloat(transaction.amount).toFixed(2) : '0.00'
      ) +
      '</div>';
  } else {
    var pts = Number(transaction.points_earned) || 0;
    rightHtml =
      '<div class="hc-tx-right">' +
      '<div class="hc-tx-pts">' +
      escapeHtml(pts > 0 ? '+' + pts + ' pts' : pts + ' pts') +
      '</div>' +
      '<div class="hc-tx-amt">$' +
      escapeHtml(transaction.amount ? parseFloat(transaction.amount).toFixed(2) : '0.00') +
      '</div>' +
      '</div>';
  }

  return (
    '<div class="hc-tx-row">' +
    avatarHtml +
    '<div class="hc-tx-left">' +
    '<div class="hc-tx-title">' +
    escapeHtml(merchantLabel) +
    '</div>' +
    '<div class="hc-tx-sub">' +
    escapeHtml(paymentInfo) +
    '</div>' +
    '</div>' +
    rightHtml +
    '</div>'
  );
}

export default { buildTransactionItemHtml, transactionMerchantDisplayName };
