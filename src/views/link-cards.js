import * as api from '../api.js';
import { navigate } from '../router.js';
import MainButton from '../base-components/MainButton.js';
import visaLogoUrl from '../assets/visa-logo.png';
import mastercardLogoUrl from '../assets/mastercard-logo.png';
import { showSuccess, showError } from '../base-components/toastApi.js';
import { showWebviewOverlay } from '../webview-overlay.js';

var TERMS_URL = 'https://app.gethomecrowd.com/terms-and-conditions/';
var PRIVACY_URL = 'https://app.gethomecrowd.com/privacy-policy/';

function formatCardNumber(text) {
  var cleaned = String(text || '').replace(/\D/g, '');
  var formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  return formatted.substring(0, 19);
}

function formatExpiryMonth(text) {
  var cleaned = String(text || '').replace(/\D/g, '').substring(0, 2);
  if (cleaned.length === 2) {
    var n = parseInt(cleaned, 10);
    if (n > 12) cleaned = '12';
    if (n < 1 && cleaned.length === 2) cleaned = '01';
  }
  return cleaned;
}

function formatExpiryYear(text) {
  return String(text || '').replace(/\D/g, '').substring(0, 2);
}

function detectCardType(number) {
  var cleaned = String(number || '').replace(/\s/g, '');
  if (cleaned.startsWith('4')) return 'visa';
  if (cleaned.startsWith('5') || cleaned.startsWith('2')) return 'master';
  if (cleaned.startsWith('3')) return 'amex';
  if (cleaned.startsWith('6')) return 'discover';
  return 'unknown';
}

function brandImageUrl(network) {
  var n = String(network || '').toLowerCase();
  if (n === 'visa') return visaLogoUrl;
  if (n === 'master' || n === 'mc') return mastercardLogoUrl;
  return null;
}

function validateCard(state) {
  var cleanedNumber = String(state.cardNumber || '').replace(/\s/g, '');
  if (cleanedNumber.length < 13 || cleanedNumber.length > 19) {
    showError('Please enter a valid card number');
    return false;
  }
  if (!state.expiryMonth || !state.expiryYear) {
    showError('Please enter the expiry date');
    return false;
  }
  if (String(state.cvc || '').length < 3 || String(state.cvc || '').length > 4) {
    showError('Please enter a valid CVC code');
    return false;
  }
  if (!String(state.cardholderName || '').trim()) {
    showError('Please enter the cardholder name');
    return false;
  }
  var currentYear = new Date().getFullYear() % 100;
  var currentMonth = new Date().getMonth() + 1;
  var y = parseInt(state.expiryYear, 10);
  var m = parseInt(state.expiryMonth, 10);
  if (y < currentYear || (y === currentYear && m < currentMonth)) {
    showError('This card has expired');
    return false;
  }
  return true;
}

function syncPreview(container, state) {
  var numEl = container.querySelector('[data-preview-number]');
  var nameEl = container.querySelector('[data-preview-name]');
  var nickEl = container.querySelector('[data-preview-nick]');
  var nickWrap = container.querySelector('[data-preview-nick-wrap]');
  var brandEl = container.querySelector('[data-preview-brand]');
  if (numEl) {
    numEl.textContent = state.cardNumber || '•••• •••• •••• ••••';
  }
  if (nameEl) {
    var exp =
      state.expiryMonth && state.expiryYear
        ? String(state.expiryMonth).padStart(2, '0') + '/' + String(state.expiryYear).slice(-2)
        : 'MM/YY';
    nameEl.textContent = (state.cardholderName || 'CARD HOLDER').toUpperCase() + '      ' + exp;
  }
  if (nickWrap && nickEl) {
    if (state.nickname) {
      nickWrap.style.display = '';
      nickEl.textContent = state.nickname;
    } else {
      nickWrap.style.display = 'none';
    }
  }
  if (brandEl) {
    var cleaned = String(state.cardNumber || '').replace(/\s/g, '');
    var net = detectCardType(state.cardNumber);
    var url = brandImageUrl(net);
    if (url && cleaned.length >= 16) {
      brandEl.innerHTML =
        '<img src="' +
        url +
        '" alt="" class="hc-link-card-preview-brand-img" width="70" height="35" />';
    } else {
      brandEl.innerHTML = '';
    }
  }
}

