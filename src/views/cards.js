import * as api from '../api.js';
import { navigate } from '../router.js';
import visaLogoUrl from '../assets/visa-logo.png';
import mastercardLogoUrl from '../assets/mastercard-logo.png';
import shieldIconUrl from '../assets/shield.svg';
import cardFilledIconUrl from '../assets/card-filled.svg';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import NavHeader from '../base-components/NavHeader.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import { showSuccess, showError } from '../base-components/toastApi.js';

export function renderCards(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading cards...' });
  loadCards(container);
}

async function loadCards(container) {
  try {
    var cards = await api.getCards();
    var activeCards = (cards || []).filter(function (card) {
      return card.status === 'active';
    });

    var html = '';

    html += '<div class="hc-cards-page">';
    html += '<div class="hc-account-settings-nav">';
    html += NavHeader({
      title: 'Linked Cards',
      backButtonId: 'hc-cards-back',
    });
    html += '</div>';

    html += '<div class="hc-security-banner">';
    html += '<div class="hc-security-icon"><img src="' + shieldIconUrl + '" width="24" height="24" alt="" /></div>';
    html += '<div class="hc-security-content">';
    html += '<div class="hc-security-title">Your data is secure</div>';
    html +=
      '<div class="hc-security-desc">We use bank-level encryption and never store your full card details</div>';
    html += '</div>';
    html += '</div>';

    if (activeCards.length > 0) {
      html += '<div class="hc-cards-section">';
      activeCards.forEach(function (card) {
        html += '<div class="hc-card-item">';
        html += '<div class="hc-card-item-content">';
        html += '<div class="hc-card-item-icon"><img src="' + cardFilledIconUrl + '" width="20" height="20" alt="" /></div>';
        html += '<div class="hc-card-item-details">';
        html += '<div class="hc-card-item-number">*** ' + escapeHtml(card.last4) + '</div>';
        if (card.nickname) {
          html += '<div class="hc-card-item-nickname">' + escapeHtml(card.nickname) + '</div>';
        }
        html += '</div>';
        html += '</div>';
        html +=
          '<button type="button" class="hc-card-menu-btn" data-deactivate-id="' +
          escapeAttr(card.id) +
          '" data-card-last4="' +
          escapeAttr(card.last4) +
          '">⋮</button>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '<div class="hc-cards-add-section">';
    html += '<div class="hc-cards-card-type-row">';
    html += '<a href="#/cards/link" class="hc-cards-card-type-btn" aria-label="Add Visa card">';
    html += '<img src="' + visaLogoUrl + '" alt="" class="hc-cards-card-type-logo hc-cards-card-type-logo--visa" />';
    html += '<span class="hc-cards-card-type-text">Add visa</span>';
    html += '</a>';
    html += '<a href="#/cards/link" class="hc-cards-card-type-btn" aria-label="Add Mastercard">';
    html += '<img src="' + mastercardLogoUrl + '" alt="" class="hc-cards-card-type-logo hc-cards-card-type-logo--mastercard" />';
    html += '<span class="hc-cards-card-type-text">Add Mastercard</span>';
    html += '</a>';
    html += '</div>';
    html += '</div>';

    html += '<div id="hc-deactivate-modal" class="hc-modal-overlay" style="display:none">';
    html += '<div class="hc-deactivate-modal">';
    html += '<div class="hc-deactivate-modal-title">Deactivate Card</div>';
    html += '<div id="hc-deactivate-modal-text" class="hc-deactivate-modal-message"></div>';
    html += '<div class="hc-deactivate-modal-actions">';
    html += '<button type="button" id="hc-deactivate-cancel" class="hc-deactivate-cancel-btn">Cancel</button>';
    html += '<button type="button" id="hc-deactivate-confirm" class="hc-deactivate-confirm-btn">Deactivate</button>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    var deactivateTarget = null;

    var backBtn = document.getElementById('hc-cards-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        navigate('/profile');
      });
    }

    container.onclick = function (e) {
      var btn = e.target.closest('[data-deactivate-id]');
      if (!btn || !container.contains(btn)) return;
      deactivateTarget = {
        id: btn.getAttribute('data-deactivate-id'),
        last4: btn.getAttribute('data-card-last4'),
      };
      document.getElementById('hc-deactivate-modal-text').textContent =
        'Are you sure you want to deactivate this card ending in ' +
        deactivateTarget.last4 +
        '? This action cannot be undone.';
      document.getElementById('hc-deactivate-modal').style.display = 'flex';
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
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deactivating...';

      try {
        await api.deactivateCard(deactivateTarget.id);
        document.getElementById('hc-deactivate-modal').style.display = 'none';
        showSuccess('Card deactivated');
        deactivateTarget = null;
        loadCards(container);
      } catch (err) {
        showError('Failed: ' + (err.message || 'Unknown error'));
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Deactivate';
      }
    };
  } catch (err) {
    container.innerHTML =
      '<div class="hc-alert-error">Failed to load cards: ' + escapeHtml(err.message) + '</div>';
  }
}
