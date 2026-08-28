import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import MainButton from '../base-components/MainButton.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';
import settingsIconSvg from '../assets/icons/settings.svg?raw';
import { pickSchoolLogoUrl } from '../school-contribution.js';
import { renderBrandLockup } from '../brand.js';
import SettingsRow from '../base-components/SettingsRow.js';
import phoneIconSvg from '../assets/icons/settings/phone.svg?raw';
import homecrowdFlagMarkSvg from '../assets/logos/homecrowd-flag-mark.svg?raw';
import profileCardTextureUrl from '../assets/profile-card-texture.png';

function svgAddClass(svgRaw, className) {
  return String(svgRaw).replace(/^<svg\s/i, '<svg class="' + className + '" ');
}

function formatFanId(fanId) {
  if (fanId == null) return 'N/A';
  var s = String(fanId).trim();
  return s !== '' ? s : 'N/A';
}

function pickFanId(user) {
  if (!user || typeof user !== 'object') return '';
  var v = user.fanId != null ? user.fanId : user.fan_id;
  if (v == null) return '';
  var s = String(v).trim();
  return s;
}

function pickDateJoined(user) {
  if (!user || typeof user !== 'object') return null;
  return (
    user.dateJoined ||
    user.date_joined ||
    user.createdAt ||
    user.created_at ||
    null
  );
}

