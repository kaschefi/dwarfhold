import { jobLabel } from "../domain/simulation";
import type { Dwarf, JobType } from "../types";

const jobs: Exclude<JobType, null>[] = [
  "woodcutting",
  "mining",
  "farming",
];

interface Props {
  dwarves: Dwarf[];
  onAssign: (id: string, job: JobType) => void;
  onEquipTool?: (id: string) => void;
  onUnequipTool?: (id: string) => void;
  availableTools?: number;
}

export function DwarfRoster({
  dwarves,
  onAssign,
  onEquipTool,
  onUnequipTool,
  availableTools = 0,
}: Props) {
  const presentDwarves = dwarves.filter(
    (dwarf) => dwarf.status !== "expedition",
  ).length;

  return (
    <section className="panel roster">
      <header>
        <div>
          <small>THE COMPANY</small>
          <h2>Holdfolk</h2>
        </div>
        <span>
          {presentDwarves} / {dwarves.length} present
        </span>
      </header>

      <div className="dwarf-list">
        {dwarves.map((dwarf) => {
          const isAway = dwarf.status === "expedition";
          const isBusy = dwarf.status === "expedition" || dwarf.status === "crafting";
          const specialty = dwarf.specialty
            ? `Skilled in ${jobLabel(dwarf.specialty)}`
            : "Generalist";

          return (
            <article
              className={isAway ? "dwarf away" : dwarf.status === "crafting" ? "dwarf crafting" : "dwarf"}
              key={dwarf.id}
            >
              <div className="portrait">
                {dwarf.icon}
                <i className={dwarf.status} />
              </div>

              <div className="dwarf-details">
                <h3>
                  {dwarf.name}
                  {dwarf.equippedTool && (
                    <span
                      className="equipped-badge"
                      title="Equipped tool (+1 resource/day)"
                    >
                      ⚒️
                    </span>
                  )}
                </h3>
                <p>
                  {dwarf.title} · {specialty}
                </p>
                {dwarf.species === "kobold" && (
                  <p>Mining: +2 extra stone before hunger · Tool: 2 wood instead of 3</p>
                )}

                <div className="dwarf-actions">
                  <select
                    value={dwarf.assignment ?? ""}
                    disabled={isBusy}
                    onChange={(event) =>
                      onAssign(
                        dwarf.id,
                        (event.target.value || null) as JobType,
                      )
                    }
                  >
                    <option value="">Unassigned</option>
                    {jobs.map((job) => (
                      <option value={job} key={job}>
                        {jobLabel(job)}
                      </option>
                    ))}
                  </select>

                  {dwarf.equippedTool ? (
                    <button
                      type="button"
                      className="tool-btn unequip"
                      disabled={isBusy}
                      onClick={() => onUnequipTool?.(dwarf.id)}
                      title={
                        isBusy
                          ? "Cannot change equipment while away or crafting"
                          : "Return tool to colony stores"
                      }
                    >
                      Unequip
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="tool-btn equip"
                      disabled={isBusy || availableTools < 1}
                      onClick={() => onEquipTool?.(dwarf.id)}
                      title={
                        isBusy
                          ? "Cannot equip tool while away or crafting"
                          : availableTools < 1
                            ? "No tools available in stores"
                            : "Equip a tool for +1 daily production"
                      }
                    >
                      + Equip ⚒️
                    </button>
                  )}
                </div>
              </div>

              <span className="status">{dwarf.status}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
