import { escapeHtml } from '../../base-components/html.js';

export function buildWelcomeSectionHtml(user) {
  var name =
    (user && (user.first_name || user.firstName)) || 'User';
  return (
    '<div class="hc-home-welcome">' +
    '<div class="hc-home-welcome-text">Welcome, ' +
    escapeHtml(String(name)) +
    '!</div>' +
    '</div>'
  );
}

export default { buildWelcomeSectionHtml };
