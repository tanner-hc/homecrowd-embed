import { escapeHtml } from './html.js';

var MAP_LOCATION_ICON_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z" stroke="currentColor" stroke-width="1.8"/>' +
  '<circle cx="12" cy="11" r="2.5" stroke="currentColor" stroke-width="1.8"/>' +
  '</svg>';
var SEARCH_ICON_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  '</svg>';

/**
 * @param {{
 *   inputId?: string, buttonId?: string, suggestionsId?: string, disabled?: boolean,
 *   variant?: 'default' | 'pill',
 * }} [props]
 *
 * `pill` is the full-screen map's treatment (Figma 1209:7647): one rounded field
 * floating over the map with the magnifier inside it on the left, and no location
 * pin. The magnifier stays a real submit button rather than becoming decorative —
 * initOffersMap's search path bails when #hc-offers-map-search-btn is missing.
 */
export default function MapLocationSearchBar(props) {
  props = props || {};
  var inputId = props.inputId || 'hc-offers-map-search-input';
  var buttonId = props.buttonId || 'hc-offers-map-search-btn';
  var suggestionsId = props.suggestionsId || 'hc-offers-map-search-suggestions';
  var disabled = !!props.disabled;
  var isPill = props.variant === 'pill';

  var submitHtml =
    '<button type="button" class="hc-offers-map-search-submit" id="' +
    escapeHtml(buttonId) +
    '"' +
    (disabled ? ' disabled' : '') +
    ' aria-label="Search">' +
    SEARCH_ICON_SVG +
    '</button>';

  var fieldHtml =
    '<label class="hc-offers-map-location-field" for="' +
    escapeHtml(inputId) +
    '">' +
    (isPill ? '' : '<span class="hc-offers-map-location-icon">' + MAP_LOCATION_ICON_SVG + '</span>') +
    '<input type="search" class="hc-offers-map-location-input" id="' +
    escapeHtml(inputId) +
    '" placeholder="' +
    // Keeps the design's single-field pill while still saying what it searches.
    (isPill ? 'Search city or zip code' : 'City or zip code') +
    '" autocomplete="off" enterkeyhint="search"' +
    (disabled ? ' disabled' : '') +
    ' />' +
    '</label>';

  return (
    '<div class="hc-offers-map-location-search' +
    (isPill ? ' hc-offers-map-location-search--pill' : '') +
    '">' +
    '<div class="hc-offers-map-location-search-row">' +
    (isPill ? submitHtml + fieldHtml : fieldHtml + submitHtml) +
    '</div>' +
    '<div class="hc-offers-map-search-suggestions" id="' +
    escapeHtml(suggestionsId) +
    '" style="display:none"></div>' +
    '</div>'
  );
}
