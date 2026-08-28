import { escapeHtml } from './html.js';
import chevronRightIconSvg from '../assets/icons/settings/chevron-right.svg?raw';

function svgAddClass(svgRaw, className) {
  return String(svgRaw).replace(/^<svg\s/i, '<svg class="' + className + '" ');
}

/**
 * One row of a settings list: icon, label, chevron (design node 1690:7767).
 *
 * Shared so the settings page and the profile page's "Contact us" bar cannot
 * drift apart — they are the same control in two places, not two controls that
 * happen to look alike.
 *
 * The divider is a top border on every row, and `.hc-settings-row:first-child`
 * removes it, so a lone row needs no special casing.
 *
 * @param {{id: string, icon: string, label: string, badge?: boolean}} opts
 */
export default function SettingsRow(opts) {
  return (
    '<button type="button" class="hc-settings-row" id="' +
    opts.id +
    '">' +
    svgAddClass(opts.icon, 'hc-settings-row-icon') +
    '<span class="hc-settings-row-label">' +
    escapeHtml(opts.label) +
    '</span>' +
    (opts.badge ? '<span class="hc-settings-row-badge" aria-hidden="true"></span>' : '') +
    svgAddClass(chevronRightIconSvg, 'hc-settings-row-chevron') +
    '</button>'
  );
}
