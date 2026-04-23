import * as api from '../api.js';
import { postToNative } from '../bridge.js';
import { showWebviewOverlay } from '../webview-overlay.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import Button from '../base-components/Button.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';

export function renderOfferDetail(container, offerId) {
  container.innerHTML = LoadingSpinner({ text: 'Loading offer...' });
  loadOfferDetail(container, offerId);
}

function consumeInitialOffer(offerId) {
  try {
    var raw = sessionStorage.getItem('hc_offer_detail_initial');
    if (!raw) return null;
    sessionStorage.removeItem('hc_offer_detail_initial');
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    var savedId = parsed.offerId != null ? String(parsed.offerId) : '';
    if (savedId && offerId && savedId !== String(offerId)) return null;
    return parsed.offer && typeof parsed.offer === 'object' ? parsed.offer : null;
  } catch (e) {
    return null;
  }
}

async function loadOfferDetail(container, offerId) {
  try {
    var initialOffer = consumeInitialOffer(offerId);
    var offer = null;
    var canFetchById = offerId && offerId !== 'featured' && offerId !== 'unknown';
    if (canFetchById) {
      try {
        var fetched = await api.getOfferDetails(offerId);
        offer = Object.assign({}, initialOffer || {}, fetched || {});
      } catch (_e) {
        offer = initialOffer;
      }
    } else {
      offer = initialOffer;
    }
    if (!offer) {
      throw new Error('Offer not found');
    }

    var html = '';

    // Back button
    html += '<div class="hc-detail-nav">';
    html += '<button id="hc-back-btn" class="hc-back-btn">\u2190 Offers</button>';
    html += '</div>';

    // Brand section — logo + name
    var logoUrl = offer.logoUrl || offer.logo || '';
    var name = offer.name || offer.merchantName || 'Unknown';

    html += '<div class="hc-offer-brand">';
    if (logoUrl) {
      html += '<div class="hc-offer-logo-wrap"><img class="hc-offer-logo" src="' + escapeAttr(logoUrl) + '" alt="' + escapeAttr(name) + '" /></div>';
    } else {
      var initials = name.split(' ').map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
      html += '<div class="hc-offer-logo-wrap"><div class="hc-offer-logo-initials">' + escapeHtml(initials) + '</div></div>';
    }
    html += '<div class="hc-offer-brand-name">' + escapeHtml(name) + '</div>';
    html += '</div>';

    html += '<div class="hc-offer-cashback-section">';
    html += '<div class="hc-offer-cashback-kicker">YOU\'LL EARN</div>';
    html += '<div class="hc-offer-cashback-value">1 point for every $1 spent</div>';
    html += '<div class="hc-offer-cashback-subtitle">ON ELIGIBLE PURCHASES</div>';
    html +=
      '<div class="hc-offer-cashback-note">' +
      escapeHtml(getSchoolCashbackText(offer)) +
      '</div>';
    html += '</div>';

    var locationText = getLocationText(offer);
    html += '<div class="hc-offer-info-section">';
    html += '<div class="hc-offer-info-title">WHERE TO SHOP</div>';
    html += '<div class="hc-offer-info-value">' + escapeHtml(locationText) + '</div>';
    html += '</div>';

    // Important terms
    html += '<div class="hc-offer-info-section">';
    html += '<div class="hc-offer-info-title">IMPORTANT TERMS</div>';
    html +=
      '<div class="hc-offer-term-row"><span class="hc-offer-term-label">Valid Days:</span><span class="hc-offer-term-value">' +
      escapeHtml(getDaysOfWeek(offer.daysAvailability)) +
      '</span></div>';
    html +=
      '<div class="hc-offer-term-row"><span class="hc-offer-term-label">Redemption Limit:</span><span class="hc-offer-term-value">' +
      escapeHtml(getRedemptionLimitText(offer)) +
      '</span></div>';

    // Minimum purchase
    if (offer.purchaseAmount) {
      html += '<div class="hc-offer-term-row"><span class="hc-offer-term-label">Minimum purchase</span><span class="hc-offer-term-value">$' + Number(offer.purchaseAmount).toFixed(2) + '</span></div>';
    }

    html +=
      '<div class="hc-offer-term-row"><span class="hc-offer-term-label">Offer Expires:</span><span class="hc-offer-term-value">' +
      escapeHtml(getExpiryText(offer)) +
      '</span></div>';

    // Payment methods
    var schemes = getPaymentMethods(offer);
    if (schemes) {
      html += '<div class="hc-offer-term-row"><span class="hc-offer-term-label">Payment</span><span class="hc-offer-term-value">' + escapeHtml(schemes) + '</span></div>';
    }

    html += '</div>';

    // Description
    var description = offer.description || offer.qualifier || offer.tile || '';
    if (description) {
      html += '<div class="hc-offer-info-section">';
      html += '<div class="hc-offer-info-title">DESCRIPTION</div>';
      html += '<div class="hc-offer-desc-text">' + escapeHtml(description) + '</div>';
      html += '</div>';
    }

    // Shop button
    var shopUrl = offer.website || offer.offerPublisherAffiliateLinkUrl || '';
    if (shopUrl || offer.offerType === 'click' || offer.offerType === 'click_sso') {
      html += '<div style="height:80px"></div>';
      html += '<div class="hc-offer-bottom">';
      html += Button({
        id: 'hc-shop-btn',
        title: 'Shop Now',
        variant: 'primary',
        className: 'hc-btn-large',
      });
      html += '</div>';
    }

    container.innerHTML = html;

    // Back button
    document.getElementById('hc-back-btn').addEventListener('click', function () {
      window.location.hash = '#/offers';
    });

    // Shop button
    var shopBtn = document.getElementById('hc-shop-btn');
    if (shopBtn) {
      shopBtn.addEventListener('click', async function () {
        shopBtn.disabled = true;
        shopBtn.textContent = 'Opening...';
        try {
          // Try to get tracking URL first
          var trackResult = await api.trackOfferClick(offer.offerId || offer.id).catch(function () { return null; });
          var url = (trackResult && trackResult.tracking_url) || shopUrl;
          if (url) {
            if (url.indexOf('http') !== 0) url = 'https://' + url;
            openExternalUrl(url);
          }
        } catch (err) {
          if (shopUrl) openExternalUrl(shopUrl);
        }
        shopBtn.disabled = false;
        shopBtn.textContent = 'Shop Now';
      });
    }
  } catch (err) {
    container.innerHTML = '<div class="hc-detail-nav"><button id="hc-back-btn" class="hc-back-btn">\u2190 Offers</button></div><div class="hc-alert-error">Failed to load offer: ' + escapeHtml(err.message) + '</div>';
    var backBtn = document.getElementById('hc-back-btn');
    if (backBtn) backBtn.addEventListener('click', function () { window.location.hash = '#/offers'; });
  }
}

