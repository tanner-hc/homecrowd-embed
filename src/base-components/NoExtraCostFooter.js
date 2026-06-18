export default function NoExtraCostFooter(opts) {
  opts = opts || {};
  var className = opts.className
    ? 'hc-no-extra-cost-footer ' + opts.className
    : 'hc-no-extra-cost-footer';
  var text = opts.text || 'No extra cost to you. Ever.';
  return (
    '<div class="' + className + '">' +
    '<div class="hc-no-extra-cost-footer-line"></div>' +
    '<div class="hc-no-extra-cost-footer-text">' + text + '</div>' +
    '<div class="hc-no-extra-cost-footer-line"></div>' +
    '</div>'
  );
}
