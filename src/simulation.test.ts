import { describe, expect, it } from "vitest";
import { advanceDay } from "./simulation";
import type { ColonyState } from "./types";

describe("colony simulation", () => {
  it("produces assigned resources and feeds the company", () => {
    const state: ColonyState = {
      day: 1,
      foodShortage: false,
      resources: {
        wood: 0,
        stone: 0,
        food: 5,
        tools: 0,
        weapons: 0,
      },
      dwarves: [
        {
          id: "d1",
          name: "Brom",
          title: "",
          icon: "",
          assignment: "woodcutting",
          status: "working",
        },
      ],
    };
    expect(advanceDay(state)).toMatchObject({ day: 2, resources: { wood: 3, food: 4 } });
    expect(state.resources.wood).toBe(0);
  });

  it("does not produce resources when dwarf is away on expedition", () => {
    const state: ColonyState = {
      day: 1,
      foodShortage: false,
      resources: { wood: 0, stone: 0, food: 5, tools: 0, weapons: 0 },
      dwarves: [
        { id: "d1", name: "Brom", title: "", icon: "", assignment: "woodcutting", status: "expedition" },
      ],
    };
    const nextState = advanceDay(state);
    expect(nextState.resources.wood).toBe(0);
    expect(nextState.resources.food).toBe(4);
  });

  it("reduces production on the day after a food shortage", () => {
    const start: ColonyState = {
      day: 1,
      foodShortage: false,
      resources: {
        wood: 0,
        stone: 0,
        food: 0,
        tools: 0,
        weapons: 0,
      },
      dwarves: [
        {
          id: "d1",
          name: "Brom",
          title: "",
          icon: "",
          assignment: "woodcutting",
          status: "working",
        },
      ],
    };

    const day2 = advanceDay(start);
    expect(day2.resources.wood).toBe(3);
    expect(day2.foodShortage).toBe(true);

    const day3 = advanceDay(day2);
    expect(day3.resources.wood).toBe(4);
  });

  it("grants +1 production benefit per day when dwarf has an equipped tool", () => {
    const state: ColonyState = {
      day: 1,
      foodShortage: false,
      resources: { wood: 0, stone: 0, food: 10, tools: 0, weapons: 0 },
      dwarves: [
        {
          id: "d1",
          name: "Brom",
          title: "",
          icon: "",
          assignment: "woodcutting",
          status: "working",
          equippedTool: true,
        },
        {
          id: "d2",
          name: "Dori",
          title: "",
          icon: "",
          assignment: "mining",
          status: "working",
          equippedTool: true,
        },
        {
          id: "d3",
          name: "Yrsa",
          title: "",
          icon: "",
          assignment: "farming",
          status: "working",
          equippedTool: true,
        },
      ],
    };

    const next = advanceDay(state);
    // woodcutting: 3 -> 4, mining: 2 -> 3, farming: 4 -> 5
    // food: 10 + 5 produced - 3 eaten = 12
    expect(next.resources.wood).toBe(4);
    expect(next.resources.stone).toBe(3);
    expect(next.resources.food).toBe(12);
  });

  it("does not produce equipped tool bonus when dwarf is not working", () => {
    const state: ColonyState = {
      day: 1,
      foodShortage: false,
      resources: { wood: 0, stone: 0, food: 10, tools: 0, weapons: 0 },
      dwarves: [
        {
          id: "d1",
          name: "Brom",
          title: "",
          icon: "",
          assignment: "woodcutting",
          status: "expedition",
          equippedTool: true,
        },
        {
          id: "d2",
          name: "Dori",
          title: "",
          icon: "",
          assignment: "mining",
          status: "crafting",
          equippedTool: true,
        },
        {
          id: "d3",
          name: "Yrsa",
          title: "",
          icon: "",
          assignment: null,
          status: "idle",
          equippedTool: true,
        },
      ],
    };

    const next = advanceDay(state);
    expect(next.resources.wood).toBe(0);
    expect(next.resources.stone).toBe(0);
    expect(next.resources.food).toBe(7); // 10 - 3 eaten = 7
  });

  it("applies food shortage reduction to equipped tool production", () => {
    const start: ColonyState = {
      day: 1,
      foodShortage: true,
      resources: { wood: 0, stone: 0, food: 10, tools: 0, weapons: 0 },
      dwarves: [
        {
          id: "d1",
          name: "Brom",
          title: "",
          icon: "",
          assignment: "woodcutting",
          status: "working",
          equippedTool: true, // (3 + 1) / 2 = 2
        },
        {
          id: "d2",
          name: "Dori",
          title: "",
          icon: "",
          assignment: "mining",
          status: "working",
          equippedTool: true, // (2 + 1) / 2 = 1
        },
      ],
    };

    const next = advanceDay(start);
    expect(next.resources.wood).toBe(2);
    expect(next.resources.stone).toBe(1);
  });
});
