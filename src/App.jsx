import { useGameState } from "./useGameState";
import { useAuth } from "./useAuth";
import TopBar from "./components/TopBar";
import TableSurface from "./components/TableSurface";
import Binder from "./components/Binder";
import BurgerOverlay from "./components/BurgerOverlay";
import PackDraftOverlay from "./components/PackDraftOverlay";
import StarterPackOverlay from "./components/StarterPackOverlay";
import AuthScreen from "./components/AuthScreen";
import "./App.css";

export default function App() {
  const auth = useAuth();

  if (!auth.user) {
    return <AuthScreen auth={auth} />;
  }

  return (
    <GameApp
      key={auth.user.id}
      auth={auth}
    />
  );
}

function GameApp({ auth }) {
  const game = useGameState(auth.user.id);

  return (
    <div className="app">
      <TopBar game={game} />

      <div className="main">
        <Binder game={game} />
        <TableSurface game={game} />
      </div>

      {game.menuOpen && (
        <BurgerOverlay
          game={game}
          auth={auth}
        />
      )}
      <StarterPackOverlay game={game} />
      <PackDraftOverlay game={game} />
    </div>
  );
}
