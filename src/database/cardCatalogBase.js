import { cards as rawCards } from "./cards";

function deriveWikiPage(card) {
  if (!card?.title) return null;
  return card.title;
}

export const cardsBase = rawCards.map((card, index) => ({
  __order: index,
  requirements: null,
  source: null,
  packReason: null,
  wikiPage: deriveWikiPage(card),
  ...card
}));

