import { describe, expect, it } from "vitest";
import { canCraftTool, canCraftWeapon, startCraftingTask } from "../src/domain/crafting";
import { advanceDay } from "../src/domain/simulation";
import {
  checkExpeditionRecruit,
  KIVI_ID,
  KIVI_RECRUIT,
  toolWoodCost,
} from "../src/domain/species";
import type { ColonyState } from "../src/types";

const startState: ColonyState = {
  day: 1,
  foodShortage: false,
  resources: { wood: 3, stone: 4, food: 5, tools: 0, weapons: 0 },
  dwarves: [],
};

describe("kobold recruit & species mechanics", () => {
  it("joins once after a successful Crystal Cave visit", () => {
    const first = checkExpeditionRecruit(startState, "crystal-cave");
    expect(first.recruited).not.toBeNull();
    expect(first.recruited?.id).toBe(KIVI_ID);
    expect(first.state.dwarves).toHaveLength(1);

    // Second visit does not duplicate the recruit
    const second = checkExpeditionRecruit(first.state, "crystal-cave");
    expect(second.recruited).toBeNull();
    expect(second.state.dwarves).toHaveLength(1);

    // Other destinations do not recruit Kivi
    expect(checkExpeditionRecruit(startState, "old-mine").recruited).toBeNull();
  });

  it("produces +2 extra stone when mining (4 base), and halves correctly under hunger (2 stone)", () => {
    const recruited = checkExpeditionRecruit(startState, "crystal-cave").state;
    const working: ColonyState = {
      ...recruited,
      dwarves: recruited.dwarves.map((worker) => ({
        ...worker,
        assignment: "mining",
        status: "working",
      })),
    };

    // Base stone is 4; startState has 4 stone -> 4 + 4 = 8
    expect(advanceDay(working).resources.stone).toBe(8);

    // Food shortage: floor(4 / 2) = 2 -> 4 + 2 = 6
    expect(advanceDay({ ...working, foodShortage: true }).resources.stone).toBe(6);
  });

  it("calculates tool wood cost as 2 for Kobold and 3 for Dwarf", () => {
    expect(toolWoodCost(KIVI_RECRUIT)).toBe(2);
    expect(
      toolWoodCost({
        ...KIVI_RECRUIT,
        species: "dwarf",
      }),
    ).toBe(3);
    expect(toolWoodCost(undefined)).toBe(3);
  });

  it("allows Kobold to start timed tool craft with 2 wood, while Dwarves require 3 wood", () => {
    const recruited = checkExpeditionRecruit(startState, "crystal-cave").state;

    // Kobold with 2 wood and 2 stone: can start craft
    const koboldState: ColonyState = {
      ...recruited,
      resources: { ...recruited.resources, wood: 2, stone: 2 },
    };
    expect(canCraftTool(koboldState.resources, KIVI_RECRUIT)).toBe(true);

    const taskResult = startCraftingTask(koboldState, "tool", KIVI_ID);
    expect(taskResult.success).toBe(true);
    expect(taskResult.state.resources.wood).toBe(0);
    expect(taskResult.state.resources.stone).toBe(0);

    // Dwarf with 2 wood and 2 stone cannot craft (needs 3 wood)
    const dwarf = { ...KIVI_RECRUIT, id: "dwarf-1", species: "dwarf" as const };
    expect(canCraftTool(koboldState.resources, dwarf)).toBe(false);
  });

  it("prevents Kobold from forging heavy dwarven war weapons (species limitation)", () => {
    const recruited = checkExpeditionRecruit(startState, "crystal-cave").state;
    const koboldState: ColonyState = {
      ...recruited,
      resources: { ...recruited.resources, wood: 10, stone: 10 },
    };

    expect(canCraftWeapon(koboldState.resources, KIVI_RECRUIT)).toBe(false);

    const result = startCraftingTask(koboldState, "weapon", KIVI_ID);
    expect(result.success).toBe(false);
    expect(result.message).toContain("lacks the physical strength");
    expect(koboldState.resources.weapons).toBe(0);
  });

  it("participates in food consumption rules (adds 1 to daily meal demand)", () => {
    const recruited = checkExpeditionRecruit(startState, "crystal-cave").state;
    // 1 worker, 5 food -> after meals: 5 - 1 = 4 food
    const next = advanceDay(recruited);
    expect(next.resources.food).toBe(4);
  });
});
