import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import NavHeader from '../base-components/NavHeader.js';
import MainButton from '../base-components/MainButton.js';
import { escapeHtml } from '../base-components/html.js';
import { showSuccess, showError } from '../base-components/toastApi.js';
import mailIconSvg from '../assets/icons/mail.svg?raw';

function svgAddClass(svgRaw, className) {
  return String(svgRaw).replace(/^<svg\s/i, '<svg class="' + className + '" ');
}

function mailIconHtml() {
  return svgAddClass(mailIconSvg, 'hc-invite-email-svg');
}

function pickActiveSchool(u) {
  if (!u || typeof u !== 'object') return null;
  return u.activeSchool || u.active_school || null;
}

function schoolEarlyRelease(school) {
  if (!school || typeof school !== 'object') return false;
  if (school.earlyRelease === true) return true;
  if (school.early_release === true) return true;
  return false;
}

function isReferralCampaignActive(campaign, isEarlyRelease) {
  if (isEarlyRelease) return true;
  if (!campaign) return false;
  var raw = campaign.incentive_value;
  if (raw === null || raw === undefined) return true;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw > 0 : true;
  var parsed = parseInt(String(raw), 10);
  return Number.isFinite(parsed) ? parsed > 0 : true;
}

function normalizeCampaign(resp) {
  if (!resp || typeof resp !== 'object') return null;
  var c = resp.campaign;
  if (Array.isArray(c) && c.length) return c[0];
  if (c && typeof c === 'object') return c;
  if (resp.campaigns && Array.isArray(resp.campaigns) && resp.campaigns[0]) {
    return resp.campaigns[0];
  }
  return null;
}

