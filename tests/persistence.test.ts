import { describe, expect, it } from "vitest";
import { advanceDay } from "../src/domain/simulation";
import { loadGame, SAVE_KEY, saveGame, type SaveStorage } from "../src/state/persistence";
import type { Activity, ColonyState } from "../src/types";

const colony: ColonyState = {
  day: 17,
  foodShortage: false,
  resources: { wood: 7, stone: 4, food: 12, tools: 1, weapons: 2 },
  dwarves: [
    { id: "d1", name: "Bromli", title: "Miner", icon: "⛏️", species: "dwarf",
      assignment: "mining", status: "working", equippedTool: true },
    { id: "kobold-kivi", name: "Kivi", title: "Scavenger", icon: "🦎", species: "kobold",
      assignment: null, status: "idle", equippedTool: false },
  ],
  activeCrafting: null,
};

const activities: Activity[] = [{ id: "a1", day: 17, message: "The colony worked." }];

function memoryStorage(): SaveStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  };
}

describe("save and restore", () => {
  it("restores resources, workers, pause state, and recent activity", () => {
    const storage = memoryStorage();
    expect(saveGame(storage, { colony, paused: true, activities, lastRaid: null })).toBe(true);
    const loaded = loadGame(storage, { ...colony, day: 1 }, []);
    expect(loaded.colony).toEqual(colony);
    expect(loaded.paused).toBe(true);
    expect(loaded.activities).toEqual(activities);
    expect(loaded.notice).toContain("restored");
  });

  it("cancels an interrupted expedition without giving rewards", () => {
    const storage = memoryStorage();
    const travelling: ColonyState = {
      ...colony,
      dwarves: colony.dwarves.map((worker) =>
        worker.id === "d1" ? { ...worker, status: "expedition" } : worker),
    };
    saveGame(storage, { colony: travelling, paused: false, activities, lastRaid: null });
    const loaded = loadGame(storage, colony, activities);
    expect(loaded.colony.dwarves[0].status).toBe("working");
    expect(loaded.colony.resources).toEqual(travelling.resources);
    expect(loaded.notice).toContain("cancelled without rewards");
  });

  it("resumes a forge task at its saved progress without charging materials again", () => {
    const storage = memoryStorage();
    const crafting: ColonyState = {
      ...colony,
      dwarves: colony.dwarves.map((worker) =>
        worker.id === "kobold-kivi" ? { ...worker, status: "crafting" } : worker),
      activeCrafting: { id: "craft-1", recipeId: "tool", workerId: "kobold-kivi", progress: 1, duration: 2 },
    };
    saveGame(storage, { colony: crafting, paused: false, activities, lastRaid: null });
    const loaded = loadGame(storage, colony, activities);
    expect(loaded.colony.activeCrafting?.progress).toBe(1);
    expect(loaded.notice).toContain("Forge work continues");
    const next = advanceDay(loaded.colony);
    expect(next.activeCrafting).toBeNull();
    expect(next.resources.tools).toBe(2);
    expect(next.dwarves[1].status).toBe("idle");
  });

  it("starts safely from the initial colony if the save is corrupt or incompatible", () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, "not JSON");
    expect(loadGame(storage, colony, activities).colony).toEqual(colony);
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 99, colony, paused: false, activities, lastRaid: null }));
    expect(loadGame(storage, colony, activities).notice).toContain("another version");
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, colony: { ...colony, resources: { ...colony.resources, food: -1 } }, paused: false, activities, lastRaid: null }));
    expect(loadGame(storage, colony, activities).colony).toEqual(colony);
  });

  it("handles unavailable browser storage without crashing", () => {
    const broken: SaveStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(loadGame(broken, colony, activities).colony).toEqual(colony);
    expect(saveGame(broken, { colony, paused: false, activities, lastRaid: null })).toBe(false);
  });
});
