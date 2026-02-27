import { useState } from "react";
import { cards as allCards } from "../database/cardCatalog";

export default function BurgerOverlay({ game, auth }) {
  const [newProfileName, setNewProfileName] = useState("");

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
      </div>
    </div>
  );
}