function pickFirstString(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  var i;
  for (i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = obj[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function pickUserReferralCode(user) {
  if (!user || typeof user !== 'object') return '';
  return pickFirstString(user, ['referral_code', 'referralCode', 'referral_code_text']).trim();
}

function buildAppReferralShareText(referralAppUrl, code) {
  var url = String(referralAppUrl || '').trim() || 'https://apps.apple.com/app/homecrowd/id6755055695';
  var c = String(code || '').trim();
  return (
    'Check out this new app! ' +
    url +
    '\nUse my referral code when you sign up: ' +
    c +
    '\nVerify your email in the app for the code to count'
  );
}

function referralIncentiveParts(campaign) {
  if (!campaign) {
    return { amount: null, rewardTextYou: 'points' };
  }
  var type = campaign.incentive_type || 'points';
  var raw = campaign.incentive_value;
  var value = null;
  if (raw !== null && raw !== undefined) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      value = raw;
    } else {
      var parsed = parseInt(String(raw), 10);
      value = Number.isFinite(parsed) ? parsed : null;
    }
  }
  var amount = value != null ? value : type === 'points' ? 0 : 1;
  var singular = amount === 1;
  var text;
  if (type === 'points') {
    text = amount + ' point' + (singular ? '' : 's');
  } else if (type === 'raffle_entry') {
    text = amount + ' raffle ' + (singular ? 'entry' : 'entries');
  } else if (type === 'raffle_ticket') {
    text = amount + ' raffle ' + (singular ? 'ticket' : 'tickets');
  } else {
    text = amount + ' ' + type;
  }
  return { amount: value, rewardTextYou: text };
}

function inviteHeroTitle(campaign) {
  var parts = referralIncentiveParts(campaign);
  if (parts.amount != null) {
    return (
      'Invite your friends and earn ' +
      parts.rewardTextYou +
      ' for each friend who joins Homecrowd!'
    );
  }
  return 'Invite your friends and earn rewards!';
}

function inviteHeroSubtitle(campaign) {
  var parts = referralIncentiveParts(campaign);
  if (parts.amount != null) {
    return (
      "Enter your friend's email and we'll send them an invite. Rewards will be awarded only after your friend verifies their email and joins Homecrowd."
    );
  }
  return (
    "Enter your friend's email and we'll send them an invite. Rewards are awarded only after your friend verifies their email."
  );
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

export function renderInviteFriend(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading...' });
  loadInviteFriend(container);
}

async function loadInviteFriend(container) {
  var profileUser = null;
  var referralResponse = null;
  try {
    profileUser = await api.getUserProfile();
  } catch (_e) {
    profileUser = null;
  }
  try {
    var me = await api.fetchCurrentUser();
    if (me && typeof me === 'object') {
      profileUser = Object.assign({}, profileUser || {}, me);
    }
  } catch (err) {
    if (!profileUser) {
      container.innerHTML =
        '<div class="hc-alert-error">' + escapeHtml(err.message || 'Failed to load') + '</div>';
      return;
    }
  }

  var referralAppUrl = 'https://apps.apple.com/app/homecrowd/id6755055695';
  try {
    var linksResp = await api.getManagedLinks();
    var fromApi =
      linksResp && linksResp.links && String(linksResp.links.referral_app_url || '').trim();
    if (fromApi) {
      referralAppUrl = fromApi;
    }
  } catch (_e) { }

  try {
    referralResponse = await api.getReferralCampaign();
  } catch (_e) {
    referralResponse = {};
  }
  if (referralResponse && referralResponse.data && typeof referralResponse.data === 'object') {
    referralResponse = Object.assign({}, referralResponse, referralResponse.data);
  }

  var campaign = normalizeCampaign(referralResponse);
  var school = pickActiveSchool(profileUser);
  var isEarlyRelease = schoolEarlyRelease(school);
  var eligible = isReferralCampaignActive(campaign, isEarlyRelease);

  var html = '';
  html += '<div class="hc-invite-friend">';
  html += '<div class="hc-account-settings-nav">';
  html += NavHeader({
    title: 'Invite a friend',
    backButtonId: 'hc-invite-back',
  });
  html += '</div>';
  html += '<div class="hc-invite-body">';

  if (!eligible) {
    html += '<div class="hc-pd-form">';
    html +=
      '<p class="hc-cp-intro">Referral invites are not available right now. Check back later.</p>';
    html += '</div>';
    html += '</div></div>';
    container.innerHTML = html;
    document.getElementById('hc-invite-back').addEventListener('click', function () {
      navigate('/profile');
    });
    return;
  }

  var heroTitle = inviteHeroTitle(campaign);
  var heroSubtitle = inviteHeroSubtitle(campaign);

  html += '<div class="hc-pd-form hc-invite-form">';
  html += '<div class="hc-invite-hero">';
  html += '<div class="hc-invite-hero-title">' + escapeHtml(heroTitle) + '</div>';
  html += '<div class="hc-invite-hero-sub">' + escapeHtml(heroSubtitle) + '</div>';
  html += '</div>';

  html += '<div class="hc-form-group hc-pd-field">';
  html += '<label class="hc-label" for="hc-invite-email">Friend\'s email</label>';
  html += '<div class="hc-invite-email-wrap">';
  html +=
    '<input id="hc-invite-email" class="hc-input hc-pd-input hc-invite-email-input" type="email" inputmode="email" placeholder="Enter friend\'s email" autocomplete="email" />';
  html += '<span class="hc-invite-email-icon">' + mailIconHtml() + '</span>';
  html += '</div>';
  html += '</div>';

  html += '<div class="hc-pd-actions hc-invite-actions">';
  html += MainButton({
    id: 'hc-invite-send',
    text: 'Send Invite',
    loadingText: 'Sending...',
  });
  html += '<div class="hc-invite-or" aria-hidden="true">or</div>';
  html += MainButton({
    id: 'hc-invite-share-msg',
    text: 'Share referral message',
    loadingText: 'Opening...',
  });
  html += '</div>';

  html += '</div>';
  html += '</div></div>';

  container.innerHTML = html;

  document.getElementById('hc-invite-back').addEventListener('click', function () {
    navigate('/profile');
  });

  var emailInput = document.getElementById('hc-invite-email');
  var sendBtn = document.getElementById('hc-invite-send');
  if (sendBtn) {
    sendBtn.addEventListener('click', async function () {
      var email = (emailInput && emailInput.value ? emailInput.value : '').trim();
      if (!email) {
        showError('Enter your friend\'s email');
        return;
      }
      if (!isValidEmail(email)) {
        showError('Enter a valid email address');
        return;
      }
      sendBtn.disabled = true;
      var prev = sendBtn.innerHTML;
      sendBtn.innerHTML =
        '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>Sending...</span>';
      try {
        await api.sendReferralInviteEmail(email);
        showSuccess('Invite sent');
        if (emailInput) emailInput.value = '';
      } catch (err) {
        showError(err.message || 'Could not send invite');
      } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = prev;
      }
    });
  }

  var shareMsgBtn = document.getElementById('hc-invite-share-msg');
  if (shareMsgBtn) {
    shareMsgBtn.addEventListener('click', async function () {
      var code = pickUserReferralCode(profileUser);
      if (!code) {
        showError('Referral code is not available yet. Please try again.');
        return;
      }
      var message = buildAppReferralShareText(referralAppUrl, code);
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        shareMsgBtn.disabled = true;
        var prevS = shareMsgBtn.innerHTML;
        shareMsgBtn.innerHTML =
          '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>Opening...</span>';
        try {
          await navigator.share({ text: message });
        } catch (_e) { }
        shareMsgBtn.disabled = false;
        shareMsgBtn.innerHTML = prevS;
      } else {
        try {
          await navigator.clipboard.writeText(message);
          showSuccess('Copied to clipboard');
        } catch (_e) {
          showError('Could not copy');
        }
      }
    });
  }
}
