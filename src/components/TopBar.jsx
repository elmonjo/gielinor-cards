export default function TopBar({ game }) {
  const legacyPathMap = {
    Adventurer: "Novice",
    Warrior: "Intermediate",
    Champion: "Experienced",
    Warlord: "Master",
    Legend: "Grandmaster"
  };

  const reverseLegacyMap = Object.fromEntries(
    Object.entries(legacyPathMap).map(([oldName, newName]) => [newName, oldName])
  );

  return (
    <div className="top-bar">
      <div className="left">
        <button
          className="menu-title"
          onClick={() => game.setMenuOpen(true)}
        >
          Gielinor Cards
        </button>

        <div className="gp">
          GP: {game.gp.toLocaleString()}
          <input
            type="number"
            placeholder="Deposit"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                game.depositGp(Number(e.target.value));
                e.target.value = "";
              }
            }}
          />
        </div>
      </div>

      <div className="packs">
        {game.PACKS.map(pack => {
          const currentPool = game.packPools?.[pack.name];
          const legacyPool = game.packPools?.[reverseLegacyMap[pack.name]];
          const cardsLeft = Array.isArray(currentPool)
            ? currentPool.length
            : Array.isArray(legacyPool)
              ? legacyPool.length
              : 0;
          const isExhausted = cardsLeft === 0;

          return (
            <div
              key={pack.name}
              className={`pack ${isExhausted ? "exhausted" : ""}`}
              onClick={() => {
                if (!isExhausted) {
                  game.openPack(pack.name);
                }
              }}
            >
              <div className="pack-name">
                {pack.name}
              </div>
              <div className="pack-price">
                {pack.cost.toLocaleString()} GP
              </div>
              {isExhausted && (
                <div className="pack-stamp">COMPLETED</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
