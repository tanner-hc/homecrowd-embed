import defaultHeaderLogoUrl from './assets/header.png';
import { escapeHtml } from './base-components/html.js';

var brandConfig = null;

var PREVIEW_VARS = [
  '--hc-preview-bg',
  '--hc-preview-card',
  '--hc-preview-text-primary',
  '--hc-preview-text-secondary',
  '--hc-preview-link',
  '--hc-preview-chrome',
  '--hc-preview-primary',
  '--hc-preview-button-border',
  '--hc-preview-button-primary-text',
  '--hc-preview-button-secondary',
  '--hc-preview-button-secondary-text',
  '--hc-email-selection-bg-image',
  '--hc-email-card-blur',
];

var LOGIN_VARS = [
  '--hc-login-bg-image',
  '--hc-login-button',
  '--hc-login-button-text',
  '--hc-login-title',
  '--hc-login-text',
  '--hc-login-signup',
  '--hc-login-card-bg',
  '--hc-login-card-blur',
];

function setVar(name, value) {
  if (!document || !document.documentElement) return;
  if (value) {
    document.documentElement.style.setProperty(name, value);
  } else {
    document.documentElement.style.removeProperty(name);
  }
}

function clearVars(names) {
  names.forEach(function (name) {
    setVar(name, '');
  });
}

function hexToCssColor(hex, opacityPercent) {
  if (!hex) return '';
  var normalized = String(hex).trim().toUpperCase();
  if (!normalized.startsWith('#')) {
    normalized = '#' + normalized;
  }
  var opacity = opacityPercent != null ? Number(opacityPercent) : 100;
  if (!Number.isFinite(opacity)) opacity = 100;
  opacity = Math.min(100, Math.max(0, Math.round(opacity)));
  if (opacity >= 100) return normalized;
  if (opacity <= 0) return 'transparent';
  var r = parseInt(normalized.slice(1, 3), 16);
  var g = parseInt(normalized.slice(3, 5), 16);
  var b = parseInt(normalized.slice(5, 7), 16);
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (opacity / 100) + ')';
}

function readCssColor(config, colorKey, opacityKey, fallbackHex, fallbackOpacity) {
  var hex = config && (config[colorKey] || config[colorKey + 'Color']);
  if (!hex && fallbackHex) hex = fallbackHex;
  var opacity = config && config[opacityKey];
  if (opacity == null || opacity === '') opacity = fallbackOpacity != null ? fallbackOpacity : 100;
  return hexToCssColor(hex, opacity);
}

function readBlurPx(config, key, fallbackPx) {
  if (!config || !Object.prototype.hasOwnProperty.call(config, key)) return '';
  var value = config[key];
  if (value == null || value === '') return fallbackPx + 'px';
  return value + 'px';
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
  var buttonSecondary = brandConfig && (brandConfig.buttonSecondary || brandConfig.buttonSecondaryColor);
  var buttonSecondaryText = brandConfig && (brandConfig.buttonSecondaryText || brandConfig.buttonSecondaryTextColor);
  var loginBackground = brandConfig && brandConfig.loginBackgroundUrl;
  var emailSelectionBackground = brandConfig && brandConfig.emailSelectionBackgroundUrl;
  var loginButton = brandConfig && (brandConfig.loginButton || brandConfig.loginButtonColor);
  var loginButtonText = brandConfig && (brandConfig.loginButtonText || brandConfig.loginButtonTextColor);
  var loginTitle = brandConfig && (brandConfig.loginTitle || brandConfig.loginTitleColor);
  var loginText = brandConfig && (brandConfig.loginText || brandConfig.loginTextColor);
  var loginSignup = brandConfig && (brandConfig.loginSignup || brandConfig.loginSignupColor);
  var loginCardBackground = brandConfig && brandConfig.loginCardBackground;

  setVar('--hc-preview-bg', readCssColor(brandConfig, 'pageBackground', 'pageBackgroundOpacity', pageBackground, 100));
  setVar('--hc-preview-card', readCssColor(brandConfig, 'cardBackground', 'cardBackgroundOpacity', cardBackground, 100));
  setVar('--hc-preview-text-primary', readCssColor(brandConfig, 'headingText', 'headingTextOpacity', headingText, 100));
  setVar('--hc-preview-text-secondary', readCssColor(brandConfig, 'bodyText', 'bodyTextOpacity', bodyText, 100));
  setVar('--hc-preview-link', readCssColor(brandConfig, 'link', 'linkOpacity', link, 100));
  setVar('--hc-preview-chrome', readCssColor(brandConfig, 'chrome', 'chromeOpacity', chrome, 100));
  setVar('--hc-preview-primary', readCssColor(brandConfig, 'button', 'buttonOpacity', button, 100));
  setVar('--hc-preview-button-border', readCssColor(brandConfig, 'button', 'buttonOpacity', button, 100));
  setVar('--hc-preview-button-primary-text', readCssColor(brandConfig, 'buttonPrimaryText', 'buttonPrimaryTextOpacity', buttonPrimaryText, 100));
  setVar('--hc-preview-button-secondary', readCssColor(brandConfig, 'buttonSecondary', 'buttonSecondaryOpacity', buttonSecondary || pageBackground, 100));
  setVar('--hc-preview-button-secondary-text', readCssColor(brandConfig, 'buttonSecondaryText', 'buttonSecondaryTextOpacity', buttonSecondaryText || button, 100));
  setVar('--hc-email-selection-bg-image', emailSelectionBackground ? 'url("' + emailSelectionBackground + '")' : '');
  setVar('--hc-email-card-blur', readBlurPx(brandConfig, 'emailSelectionCardBlur', 0));

  setVar('--hc-login-bg-image', loginBackground ? 'url("' + loginBackground + '")' : '');
  setVar('--hc-login-button', readCssColor(brandConfig, 'loginButton', 'loginButtonOpacity', loginButton, 100));
  setVar('--hc-login-button-text', readCssColor(brandConfig, 'loginButtonText', 'loginButtonTextOpacity', loginButtonText, 100));
  setVar('--hc-login-title', readCssColor(brandConfig, 'loginTitle', 'loginTitleOpacity', loginTitle, 100));
  setVar('--hc-login-text', readCssColor(brandConfig, 'loginText', 'loginTextOpacity', loginText, 100));
  setVar('--hc-login-signup', readCssColor(brandConfig, 'loginSignup', 'loginSignupOpacity', loginSignup, 100));
  setVar('--hc-login-card-bg', readCssColor(brandConfig, 'loginCardBackground', 'loginCardBackgroundOpacity', loginCardBackground || '#FFFFFF', 8));
  setVar('--hc-login-card-blur', readBlurPx(brandConfig, 'loginCardBlur', 50));

  if (document && document.documentElement) {
    document.documentElement.classList.toggle('hc-has-email-selection-bg', !!emailSelectionBackground);
  }
}

export function clearBrandConfig() {
  brandConfig = null;
  clearVars(PREVIEW_VARS);
  clearVars(LOGIN_VARS);
  if (document && document.documentElement) {
    document.documentElement.classList.remove('hc-has-email-selection-bg');
  }
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
