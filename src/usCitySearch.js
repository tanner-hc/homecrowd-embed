import usCities from './constants/USCities.json';

var SUGGESTION_LIMIT = 8;
var MIN_QUERY_LENGTH = 2;
var indexes = null;

function formatZip(zipCode) {
  return String(zipCode).padStart(5, '0');
}

function toLocation(entry) {
  return {
    latitude: entry.latitude,
    longitude: entry.longitude,
  };
}

function buildIndexes() {
  var uniqueCities = new Map();
  var zipEntries = [];
  var zipByExact = new Map();

  usCities.forEach(function (entry) {
    var zip = formatZip(entry.zip_code);
    zipEntries.push({ zip: zip, entry: entry });
    zipByExact.set(zip, entry);

    var cityKey = entry.city.toLowerCase() + '|' + entry.state;
    if (!uniqueCities.has(cityKey)) {
      uniqueCities.set(cityKey, entry);
    }
  });

  zipEntries.sort(function (a, b) {
    return a.zip.localeCompare(b.zip);
  });

  var cityList = Array.from(uniqueCities.values()).sort(function (a, b) {
    return a.city.localeCompare(b.city);
  });

  return {
    zipEntries: zipEntries,
    cityList: cityList,
    zipByExact: zipByExact,
  };
}

function ensureIndexes() {
  if (!indexes) {
    indexes = buildIndexes();
  }
  return indexes;
}

function formatCitySuggestion(entry) {
  return {
    id: 'city:' + entry.city + '|' + entry.state,
    label: entry.city + ', ' + entry.state,
    entry: entry,
  };
}

function formatZipSuggestion(entry, zip) {
  return {
    id: 'zip:' + zip,
    label: entry.city + ', ' + entry.state + ' ' + zip,
    entry: entry,
  };
}

export function searchUSCities(query, limit) {
  var q = String(query || '').trim();
  var max = Number.isFinite(limit) ? limit : SUGGESTION_LIMIT;
  if (q.length < MIN_QUERY_LENGTH) return [];

  var data = ensureIndexes();
  var results = [];
  var seen = new Set();
  var isNumeric = /^\d+$/.test(q);

  if (isNumeric) {
    for (var i = 0; i < data.zipEntries.length; i += 1) {
      var zipItem = data.zipEntries[i];
      if (!zipItem.zip.startsWith(q)) {
        if (zipItem.zip > q) break;
        continue;
      }
      var zipId = 'zip:' + zipItem.zip;
      if (seen.has(zipId)) continue;
      seen.add(zipId);
      results.push(formatZipSuggestion(zipItem.entry, zipItem.zip));
      if (results.length >= max) break;
    }
    return results;
  }

  var qLower = q.toLowerCase();
  for (var j = 0; j < data.cityList.length; j += 1) {
    var cityEntry = data.cityList[j];
    if (!cityEntry.city.toLowerCase().startsWith(qLower)) continue;
    var cityId = 'city:' + cityEntry.city + '|' + cityEntry.state;
    if (seen.has(cityId)) continue;
    seen.add(cityId);
    results.push(formatCitySuggestion(cityEntry));
    if (results.length >= max) break;
  }

  return results;
}

export function lookupUSCity(query) {
  var q = String(query || '').trim();
  if (!q) return null;

  var data = ensureIndexes();

  if (/^\d+$/.test(q)) {
    var zip = formatZip(q);
    var zipEntry = data.zipByExact.get(zip);
    if (zipEntry) return toLocation(zipEntry);
  }

  var commaMatch = q.match(/^([^,]+),\s*([A-Za-z]{2})$/);
  if (commaMatch) {
    var cityName = commaMatch[1].trim().toLowerCase();
    var state = commaMatch[2].toUpperCase();
    for (var i = 0; i < data.cityList.length; i += 1) {
      var stateEntry = data.cityList[i];
      if (stateEntry.city.toLowerCase() === cityName && stateEntry.state === state) {
        return toLocation(stateEntry);
      }
    }
  }

  var qLower = q.toLowerCase();
  for (var j = 0; j < data.cityList.length; j += 1) {
    var exactEntry = data.cityList[j];
    if (exactEntry.city.toLowerCase() === qLower) {
      return toLocation(exactEntry);
    }
  }

  var suggestions = searchUSCities(q, 1);
  return suggestions[0] ? toLocation(suggestions[0].entry) : null;
}