export function renderLinkCards(container) {
  var state = {
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvc: '',
    cardholderName: '',
    nickname: '',
  };

  var html = '';
  html += '<div class="hc-link-cards-page">';
  html += '<div class="hc-link-cards-scroll">';
  html += '<div class="hc-link-cards-inner">';
  html += '<div class="hc-link-card-page-header">';
  html += '<button type="button" id="hc-link-cards-back" class="hc-link-card-back" aria-label="Back">‹</button>';
  html += '<div class="hc-link-card-page-title">Link New Card</div>';
  html += '</div>';

  html += '<div class="hc-link-card-preview-wrap">';
  html += '<div class="hc-link-card-preview">';
  html += '<div class="hc-link-card-preview-nick" data-preview-nick-wrap style="display:none"><span data-preview-nick></span></div>';
  html += '<div class="hc-link-card-preview-number"><span data-preview-number></span></div>';
  html += '<div class="hc-link-card-preview-holder"><span data-preview-name></span></div>';
  html += '<div class="hc-link-card-preview-brand" data-preview-brand></div>';
  html += '</div></div>';

  html += '<div class="hc-link-card-form">';
  html += '<div class="hc-link-card-field">';
  html += '<label class="hc-link-card-label" for="hc-lc-number">Card Number</label>';
  html +=
    '<input id="hc-lc-number" class="hc-input hc-link-card-input" type="text" inputmode="numeric" autocomplete="cc-number" maxlength="19" placeholder="1234 5678 9012 3456" />';
  html += '</div>';
  html += '<div class="hc-link-card-row">';
  html += '<div class="hc-link-card-field hc-link-card-field--half">';
  html += '<label class="hc-link-card-label" for="hc-lc-mm">Month</label>';
  html +=
    '<input id="hc-lc-mm" class="hc-input hc-link-card-input" type="text" inputmode="numeric" maxlength="2" placeholder="MM" autocomplete="cc-exp-month" />';
  html += '</div>';
  html += '<div class="hc-link-card-field hc-link-card-field--half">';
  html += '<label class="hc-link-card-label" for="hc-lc-yy">Year</label>';
  html +=
    '<input id="hc-lc-yy" class="hc-input hc-link-card-input" type="text" inputmode="numeric" maxlength="2" placeholder="YY" autocomplete="cc-exp-year" />';
  html += '</div></div>';
  html += '<div class="hc-link-card-field">';
  html += '<label class="hc-link-card-label" for="hc-lc-cvc">CVC</label>';
  html +=
    '<input id="hc-lc-cvc" class="hc-input hc-link-card-input" type="password" inputmode="numeric" maxlength="4" placeholder="123" autocomplete="cc-csc" />';
  html += '</div>';
  html += '<div class="hc-link-card-field">';
  html += '<label class="hc-link-card-label" for="hc-lc-name">Cardholder Name</label>';
  html +=
    '<input id="hc-lc-name" class="hc-input hc-link-card-input" type="text" autocomplete="cc-name" placeholder="John Doe" />';
  html += '</div>';
  html += '<div class="hc-link-card-field">';
  html += '<label class="hc-link-card-label" for="hc-lc-nick">Nickname (Optional)</label>';
  html +=
    '<input id="hc-lc-nick" class="hc-input hc-link-card-input" type="text" placeholder="My Primary Card" />';
  html += '</div></div>';

  html +=
    '<p class="hc-link-card-legal">By clicking Link Card below you authorize the payment card network to monitor your payment card and share data about all your purchases as required to participate in the Program per the <button type="button" class="hc-link-card-legal-link" id="hc-lc-terms">Program Terms</button> and <button type="button" class="hc-link-card-legal-link" id="hc-lc-privacy">Privacy Policy</button>. Your purchase data (date/time, purchase amount, merchant category) will be shared with the Program provider Olive, and with HomeCrowd in order to enable card linked offers and to provide notifications about reward status, additional data for qualifying transactions (merchant name and location) will be shared with Olive, with HomeCrowd, and with merchant partners funding the rewards. Data will be accessible until such a time when you revoke authorization via Program settings.<br><br>1) Link your card<br>2) Make qualifying purchases at participating merchants<br>3) Cashback rewards are sent to your selected school</p>';

  html += MainButton({ id: 'hc-lc-submit', text: 'Link Card', loadingText: 'Linking Card with Olive...' });
  html += '</div></div>';

  html += '<div id="hc-lc-overlay" class="hc-link-card-overlay" style="display:none">';
  html += '<div class="hc-link-card-overlay-box">';
  html += '<div class="hc-link-card-overlay-spinner"></div>';
  html += '<div class="hc-link-card-overlay-title">Linking your card...</div>';
  html += '<div class="hc-link-card-overlay-sub">This may take a moment</div>';
  html += '</div></div>';

  html += '<div id="hc-lc-toast" class="hc-link-card-success" style="display:none">';
  html += '<span class="hc-link-card-success-icon" aria-hidden="true">✓</span>';
  html += '<span>Card successfully added!</span>';
  html += '</div>';

  html += '</div>';

  container.innerHTML = html;
  syncPreview(container, state);

  document.getElementById('hc-link-cards-back').addEventListener('click', function () {
    navigate('/cards');
  });

  function bindInput(id, key, transform) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function () {
      var v = el.value;
      if (transform) v = transform(v);
      el.value = v;
      state[key] = v;
      syncPreview(container, state);
    });
  }

  bindInput('hc-lc-number', 'cardNumber', formatCardNumber);
  bindInput('hc-lc-mm', 'expiryMonth', formatExpiryMonth);
  bindInput('hc-lc-yy', 'expiryYear', formatExpiryYear);
  bindInput('hc-lc-cvc', 'cvc', function (t) {
    return t.replace(/\D/g, '').substring(0, 4);
  });
  bindInput('hc-lc-name', 'cardholderName', function (t) {
    return t;
  });
  bindInput('hc-lc-nick', 'nickname', function (t) {
    return t;
  });

  document.getElementById('hc-lc-terms').addEventListener('click', function () {
    showWebviewOverlay(TERMS_URL);
  });
  document.getElementById('hc-lc-privacy').addEventListener('click', function () {
    showWebviewOverlay(PRIVACY_URL);
  });

  document.getElementById('hc-lc-submit').addEventListener('click', async function () {
    if (!validateCard(state)) return;
    var btn = this;
    var overlay = document.getElementById('hc-lc-overlay');
    btn.disabled = true;
    if (overlay) overlay.style.display = 'flex';

    try {
      await api.createOliveMember();

      var addResult = await api.addCardDirect({
        cardNumber: state.cardNumber,
        expiryMonth: state.expiryMonth,
        expiryYear: state.expiryYear,
        cvv: state.cvc,
        cardholderName: state.cardholderName.trim(),
        nickname: state.nickname.trim() || undefined,
      });

      if (!addResult || addResult.success !== true) {
        var er = new Error((addResult && addResult.error) || 'Backend API returned failure');
        er.status = 400;
        er.body = addResult;
        throw er;
      }

      if (overlay) overlay.style.display = 'none';
      var toast = document.getElementById('hc-lc-toast');
      if (toast) {
        toast.style.display = 'flex';
        setTimeout(function () {
          toast.style.display = 'none';
          showSuccess('Card successfully added');
          navigate('/cards');
        }, 900);
      } else {
        showSuccess('Card successfully added');
        navigate('/cards');
      }
    } catch (err) {
      if (overlay) overlay.style.display = 'none';
      btn.disabled = false;
      if (err.status === 400 && err.body && err.body.error_code === 'CARD_ALREADY_LINKED') {
        showError('This card is already linked to another user');
      } else if (err.status === 400) {
        showError((err.body && err.body.error) || err.message || 'Invalid card data');
      } else {
        showError(
          (err.body && (err.body.message || err.body.error)) || err.message || 'Failed to link your card. Please try again.',
        );
      }
    }
  });
}
