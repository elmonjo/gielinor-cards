import { useEffect, useState } from "react";

export default function PackDraftOverlay({ game }) {
  const [revealed, setRevealed] = useState([]);
  const [revealedDraftKey, setRevealedDraftKey] = useState("");

  const draftKey = game.draftState
    ? `${game.draftState.packName}:${game.draftState.options
        .map(card => card.id)
        .join("|")}`
    : "";

  useEffect(() => {
    if (!game.draftState) return undefined;

    const options = game.draftState.options || [];
    setRevealedDraftKey(draftKey);
    setRevealed(options.map(() => false));
    return undefined;
  }, [game.draftState, draftKey]);

  if (!game.draftState) return null;

  return (
    <div className="draft-overlay">
      <div className="draft-content">
        <div className="draft-header">
          Pick 1 from {game.draftState.packName}
        </div>

        <div className="draft-panel">
          {game.draftState.options.map((card, index) => {
            const isRevealed =
              revealedDraftKey === draftKey &&
              revealed[index] === true &&
              revealed.length === game.draftState.options.length;

            return (
            <div
              key={`${draftKey}:${card.id}`}
              className={`draft-card ${isRevealed ? "revealed" : ""}`}
              onClick={() => {
                if (!isRevealed) {
                  setRevealed(prev =>
                    prev.map((value, i) =>
                      i === index ? true : value
                    )
                  );
                  return;
                }
                game.chooseDraftCard(card.id);
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
      </div>
    </div>
  );
}



