import { useEffect, useRef, useState, type ReactNode } from "react";
import { beginExpedition } from "../api";
import { applyRaidToResources, resolveRaid } from "../defense";
import { advanceDay, jobLabel } from "../simulation";
import { forgeTool, recruitFromCrystalCave, toolWoodCost } from "../species";
import type {
  Activity,
  ColonyState,
  Dwarf,
  JobType,
  RaidResolution,
  ResourceKey,
} from "../types";
import { ColonyContext, type ColonyContextValue } from "./ColonyContext";

const initialState: ColonyState = {
  day: 12,
  foodShortage: false,
  resources: {
    wood: 14,
    stone: 9,
    food: 18,
    tools: 1,
    weapons: 0,
  },
  dwarves: [
    {
      id: "dwarf-1",
      name: "Bromli Copperkeg",
      title: "Hold Warden",
      icon: "🧔🏻",
      species: "dwarf",
      assignment: "mining",
      status: "working",
      equippedTool: false,
      specialty: "mining",
    },
    {
      id: "dwarf-2",
      name: "Yrsa Flintbraid",
      title: "Trail Scout",
      icon: "🧔🏼‍♀️",
      species: "dwarf",
      assignment: "woodcutting",
      status: "working",
      equippedTool: false,
      specialty: "woodcutting",
    },
    {
      id: "dwarf-3",
      name: "Dori Ashmantle",
      title: "Stone Singer",
      icon: "🧔🏽",
      species: "dwarf",
      assignment: null,
      status: "idle",
      equippedTool: false,
    },
  ],
};

export function ColonyProvider({ children }: { children: ReactNode }) {
  const [colony, setColony] = useState(initialState);
  const [paused, setPaused] = useState(false);
  const [expeditionPending, setExpeditionPending] = useState(false);
  const [lastRaid, setLastRaid] = useState<RaidResolution | null>(null);
  const inFlightDwarves = useRef<Set<string>>(new Set());
  const [activities, setActivities] = useState<Activity[]>([
    {
      id: "welcome",
      day: 12,
      message: "The forge fires are lit. Stonehome wakes.",
    },
  ]);

  useEffect(() => {
    if (paused) return;

    const timer = window.setInterval(
      () => setColony((current) => advanceDay(current)),
      8_000,
    );

    return () => window.clearInterval(timer);
  }, [paused]);

  function assignDwarf(id: string, assignment: JobType) {
    const dwarf = colony.dwarves.find((item) => item.id === id);
    if (!dwarf || dwarf.status === "expedition" || dwarf.status === "crafting") {
      return;
    }

    setColony((current) => ({
      ...current,
      dwarves: current.dwarves.map((dwarf) =>
        dwarf.id === id && dwarf.status !== "expedition" && dwarf.status !== "crafting"
          ? {
            ...dwarf,
            assignment,
            status: assignment ? "working" : "idle",
          }
          : dwarf,
      ),
    }));

    setActivities((current) =>
      [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: `${dwarf.name} assigned to ${jobLabel(assignment)}.`,
        },
        ...current,
      ].slice(0, 6),
    );
  }

  function craftTool(workerId: string) {
    const worker = colony.dwarves.find((item) => item.id === workerId);
    if (!worker || worker.status !== "idle") return;

    if (colony.resources.wood < toolWoodCost(worker) || colony.resources.stone < 2) {
      setActivities((current) => [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: "The forge needs more wood or stone.",
          tone: "warning" as const,
        },
        ...current,
      ]);
      return;
    }

    setColony((current) => forgeTool(current, workerId));
    setActivities((current) =>
      [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: `${worker.name} forged a tool.`,
          tone: "good" as const,
        },
        ...current,
      ].slice(0, 6),
    );
  }

  async function sendExpedition(dwarfId: string, destination: string) {
    if (inFlightDwarves.current.has(dwarfId)) return;

    const dwarf = colony.dwarves.find((item) => item.id === dwarfId);
    if (!dwarf || dwarf.status === "expedition" || dwarf.status === "crafting") {
      return;
    }

    inFlightDwarves.current.add(dwarfId);
    setExpeditionPending(true);
    setLastRaid(null);
    setColony((current) => ({
      ...current,
      dwarves: current.dwarves.map((item) =>
        item.id === dwarf.id ? { ...item, status: "expedition" } : item,
      ),
    }));
    setActivities((current) => [
      {
        id: crypto.randomUUID(),
        day: colony.day,
        message: `${dwarf.name} departed for ${destination.replace("-", " ")}.`,
      },
      ...current,
    ]);

    try {
      const result = await beginExpedition(dwarf.id, destination);

      let raidOutcome: RaidResolution | null = null;

      setColony((current) => {
        const withRewards = Object.entries(result.rewards).reduce(
          (all, [key, amount]) => ({
            ...all,
            [key]: all[key as ResourceKey] + (amount ?? 0),
          }),
          current.resources,
        );

        let finalResources = withRewards;
        if (result.triggersRaid) {
          raidOutcome = resolveRaid(withRewards);
          finalResources = applyRaidToResources(withRewards, raidOutcome);
        }

        const returnedDwarves: Dwarf[] = current.dwarves.map((item) =>
          item.id === dwarf.id
            ? { ...item, status: item.assignment ? "working" : "idle" }
            : item,
        );

        return recruitFromCrystalCave({
          ...current,
          resources: finalResources,
          dwarves: returnedDwarves,
        }, destination);
      });

      if (raidOutcome) {
        setLastRaid(raidOutcome);
      }

      setActivities((current) => {
        const newActivities: Activity[] = [];
        if (raidOutcome) {
          newActivities.push({
            id: crypto.randomUUID(),
            day: colony.day,
            message: (raidOutcome as RaidResolution).message,
            tone: (raidOutcome as RaidResolution).tone,
          });
        }
        newActivities.push({
          id: result.expeditionId,
          day: colony.day,
          message: result.message,
          tone: "good" as const,
        });

        return [...newActivities, ...current].slice(0, 6);
      });
    } catch (error) {
      setColony((current) => ({
        ...current,
        dwarves: current.dwarves.map((item) =>
          item.id === dwarf.id
            ? {
              ...item,
              status: item.assignment ? "working" : "idle",
            }
            : item,
        ),
      }));
      setActivities((current) =>
        [
          {
            id: crypto.randomUUID(),
            day: colony.day,
            message:
              error instanceof Error
                ? error.message
                : "The expedition was lost from view.",
            tone: "warning" as const,
          },
          ...current,
        ].slice(0, 6),
      );
    } finally {
      inFlightDwarves.current.delete(dwarfId);
      setExpeditionPending(false);
    }
  }

  const value: ColonyContextValue = {
    colony,
    paused,
    activities,
    expeditionPending,
    lastRaid,
    dismissRaidAlert: () => setLastRaid(null),
    togglePaused: () => setPaused((value) => !value),
    assignDwarf,
    craftTool,
    sendExpedition,
  };

  return <ColonyContext value={value}>{children}</ColonyContext>;
}
