import Button from './Button.js';
import { escapeHtml } from './html.js';
import cardIconSvg from '../assets/icons/card-filled.svg?raw';

export default function LinkCardBanner(opts) {
  opts = opts || {};
  var title = opts.title != null ? opts.title : 'Link a card to start earning';
  var subtitleHtml = opts.subtitleHtml != null ? opts.subtitleHtml : '';
  var buttonTitle = opts.buttonTitle != null ? opts.buttonTitle : 'Link a card';
  var buttonClassName = opts.buttonClassName || 'hc-stores-link-card-btn';
  var bannerClassName = opts.bannerClassName
    ? 'hc-stores-link-card-banner ' + opts.bannerClassName
    : 'hc-stores-link-card-banner';

  return (
    '<div class="' + bannerClassName + '">' +
    '<div class="hc-stores-link-card-banner-icon" aria-hidden="true">' +
    cardIconSvg +
    '</div>' +
    '<div class="hc-stores-link-card-banner-text">' +
    '<div class="hc-stores-link-card-banner-title">' + escapeHtml(title) + '</div>' +
    '<div class="hc-stores-link-card-banner-subtitle">' + subtitleHtml + '</div>' +
    '</div>' +
    Button({
      title: buttonTitle,
      variant: 'primary',
      className: buttonClassName,
    }) +
    '</div>'
  );
}
