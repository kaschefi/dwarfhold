import { describe, expect, it } from "vitest";
import { advanceDay } from "./simulation";
import { forgeTool, KIVI_ID, recruitFromCrystalCave } from "./species";
import type { ColonyState } from "./types";

const start: ColonyState = {
  day: 1,
  foodShortage: false,
  resources: { wood: 3, stone: 2, food: 5, tools: 0, weapons: 0 },
  dwarves: [],
};

describe("kobold recruit", () => {
  it("joins once after a successful Crystal Cave visit", () => {
    const first = recruitFromCrystalCave(start, "crystal-cave");
    const second = recruitFromCrystalCave(first, "crystal-cave");
    expect(first.dwarves).toHaveLength(1);
    expect(second.dwarves).toHaveLength(1);
    expect(second.dwarves[0].id).toBe(KIVI_ID);
    expect(recruitFromCrystalCave(start, "old-mine").dwarves).toHaveLength(0);
  });

  it("produces four stone when mining and two after hunger", () => {
    const recruited = recruitFromCrystalCave(start, "crystal-cave");
    const working: ColonyState = {
      ...recruited,
      dwarves: recruited.dwarves.map((worker) => ({ ...worker, assignment: "mining", status: "working" })),
    };
    expect(advanceDay(working).resources.stone).toBe(6);
    expect(advanceDay({ ...working, foodShortage: true }).resources.stone).toBe(4);
  });

  it("forges with two wood only while idle", () => {
    const recruited = recruitFromCrystalCave(start, "crystal-cave");
    const forged = forgeTool(recruited, KIVI_ID);
    expect(forged.resources).toMatchObject({ wood: 1, stone: 0, tools: 1 });
    expect(forgeTool(forged, KIVI_ID)).toBe(forged);
    const working = { ...recruited, dwarves: recruited.dwarves.map((worker) => ({ ...worker, status: "working" as const })) };
    expect(forgeTool(working, KIVI_ID)).toBe(working);
  });

  it("requires three wood for a dwarf", () => {
    const dwarf: ColonyState = {
      ...start,
      dwarves: [{ id: "d1", name: "Dori", title: "", icon: "", species: "dwarf", assignment: null, status: "idle" }],
    };
    expect(forgeTool(dwarf, "d1").resources).toMatchObject({ wood: 0, stone: 0, tools: 1 });
    expect(forgeTool({ ...dwarf, resources: { ...dwarf.resources, wood: 2 } }, "d1").resources.tools).toBe(0);
  });
});
