import defaultHeaderLogoUrl from './assets/header.png';
import { escapeHtml } from './base-components/html.js';

var brandConfig = null;
var embedSchoolId = '';

var PREVIEW_VARS = [
  '--hc-preview-bg',
  '--hc-preview-card',
  '--hc-preview-text-primary',
  '--hc-preview-text-secondary',
  '--hc-preview-link',
  '--hc-link',
  '--hc-preview-chrome',
  '--hc-chrome',
  '--hc-preview-primary',
  '--hc-preview-button-border',
  '--hc-preview-button-primary-text',
  '--hc-preview-button-secondary',
  '--hc-preview-button-secondary-text',
  '--hc-btn1-border',
  '--hc-btn1-icon',
  '--hc-btn2-border',
  '--hc-btn2-icon',
  '--hc-email-selection-bg-image',
  '--hc-email-card-blur',
  '--hc-welcome-card-bg',
  '--hc-powered-by-text',
  '--hc-powered-by-text-label',
  '--hc-powered-by-text-name',
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
  '--hc-brand-logo-width',
  '--hc-brand-logo-max-height',
  '--hc-login-logo-height',
  '--hc-header-logo-height',
];

var LOGO_SIZE_LEGACY_MAP = {
  small: 60,
  medium: 100,
  large: 140,
  xlarge: 180,
};

var LOGO_SIZE_BASE = {
  width: 200,
  maxHeight: 72,
  loginHeight: 40,
  headerHeight: 19,
};

function resolveLogoSizePct(config) {
  var raw = config && config.headerLogoSize != null ? String(config.headerLogoSize).trim() : '';
  if (!raw) return 100;
  var legacy = LOGO_SIZE_LEGACY_MAP[raw.toLowerCase()];
  if (legacy != null) return legacy;
  var parsed = parseFloat(raw);
  if (!isFinite(parsed)) return 100;
  return Math.max(10, Math.min(200, Math.round(parsed)));
}

function applyHeaderLogoSize(config) {
  var pct = resolveLogoSizePct(config) / 100;
  setVar('--hc-brand-logo-width', Math.round(LOGO_SIZE_BASE.width * pct) + 'px');
  setVar('--hc-brand-logo-max-height', Math.round(LOGO_SIZE_BASE.maxHeight * pct) + 'px');
  setVar('--hc-login-logo-height', Math.round(LOGO_SIZE_BASE.loginHeight * pct) + 'px');
  setVar('--hc-header-logo-height', Math.round(LOGO_SIZE_BASE.headerHeight * pct) + 'px');
}

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

function normalizeHexInput(value) {
  var raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  var withHash = raw.charAt(0) === '#' ? raw : '#' + raw;
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    return (
      '#' +
      withHash.charAt(1) +
      withHash.charAt(1) +
      withHash.charAt(2) +
      withHash.charAt(2) +
      withHash.charAt(3) +
      withHash.charAt(3)
    ).toUpperCase();
  }
  return '';
}

