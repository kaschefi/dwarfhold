import { describe, expect, it } from "vitest";
import { advanceDay } from "./simulation";
import type { ColonyState } from "./types";
describe("colony simulation", () => {
  it("produces assigned resources and feeds the company", () => {
    const state: ColonyState = { day: 1, resources: { wood: 0, stone: 0, food: 5, tools: 0, weapons: 0 }, dwarves: [{ id: "d1", name: "Brom", title: "", icon: "", assignment: "woodcutting", status: "working" }] };
    expect(advanceDay(state)).toMatchObject({ day: 2, resources: { wood: 3, food: 4 } });
    expect(state.resources.wood).toBe(0);
  });

  it("does not produce resources when dwarf is away on expedition", () => {
    const state: ColonyState = {
      day: 1,
      resources: { wood: 0, stone: 0, food: 5, tools: 0, weapons: 0 },
      dwarves: [
        { id: "d1", name: "Brom", title: "", icon: "", assignment: "woodcutting", status: "expedition" },
      ],
    };
    const nextState = advanceDay(state);
    expect(nextState.resources.wood).toBe(0);
    expect(nextState.resources.food).toBe(4);
  });
});
