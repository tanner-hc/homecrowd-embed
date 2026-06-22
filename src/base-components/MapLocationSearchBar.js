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

export default function MapLocationSearchBar(props) {
  props = props || {};
  var inputId = props.inputId || 'hc-offers-map-search-input';
  var buttonId = props.buttonId || 'hc-offers-map-search-btn';
  var disabled = !!props.disabled;

  return (
    '<div class="hc-offers-map-location-search">' +
    '<div class="hc-offers-map-location-search-row">' +
    '<label class="hc-offers-map-location-field" for="' +
    escapeHtml(inputId) +
    '">' +
    '<span class="hc-offers-map-location-icon">' +
    MAP_LOCATION_ICON_SVG +
    '</span>' +
    '<input type="search" class="hc-offers-map-location-input" id="' +
    escapeHtml(inputId) +
    '" placeholder="City or zip code" autocomplete="off" enterkeyhint="search"' +
    (disabled ? ' disabled' : '') +
    ' />' +
    '</label>' +
    '<button type="button" class="hc-offers-map-search-submit" id="' +
    escapeHtml(buttonId) +
    '"' +
    (disabled ? ' disabled' : '') +
    ' aria-label="Search">' +
    SEARCH_ICON_SVG +
    '</button>' +
    '</div></div>'
  );
}
