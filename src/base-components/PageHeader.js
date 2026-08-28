import { escapeHtml } from './html.js';
import chevronLeftIconSvg from '../assets/icons/settings/chevron-left.svg?raw';

function svgAddClass(svgRaw, className) {
  return String(svgRaw).replace(/^<svg\s/i, '<svg class="' + className + '" ');
}

/**
 * A page header: circular back button, centred title (design node 1690:7751).
 *
 * The newer of the two header treatments in the app. NavHeader — a left-aligned
 * back button with the title inside it — is still used by the other views; this
 * is for screens that follow the current designs.
 *
 * @param {{title: string, backButtonId: string}} opts
 */
export default function PageHeader(opts) {
  return (
    '<div class="hc-page-header">' +
    '<button type="button" class="hc-page-header-back" id="' +
    escapeHtml(opts.backButtonId) +
    '" aria-label="Back">' +
    svgAddClass(chevronLeftIconSvg, 'hc-page-header-back-icon') +
    '</button>' +
    '<h1 class="hc-page-header-title">' +
    escapeHtml(opts.title) +
    '</h1>' +
    // Mirrors the back button's footprint so the title sits optically centred,
    // matching the design where the right slot holds an equally sized element.
    '<span class="hc-page-header-spacer" aria-hidden="true"></span>' +
    '</div>'
  );
}
