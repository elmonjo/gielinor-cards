const SNAP_DISTANCE = 14;
const CARD_WIDTH = 130;
const CARD_HEIGHT = 190;

function evaluateSnap(moving, anchor, cardWidth, cardHeight) {
  if (
    Math.abs(moving.x - (anchor.x + cardWidth)) < SNAP_DISTANCE &&
    Math.abs(moving.y - anchor.y) < SNAP_DISTANCE
  ) {
    return {
      x: anchor.x + cardWidth,
      y: anchor.y,
      targetId: anchor.instanceId,
      edge: "right"
    };
  }

  if (
    Math.abs(moving.x + cardWidth - anchor.x) < SNAP_DISTANCE &&
    Math.abs(moving.y - anchor.y) < SNAP_DISTANCE
  ) {
    return {
      x: anchor.x - cardWidth,
      y: anchor.y,
      targetId: anchor.instanceId,
      edge: "left"
    };
  }

  if (
    Math.abs(moving.y - (anchor.y + cardHeight)) < SNAP_DISTANCE &&
    Math.abs(moving.x - anchor.x) < SNAP_DISTANCE
  ) {
    return {
      x: anchor.x,
      y: anchor.y + cardHeight,
      targetId: anchor.instanceId,
      edge: "bottom"
    };
  }

  if (
    Math.abs(moving.y + cardHeight - anchor.y) < SNAP_DISTANCE &&
    Math.abs(moving.x - anchor.x) < SNAP_DISTANCE
  ) {
    return {
      x: anchor.x,
      y: anchor.y - cardHeight,
      targetId: anchor.instanceId,
      edge: "top"
    };
  }

  return null;
}

export function resolveSnap(moving, cards, cardWidth = CARD_WIDTH, cardHeight = CARD_HEIGHT) {
  for (let card of cards) {
    if (card.instanceId === moving.instanceId) continue;
    const snap = evaluateSnap(moving, card, cardWidth, cardHeight);
    if (snap) return snap;
  }
  return null;
}

export function detectSnapTarget(moving, cards, cardWidth = CARD_WIDTH, cardHeight = CARD_HEIGHT) {
  const snap = resolveSnap(moving, cards, cardWidth, cardHeight);
  return snap ? snap.targetId : null;
}

export function applySnap(moving, cards, cardWidth = CARD_WIDTH, cardHeight = CARD_HEIGHT) {
  const snap = resolveSnap(moving, cards, cardWidth, cardHeight);
  if (snap) {
    return { ...moving, x: snap.x, y: snap.y };
  }
  return moving;
}
