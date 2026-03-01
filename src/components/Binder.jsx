import { useMemo, useState } from "react";
import { cards as allCards } from "../database/cardCatalog";

const PATH_ORDER = ["Novice", "Intermediate", "Experienced", "Master", "Grandmaster"];
const pathRank = (path) => {
  const idx = PATH_ORDER.indexOf(path);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
};
const uniquePaths = [...new Set(allCards.map(c => c.path))].sort(
  (a, b) => pathRank(a) - pathRank(b) || a.localeCompare(b)
);
const PATH_OPTIONS = ["All", ...uniquePaths];
const TYPE_OPTIONS = ["All", ...new Set(allCards.map(c => c.type))];
const formatTypeLabel = (value) =>
  value === "All" ? value : value.charAt(0).toUpperCase() + value.slice(1);

export default function Binder({ game }) {
  const [pathFilter, setPathFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("path");
  const [searchQuery, setSearchQuery] = useState("");

  const collectedById = useMemo(() => {
    const map = new Map();

    game.binderCards.forEach(card => {
      const entries = map.get(card.id) || [];
      entries.push(card);
      map.set(card.id, entries);
    });

    return map;
  }, [game.binderCards]);

  const visibleCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = allCards.filter(card => {
      if (pathFilter !== "All" && card.path !== pathFilter) {
        return false;
      }
      if (typeFilter !== "All" && card.type !== typeFilter) {
        return false;
      }
      if (query) {
        const haystack = [
          card.title,
          card.subtitle,
          card.id,
          card.type,
          card.path,
          card.wikiPage
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "name") {
        return a.title.localeCompare(b.title);
      }
      return pathRank(a.path) - pathRank(b.path) || a.title.localeCompare(b.title);
    });
  }, [pathFilter, typeFilter, sortBy, searchQuery]);

  const collectedCount = collectedById.size;
  const totalCount = allCards.length;

  return (
    <>
      <div
        id="binder-drop-zone"
        className="binder-icon"
        onClick={() => game.setBinderOpen(true)}
      >
        <img
          className="binder-book-image"
          src="/ui/collection-log-icon.png"
          alt="Collection Log"
          draggable="false"
            onError={(e) => {
              if (e.currentTarget.src.endsWith("/card-images/quest_icon.png")) return;
              e.currentTarget.src = "/card-images/quest_icon.png";
            }}
          />
        <div className="binder-text">Collection Log</div>
      </div>

      {game.binderOpen && (
        <div
          className="binder-overlay"
          onClick={() => game.setBinderOpen(false)}
        >
          <div
            className="binder-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="binder-header">
              <div>
                Collection Log ({collectedCount}/{totalCount})
              </div>
              <button
                className="binder-close"
                type="button"
                onClick={() => game.setBinderOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="binder-controls">
              <label className="binder-search">
                Search
                <input
                  type="text"
                  value={searchQuery}
                  placeholder="Name, type, pack..."
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </label>

              <label>
                Path
                <select
                  value={pathFilter}
                  onChange={(e) => setPathFilter(e.target.value)}
                >
                  {PATH_OPTIONS.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Type
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  {TYPE_OPTIONS.map(value => (
                    <option key={value} value={value}>
                      {formatTypeLabel(value)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Sort
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="path">Path</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </div>

            <div className="binder-grid">
              {visibleCards.map(card => {
                const ownedInstances = collectedById.get(card.id) || [];
                const owned = ownedInstances.length > 0;

                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`binder-slot ${owned ? "owned" : "missing"}`}
                    onClick={() => {
                      if (owned) {
                        game.recallFromBinder(
                          ownedInstances[0].instanceId
                        );
                      }
                    }}
                    title={
                      owned
                        ? `Recall ${card.title} to table`
                        : `${card.title} (not collected yet)`
                    }
                  >
                    {owned ? (
                      <div
                        className={`gc-card ${card.shiny ? "shiny-card" : ""}`}
                      >
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
                    ) : (
                      <div className="gc-card binder-card-back">
                        <div className="binder-card-back-title">Gielinor</div>
                        <div className="binder-card-back-subtitle">Cards</div>
                      </div>
                    )}

                    {ownedInstances.length > 1 && (
                      <div className="binder-count">
                        x{ownedInstances.length}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


