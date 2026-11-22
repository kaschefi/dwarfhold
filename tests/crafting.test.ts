import { describe, expect, it } from "vitest";
import { canCraftTool, canCraftWeapon, craftWeaponState, WEAPON_COST } from "../src/domain/crafting";
import type { ColonyState } from "../src/types";

describe("colony crafting system", () => {
  const baseState: ColonyState = {
    day: 1,
    foodShortage: false,
    resources: {
      wood: 10,
      stone: 10,
      food: 10,
      tools: 0,
      weapons: 0,
    },
    dwarves: [],
  };

  it("crafts a weapon successfully, consuming 2 wood and 4 stone and adding 1 weapon", () => {
    const result = craftWeaponState(baseState);
    expect(result.success).toBe(true);
    expect(result.state.resources.wood).toBe(10 - WEAPON_COST.wood);
    expect(result.state.resources.stone).toBe(10 - WEAPON_COST.stone);
    expect(result.state.resources.weapons).toBe(1);
    expect(result.message).toContain("stout dwarven weapon");
  });

  it("fails to craft a weapon if wood is insufficient", () => {
    const lowWoodState: ColonyState = {
      ...baseState,
      resources: { ...baseState.resources, wood: 1, stone: 10 },
    };
    const result = craftWeaponState(lowWoodState);
    expect(result.success).toBe(false);
    expect(result.message).toContain("more timber");
    expect(result.state.resources.weapons).toBe(0);
    expect(result.state.resources.wood).toBe(1);
  });

  it("fails to craft a weapon if stone is insufficient", () => {
    const lowStoneState: ColonyState = {
      ...baseState,
      resources: { ...baseState.resources, wood: 10, stone: 3 },
    };
    const result = craftWeaponState(lowStoneState);
    expect(result.success).toBe(false);
    expect(result.message).toContain("more stone");
    expect(result.state.resources.weapons).toBe(0);
    expect(result.state.resources.stone).toBe(3);
  });

  it("fails to craft a weapon if both wood and stone are insufficient", () => {
    const lowAllState: ColonyState = {
      ...baseState,
      resources: { ...baseState.resources, wood: 1, stone: 2 },
    };
    const result = craftWeaponState(lowAllState);
    expect(result.success).toBe(false);
    expect(result.message).toContain("timber and stone");
    expect(result.state.resources.weapons).toBe(0);
  });

  it("correctly identifies crafting eligibility using canCraftWeapon and canCraftTool", () => {
    expect(canCraftWeapon({ wood: 2, stone: 4, food: 0, tools: 0, weapons: 0 })).toBe(true);
    expect(canCraftWeapon({ wood: 1, stone: 4, food: 0, tools: 0, weapons: 0 })).toBe(false);
    expect(canCraftWeapon({ wood: 2, stone: 3, food: 0, tools: 0, weapons: 0 })).toBe(false);

    expect(canCraftTool({ wood: 3, stone: 2, food: 0, tools: 0, weapons: 0 })).toBe(true);
    expect(canCraftTool({ wood: 2, stone: 2, food: 0, tools: 0, weapons: 0 })).toBe(false);
  });
});
