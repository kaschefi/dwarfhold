import { createContext, useContext } from "react";
import type { Activity, ColonyState, JobType, RaidResolution } from "../types";

export interface ColonyContextValue {
  colony: ColonyState;
  paused: boolean;
  activities: Activity[];
  expeditionPending: boolean;
  lastRaid: RaidResolution | null;
  dismissRaidAlert: () => void;
  togglePaused: () => void;
  assignDwarf: (id: string, assignment: JobType) => void;
  equipTool: (dwarfId: string) => void;
  unequipTool: (dwarfId: string) => void;
  craftTool: () => void;
  craftWeapon: () => void;
  sendExpedition: (dwarfId: string, destination: string) => Promise<void>;
}

export const ColonyContext = createContext<ColonyContextValue | null>(null);

export function useColony(): ColonyContextValue {
  const context = useContext(ColonyContext);
  if (!context) {
    throw new Error("useColony must be used inside <ColonyProvider>");
  }
  return context;
}
