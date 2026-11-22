import { describe, expect, it } from "vitest";
import { equipToolState, unequipToolState } from "../src/domain/equipment";
import type { ColonyState } from "../src/types";

describe("equipment system", () => {
  const baseState: ColonyState = {
    day: 1,
    foodShortage: false,
    resources: {
      wood: 10,
      stone: 10,
      food: 10,
      tools: 2,
      weapons: 0,
    },
    dwarves: [
      {
        id: "d1",
        name: "Brom",
        title: "Miner",
        icon: "🧔🏻",
        assignment: "mining",
        status: "working",
        equippedTool: false,
      },
      {
        id: "d2",
        name: "Yrsa",
        title: "Scout",
        icon: "🧔🏼‍♀️",
        assignment: "woodcutting",
        status: "working",
        equippedTool: true,
      },
      {
        id: "d3",
        name: "Dori",
        title: "Away Scout",
        icon: "🧔🏽",
        assignment: null,
        status: "expedition",
        equippedTool: true,
      },
    ],
  };

  it("equips a tool from inventory, decrementing tools and setting equippedTool to true", () => {
    const result = equipToolState(baseState, "d1");
    expect(result.success).toBe(true);
    expect(result.state.resources.tools).toBe(1);
    const d1 = result.state.dwarves.find((d) => d.id === "d1");
    expect(d1?.equippedTool).toBe(true);

    // Invariant: Total tools conserved
    const totalBefore =
      baseState.resources.tools +
      baseState.dwarves.filter((d) => d.equippedTool).length;
    const totalAfter =
      result.state.resources.tools +
      result.state.dwarves.filter((d) => d.equippedTool).length;
    expect(totalAfter).toBe(totalBefore);
  });

  it("fails to equip if no tools are available in inventory", () => {
    const noToolsState: ColonyState = {
      ...baseState,
      resources: { ...baseState.resources, tools: 0 },
    };
    const result = equipToolState(noToolsState, "d1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("No tools available");
    expect(result.state.resources.tools).toBe(0);
  });

  it("fails to equip if dwarf already has a tool equipped", () => {
    const result = equipToolState(baseState, "d2");
    expect(result.success).toBe(false);
    expect(result.message).toContain("already has a tool");
    expect(result.state.resources.tools).toBe(2);
  });

  it("fails to equip if dwarf is away on expedition or crafting", () => {
    const awayResult = equipToolState(baseState, "d3");
    expect(awayResult.success).toBe(false);
    expect(awayResult.message).toContain("expedition");

    const craftingState: ColonyState = {
      ...baseState,
      dwarves: [
        { ...baseState.dwarves[0], status: "crafting", equippedTool: false },
      ],
    };
    const craftingResult = equipToolState(craftingState, "d1");
    expect(craftingResult.success).toBe(false);
    expect(craftingResult.message).toContain("crafting");
  });

  it("unequips a tool to inventory, incrementing tools and setting equippedTool to false", () => {
    const result = unequipToolState(baseState, "d2");
    expect(result.success).toBe(true);
    expect(result.state.resources.tools).toBe(3);
    const d2 = result.state.dwarves.find((d) => d.id === "d2");
    expect(d2?.equippedTool).toBe(false);

    // Invariant: Total tools conserved
    const totalBefore =
      baseState.resources.tools +
      baseState.dwarves.filter((d) => d.equippedTool).length;
    const totalAfter =
      result.state.resources.tools +
      result.state.dwarves.filter((d) => d.equippedTool).length;
    expect(totalAfter).toBe(totalBefore);
  });

  it("fails to unequip if dwarf does not have a tool equipped", () => {
    const result = unequipToolState(baseState, "d1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("does not have a tool");
    expect(result.state.resources.tools).toBe(2);
  });

  it("fails to unequip if dwarf is away on expedition or crafting", () => {
    const result = unequipToolState(baseState, "d3");
    expect(result.success).toBe(false);
    expect(result.message).toContain("expedition");
  });
});
