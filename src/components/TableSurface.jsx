import CardInstance from "./CardInstance";

export default function TableSurface({ game }) {
  const CARD_HEIGHT = 190;
  const EXTRA_BOTTOM_SPACE = 120;
  const baseHeight = 700;
  const dynamicHeight = Math.max(
    baseHeight,
    ...game.tableCards.map(card => (card.y || 0) + CARD_HEIGHT + EXTRA_BOTTOM_SPACE)
  );

  return (
    <div
      className="table"
      style={{ minHeight: dynamicHeight }}
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
