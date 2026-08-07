import * as api from '../api.js';
import { navigate } from '../router.js';
import { escapeAttr, escapeHtml } from '../base-components/html.js';
import { normalizeMilestones } from '../components/Dashboard/PointsMilestonesCard.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import { showSuccess } from '../base-components/toastApi.js';
import { formatPhoneNumber, isValidEmail, isValidPhone } from '../contact-validation.js';
import { getHeaderLogoUrl, hasCustomHeaderLogo } from '../brand.js';
import wordmarkUrl from '../assets/logos/homecrowd-wordmark.svg';
import giftUrl from '../assets/gift.svg';
import glowUrl from '../assets/reward-glow.png';

var METHOD_SMS = 'sms';
var METHOD_EMAIL = 'email';

function formatNumber(value) {
  return (Number(value) || 0).toLocaleString('en-US');
}

/**
 * The school's embed header logo when the program has one, otherwise the
 * Homecrowd wordmark. Note this deliberately does not fall back to
 * getHeaderLogoUrl()'s own default — that asset is the light-background
 * lockup, which would be invisible on this screen's dark field.
 */
function buildLogoHtml() {
  var custom = hasCustomHeaderLogo();
  return (
    '<img class="hc-fr-redeem-wordmark' +
    (custom ? ' hc-fr-redeem-wordmark--custom' : '') +
    '" src="' +
    escapeAttr(custom ? getHeaderLogoUrl() : wordmarkUrl) +
    '" alt="' +
    (custom ? '' : 'Homecrowd') +
    '" />'
  );
}

function buildHtml(milestone) {
  var title = milestone.title || 'Your reward';

  return (
    '<div class="hc-fr-redeem">' +
    buildLogoHtml() +
    '<div class="hc-fr-redeem-copy">' +
    '<p class="hc-fr-redeem-eyebrow">Reward unlocked!</p>' +
    '<h1 class="hc-fr-redeem-title">' +
    escapeHtml(title) +
    '</h1>' +
    '<p class="hc-fr-redeem-body">' +
    escapeHtml(
      "You've reached " +
        formatNumber(milestone.pointsCost) +
        ' points. ' +
        title +
        ' is ready to redeem.'
    ) +
    '</p>' +
    '</div>' +
    '<div class="hc-fr-redeem-art">' +
    '<img class="hc-fr-redeem-glow" src="' +
    escapeAttr(glowUrl) +
    '" alt="" aria-hidden="true" />' +
    '<img class="hc-fr-redeem-gift" src="' +
    escapeAttr(giftUrl) +
    '" alt="" aria-hidden="true" />' +
    '</div>' +
    '<form class="hc-fr-redeem-form" novalidate>' +
    '<p class="hc-fr-redeem-form-label">How should we reach you to arrange it?</p>' +
    '<div class="hc-fr-redeem-methods" role="radiogroup" aria-label="Preferred contact method">' +
    '<button type="button" class="hc-fr-redeem-method is-selected" role="radio" ' +
    'aria-checked="true" data-method="' +
    METHOD_SMS +
    '">Text me</button>' +
    '<button type="button" class="hc-fr-redeem-method" role="radio" ' +
    'aria-checked="false" data-method="' +
    METHOD_EMAIL +
    '">Email me</button>' +
    '</div>' +
    '<input class="hc-fr-redeem-input" id="hc-fr-redeem-input" type="tel" ' +
    'inputmode="numeric" autocomplete="tel" maxlength="14" ' +
    'placeholder="(555) 555-5555" aria-label="Phone number" />' +
    '<p class="hc-fr-redeem-error" id="hc-fr-redeem-error" role="alert" hidden></p>' +
    '</form>' +
    '<div class="hc-fr-redeem-actions">' +
    '<button type="button" class="hc-fr-redeem-primary" data-fr-redeem="1">Redeem</button>' +
    '<button type="button" class="hc-fr-redeem-secondary" data-fr-later="1">Maybe later</button>' +
    '</div>' +
    '</div>'
  );
}

function buildUnavailableHtml(message) {
  return (
    '<div class="hc-fr-redeem">' +
    buildLogoHtml() +
    '<div class="hc-fr-redeem-copy">' +
    '<p class="hc-fr-redeem-body">' +
    escapeHtml(message) +
    '</p>' +
    '</div>' +
    '<div class="hc-fr-redeem-actions">' +
    '<button type="button" class="hc-fr-redeem-primary" data-fr-later="1">Back</button>' +
    '</div>' +
    '</div>'
  );
}

/**
 * Full-bleed "Reward unlocked!" screen for a first-reward rung. Collects how the
 * student wants to be contacted and claims the reward — this is the only step
 * in the flow, so Redeem here is what actually writes the redemption.
 *
 * The rung is re-fetched by id rather than handed in from the home screen, so
 * the URL is shareable and survives a refresh. The unlocked check is repeated
 * here because the route is reachable directly, not only via the ladder.
 *
 * @param {HTMLElement} container
 * @param {string} rewardId
 * @param {{ returnTo?: string }} [options] where to go after claiming or backing out
 */
