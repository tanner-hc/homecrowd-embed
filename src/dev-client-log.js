function serializeArg(a) {
  if (a instanceof Error) {
    return a.name + ': ' + (a.message || '') + (a.stack ? '\n' + a.stack : '');
  }
  if (typeof a === 'object' && a !== null) {
    try {
      return JSON.stringify(a);
    } catch (e) {
      return String(a);
    }
  }
  return String(a);
}

function forward(level, args) {
  fetch('/__hc_browser_log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      level: level,
      args: Array.prototype.slice.call(args).map(serializeArg),
      t: Date.now(),
    }),
  }).catch(function () {});
}

if (import.meta.env.DEV) {
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
    var orig = console[level];
    if (typeof orig !== 'function') return;
    console[level] = function () {
      orig.apply(console, arguments);
      try {
        forward(level, arguments);
      } catch (e) {}
    };
  });
}
