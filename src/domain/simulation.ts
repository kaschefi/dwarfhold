import type { ColonyState, JobType, Resources } from "../types";

export const production: Record<Exclude<JobType, null>, Partial<Resources>> = {
  woodcutting: { wood: 3 }, mining: { stone: 2 }, farming: { food: 4 },
};

export function advanceDay(state: ColonyState): ColonyState {
  const resources = { ...state.resources };

  state.dwarves.forEach((dwarf) => {
    if (dwarf.status !== "working" || !dwarf.assignment) return;

    const output = production[dwarf.assignment];

    Object.entries(output).forEach(([resource, amount]) => {
      let producedAmount = (amount ?? 0) + (dwarf.equippedTool ? 1 : 0);

      if (state.foodShortage) {
        producedAmount = Math.floor(producedAmount / 2);
      }

      resources[resource as keyof Resources] += producedAmount;
    });

  });

  const foodNeeded = state.dwarves.length;
  const foodAvailable = resources.food;
  const notEnoughFood = foodAvailable < foodNeeded;

  if (notEnoughFood) {
    resources.food = 0;
  } else {
    resources.food = foodAvailable - foodNeeded;
  }

  return {
    ...state,
    day: state.day + 1,
    resources,
    foodShortage: notEnoughFood,
  };
}

export const jobLabel = (job: JobType) => job ? ({
  woodcutting: "Woodcutting",
  mining: "Deep Mining",
  farming: "Mushroom Farm"
}[job]) : "Unassigned";