export async function renderFirstRewardRedemption(container, rewardId, options) {
  options = options || {};
  var returnTo = options.returnTo === '/rewards' ? '/rewards' : '/home';
  container.innerHTML = LoadingSpinner({ text: 'Loading reward...' });

  var milestone = null;
  try {
    // One rung, not the whole ladder.
    var payload = await api.getFirstReward(rewardId);
    milestone = normalizeMilestones([payload.milestone])[0] || null;
  } catch (_e) {
    container.innerHTML = buildUnavailableHtml(
      "We couldn't load this reward. Please try again."
    );
    bindBack(container, returnTo);
    return;
  }

  if (!milestone) {
    container.innerHTML = buildUnavailableHtml('This reward is no longer available.');
    bindBack(container, returnTo);
    return;
  }
  if (!milestone.unlocked) {
    container.innerHTML = buildUnavailableHtml(
      'You need ' + formatNumber(milestone.pointsCost) + ' points to unlock this reward.'
    );
    bindBack(container, returnTo);
    return;
  }
  if (milestone.redeemed) {
    container.innerHTML = buildUnavailableHtml(
      "You've already redeemed " + (milestone.title || 'this reward') + '.'
    );
    bindBack(container, returnTo);
    return;
  }

  container.innerHTML = buildHtml(milestone);
  bindForm(container, milestone, returnTo);
}

function bindBack(container, returnTo) {
  var back = container.querySelector('[data-fr-later]');
  if (back) {
    back.addEventListener('click', function () {
      navigate(returnTo);
    });
  }
}

function bindForm(container, milestone, returnTo) {
  var input = container.querySelector('#hc-fr-redeem-input');
  var errorEl = container.querySelector('#hc-fr-redeem-error');
  var redeemBtn = container.querySelector('[data-fr-redeem]');
  var method = METHOD_SMS;
  var submitting = false;

  bindBack(container, returnTo);

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }

  container.querySelectorAll('[data-method]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = btn.getAttribute('data-method');
      if (next === method) return;
      method = next;
      showError('');

      container.querySelectorAll('[data-method]').forEach(function (other) {
        var selected = other === btn;
        other.classList.toggle('is-selected', selected);
        other.setAttribute('aria-checked', selected ? 'true' : 'false');
      });

      // A phone number is never a valid email and vice versa, so carrying the
      // old value across a switch only ever leaves something to delete.
      input.value = '';

      if (method === METHOD_EMAIL) {
        input.type = 'email';
        input.inputMode = 'email';
        input.autocomplete = 'email';
        input.placeholder = 'you@school.edu';
        input.removeAttribute('maxlength');
        input.setAttribute('aria-label', 'Email address');
      } else {
        input.type = 'tel';
        input.inputMode = 'numeric';
        input.autocomplete = 'tel';
        input.placeholder = '(555) 555-5555';
        // "(123) 456-7890" is 14 characters.
        input.setAttribute('maxlength', '14');
        input.setAttribute('aria-label', 'Phone number');
      }
      input.focus();
    });
  });

  input.addEventListener('input', function () {
    // Format the number as it's typed, matching the profile phone field.
    if (method === METHOD_SMS) {
      input.value = formatPhoneNumber(input.value);
    }
    showError('');
  });

  redeemBtn.addEventListener('click', async function () {
    if (submitting) return;
    var value = (input.value || '').trim();

    // Mirror of the server's rules, so the common mistakes don't need a round
    // trip. The server revalidates regardless.
    if (!value) {
      showError(method === METHOD_SMS ? 'Enter a phone number.' : 'Enter an email address.');
      input.focus();
      return;
    }
    if (method === METHOD_EMAIL && !isValidEmail(value)) {
      showError('Enter a valid email address, like you@school.edu.');
      input.focus();
      return;
    }
    if (method === METHOD_SMS && !isValidPhone(value)) {
      showError('Enter a valid 10-digit US phone number.');
      input.focus();
      return;
    }

    submitting = true;
    redeemBtn.disabled = true;
    redeemBtn.textContent = 'Redeeming...';
    showError('');

    try {
      await api.redeemFirstReward(milestone.id, {
        contactMethod: method,
        contactValue: value,
      });
      navigate(returnTo);
      showSuccess('Redemption successful');
    } catch (err) {
      submitting = false;
      redeemBtn.disabled = false;
      redeemBtn.textContent = 'Redeem';
      // request() already flattens DRF's error/detail/field-array shapes into
      // the message.
      showError((err && err.message) || "That didn't go through. Please try again.");
    }
  });
}

export default { renderFirstRewardRedemption };
