const SNAP_DISTANCE = 30;
const CARD_WIDTH = 130;
const CARD_HEIGHT = 190;

export function detectSnapTarget(moving, cards, cardWidth = CARD_WIDTH, cardHeight = CARD_HEIGHT) {
  for (let card of cards) {
    if (card.instanceId === moving.instanceId) continue;

    const nearRight =
      Math.abs(moving.x - (card.x + cardWidth)) < SNAP_DISTANCE &&
      Math.abs(moving.y - card.y) < SNAP_DISTANCE;

    const nearLeft =
      Math.abs(moving.x + cardWidth - card.x) < SNAP_DISTANCE &&
      Math.abs(moving.y - card.y) < SNAP_DISTANCE;

    const nearBottom =
      Math.abs(moving.y - (card.y + cardHeight)) < SNAP_DISTANCE &&
      Math.abs(moving.x - card.x) < SNAP_DISTANCE;

    const nearTop =
      Math.abs(moving.y + cardHeight - card.y) < SNAP_DISTANCE &&
      Math.abs(moving.x - card.x) < SNAP_DISTANCE;

    if (nearRight || nearLeft || nearBottom || nearTop) {
      return card.instanceId;
    }
  }

  return null;
}

export function applySnap(moving, cards, cardWidth = CARD_WIDTH, cardHeight = CARD_HEIGHT) {
  for (let card of cards) {
    if (card.instanceId === moving.instanceId) continue;

    if (
      Math.abs(moving.x - (card.x + cardWidth)) < SNAP_DISTANCE &&
      Math.abs(moving.y - card.y) < SNAP_DISTANCE
    ) {
      return { ...moving, x: card.x + cardWidth, y: card.y };
    }

    if (
      Math.abs(moving.x + cardWidth - card.x) < SNAP_DISTANCE &&
      Math.abs(moving.y - card.y) < SNAP_DISTANCE
    ) {
      return { ...moving, x: card.x - cardWidth, y: card.y };
    }

    if (
      Math.abs(moving.y - (card.y + cardHeight)) < SNAP_DISTANCE &&
      Math.abs(moving.x - card.x) < SNAP_DISTANCE
    ) {
      return { ...moving, x: card.x, y: card.y + cardHeight };
    }

    if (
      Math.abs(moving.y + cardHeight - card.y) < SNAP_DISTANCE &&
      Math.abs(moving.x - card.x) < SNAP_DISTANCE
    ) {
      return { ...moving, x: card.x, y: card.y - cardHeight };
    }
  }

  return moving;
}
