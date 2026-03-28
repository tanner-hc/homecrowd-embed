var currentView = null;
var listeners = [];

export function navigate(hash) {
  window.location.hash = hash;
}

export function getRoute() {
  return window.location.hash.replace(/^#\/?/, '/') || '/';
}

export function onRouteChange(fn) {
  listeners.push(fn);
}

export function startRouter() {
  function notify() {
    var route = getRoute();
    if (route !== currentView) {
      currentView = route;
      listeners.forEach(function (fn) { fn(route); });
    }
  }
  window.addEventListener('hashchange', notify);
  notify();
}
