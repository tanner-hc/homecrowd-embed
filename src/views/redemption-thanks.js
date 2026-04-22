import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { formatDisplayNumber } from '../formatNumber.js';

var THKS_KEY = 'hc_redemption_thanks_v1';
var PENDING_STRIPE_KEY = 'hc_stripe_thanks_pending';

export function writePendingStripeThanks(product, amountPaidCents) {
  if (!product || !product.id) return;
  try {
    sessionStorage.setItem(
      PENDING_STRIPE_KEY,
      JSON.stringify({
        product: product,
        amountPaidCents: amountPaidCents,
      }),
    );
  } catch (e) {}
}

function consumePendingStripeThanks() {
  var raw = sessionStorage.getItem(PENDING_STRIPE_KEY);
  try {
    sessionStorage.removeItem(PENDING_STRIPE_KEY);
  } catch (e) {}
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function finalizeStripeThanksReturn() {
  var p = consumePendingStripeThanks();
  if (!p || !p.product || !p.product.id) {
    return null;
  }
  var payload = {
    product: p.product,
    pointsSpent: 0,
    isAuctionBid: false,
    ticketsUsed: 0,
    paidWithStripe: true,
    amountPaidCents: p.amountPaidCents != null ? p.amountPaidCents : null,
  };
  try {
    sessionStorage.setItem(THKS_KEY, JSON.stringify(payload));
  } catch (e) {
    return null;
  }
  return p.product.id;
}

export function navigateToRedemptionThanks(product, opts) {
  opts = opts || {};
  if (!product || !product.id) return;
  var payload = {
    product: product,
    pointsSpent: opts.pointsSpent != null ? opts.pointsSpent : 0,
    isAuctionBid: !!opts.isAuctionBid,
    ticketsUsed: opts.ticketsUsed != null ? opts.ticketsUsed : 0,
    paidWithStripe: !!opts.paidWithStripe,
    amountPaidCents: opts.amountPaidCents != null ? opts.amountPaidCents : null,
  };
  try {
    sessionStorage.setItem(THKS_KEY, JSON.stringify(payload));
  } catch (e) {
    return;
  }
  window.location.hash = '#/rewards/' + encodeURIComponent(product.id) + '/thanks';
}

export function clearRedemptionThanksState() {
  try {
    sessionStorage.removeItem(THKS_KEY);
  } catch (e) {}
}

function readThanksState() {
  var raw = sessionStorage.getItem(THKS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function getRedemptionType(product) {
  return String(product.redemption_type || product.redemptionType || '').toLowerCase();
}

function getProductImageUrl(product) {
  if (!product) return null;
  var u = product.image_url || product.imageUrl;
  if (u) {
    if (typeof u === 'string' && u.indexOf('s3://') === 0) {
      if (u.indexOf('s3://app.gethomecrowd.com/') === 0) {
        return u.replace('s3://app.gethomecrowd.com/', 'https://app.gethomecrowd.com/');
      }
      return u.replace('s3://', 'https://');
    }
    return u;
  }
  if (product.images && product.images.length > 0) {
    var img = product.images[0];
    var path = img.image_path || img.imagePath;
    if (!path) return null;
    if (path.indexOf('s3://') === 0) {
      if (path.indexOf('s3://app.gethomecrowd.com/') === 0) {
        return path.replace('s3://app.gethomecrowd.com/', 'https://app.gethomecrowd.com/');
      }
      return path.replace('s3://', 'https://');
    }
    return path;
  }
  return null;
}

function fulfillmentLabel(channel) {
  if (channel === 'shipping') return 'Shipping to your address';
  if (channel === 'email_code') return 'Email with code';
  if (channel === 'in_store') return 'Pick up in store';
  return 'In app';
}

export function renderRedemptionThanks(container, rewardId) {
  var state = readThanksState();
  if (!state || !state.product || String(state.product.id) !== String(rewardId)) {
    container.innerHTML =
      '<div class="hc-product-detail hc-redemption-thanks">' +
      '<div class="hc-rt-missing">' +
      '<p class="hc-rt-missing-text">This screen is no longer available.</p>' +
      '<a href="#/rewards" class="hc-btn hc-btn-primary hc-rt-missing-btn">Back to Rewards</a>' +
      '</div></div>';
    return;
  }

  var product = state.product;
  var rt = getRedemptionType(product);
  var pointsSpent = state.pointsSpent != null ? state.pointsSpent : 0;
  var isAuctionBid = !!state.isAuctionBid;
  var ticketsUsed = state.ticketsUsed != null ? state.ticketsUsed : 0;
  var paidWithStripe = !!state.paidWithStripe;
  var amountPaidCents = state.amountPaidCents;

  var paidUsd =
    paidWithStripe && amountPaidCents != null && Number.isFinite(Number(amountPaidCents))
      ? (Number(amountPaidCents) / 100).toFixed(2)
      : null;

  var successTitle = paidWithStripe
    ? 'Purchase successful!'
    : isAuctionBid
      ? 'Bid Placed Successfully!'
      : rt === 'raffle'
        ? 'Raffle Entry Successful!'
        : 'Redemption Successful!';

  var successMessage = '';
  if (paidWithStripe) {
    successMessage =
      'Thank you for your purchase. Your card payment was received and your reward is being processed.';
  } else if (isAuctionBid) {
    successMessage =
      'Your bid has been placed successfully! You can view the current auction status and place additional bids if needed.';
  } else if (rt === 'raffle') {
    successMessage =
      ticketsUsed > 1
        ? 'Thank you for entering the raffle! Your ' +
          ticketsUsed +
          ' entries have been recorded and you will be notified if you win.'
        : 'Thank you for entering the raffle! Your entry has been recorded and you will be notified if you win.';
  } else {
    successMessage = 'Thank you for your redemption. Your reward is being processed.';
  }

  var pointsLine = '';
  if (paidWithStripe && paidUsd != null) {
    pointsLine = 'Amount paid: $' + paidUsd + ' (card)';
  } else if (isAuctionBid) {
    pointsLine = 'Bid Amount: ' + formatDisplayNumber(pointsSpent) + ' pts';
  } else if (rt === 'raffle' && ticketsUsed > 0) {
    pointsLine = 'Tickets Used: ' + formatDisplayNumber(ticketsUsed);
  } else {
    pointsLine = 'Points Spent: ' + formatDisplayNumber(pointsSpent) + ' pts';
  }

  var infoText = '';
  if (paidWithStripe) {
    infoText =
      'You will receive a confirmation email with details about your purchase and fulfillment.';
  } else if (isAuctionBid) {
    infoText =
      'Your bid is now active and will compete until the auction ends. You can place additional bids to stay competitive.';
  } else if (rt === 'raffle') {
    infoText =
      'You will receive a confirmation email with your entry details. The drawing will take place on the scheduled date.';
  } else {
    infoText = 'You will receive a confirmation email with details about your redemption.';
  }

  var fc = product.fulfillment_channel || product.fulfillmentChannel;
  var fulfillmentHtml = '';
  if (fc) {
    fulfillmentHtml =
      '<p class="hc-rt-fulfillment">' +
      escapeHtml('Fulfillment: ' + fulfillmentLabel(fc)) +
      '</p>';
  }

  var imageUrl = getProductImageUrl(product);
  var imgHtml = imageUrl
    ? '<div class="hc-rt-image-wrap"><img class="hc-rt-image" src="' +
      escapeAttr(imageUrl) +
      '" alt="" /></div>'
    : '<div class="hc-rt-image-ph"><span class="hc-rt-image-ph-text">No Image</span></div>';

  var btnLabel = isAuctionBid ? 'View Auction Status' : 'Back to Rewards';

  container.innerHTML =
    '<div class="hc-product-detail hc-redemption-thanks">' +
    '<div class="hc-redemption-thanks-inner">' +
    '<div class="hc-rt-success-icon-wrap">' +
    '<div class="hc-rt-success-icon"><span class="hc-rt-success-check">✓</span></div>' +
    '</div>' +
    '<h1 class="hc-rt-title">' +
    escapeHtml(successTitle) +
    '</h1>' +
    '<p class="hc-rt-sub">' +
    escapeHtml(successMessage) +
    '</p>' +
    '<div class="hc-rt-product">' +
    imgHtml +
    '<div class="hc-rt-product-info">' +
    '<div class="hc-rt-product-title">' +
    escapeHtml(product.title || '') +
    '</div>' +
    '<div class="hc-rt-points">' +
    escapeHtml(pointsLine) +
    '</div></div></div>' +
    '<div class="hc-rt-info">' +
    '<p class="hc-rt-info-text">' +
    escapeHtml(infoText) +
    '</p>' +
    fulfillmentHtml +
    '</div></div>' +
    '<div class="hc-redemption-thanks-bottom">' +
    '<button type="button" class="hc-rt-primary-btn" id="hc-thanks-action">' +
    escapeHtml(btnLabel) +
    '</button></div></div>';

  document.getElementById('hc-thanks-action').addEventListener('click', function () {
    clearRedemptionThanksState();
    if (isAuctionBid) {
      window.location.hash = '#/rewards/' + encodeURIComponent(rewardId);
    } else {
      window.location.hash = '#/rewards';
    }
  });
}
