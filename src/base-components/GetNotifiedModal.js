import { openBottomSheet } from './BottomSheetModal.js';
import { escapeAttr, escapeHtml } from './html.js';
import mailTwoUrl from '../assets/icons/mail_two.png';
import { isValidEmail } from '../contact-validation.js';

function formHtml(error) {
  return (
    '<div class="hc-get-notified-form">' +
    '<label class="hc-get-notified-label" for="hc-get-notified-email">Email adress</label>' +
    '<div class="hc-get-notified-input-wrap' +
    (error ? ' hc-get-notified-input-wrap--error' : '') +
    '">' +
    '<input type="email" id="hc-get-notified-email" class="hc-get-notified-input" placeholder="Email" autocomplete="email" autocapitalize="none" autocorrect="off" />' +
    '</div>' +
    (error
      ? '<p class="hc-get-notified-error">' + escapeHtml(error) + '</p>'
      : '<p class="hc-get-notified-error" style="display:none"></p>') +
    '</div>'
  );
}

/**
 * @param {{ schoolName?: string, onSubmit: function(string): Promise, onSuccess?: function(string), onClose?: function }} options
 */
export function openGetNotifiedModal(options) {
  options = options || {};
  var schoolName = options.schoolName || 'your school';
  var sheet = null;

  function setError(msg) {
    if (!sheet) return;
    var wrap = sheet.root.querySelector('.hc-get-notified-input-wrap');
    var errEl = sheet.root.querySelector('.hc-get-notified-error');
    if (wrap) {
      wrap.classList.toggle('hc-get-notified-input-wrap--error', !!msg);
    }
    if (errEl) {
      if (msg) {
        errEl.textContent = msg;
        errEl.style.display = '';
      } else {
        errEl.textContent = '';
        errEl.style.display = 'none';
      }
    }
  }

  sheet = openBottomSheet({
    keyboardAvoiding: true,
    iconHtml:
      '<img data-hc-ph="none" src="' +
      escapeAttr(mailTwoUrl) +
      '" alt="" class="hc-get-notified-mail-icon" />',
    title: 'Get notified',
    subtitle:
      "We'll email you when HomeCrowd arrives at " + schoolName + '.',
    bodyHtml: formHtml(''),
    onClose: options.onClose,
    primaryButton: {
      label: 'Notify me',
      closeOnPress: false,
      onPress: function (close) {
        var input = sheet.root.querySelector('#hc-get-notified-email');
        var trimmed = input ? String(input.value || '').trim() : '';
        if (!isValidEmail(trimmed)) {
          setError('Please enter a valid email');
          return;
        }
        sheet.setPrimaryLoading(true);
        setError('');
        Promise.resolve()
          .then(function () {
            return options.onSubmit(trimmed);
          })
          .then(function () {
            sheet.setPrimaryLoading(false);
            close(function () {
              if (typeof options.onSuccess === 'function') {
                options.onSuccess(schoolName);
              }
            });
          })
          .catch(function (err) {
            var message =
              (err && err.message) ||
              'Unable to save your email. Please try again.';
            setError(message);
            sheet.setPrimaryLoading(false);
          });
      },
    },
  });

  var input = sheet.root.querySelector('#hc-get-notified-email');
  if (input) {
    input.addEventListener('input', function () {
      setError('');
    });
    window.setTimeout(function () {
      input.focus();
    }, 300);
  }

  return sheet;
}

export default { openGetNotifiedModal };
