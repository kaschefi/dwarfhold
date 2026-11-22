import { useState } from "react";
import { Chronicle } from "../components/Chronicle";
import {
  canCraftTool,
  canCraftWeapon,
  CRAFTING_DURATIONS,
  getRecipeCost,
} from "../domain/crafting";
import { jobLabel } from "../domain/simulation";
import { useColony } from "../state/ColonyContext";

export function ForgePage() {
  const { colony, activities, startCrafting } = useColony();

  const availableArtisans = colony.dwarves.filter(
    (d) => d.status !== "expedition" && d.status !== "crafting",
  );
  const [selectedArtisanId, setSelectedArtisanId] = useState<string>(
    () => availableArtisans[0]?.id ?? colony.dwarves[0]?.id ?? "",
  );

  const activeTask = colony.activeCrafting;
  const activeArtisan = activeTask
    ? colony.dwarves.find((d) => d.id === activeTask.workerId)
    : null;

  const currentArtisan = colony.dwarves.find((d) => d.id === selectedArtisanId);
  const isArtisanUnavailable =
    !currentArtisan ||
    currentArtisan.status === "expedition" ||
    currentArtisan.status === "crafting";

  const isForgeBusy = !!activeTask;

  const toolCost = getRecipeCost("tool", currentArtisan);
  const hasToolMaterials = canCraftTool(colony.resources, currentArtisan);
  const isKoboldWeaponBlocked = currentArtisan?.species === "kobold";
  const hasWeaponMaterials = canCraftWeapon(colony.resources, currentArtisan);

  const isToolDisabled = isForgeBusy || isArtisanUnavailable || !hasToolMaterials;
  const isWeaponDisabled =
    isForgeBusy || isArtisanUnavailable || !hasWeaponMaterials || isKoboldWeaponBlocked;

  function getButtonTooltip(hasMaterials: boolean, isWeapon = false): string {
    if (isForgeBusy) return "The forge is currently occupied by an active project.";
    if (isArtisanUnavailable) return "Selected artisan is unavailable or busy.";
    if (isWeapon && isKoboldWeaponBlocked)
      return "Kobolds lack the strength to forge heavy dwarven war weapons.";
    if (!hasMaterials) return "Insufficient materials in the hold stores.";
    return "Assign artisan and start forging.";
  }

  return (
    <div className="forge-layout">
      <div className="center-stack">
        {/* Active Crafting Progress Card */}
        {activeTask && (
          <section className="panel active-craft-card">
            <header>
              <div>
                <small>FORGE HEARTH IN FLAMES</small>
                <h2>
                  Anvil Active:{" "}
                  {activeTask.recipeId === "tool" ? "Iron Tool" : "Dwarven Weapon"}
                </h2>
              </div>
              <span className="craft-badge">🔥 IN PROGRESS</span>
            </header>

            <div className="active-craft-details">
              <div className="artisan-info">
                <span className="artisan-icon">{activeArtisan?.icon ?? "🧔"}</span>
                <div>
                  <strong>{activeArtisan?.name ?? "Artisan"}</strong>
                  <p>Busy at the anvil — produces 0 job resources while crafting.</p>
                </div>
              </div>

              <div className="craft-progress-section">
                <div className="craft-progress-header">
                  <span>
                    Progress: {activeTask.progress} / {activeTask.duration} Days
                  </span>
                  <span>
                    {Math.round((activeTask.progress / activeTask.duration) * 100)}%
                  </span>
                </div>
                <div className="craft-progress-bar">
                  <div
                    className="craft-progress-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        (activeTask.progress / activeTask.duration) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <small className="craft-hint">
                  Advances with each deep day tick (~8s).
                </small>
              </div>
            </div>
          </section>
        )}

        {/* Artisan Selection Panel */}
        <section className="panel forge-artisan-picker">
          <header>
            <div>
              <small>THE ARTISAN</small>
              <h2>Select Craftsman</h2>
            </div>
            <span>Required for forging</span>
          </header>
          <div className="picker-body">
            <label htmlFor="artisan-select">
              Assign a dwarf to the forge hearth:
            </label>
            <select
              id="artisan-select"
              value={selectedArtisanId}
              disabled={isForgeBusy}
              onChange={(e) => setSelectedArtisanId(e.target.value)}
            >
              {colony.dwarves.map((dwarf) => {
                let statusLabel = "";
                if (dwarf.status === "expedition")
                  statusLabel = " [Away on Expedition]";
                else if (dwarf.status === "crafting")
                  statusLabel = " [Already Crafting]";
                else if (dwarf.assignment)
                  statusLabel = ` (${jobLabel(dwarf.assignment)})`;
                else statusLabel = " (Idle)";

                const toolTag = dwarf.equippedTool ? " ⚒️" : "";

                return (
                  <option
                    key={dwarf.id}
                    value={dwarf.id}
                    disabled={
                      dwarf.status === "expedition" || dwarf.status === "crafting"
                    }
                  >
                    {dwarf.name}
                    {statusLabel}
                    {toolTag}
                  </option>
                );
              })}
            </select>
            <p className="artisan-notice">
              The assigned dwarf works at the forge for the duration and produces no
              local job yield until completion.
            </p>
          </div>
        </section>

        {/* Tool Recipe */}
        <section className={`panel forge ${isForgeBusy ? "busy-dim" : ""}`}>
          <div>
            <small>EMBER FORGE · {CRAFTING_DURATIONS.tool} DAYS</small>
            <h2>Craft a tool</h2>
            <p>
              Equip the hold for future work (+1 resource/day).
              {currentArtisan?.species === "kobold" && (
                <span className="species-perk-hint"> (🦎 Kobold salvage discount: 2 timber)</span>
              )}
            </p>
          </div>
          <div className="recipe">
            <span>{toolCost.wood} 🪵</span>
            <i>+</i>
            <span>{toolCost.stone} 🪨</span>
            <i>→</i>
            <span>1 ⚒️</span>
            <button
              onClick={() => startCrafting("tool", selectedArtisanId)}
              disabled={isToolDisabled}
              title={getButtonTooltip(hasToolMaterials)}
            >
              Forge tool
            </button>
          </div>
        </section>

        {/* Weapon Recipe */}
        <section className={`panel forge ${isForgeBusy ? "busy-dim" : ""}`}>
          <div>
            <small>EMBER FORGE · {CRAFTING_DURATIONS.weapon} DAYS</small>
            <h2>Forge colony weapon</h2>
            <p>
              Arm Stonehome against hostile raids (checked in defense).
              {isKoboldWeaponBlocked && (
                <span className="species-limitation-hint"> (⚠️ Kobolds cannot forge war weapons)</span>
              )}
            </p>
          </div>
          <div className="recipe">
            <span>2 🪵</span>
            <i>+</i>
            <span>4 🪨</span>
            <i>→</i>
            <span>1 ⚔️</span>
            <button
              onClick={() => startCrafting("weapon", selectedArtisanId)}
              disabled={isWeaponDisabled}
              title={getButtonTooltip(hasWeaponMaterials, true)}
            >
              Forge weapon
            </button>
          </div>
        </section>
      </div>

      <Chronicle activities={activities} />
    </div>
  );
}
