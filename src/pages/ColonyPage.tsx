import { useState } from "react";
import { Chronicle } from "../components/Chronicle";
import { DwarfRoster } from "../components/DwarfRoster";
import { jobLabel, production } from "../simulation";
import { useColony } from "../state/ColonyContext";
import type { ResourceKey } from "../types";

const destinationDetails: Record<
  string,
  { label: string; preview: string; danger?: boolean }
> = {
  "crystal-cave": {
    label: "Crystal Cave",
    preview: "Rich crystal seams (stone) and salvageable mining tools.",
  },
  "old-mine": {
    label: "The Old Mine",
    preview: "Abandoned tunnels holding deep stone and structural timber.",
  },
  "blocked-pass": {
    label: "Blocked Pass",
    preview: "Unstable rockfall corridor. Extremely treacherous route.",
    danger: true,
  },
};

export function ColonyPage() {
  const {
    colony,
    activities,
    expeditionPending,
    assignDwarf,
    sendExpedition,
  } = useColony();
  const [destination, setDestination] = useState("crystal-cave");
  const [expeditionDwarf, setExpeditionDwarf] = useState("dwarf-3");

  const dailyOutput = colony.dwarves.reduce<Record<ResourceKey, number>>(
    (total, dwarf) => {
      if (dwarf.status === "working" && dwarf.assignment) {
        const output = production[dwarf.assignment];
        Object.entries(output).forEach(([resource, amount]) => {
          total[resource as ResourceKey] += amount ?? 0;
        });
      }
      return total;
    },
    {
      wood: 0,
      stone: 0,
      food: -colony.dwarves.length,
      tools: 0,
      weapons: 0,
    },
  );

  const selectedDwarf = colony.dwarves.find(
    (dwarf) => dwarf.id === expeditionDwarf,
  );
  const isDwarfUnavailable =
    !selectedDwarf ||
    selectedDwarf.status === "expedition" ||
    selectedDwarf.status === "crafting";
  const isDispatchDisabled = expeditionPending || isDwarfUnavailable;

  return (
    <div className="dashboard">
      <DwarfRoster dwarves={colony.dwarves} onAssign={assignDwarf} />

      <section className="center-stack">
        <section className="panel production">
          <header>
            <div>
              <small>SHIFT LEDGER</small>
              <h2>Daily Production</h2>
            </div>
            <span>updates each day</span>
          </header>

          <div className="job-grid">
            {(["woodcutting", "mining", "farming"] as const).map((job) => (
              <article key={job}>
                <b>
                  {job === "woodcutting"
                    ? "🌲"
                    : job === "mining"
                      ? "⛏️"
                      : "🍄"}
                </b>
                <h3>{jobLabel(job)}</h3>
                <p>
                  {
                    colony.dwarves.filter(
                      (dwarf) => dwarf.status === "working" && dwarf.assignment === job,
                    ).length
                  }{" "}
                  assigned
                </p>
                <strong>+{Object.values(production[job])[0]} / day</strong>
              </article>
            ))}
          </div>

          <div className="net-line">
            <span>NET FOOD AFTER MEALS</span>
            <strong className={dailyOutput.food >= 0 ? "gain" : "loss"}>
              {dailyOutput.food >= 0 ? "+" : ""}
              {dailyOutput.food}
            </strong>
          </div>
        </section>
      </section>

      <aside className="side-stack">
        <section className="panel expedition">
          <header>
            <div>
              <small>BEYOND THE GATE</small>
              <h2>Expedition</h2>
            </div>
            <b>🗺️</b>
          </header>

          <label>
            Scout
            <select
              value={expeditionDwarf}
              disabled={expeditionPending}
              onChange={(event) => setExpeditionDwarf(event.target.value)}
            >
              {colony.dwarves.map((dwarf) => {
                let statusTag = "";
                if (dwarf.status === "expedition") statusTag = " [Away]";
                else if (dwarf.status === "crafting") statusTag = " [Crafting]";
                else if (dwarf.assignment)
                  statusTag = ` (${jobLabel(dwarf.assignment)})`;
                else statusTag = " (Idle)";

                const toolTag = dwarf.equippedTool ? " ⚒️" : "";

                return (
                  <option key={dwarf.id} value={dwarf.id}>
                    {dwarf.name}
                    {statusTag}
                    {toolTag}
                  </option>
                );
              })}
            </select>
          </label>

          {selectedDwarf?.equippedTool && (
            <p className="tool-note">
              ⚒️ Carrying equipped tool (returns safely after expedition).
            </p>
          )}

          <label>
            Destination
            <select
              value={destination}
              disabled={expeditionPending}
              onChange={(event) => setDestination(event.target.value)}
            >
              {Object.entries(destinationDetails).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.label}
                </option>
              ))}
            </select>
          </label>

          {destinationDetails[destination] && (
            <p
              className={
                destinationDetails[destination].danger
                  ? "intel danger"
                  : "intel"
              }
            >
              {destinationDetails[destination].preview}
            </p>
          )}

          <button
            disabled={isDispatchDisabled}
            onClick={() => sendExpedition(expeditionDwarf, destination)}
          >
            {expeditionPending
              ? "Beyond the gate…"
              : selectedDwarf?.status === "expedition"
                ? "Scout is away…"
                : selectedDwarf?.status === "crafting"
                  ? "Scout is crafting…"
                  : "Send expedition"}
          </button>
          <p>
            The travelling scout is away from the hold and produces no daily
            resources. Equipped tools remain with the scout and return intact.
          </p>
        </section>

        <Chronicle activities={activities} />
      </aside>
    </div>
  );
}
