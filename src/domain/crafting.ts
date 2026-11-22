import type { ColonyState, CraftingTask, Dwarf, Resources } from "../types";
import { toolWoodCost } from "./species";

export const WEAPON_COST = {
  wood: 2,
  stone: 4,
} as const;

export const TOOL_COST = {
  wood: 3,
  stone: 2,
} as const;

export function getRecipeCost(
  recipeId: "tool" | "weapon",
  worker?: Dwarf,
): { wood: number; stone: number } {
  if (recipeId === "tool") {
    return {
      wood: toolWoodCost(worker),
      stone: TOOL_COST.stone,
    };
  }
  return WEAPON_COST;
}

export const CRAFTING_DURATIONS: Record<"tool" | "weapon", number> = {
  tool: 2,
  weapon: 2,
};

export interface CraftResult {
  state: ColonyState;
  success: boolean;
  message: string;
}

export interface StartCraftResult {
  state: ColonyState;
  success: boolean;
  message: string;
  task?: CraftingTask;
}

export interface ProgressCraftResult {
  state: ColonyState;
  completedTask: CraftingTask | null;
  completionMessage?: string;
}

export function canCraftWeapon(resources: Resources, worker?: Dwarf): boolean {
  if (worker?.species === "kobold") return false;
  return resources.wood >= WEAPON_COST.wood && resources.stone >= WEAPON_COST.stone;
}

export function canCraftTool(resources: Resources, worker?: Dwarf): boolean {
  const cost = getRecipeCost("tool", worker);
  return resources.wood >= cost.wood && resources.stone >= cost.stone;
}

export function startCraftingTask(
  state: ColonyState,
  recipeId: "tool" | "weapon",
  workerId: string,
  duration?: number,
): StartCraftResult {
  if (state.activeCrafting) {
    return {
      state,
      success: false,
      message: "The forge is already occupied by an active crafting project.",
    };
  }

  const worker = state.dwarves.find((d) => d.id === workerId);
  if (!worker) {
    return {
      state,
      success: false,
      message: "Selected worker not found in Stonehome.",
    };
  }

  if (worker.status === "expedition") {
    return {
      state,
      success: false,
      message: `${worker.name} is away on an expedition and cannot craft.`,
    };
  }

  if (worker.status === "crafting") {
    return {
      state,
      success: false,
      message: `${worker.name} is already crafting at the forge.`,
    };
  }

  if (worker.species === "kobold" && recipeId === "weapon") {
    return {
      state,
      success: false,
      message: `${worker.name} lacks the physical strength to hammer heavy dwarven war weapons.`,
    };
  }

  const cost = getRecipeCost(recipeId, worker);
  const { wood, stone } = state.resources;

  if (wood < cost.wood && stone < cost.stone) {
    return {
      state,
      success: false,
      message: `The forge needs more timber and stone to forge a ${recipeId}.`,
    };
  }

  if (wood < cost.wood) {
    return {
      state,
      success: false,
      message: `The forge needs more timber to forge a ${recipeId}.`,
    };
  }

  if (stone < cost.stone) {
    return {
      state,
      success: false,
      message: `The forge needs more stone to forge a ${recipeId}.`,
    };
  }

  const taskDuration = duration ?? CRAFTING_DURATIONS[recipeId];
  const task: CraftingTask = {
    id: `craft-${Date.now()}`,
    recipeId,
    workerId,
    progress: 0,
    duration: taskDuration,
  };

  return {
    state: {
      ...state,
      resources: {
        ...state.resources,
        wood: state.resources.wood - cost.wood,
        stone: state.resources.stone - cost.stone,
      },
      dwarves: state.dwarves.map((d) =>
        d.id === workerId ? { ...d, status: "crafting" } : d,
      ),
      activeCrafting: task,
    },
    success: true,
    message: `${worker.name} began forging a ${recipeId} at the Ember Forge.`,
    task,
  };
}

export function progressCrafting(state: ColonyState): ProgressCraftResult {
  if (!state.activeCrafting) {
    return { state, completedTask: null };
  }

  const task = state.activeCrafting;
  const nextProgress = task.progress + 1;

  if (nextProgress >= task.duration) {
    const nextResources = { ...state.resources };
    if (task.recipeId === "tool") {
      nextResources.tools += 1;
    } else if (task.recipeId === "weapon") {
      nextResources.weapons += 1;
    }

    const worker = state.dwarves.find((d) => d.id === task.workerId);
    const workerName = worker ? worker.name : "The artisan";

    const nextDwarves = state.dwarves.map((d) => {
      if (d.id === task.workerId) {
        return {
          ...d,
          status: d.assignment ? ("working" as const) : ("idle" as const),
        };
      }
      return dwarfOrDefault(d);
    });

    return {
      state: {
        ...state,
        resources: nextResources,
        dwarves: nextDwarves,
        activeCrafting: null,
      },
      completedTask: task,
      completionMessage: `${workerName} finished forging a ${task.recipeId === "tool" ? "sturdy iron tool" : "stout weapon"}!`,
    };
  }

  return {
    state: {
      ...state,
      activeCrafting: {
        ...task,
        progress: nextProgress,
      },
    },
    completedTask: null,
  };
}

function dwarfOrDefault(d: any) {
  return d;
}

export function craftWeaponState(state: ColonyState): CraftResult {
  const { wood, stone } = state.resources;

  if (wood < WEAPON_COST.wood && stone < WEAPON_COST.stone) {
    return {
      state,
      success: false,
      message: "The forge needs more timber and stone to forge a weapon.",
    };
  }

  if (wood < WEAPON_COST.wood) {
    return {
      state,
      success: false,
      message: "The forge needs more timber to forge a weapon.",
    };
  }

  if (stone < WEAPON_COST.stone) {
    return {
      state,
      success: false,
      message: "The forge needs more stone to forge a weapon.",
    };
  }

  return {
    state: {
      ...state,
      resources: {
        ...state.resources,
        wood: state.resources.wood - WEAPON_COST.wood,
        stone: state.resources.stone - WEAPON_COST.stone,
        weapons: state.resources.weapons + 1,
      },
    },
    success: true,
    message: "A stout dwarven weapon joins the hold armory.",
  };
}
