import { useState } from "react";
import { Chronicle } from "../components/Chronicle";
import { DwarfRoster } from "../components/DwarfRoster";
import { DEFENSE_WEAPON_THRESHOLD } from "../domain/defense";
import { jobLabel, production, productionFor } from "../domain/simulation";
import { useColony } from "../state/ColonyContext";
import type { ResourceKey } from "../types";

const destinationDetails: Record<
  string,
  { label: string; preview: string; danger?: boolean; requiresDefense?: boolean }
> = {
  "crystal-cave": {
    label: "Crystal Cave",
    preview: "Rich crystal seams and mining tools. On the first successful visit, Kivi the kobold joins Stonehome.",
  },
  "old-mine": {
    label: "The Old Mine",
    preview: "Abandoned tunnels holding deep stone and structural timber.",
  },
  "goblin-outpost": {
    label: "Goblin Outpost",
    preview:
      "Heavily guarded war camp. High plunder, but hostile raiders will track the scout home to attack Stonehome!",
    danger: true,
    requiresDefense: true,
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
    lastRaid,
    dismissRaidAlert,
    assignDwarf,
    equipTool,
    unequipTool,
    sendExpedition,
  } = useColony();
  const [destination, setDestination] = useState("crystal-cave");
  const [expeditionDwarf, setExpeditionDwarf] = useState("dwarf-3");

  const dailyOutput = colony.dwarves.reduce<Record<ResourceKey, number>>(
    (total, dwarf) => {
      if (dwarf.status === "working" && dwarf.assignment) {
        const output = productionFor(dwarf);
        (Object.entries(output) as [ResourceKey, number][]).forEach(([resource, amount]) => {
          let producedAmount = (amount ?? 0) + (dwarf.equippedTool ? 1 : 0);

          if (colony.foodShortage) {
            producedAmount = Math.floor(producedAmount / 2);
          }

          total[resource] += producedAmount;
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
  function getShownProductionForJob(
    job: "woodcutting" | "mining" | "farming",
  ): number {
    const normalAmount = Object.values(production[job])[0] ?? 0;

    if (colony.foodShortage) {
      return Math.floor(normalAmount / 2);
    }

    return normalAmount;
  }
  return (
    <div className="dashboard">
      <DwarfRoster
        dwarves={colony.dwarves}
        onAssign={assignDwarf}
        onEquipTool={equipTool}
        onUnequipTool={unequipTool}
        availableTools={colony.resources.tools}
      />

      <section className="center-stack">
        {colony.foodShortage && (
          <p className="food-shortage-warning" role="alert">
            Food shortage: workers are exhausted and produce half as much today.
          </p>
        )}
        {lastRaid && (
          <div
            className={`raid-alert-banner ${lastRaid.defended ? "defended" : "breached"
              }`}
          >
            <div className="raid-alert-content">
              <span className="raid-alert-icon">
                {lastRaid.defended ? "🛡️" : "⚔️"}
              </span>
              <div>
                <h4>
                  {lastRaid.defended
                    ? "Raid Repelled!"
                    : "Hold Breached by Raiders!"}
                </h4>
                <p>{lastRaid.message}</p>
              </div>
            </div>
            <button
              className="raid-dismiss-btn"
              onClick={dismissRaidAlert}
              title="Dismiss alert"
            >
              ✕
            </button>
          </div>
        )}

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
                <strong>Base +{getShownProductionForJob(job)} / day</strong>
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

          {destinationDetails[destination]?.requiresDefense && (
            <div
              className={`defense-status ${colony.resources.weapons >= DEFENSE_WEAPON_THRESHOLD
                ? "ready"
                : "breached"
                }`}
            >
              <strong>
                {colony.resources.weapons >= DEFENSE_WEAPON_THRESHOLD
                  ? "🛡️ Garrison Prepared"
                  : "⚠️ Defense Compromised!"}
              </strong>
              <p>
                {colony.resources.weapons >= DEFENSE_WEAPON_THRESHOLD
                  ? `${colony.resources.weapons}/${DEFENSE_WEAPON_THRESHOLD} weapons ready. Stonehome will repel the raid!`
                  : `Only ${colony.resources.weapons}/${DEFENSE_WEAPON_THRESHOLD} weapons. Raiders will breach and plunder supplies!`}
              </p>
            </div>
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