function openExternalUrl(url) {
  postToNative('homecrowd:open-url', { url: url });
  showWebviewOverlay(url);
}

function getCashbackDisplay(offer) {
  if (offer.reward) {
    if (offer.reward.type === 'percentage' && offer.reward.value) {
      var text = offer.reward.value + '% back';
      if (offer.reward.maxValue) text += ' (up to $' + offer.reward.maxValue + ')';
      return text;
    }
    if (offer.reward.type === 'fixed' && offer.reward.value) {
      return '$' + offer.reward.value + ' back';
    }
  }
  if (offer.cashback) {
    return offer.cashback + '% back';
  }
  return null;
}

function getLocationText(offer) {
  if (offer.isOnline || offer.reach === 'online_only') return 'Online';
  if (offer.stores && offer.stores.length > 0) {
    var s = offer.stores[0];
    var parts = [s.address, s.city, s.state].filter(Boolean);
    if (offer.stores.length > 1) return parts.join(', ') + ' + ' + (offer.stores.length - 1) + ' more';
    return parts.join(', ');
  }
  if (offer.address || offer.city) {
    return [offer.address, offer.city, offer.state].filter(Boolean).join(', ');
  }
  return 'In-Store Locations';
}

function getPaymentMethods(offer) {
  var schemes = offer.supportedSchemes;
  if (!schemes && offer.stores && offer.stores.length > 0) {
    schemes = offer.stores[0].supportedSchemes;
  }
  if (schemes && schemes.length > 0) {
    return schemes.join(', ');
  }
  return null;
}

function getDaysOfWeek(days) {
  var names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (!days || days.length === 0) return 'Every day';
  if (days.length === 7) return 'Every day';
  var weekdays = [1, 2, 3, 4, 5];
  var weekend = [0, 6];
  if (days.length === 5 && weekdays.every(function (d) { return days.indexOf(d) >= 0; })) return 'Weekdays';
  if (days.length === 2 && weekend.every(function (d) { return days.indexOf(d) >= 0; })) return 'Weekends';
  return days.map(function (d) { return names[d]; }).join(', ');
}

function getRedemptionLimitText(offer) {
  if (!offer || !offer.redeemLimitPerUser) return 'Unlimited redemptions';
  var limit = Number(offer.redeemLimitPerUser);
  if (!Number.isFinite(limit) || limit <= 0) return 'Unlimited redemptions';
  var text = limit + 'x';
  if (offer.redeemLimitPerUserInterval) {
    text += ' per ' + offer.redeemLimitPerUserInterval;
  }
  return text;
}

function getExpiryText(offer) {
  if (!offer || !offer.endDate) return 'No expiration date';
  var d = new Date(offer.endDate);
  if (isNaN(d.getTime())) return 'No expiration date';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getSchoolCashbackText(offer) {
  if (offer && offer.cashback != null && String(offer.cashback).trim() !== '') {
    return String(offer.cashback) + '% cashback goes to your school';
  }
  if (offer && offer.reward && offer.reward.value != null && String(offer.reward.value).trim() !== '') {
    return String(offer.reward.value) + '% cashback goes to your school';
  }
  return '5% cashback goes to your school';
}

