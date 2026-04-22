import * as api from '../api.js';
import { navigate } from '../router.js';
import { postToNative } from '../bridge.js';
import logoUrl from '../assets/header.png';

export function renderProfile(container, user, onLogout) {
  var fullName = ((user.firstName || '') + ' ' + (user.lastName || '')).trim() || 'Homecrowd Fan';
  var memberSince = user.dateJoined ? formatMemberDate(user.dateJoined) : '';

  var html = '';

  // Screen title (matches ScreenTitle component — paddingHorizontal 20, marginBottom 0)
  html += '<div class="hc-screen-title" style="margin-bottom:10px">';
  html += '<div class="hc-screen-title-text">Profile</div>';
  html += '</div>';

  // Profile card (matches ProfileCard component — LinearGradient brandSky, with watermark)
  html += '<div class="hc-profile-card">';
  html += '<div class="hc-profile-card-top">';
  html += '<div class="hc-profile-card-tagline">Shop Smarter.<br>Cheer Louder.</div>';
  html += '</div>';
  html += '<div class="hc-profile-card-body">';
  html += '<div class="hc-profile-card-name">' + escapeHtml(fullName) + '</div>';
  if (user.fanId) {
    html += '<div class="hc-profile-card-label">FAN ID: <span class="hc-profile-card-bold">' + escapeHtml(user.fanId) + '</span></div>';
  }
  if (memberSince) {
    html += '<div class="hc-profile-card-label">MEMBER SINCE ' + escapeHtml(memberSince) + '</div>';
  }
  html += '</div>';
  html += '<img src="' + logoUrl + '" class="hc-profile-card-watermark" alt="" />';
  html += '</div>';

  // Menu items (matches SecondaryButton components with exact subtitles from ProfileScreen)
  html += '<div class="hc-profile-menu">';
  html += renderMenuItem('activity', activityIcon, 'Activity log', 'See your points earning history');
  html += renderMenuItem('cards', cardIcon, 'Linked cards', 'View and manage payment methods');
  html += renderMenuItem('support', supportIcon, 'Support', 'Get help or give feedback');
  html += '</div>';

  // Logout button (matches MainButton with color={colors.danger})
  html += '<div class="hc-profile-logout-section">';
  html += '<button id="hc-profile-logout" class="hc-btn hc-btn-danger hc-btn-large">Log Out</button>';
  html += '</div>';

  // Version footer (matches versionText — Baikal-Regular 14px mutedBlue)
  html += '<div class="hc-profile-version">Homecrowd Embed v0.1.0</div>';

  container.innerHTML = html;

  // Bind menu clicks
  container.addEventListener('click', function (e) {
    var menuItem = e.target.closest('[data-menu]');
    if (!menuItem) return;
    var action = menuItem.getAttribute('data-menu');
    if (action === 'cards') {
      navigate('/cards');
    } else if (action === 'activity') {
      navigate('/home');
    } else if (action === 'support') {
      postToNative('homecrowd:open-url', { url: 'mailto:support@gethomecrowd.com' });
    }
  });

  // Bind logout
  document.getElementById('hc-profile-logout').addEventListener('click', async function () {
    this.disabled = true;
    this.textContent = 'Logging out...';
    await api.logout();
    onLogout();
  });
}

function renderMenuItem(action, icon, title, subtitle) {
  var html = '<div class="hc-profile-menu-item" data-menu="' + action + '">';
  html += '<div class="hc-profile-menu-icon">' + icon + '</div>';
  html += '<div class="hc-profile-menu-text">';
  html += '<div class="hc-profile-menu-title">' + escapeHtml(title) + '</div>';
  if (subtitle) {
    html += '<div class="hc-profile-menu-subtitle">' + escapeHtml(subtitle) + '</div>';
  }
  html += '</div>';
  html += '<div class="hc-profile-menu-chevron">' + chevronRight + '</div>';
  html += '</div>';
  return html;
}

function formatMemberDate(iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch (e) {
    return '';
  }
}

// Icons matching the mobile app's SVG icons
var activityIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

var cardIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 5H4C2.89543 5 2 5.89543 2 7V17C2 18.1046 2.89543 19 4 19H20C21.1046 19 22 18.1046 22 17V7C22 5.89543 21.1046 5 20 5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 10H22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

var supportIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 16.92V19.92C22 20.4835 21.7625 21.0241 21.3401 21.4223C20.9177 21.8205 20.3436 22.0421 19.78 22.02C16.7428 21.6893 13.787 20.7309 11.11 19.21C8.58 17.8063 6.4237 15.65 5.02 13.12C3.49375 10.4319 2.53486 7.46305 2.21 4.41C2.18835 3.8508 2.40799 3.30945 2.80335 2.89018C3.19871 2.4709 3.73482 2.23425 4.29 2.23H7.29C8.27726 2.22039 9.11498 2.93956 9.25 3.92C9.36543 4.84029 9.59097 5.7436 9.92 6.61C10.1977 7.35 10.0078 8.18 9.42 8.72L8.09 10.05C9.37897 12.3074 11.2026 14.131 13.46 15.42L14.79 14.09C15.3291 13.5014 16.1577 13.3113 16.9 13.59C17.7647 13.9195 18.6662 14.1451 19.585 14.26C20.5786 14.3964 21.303 15.2526 21.28 16.25L22 16.92Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

var chevronRight = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
