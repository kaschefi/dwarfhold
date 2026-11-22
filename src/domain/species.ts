import type { ColonyState, Dwarf } from "../types";

export const KIVI_ID = "kobold-kivi";

export const KIVI_RECRUIT: Dwarf = {
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

export interface RecruitResult {
  state: ColonyState;
  recruited: Dwarf | null;
}

export function checkExpeditionRecruit(
  colony: ColonyState,
  destination: string,
): RecruitResult {
  if (destination !== "crystal-cave") {
    return { state: colony, recruited: null };
  }
  if (colony.dwarves.some((worker) => worker.id === KIVI_ID)) {
    return { state: colony, recruited: null };
  }

  const recruit: Dwarf = { ...KIVI_RECRUIT };
  return {
    state: {
      ...colony,
      dwarves: [...colony.dwarves, recruit],
    },
    recruited: recruit,
  };
}

export function toolWoodCost(worker?: Dwarf): number {
  return worker?.species === "kobold" ? 2 : 3;
}
