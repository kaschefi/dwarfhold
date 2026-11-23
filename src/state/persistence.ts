import type { Activity, ColonyState, Dwarf, RaidResolution } from "../types";

export const SAVE_KEY = "dwarfhold.save.v1";
const SAVE_VERSION = 1;

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface GameSnapshot {
  colony: ColonyState;
  paused: boolean;
  activities: Activity[];
  lastRaid: RaidResolution | null;
}

export interface LoadedGame extends GameSnapshot {
  notice: string | null;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const isText = (value: unknown): value is string => typeof value === "string";

const isOneOf = (value: unknown, choices: readonly string[]): boolean =>
  isText(value) && choices.includes(value);

function isResources(value: unknown): boolean {
  return isObject(value) &&
    ["wood", "stone", "food", "tools", "weapons"].every((key) => isCount(value[key]));
}

function isWorker(value: unknown): value is Dwarf {
  if (!isObject(value)) return false;
  if (!isText(value.id) || value.id.length === 0) return false;
  if (!isText(value.name) || !isText(value.title) || !isText(value.icon)) return false;

  const jobs = ["woodcutting", "mining", "farming"];
  if (value.assignment !== null && !isOneOf(value.assignment, jobs)) return false;
  if (!isOneOf(value.status, ["idle", "working", "crafting", "expedition"])) return false;
  if (value.species !== undefined && !isOneOf(value.species, ["dwarf", "kobold", "goblin", "elf"])) return false;
  if (value.equippedTool !== undefined && typeof value.equippedTool !== "boolean") return false;
  if (value.specialty !== undefined && !isOneOf(value.specialty, jobs)) return false;
  if (value.status === "working" && value.assignment === null) return false;
  return true;
}

function isColony(value: unknown): value is ColonyState {
  if (!isObject(value)) return false;
  if (!Number.isSafeInteger(value.day) || (value.day as number) < 1) return false;
  if (typeof value.foodShortage !== "boolean") return false;
  if (!isResources(value.resources)) return false;
  if (!Array.isArray(value.dwarves) || value.dwarves.length === 0) return false;
  if (!value.dwarves.every(isWorker)) return false;

  const workers = value.dwarves as Dwarf[];
  if (new Set(workers.map((worker) => worker.id)).size !== workers.length) return false;

  const task = value.activeCrafting;
  const craftingWorkers = workers.filter((worker) => worker.status === "crafting");
  if (task === undefined || task === null) return craftingWorkers.length === 0;
  if (!isObject(task) || !isText(task.id) || !isText(task.workerId)) return false;
  if (!isOneOf(task.recipeId, ["tool", "weapon"])) return false;
  if (!isCount(task.progress) || !Number.isSafeInteger(task.duration)) return false;
  if ((task.duration as number) < 1 || (task.progress as number) >= (task.duration as number)) return false;
  return craftingWorkers.length === 1 && craftingWorkers[0].id === task.workerId;
}

function isActivity(value: unknown): value is Activity {
  return isObject(value) && isText(value.id) && isCount(value.day) &&
    isText(value.message) &&
    (value.tone === undefined || value.tone === "good" || value.tone === "warning");
}

function isRaid(value: unknown): value is RaidResolution {
  if (!isObject(value)) return false;
  if (typeof value.defended !== "boolean" || !isCount(value.weaponsConsumed)) return false;
  if (!isText(value.message) || !isOneOf(value.tone, ["good", "warning"])) return false;
  if (!isObject(value.looted)) return false;
  return Object.entries(value.looted).every(([key, amount]) =>
    ["wood", "stone", "food", "tools", "weapons"].includes(key) && isCount(amount));
}

function isSnapshot(value: unknown): value is GameSnapshot & { version: 1 } {
  if (!isObject(value) || value.version !== SAVE_VERSION) return false;
  if (!isColony(value.colony) || typeof value.paused !== "boolean") return false;
  if (!Array.isArray(value.activities) || !value.activities.every(isActivity)) return false;
  return value.lastRaid === null || isRaid(value.lastRaid);
}

export function browserStorage(): SaveStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadGame(
  storage: SaveStorage | null,
  initialColony: ColonyState,
  initialActivities: Activity[],
): LoadedGame {
  const fresh: LoadedGame = {
    colony: initialColony,
    paused: false,
    activities: initialActivities,
    lastRaid: null,
    notice: null,
  };
  if (!storage) return { ...fresh, notice: "Saving is unavailable in this browser." };

  try {
    const text = storage.getItem(SAVE_KEY);
    if (text === null) return fresh;
    const parsed: unknown = JSON.parse(text);
    if (!isSnapshot(parsed)) {
      return { ...fresh, notice: "Saved game was damaged or from another version. A new colony started." };
    }

    const interrupted = parsed.colony.dwarves.some((worker) => worker.status === "expedition");
    const colony: ColonyState = {
      ...parsed.colony,
      dwarves: parsed.colony.dwarves.map((worker) =>
        worker.status === "expedition"
          ? { ...worker, status: worker.assignment ? "working" : "idle" }
          : worker,
      ),
    };
    const notice = interrupted
      ? "Saved game restored. The interrupted expedition was cancelled without rewards; the scout returned."
      : colony.activeCrafting
        ? "Saved game restored. Forge work continues from its saved progress."
        : "Saved game restored.";

    return { colony, paused: parsed.paused, activities: parsed.activities,
      lastRaid: parsed.lastRaid, notice };
  } catch {
    return { ...fresh, notice: "Saved game could not be read. A new colony started." };
  }
}

export function saveGame(storage: SaveStorage | null, snapshot: GameSnapshot): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, ...snapshot }));
    return true;
  } catch {
    return false;
  }
}
