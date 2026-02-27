import { useEffect, useState } from "react";

export default function StarterPackOverlay({ game }) {
  const [revealed, setRevealed] = useState([]);
  const [starterKey, setStarterKey] = useState("");

  useEffect(() => {
    if (!game.starterRevealState) return;

    const key = game.starterRevealState.options
      .map(card => card.id)
      .join("|");

    setStarterKey(key);
    setRevealed(game.starterRevealState.options.map(() => false));
  }, [game.starterRevealState]);

  if (!game.starterRevealState) return null;

  const allRevealed =
    revealed.length === game.starterRevealState.options.length &&
    revealed.every(Boolean);

  return (
    <div className="draft-overlay">
      <div className="draft-content">
        <div className="draft-header">
          Open Your Starter Pack
        </div>

        <div className="draft-panel">
          {game.starterRevealState.options.map((card, index) => {
            const isRevealed =
              starterKey ===
                game.starterRevealState.options
                  .map(c => c.id)
                  .join("|") &&
              revealed[index] === true;

            return (
              <div
                key={`starter:${card.id}`}
                className={`draft-card ${isRevealed ? "revealed" : ""}`}
                onClick={() => {
                  if (isRevealed) return;
                  setRevealed(prev =>
                    prev.map((value, i) =>
                      i === index ? true : value
                    )
                  );
                }}
              >
                <div className={`draft-flip ${isRevealed ? "revealed" : ""}`}>
                  <div className="draft-face draft-face-back">
                    <div className="draft-back-title">Gielinor</div>
                    <div className="draft-back-subtitle">Cards</div>
                  </div>

                  <div className="draft-face draft-face-front">
                    <div className="gc-card">
                      <div className="gc-head">
                        <div className="gc-title">{card.title}</div>
                        {card.subtitle && (
                          <div className="gc-subtitle">
                            {card.subtitle}
                          </div>
                        )}
                      </div>

                      {card.image && (
                        <div className="gc-art-wrap">
                          <img
                            className={`gc-art ${card.type === "skill" ? "gc-art--skill" : ""} ${card.type === "quest" ? "gc-art--quest" : ""} ${card.type === "diary" ? "gc-art--diary" : ""}`}
                            src={card.image}
                            alt={card.title}
                            draggable="false"
            onError={(e) => {
              if (e.currentTarget.src.endsWith("/card-images/quest_icon.png")) return;
              e.currentTarget.src = "/card-images/quest_icon.png";
            }}
          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {allRevealed && (
          <button
            type="button"
            className="starter-claim-btn"
            onClick={() => game.claimStarterCards()}
          >
            Claim Starter Cards
          </button>
        )}
      </div>
    </div>
  );
}


