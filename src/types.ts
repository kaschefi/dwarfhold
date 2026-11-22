export type ResourceKey = "wood" | "stone" | "food" | "tools" | "weapons";
export type JobType = "woodcutting" | "mining" | "farming" | null;
export type DwarfStatus = "idle" | "working" | "crafting" | "expedition";
export type WorkerStatus = DwarfStatus;

export type Species = "dwarf" | "kobold" | "goblin" | "elf";

export interface Resources {
  wood: number;
  stone: number;
  food: number;
  tools: number;
  weapons: number;
}

export interface Dwarf {
  id: string;
  name: string;
  title: string;
  icon: string;
  species?: Species;
  assignment: JobType;
  status: DwarfStatus;
  equippedTool?: boolean;
  specialty?: Exclude<JobType, null>;
}

export interface CraftingTask {
  id: string;
  recipeId: "tool" | "weapon";
  workerId: string;
  progress: number;
  duration: number;
}

export interface ColonyState {
  day: number;
  foodShortage: boolean;
  resources: Resources;
  dwarves: Dwarf[];
  activeCrafting?: CraftingTask | null;
}


export interface RaidResolution {
  defended: boolean;
  weaponsConsumed: number;
  looted: Partial<Resources>;
  message: string;
  tone: "good" | "warning";
}

export interface ExpeditionResult {
  expeditionId: string;
  status: "completed";
  rewards: Partial<Resources>;
  message: string;
  triggersRaid?: boolean;
}

export interface Activity {
  id: string;
  day: number;
  message: string;
  tone?: "good" | "warning";
}
