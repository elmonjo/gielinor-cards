import { PATHS } from "./pathConfig";
import { cards } from "../database/cardCatalog";

export function isPathUnlocked(profile, pathName) {
  const index = PATHS.findIndex(p => p.name === pathName);

  // First tier always unlocked
  if (index === 0) return true;

  const previousPath = PATHS[index - 1];

  const previousCards = cards.filter(c => c.path === previousPath.name);

  const ownedPrevious = previousCards.filter(c =>
    profile.ownedCards.includes(c.id)
  );

  return ownedPrevious.length >= 5;
}
