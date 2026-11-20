# Dwarfhold Changelog

This document tracks architectural and code changes made to the codebase, explaining what was changed and the reasoning behind each change.

---

## Step 0 — Shared Architectural Contracts (Day 0 Alignment)

### 1. `src/types.ts`
* **What was changed:**
  * Added `"weapons"` to `ResourceKey` and `weapons: number` to the `Resources` interface.
  * Added `"crafting"` to `DwarfStatus` (`"idle" | "working" | "crafting" | "expedition"`) and exported an alias `type WorkerStatus = DwarfStatus`.
  * Added `Species` type (`"dwarf" | "kobold" | "goblin" | "elf"`) and added `species?: Species` to the `Dwarf` interface (defaulting to `"dwarf"`).
  * Added `equippedTool?: boolean` to the `Dwarf` interface.
  * Added `CraftingTask` interface (`id`, `recipeId`, `workerId`, `progress`, `duration`) and optional `activeCrafting?: CraftingTask | null` to `ColonyState`.
* **Why:**
  * **D2 & D7 alignment:** `weapons` is required as a colony resource crafted via D2 recipes and evaluated during D7 expedition raid events. Adding it upfront allows Person 2 to write defense checks without waiting for Person 1's Forge UI.
  * **D1 & D3 worker availability invariant:** A dwarf can only contribute to one activity at a time. Adding `"crafting"` status ensures that dwarfs assigned to forge work cannot simultaneously produce local resources or depart on expeditions.
  * **D2 equipment system:** `equippedTool` provides a typed representation of tool ownership on the worker, enabling the +1 daily resource yield rule.
  * **D6 new species foundation:** The `Species` type and `species` field enable Person 2 to recruit and distinguish non-dwarf residents in the roster and assign custom traits.
  * **D3 & D5 crafting & persistence contract:** Pre-defining `CraftingTask` ensures Person 1 (crafting logic) and Person 2 (persistence/recovery engine) share an identical structure for timed crafting state.

---

### 2. `src/components/ResourceBar.tsx`
* **What was changed:**
  * Added `weapons: ["⚔️", "Weapons"]` to the `details` resource metadata map.
* **Why:**
  * Since `ResourceBar` iterates dynamically over `Object.entries(resources)`, every key in `Resources` must have corresponding display metadata (icon and label) to prevent runtime undefined errors.

---

### 3. `src/pages/ColonyPage.tsx`
* **What was changed:**
  * Added `weapons: 0` to the initial accumulator object in `dailyOutput` calculation (`Record<ResourceKey, number>`).
* **Why:**
  * Ensures type consistency with `Record<ResourceKey, number>` during shift ledger aggregation.

---

### 4. `src/state/ColonyProvider.tsx`
* **What was changed:**
  * Updated `initialState.resources` to include `weapons: 0`.
  * Updated the initial three dwarves to include `species: "dwarf"` and `equippedTool: false`.
* **Why:**
  * Keeps the initial runtime state strictly compliant with the updated TypeScript contracts and establishes the baseline for equipment and species mechanics.

---

### 4. `src/simulation.test.ts`
* **What was changed:**
  * Updated mock colony test fixtures to include `weapons: 0`.
* **Why:**
  * Maintains test suite health and TypeScript type-checking compliance.

---

### 5. Architectural Agreement: D4 / D2 Expedition Tool Policy
* **Decision:**
  * *An equipped tool remains with the travelling dwarf when sent on an expedition.*
  * While away on an expedition, the dwarf does not perform local jobs, so no daily production bonus is generated.
  * If the dwarf returns safely, their tool remains equipped; if an expedition fails, the dwarf returns with their equipment intact.
* **Why:**
  * Prevents state desynchronization between Person 1's equipment management and Person 2's async expedition lifecycle.