function formatMemberSince(dateString) {
  if (!dateString) return null;
  try {
    var joinDate = new Date(dateString);
    if (!isNaN(joinDate.getTime())) {
      return joinDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  } catch (_e) { }
  return null;
}




function pickGamesAttended(user) {
  if (!user || typeof user !== 'object') return null;
  var v = user.gamesAttended != null ? user.gamesAttended : user.games_attended;
  if (v == null) return null;
  var n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// opts.tightGap  -> the 2px label/value gap the design uses on "games attended"
//                   (the other two rows are 2.538px)
// opts.book      -> "member since" sets its value in Baikal Book at line-height
//                   0.77, where the other two use Condensed Bold at 1.08
function profileStatHtml(label, value, opts) {
  var o = opts || {};
  return (
    '<div class="hc-profile-card-stat' +
    (o.tightGap ? ' hc-profile-card-stat--tight' : '') +
    '">' +
    '<span class="hc-profile-card-stat-label">' +
    escapeHtml(label) +
    '</span>' +
    '<span class="hc-profile-card-stat-value' +
    (o.book ? ' hc-profile-card-stat-value--book' : '') +
    '">' +
    escapeHtml(value) +
    '</span>' +
    '</div>'
  );
}

// The fan card, per the Homecrowd-Share design: navy gradient over a texture,
// name set in extra-condensed caps, the flag mark top-right and the school's
// own crest watermarked behind the stats.
function profileCardHtml(user) {
  var first = (user && (user.firstName || user.first_name)) || '';
  var last = (user && (user.lastName || user.last_name)) || '';
  var name = (first + ' ' + last).trim() || 'Member';

  var memberSince = formatMemberSince(pickDateJoined(user));
  var games = pickGamesAttended(user);

  var stats = profileStatHtml('Fan ID', formatFanId(pickFanId(user)));
  // Rendered only when the API supplies it, so the card never shows a zero
  // that would read as "you have attended no games".
  if (games != null) {
    stats += profileStatHtml('Games attended', String(games), { tightGap: true });
  }
  if (memberSince) {
    stats += profileStatHtml('Member since', memberSince, { book: true });
  }

  var logoUrl = pickSchoolLogoUrl(user);
  var crest = logoUrl
    ? '<img class="hc-profile-card-crest" src="' +
      escapeAttr(logoUrl) +
      '" alt="" aria-hidden="true" />'
    : '';

  return (
    '<div class="hc-profile-card">' +
    '<div class="hc-profile-card-texture" aria-hidden="true" style="background-image:url(' +
    escapeAttr(profileCardTextureUrl) +
    ')"></div>' +
    '<div class="hc-profile-card-body">' +
    '<div class="hc-profile-card-top">' +
    '<p class="hc-profile-card-name">' +
    escapeHtml(name) +
    '</p>' +
    crest +
    '</div>' +
    '<div class="hc-profile-card-bottom">' +
    '<div class="hc-profile-card-stats">' +
    stats +
    '</div>' +
    svgAddClass(homecrowdFlagMarkSvg, 'hc-profile-card-mark') +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

function pickLifetimePoints(user) {
  if (!user || typeof user !== 'object') return null;
  var v = user.lifetimePoints != null ? user.lifetimePoints : user.lifetime_points;
  var n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// /api/olive/listTransactions returns every row for the user, unpaginated and
// unfiltered, so the array length is the real count rather than a page of one.
// Same unwrapping as the dashboard uses, since the endpoint has been seen to
// answer as a bare array, {transactions: []} and {results: []}.
function countTransactions(res) {
  if (!res) return null;
  var list = res.transactions || res.results || res;
  return Array.isArray(list) ? list.length : null;
}

function formatPoints(n) {
  return n == null ? '—' : Number(n).toLocaleString('en-US');
}

function bigStatHtml(label, value) {
  return (
    '<div class="hc-profile-card-bigstat">' +
    '<span class="hc-profile-card-stat-label">' +
    escapeHtml(label) +
    '</span>' +
    '<span class="hc-profile-card-bigstat-value">' +
    escapeHtml(value) +
    '</span>' +
    '</div>'
  );
}

// The card's reverse (design node 1690:8259). The design fills it with
// attendance figures — home games, away games, championships, playoff,
// tournaments — none of which exist in the data, so it carries the numbers the
// API actually returns and keeps the design's shape: two large figures beside a
// column of smaller ones.
function profileCardBackHtml(user, transactionCount) {
  var first = (user && (user.firstName || user.first_name)) || '';
  var last = (user && (user.lastName || user.last_name)) || '';
  var name = (first + ' ' + last).trim() || 'Member';

  return (
    '<div class="hc-profile-card hc-profile-card--back">' +
    '<div class="hc-profile-card-texture" aria-hidden="true" style="background-image:url(' +
    escapeAttr(profileCardTextureUrl) +
    ')"></div>' +
    '<div class="hc-profile-card-body">' +
    '<div class="hc-profile-card-top">' +
    '<p class="hc-profile-card-name">' +
    escapeHtml(name) +
    '<span class="hc-profile-card-name-sub">Fan Stats</span>' +
    '</p>' +
    '</div>' +
    // Only the figures the front does not already carry, so the two faces
    // are worth swiping between. The mark sits beside them, bottom-right, as
    // it does on the front.
    '<div class="hc-profile-card-bottom">' +
    '<div class="hc-profile-card-backstats">' +
    bigStatHtml('Lifetime points', formatPoints(pickLifetimePoints(user))) +
    bigStatHtml('Transactions', formatPoints(transactionCount)) +
    '</div>' +
    svgAddClass(homecrowdFlagMarkSvg, 'hc-profile-card-mark') +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

// Design node 1690:7377 — "Profile" beside a settings gear, on the same
// gutter as the rest of the page.
function profileHeaderHtml() {
  return (
    '<div class="hc-profile-header">' +
    '<h1 class="hc-profile-header-title">Profile</h1>' +
    '<button type="button" class="hc-profile-header-settings" ' +
    'id="hc-profile-header-settings" aria-label="Account settings">' +
    svgAddClass(settingsIconSvg, 'hc-profile-header-settings-icon') +
    '</button>' +
    '</div>'
  );
}



export function renderProfile(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading profile...' });
  loadProfile(container);
}

async function loadProfile(container) {
  var embedUser;
  var profileUser = null;
  try {
    embedUser = await api.fetchCurrentUser();
  } catch (err) {
    container.innerHTML =
      '<div class="hc-alert-error">' + escapeHtml(err.message || 'Failed to load profile') + '</div>';
    return;
  }
  try {
    profileUser = await api.getUserProfile();
  } catch (_e) {
    profileUser = null;
  }

  var transactionCount = null;
  try {
    transactionCount = countTransactions(await api.getOliveTransactions());
  } catch (_e) {
    // The card's other face is still worth showing, so a failure here leaves
    // the figure blank rather than taking the profile down.
    transactionCount = null;
  }

  var cardUser = profileUser || embedUser;
  var html = '';
  html += '<div id="hc-profile-root" class="hc-profile-view">';
  html += '<div class="hc-profile-sticky-head">';
  html += profileHeaderHtml();
  html += '<div class="hc-profile-cards">';
  html += '<div class="hc-profile-flip" id="hc-profile-flip" tabindex="0" ' +
    'role="button" aria-label="Fan card. Activate to show fan stats.">';
  html += '<div class="hc-profile-flip-inner">';
  html += '<div class="hc-profile-flip-face">' + profileCardHtml(cardUser) + '</div>';
  html += '<div class="hc-profile-flip-face hc-profile-flip-face--back">' +
    profileCardBackHtml(cardUser, transactionCount) +
    '</div>';
  html += '</div>';
  html += '</div>';
  html += '<div class="hc-profile-cards-dots" id="hc-profile-cards-dots">' +
    '<button type="button" class="hc-profile-cards-dot is-active" aria-label="Card front"></button>' +
    '<button type="button" class="hc-profile-cards-dot" aria-label="Fan stats"></button>' +
    '</div>';
  html += '</div>';
  // The partner mark and its "powered by Homecrowd" line, moved out of the app
  // shell to sit under the card (see hideBrandLockup in main.js).
  html += '<div class="hc-profile-brand">' + renderBrandLockup() + '</div>';
  // Design node 1690:7780 — the settings list's Support row, standing alone
  // beneath the lockup.
  html += '<div class="hc-profile-contact hc-settings-list">' +
    SettingsRow({ id: 'hc-profile-contact-us', icon: phoneIconSvg, label: 'Contact us' }) +
    '</div>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  var flip = container.querySelector('#hc-profile-flip');
  var cardsDots = container.querySelector('#hc-profile-cards-dots');
  var flipInner = flip ? flip.querySelector('.hc-profile-flip-inner') : null;
  if (flip && flipInner) {
    var dots = cardsDots ? cardsDots.querySelectorAll('.hc-profile-cards-dot') : [];
    var settled = 0; // the angle the card is resting at: 0 or 180
    var dragging = false;
    var isHorizontal = false;
    var startX = 0;
    var startY = 0;

    var draw = function (angle, animate) {
      flipInner.style.transition = animate ? '' : 'none';
      flipInner.style.transform = 'rotateY(' + angle + 'deg)';
    };

    var settle = function (angle) {
      // Snap to the nearest half-turn WITHOUT normalising into [0,360). Wrapping
      // the value made a card sitting at -100deg animate all the way round to
      // +180 instead of the 80deg it was actually short of.
      settled = Math.round(angle / 180) * 180;
      draw(settled, true);
      var showingBack = ((settled / 180) % 2 + 2) % 2 === 1;
      flip.classList.toggle('is-flipped', showingBack);
      flip.setAttribute(
        'aria-label',
        showingBack
          ? 'Fan stats. Drag or press the arrow keys to turn the card.'
          : 'Fan card. Drag or press the arrow keys to turn the card.',
      );
      for (var d = 0; d < dots.length; d += 1) {
        dots[d].classList.toggle('is-active', d === (showingBack ? 1 : 0));
      }
    };

    // A full card-width drag turns the card exactly half a revolution, so the
    // face follows the finger rather than snapping when it is let go.
    var angleFor = function (clientX) {
      var w = flip.clientWidth || 1;
      return settled + ((clientX - startX) / w) * 180;
    };

    flip.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      isHorizontal = false;
      startX = e.clientX;
      startY = e.clientY;
      flipInner.style.willChange = 'transform';
    });

    flip.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!isHorizontal) {
        // Wait until the gesture's direction is clear: a vertical drag belongs
        // to the page, so it is released rather than captured.
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          dragging = false;
          flipInner.style.willChange = '';
          return;
        }
        isHorizontal = true;
        if (flip.setPointerCapture) flip.setPointerCapture(e.pointerId);
      }
      draw(angleFor(e.clientX), false);
    });

    var endDrag = function (e) {
      if (!dragging) return;
      dragging = false;
      flipInner.style.willChange = '';
      if (!isHorizontal) return; // never moved horizontally; leave it be
      if (flip.releasePointerCapture && e.pointerId != null) {
        try { flip.releasePointerCapture(e.pointerId); } catch (_err) { /* already gone */ }
      }
      settle(angleFor(e.clientX));
    };

    flip.addEventListener('pointerup', endDrag);
    flip.addEventListener('pointercancel', function (e) {
      if (!dragging) return;
      dragging = false;
      flipInner.style.willChange = '';
      draw(settled, true);
      if (flip.releasePointerCapture && e.pointerId != null) {
        try { flip.releasePointerCapture(e.pointerId); } catch (_err) { /* already gone */ }
      }
    });

    flip.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        settle(settled === 0 ? 180 : 0);
      }
    });

    for (var di = 0; di < dots.length; di += 1) {
      (function (index) {
        dots[index].addEventListener('click', function () {
          settle(index === 1 ? 180 : 0);
        });
      })(di);
    }

    draw(0, false);
  }

  var contactBtn = container.querySelector('#hc-profile-contact-us');
  if (contactBtn) {
    contactBtn.addEventListener('click', function () {
      navigate('/contact-us?from=/profile');
    });
  }

  var headerSettingsBtn = container.querySelector('#hc-profile-header-settings');
  if (headerSettingsBtn) {
    headerSettingsBtn.addEventListener('click', function () {
      navigate('/settings');
    });
  }
  var extBtn = container.querySelector('#hc-profile-extension');
  if (extBtn) {
    extBtn.addEventListener('click', function () {
      navigate('/browser-extension');
    });
  }

}

