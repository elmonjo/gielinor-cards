import { starterPool } from "../data/starterCards";

export function generateStarterCards() {
  const poolCopy = [...starterPool];
  const selected = [];

  for (let i = 0; i < 5; i++) {
    const index = Math.floor(Math.random() * poolCopy.length);
    selected.push(poolCopy[index]);
    poolCopy.splice(index, 1);
  }

  return selected;
}
