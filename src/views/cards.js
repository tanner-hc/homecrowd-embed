import * as api from '../api.js';
import { postToNative } from '../bridge.js';
import visaLogoUrl from '../assets/visa-logo.png';
import mastercardLogoUrl from '../assets/mastercard-logo.png';
import shieldIconUrl from '../assets/shield.svg';
import cardFilledIconUrl from '../assets/card-filled.svg';

export function renderCards(container) {
  container.innerHTML = '<div class="hc-spinner"></div>';
  loadCards(container);
}

async function loadCards(container) {
  try {
    var cards = await api.getCards();
    // Filter active cards only
    var activeCards = (cards || []).filter(function (card) {
      return card.status === 'active';
    });

    var html = '';

    // Screen title
    html += '<div class="hc-screen-title">';
    html += '<div class="hc-screen-title-text">Linked Cards</div>';
    html += '</div>';

    // Security banner
    html += '<div class="hc-security-banner">';
    html += '<div class="hc-security-icon"><img src="' + shieldIconUrl + '" width="24" height="24" alt="" /></div>';
    html += '<div class="hc-security-content">';
    html += '<div class="hc-security-title">Your data is secure</div>';
    html += '<div class="hc-security-desc">We use bank-level encryption and never store your full card details</div>';
    html += '</div>';
    html += '</div>';

    // Existing cards list
    if (activeCards.length > 0) {
      html += '<div class="hc-cards-section">';
      activeCards.forEach(function (card) {
        html += '<div class="hc-card-item">';
        html += '<div class="hc-card-item-content">';
        html += '<div class="hc-card-item-icon"><img src="' + cardFilledIconUrl + '" width="20" height="15" alt="" /></div>';
        html += '<div class="hc-card-item-details">';
        html += '<div class="hc-card-item-number">*** ' + escapeHtml(card.last4) + '</div>';
        if (card.nickname) {
          html += '<div class="hc-card-item-nickname">' + escapeHtml(card.nickname) + '</div>';
        }
        html += '</div>';
        html += '</div>';
        html += '<button class="hc-card-menu-btn" data-deactivate-id="' + escapeAttr(card.id) + '" data-card-last4="' + escapeAttr(card.last4) + '">⋮</button>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Card type selection buttons
    html += '<div class="hc-add-card-section">';
    html += '<div class="hc-card-type-selection">';
    html += '<button class="hc-card-type-btn" id="hc-add-visa">';
    html += '<img src="' + visaLogoUrl + '" class="hc-card-type-logo" alt="Visa" />';
    html += '<div class="hc-card-type-text">Add visa</div>';
    html += '</button>';
    html += '<button class="hc-card-type-btn" id="hc-add-mastercard">';
    html += '<img src="' + mastercardLogoUrl + '" class="hc-card-type-logo hc-mc-logo" alt="Mastercard" />';
    html += '<div class="hc-card-type-text">Add Mastercard</div>';
    html += '</button>';
    html += '</div>';
    html += '</div>';

    // Deactivate modal
    html += '<div id="hc-deactivate-modal" class="hc-modal-overlay" style="display:none">';
    html += '<div class="hc-deactivate-modal">';
    html += '<div class="hc-deactivate-modal-title">Deactivate Card</div>';
    html += '<div id="hc-deactivate-modal-text" class="hc-deactivate-modal-message"></div>';
    html += '<div class="hc-deactivate-modal-actions">';
    html += '<button id="hc-deactivate-cancel" class="hc-deactivate-cancel-btn">Cancel</button>';
    html += '<button id="hc-deactivate-confirm" class="hc-deactivate-confirm-btn">Deactivate</button>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // Toast
    html += '<div id="hc-toast" class="hc-toast" style="display:none"></div>';

    container.innerHTML = html;

    // Bind add card buttons
    var addVisaBtn = document.getElementById('hc-add-visa');
    var addMcBtn = document.getElementById('hc-add-mastercard');

    function handleAddCard() {
      postToNative('homecrowd:card-link', { type: 'visa' });
      showToast('Card linking initiated. Complete in your app.');
    }

    addVisaBtn.addEventListener('click', function () {
      postToNative('homecrowd:card-link', { type: 'visa' });
      showToast('Card linking initiated. Complete in your app.');
    });

    addMcBtn.addEventListener('click', function () {
      postToNative('homecrowd:card-link', { type: 'mastercard' });
      showToast('Card linking initiated. Complete in your app.');
    });

    // Bind deactivate
    var deactivateTarget = null;

    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-deactivate-id]');
      if (!btn) return;
      deactivateTarget = {
        id: btn.getAttribute('data-deactivate-id'),
        last4: btn.getAttribute('data-card-last4'),
      };
      document.getElementById('hc-deactivate-modal-text').textContent =
        'Are you sure you want to deactivate this card ending in ' + deactivateTarget.last4 + '? This action cannot be undone.';
      document.getElementById('hc-deactivate-modal').style.display = 'flex';
    });

    document.getElementById('hc-deactivate-cancel').addEventListener('click', function () {
      document.getElementById('hc-deactivate-modal').style.display = 'none';
      deactivateTarget = null;
    });

    document.getElementById('hc-deactivate-modal').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) {
        e.currentTarget.style.display = 'none';
        deactivateTarget = null;
      }
    });

    document.getElementById('hc-deactivate-confirm').addEventListener('click', async function () {
      if (!deactivateTarget) return;
      var confirmBtn = this;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deactivating...';

      try {
        await api.deactivateCard(deactivateTarget.id);
        document.getElementById('hc-deactivate-modal').style.display = 'none';
        showToast('Card deactivated');
        deactivateTarget = null;
        loadCards(container);
      } catch (err) {
        showToast('Failed: ' + (err.message || 'Unknown error'));
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Deactivate';
      }
    });
  } catch (err) {
    container.innerHTML = '<div class="hc-alert-error">Failed to load cards: ' + escapeHtml(err.message) + '</div>';
  }
}

function showToast(msg) {
  var el = document.getElementById('hc-toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(function () { el.style.display = 'none'; }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
