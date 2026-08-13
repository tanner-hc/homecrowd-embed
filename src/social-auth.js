import * as api from './api.js';
import { shouldShowAppleSignIn } from './platform.js';

export { shouldShowAppleSignIn };

var APPLE_SCRIPT = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
var OAUTH_RESULT_KEY = 'hc_google_oauth_result';
var OAUTH_RETURN_KEY = 'hc_oauth_return';
var OAUTH_STATE_KEY = 'hc_oauth_state';
var OAUTH_NONCE_KEY = 'hc_oauth_nonce';

function envValue(name) {
  if (typeof import.meta === 'undefined' || !import.meta.env) return '';
  var value = import.meta.env[name];
  return value ? String(value).trim() : '';
}

function googleClientId() {
  return (
    envValue('VITE_GOOGLE_CLIENT_ID') ||
    '704171280414-j05liginmmtv42rgr6gslspflad22f2m.apps.googleusercontent.com'
  );
}

function appleClientId() {
  return envValue('VITE_APPLE_CLIENT_ID') || 'com.tanlenon.homecrowd.web';
}

function oauthCallbackUrl() {
  return window.location.origin + '/oauth-callback.html';
}

function appleRedirectUrl() {
  return window.location.origin + '/oauth-callback';
}

function randomString() {
  var bytes = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  var out = '';
  for (var j = 0; j < bytes.length; j++) {
    out += ('0' + bytes[j].toString(16)).slice(-2);
  }
  return out;
}

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    if (window.AppleID && window.AppleID.auth) {
      resolve();
      return;
    }
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing) {
      if (existing.getAttribute('data-hc-loaded') === '1') {
        resolve();
        return;
      }
      existing.addEventListener('load', function () {
        resolve();
      });
      existing.addEventListener('error', function () {
        reject(new Error('Failed to load sign-in'));
      });
      return;
    }
    var script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = function () {
      script.setAttribute('data-hc-loaded', '1');
      resolve();
    };
    script.onerror = function () {
      reject(new Error('Failed to load sign-in'));
    };
    document.head.appendChild(script);
  });
}

function takeSessionJson(key) {
  try {
    var raw = sessionStorage.getItem(key);
    if (!raw) return null;
    sessionStorage.removeItem(key);
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

export function takePendingGoogleOAuth() {
  return takeSessionJson(OAUTH_RESULT_KEY);
}

function storeOAuthReturn() {
  try {
    sessionStorage.setItem(OAUTH_RETURN_KEY, window.location.href);
  } catch (_e) { }
}

function googleAuthUrl(state, nonce) {
  var params = new URLSearchParams();
  params.set('client_id', googleClientId());
  params.set('redirect_uri', oauthCallbackUrl());
  params.set('response_type', 'id_token');
  params.set('scope', 'openid email profile');
  params.set('nonce', nonce);
  params.set('state', state);
  params.set('prompt', 'select_account');
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
}

function waitForGooglePopup(popup, expectedState) {
  return new Promise(function (resolve, reject) {
    var settled = false;
    var timer = 0;

    function finish(err, payload) {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
      try {
        popup.close();
      } catch (_e) { }
      if (err) reject(err);
      else resolve(payload);
    }

    function onMessage(event) {
      if (event.origin !== window.location.origin) return;
      var data = event.data;
      if (!data || data.type !== 'hc-google-oauth') return;
      if (data.state && data.state !== expectedState) {
        finish(new Error('Google Sign-In failed'));
        return;
      }
      if (data.error) {
        if (data.error === 'access_denied') {
          finish(new Error('cancelled'));
          return;
        }
        finish(new Error(data.error_description || 'Google Sign-In failed'));
        return;
      }
      if (!data.id_token) {
        finish(new Error('Google Sign-In failed: missing id_token'));
        return;
      }
      finish(null, data.id_token);
    }

    window.addEventListener('message', onMessage);
    timer = window.setTimeout(function () {
      finish(new Error('cancelled'));
    }, 5 * 60 * 1000);
  });
}

export function signInWithGoogle() {
  var pending = takePendingGoogleOAuth();
  if (pending) {
    if (pending.id_token) return Promise.resolve(pending.id_token);
    if (pending.error === 'access_denied') {
      return Promise.reject(new Error('cancelled'));
    }
    return Promise.reject(new Error(pending.error_description || pending.error || 'Google Sign-In failed'));
  }

  var state = randomString();
  var nonce = randomString();
  try {
    sessionStorage.setItem(OAUTH_STATE_KEY, state);
    sessionStorage.setItem(OAUTH_NONCE_KEY, nonce);
  } catch (_e) { }
  storeOAuthReturn();

  var url = googleAuthUrl(state, nonce);
  var width = 500;
  var height = 640;
  var left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  var top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  var popup = window.open(
    url,
    'hc-google-oauth',
    'popup=yes,width=' + width + ',height=' + height + ',left=' + left + ',top=' + top,
  );

  if (!popup || popup.closed) {
    window.location.assign(url);
    return new Promise(function () { });
  }

  return waitForGooglePopup(popup, state);
}

export function signInWithApple() {
  if (!shouldShowAppleSignIn()) {
    return Promise.reject(new Error('Sign in with Apple is not available on this device'));
  }

  return loadScript(APPLE_SCRIPT).then(function () {
    if (!window.AppleID || !window.AppleID.auth) {
      throw new Error('Sign in with Apple is not available');
    }
    window.AppleID.auth.init({
      clientId: appleClientId(),
      scope: 'name email',
      redirectURI: appleRedirectUrl(),
      usePopup: true,
      state: randomString(),
      nonce: randomString(),
    });
    return window.AppleID.auth.signIn();
  }).then(function (response) {
    var authorization = response && response.authorization ? response.authorization : {};
    var identityToken = authorization.id_token;
    if (!identityToken) {
      throw new Error('Sign in with Apple failed: missing identity token');
    }
    var name = null;
    var user = response && response.user;
    if (user && user.name) {
      var firstName = user.name.firstName || user.name.givenName || '';
      var lastName = user.name.lastName || user.name.familyName || '';
      if (firstName || lastName) {
        name = { first_name: firstName, last_name: lastName };
      }
    }
    return { identity_token: identityToken, name: name };
  }).catch(function (err) {
    var code = err && (err.error || err.code || err.message);
    if (
      code === 'popup_closed_by_user' ||
      code === 'user_cancelled_authorize' ||
      code === 'cancelled'
    ) {
      throw new Error('cancelled');
    }
    if (err instanceof Error) throw err;
    throw new Error(code || 'Sign in with Apple failed');
  });
}

export function authenticateWithGoogle() {
  return signInWithGoogle().then(function (idToken) {
    return api.googleLogin(idToken);
  });
}

export function authenticateWithApple() {
  return signInWithApple().then(function (apple) {
    return api.appleLogin(apple.identity_token, apple.name);
  });
}

export function isSocialAuthCancelled(err) {
  return String((err && err.message) || '') === 'cancelled';
}
