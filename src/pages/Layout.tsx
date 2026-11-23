import { NavLink, Outlet } from "react-router";
import { ResourceBar } from "../components/ResourceBar";
import { useColony } from "../state/ColonyContext";

export function Layout() {
  const { colony, paused, saveNotice, togglePaused } = useColony();

  return (
    <main>
      <header className="masthead">
        <div className="brand">
          <b>⛏</b>
          <div>
            <small>THE DEEP REALMS OF</small>
            <h1>
              Dwarf<span>hold</span>
            </h1>
          </div>
        </div>

        <div className="hold-title">
          <small>COLONY</small>
          <strong>STONEHOME</strong>
          <span>Founded beneath Emberpeak</span>
        </div>

        <div className="day">
          <small>DEEP DAY</small>
          <strong>{colony.day}</strong>
          <button onClick={togglePaused}>
            {paused ? "Wake the hold" : "Pause"}
          </button>
        </div>
      </header>

      <nav className="main-nav" aria-label="Colony navigation">
        <NavLink to="/" end>
          Colony
        </NavLink>
        <NavLink to="/forge">Forge</NavLink>
      </nav>

      <div className="save-policy" role="status">
        <strong>Autosave in this browser.</strong> An expedition interrupted by refresh is
        cancelled without rewards. Forge work resumes at its saved progress.
        {saveNotice && <p>{saveNotice}</p>}
      </div>

      <ResourceBar resources={colony.resources} />
      <Outlet />

      <footer>
        <span>🔥 Forge: burning</span>
        <span>Next deep day in ~8 seconds</span>
        <span>{paused ? "The hold is resting" : "⚙ Simulation active"}</span>
      </footer>
    </main>
  );
}
