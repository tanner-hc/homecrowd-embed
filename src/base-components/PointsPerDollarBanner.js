export default function PointsPerDollarBanner(opts) {
  opts = opts || {};
  var className = opts.attached
    ? 'hc-stores-points-banner hc-stores-points-banner--attached'
    : 'hc-stores-points-banner';
  return (
    '<div class="' + className + '">' +
    '<div class="hc-stores-points-banner-title">Earn 1 point per $1 spent</div>' +
    '</div>'
  );
}
