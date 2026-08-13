import * as api from '../api.js';
import { navigate } from '../router.js';
import visaLogoUrl from '../assets/visa-logo.png';
import mastercardLogoUrl from '../assets/mastercard-logo.png';
// The design's own icon (Figma 1466:12653) — same shield-and-check glyph as
// assets/shield.svg, but filled black rather than that one's #A0622D brown.
import shieldIconUrl from '../assets/icons/shield-check.svg';
import chevronRightSvg from '../assets/icons/chevron-right-sm.svg?raw';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { buildAppHeaderHtml, attachAppHeader } from '../base-components/AppHeader.js';
import MainButton from '../base-components/MainButton.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { showSuccess, showError } from '../base-components/toastApi.js';

/**
 * The brand mark for a card, by its Olive scheme. Anything unrecognised falls
 * back to no logo rather than a wrong one — the label still names the brand.
 */
function cardBrandLogo(brand) {
  var key = String(brand || '').trim().toLowerCase();
  if (key.indexOf('visa') >= 0) return visaLogoUrl;
  if (key.indexOf('master') >= 0) return mastercardLogoUrl;
  return '';
}

/** "Visa •••• 4821" — the brand as given, title-cased, then the last four. */
function cardLabel(card) {
  var brand = String((card && card.brand) || '').trim();
  var pretty = brand
    ? brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase()
    : 'Card';
  return pretty + ' •••• ' + String((card && card.last4) || '');
}

export function renderCards(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading cards...' });
  loadCards(container);
}

