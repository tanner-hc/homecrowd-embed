import * as api from '../api.js';
import { navigate } from '../router.js';
import { escapeAttr } from '../base-components/html.js';
import { showError } from '../base-components/toastApi.js';
import { showWebviewOverlay } from '../webview-overlay.js';
import { getPrivacyUrl, getTermsUrl } from '../legal-urls.js';
import { openBottomSheet } from '../base-components/BottomSheetModal.js';
import { renderSuccessCelebration } from '../base-components/SuccessCelebration.js';
import { claimSetupTaskReward } from '../setup-rewards.js';
import { openCardScannerWithPermission } from '../components/CardScanner.js';
import chevronLeftSvg from '../assets/icons/chevron-left.svg?raw';
import cardFilledSvg from '../assets/icons/card-filled.svg?raw';
import cardIconUrl from '../assets/icons/card.png';
import cameraIconUrl from '../assets/icons/pinhead_camera.png';

function formatCardNumber(text) {
  var cleaned = String(text || '').replace(/\D/g, '');
  var formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  return formatted.substring(0, 19);
}

function parseExpiry(text) {
  var cleaned = String(text || '').replace(/\D/g, '').substring(0, 4);
  var month = cleaned.substring(0, 2);
  var year = cleaned.substring(2, 4);
  if (month.length === 2) {
    var monthNum = parseInt(month, 10);
    if (monthNum > 12) month = '12';
    if (monthNum === 0) month = '01';
  }
  return { month: month, year: year };
}

