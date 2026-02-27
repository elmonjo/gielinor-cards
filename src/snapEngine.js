const SNAP_DISTANCE = 30;
const CARD_WIDTH = 130;
const CARD_HEIGHT = 190;

export function detectSnapTarget(moving, cards) {
  for (let card of cards) {
    if (card.instanceId === moving.instanceId) continue;

    const nearRight =
      Math.abs(moving.x - (card.x + CARD_WIDTH)) < SNAP_DISTANCE &&
      Math.abs(moving.y - card.y) < SNAP_DISTANCE;

    const nearLeft =
      Math.abs(moving.x + CARD_WIDTH - card.x) < SNAP_DISTANCE &&
      Math.abs(moving.y - card.y) < SNAP_DISTANCE;

    const nearBottom =
      Math.abs(moving.y - (card.y + CARD_HEIGHT)) < SNAP_DISTANCE &&
      Math.abs(moving.x - card.x) < SNAP_DISTANCE;

    const nearTop =
      Math.abs(moving.y + CARD_HEIGHT - card.y) < SNAP_DISTANCE &&
      Math.abs(moving.x - card.x) < SNAP_DISTANCE;

    if (nearRight || nearLeft || nearBottom || nearTop) {
      return card.instanceId;
    }
  }

  return null;
}

export function applySnap(moving, cards) {
  for (let card of cards) {
    if (card.instanceId === moving.instanceId) continue;

    if (
      Math.abs(moving.x - (card.x + CARD_WIDTH)) < SNAP_DISTANCE &&
      Math.abs(moving.y - card.y) < SNAP_DISTANCE
    ) {
      return { ...moving, x: card.x + CARD_WIDTH, y: card.y };
    }

    if (
      Math.abs(moving.x + CARD_WIDTH - card.x) < SNAP_DISTANCE &&
      Math.abs(moving.y - card.y) < SNAP_DISTANCE
    ) {
      return { ...moving, x: card.x - CARD_WIDTH, y: card.y };
    }

    if (
      Math.abs(moving.y - (card.y + CARD_HEIGHT)) < SNAP_DISTANCE &&
      Math.abs(moving.x - card.x) < SNAP_DISTANCE
    ) {
      return { ...moving, x: card.x, y: card.y + CARD_HEIGHT };
    }

    if (
      Math.abs(moving.y + CARD_HEIGHT - card.y) < SNAP_DISTANCE &&
      Math.abs(moving.x - card.x) < SNAP_DISTANCE
    ) {
      return { ...moving, x: card.x, y: card.y - CARD_HEIGHT };
    }
  }

  return moving;
}