function normalizeOpacityInput(value, fallback) {
  if (value == null || value === '') return fallback != null ? fallback : 100;
  var parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback != null ? fallback : 100;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function getRelativeLuminanceFromHex(hex) {
  var normalized = normalizeHexInput(hex);
  if (!normalized) return 0;
  var r = parseInt(normalized.slice(1, 3), 16);
  var g = parseInt(normalized.slice(3, 5), 16);
  var b = parseInt(normalized.slice(5, 7), 16);
  function linearize(channel) {
    var value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function getPoweredByTextVars(backgroundHex, opacityPercent, fallbackHex) {
  var opacity = normalizeOpacityInput(opacityPercent, 100);
  if (opacity <= 0) {
    return {
      '--hc-powered-by-text': '#FFFFFF',
      '--hc-powered-by-text-label': 'rgba(255, 255, 255, 0.62)',
      '--hc-powered-by-text-name': 'rgba(255, 255, 255, 0.92)',
    };
  }
  var hex = normalizeHexInput(backgroundHex) || fallbackHex || '#000000';
  if (getRelativeLuminanceFromHex(hex) > 0.179) {
    return {
      '--hc-powered-by-text': '#111111',
      '--hc-powered-by-text-label': 'rgba(17, 17, 17, 0.62)',
      '--hc-powered-by-text-name': 'rgba(17, 17, 17, 0.92)',
    };
  }
  return {
    '--hc-powered-by-text': '#FFFFFF',
    '--hc-powered-by-text-label': 'rgba(255, 255, 255, 0.62)',
    '--hc-powered-by-text-name': 'rgba(255, 255, 255, 0.92)',
  };
}

function applyPoweredByTextVars(config, pageBackgroundHex, pageBackgroundOpacity) {
  var vars = getPoweredByTextVars(
    pageBackgroundHex,
    pageBackgroundOpacity != null ? pageBackgroundOpacity : config && config.pageBackgroundOpacity,
    '#000000',
  );
  Object.keys(vars).forEach(function (name) {
    setVar(name, vars[name]);
  });
}

function setNoSchoolBrandState(isNoSchool) {
  if (!document || !document.documentElement) return;
  document.documentElement.classList.toggle('hc-embed--no-school-brand', !!isNoSchool);
}

export function applyBrandConfig(config, activeSchoolId) {
  brandConfig = config && typeof config === 'object' ? config : null;
  embedSchoolId = activeSchoolId
    ? String(activeSchoolId).trim().replace(/^\/+|\/+$/g, '')
    : '';
  if (!embedSchoolId) {
    clearBrandConfig();
    return;
  }

  setNoSchoolBrandState(false);

  var pageBackground = brandConfig && (brandConfig.pageBackground || brandConfig.backgroundColor);
  var cardBackground = brandConfig && (brandConfig.cardBackground || brandConfig.secondaryColor);
  var headingText = brandConfig && (brandConfig.headingText || brandConfig.darkColor);
  var bodyText = brandConfig && brandConfig.bodyText;
  var link = brandConfig && (brandConfig.link || brandConfig.linkColor || brandConfig.accentColor);
  var chrome = brandConfig && (brandConfig.chrome || brandConfig.chromeColor);
  var button = brandConfig && (brandConfig.button || brandConfig.buttonColor || brandConfig.buttonFillColor || brandConfig.primaryColor);
  var buttonPrimaryText = brandConfig && (brandConfig.buttonPrimaryText || brandConfig.buttonPrimaryTextColor);
  var buttonPrimaryBorder = brandConfig && (brandConfig.buttonPrimaryBorder || brandConfig.buttonPrimaryBorderColor);
  var buttonPrimaryIcon = brandConfig && (brandConfig.buttonPrimaryIcon || brandConfig.buttonPrimaryIconColor);
  var buttonSecondary = brandConfig && (brandConfig.buttonSecondary || brandConfig.buttonSecondaryColor);
  var buttonSecondaryText = brandConfig && (brandConfig.buttonSecondaryText || brandConfig.buttonSecondaryTextColor);
  var buttonSecondaryBorder = brandConfig && (brandConfig.buttonSecondaryBorder || brandConfig.buttonSecondaryBorderColor);
  var buttonSecondaryIcon = brandConfig && (brandConfig.buttonSecondaryIcon || brandConfig.buttonSecondaryIconColor);
  var loginBackground = brandConfig && brandConfig.loginBackgroundUrl;
  var emailSelectionBackground = brandConfig && brandConfig.emailSelectionBackgroundUrl;
  var defaultBackground = 'https://app.gethomecrowd.com/assets/app-images/load-in.jpg';
  var sharedBackground = emailSelectionBackground || loginBackground || defaultBackground;
  var loginButton = brandConfig && (brandConfig.loginButton || brandConfig.loginButtonColor);
  var loginButtonText = brandConfig && (brandConfig.loginButtonText || brandConfig.loginButtonTextColor);
  var loginTitle = brandConfig && (brandConfig.loginTitle || brandConfig.loginTitleColor);
  var loginText = brandConfig && (brandConfig.loginText || brandConfig.loginTextColor);
  var loginCardBackground = brandConfig && brandConfig.loginCardBackground;
  var formBlockBackground = readCssColor(
    brandConfig,
    'cardBackground',
    'cardBackgroundOpacity',
    cardBackground || loginCardBackground || '#FFFFFF',
    100,
  );

  var linkColor = readCssColor(brandConfig, 'link', 'linkOpacity', link, 100);

  setVar('--hc-preview-bg', readCssColor(brandConfig, 'pageBackground', 'pageBackgroundOpacity', pageBackground || '#FFFFFF', 0));
  setVar('--hc-preview-card', formBlockBackground);
  setVar('--hc-preview-text-primary', readCssColor(brandConfig, 'headingText', 'headingTextOpacity', headingText, 100));
  setVar('--hc-preview-text-secondary', readCssColor(brandConfig, 'bodyText', 'bodyTextOpacity', bodyText, 100));
  setVar('--hc-preview-link', linkColor);
  setVar('--hc-link', linkColor);
  setVar('--hc-preview-chrome', readCssColor(brandConfig, 'chrome', 'chromeOpacity', chrome, 100));
  setVar('--hc-chrome', readCssColor(brandConfig, 'chrome', 'chromeOpacity', chrome, 100));
  setVar('--hc-preview-primary', readCssColor(brandConfig, 'button', 'buttonOpacity', button, 100));
  setVar('--hc-preview-button-border', readCssColor(brandConfig, 'button', 'buttonOpacity', button, 100));
  setVar('--hc-preview-button-primary-text', readCssColor(brandConfig, 'buttonPrimaryText', 'buttonPrimaryTextOpacity', buttonPrimaryText, 100));
  setVar('--hc-btn1-border', readCssColor(brandConfig, 'buttonPrimaryBorder', 'buttonPrimaryBorderOpacity', buttonPrimaryBorder || button, 100));
  setVar('--hc-btn1-icon', readCssColor(brandConfig, 'buttonPrimaryIcon', 'buttonPrimaryIconOpacity', buttonPrimaryIcon || chrome, 100));
  setVar('--hc-preview-button-secondary', readCssColor(brandConfig, 'buttonSecondary', 'buttonSecondaryOpacity', buttonSecondary || pageBackground, 100));
  setVar('--hc-preview-button-secondary-text', readCssColor(brandConfig, 'buttonSecondaryText', 'buttonSecondaryTextOpacity', buttonSecondaryText || button, 100));
  setVar('--hc-btn2-border', readCssColor(brandConfig, 'buttonSecondaryBorder', 'buttonSecondaryBorderOpacity', buttonSecondaryBorder || button, 100));
  setVar('--hc-btn2-icon', readCssColor(brandConfig, 'buttonSecondaryIcon', 'buttonSecondaryIconOpacity', buttonSecondaryIcon || chrome, 100));
  setVar('--hc-email-selection-bg-image', 'url("' + sharedBackground + '")');
  setVar('--hc-email-card-blur', readBlurPx(brandConfig, 'emailSelectionCardBlur', 0));
  var schoolSolid =
    normalizeHexInput(button) ||
    normalizeHexInput(brandConfig && brandConfig.primaryColor) ||
    '#00C8FF';
  setVar('--hc-welcome-card-bg', schoolSolid);

  var loginBgUrl = loginBackground || emailSelectionBackground || defaultBackground;
  setVar('--hc-login-bg-image', 'url("' + loginBgUrl + '")');
  setVar('--hc-login-button', readCssColor(brandConfig, 'loginButton', 'loginButtonOpacity', loginButton, 100));
  setVar('--hc-login-button-text', readCssColor(brandConfig, 'loginButtonText', 'loginButtonTextOpacity', loginButtonText, 100));
  setVar('--hc-login-title', readCssColor(brandConfig, 'loginTitle', 'loginTitleOpacity', loginTitle, 100));
  setVar('--hc-login-text', readCssColor(brandConfig, 'loginText', 'loginTextOpacity', loginText, 100));
  setVar('--hc-login-signup', linkColor);
  setVar('--hc-login-card-bg', formBlockBackground);
  setVar('--hc-login-card-blur', readBlurPx(brandConfig, 'loginCardBlur', 50));
  applyPoweredByTextVars(
    brandConfig,
    pageBackground || '#FFFFFF',
    brandConfig && brandConfig.pageBackgroundOpacity != null && brandConfig.pageBackgroundOpacity !== ''
      ? brandConfig.pageBackgroundOpacity
      : 0,
  );
  applyHeaderLogoSize(brandConfig);

  if (document && document.documentElement) {
    document.documentElement.classList.add('hc-has-email-selection-bg');
  }
}

export function clearBrandConfig() {
  brandConfig = null;
  embedSchoolId = '';
  clearVars(PREVIEW_VARS);
  clearVars(LOGIN_VARS);
  setVar('--hc-preview-bg', 'transparent');
  setVar('--hc-login-card-bg', 'transparent');
  setNoSchoolBrandState(true);
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

export function hasSchoolBrand() {
  return !!embedSchoolId;
}

export function getEmbedSchoolId() {
  return embedSchoolId;
}

export function setEmbedSchoolId(schoolId) {
  embedSchoolId = String(schoolId || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (embedSchoolId) {
    setNoSchoolBrandState(false);
  }
}

export function getWelcomeScreenImageUrl() {
  if (!brandConfig) return '';
  var custom = (
    brandConfig.welcomeScreenImageUrl ||
    brandConfig.loginBackgroundUrl ||
    brandConfig.emailSelectionBackgroundUrl ||
    ''
  ).trim();
  return custom;
}

export function getSchoolColor() {
  if (!brandConfig) return '';
  return (
    normalizeHexInput(
      brandConfig.button ||
        brandConfig.buttonColor ||
        brandConfig.buttonFillColor ||
        brandConfig.primaryColor ||
        '',
    ) || ''
  );
}

export function getSchoolName() {
  if (!brandConfig) return '';
  return String(
    brandConfig.abbreviation ||
      brandConfig.Abbreviation ||
      brandConfig.abbr ||
      '',
  ).trim();
}

export function darkenHex(hex, amount) {
  var normalized = normalizeHexInput(hex);
  if (!normalized) return '';
  var factor = 1 - Math.min(1, Math.max(0, Number(amount) || 0));
  var r = Math.round(parseInt(normalized.slice(1, 3), 16) * factor);
  var g = Math.round(parseInt(normalized.slice(3, 5), 16) * factor);
  var b = Math.round(parseInt(normalized.slice(5, 7), 16) * factor);
  function toHex(n) {
    return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
  }
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

export function renderPoweredByLockup(className) {
  var extra = className ? ' ' + escapeHtml(className) : '';
  return (
    '<div class="hc-header-powered' +
    extra +
    '">' +
    '<span class="hc-header-powered-label">POWERED BY</span>' +
    '<span class="hc-header-powered-logo" role="img" aria-label="Homecrowd"></span>' +
    '</div>'
  );
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
    renderPoweredByLockup() +
    '</div>'
  );
}
