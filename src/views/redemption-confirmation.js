import * as api from '../api.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { showError } from '../base-components/toastApi.js';
import { formatDisplayNumber } from '../formatNumber.js';
import ticketSvg from '../assets/icons/ticket-fill.svg?raw';
import infoSvg from '../assets/icons/info-outline.svg?raw';
import minusSvg from '../assets/icons/stepper-minus.svg?raw';
import plusSvg from '../assets/icons/stepper-plus.svg?raw';
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

function computeMaxEntryQuantity(product, rt, payWithStripe, useRaffleTicket, availableTickets, pointsSummaryPts) {
  if (rt !== 'raffle' || payWithStripe) {
    return 1;
  }

  var ptsCost = product.points_cost != null ? product.points_cost : product.pointsCost || 0;
  var ri = product.raffle_info || product.raffleInfo;
  var userEntries = (ri && ri.user_entries) || 0;
  var maxPerUser = ri && ri.max_entries_per_user;
  var maxTotal = ri && ri.max_total_entries;
  var totalEntries = (ri && ri.total_entries) || 0;
  var limits = [];

  if (useRaffleTicket) {
    limits.push(availableTickets);
  } else if (ptsCost > 0) {
    limits.push(Math.floor(pointsSummaryPts / ptsCost));
  }

  if (maxPerUser) {
    limits.push(maxPerUser - userEntries);
  }
  if (maxTotal) {
    limits.push(maxTotal - totalEntries);
  }

  if (limits.length === 0) {
    return 1;
  }

  return Math.max(0, Math.min.apply(null, limits));
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
    ? '<div class="hc-rc-image-wrap"><img data-hc-ph="gift" class="hc-rc-image" src="' +
      escapeAttr(imageUrl) +
      '" alt="" /></div>'
    : '<div class="hc-rc-image-ph"><span class="hc-rc-image-ph-text">No Image</span></div>';

  var ptsCost = product.points_cost != null ? product.points_cost : product.pointsCost || 0;
  var maxEntryQuantity = computeMaxEntryQuantity(
    product,
    rt,
    payWithStripe,
    useRaffleTicket,
    availableTickets,
    pointsSummaryPts,
  );
  var showEntryQuantitySelector = rt === 'raffle' && !payWithStripe && maxEntryQuantity > 1;

  var costLabel = payWithStripe ? 'Price (USD):' : 'Cost:';

  var initialQty = 1;
  var costValueHtml = '';
  if (payWithStripe && stripeUsdFormatted != null) {
    costValueHtml = '$' + escapeHtml(stripeUsdFormatted);
  } else if (rt === 'raffle' && useRaffleTicket) {
    costValueHtml =
      '<span id="hc-rc-cost-val">' +
      initialQty +
      ' entry' +
      (initialQty !== 1 ? ' entries' : '') +
      '</span>';
  } else if (rt === 'raffle' && showEntryQuantitySelector) {
    // Just the points, per Figma 1426:10902 — the entry count is already the
    // number in the stepper right above this row.
    costValueHtml =
      '<span id="hc-rc-cost-val">' +
      formatDisplayNumber(ptsCost * initialQty) +
      ' pts</span>';
  } else {
    costValueHtml = formatDisplayNumber(ptsCost) + ' pts';
  }

  var balanceLabel = payWithStripe
    ? 'Your points (unchanged)'
    : rt === 'raffle' && useRaffleTicket
      ? 'Your tickets'
      : 'Your points';
  var balanceVal = payWithStripe
    ? formatDisplayNumber(pointsSummaryPts) + ' pts'
    : rt === 'raffle' && useRaffleTicket
      ? availableTickets + ' ticket' + (availableTickets !== 1 ? 's' : '')
      : formatDisplayNumber(pointsSummaryPts) + ' pts';

  var remainingRowHtml = '';
  if (!payWithStripe) {
    var remLabel = 'Remaining after';
    var remVal = '';
    if (rt === 'raffle' && useRaffleTicket) {
      remVal =
        '<span id="hc-rc-remaining-val">' +
        (availableTickets - initialQty) +
        ' entry' +
        (availableTickets - initialQty !== 1 ? ' entries' : '') +
        '</span>';
    } else if (rt === 'raffle' && showEntryQuantitySelector) {
      remVal =
        '<span id="hc-rc-remaining-val">' +
        formatDisplayNumber(Math.max(0, pointsSummaryPts - ptsCost * initialQty)) +
        ' pts</span>';
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
  if (showEntryQuantitySelector) {
    qtyHtml =
      '<div class="hc-rc-qty">' +
      '<div class="hc-rc-qty-label">How many entries?</div>' +
      '<div class="hc-rc-qty-row">' +
      '<button type="button" class="hc-rc-qty-btn" id="hc-rc-qty-minus" aria-label="Decrease">' +
      minusSvg +
      '</button>' +
      '<span class="hc-rc-qty-num" id="hc-rc-qty-val">1</span>' +
      '<button type="button" class="hc-rc-qty-btn hc-rc-qty-btn--add" id="hc-rc-qty-plus" aria-label="Increase">' +
      plusSvg +
      '</button>' +
      '</div>' +
      '</div>';
  }

  var confirmText = '';
  if (payWithStripe) {
    confirmText =
      'You will pay with a card on the next screen (Stripe). Points will not be charged. After payment succeeds, you will see a confirmation screen.';
  } else if (rt === 'raffle') {
    confirmText = raffleDrawingDatePassed
      ? 'This raffle has ended and is no longer accepting entries.'
      : useRaffleTicket
        ? 'Your tickets will be spent when you enter. Raffle entries cannot be undone.'
        : 'Your points will be spent when you enter. Raffle entries cannot be undone.';
  } else {
    confirmText = 'Your points will be spent when you redeem. Redemptions cannot be undone.';
  }

  var totalPointsCost =
    rt === 'raffle' && !useRaffleTicket ? ptsCost * initialQty : ptsCost;
  var hasInsufficientPoints =
    !payWithStripe && !useRaffleTicket && pointsSummaryPts < totalPointsCost;
  // Raffles are a game of chance, so entry is gated on the entrant confirming they
  // are 18+. Other reward types are unaffected.
  var requiresAgeConfirm = rt === 'raffle';
  var ageConfirmed = false;
  // Unticked does NOT disable Confirm — pressing it explains what's missing, which
  // is clearer than a dead button whose reason is scrolled out of view.
  var confirmDisabled =
    hasInsufficientPoints || (!payWithStripe && rt === 'raffle' && raffleDrawingDatePassed);
  var confirmBtnLabel = hasInsufficientPoints
    ? 'Insufficient Points'
    : payWithStripe
      ? 'Continue to payment'
      : 'Confirm';

  // Figma 1426:10785 — a bottom sheet over the dimmed reward, not a page.
  var html =
    '<div class="hc-rc-backdrop" data-hc-rc-dismiss="1"></div>' +
    '<div class="hc-rc-sheet" role="dialog" aria-modal="true" aria-label="' +
    escapeAttr(navTitle) +
    '">' +
    '<div class="hc-rc-grabber" aria-hidden="true"></div>' +
    '<div class="hc-rc-sheet-scroll">' +
    '<div class="hc-rc-head">' +
    (rt === 'raffle'
      ? '<span class="hc-prize-detail-badge">' +
        '<span class="hc-prize-detail-badge-icon" aria-hidden="true">' +
        ticketSvg +
        '</span>' +
        '<span class="hc-prize-detail-badge-text">Raffle</span>' +
        '</span>'
      : '') +
    '<h1 class="hc-rc-title">' +
    escapeHtml(product.title || '') +
    '</h1>' +
    '</div>' +
    qtyHtml +
    '<div class="hc-rc-info">' +
    '<div class="hc-rc-row">' +
    '<span class="hc-rc-row-label">' +
    costLabel +
    '</span>' +
    '<span class="hc-rc-row-value" id="hc-rc-cost-wrap">' +
    costValueHtml +
    '</span></div>' +
    '<div class="hc-rc-row">' +
    '<span class="hc-rc-row-label">' +
    balanceLabel +
    '</span>' +
    '<span class="hc-rc-row-value">' +
    balanceVal +
    '</span></div>' +
    remainingRowHtml +
    '</div>' +
    (requiresAgeConfirm
      ? '<label class="hc-rc-age" for="hc-rc-age-check">' +
        '<input type="checkbox" class="hc-rc-age-input" id="hc-rc-age-check" />' +
        '<span class="hc-rc-age-text">I confirm that I am at least 18 years old.</span>' +
        '</label>'
      : '') +
    '<div class="hc-rc-confirm-box">' +
    '<span class="hc-rc-confirm-icon" aria-hidden="true">' +
    infoSvg +
    '</span>' +
    '<p class="hc-rc-confirm-text">' +
    escapeHtml(confirmText) +
    '</p></div>' +
    '</div>' +
    '<div class="hc-rc-actions">' +
    (requiresAgeConfirm
      ? '<div class="hc-rc-notice" id="hc-rc-notice" role="status" aria-live="polite" hidden>' +
        '<span class="hc-rc-notice-text">Please confirm you are at least 18 years old.</span>' +
        '</div>'
      : '') +
    '<button type="button" class="hc-rc-confirm' +
    (confirmDisabled ? ' hc-rc-confirm--disabled' : '') +
    '" id="hc-rc-submit"' +
    (confirmDisabled ? ' disabled' : '') +
    '>' +
    escapeHtml(confirmBtnLabel) +
    '</button>' +
    '<button type="button" class="hc-rc-cancel" id="hc-rc-cancel">Cancel</button>' +
    '<div class="hc-rc-loading" id="hc-rc-loading" style="display:none" aria-hidden="true">' +
    '<span class="hc-rc-spinner"></span>' +
    '</div>' +
    '</div>' +
    '</div>';

  container.innerHTML = html;

  var selectedQuantity = initialQty;

  function syncQuantityUi() {
    var costEl = document.getElementById('hc-rc-cost-val');
    var remEl = document.getElementById('hc-rc-remaining-val');
    if (costEl) {
      if (useRaffleTicket) {
        costEl.textContent =
          selectedQuantity + ' entry' + (selectedQuantity !== 1 ? ' entries' : '');
      } else {
        costEl.textContent =
          formatDisplayNumber(ptsCost * selectedQuantity) + ' pts';
      }
    }
    if (remEl) {
      if (useRaffleTicket) {
        var ticketRem = availableTickets - selectedQuantity;
        remEl.textContent =
          ticketRem + ' entry' + (ticketRem !== 1 ? ' entries' : '');
      } else {
        remEl.textContent =
          formatDisplayNumber(Math.max(0, pointsSummaryPts - ptsCost * selectedQuantity)) +
          ' pts';
      }
    }
    var qv = document.getElementById('hc-rc-qty-val');
    if (qv) qv.textContent = String(selectedQuantity);

    var totalCost = rt === 'raffle' && !useRaffleTicket ? ptsCost * selectedQuantity : ptsCost;
    var insufficient = !payWithStripe && !useRaffleTicket && pointsSummaryPts < totalCost;
    var drawingBlocked = !payWithStripe && rt === 'raffle' && raffleDrawingDatePassed;
    if (submitBtn) {
      submitBtn.disabled = insufficient || drawingBlocked;
      submitBtn.textContent = insufficient
        ? 'Insufficient Points'
        : payWithStripe
          ? 'Continue to payment'
          : 'Confirm';
      if (insufficient || drawingBlocked) {
        submitBtn.classList.add('hc-rc-confirm--disabled');
      } else {
        submitBtn.classList.remove('hc-rc-confirm--disabled');
      }
    }

    var confirmTextEl = document.querySelector('.hc-rc-confirm-text');
    if (confirmTextEl && rt === 'raffle' && !payWithStripe) {
      if (raffleDrawingDatePassed) {
        confirmTextEl.textContent =
          'This raffle has ended and is no longer accepting entries.';
      } else {
        // Same note at any quantity — the design states the rule, not the count.
        confirmTextEl.textContent = useRaffleTicket
          ? 'Your tickets will be spent when you enter. Raffle entries cannot be undone.'
          : 'Your points will be spent when you enter. Raffle entries cannot be undone.';
      }
    }
  }

  var minus = document.getElementById('hc-rc-qty-minus');
  var plus = document.getElementById('hc-rc-qty-plus');
  if (minus && plus && showEntryQuantitySelector) {
    minus.addEventListener('click', function () {
      if (selectedQuantity <= 1) return;
      selectedQuantity -= 1;
      minus.disabled = selectedQuantity <= 1;
      plus.disabled = selectedQuantity >= maxEntryQuantity;
      syncQuantityUi();
    });
    plus.addEventListener('click', function () {
      if (selectedQuantity >= maxEntryQuantity) return;
      selectedQuantity += 1;
      minus.disabled = selectedQuantity <= 1;
      plus.disabled = selectedQuantity >= maxEntryQuantity;
      syncQuantityUi();
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

  // Tapping the dimmed reward behind the sheet dismisses it, the same as Cancel.
  var backdropEl = container.querySelector('[data-hc-rc-dismiss]');
  if (backdropEl) backdropEl.addEventListener('click', goBack);

  var submitBtn = document.getElementById('hc-rc-submit');

  var ageRow = container.querySelector('.hc-rc-age');

  var noticeEl = document.getElementById('hc-rc-notice');
  var noticeTimer = null;

  // A soft brand pill rather than the red error toast: this is a nudge about a
  // missing tick, not a failure. Matches the points-earned banner's treatment.
  function showAgeNotice() {
    if (!noticeEl) return;
    if (noticeTimer) window.clearTimeout(noticeTimer);
    noticeEl.hidden = false;
    // Next frame, so the transition runs instead of the element just appearing.
    window.requestAnimationFrame(function () {
      noticeEl.classList.add('hc-rc-notice--visible');
    });
    noticeTimer = window.setTimeout(function () {
      noticeEl.classList.remove('hc-rc-notice--visible');
      noticeTimer = window.setTimeout(function () {
        noticeEl.hidden = true;
      }, 260);
    }, 4000);
  }

  function hideAgeNotice() {
    if (!noticeEl) return;
    if (noticeTimer) window.clearTimeout(noticeTimer);
    noticeEl.classList.remove('hc-rc-notice--visible');
    noticeEl.hidden = true;
  }

  // Scrolls the attestation into view and flashes it, so a rejected press points
  // at the thing that blocked it.
  function revealAgeCheck() {
    if (!ageRow) return;
    try {
      ageRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_e) {
      ageRow.scrollIntoView();
    }
    ageRow.classList.add('hc-rc-age--flash');
    setTimeout(function () {
      ageRow.classList.remove('hc-rc-age--flash');
    }, 1200);
  }


  var ageCheck = document.getElementById('hc-rc-age-check');
  if (ageCheck) {
    ageCheck.addEventListener('change', function () {
      ageConfirmed = !!ageCheck.checked;
      if (ageConfirmed) hideAgeNotice();
      // syncQuantityUi owns the button's enabled state, so route through it rather
      // than toggling `disabled` here and letting the two drift apart.
      syncQuantityUi();
    });
  }
  var loadingEl = document.getElementById('hc-rc-loading');

  syncQuantityUi();

  submitBtn.addEventListener('click', async function () {
    if (submitBtn.disabled) return;
    if (requiresAgeConfirm && !ageConfirmed) {
      showAgeNotice();
      revealAgeCheck();
      return;
    }
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

      var entryTotalCost =
        rt === 'raffle' && !useRaffleTicket ? ptsCost * selectedQuantity : ptsCost;
      if (!payWithStripe && !useRaffleTicket && pointsSummaryPts < entryTotalCost) {
        showError(
          'You need ' +
            formatDisplayNumber(entryTotalCost) +
            ' points but only have ' +
            formatDisplayNumber(pointsSummaryPts) +
            ' available.',
        );
        submitBtn.disabled = false;
        loadingEl.style.display = 'none';
        syncQuantityUi();
        return;
      }

      var ticketsUsed = 0;
      var entriesUsed = 0;
      if (rt === 'raffle' && useRaffleTicket) {
        var n = showEntryQuantitySelector ? selectedQuantity : 1;
        ticketsUsed = n;
        entriesUsed = n;
        for (var i = 0; i < n; i++) {
          await api.createRedemptionMain({
            reward: product.id,
            points_spent: 0,
            use_raffle_ticket: true,
            age_confirmed: ageConfirmed,
          });
        }
      } else if (rt === 'raffle') {
        entriesUsed = selectedQuantity;
        for (var j = 0; j < selectedQuantity; j++) {
          await api.createRedemptionMain({
            reward: product.id,
            points_spent: ptsCost,
            use_raffle_ticket: false,
            age_confirmed: ageConfirmed,
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
        pointsSpent: rt === 'raffle' && !useRaffleTicket ? entryTotalCost : useRaffleTicket ? 0 : ptsCost,
        entriesUsed: rt === 'raffle' ? entriesUsed : 0,
        ticketsUsed: ticketsUsed,
        isAuctionBid: false,
        paidWithStripe: false,
      });
    } catch (err) {
      var msg = err && err.message ? err.message : 'Request failed.';
      showError(msg);
      submitBtn.disabled = false;
      loadingEl.style.display = 'none';
      syncQuantityUi();
    }
  });
}
