import { createWorker } from 'tesseract.js';

function luhnOk(digits) {
  var sum = 0;
  var alt = false;
  for (var i = digits.length - 1; i >= 0; i--) {
    var n = parseInt(digits.charAt(i), 10);
    if (!Number.isFinite(n)) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function findCardNumber(text) {
  var compact = String(text || '')
    .replace(new RegExp('[Oo]', 'g'), '0')
    .replace(new RegExp('[Il]', 'g'), '1');
  var candidates = [];
  var spaced = compact.match(new RegExp('(?:\\d[\\s-]*){13,19}', 'g')) || [];
  spaced.forEach(function (chunk) {
    var digits = chunk.replace(new RegExp('\\D', 'g'), '');
    if (digits.length >= 13 && digits.length <= 19 && luhnOk(digits)) {
      candidates.push(digits);
    }
  });
  if (!candidates.length) {
    var onlyDigits = compact.replace(new RegExp('\\D', 'g'), ' ');
    var runs = onlyDigits.match(new RegExp('\\d{13,19}', 'g')) || [];
    runs.forEach(function (digits) {
      if (luhnOk(digits)) candidates.push(digits);
    });
  }
  if (!candidates.length) return '';
  candidates.sort(function (a, b) {
    return b.length - a.length;
  });
  return candidates[0];
}

function findExpiry(text) {
  var src = String(text || '');
  var m =
    src.match(new RegExp('\\b(0[1-9]|1[0-2])\\s*[\\/-]\\s*([0-9]{2})\\b')) ||
    src.match(new RegExp('\\b(0[1-9]|1[0-2])\\s*([0-9]{2})\\b'));
  if (!m) return null;
  return { month: m[1], year: m[2] };
}

function findHolderName(text) {
  var lines = String(text || '')
    .split(new RegExp('\\n+'))
    .map(function (l) {
      return l.trim();
    })
    .filter(Boolean);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (new RegExp('^\\d').test(line)) continue;
    if (new RegExp('expir|valid|thru|month|year|cvv|cvc|visa|master|debit|credit', 'i').test(line)) {
      continue;
    }
    if (new RegExp('\\d{4}').test(line)) continue;
    var cleaned = line
      .replace(new RegExp("[^A-Za-z .'-]", 'g'), ' ')
      .replace(new RegExp('\\s+', 'g'), ' ')
      .trim();
    var parts = cleaned.split(' ').filter(Boolean);
    if (parts.length >= 2 && parts.length <= 4 && cleaned.length >= 5 && cleaned.length <= 40) {
      var upper = cleaned.toUpperCase();
      if (upper === cleaned || cleaned === cleaned.toLowerCase()) {
        return cleaned.replace(new RegExp('\\b\\w', 'g'), function (c) {
          return c.toUpperCase();
        });
      }
      return cleaned;
    }
  }
  return '';
}

/**
 * @param {string} text
 * @returns {{ cardNumber: string, expiryMonth?: string, expiryYear?: string, holderName?: string } | null}
 */
export function parseCardScanText(text) {
  var cardNumber = findCardNumber(text);
  if (!cardNumber) return null;
  var expiry = findExpiry(text);
  var holderName = findHolderName(text);
  return {
    cardNumber: cardNumber,
    expiryMonth: expiry ? expiry.month : '',
    expiryYear: expiry ? expiry.year : '',
    holderName: holderName || '',
  };
}

function isPermissionDeniedError(err) {
  if (!err) return false;
  var name = String(err.name || '');
  var msg = String(err.message || '').toLowerCase();
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return true;
  }
  if (msg.indexOf('permission') >= 0 || msg.indexOf('not allowed') >= 0 || msg.indexOf('denied') >= 0) {
    return true;
  }
  return false;
}

function getUserMediaFn() {
  if (typeof navigator === 'undefined') return null;
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
    return function (constraints) {
      return navigator.mediaDevices.getUserMedia(constraints);
    };
  }
  var legacy =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;
  if (!legacy) return null;
  return function (constraints) {
    return new Promise(function (resolve, reject) {
      legacy.call(navigator, constraints, resolve, reject);
    });
  };
}

async function requestCameraStream() {
  var getUserMedia = getUserMediaFn();
  if (!getUserMedia) {
    var unsupported = new Error('Camera not supported');
    unsupported.name = 'NotSupportedError';
    throw unsupported;
  }

  var attempts = [
    { audio: false, video: { facingMode: { ideal: 'environment' } } },
    { audio: false, video: { facingMode: 'environment' } },
    { audio: false, video: true },
  ];

  var lastErr = null;
  for (var i = 0; i < attempts.length; i++) {
    try {
      return await getUserMedia(attempts[i]);
    } catch (err) {
      lastErr = err;
      if (isPermissionDeniedError(err)) throw err;
    }
  }
  throw lastErr || new Error('Camera unavailable');
}

/**
 * Fullscreen camera card scanner (mobile LinkCardsScreen modal 1:1).
 * @param {{
 *   onScan: function({ cardNumber: string, expiryMonth?: string, expiryYear?: string, holderName?: string }),
 *   onClose?: function,
 *   onPermissionDenied?: function,
 *   stream?: MediaStream,
 * }} options
 * @returns {{ close: function }}
 */
