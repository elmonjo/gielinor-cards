import { cardsBase } from "./cardCatalogBase";
import { skillCards } from "./catalog/skills";
import { gearCards } from "./catalog/gear";
import { questCards } from "./catalog/quests";
import { bossCards } from "./catalog/bosses";
import { minigameCards } from "./catalog/minigames";
import { diaryCards } from "./catalog/diaries";

const knownIds = new Set([
  ...skillCards.map((card) => card.id),
  ...gearCards.map((card) => card.id),
  ...questCards.map((card) => card.id),
  ...bossCards.map((card) => card.id),
  ...minigameCards.map((card) => card.id),
  ...diaryCards.map((card) => card.id)
]);

const otherCards = cardsBase.filter((card) => !knownIds.has(card.id));

const grouped = [
  ...skillCards,
  ...gearCards,
  ...questCards,
  ...bossCards,
  ...minigameCards,
  ...diaryCards,
  ...otherCards
].sort((a, b) => a.__order - b.__order);

export const cards = grouped.map(({ __order, ...card }) => card);

export const cardMetaById = Object.fromEntries(
  cards.map((card) => [
    card.id,
    {
      requirements: card.requirements,
      source: card.source,
      packReason: card.packReason,
      wikiPage: card.wikiPage
    }
  ])
);

