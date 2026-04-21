import { joinClasses } from './html.js';

export default function StepProgress(props) {
  props = props || {};
  var currentStep = Number(props.currentStep) || 1;
  var totalSteps = Number(props.totalSteps) || 1;
  var extra = props.className ? ' ' + props.className : '';

  var pct = Math.round((currentStep / totalSteps) * 100);

  var segments = [];
  for (var i = 0; i < totalSteps; i++) {
    var cls =
      i < currentStep - 1
        ? 'hc-bc-step-segment hc-bc-step-segment--done'
        : i === currentStep - 1
          ? 'hc-bc-step-segment hc-bc-step-segment--active'
          : 'hc-bc-step-segment hc-bc-step-segment--idle';
    segments.push('<span class="' + cls + '" role="presentation"></span>');
  }

  return (
    '<div class="' +
    joinClasses('hc-bc-step-progress', extra) +
    '">' +
    '<div class="hc-bc-step-progress-meta">' +
    '<span class="hc-bc-step-progress-label">Step ' +
    currentStep +
    ' of ' +
    totalSteps +
    '</span>' +
    '<span class="hc-bc-step-progress-pct">' +
    pct +
    '%</span>' +
    '</div>' +
    '<div class="hc-bc-step-progress-bar">' +
    segments.join('') +
    '</div>' +
    '</div>'
  );
}
