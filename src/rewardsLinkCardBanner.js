import LinkCardBanner from './base-components/LinkCardBanner.js';
import { escapeHtml } from './base-components/html.js';

export function buildRewardsLinkCardBanner(currentUser) {
  var schoolName =
    (currentUser && currentUser.active_school && currentUser.active_school.name) ||
    'your school';
  return LinkCardBanner({
    title: 'Link a card to unlock rewards',
    subtitleHtml:
      'Earn points for you and dollars for ' +
      escapeHtml(schoolName) +
      ' on every in-network purchase.',
  });
}
