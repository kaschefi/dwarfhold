import { useState } from "react";
import { Chronicle } from "../components/Chronicle";
import { toolWoodCost } from "../species";
import { useColony } from "../state/ColonyContext";

export function ForgePage() {
  const { colony, activities, craftTool } = useColony();
  const [workerId, setWorkerId] = useState("");
  const idleWorkers = colony.dwarves.filter((worker) => worker.status === "idle");
  const worker = idleWorkers.find((item) => item.id === workerId);
  const woodCost = worker ? toolWoodCost(worker) : 3;

  return (
    <div className="forge-layout">
      <section className="panel forge">
        <div>
          <small>EMBER FORGE</small>
          <h2>Craft a tool</h2>
          <p>Choose an idle worker to make a tool.</p>
          <p>Kivi the kobold uses 2 wood. Other workers use 3 wood.</p>
          <label>
            Worker{" "}
            <select value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
              <option value="">Select a worker</option>
              {idleWorkers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.species === "kobold" ? " (Kobold)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="recipe">
          <span>{woodCost} 🪵</span>
          <i>+</i>
          <span>2 🪨</span>
          <i>→</i>
          <span>1 ⚒️</span>
          <button
            disabled={!worker || colony.resources.wood < woodCost || colony.resources.stone < 2}
            onClick={() => craftTool(workerId)}
          >
            Forge tool
          </button>
        </div>
      </section>

      <Chronicle activities={activities} />
    </div>
  );
}
