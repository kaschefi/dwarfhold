import type { ColonyState, Resources } from "../types";

export const WEAPON_COST = {
  wood: 2,
  stone: 4,
} as const;

export const TOOL_COST = {
  wood: 3,
  stone: 2,
} as const;

export interface CraftResult {
  state: ColonyState;
  success: boolean;
  message: string;
}

export function canCraftWeapon(resources: Resources): boolean {
  return resources.wood >= WEAPON_COST.wood && resources.stone >= WEAPON_COST.stone;
}

export function canCraftTool(resources: Resources): boolean {
  return resources.wood >= TOOL_COST.wood && resources.stone >= TOOL_COST.stone;
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
