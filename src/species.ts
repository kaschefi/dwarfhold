import type { ColonyState, Dwarf } from "./types";

export const KIVI_ID = "kobold-kivi";

const kivi: Dwarf = {
  id: KIVI_ID,
  name: "Kivi Stonespark",
  title: "Crystal Cave Scavenger",
  icon: "🦎",
  species: "kobold",
  assignment: null,
  status: "idle",
  equippedTool: false,
  specialty: "mining",
};

export function recruitFromCrystalCave(
  colony: ColonyState,
  destination: string,
): ColonyState {
  if (destination !== "crystal-cave") return colony;
  if (colony.dwarves.some((worker) => worker.id === KIVI_ID)) return colony;

  return { ...colony, dwarves: [...colony.dwarves, { ...kivi }] };
}

export function toolWoodCost(worker: Dwarf): number {
  return worker.species === "kobold" ? 2 : 3;
}

export function forgeTool(colony: ColonyState, workerId: string): ColonyState {
  const worker = colony.dwarves.find((item) => item.id === workerId);
  if (!worker || worker.status !== "idle") return colony;

  const woodCost = toolWoodCost(worker);
  if (colony.resources.wood < woodCost || colony.resources.stone < 2) {
    return colony;
  }

  return {
    ...colony,
    resources: {
      ...colony.resources,
      wood: colony.resources.wood - woodCost,
      stone: colony.resources.stone - 2,
      tools: colony.resources.tools + 1,
    },
  };
}
