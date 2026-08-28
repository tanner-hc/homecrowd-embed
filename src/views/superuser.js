import * as api from '../api.js';
import { navigate } from '../router.js';
import PageHeader from '../base-components/PageHeader.js';
import SettingsRow from '../base-components/SettingsRow.js';
import activityIconSvg from '../assets/icons/settings/activity.svg?raw';

/**
 * Tools kept out of the way of ordinary fans.
 *
 * The gate here is presentational — it decides what to draw, not what the
 * caller may do. Every action behind it is a normal route whose endpoints
 * enforce their own permissions server-side.
 */
export function isSuperuser(user) {
  if (!user || typeof user !== 'object') return false;
  return user.is_superuser === true || user.isSuperuser === true;
}

export function renderSuperuser(container) {
  container.innerHTML = '<div class="hc-superuser-view"></div>';
  load(container.querySelector('.hc-superuser-view'));
}

async function load(root) {
  var user = null;
  try {
    user = await api.getUserProfile();
  } catch (_e) {
    user = null;
  }

  // Typing the hash is not a way in: a non-superuser lands back on the profile.
  if (!isSuperuser(user)) {
    navigate('/settings');
    return;
  }

  root.innerHTML =
    PageHeader({ title: 'Superuser', backButtonId: 'hc-superuser-back' }) +
    '<div class="hc-settings-list">' +
    SettingsRow({ id: 'hc-superuser-check-in', icon: activityIconSvg, label: 'Check in' }) +
    '</div>';

  var go = function (id, path) {
    var el = root.querySelector('#' + id);
    if (el) {
      el.addEventListener('click', function () {
        navigate(path);
      });
    }
  };

  go('hc-superuser-check-in', '/check-in');
  go('hc-superuser-back', '/settings');
}
