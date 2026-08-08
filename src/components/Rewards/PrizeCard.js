import { escapeAttr, escapeHtml } from '../../base-components/html.js';
import { buildPrizeCountdownLabel } from '../../weekly-reward.js';
import stopwatchSvg from '../../assets/icon-stopwatch.svg?raw';
import calendarSvg from '../../assets/icon-calendar.svg?raw';

/**
 * Full-bleed prize card used for the weekly and season (overall) leaderboard
 * rewards on the rewards screen. Both share one shape; only the label, the
 * status pill's icon, and its text differ.
 *
 * @param {{
 *   kind?: 'weekly'|'overall',
 *   title?: string,
 *   imageUrl?: string,
 *   statusText?: string,
 *   rewardId?: string,
 *   targetMs?: number, when the period ends, so the status text can tick
 * }} props
 */
export function buildPrizeCardHtml(props) {
  props = props || {};
  var overall = props.kind === 'overall';
  var label = overall ? 'Season Prize' : 'Weekly Prize';
  // Weekly counts down, the season ends on a date — hence the different glyphs.
  var icon = overall ? calendarSvg : stopwatchSvg;

  // The target rides on the element so bindPrizeCardCountdowns can retime it
  // every second without the view re-rendering the card.
  var targetAttr = Number.isFinite(Number(props.targetMs))
    ? ' data-prize-countdown-target="' + escapeAttr(String(props.targetMs)) + '"'
    : '';

  var statusHtml = props.statusText
    ? '<div class="hc-prize-card-status">' +
      '<span class="hc-prize-card-status-icon">' +
      icon +
      '</span>' +
      '<span class="hc-prize-card-status-text"' +
      targetAttr +
      '>' +
      escapeHtml(String(props.statusText)) +
      '</span>' +
      '</div>'
    : '';

  return (
    '<button type="button" class="hc-prize-card" data-prize-card="1" data-prize-kind="' +
    escapeAttr(overall ? 'overall' : 'weekly') +
    '" data-prize-reward-id="' +
    escapeAttr(String(props.rewardId || '')) +
    '">' +
    (props.imageUrl
      ? '<img class="hc-prize-card-img" src="' +
        escapeAttr(String(props.imageUrl)) +
        '" alt="" />'
      : '<span class="hc-prize-card-img hc-prize-card-img--ph"></span>') +
    '<span class="hc-prize-card-scrim" aria-hidden="true"></span>' +
    '<span class="hc-prize-card-label">' +
    '<span class="hc-prize-card-dot" aria-hidden="true"></span>' +
    escapeHtml(label) +
    '</span>' +
    statusHtml +
    '<span class="hc-prize-card-title">' +
    escapeHtml(String(props.title || '')) +
    '</span>' +
    '</button>'
  );
}

/**
 * @param {HTMLElement} root
 * @param {{ onPress?: function(string, string) }} options receives (rewardId, kind)
 */
export function bindPrizeCards(root, options) {
  options = options || {};
  if (!root) return;
  root.querySelectorAll('[data-prize-card]').forEach(function (card) {
    card.addEventListener('click', function () {
      if (typeof options.onPress !== 'function') return;
      options.onPress(
        card.getAttribute('data-prize-reward-id') || '',
        card.getAttribute('data-prize-kind') || 'weekly'
      );
    });
  });
}

/**
 * Ticks each prize card's "Ends in: 6d 12h 30m 5s" label once a second so the
 * seconds actually run down. Safe to call on a container with no prize cards.
 *
 * @param {HTMLElement} root
 * @returns {function} stops the timer
 */
export function bindPrizeCardCountdowns(root) {
  var noop = function () {};
  if (!root || !root.querySelectorAll) return noop;
  var nodes = Array.prototype.slice.call(
    root.querySelectorAll('[data-prize-countdown-target]'),
  );
  if (!nodes.length) return noop;

  var timer = null;
  function stop() {
    if (timer != null) window.clearInterval(timer);
    timer = null;
  }

  function update() {
    // A re-rendered view leaves this timer holding detached nodes.
    if (!root.isConnected) {
      stop();
      return;
    }
    nodes.forEach(function (node) {
      var targetMs = Number(node.getAttribute('data-prize-countdown-target'));
      if (!Number.isFinite(targetMs)) return;
      var label = buildPrizeCountdownLabel({ targetMs: targetMs });
      if (label && node.textContent !== label) node.textContent = label;
    });
  }

  update();
  timer = window.setInterval(update, 1000);
  return stop;
}

export default { buildPrizeCardHtml, bindPrizeCards, bindPrizeCardCountdowns };
