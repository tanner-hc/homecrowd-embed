import { escapeAttr, escapeHtml } from '../../base-components/html.js';
import { renderPointMultiplierBadgeHtml } from '../../pointMultiplier.js';
import * as api from '../../api.js';

function pickFeaturedList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.results)) return raw.results;
  return [];
}

function isPlausibleOliveOfferId(id) {
  if (id == null) return false;
  var s = String(id).trim();
  if (!s) return false;
  return s.length >= 8;
}

/**
 * @param {{ merchants?: object[], loading?: boolean }} props
 */
export function buildBottomFeaturedGridHtml(props) {
  props = props || {};
  if (props.loading) {
    return '<div class="hc-bottom-featured hc-bottom-featured--loading" aria-hidden="true"></div>';
  }
  var merchants = Array.isArray(props.merchants) ? props.merchants : [];
  if (!merchants.length) return '';

  var items = merchants
    .map(function (merchant) {
      var logo = merchant.small_logo_url || merchant.large_logo_url || '';
      var payload = escapeAttr(
        JSON.stringify({
          id: merchant.id,
          name: merchant.name,
          offer_id: merchant.offer_id,
          offer_type: merchant.offer_type || 'cardlinked',
          small_logo_url: merchant.small_logo_url,
          large_logo_url: merchant.large_logo_url,
        })
      );
      return (
        '<button type="button" class="hc-bottom-featured-item" data-bottom-featured="' +
        payload +
        '">' +
        renderPointMultiplierBadgeHtml(merchant, 'overlay', true) +
        '<span class="hc-bottom-featured-row">' +
        (logo
          ? '<img src="' +
            escapeAttr(logo) +
            '" alt="" class="hc-bottom-featured-logo" />'
          : '<span class="hc-bottom-featured-logo hc-bottom-featured-logo--ph"></span>') +
        '<span class="hc-bottom-featured-name">' +
        escapeHtml(merchant.name || '') +
        '</span>' +
        '</span>' +
        '</button>'
      );
    })
    .join('');

  return '<div class="hc-bottom-featured"><div class="hc-bottom-featured-grid">' + items + '</div></div>';
}

export async function fetchBottomFeaturedMerchants() {
  var raw = await api.getFeaturedOffers('card_linked');
  return pickFeaturedList(raw).filter(function (m) {
    return m && m.bottom_featured && m.is_active !== false;
  });
}

/**
 * @param {HTMLElement} root
 * @param {{ onPress?: function(object) }} handlers
 */
export function bindBottomFeaturedGrid(root, handlers) {
  handlers = handlers || {};
  if (!root) return;
  root.querySelectorAll('[data-bottom-featured]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var raw = btn.getAttribute('data-bottom-featured');
      var merchant = null;
      try {
        merchant = JSON.parse(raw);
      } catch (_e) {
        return;
      }
      if (!merchant || typeof handlers.onPress !== 'function') return;

      var offerId =
        merchant.offer_id != null && String(merchant.offer_id).trim() !== ''
          ? String(merchant.offer_id).trim()
          : '';
      if (offerId && isPlausibleOliveOfferId(offerId)) {
        try {
          var full = await api.getOfferDetails(offerId);
          if (full) {
            handlers.onPress(full);
            return;
          }
        } catch (_err) { }
      }
      handlers.onPress(
        Object.assign({}, merchant, {
          offerType: 'cardlinked',
          name: merchant.name,
        })
      );
    });
  });
}
