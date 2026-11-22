import type { ColonyState } from "./types";

export interface EquipmentActionResult {
  state: ColonyState;
  success: boolean;
  message: string;
}

export function equipToolState(
  state: ColonyState,
  dwarfId: string,
): EquipmentActionResult {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  if (!dwarf) {
    return { state, success: false, message: "Dwarf not found." };
  }

  if (dwarf.status === "expedition") {
    return {
      state,
      success: false,
      message: `${dwarf.name} is away on an expedition and cannot equip a tool.`,
    };
  }

  if (dwarf.status === "crafting") {
    return {
      state,
      success: false,
      message: `${dwarf.name} is currently crafting at the forge.`,
    };
  }

  if (dwarf.equippedTool) {
    return {
      state,
      success: false,
      message: `${dwarf.name} already has a tool equipped.`,
    };
  }

  if (state.resources.tools < 1) {
    return {
      state,
      success: false,
      message: "No tools available in the stores.",
    };
  }

  return {
    state: {
      ...state,
      resources: {
        ...state.resources,
        tools: state.resources.tools - 1,
      },
      dwarves: state.dwarves.map((item) =>
        item.id === dwarfId ? { ...item, equippedTool: true } : item,
      ),
    },
    success: true,
    message: `${dwarf.name} equipped a sturdy tool from the stores.`,
  };
}

export function unequipToolState(
  state: ColonyState,
  dwarfId: string,
): EquipmentActionResult {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  if (!dwarf) {
    return { state, success: false, message: "Dwarf not found." };
  }

  if (dwarf.status === "expedition") {
    return {
      state,
      success: false,
      message: `${dwarf.name} is away on an expedition and cannot unequip their tool.`,
    };
  }

  if (dwarf.status === "crafting") {
    return {
      state,
      success: false,
      message: `${dwarf.name} is currently crafting at the forge.`,
    };
  }

  if (!dwarf.equippedTool) {
    return {
      state,
      success: false,
      message: `${dwarf.name} does not have a tool equipped.`,
    };
  }

  return {
    state: {
      ...state,
      resources: {
        ...state.resources,
        tools: state.resources.tools + 1,
      },
      dwarves: state.dwarves.map((item) =>
        item.id === dwarfId ? { ...item, equippedTool: false } : item,
      ),
    },
    success: true,
    message: `${dwarf.name} returned their tool to the stores.`,
  };
}
