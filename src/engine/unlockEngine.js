import { cards } from "../database/cardCatalog";

/* Unlock chain */
export const UNLOCK_REQUIREMENTS = {
  Novice: null, // always unlocked
  Intermediate: "Novice",
  Experienced: "Intermediate",
  Master: "Experienced",
  Grandmaster: "Master"
};

/* Check if pack is locked */
export function isPackLocked(profile, packName) {

  const requiredPath = UNLOCK_REQUIREMENTS[packName];

  if (!requiredPath) return false; // Novice always unlocked

  const prevCards = cards.filter(c => c.path === requiredPath);

  const ownedPrev = prevCards.filter(c =>
    profile.ownedCards.includes(c.id) &&
    !(profile.starterCardsGranted || []).includes(c.id)
  );

  return ownedPrev.length < 5;
}

/* Progress text (for shop UI) */
export function unlockProgress(profile, packName) {

  const requiredPath = UNLOCK_REQUIREMENTS[packName];
  if (!requiredPath) return "";

  const prevCards = cards.filter(c => c.path === requiredPath);

  const ownedPrev = prevCards.filter(c =>
    profile.ownedCards.includes(c.id) &&
    !(profile.starterCardsGranted || []).includes(c.id)
  );

  return `${ownedPrev.length}/5 ${requiredPath}`;
}
