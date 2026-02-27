import { useRef, useState } from "react";
import { cards as allCards } from "../database/cardCatalog";

export default function BurgerOverlay({ game, auth }) {
  const [newProfileName, setNewProfileName] = useState("");
  const [spawnCardId, setSpawnCardId] = useState("");
  const [debugMessage, setDebugMessage] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const importInputRef = useRef(null);

  const collectedUnique = new Set([
    ...game.tableCards.map(c => c.id),
    ...game.binderCards.map(c => c.id)
  ]).size;

  const totalCards = allCards.length;
  const completedPacks = game.PACKS.filter(pack => {
    const left = game.packPools?.[pack.name]?.length ?? 0;
    return left === 0;
  }).length;

  const exportProfiles = () => {
    try {
      const payload = game.exportProfileSession();
      const blob = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `gielinor-cards-profiles-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setTransferMessage("Profiles exported.");
    } catch {
      setTransferMessage("Export failed.");
    }
  };

  const importProfiles = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = game.importProfileSession(parsed);
      setTransferMessage(result.message);
    } catch {
      setTransferMessage("Import failed (invalid JSON file).");
    }
  };

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

        <div className="overlay-debug">
          <div className="overlay-debug-title">Debug / Admin</div>

          <div className="overlay-debug-row">
            <button
              type="button"
              onClick={() => game.debugRefillPacks()}
            >
              Refill Packs
            </button>
            <button
              type="button"
              onClick={() => game.debugResetTableLayout()}
            >
              Reset Table Layout
            </button>
            <button
              type="button"
              className="overlay-delete-profile"
              onClick={() => {
                const ok = window.confirm(
                  "Reset the active run? This clears GP, table, binder and pack progress for this profile."
                );
                if (!ok) return;
                game.debugResetRun();
              }}
            >
              Reset Run
            </button>
          </div>

          <div className="overlay-debug-row">
            <input
              type="text"
              value={spawnCardId}
              placeholder="Spawn card by id (e.g. twisted_bow)"
              onChange={(e) => setSpawnCardId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const ok = game.debugSpawnCardById(spawnCardId);
                setDebugMessage(ok ? `Spawned: ${spawnCardId}` : `Card not found: ${spawnCardId}`);
                if (ok) setSpawnCardId("");
              }}
            />
            <button
              type="button"
              onClick={() => {
                const ok = game.debugSpawnCardById(spawnCardId);
                setDebugMessage(ok ? `Spawned: ${spawnCardId}` : `Card not found: ${spawnCardId}`);
                if (ok) setSpawnCardId("");
              }}
            >
              Spawn
            </button>
          </div>

          {debugMessage && (
            <div className="overlay-debug-note">{debugMessage}</div>
          )}
        </div>

        <div className="overlay-debug">
          <div className="overlay-debug-title">Profile Transfer</div>
          <div className="overlay-debug-row">
            <button
              type="button"
              onClick={exportProfiles}
            >
              Export Profiles
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
            >
              Import Profiles
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="overlay-hidden-file"
              onChange={(e) => {
                importProfiles(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {transferMessage && (
            <div className="overlay-debug-note">{transferMessage}</div>
          )}
        </div>

        <div className="overlay-debug">
          <div className="overlay-debug-title">Cloud Sync (Planned)</div>
          <div className="overlay-debug-note">
            Multi-device login/sync is not implemented yet. Current best option is
            profile export/import for testers.
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
