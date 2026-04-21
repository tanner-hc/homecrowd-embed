export function formatDisplayNumber(n) {
  var x = Number(n) || 0;
  try {
    return x
      .toLocaleString('fr-FR')
      .replace(/\u202f/g, ' ')
      .replace(/\u00a0/g, ' ');
  } catch (e) {
    return String(x);
  }
}
