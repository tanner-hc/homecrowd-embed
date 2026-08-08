import { escapeHtml } from '../../base-components/html.js';

/**
 * Greeting shown while the student still has setup steps left. It carries the
 * prompt that used to be the setup list's own "Start earning points" heading,
 * so the two aren't stacked, and the whole block goes away once setup is done.
 *
 * @param {object} user
 * @param {{ setupIncomplete?: boolean }} [options]
 */
export function buildWelcomeSectionHtml(user, options) {
  options = options || {};
  if (!options.setupIncomplete) return '';

  var name = (user && (user.first_name || user.firstName)) || 'User';
  return (
    '<div class="hc-home-welcome">' +
    '<div class="hc-home-welcome-title">Welcome, ' +
    escapeHtml(String(name)) +
    '!</div>' +
    '<div class="hc-home-welcome-subtitle">' +
    'Finish setup to get closer to your first reward.' +
    '</div>' +
    '</div>'
  );
}

export default { buildWelcomeSectionHtml };
