import { escapeHtml, escapeAttr } from './html.js';

var TIER_BADGE_BASE_URL = 'https://app.gethomecrowd.com/assets/badge-images';

function injectStarterIfMissing(ordered) {
  // The backend synthesizes a virtual "Starter" tier for users who finished
  // onboarding but haven't hit the first points tier yet. It isn't stored in
  // tier_config.tiers, so inject it between the onboarding tier and the first
  // points tier so the modal shows the full progression.
  var onboardingTier = null;
  var firstPointsTier = null;
  var hasStarter = false;
  for (var i = 0; i < ordered.length; i++) {
    var t = ordered[i];
    if (!t) continue;
    if (!onboardingTier && t.type === 'onboarding') onboardingTier = t;
    if (!firstPointsTier && t.type === 'points') firstPointsTier = t;
    if ((t.name || '').toLowerCase() === 'starter') hasStarter = true;
  }
  if (!hasStarter && onboardingTier && firstPointsTier) {
    var starter = {
      level: onboardingTier.level != null ? onboardingTier.level : 0,
      name: 'Starter',
      type: 'points',
      target: 0,
      badge_url: TIER_BADGE_BASE_URL + '/badge-starter.png',
      __synthetic: true,
    };
    var idx = ordered.indexOf(firstPointsTier);
    ordered.splice(idx, 0, starter);
  }
  return { ordered: ordered, onboardingTaskCount: (onboardingTier && onboardingTier.target) || 3 };
}

function renderRequirement(tier, onboardingTaskCount) {
  if (!tier) return '';
  if (tier.type === 'onboarding') return 'Starting tier';
  if ((tier.name || '').toLowerCase() === 'starter') {
    return onboardingTaskCount + ' onboarding task' + (onboardingTaskCount === 1 ? '' : 's');
  }
  var target = tier.target != null ? tier.target : 0;
  return target ? Number(target).toLocaleString() + ' points' : '';
}

export function buildTiersModalHtml(opts) {
  opts = opts || {};
  var tiers = Array.isArray(opts.tiers) ? opts.tiers.slice() : [];
  var currentTierName = opts.currentTierName != null ? String(opts.currentTierName) : '';
  var currentTierLevel = opts.currentTierLevel;

  tiers.sort(function (a, b) {
    return (a && a.level != null ? a.level : 0) - (b && b.level != null ? b.level : 0);
  });

  var withStarter = injectStarterIfMissing(tiers);
  var ordered = withStarter.ordered;
  var onboardingTaskCount = withStarter.onboardingTaskCount;

  var rows = '';
  for (var i = 0; i < ordered.length; i++) {
    var tier = ordered[i];
    if (!tier) continue;
    var isCurrent =
      currentTierName && tier.name
        ? String(tier.name).toLowerCase() === currentTierName.toLowerCase()
        : tier.level === currentTierLevel;
    var badge = tier.badge_url
      ? '<img class="hc-tiers-modal-badge" src="' +
        escapeAttr(tier.badge_url) +
        '" alt="" loading="lazy" decoding="async" onerror="this.style.visibility=\'hidden\'"/>'
      : '<div class="hc-tiers-modal-badge hc-tiers-modal-badge-placeholder"></div>';
    rows +=
      '<div class="hc-tiers-modal-row' +
      (isCurrent ? ' hc-tiers-modal-row--current' : '') +
      '">' +
      badge +
      '<div class="hc-tiers-modal-row-text">' +
      '<div class="hc-tiers-modal-row-name' +
      (isCurrent ? ' hc-tiers-modal-row-name--current' : '') +
      '">' +
      escapeHtml(tier.name || '') +
      '</div>' +
      '<div class="hc-tiers-modal-row-req">' +
      escapeHtml(renderRequirement(tier, onboardingTaskCount)) +
      '</div>' +
      '</div>' +
      (isCurrent ? '<span class="hc-tiers-modal-row-chip">Current</span>' : '') +
      '</div>';
  }

  return (
    '<div id="hc-tiers-modal" class="hc-modal-overlay hc-tiers-modal-overlay" style="display:none" data-tiers-close="1">' +
    '<div class="hc-tiers-modal-sheet" role="dialog" aria-modal="true" aria-label="Tiers">' +
    '<div class="hc-tiers-modal-header">' +
    '<div class="hc-tiers-modal-title">Tiers</div>' +
    '<button type="button" class="hc-tiers-modal-close" data-tiers-close="1">Close</button>' +
    '</div>' +
    '<div class="hc-tiers-modal-list">' +
    rows +
    '</div>' +
    '</div>' +
    '</div>'
  );
}
