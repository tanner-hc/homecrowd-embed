import defaultHeaderLogoUrl from './assets/header.png';
import { escapeHtml } from './base-components/html.js';

var brandConfig = null;

function setVar(name, value) {
  if (!document || !document.documentElement) return;
  if (value) {
    document.documentElement.style.setProperty(name, value);
  } else {
    document.documentElement.style.removeProperty(name);
  }
}

export function applyBrandConfig(config) {
  brandConfig = config && typeof config === 'object' ? config : null;

  var pageBackground = brandConfig && (brandConfig.pageBackground || brandConfig.backgroundColor);
  var cardBackground = brandConfig && (brandConfig.cardBackground || brandConfig.secondaryColor);
  var headingText = brandConfig && (brandConfig.headingText || brandConfig.darkColor);
  var bodyText = brandConfig && brandConfig.bodyText;
  var link = brandConfig && (brandConfig.link || brandConfig.linkColor || brandConfig.accentColor);
  var chrome = brandConfig && (brandConfig.chrome || brandConfig.chromeColor);
  var button = brandConfig && (brandConfig.button || brandConfig.buttonColor || brandConfig.buttonFillColor || brandConfig.primaryColor);
  var buttonPrimaryText = brandConfig && (brandConfig.buttonPrimaryText || brandConfig.buttonPrimaryTextColor);
  var buttonSecondaryText = brandConfig && (brandConfig.buttonSecondaryText || brandConfig.buttonSecondaryTextColor);

  setVar('--hc-bg', pageBackground);
  setVar('--hc-card', cardBackground);
  setVar('--hc-text-primary', headingText);
  setVar('--hc-text-secondary', bodyText);
  setVar('--hc-link', link);
  setVar('--hc-chrome', chrome);
  setVar('--hc-primary', button);
  setVar('--hc-button-border', button);
  setVar('--hc-button-primary-text', buttonPrimaryText);
  setVar('--hc-button-secondary-text', buttonSecondaryText);
}

export function clearBrandConfig() {
  brandConfig = null;
  setVar('--hc-bg', '');
  setVar('--hc-card', '');
  setVar('--hc-text-primary', '');
  setVar('--hc-text-secondary', '');
  setVar('--hc-link', '');
  setVar('--hc-chrome', '');
  setVar('--hc-primary', '');
  setVar('--hc-button-border', '');
  setVar('--hc-button-primary-text', '');
  setVar('--hc-button-secondary-text', '');
}

export function getHeaderLogoUrl() {
  if (brandConfig && brandConfig.headerLogoUrl) {
    return brandConfig.headerLogoUrl;
  }
  return defaultHeaderLogoUrl;
}

export function hasCustomHeaderLogo() {
  return !!(brandConfig && brandConfig.headerLogoUrl);
}

export function renderBrandLockup() {
  var src = getHeaderLogoUrl();
  var alt = hasCustomHeaderLogo() ? 'School brand' : 'Homecrowd';
  if (!hasCustomHeaderLogo()) {
    return '<div class="hc-header"><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" class="hc-header-logo" /></div>';
  }
  return (
    '<div class="hc-header hc-header--brand">' +
    '<img src="' +
    escapeHtml(src) +
    '" alt="' +
    escapeHtml(alt) +
    '" class="hc-header-logo hc-header-logo--brand" />' +
    '<div class="hc-header-powered">' +
    '<span class="hc-header-powered-label">POWERED BY</span>' +
    '<span class="hc-header-powered-name">HOMECROWD</span>' +
    '</div>' +
    '</div>'
  );
}

