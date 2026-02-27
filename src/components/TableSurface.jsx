import CardInstance from "./CardInstance";

export default function TableSurface({ game }) {
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 740px)").matches;
  const CARD_WIDTH = isMobile ? 65 : 130;
  const CARD_HEIGHT = isMobile ? 95 : 190;
  const EXTRA_RIGHT_SPACE = 120;
  const EXTRA_BOTTOM_SPACE = 120;
  const baseHeight = isMobile ? 380 : 700;
  const baseWidth = 0;
  const dynamicHeight = Math.max(
    baseHeight,
    ...game.tableCards.map(card => (card.y || 0) + CARD_HEIGHT + EXTRA_BOTTOM_SPACE)
  );
  const dynamicWidth = Math.max(
    baseWidth,
    ...game.tableCards.map(card => (card.x || 0) + CARD_WIDTH + EXTRA_RIGHT_SPACE)
  );

  return (
    <div
      className="table"
      style={{
        minHeight: dynamicHeight,
        minWidth: dynamicWidth
      }}
    >
      {game.tableCards.map(card => (
        <CardInstance
          key={card.instanceId}
          card={card}
          game={game}
        />
      ))}
    </div>
  );
}
