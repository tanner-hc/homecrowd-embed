import * as api from '../api.js';
import NavHeader from '../base-components/NavHeader.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { showError } from '../base-components/toastApi.js';
import { formatDisplayNumber } from '../formatNumber.js';
import { navigateToRedemptionThanks, writePendingStripeThanks } from './redemption-thanks.js';

var STORAGE_KEY = 'hc_redemption_confirm_v1';

function routeToReward(rewardId) {
  window.location.hash = '#/rewards/' + encodeURIComponent(rewardId);
}

export function writeRedemptionConfirmAndNavigate(product, opts) {
  opts = opts || {};
  if (!product || !product.id) {
    return;
  }
  var state = {
    product: product,
    availablePoints: opts.availablePoints != null ? opts.availablePoints : 0,
    availableTickets: opts.availableTickets != null ? opts.availableTickets : 0,
    payWithStripe: !!opts.payWithStripe,
    useRaffleTicket: !!opts.useRaffleTicket,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    return;
  }
  window.location.hash = '#/rewards/' + encodeURIComponent(product.id) + '/confirm';
}

export function clearRedemptionConfirmState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

function readState() {
  var raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
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

function getRedemptionType(product) {
  return String(product.redemption_type || product.redemptionType || '').toLowerCase();
}

export function renderRedemptionConfirmation(container, rewardId) {
  var state = readState();
  if (
    !state ||
    !state.product ||
    String(state.product.id) !== String(rewardId)
  ) {
    container.innerHTML =
      '<div class="hc-product-detail hc-redemption-confirm">' +
      '<div class="hc-rc-missing">' +
      '<p class="hc-rc-missing-text">This confirmation page is out of date.</p>' +
      '<a href="#/rewards/' +
      escapeAttr(String(rewardId)) +
      '" class="hc-btn hc-btn-primary hc-rc-missing-btn">Back to reward</a>' +
      '</div></div>';
    return;
  }

  var product = state.product;
  var rt = getRedemptionType(product);
  var payWithStripe = !!state.payWithStripe;
  var useRaffleTicket = !!state.useRaffleTicket;
  var availableTickets = Math.max(0, Number(state.availableTickets) || 0);
  var pointsSummaryPts = Math.max(0, Number(state.availablePoints) || 0);

  var stripeCents = Number(product.cash_price_cents != null ? product.cash_price_cents : product.cashPriceCents);
  var stripeUsdFormatted =
    Number.isFinite(stripeCents) && stripeCents >= 0 ? (stripeCents / 100).toFixed(2) : null;

  var ri = product.raffle_info || product.raffleInfo;
  var raffleDrawingDatePassed =
    rt === 'raffle' && ri && ri.drawing_date && new Date() >= new Date(ri.drawing_date);

  var navTitle = payWithStripe ? 'Confirm purchase' : 'Confirm Redemption';

  var imageUrl = getProductImageUrl(product);
  var imgBlock = imageUrl
    ? '<div class="hc-rc-image-wrap"><img class="hc-rc-image" src="' +
      escapeAttr(imageUrl) +
      '" alt="" /></div>'
    : '<div class="hc-rc-image-ph"><span class="hc-rc-image-ph-text">No Image</span></div>';

  var showTicketQty = rt === 'raffle' && useRaffleTicket && availableTickets > 1;

  var costLabel = payWithStripe ? 'Price (USD):' : 'Cost:';
  var ptsCost = product.points_cost != null ? product.points_cost : product.pointsCost || 0;

  var initialQty = 1;
  var costValueHtml = '';
  if (payWithStripe && stripeUsdFormatted != null) {
    costValueHtml = '$' + escapeHtml(stripeUsdFormatted);
  } else if (rt === 'raffle' && useRaffleTicket) {
    costValueHtml =
      '<span id="hc-rc-cost-val">' +
      initialQty +
      ' ticket' +
      (initialQty !== 1 ? 's' : '') +
      '</span>';
  } else {
    costValueHtml = formatDisplayNumber(ptsCost) + ' pts';
  }

  var balanceLabel = payWithStripe
    ? 'Your points (unchanged):'
    : rt === 'raffle' && useRaffleTicket
      ? 'Your Tickets:'
      : 'Your Points:';
  var balanceVal = payWithStripe
    ? formatDisplayNumber(pointsSummaryPts) + ' pts'
    : rt === 'raffle' && useRaffleTicket
      ? availableTickets + ' ticket' + (availableTickets !== 1 ? 's' : '')
      : formatDisplayNumber(pointsSummaryPts) + ' pts';

  var remainingRowHtml = '';
  if (!payWithStripe) {
    var remLabel = 'Remaining After:';
    var remVal = '';
    if (rt === 'raffle' && useRaffleTicket) {
      remVal =
        '<span id="hc-rc-remaining-val">' +
        (availableTickets - initialQty) +
        ' ticket' +
        (availableTickets - initialQty !== 1 ? 's' : '') +
        '</span>';
    } else {
      remVal = formatDisplayNumber(Math.max(0, pointsSummaryPts - ptsCost)) + ' pts';
    }
    remainingRowHtml =
      '<div class="hc-rc-row">' +
      '<span class="hc-rc-row-label">' +
      remLabel +
      '</span>' +
      '<span class="hc-rc-row-value">' +
      remVal +
      '</span></div>';
  }

  var qtyHtml = '';
  if (showTicketQty) {
    qtyHtml =
      '<div class="hc-rc-qty">' +
      '<div class="hc-rc-qty-label">Tickets to use</div>' +
      '<div class="hc-rc-qty-row">' +
      '<button type="button" class="hc-rc-qty-btn" id="hc-rc-qty-minus" aria-label="Decrease">−</button>' +
      '<span class="hc-rc-qty-num" id="hc-rc-qty-val">1</span>' +
      '<button type="button" class="hc-rc-qty-btn" id="hc-rc-qty-plus" aria-label="Increase">+</button>' +
      '</div>' +
      '<div class="hc-rc-qty-avail">' +
      availableTickets +
      ' available</div>' +
      '</div>';
  }

  var confirmText = '';
  if (payWithStripe) {
    confirmText =
      'You will pay with a card on the next screen (Stripe). Points will not be charged. After payment succeeds, you will see a confirmation screen.';
  } else if (rt === 'raffle') {
    confirmText = raffleDrawingDatePassed
      ? 'This raffle has ended and is no longer accepting entries.'
      : 'Are you sure you want to enter this raffle? You will be entered into the drawing and your entry cannot be undone.';
  } else {
    confirmText = 'Are you sure you want to redeem this item? This action cannot be undone.';
  }

  var confirmDisabled =
    !payWithStripe && rt === 'raffle' && raffleDrawingDatePassed;

  var html =
    '<div class="hc-product-detail hc-redemption-confirm">' +
    '<div class="hc-product-detail-nav-sticky">' +
    NavHeader({ title: navTitle, backButtonId: 'hc-rc-back' }) +
    '</div>' +
    '<div class="hc-redemption-confirm-scroll">' +
    '<div class="hc-rc-image-block">' +
    imgBlock +
    '</div>' +
    '<div class="hc-rc-info">' +
    '<div class="hc-rc-title">' +
    escapeHtml(product.title || '') +
    '</div>' +
    qtyHtml +
    '<div class="hc-rc-row hc-rc-row--border">' +
    '<span class="hc-rc-row-label">' +
    costLabel +
    '</span>' +
    '<span class="hc-rc-row-value hc-rc-row-value--accent" id="hc-rc-cost-wrap">' +
    costValueHtml +
    '</span></div>' +
    '<div class="hc-rc-row hc-rc-row--border">' +
    '<span class="hc-rc-row-label">' +
    balanceLabel +
    '</span>' +
    '<span class="hc-rc-row-value">' +
    balanceVal +
    '</span></div>' +
    remainingRowHtml +
    '</div>' +
    '<div class="hc-rc-confirm-box">' +
    '<p class="hc-rc-confirm-text">' +
    escapeHtml(confirmText) +
    '</p></div>' +
    '</div>' +
    '<div class="hc-redemption-confirm-bottom">' +
    '<div class="hc-rc-bottom-inner">' +
    '<button type="button" class="hc-rc-cancel" id="hc-rc-cancel">Cancel</button>' +
    '<div class="hc-rc-confirm-wrap">' +
    '<button type="button" class="hc-rc-confirm' +
    (confirmDisabled ? ' hc-rc-confirm--disabled' : '') +
    '" id="hc-rc-submit"' +
    (confirmDisabled ? ' disabled' : '') +
    '>' +
    (payWithStripe ? 'Continue to payment' : 'Confirm') +
    '</button>' +
    '<div class="hc-rc-loading" id="hc-rc-loading" style="display:none" aria-hidden="true">' +
    '<span class="hc-rc-spinner"></span>' +
    '</div></div></div></div></div>';

  container.innerHTML = html;

  var selectedQuantity = initialQty;

  function syncTicketUi() {
    var costEl = document.getElementById('hc-rc-cost-val');
    var remEl = document.getElementById('hc-rc-remaining-val');
    if (costEl) {
      costEl.textContent =
        selectedQuantity + ' ticket' + (selectedQuantity !== 1 ? 's' : '');
    }
    if (remEl) {
      var rem = availableTickets - selectedQuantity;
      remEl.textContent = rem + ' ticket' + (rem !== 1 ? 's' : '');
    }
    var qv = document.getElementById('hc-rc-qty-val');
    if (qv) qv.textContent = String(selectedQuantity);
  }

  var minus = document.getElementById('hc-rc-qty-minus');
  var plus = document.getElementById('hc-rc-qty-plus');
  if (minus && plus && showTicketQty) {
    minus.addEventListener('click', function () {
      if (selectedQuantity <= 1) return;
      selectedQuantity -= 1;
      minus.disabled = selectedQuantity <= 1;
      plus.disabled = selectedQuantity >= availableTickets;
      syncTicketUi();
    });
    plus.addEventListener('click', function () {
      if (selectedQuantity >= availableTickets) return;
      selectedQuantity += 1;
      minus.disabled = selectedQuantity <= 1;
      plus.disabled = selectedQuantity >= availableTickets;
      syncTicketUi();
    });
    minus.disabled = true;
  }

  function goBack() {
    clearRedemptionConfirmState();
    routeToReward(rewardId);
  }

  var backBtn = document.getElementById('hc-rc-back');
  if (backBtn) {
    backBtn.addEventListener('click', function (e) {
      e.preventDefault();
      goBack();
    });
  }

  document.getElementById('hc-rc-cancel').addEventListener('click', goBack);

  var submitBtn = document.getElementById('hc-rc-submit');
  var loadingEl = document.getElementById('hc-rc-loading');

  submitBtn.addEventListener('click', async function () {
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    loadingEl.style.display = 'flex';
    try {
      if (payWithStripe) {
        var data = await api.createStripeRewardCheckoutSession(product.id);
        if (data && data.url) {
          writePendingStripeThanks(
            product,
            Number.isFinite(stripeCents) ? stripeCents : null,
          );
          clearRedemptionConfirmState();
          window.location.href = data.url;
          return;
        }
        showError('Could not open checkout.');
        submitBtn.disabled = false;
        loadingEl.style.display = 'none';
        return;
      }

      if (rt === 'raffle' && raffleDrawingDatePassed) {
        showError('This raffle has ended.');
        submitBtn.disabled = false;
        loadingEl.style.display = 'none';
        return;
      }

      var ticketsUsed = 0;
      if (rt === 'raffle' && useRaffleTicket) {
        var n = showTicketQty ? selectedQuantity : 1;
        ticketsUsed = n;
        for (var i = 0; i < n; i++) {
          await api.createRedemptionMain({
            reward: product.id,
            points_spent: 0,
            use_raffle_ticket: true,
          });
        }
      } else {
        await api.createRedemptionMain({
          reward: product.id,
          points_spent: ptsCost,
          use_raffle_ticket: false,
        });
      }

      clearRedemptionConfirmState();
      navigateToRedemptionThanks(product, {
        pointsSpent: rt === 'raffle' && useRaffleTicket ? 0 : ptsCost,
        ticketsUsed: ticketsUsed,
        isAuctionBid: false,
        paidWithStripe: false,
      });
    } catch (err) {
      var msg = err && err.message ? err.message : 'Request failed.';
      showError(msg);
      submitBtn.disabled = false;
      loadingEl.style.display = 'none';
    }
  });
}