async function loadCards(container) {
  try {
    // The header carries the avatar and points balance, so they load alongside
    // the cards. Neither is worth failing the page for.
    var loaded = await Promise.all([
      api.getCards(),
      api.fetchCurrentUser().catch(function () {
        return null;
      }),
      api.getRewardsSummary().catch(function () {
        return null;
      }),
    ]);
    var cards = loaded[0];
    var currentUser = loaded[1];
    var summary = loaded[2];
    var availablePoints =
      (summary &&
        (summary.availablePoints != null
          ? summary.availablePoints
          : summary.available_points)) ||
      0;
    var activeCards = (cards || []).filter(function (card) {
      return card.status === 'active';
    });

    var html = '';

    html += '<div class="hc-cards-page">';
    // Figma 1428:14551 — back and points, no page title.
    html += buildAppHeaderHtml({ showBack: true, user: currentUser, points: availablePoints });

    html += '<div class="hc-cards-body">';

    html += '<div class="hc-cards-secure">';
    html += '<span class="hc-cards-secure-icon" aria-hidden="true">';
    html += '<img data-hc-ph="none" src="' + shieldIconUrl + '" alt="" />';
    html += '</span>';
    html += '<span class="hc-cards-secure-text">';
    html += '<span class="hc-cards-secure-title">Your data is secure</span>';
    html +=
      '<span class="hc-cards-secure-desc">We use bank-level encryption and never store your full card details</span>';
    html += '</span>';
    html += '</div>';

    activeCards.forEach(function (card) {
      var logo = cardBrandLogo(card.brand);
      html +=
        '<button type="button" class="hc-cards-row" data-card-id="' +
        escapeAttr(card.id) +
        '" data-card-last4="' +
        escapeAttr(card.last4) +
        '">';
      html += '<span class="hc-cards-row-brand">';
      if (logo) {
        html += '<img data-hc-ph="card" src="' + escapeAttr(logo) + '" alt="" />';
      }
      html += '</span>';
      html += '<span class="hc-cards-row-label">' + escapeHtml(cardLabel(card)) + '</span>';
      html += '<span class="hc-cards-row-chevron" aria-hidden="true">' + chevronRightSvg + '</span>';
      html += '</button>';
    });

    html += '</div>';

    // Pinned to the bottom of the screen, over the page rather than after it.
    html += '<div class="hc-cards-footer">';
    html += '<button type="button" class="hc-cards-add" id="hc-cards-add">Add card</button>';
    html += '</div>';

    html += '<div id="hc-card-menu-modal" class="hc-modal-overlay" style="display:none">';
    html += '<div class="hc-deactivate-modal hc-card-menu-modal">';
    html += '<div class="hc-deactivate-modal-title">Card options</div>';
    html += '<div id="hc-card-menu-modal-text" class="hc-deactivate-modal-message"></div>';
    html += '<div class="hc-pd-actions hc-card-menu-actions">';
    html += MainButton({
      id: 'hc-card-menu-deactivate',
      text: 'Deactivate',
      className: 'hc-card-menu-deactivate-btn',
    });
    html += MainButton({ id: 'hc-card-menu-cancel', text: 'Cancel', outlined: true });
    html += '</div>';
    html += '</div>';
    html += '</div>';

    html += '<div id="hc-deactivate-modal" class="hc-modal-overlay" style="display:none">';
    html += '<div class="hc-deactivate-modal hc-card-deactivate-modal">';
    html += '<div class="hc-deactivate-modal-title">Deactivate Card</div>';
    html += '<div id="hc-deactivate-modal-text" class="hc-deactivate-modal-message"></div>';
    html += '<div class="hc-pd-actions hc-card-deactivate-actions">';
    html += MainButton({
      id: 'hc-deactivate-confirm',
      text: 'Deactivate',
      className: 'hc-card-menu-deactivate-btn',
      loadingText: 'Deactivating...',
    });
    html += MainButton({ id: 'hc-deactivate-cancel', text: 'Cancel', outlined: true });
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    var deactivateTarget = null;
    var menuTarget = null;

    attachAppHeader(container, {
      showBack: true,
      user: currentUser,
      points: availablePoints,
      onBackPress: function () {
        // Reached from the profile and from an offer's "Manage" pill, so step
        // back through history rather than assuming the profile.
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        navigate('/profile');
      },
    });

    var addBtn = document.getElementById('hc-cards-add');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        navigate('/cards/link-intro');
      });
    }

    container.onclick = function (e) {
      var btn = e.target.closest('[data-card-id]');
      if (!btn || !container.contains(btn)) return;
      menuTarget = {
        id: btn.getAttribute('data-card-id'),
        last4: btn.getAttribute('data-card-last4'),
      };
      document.getElementById('hc-card-menu-modal-text').textContent =
        'Card ending in ' + menuTarget.last4;
      document.getElementById('hc-card-menu-modal').style.display = 'flex';
    };

    document.getElementById('hc-card-menu-cancel').onclick = function () {
      document.getElementById('hc-card-menu-modal').style.display = 'none';
      menuTarget = null;
    };

    document.getElementById('hc-card-menu-modal').onclick = function (e) {
      if (e.target === e.currentTarget) {
        e.currentTarget.style.display = 'none';
        menuTarget = null;
      }
    };

    document.getElementById('hc-card-menu-deactivate').onclick = function () {
      if (!menuTarget) return;
      deactivateTarget = menuTarget;
      document.getElementById('hc-card-menu-modal').style.display = 'none';
      document.getElementById('hc-deactivate-modal-text').textContent =
        'Are you sure you want to deactivate this card ending in ' +
        deactivateTarget.last4 +
        '? This action cannot be undone.';
      document.getElementById('hc-deactivate-modal').style.display = 'flex';
      menuTarget = null;
    };

    document.getElementById('hc-deactivate-cancel').onclick = function () {
      document.getElementById('hc-deactivate-modal').style.display = 'none';
      deactivateTarget = null;
    };

    document.getElementById('hc-deactivate-modal').onclick = function (e) {
      if (e.target === e.currentTarget) {
        e.currentTarget.style.display = 'none';
        deactivateTarget = null;
      }
    };

    document.getElementById('hc-deactivate-confirm').onclick = async function () {
      if (!deactivateTarget) return;
      var confirmBtn = this;
      var prevHtml = confirmBtn.innerHTML;
      confirmBtn.disabled = true;
      confirmBtn.innerHTML =
        '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>Deactivating...</span>';

      try {
        await api.deactivateCard(deactivateTarget.id);
        document.getElementById('hc-deactivate-modal').style.display = 'none';
        showSuccess('Card deactivated');
        deactivateTarget = null;
        loadCards(container);
      } catch (err) {
        showError('Failed: ' + (err.message || 'Unknown error'));
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = prevHtml;
      }
    };
  } catch (err) {
    container.innerHTML =
      '<div class="hc-alert-error">Failed to load cards: ' + escapeHtml(err.message) + '</div>';
  }
}
