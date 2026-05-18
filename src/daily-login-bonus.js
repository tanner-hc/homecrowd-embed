import lottie from 'lottie-web';
import confettiAnimation from './assets/Confetti.json';
import MainButton from './base-components/MainButton.js';
import { escapeHtml } from './base-components/html.js';

function dedupeRaffleTitles(titles) {
  if (!Array.isArray(titles)) return [];
  var seen = {};
  var out = [];
  titles.forEach(function (title) {
    var trimmed = title != null ? String(title).trim() : '';
    if (!trimmed) return;
    var key = trimmed.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    out.push(trimmed);
  });
  return out;
}

export function hasDailyLoginBonus(dailyBonus) {
  if (!dailyBonus || dailyBonus.already_claimed) return false;
  var points = Number(dailyBonus.points_awarded) || 0;
  var tickets = Number(dailyBonus.tickets_awarded) || 0;
  var entries = Number(dailyBonus.entries_awarded) || 0;
  var raffleTitles = dedupeRaffleTitles(dailyBonus.raffle_titles);
  return points > 0 || tickets > 0 || entries > 0 || raffleTitles.length > 0;
}

function summarizeDailyLoginBonus(bonus) {
  var points = Number(bonus && bonus.points_awarded) || 0;
  var tickets = Number(bonus && bonus.tickets_awarded) || 0;
  var raffleTitles = dedupeRaffleTitles(bonus && bonus.raffle_titles);
  var entries = Number(bonus && bonus.entries_awarded) || raffleTitles.length;
  return {
    message: (bonus && bonus.message) || 'You received a daily bonus!',
    points: points,
    tickets: tickets,
    entries: entries,
    raffleTitles: raffleTitles,
  };
}

export function showDailyLoginBonusModal(dailyBonus) {
  if (!hasDailyLoginBonus(dailyBonus)) return false;

  var summary = summarizeDailyLoginBonus(dailyBonus);
  var rewardsHtml = '';

  if (summary.points > 0) {
    rewardsHtml +=
      '<div class="hc-daily-bonus-pill">+' +
      escapeHtml(String(summary.points)) +
      ' points</div>';
  }
  if (summary.tickets > 0) {
    rewardsHtml +=
      '<div class="hc-daily-bonus-pill">+' +
      escapeHtml(String(summary.tickets)) +
      ' raffle ticket' +
      (summary.tickets === 1 ? '' : 's') +
      '</div>';
  }

  var rafflesHtml = '';
  if (summary.raffleTitles.length > 0) {
    var scrollClass =
      summary.raffleTitles.length > 4 ? ' hc-daily-bonus-raffle-scroll--tall' : '';
    rafflesHtml += '<div class="hc-daily-bonus-raffles">';
    rafflesHtml +=
      '<div class="hc-daily-bonus-raffles-title">Entered into ' +
      (summary.entries === 1 ? '1 raffle' : summary.entries + ' raffles') +
      '</div>';
    rafflesHtml += '<div class="hc-daily-bonus-raffle-scroll' + scrollClass + '">';
    summary.raffleTitles.forEach(function (title) {
      rafflesHtml += '<div class="hc-daily-bonus-raffle-row">';
      rafflesHtml += '<span class="hc-daily-bonus-raffle-bullet" aria-hidden="true">•</span>';
      rafflesHtml +=
        '<span class="hc-daily-bonus-raffle-title-text">' + escapeHtml(title) + '</span>';
      rafflesHtml += '</div>';
    });
    rafflesHtml += '</div></div>';
  }

  var buttonHtml = MainButton({
    text: 'Awesome',
    className: 'hc-daily-bonus-main-btn',
  });

  var overlay = document.createElement('div');
  overlay.className = 'hc-daily-bonus-modal-root';
  overlay.innerHTML =
    '<div class="hc-daily-bonus-backdrop" data-daily-bonus-close="1"></div>' +
    '<div class="hc-daily-bonus-card">' +
    '<div class="hc-daily-bonus-badge">Daily Bonus</div>' +
    '<div class="hc-daily-bonus-title">You\'re all set for today</div>' +
    '<div class="hc-daily-bonus-message">' +
    escapeHtml(summary.message) +
    '</div>' +
    rewardsHtml +
    rafflesHtml +
    buttonHtml +
    '</div>' +
    '<div class="hc-daily-bonus-confetti-layer" aria-hidden="true"></div>';

  var animation = null;

  function close() {
    if (animation) {
      animation.destroy();
      animation = null;
    }
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  overlay.addEventListener('click', function (e) {
    if (e.target && e.target.closest('[data-daily-bonus-close]')) close();
  });

  document.body.appendChild(overlay);

  var closeBtn = overlay.querySelector('.hc-daily-bonus-main-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      close();
    });
  }

  var confettiEl = overlay.querySelector('.hc-daily-bonus-confetti-layer');
  if (confettiEl) {
    animation = lottie.loadAnimation({
      container: confettiEl,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      animationData: confettiAnimation,
    });
  }

  return true;
}
