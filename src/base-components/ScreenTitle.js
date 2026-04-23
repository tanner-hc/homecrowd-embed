import { escapeHtml, joinClasses } from './html.js';

export default function ScreenTitle(props) {
  props = props || {};
  var title = props.title ? escapeHtml(props.title) : '';
  var subtitle = props.subtitle ? escapeHtml(props.subtitle) : '';
  var extra = props.className ? ' ' + props.className : '';

  var titleTag =
    props.titleSize != null
      ? ' style="font-size:' + Number(props.titleSize) + 'px"'
      : '';
  var subtitleTag =
    props.subtitleSize != null
      ? ' style="font-size:' + Number(props.subtitleSize) + 'px"'
      : '';

  var titleBlock = title
    ? '<h1 class="hc-bc-screen-title"' + titleTag + '>' + title + '</h1>'
    : '';
  var subtitleBlock = subtitle
    ? '<p class="hc-bc-screen-subtitle"' + subtitleTag + '>' + subtitle + '</p>'
    : '';

  return (
    '<div class="' +
    joinClasses('hc-bc-screen-title-wrap', extra) +
    '">' +
    titleBlock +
    subtitleBlock +
    '</div>'
  );
}
