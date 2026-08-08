import { escapeHtml } from '../../base-components/html.js';
import checkmarkSvg from '../../assets/icons/checkmark.svg?raw';
import { getDefaultSetupRewardPoints } from '../../setup-rewards.js';

var BASE_STEPS = [
  {
    key: 'profile',
    label: 'Create your profile',
    doneLabel: 'Profile created',
    pointsKey: 'profile',
    description: null,
    cta: null,
  },
  {
    key: 'linkCard',
    label: 'Activate Card Earning',
    doneLabel: 'Card Earning activated',
    pointsKey: 'linkCard',
    description: 'Takes about a minute. Your card number is never stored.',
    cta: 'Link my card',
  },
  {
    key: 'safariExtension',
    label: 'Activate Safari Spending',
    doneLabel: 'Safari Spending activated',
    pointsKey: 'safariExtension',
    description: 'Takes about a minute. Earn points when you shop online.',
    cta: 'Activate',
  },
];

function getSetupSteps(includeSafari) {
  var steps = includeSafari
    ? BASE_STEPS.slice()
    : BASE_STEPS.filter(function (step) {
        return step.key !== 'safariExtension';
      });
  return steps.map(function (step, index) {
    return Object.assign({}, step, { number: index + 1 });
  });
}

/**
 * @param {{
 *   profileDone?: boolean,
 *   linkCardDone?: boolean,
 *   safariDone?: boolean,
 *   includeSafari?: boolean,
 *   rewardPoints?: { profile?: number, linkCard?: number, safariExtension?: number },
 * }} props
 */
export function buildUnlockSetupSectionHtml(props) {
  props = props || {};
  var includeSafari = props.includeSafari !== false;
  var points = props.rewardPoints || getDefaultSetupRewardPoints();
  var doneMap = {
    profile: props.profileDone !== false,
    linkCard: !!props.linkCardDone,
    safariExtension: !!props.safariDone,
  };
  var steps = getSetupSteps(includeSafari);

  var stepsHtml = steps.map(function (step) {
    var done = !!doneMap[step.key];
    var stepPoints = points[step.pointsKey] != null ? points[step.pointsKey] : 0;
    var canExpand = !done && (step.key === 'linkCard' || step.key === 'safariExtension');
    var label = done ? step.doneLabel : step.label;
    var iconHtml = done
      ? '<span class="hc-unlock-setup-done" aria-hidden="true">' + checkmarkSvg + '</span>'
      : '<span class="hc-unlock-setup-num" aria-hidden="true">' +
        escapeHtml(String(step.number)) +
        '</span>';

    var bodyHtml = '';
    if (canExpand) {
      bodyHtml =
        '<div class="hc-unlock-setup-body">' +
        '<div class="hc-unlock-setup-body-inner">' +
        (step.description
          ? '<p class="hc-unlock-setup-desc">' + escapeHtml(step.description) + '</p>'
          : '') +
        (step.cta
          ? '<button type="button" class="hc-unlock-setup-cta" data-unlock-cta="' +
            escapeHtml(step.key) +
            '">' +
            escapeHtml(step.cta) +
            '</button>'
          : '') +
        '</div>' +
        '</div>';
    }

    var dataAttr = canExpand ? ' data-unlock-step="' + escapeHtml(step.key) + '"' : '';
    var roleAttr = canExpand ? ' role="button" tabindex="0"' : '';

    return (
      '<div' +
      dataAttr +
      roleAttr +
      ' class="hc-unlock-setup-card' +
      (canExpand ? ' hc-unlock-setup-card--expandable' : '') +
      '">' +
      '<div class="hc-unlock-setup-header">' +
      iconHtml +
      '<span class="hc-unlock-setup-label">' +
      escapeHtml(label) +
      '</span>' +
      '<span class="hc-unlock-setup-pts">+ ' +
      escapeHtml(String(stepPoints)) +
      ' pts</span>' +
      '</div>' +
      bodyHtml +
      '</div>'
    );
  }).join('');

  return (
    // The heading lives in the welcome block above this list now, so the two
    // don't stack.
    '<div class="hc-unlock-setup">' +
    '<div class="hc-unlock-setup-list">' +
    stepsHtml +
    '</div>' +
    '</div>'
  );
}

/**
 * @param {HTMLElement} root
 * @param {{ onPressLinkCard?: function, onPressSafari?: function }} handlers
 */
export function bindUnlockSetupSection(root, handlers) {
  handlers = handlers || {};
  if (!root) return;

  var EXPAND_MS = 220;

  function animateBody(card, open) {
    var body = card.querySelector('.hc-unlock-setup-body');
    if (!body) return;

    if (body._hcExpandEnd) {
      body.removeEventListener('transitionend', body._hcExpandEnd);
      body._hcExpandEnd = null;
    }

    var from = open ? 0 : body.scrollHeight;
    if (!open && body.style.height === 'auto') {
      from = body.scrollHeight;
    }
    var to = open ? null : 0;

    body.style.overflow = 'hidden';
    body.style.transition = 'none';
    body.style.height = from + 'px';
    body.offsetHeight;

    if (open) {
      card.classList.add('hc-unlock-setup-card--open');
      to = body.scrollHeight;
    }

    body.style.transition = 'height ' + EXPAND_MS + 'ms ease';
    body.style.height = to + 'px';

    var onEnd = function (e) {
      if (e && e.propertyName && e.propertyName !== 'height') return;
      if (e && e.target !== body) return;
      body.removeEventListener('transitionend', onEnd);
      body._hcExpandEnd = null;
      if (open) {
        body.style.height = 'auto';
        body.style.overflow = '';
      } else {
        card.classList.remove('hc-unlock-setup-card--open');
        body.style.height = '0px';
        body.style.overflow = 'hidden';
      }
      body.style.transition = '';
    };
    body._hcExpandEnd = onEnd;
    body.addEventListener('transitionend', onEnd);
  }

  function closeCard(card) {
    if (!card.classList.contains('hc-unlock-setup-card--open')) return;
    animateBody(card, false);
  }

  function openCard(card) {
    root.querySelectorAll('.hc-unlock-setup-card--open').forEach(function (el) {
      if (el !== card) closeCard(el);
    });
    if (card.classList.contains('hc-unlock-setup-card--open')) return;
    animateBody(card, true);
  }

  function toggleCard(card) {
    if (card.classList.contains('hc-unlock-setup-card--open')) {
      closeCard(card);
    } else {
      openCard(card);
    }
  }

  root.querySelectorAll('[data-unlock-step]').forEach(function (card) {
    var body = card.querySelector('.hc-unlock-setup-body');
    if (body) {
      body.style.height = '0px';
      body.style.overflow = 'hidden';
    }
    card.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('[data-unlock-cta]')) {
        return;
      }
      toggleCard(card);
    });
    card.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target && e.target.closest && e.target.closest('[data-unlock-cta]')) {
        return;
      }
      e.preventDefault();
      toggleCard(card);
    });
  });

  root.querySelectorAll('[data-unlock-cta]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var key = btn.getAttribute('data-unlock-cta');
      if (key === 'linkCard' && typeof handlers.onPressLinkCard === 'function') {
        handlers.onPressLinkCard();
      }
      if (key === 'safariExtension' && typeof handlers.onPressSafari === 'function') {
        handlers.onPressSafari();
      }
    });
  });
}

export default { buildUnlockSetupSectionHtml, bindUnlockSetupSection };
