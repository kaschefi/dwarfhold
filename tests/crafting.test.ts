import { describe, expect, it } from "vitest";
import {
  CRAFTING_DURATIONS,
  canCraftTool,
  canCraftWeapon,
  craftWeaponState,
  progressCrafting,
  startCraftingTask,
  TOOL_COST,
  WEAPON_COST,
} from "../src/domain/crafting";
import { advanceDay } from "../src/domain/simulation";
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
    dwarves: [
      {
        id: "d1",
        name: "Bromli",
        title: "Miner",
        icon: "🧔🏻",
        assignment: "mining",
        status: "working",
      },
      {
        id: "d2",
        name: "Yrsa",
        title: "Scout",
        icon: "🧔🏼‍♀️",
        assignment: null,
        status: "idle",
      },
      {
        id: "d3",
        name: "Dori",
        title: "Away",
        icon: "🧔🏽",
        assignment: null,
        status: "expedition",
      },
    ],
  };

  describe("instant crafting fallback", () => {
    it("crafts a weapon immediately via craftWeaponState", () => {
      const result = craftWeaponState(baseState);
      expect(result.success).toBe(true);
      expect(result.state.resources.wood).toBe(10 - WEAPON_COST.wood);
      expect(result.state.resources.stone).toBe(10 - WEAPON_COST.stone);
      expect(result.state.resources.weapons).toBe(1);
    });

      it("fails to craft a weapon if materials are insufficient", () => {
        const lowState: ColonyState = {
          ...baseState,
          resources: { ...baseState.resources, wood: 1, stone: 1 },
        };
        const result = craftWeaponState(lowState);
        expect(result.success).toBe(false);
        expect(result.state.resources.wood).toBe(1);
        expect(result.state.resources.weapons).toBe(0);
      });
    });

    describe("timed crafting work (Requirement D3)", () => {
      it("starts a tool crafting task, deducting materials and assigning the artisan to crafting", () => {
        const result = startCraftingTask(baseState, "tool", "d1");
        expect(result.success).toBe(true);
        expect(result.state.resources.wood).toBe(10 - TOOL_COST.wood);
        expect(result.state.resources.stone).toBe(10 - TOOL_COST.stone);
        expect(result.state.resources.tools).toBe(0); // Not awarded yet!

          const artisan = result.state.dwarves.find((d) => d.id === "d1");
          expect(artisan?.status).toBe("crafting");

          expect(result.state.activeCrafting).toMatchObject({
            recipeId: "tool",
            workerId: "d1",
            progress: 0,
            duration: CRAFTING_DURATIONS.tool,
          });
        });

        it("starts a weapon crafting task, deducting materials and setting worker status", () => {
          const result = startCraftingTask(baseState, "weapon", "d2");
          expect(result.success).toBe(true);
          expect(result.state.resources.wood).toBe(10 - WEAPON_COST.wood);
          expect(result.state.resources.stone).toBe(10 - WEAPON_COST.stone);
          expect(result.state.resources.weapons).toBe(0);

          const artisan = result.state.dwarves.find((d) => d.id === "d2");
          expect(artisan?.status).toBe("crafting");
          expect(result.state.activeCrafting?.recipeId).toBe("weapon");
        });

        it("invariant: invalid attempt changes neither workers nor resources when materials are lacking", () => {
          const lowState: ColonyState = {
            ...baseState,
            resources: { ...baseState.resources, wood: 1, stone: 1 },
          };
          const result = startCraftingTask(lowState, "tool", "d1");
          expect(result.success).toBe(false);
          expect(result.state.resources.wood).toBe(1);
          expect(result.state.resources.stone).toBe(1);

          const worker = result.state.dwarves.find((d) => d.id === "d1");
          expect(worker?.status).toBe("working");
          expect(result.state.activeCrafting).toBeUndefined();
        });

        it("invariant: rejects crafting if worker is on an expedition or already crafting", () => {
          // Worker on expedition
          const awayResult = startCraftingTask(baseState, "tool", "d3");
          expect(awayResult.success).toBe(false);
          expect(awayResult.message).toContain("expedition");
          expect(awayResult.state.resources.wood).toBe(10);

          // Worker already crafting
          const busyState: ColonyState = {
            ...baseState,
            activeCrafting: {
              id: "task-1",
              recipeId: "tool",
              workerId: "d1",
              progress: 0,
              duration: 2,
            },
            dwarves: baseState.dwarves.map((d) =>
              d.id === "d1" ? { ...d, status: "crafting" } : d,
            ),
          };
          const busyResult = startCraftingTask(busyState, "weapon", "d1");
          expect(busyResult.success).toBe(false);
          expect(busyResult.message).toContain("already occupied");
        });

        it("progresses crafting task incrementally and completes when duration is reached", () => {
          const startResult = startCraftingTask(baseState, "tool", "d1", 2);
          expect(startResult.success).toBe(true);

          // Tick 1: Progress advances from 0 -> 1
          const tick1 = progressCrafting(startResult.state);
          expect(tick1.completedTask).toBeNull();
          expect(tick1.state.activeCrafting?.progress).toBe(1);
          expect(tick1.state.resources.tools).toBe(0);
          expect(tick1.state.dwarves.find((d) => d.id === "d1")?.status).toBe("crafting");

          // Tick 2: Progress advances from 1 -> 2 (reaches duration = 2)
          const tick2 = progressCrafting(tick1.state);
          expect(tick2.completedTask).not.toBeNull();
          expect(tick2.completedTask?.recipeId).toBe("tool");
          expect(tick2.state.activeCrafting).toBeNull();
          expect(tick2.state.resources.tools).toBe(1);

          // Artisan restored to working (since Bromli has assignment 'mining')
          const artisan = tick2.state.dwarves.find((d) => d.id === "d1");
          expect(artisan?.status).toBe("working");
        });

        it("restores unassigned artisan to idle upon crafting completion", () => {
          // Yrsa (d2) has assignment: null
          const startResult = startCraftingTask(baseState, "weapon", "d2", 1);
          const tick1 = progressCrafting(startResult.state);
          expect(tick1.completedTask?.recipeId).toBe("weapon");
          expect(tick1.state.resources.weapons).toBe(1);
          const artisan = tick1.state.dwarves.find((d) => d.id === "d2");
          expect(artisan?.status).toBe("idle");
        });

        it("artisan generates 0 job yield while crafting in advanceDay, and task completes automatically", () => {
          // Bromli is miner (yields +2 stone when working).
          // When crafting, he should yield 0 stone!
          const startResult = startCraftingTask(baseState, "tool", "d1", 2);
          const day1State = startResult.state; // stone is 8 (10 - 2 cost)

          // Advance Day 1: Bromli is crafting, so stone stays 8 (0 stone produced)
          const day2 = advanceDay(day1State);
          expect(day2.resources.stone).toBe(8);
          expect(day2.activeCrafting?.progress).toBe(1);
          expect(day2.dwarves.find((d) => d.id === "d1")?.status).toBe("crafting");

          // Advance Day 2: Craft completes! Tool awarded (+1), Bromli returns to working
          const day3 = advanceDay(day2);
          expect(day3.activeCrafting).toBeNull();
          expect(day3.resources.tools).toBe(1);
          expect(day3.dwarves.find((d) => d.id === "d1")?.status).toBe("working");
        });
      });

        describe("eligibility helpers", () => {
          it("correctly identifies crafting eligibility using canCraftWeapon and canCraftTool", () => {
            expect(canCraftWeapon({ wood: 2, stone: 4, food: 0, tools: 0, weapons: 0 })).toBe(true);
            expect(canCraftWeapon({ wood: 1, stone: 4, food: 0, tools: 0, weapons: 0 })).toBe(false);
            expect(canCraftWeapon({ wood: 2, stone: 3, food: 0, tools: 0, weapons: 0 })).toBe(false);

            expect(canCraftTool({ wood: 3, stone: 2, food: 0, tools: 0, weapons: 0 })).toBe(true);
            expect(canCraftTool({ wood: 2, stone: 2, food: 0, tools: 0, weapons: 0 })).toBe(false);
          });
        });
      });
