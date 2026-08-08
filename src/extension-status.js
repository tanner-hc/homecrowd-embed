import * as api from './api.js';
import { hasNativeBridge, requestNativeExtensionEnabled } from './bridge.js';

var extensionSyncInFlight = null;

export function coerceBool(value) {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    value === 'true' ||
    value === 'True' ||
    value === 'yes'
  );
}

export function extensionFlagTrue(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return (
    coerceBool(obj.is_extension_enabled) ||
    coerceBool(obj.isExtensionEnabled)
  );
}

export function pickCurrentTier(user) {
  if (!user || typeof user !== 'object') return null;
  var t =
    user.currentTier != null
      ? user.currentTier
      : user.current_tier != null
        ? user.current_tier
        : null;
  return t && typeof t === 'object' ? t : null;
}

export function pickOnboardingStatus(user) {
  var t = pickCurrentTier(user);
  if (!t) return null;
  var o = t.onboarding_status || t.onboardingStatus;
  return o && typeof o === 'object' ? o : null;
}

export function extensionOnFromTier(user) {
  var o = pickOnboardingStatus(user);
  if (!o) return false;
  return coerceBool(o.extension_installed) || coerceBool(o.extensionInstalled);
}

export function linkedCardFromTier(user) {
  var o = pickOnboardingStatus(user);
  if (!o) return false;
  return coerceBool(o.linked_card) || coerceBool(o.linkedCard);
}

export function setupTaskDoneFromSync(syncResult, taskKey) {
  if (!syncResult || typeof syncResult !== 'object') return false;
  var results = syncResult.results || {};
  var entry = results[taskKey];
  if (!entry || typeof entry !== 'object') return false;
  return !!(
    entry.eligible ||
    entry.already_claimed ||
    entry.alreadyClaimed ||
    entry.awarded
  );
}

export function userExtensionEnabled(embedUser, profileUser, syncResult) {
  if (extensionFlagTrue(embedUser)) return true;
  if (extensionFlagTrue(profileUser)) return true;
  if (extensionOnFromTier(embedUser)) return true;
  if (extensionOnFromTier(profileUser)) return true;
  if (setupTaskDoneFromSync(syncResult, 'safari_extension')) return true;
  return false;
}

export function markUserExtensionEnabled(user) {
  if (!user || typeof user !== 'object') return user;
  return Object.assign({}, user, {
    is_extension_enabled: true,
    isExtensionEnabled: true,
  });
}

export async function syncExtensionEnabledFromNative(user) {
  if (!user || user.id == null) return user;
  if (extensionFlagTrue(user)) return user;
  if (!hasNativeBridge()) return user;
  if (extensionSyncInFlight) return extensionSyncInFlight;

  extensionSyncInFlight = (async function () {
    try {
      var enabled = await requestNativeExtensionEnabled();
      if (enabled !== true) return user;
      await api.updateUserProfile({ is_extension_enabled: true });
      return markUserExtensionEnabled(user);
    } catch (_e) {
      return user;
    } finally {
      extensionSyncInFlight = null;
    }
  })();

  return extensionSyncInFlight;
}

export function userHasLinkedCard(embedUser, profileUser, cards, syncResult) {
  var list = Array.isArray(cards) ? cards : [];
  var fromCards = list.some(function (card) {
    if (!card) return false;
    if (coerceBool(card.active)) return true;
    var status = card.status != null ? String(card.status).toLowerCase() : '';
    return status === 'active';
  });
  if (fromCards) return true;
  if (linkedCardFromTier(embedUser)) return true;
  if (linkedCardFromTier(profileUser)) return true;
  if (setupTaskDoneFromSync(syncResult, 'link_card')) return true;
  return false;
}
