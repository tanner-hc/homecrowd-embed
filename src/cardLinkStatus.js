export function resolveCardLinkStatus(freshUser, paymentCardsResponse) {
  if (freshUser && freshUser.active_school && freshUser.active_school.early_release) {
    return 'linked';
  }

  if (!paymentCardsResponse) {
    return null;
  }

  var cardsRaw =
    paymentCardsResponse.results || paymentCardsResponse.data || paymentCardsResponse;
  var cards = Array.isArray(cardsRaw) ? cardsRaw : null;

  if (!cards) {
    return null;
  }

  var activeCards = cards.filter(function (card) {
    return ((card && card.status) || 'active') === 'active';
  });
  return activeCards.length > 0 ? 'linked' : 'unlinked';
}
