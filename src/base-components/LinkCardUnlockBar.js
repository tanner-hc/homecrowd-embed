import MainButton from './MainButton.js';
import { escapeHtml } from './html.js';
import { getDefaultSetupRewardPoints } from '../setup-rewards.js';

/**
 * @param {{ message?: string, points?: number, buttonText?: string }} props
 */
export function buildLinkCardUnlockBarHtml(props) {
  props = props || {};
  var pts =
    typeof props.points === 'number'
      ? props.points
      : getDefaultSetupRewardPoints().linkCard;
  var label = props.buttonText || 'Link my card +' + pts + ' pts';
  var message = props.message || 'Link your card to unlock shops';

  return (
    '<div class="hc-link-card-unlock-bar" id="hc-link-card-unlock-bar">' +
    '<div class="hc-link-card-unlock-msg">' +
    escapeHtml(message) +
    '</div>' +
    MainButton({
      id: 'hc-link-card-unlock-btn',
      text: label,
      className: 'hc-link-card-unlock-btn',
    }) +
    '</div>'
  );
}

export function bindLinkCardUnlockBar(root, onPress) {
  if (!root) return;
  var btn = root.querySelector('#hc-link-card-unlock-btn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    if (typeof onPress === 'function') onPress();
  });
}