function expiryDisplay(month, year) {
  if (!month && !year) return '';
  return month + (month.length === 2 ? ' / ' : '') + year;
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
    showError('Please enter a valid CVV code');
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

async function hasActiveLinkedCard() {
  try {
    var cards = await api.getCards();
    if (!Array.isArray(cards)) {
      cards = (cards && (cards.results || cards.data)) || [];
    }
    if (!Array.isArray(cards)) return false;
    return cards.some(function (card) {
      return (card && card.status ? card.status : 'active') === 'active';
    });
  } catch (_e) {
    return false;
  }
}

function renderSuccess(container, earnedPoints) {
  return renderSuccessCelebration(container, {
    title: 'Card linked!',
    subtitle: 'Your eligible everyday purchases will now earn points for your school.',
    points: earnedPoints,
    primaryLabel: 'Go to Dashboard',
    onPrimary: function () {
      navigate('/home');
    },
  });
}

export function renderLinkCards(container) {
  var state = {
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvc: '',
    cardholderName: '',
  };
  var loading = false;
  var successCleanup = null;
  var scanSheet = null;
  var cardScanner = null;

  function applyScannedCard(card) {
    if (!card) return;
    var nameEl = container.querySelector('#hc-ac-name');
    var numberEl = container.querySelector('#hc-ac-number');
    var expiryEl = container.querySelector('#hc-ac-expiry');

    if (card.cardNumber) {
      state.cardNumber = formatCardNumber(card.cardNumber);
      if (numberEl) numberEl.value = state.cardNumber;
    }
    if (card.expiryMonth || card.expiryYear) {
      var month = String(card.expiryMonth || '')
        .replace(/\D/g, '')
        .padStart(2, '0')
        .slice(-2);
      var year = String(card.expiryYear || '')
        .replace(/\D/g, '')
        .slice(-2);
      state.expiryMonth = month;
      state.expiryYear = year;
      if (expiryEl) expiryEl.value = expiryDisplay(month, year);
    }
    if (card.holderName && String(card.holderName).trim()) {
      state.cardholderName = String(card.holderName).trim();
      if (nameEl) nameEl.value = state.cardholderName;
    }
  }

  function closeCardScanner() {
    if (!cardScanner) return;
    try {
      cardScanner.close();
    } catch (_e) {}
    cardScanner = null;
  }

  function startCardScanner() {
    closeCardScanner();
    var placeholder = {
      close: function () {},
    };
    cardScanner = placeholder;
    Promise.resolve(
      openCardScannerWithPermission({
        onScan: function (card) {
          cardScanner = null;
          applyScannedCard(card);
        },
        onClose: function () {
          cardScanner = null;
        },
        onPermissionDenied: function (err) {
          cardScanner = null;
          var name = err && err.name ? String(err.name) : '';
          if (
            name === 'NotAllowedError' ||
            name === 'PermissionDeniedError' ||
            name === 'SecurityError'
          ) {
            showError('Allow camera access to scan your card');
            return;
          }
          showError('Camera is unavailable. Enter card details manually.');
        },
      })
    ).then(function (api) {
      if (cardScanner !== placeholder) {
        if (api && typeof api.close === 'function') api.close();
        return;
      }
      cardScanner = api || null;
    });
  }

  function mountForm() {
    container.innerHTML =
      '<div class="hc-add-card-page">' +
      '<div class="hc-add-card-nav">' +
      '<button type="button" class="hc-add-card-back" id="hc-add-card-back" aria-label="Back">' +
      chevronLeftSvg +
      '</button>' +
      '<div class="hc-add-card-nav-spacer" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="hc-add-card-body">' +
      '<div class="hc-add-card-scroll">' +
      '<h1 class="hc-add-card-title">Add card</h1>' +
      '<p class="hc-add-card-subtitle">Earn points for every purchase and unlock exclusive team perks</p>' +
      '<form id="hc-add-card-form" class="hc-add-card-form" autocomplete="on" novalidate>' +
      '<div class="hc-add-card-field">' +
      '<label class="hc-add-card-label" for="hc-ac-name">Cardholder name</label>' +
      '<div class="hc-add-card-input-wrap">' +
      '<input id="hc-ac-name" name="cc-name" class="hc-add-card-input" type="text" autocomplete="cc-name" autocapitalize="words" autocorrect="off" placeholder="Jhon Doe" />' +
      '</div></div>' +
      '<div class="hc-add-card-field">' +
      '<label class="hc-add-card-label" for="hc-ac-number">Card number</label>' +
      '<div class="hc-add-card-input-wrap">' +
      '<img data-hc-ph="none" src="' +
      escapeAttr(cardIconUrl) +
      '" alt="" class="hc-add-card-card-icon" width="24" height="18" />' +
      '<input id="hc-ac-number" name="cc-number" class="hc-add-card-input hc-add-card-input--flex" type="text" inputmode="numeric" autocomplete="cc-number" maxlength="19" placeholder="Card number" />' +
      '<button type="button" class="hc-add-card-camera" id="hc-ac-camera" aria-label="Scan card">' +
      '<img data-hc-ph="none" src="' +
      escapeAttr(cameraIconUrl) +
      '" alt="" width="22" height="22" />' +
      '</button>' +
      '</div></div>' +
      '<div class="hc-add-card-row">' +
      '<div class="hc-add-card-field hc-add-card-field--half">' +
      '<label class="hc-add-card-label" for="hc-ac-expiry">Expiry date</label>' +
      '<div class="hc-add-card-input-wrap">' +
      '<input id="hc-ac-expiry" name="cc-exp" class="hc-add-card-input" type="text" inputmode="numeric" autocomplete="cc-exp" maxlength="7" placeholder="MM / YY" />' +
      '</div></div>' +
      '<div class="hc-add-card-field hc-add-card-field--half">' +
      '<label class="hc-add-card-label" for="hc-ac-cvc">CVV</label>' +
      '<div class="hc-add-card-input-wrap">' +
      '<input id="hc-ac-cvc" name="cc-csc" class="hc-add-card-input" type="password" inputmode="numeric" autocomplete="cc-csc" maxlength="4" placeholder="123" />' +
      '</div></div>' +
      '</div>' +
      '</form>' +
      '<p class="hc-add-card-legal">' +
      'By clicking Link Card below you authorize the payment card network to monitor your payment card and share data about all your purchases as required to participate in the Program per the ' +
      '<a class="hc-add-card-legal-link" id="hc-ac-terms" href="' +
      escapeAttr(getTermsUrl()) +
      '" target="_blank" rel="noopener noreferrer">Program Terms</a> and ' +
      '<a class="hc-add-card-legal-link" id="hc-ac-privacy" href="' +
      escapeAttr(getPrivacyUrl()) +
      '" target="_blank" rel="noopener noreferrer">Privacy Policy</a>' +
      '. Your purchase data (date/time, purchase amount, merchant category) will be shared with the Program provider Olive, and with HomeCrowd in order to enable card linked offers and to provide notifications about reward status, additional data for qualifying transactions (merchant name and location) will be shared with Olive, with HomeCrowd, and with merchant partners funding the rewards. Data will be accessible until such a time when you revoke authorization via Program settings.' +
      '<br><br>1) Link your card<br>2) Make qualifying purchases at participating merchants<br>3) Cashback rewards are sent to your selected school' +
      '</p>' +
      '</div>' +
      '<div class="hc-add-card-footer">' +
      '<button type="button" class="hc-add-card-cta" id="hc-ac-submit">Link Card</button>' +
      '</div>' +
      '</div>' +
      '<div id="hc-ac-overlay" class="hc-add-card-overlay" hidden>' +
      '<div class="hc-add-card-overlay-box">' +
      '<div class="hc-add-card-overlay-spinner" aria-hidden="true"></div>' +
      '<div class="hc-add-card-overlay-text">Linking your card...</div>' +
      '</div></div>' +
      '</div>';

    bindForm();
    openScanPrompt();
  }

  function focusManualEntry() {
    var nameEl = container.querySelector('#hc-ac-name');
    if (nameEl) {
      window.setTimeout(function () {
        nameEl.focus();
      }, 50);
    }
  }

  function openScanPrompt() {
    if (scanSheet) {
      scanSheet.close();
      scanSheet = null;
    }
    scanSheet = openBottomSheet({
      iconHtml:
        '<span class="hc-add-card-scan-icon" style="color:#003355">' + cardFilledSvg + '</span>',
      title: 'Scan to fill in card\ndetails instantly',
      subtitle:
        'HomeCrowd never stores your card number. Only qualifying transaction details are shared, and you can unlink anytime.',
      primaryButton: {
        label: 'Scan card',
        closeOnPress: false,
        onPress: function (closeSheet) {
          startCardScanner();
          scanSheet = null;
          if (typeof closeSheet === 'function') closeSheet();
        },
      },
      secondaryButton: {
        label: 'Enter details manually',
        onPress: function () {
          if (scanSheet) scanSheet.close();
          scanSheet = null;
          focusManualEntry();
        },
      },
      onClose: function () {
        scanSheet = null;
      },
    });
  }

  function setLoading(next) {
    loading = !!next;
    var overlay = container.querySelector('#hc-ac-overlay');
    var btn = container.querySelector('#hc-ac-submit');
    if (overlay) {
      if (loading) overlay.removeAttribute('hidden');
      else overlay.setAttribute('hidden', '');
    }
    if (btn) {
      btn.disabled = loading;
      btn.classList.toggle('hc-add-card-cta--disabled', loading);
      btn.innerHTML = loading
        ? '<span class="hc-add-card-cta-spinner" aria-hidden="true"></span>'
        : 'Link Card';
    }
  }

  function bindForm() {
    var backBtn = container.querySelector('#hc-add-card-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        navigate('/cards');
      });
    }

    var nameEl = container.querySelector('#hc-ac-name');
    var numberEl = container.querySelector('#hc-ac-number');
    var expiryEl = container.querySelector('#hc-ac-expiry');
    var cvcEl = container.querySelector('#hc-ac-cvc');
    var cameraBtn = container.querySelector('#hc-ac-camera');
    var form = container.querySelector('#hc-add-card-form');
    var submitBtn = container.querySelector('#hc-ac-submit');

    if (nameEl) {
      nameEl.addEventListener('input', function () {
        state.cardholderName = nameEl.value;
      });
    }
    if (numberEl) {
      numberEl.addEventListener('input', function () {
        var v = formatCardNumber(numberEl.value);
        if (numberEl.value !== v) numberEl.value = v;
        state.cardNumber = v;
      });
    }
    if (expiryEl) {
      expiryEl.addEventListener('input', function () {
        var parsed = parseExpiry(expiryEl.value);
        state.expiryMonth = parsed.month;
        state.expiryYear = parsed.year;
        var display = expiryDisplay(parsed.month, parsed.year);
        if (expiryEl.value !== display) expiryEl.value = display;
      });
    }
    if (cvcEl) {
      cvcEl.addEventListener('input', function () {
        var v = String(cvcEl.value || '')
          .replace(/\D/g, '')
          .substring(0, 4);
        if (cvcEl.value !== v) cvcEl.value = v;
        state.cvc = v;
      });
    }
    if (cameraBtn) {
      cameraBtn.addEventListener('click', function () {
        startCardScanner();
      });
    }
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
      });
    }

    var termsBtn = container.querySelector('#hc-ac-terms');
    var privacyBtn = container.querySelector('#hc-ac-privacy');
    function openLegalPage(url) {
      var next = String(url || '').trim();
      if (!next) return;
      showWebviewOverlay(next, {
        onFallback: function () {
          window.open(next, '_blank', 'noopener,noreferrer');
        },
      });
    }
    if (termsBtn) {
      termsBtn.addEventListener('click', function (e) {
        e.preventDefault();
        openLegalPage(getTermsUrl());
      });
    }
    if (privacyBtn) {
      privacyBtn.addEventListener('click', function (e) {
        e.preventDefault();
        openLegalPage(getPrivacyUrl());
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', async function () {
        if (loading) return;
        if (!validateCard(state)) return;
        setLoading(true);
        try {
          var alreadyHadCard = await hasActiveLinkedCard();

          try {
            await api.createOliveMember();
          } catch (memberErr) {
            var msg = String((memberErr && memberErr.message) || '');
            var status = memberErr && memberErr.status;
            if (
              status !== 409 &&
              status !== 200 &&
              msg.indexOf('already exists') < 0 &&
              !(memberErr && memberErr.body && memberErr.body.existing_member)
            ) {
              throw memberErr;
            }
          }

          var addResult = await api.addCardDirect({
            cardNumber: state.cardNumber,
            expiryMonth: state.expiryMonth,
            expiryYear: state.expiryYear,
            cvv: state.cvc,
            cardholderName: String(state.cardholderName || '').trim(),
          });

          if (!addResult || addResult.success !== true) {
            var er = new Error((addResult && addResult.error) || 'Backend API returned failure');
            er.status = 400;
            er.body = addResult;
            throw er;
          }

          var awardedPoints = null;
          if (!alreadyHadCard) {
            var backendReward = addResult.setup_reward || addResult.setupReward;
            if (backendReward && backendReward.awarded && backendReward.points > 0) {
              awardedPoints = backendReward.points;
            } else {
              try {
                var result = await claimSetupTaskReward('linkCard');
                if (result && result.awarded && result.points > 0) {
                  awardedPoints = result.points;
                }
              } catch (_claimErr) {}
            }
          }

          setLoading(false);
          closeCardScanner();
          if (scanSheet) {
            scanSheet.close();
            scanSheet = null;
          }
          successCleanup = renderSuccess(container, awardedPoints);
        } catch (err) {
          setLoading(false);
          if (err.status === 400 && err.body && err.body.error_code === 'CARD_ALREADY_LINKED') {
            showError('This card is already linked to another user');
          } else if (err.status === 400) {
            showError((err.body && err.body.error) || err.message || 'Invalid card data');
          } else {
            showError(
              (err.body && (err.body.message || err.body.error)) ||
                err.message ||
                'Failed to link your card. Please try again.'
            );
          }
        }
      });
    }
  }

  mountForm();

  return function cleanup() {
    closeCardScanner();
    if (scanSheet) {
      try {
        scanSheet.close();
      } catch (_e) {}
      scanSheet = null;
    }
    if (typeof successCleanup === 'function') {
      successCleanup();
      successCleanup = null;
    }
  };
}
