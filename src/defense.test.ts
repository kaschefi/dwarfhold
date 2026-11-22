import { describe, expect, it } from "vitest";
import {
  applyRaidToResources,
  DEFENSE_WEAPON_THRESHOLD,
  resolveRaid,
} from "./defense";
import type { Resources } from "./types";

describe("colony defense and raid resolution", () => {
  const baseResources: Resources = {
    food: 20,
    wood: 15,
    stone: 10,
    tools: 2,
    weapons: 0,
  };

  it("repels attack when weapons meet threshold (2 weapons), consuming exactly 1 weapon", () => {
    const resources = { ...baseResources, weapons: 2 };
    const outcome = resolveRaid(resources, DEFENSE_WEAPON_THRESHOLD);

    expect(outcome.defended).toBe(true);
    expect(outcome.weaponsConsumed).toBe(1);
    expect(outcome.looted).toEqual({});
    expect(outcome.tone).toBe("good");
    expect(outcome.message).toContain("repelled the goblin raid");
    expect(outcome.message).toContain("1 weapon was consumed");

    const updated = applyRaidToResources(resources, outcome);
    expect(updated.weapons).toBe(1);
    expect(updated.food).toBe(20);
    expect(updated.wood).toBe(15);
    expect(updated.stone).toBe(10);
  });

  it("repels attack when weapons exceed threshold (e.g. 5 weapons)", () => {
    const resources = { ...baseResources, weapons: 5 };
    const outcome = resolveRaid(resources, DEFENSE_WEAPON_THRESHOLD);

    expect(outcome.defended).toBe(true);
    expect(outcome.weaponsConsumed).toBe(1);

    const updated = applyRaidToResources(resources, outcome);
    expect(updated.weapons).toBe(4);
  });

  it("fails defense when weapons are below threshold (1 weapon) and loots deterministic resources", () => {
    const resources = { ...baseResources, weapons: 1 };
    const outcome = resolveRaid(resources, DEFENSE_WEAPON_THRESHOLD);

    expect(outcome.defended).toBe(false);
    expect(outcome.weaponsConsumed).toBe(0);
    expect(outcome.tone).toBe("warning");
    expect(outcome.message).toContain("breached the gates");
    expect(outcome.message).toContain("plundered 10 food, 4 wood, 3 stone");

    // 50% of 20 food = 10, max 4 wood = 4, max 3 stone = 3
    expect(outcome.looted).toEqual({
      food: 10,
      wood: 4,
      stone: 3,
    });

    const updated = applyRaidToResources(resources, outcome);
    expect(updated.weapons).toBe(1); // Weapons preserved
    expect(updated.food).toBe(10); // 20 - 10
    expect(updated.wood).toBe(11); // 15 - 4
    expect(updated.stone).toBe(7); // 10 - 3
  });

  it("fails defense when colony has 0 weapons", () => {
    const resources = { ...baseResources, weapons: 0 };
    const outcome = resolveRaid(resources, DEFENSE_WEAPON_THRESHOLD);

    expect(outcome.defended).toBe(false);
    expect(outcome.weaponsConsumed).toBe(0);
    expect(outcome.tone).toBe("warning");
    expect(outcome.looted.food).toBe(10);
    expect(outcome.looted.wood).toBe(4);
    expect(outcome.looted.stone).toBe(3);
  });

  it("never loots more than available resources and clamps to zero", () => {
    const lowResources: Resources = {
      food: 1,
      wood: 2,
      stone: 0,
      tools: 0,
      weapons: 0,
    };
    const outcome = resolveRaid(lowResources, DEFENSE_WEAPON_THRESHOLD);

    expect(outcome.defended).toBe(false);
    expect(outcome.looted.food).toBe(1);
    expect(outcome.looted.wood).toBe(2);
    expect(outcome.looted.stone).toBeUndefined();

    const updated = applyRaidToResources(lowResources, outcome);
    expect(updated.food).toBe(0);
    expect(updated.wood).toBe(0);
    expect(updated.stone).toBe(0);
  });

  it("handles completely empty hold without crashing", () => {
    const emptyResources: Resources = {
      food: 0,
      wood: 0,
      stone: 0,
      tools: 0,
      weapons: 0,
    };
    const outcome = resolveRaid(emptyResources, DEFENSE_WEAPON_THRESHOLD);

    expect(outcome.defended).toBe(false);
    expect(outcome.message).toContain("scraps from the hold");

    const updated = applyRaidToResources(emptyResources, outcome);
    expect(updated.food).toBe(0);
    expect(updated.wood).toBe(0);
    expect(updated.stone).toBe(0);
  });
});
