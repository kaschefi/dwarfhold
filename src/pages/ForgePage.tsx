import { Chronicle } from "../components/Chronicle";
import { useColony } from "../state/ColonyContext";

export function ForgePage() {
  const { activities, craftTool, craftWeapon } = useColony();

  return (
    <div className="forge-layout">
      <div className="center-stack">
        <section className="panel forge">
          <div>
            <small>EMBER FORGE</small>
            <h2>Craft a tool</h2>
            <p>Equip the hold for future work.</p>
          </div>
          <div className="recipe">
            <span>3 🪵</span>
            <i>+</i>
            <span>2 🪨</span>
            <i>→</i>
            <span>1 ⚒️</span>
            <button onClick={craftTool}>Forge tool</button>
          </div>
        </section>

        <section className="panel forge">
          <div>
            <small>EMBER FORGE</small>
            <h2>Craft a weapon</h2>
            <p>Arm the hold against hostile raiders.</p>
          </div>
          <div className="recipe">
            <span>2 🪵</span>
            <i>+</i>
            <span>4 🪨</span>
            <i>→</i>
            <span>1 ⚔️</span>
            <button onClick={craftWeapon}>Forge weapon</button>
          </div>
        </section>
      </div>

      <Chronicle activities={activities} />
    </div>
  );
}
