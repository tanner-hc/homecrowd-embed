import * as api from '../api.js';
import { navigate } from '../router.js';
import visaLogoUrl from '../assets/visa-logo.png';
import mastercardLogoUrl from '../assets/mastercard-logo.png';
import shieldIconUrl from '../assets/shield.svg';
import cardFilledIconUrl from '../assets/card-filled.svg';
import zeroTagUrl from '../assets/icons/zero-tag.png';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import NavHeader from '../base-components/NavHeader.js';
import MainButton from '../base-components/MainButton.js';
import Input from '../base-components/Input.js';
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

    var noCostTagSvg = '<img src="' + zeroTagUrl + '" alt="" />';
    var heartSvg =
      '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M18 30.5l-1.85-1.7C9.4 22.7 5 18.7 5 13.85A6.85 6.85 0 0 1 11.85 7c2.1 0 4.1 1 5.4 2.55l.75.9.75-.9A7.07 7.07 0 0 1 24.15 7 6.85 6.85 0 0 1 31 13.85c0 4.85-4.4 8.85-11.15 14.95L18 30.5z" fill="#2f5d36"/>' +
      '</svg>';

    html += '<div class="hc-cards-info hc-cards-info--blue">';
    html += '<div class="hc-cards-info-row">';
    html += '<div class="hc-cards-info-icon hc-cards-info-icon--circle">' + noCostTagSvg + '</div>';
    html += '<div class="hc-cards-info-text">';
    html += '<div class="hc-cards-info-title hc-cards-info-title--blue">No cost to you. Ever.</div>';
    html += '<div class="hc-cards-info-body">Link your card for free&mdash;there are no hidden fees and no extra charges.</div>';
    html += '</div>';
    html += '</div>';
    html += '<div class="hc-cards-info-divider" aria-hidden="true"></div>';
    html += '<div class="hc-cards-info-subrow">';
    html += '<div class="hc-cards-info-subtext">Automatically earn dollars for your school every time you shop.</div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="hc-cards-info hc-cards-info--green">';
    html += '<div class="hc-cards-info-row">';
    html += '<div class="hc-cards-info-icon hc-cards-info-icon--circle">' + heartSvg + '</div>';
    html += '<div class="hc-cards-info-text">';
    html += '<div class="hc-cards-info-title hc-cards-info-title--green">You earn points. Your school earns dollars.</div>';
    html += '<div class="hc-cards-info-body">Every purchase you make helps you earn points (gear, access, and experiences) while dollars are sent to your school.</div>';
    html += '</div>';
    html += '</div>';
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
          '<button type="button" class="hc-card-menu-btn" data-card-id="' +
          escapeAttr(card.id) +
          '" data-card-last4="' +
          escapeAttr(card.last4) +
          '" data-card-nickname="' +
          escapeAttr(card.nickname || '') +
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

    html += '<div id="hc-card-menu-modal" class="hc-modal-overlay" style="display:none">';
    html += '<div class="hc-deactivate-modal hc-card-menu-modal">';
    html += '<div class="hc-deactivate-modal-title">Card options</div>';
    html += '<div id="hc-card-menu-modal-text" class="hc-deactivate-modal-message"></div>';
    html += '<div class="hc-pd-actions hc-card-menu-actions">';
    html += MainButton({ id: 'hc-card-menu-edit', text: 'Edit nickname', outlined: true });
    html += MainButton({
      id: 'hc-card-menu-deactivate',
      text: 'Deactivate',
      className: 'hc-card-menu-deactivate-btn',
    });
    html += MainButton({ id: 'hc-card-menu-cancel', text: 'Cancel', outlined: true });
    html += '</div>';
    html += '</div>';
    html += '</div>';

    html += '<div id="hc-edit-nickname-modal" class="hc-modal-overlay" style="display:none">';
    html += '<div class="hc-deactivate-modal hc-card-nickname-modal">';
    html += '<div class="hc-deactivate-modal-title">Edit Nickname</div>';
    html += '<div id="hc-edit-nickname-modal-text" class="hc-deactivate-modal-message"></div>';
    html += Input({
      id: 'hc-edit-nickname-input',
      label: 'Nickname (Optional)',
      placeholder: 'My Primary Card',
      className: 'hc-link-card-input',
    });
    html += '<div class="hc-pd-actions hc-card-nickname-actions">';
    html += MainButton({ id: 'hc-edit-nickname-save', text: 'Save', loadingText: 'Saving...' });
    html += MainButton({ id: 'hc-edit-nickname-cancel', text: 'Cancel', outlined: true });
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
    var editNicknameTarget = null;

    var backBtn = document.getElementById('hc-cards-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        navigate('/profile');
      });
    }

    container.onclick = function (e) {
      var btn = e.target.closest('[data-card-id]');
      if (!btn || !container.contains(btn)) return;
      menuTarget = {
        id: btn.getAttribute('data-card-id'),
        last4: btn.getAttribute('data-card-last4'),
        nickname: btn.getAttribute('data-card-nickname') || '',
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

    document.getElementById('hc-card-menu-edit').onclick = function () {
      if (!menuTarget) return;
      editNicknameTarget = menuTarget;
      document.getElementById('hc-card-menu-modal').style.display = 'none';
      document.getElementById('hc-edit-nickname-modal-text').textContent =
        'Set a nickname for card ending in ' + editNicknameTarget.last4;
      document.getElementById('hc-edit-nickname-input').value = editNicknameTarget.nickname;
      document.getElementById('hc-edit-nickname-modal').style.display = 'flex';
      menuTarget = null;
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

    document.getElementById('hc-edit-nickname-cancel').onclick = closeEditNicknameModal;

    document.getElementById('hc-edit-nickname-modal').onclick = function (e) {
      if (e.target === e.currentTarget) {
        closeEditNicknameModal();
      }
    };

    function closeEditNicknameModal() {
      document.getElementById('hc-edit-nickname-modal').style.display = 'none';
      editNicknameTarget = null;
    }

    document.getElementById('hc-edit-nickname-save').onclick = async function () {
      if (!editNicknameTarget) return;
      var saveBtn = this;
      var nicknameInput = document.getElementById('hc-edit-nickname-input');
      var prevHtml = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML =
        '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>Saving...</span>';

      try {
        await api.updateCardNickname(editNicknameTarget.id, nicknameInput.value.trim());
        closeEditNicknameModal();
        showSuccess('Nickname updated');
        loadCards(container);
      } catch (err) {
        showError('Failed: ' + (err.message || 'Unknown error'));
        saveBtn.disabled = false;
        saveBtn.innerHTML = prevHtml;
      }
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