export function openCardScanner(options) {
  options = options || {};
  var closed = false;
  var stream = options.stream || null;
  var ownsStream = !options.stream;
  var worker = null;
  var loopTimer = 0;
  var recognizing = false;
  var gotResult = false;

  var root = document.createElement('div');
  root.className = 'hc-card-scanner';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML =
    '<div class="hc-card-scanner-camera">' +
    '<video class="hc-card-scanner-video" playsinline muted autoplay></video>' +
    '<canvas class="hc-card-scanner-canvas" hidden></canvas>' +
    '<div class="hc-card-scanner-frame" aria-hidden="true"></div>' +
    '<div class="hc-card-scanner-hint">Hold your card inside the frame</div>' +
    '<div class="hc-card-scanner-status" data-scanner-status>Starting camera…</div>' +
    '</div>' +
    '<div class="hc-card-scanner-sheet">' +
    '<div class="hc-card-scanner-sheet-title">Scan your card</div>' +
    '<div class="hc-card-scanner-sheet-subtitle">' +
    'Make sure the details are readable while scanning. You can still make edits after the scan is done.' +
    '</div>' +
    '<button type="button" class="hc-card-scanner-manual" data-scanner-manual>Enter details manually</button>' +
    '</div>';

  document.body.appendChild(root);

  var video = root.querySelector('.hc-card-scanner-video');
  var canvas = root.querySelector('.hc-card-scanner-canvas');
  var statusEl = root.querySelector('[data-scanner-status]');
  var manualBtn = root.querySelector('[data-scanner-manual]');

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || '';
  }

  function stopStream() {
    if (!ownsStream || !stream) return;
    stream.getTracks().forEach(function (track) {
      try {
        track.stop();
      } catch (_e) {}
    });
    stream = null;
  }

  function destroyWorker() {
    if (!worker) return;
    var w = worker;
    worker = null;
    try {
      w.terminate();
    } catch (_e) {}
  }

  function close() {
    if (closed) return;
    closed = true;
    window.clearTimeout(loopTimer);
    stopStream();
    destroyWorker();
    if (root.parentNode) root.parentNode.removeChild(root);
    if (typeof options.onClose === 'function') options.onClose();
  }

  function finishScan(card) {
    if (gotResult || closed) return;
    gotResult = true;
    window.clearTimeout(loopTimer);
    setStatus('Card found');
    if (typeof options.onScan === 'function') {
      options.onScan(card);
    }
    close();
  }

  async function ensureWorker() {
    if (worker) return worker;
    setStatus('Loading scanner…');
    worker = await createWorker('eng', 1, {
      logger: function () {},
    });
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz /-',
    });
    return worker;
  }

  function grabFrameFromVideo() {
    if (!video || !canvas || !video.videoWidth) return null;
    var vw = video.videoWidth;
    var vh = video.videoHeight;
    var cropW = Math.floor(vw * 0.86);
    var cropH = Math.floor(cropW * 0.63);
    if (cropH > vh * 0.55) cropH = Math.floor(vh * 0.55);
    var sx = Math.floor((vw - cropW) / 2);
    var sy = Math.floor((vh - cropH) / 2);
    canvas.width = cropW;
    canvas.height = cropH;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
    try {
      var imageData = ctx.getImageData(0, 0, cropW, cropH);
      var data = imageData.data;
      for (var i = 0; i < data.length; i += 4) {
        var gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        var v = gray > 140 ? 255 : gray < 90 ? 0 : gray;
        data[i] = data[i + 1] = data[i + 2] = v;
      }
      ctx.putImageData(imageData, 0, 0);
    } catch (_e) {}
    return canvas;
  }

  async function recognizeLoop() {
    if (closed || gotResult) return;
    if (recognizing) {
      loopTimer = window.setTimeout(recognizeLoop, 400);
      return;
    }
    recognizing = true;
    try {
      var frame = grabFrameFromVideo();
      if (frame) {
        var w = await ensureWorker();
        setStatus('Looking for card…');
        var result = await w.recognize(frame);
        var text = (result && result.data && result.data.text) || '';
        var parsed = parseCardScanText(text);
        if (parsed && parsed.cardNumber) {
          finishScan(parsed);
          return;
        }
      }
    } catch (_err) {
      setStatus('Keep the card steady…');
    } finally {
      recognizing = false;
    }
    if (!closed && !gotResult) {
      loopTimer = window.setTimeout(recognizeLoop, 650);
    }
  }

  async function attachStream(nextStream) {
    stream = nextStream;
    ownsStream = true;
    if (video) {
      video.hidden = false;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      try {
        await video.play();
      } catch (_playErr) {}
    }
    setStatus('Hold your card inside the frame');
    loopTimer = window.setTimeout(recognizeLoop, 400);
  }

  if (manualBtn) {
    manualBtn.addEventListener('click', function () {
      close();
    });
  }

  (async function start() {
    if (stream) {
      try {
        await attachStream(stream);
      } catch (_e) {
        setStatus('Camera failed to start');
        if (typeof options.onPermissionDenied === 'function') {
          options.onPermissionDenied(_e);
        }
        close();
      }
      return;
    }

    try {
      setStatus('Requesting camera…');
      var next = await requestCameraStream();
      if (closed) {
        next.getTracks().forEach(function (t) {
          try {
            t.stop();
          } catch (_e2) {}
        });
        return;
      }
      await attachStream(next);
    } catch (err) {
      if (typeof options.onPermissionDenied === 'function' && isPermissionDeniedError(err)) {
        options.onPermissionDenied(err);
      } else if (typeof options.onPermissionDenied === 'function') {
        options.onPermissionDenied(err);
      }
      close();
    }
  })();

  return { close: close };
}

export async function openCardScannerWithPermission(options) {
  options = options || {};
  var stream = null;
  try {
    stream = await requestCameraStream();
  } catch (err) {
    if (typeof options.onPermissionDenied === 'function') {
      options.onPermissionDenied(err);
    }
    return { close: function () {} };
  }
  return openCardScanner(Object.assign({}, options, { stream: stream }));
}
