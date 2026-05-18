import lottie from 'lottie-web';
import confettiAnimation from './assets/Confetti.json';

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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function showDailyLoginBonusModal(dailyBonus) {
  if (!hasDailyLoginBonus(dailyBonus)) return false;

  var points = Number(dailyBonus.points_awarded) || 0;
  var tickets = Number(dailyBonus.tickets_awarded) || 0;
  var raffleTitles = dedupeRaffleTitles(dailyBonus.raffle_titles);
  var entries = Number(dailyBonus.entries_awarded) || raffleTitles.length;
  var message = dailyBonus.message || 'You received a daily bonus!';

  var rewardsHtml = '';
  if (points > 0) {
    rewardsHtml += '<div class="hc-daily-bonus-pill">+' + escapeHtml(String(points)) + ' points</div>';
  }
  if (tickets > 0) {
    rewardsHtml +=
      '<div class="hc-daily-bonus-pill">+' +
      escapeHtml(String(tickets)) +
      ' raffle ticket' +
      (tickets === 1 ? '' : 's') +
      '</div>';
  }

  var rafflesHtml = '';
  if (raffleTitles.length > 0) {
    rafflesHtml += '<div class="hc-daily-bonus-raffles">';
    rafflesHtml +=
      '<div class="hc-daily-bonus-raffles-title">Entered into ' +
      (entries === 1 ? '1 raffle' : entries + ' raffles') +
      '</div>';
    rafflesHtml += '<ul class="hc-daily-bonus-raffle-list">';
    raffleTitles.forEach(function (title) {
      rafflesHtml += '<li>' + escapeHtml(title) + '</li>';
    });
    rafflesHtml += '</ul></div>';
  }

  var overlay = document.createElement('div');
  overlay.className = 'hc-daily-bonus-modal-root';
  overlay.innerHTML =
    '<div class="hc-daily-bonus-backdrop" data-daily-bonus-close="1"></div>' +
    '<div class="hc-daily-bonus-card">' +
    '<div class="hc-daily-bonus-badge">Daily Bonus</div>' +
    '<div class="hc-daily-bonus-title">You\'re all set for today</div>' +
    '<div class="hc-daily-bonus-message">' +
    escapeHtml(message) +
    '</div>' +
    rewardsHtml +
    rafflesHtml +
    '<button type="button" class="hc-daily-bonus-button" data-daily-bonus-close="1">Awesome!</button>' +
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
