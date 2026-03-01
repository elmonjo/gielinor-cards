import { useState } from "react";
import { cards as allCards } from "../database/cardCatalog";

export default function BurgerOverlay({ game, auth }) {
  const [newProfileName, setNewProfileName] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);

  const collectedUnique = new Set([
    ...game.tableCards.map(c => c.id),
    ...game.binderCards.map(c => c.id)
  ]).size;

  const totalCards = allCards.length;
  const completedPacks = game.PACKS.filter(pack => {
    const left = game.packPools?.[pack.name]?.length ?? 0;
    return left === 0;
  }).length;

  return (
    <div className="overlay" onClick={() => game.setMenuOpen(false)}>
      <div
        className="overlay-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overlay-title">Profile / Stats</div>
        {auth?.user && (
          <div className="overlay-debug-note">
            Logged in as <strong>{auth.user.username}</strong>
          </div>
        )}
        {game.cloudStatus?.enabled && (
          <div className="overlay-debug-note">
            Cloud sync:{" "}
            <strong>
              {game.cloudStatus.error
                ? "Issue"
                : game.cloudStatus.ready
                  ? "Connected"
                  : "Connecting"}
            </strong>
            {game.cloudStatus.error ? ` (${game.cloudStatus.error})` : ""}
          </div>
        )}

        <div className="overlay-profile-tools">
          <label>
            Active Profile
            <select
              value={game.activeProfileId}
              onChange={(e) => game.selectProfile(e.target.value)}
            >
              {game.profiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>

          <div className="overlay-create-profile">
            <input
              type="text"
              placeholder="New profile name"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  game.createNewProfile(newProfileName);
                  setNewProfileName("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                game.createNewProfile(newProfileName);
                setNewProfileName("");
              }}
            >
              Create
            </button>
            <button
              type="button"
              className="overlay-delete-profile"
              disabled={game.profiles.length <= 1}
              onClick={() => {
                const active = game.profiles.find(
                  p => p.id === game.activeProfileId
                );
                if (!active) return;

                const ok = window.confirm(
                  `Delete profile \"${active.name}\"?`
                );
                if (!ok) return;

                game.deleteProfile(active.id);
              }}
            >
              Delete
            </button>
          </div>
        </div>

        <div className="overlay-stats">
          <div className="overlay-stat">
            <span>GP</span>
            <strong>{game.gp.toLocaleString()}</strong>
          </div>
          <div className="overlay-stat">
            <span>Collection</span>
            <strong>{collectedUnique}/{totalCards}</strong>
          </div>
          <div className="overlay-stat">
            <span>Packs Completed</span>
            <strong>{completedPacks}/{game.PACKS.length}</strong>
          </div>
        </div>

        <div className="overlay-actions">
          {auth?.user && (
            <button
              type="button"
              className="overlay-delete-profile"
              onClick={() => auth.logout()}
            >
              Log Out
            </button>
          )}

          <button
            type="button"
            onClick={() => setRulesOpen(true)}
          >
            Rules
          </button>

          <button
            type="button"
            onClick={() => {
              game.setMenuOpen(false);
              game.setBinderOpen(true);
            }}
          >
            Open Collection Log
          </button>

          <button
            type="button"
            onClick={() => game.setMenuOpen(false)}
          >
            Close Menu
          </button>
        </div>

        {rulesOpen && (
          <div
            className="overlay-rules-backdrop"
            onClick={() => setRulesOpen(false)}
          >
            <div
              className="overlay-rules-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="overlay-rules-title">Game Rules</div>
              <div className="overlay-rules-list">
                <p>1. Deposit GP to buy packs.</p>
                <p>2. Opening a pack shows 3 cards; pick 1.</p>
                <p>3. Unpicked cards return to that pack pool.</p>
                <p>4. Drag cards on the table to organize your setup.</p>
                <p>5. Move cards to Collection Log to store progress.</p>
                <p>6. A pack is completed when its pool is fully depleted.</p>
              </div>
              <div className="overlay-rules-actions">
                <button
                  type="button"
                  onClick={() => setRulesOpen(false)}
                >
                  Close Rules
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
