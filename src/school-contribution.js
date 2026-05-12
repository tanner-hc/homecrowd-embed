export function pickSchoolName(user) {
  if (!user || typeof user !== 'object') return 'your school';
  var s = user.active_school || user.activeSchool;
  if (s && typeof s === 'object' && s.name) return String(s.name);
  return 'your school';
}

export function computeSchoolCashback(transactionsRes) {
  if (!transactionsRes) return 0;
  var txns =
    transactionsRes.transactions || transactionsRes.results || transactionsRes;
  if (!Array.isArray(txns)) return 0;
  var total = 0;
  var i;
  for (i = 0; i < txns.length; i++) {
    var t = txns[i];
    var commission = parseFloat(t.commission_amount) || 0;
    var split = parseFloat(t.school_commission_split) || 0;
    if (commission > 0) {
      total += commission * split;
    }
  }
  return total;
}
