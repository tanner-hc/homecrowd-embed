export async function geocodePlaceQuery(query) {
  var q = String(query || '').trim();
  if (!q) return null;

  try {
    var url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('q', q);
    url.searchParams.set('countrycodes', 'us');
    url.searchParams.set('limit', '1');
    var res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    var data = await res.json();
    var hit = Array.isArray(data) ? data[0] : null;
    if (!hit) return null;
    var lat = parseFloat(hit.lat);
    var lng = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      latitude: lat,
      longitude: lng,
      label: hit.display_name || q,
    };
  } catch (error) {
    console.error('Geocoding failed:', error);
    return null;
  }
}

function readCoords(position) {
  var coords = position && position.coords;
  if (!coords) return null;
  var lat = Number(coords.latitude);
  var lng = Number(coords.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

export function getCheckInLocation() {
  return new Promise(function (resolve) {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    function tryOnce(options, onFail) {
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolve(readCoords(pos));
        },
        function (err) {
          onFail(err);
        },
        options
      );
    }

    tryOnce(
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      function () {
        tryOnce(
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
          function () {
            resolve(null);
          }
        );
      }
    );
  });
}
