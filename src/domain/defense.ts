import type { RaidResolution, Resources } from "../types";

export const DEFENSE_WEAPON_THRESHOLD = 2;

/**
 * Pure simulation function to resolve a hostile raid against Stonehome.
 * Fulfills Requirement D7:
 * - If weapons >= DEFENSE_WEAPON_THRESHOLD (2): Defended! Repels attackers, consuming 1 weapon to battle wear.
 * - If weapons < DEFENSE_WEAPON_THRESHOLD: Under-defended breach! Raiders deterministically loot stored provisions and materials.
 */
export function resolveRaid(
  resources: Resources,
  weaponThreshold: number = DEFENSE_WEAPON_THRESHOLD,
): RaidResolution {
  const currentWeapons = Math.max(0, resources.weapons ?? 0);

  if (currentWeapons >= weaponThreshold) {
    return {
      defended: true,
      weaponsConsumed: 1,
      looted: {},
      message:
        "Stonehome garrison brandished forged weapons and repelled the goblin raid! 1 weapon was consumed in the defense.",
      tone: "good",
    };
  }

  // Deterministic looting formula:
  // Raiders loot up to 50% of food (minimum 1 if any food exists), up to 4 wood, and up to 3 stone.
  const foodLooted = Math.min(
    resources.food,
    Math.max(resources.food > 0 ? 1 : 0, Math.floor(resources.food * 0.5)),
  );
  const woodLooted = Math.min(resources.wood, 4);
  const stoneLooted = Math.min(resources.stone, 3);

  const looted: Partial<Resources> = {};
  const lootDescriptions: string[] = [];

  if (foodLooted > 0) {
    looted.food = foodLooted;
    lootDescriptions.push(`${foodLooted} food`);
  }
  if (woodLooted > 0) {
    looted.wood = woodLooted;
    lootDescriptions.push(`${woodLooted} wood`);
  }
  if (stoneLooted > 0) {
    looted.stone = stoneLooted;
    lootDescriptions.push(`${stoneLooted} stone`);
  }

  const plunderText =
    lootDescriptions.length > 0
      ? lootDescriptions.join(", ")
      : "scraps from the hold";

  return {
    defended: false,
    weaponsConsumed: 0,
    looted,
    message: `Goblin raiders breached the gates (${currentWeapons}/${weaponThreshold} weapons)! Enemies plundered ${plunderText}!`,
    tone: "warning",
  };
}

/**
 * Pure function to apply the outcome of a raid to colony resources.
 */
export function applyRaidToResources(
  resources: Resources,
  resolution: RaidResolution,
): Resources {
  if (resolution.defended) {
    return {
      ...resources,
      weapons: Math.max(0, resources.weapons - resolution.weaponsConsumed),
    };
  }

  return {
    ...resources,
    food: Math.max(0, resources.food - (resolution.looted.food ?? 0)),
    wood: Math.max(0, resources.wood - (resolution.looted.wood ?? 0)),
    stone: Math.max(0, resources.stone - (resolution.looted.stone ?? 0)),
    tools: Math.max(0, resources.tools - (resolution.looted.tools ?? 0)),
    weapons: Math.max(0, resources.weapons - (resolution.looted.weapons ?? 0)),
  };
}
