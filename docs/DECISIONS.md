# Quality Goals and Team Decisions

This document outlines the architectural decisions, non-functional quality goals, and specific design choices made for **Stonehome (Dwarfhold)** to fulfill requirements **D1 through D7** and prepare for the oral exam defense.

---

## Part 1: Team Decisions Required by Specification (D1–D7)

The project specification explicitly tasked our team with defining rules, thresholds, and policies for several mechanics. Below are the concrete decisions, parameter values, rationales, and code locations for each.

| Requirement | Specification Prompt | Our Decision | Values / Formula | File Location |
| :--- | :--- | :--- | :--- | :--- |
| **D1: Food Shortage** | *"The exact shortage consequence may be chosen by your team, but it must affect gameplay, be explained in the interface, and behave deterministically."* | **Starvation Exhaustion:** Food never drops below 0. A shortage marks the colony with `foodShortage: true`, halving all worker outputs on the subsequent day. | Food consumption: 1/worker/day.<br>Shortage penalty: $\lfloor \text{output} / 2 \rfloor$. | `src/domain/simulation.ts`<br>`src/pages/ColonyPage.tsx` |
| **D2: Weapon Recipe** | *"The forge should also offer a weapon recipe. Your team may choose and display its material cost. Weapons are stored as a colony resource..."* | **Dwarven Armory Recipe:** Weapons cost more stone than tools to emphasize military construction. Weapons are stored collectively in `resources.weapons` for raid defense. | Cost: **2 Wood + 4 Stone $\rightarrow$ 1 Weapon**.<br>(Compare Tool: 3 Wood + 2 Stone). | `src/domain/crafting.ts`<br>`src/pages/ForgePage.tsx` |
| **D4: Expedition Tool Policy** | *"Your team must define whether an equipped tool remains with the travelling dwarf or is returned before departure."* | **Tool Stays Equipped:** The travelling dwarf keeps their equipped tool. While away, their status is `'expedition'` so it yields no colony production. It returns intact upon expedition completion. | Worker retains `equippedTool: true`.<br>Equip/unequip locked during transit. | `src/domain/equipment.ts`<br>`src/domain/simulation.ts` |
| **D5: Interrupted Tasks Policy** | *"The game must also define a reasonable, visible policy for an expedition or forge task interrupted by refresh."* | **Dual Recovery Policy:**<br>1. *Expeditions:* Cancelled without rewards; worker returns safely.<br>2. *Forge Tasks:* Saved in-flight; progress and worker status resume without re-charging materials. | Save key: `dwarfhold.save.v1`<br>Task progress & artisan status preserved in `activeCrafting`. | `src/state/persistence.ts` |
| **D6: New Species Recruit** | *"Your team may choose the species, identity, and narrative... must have its own production capability and crafting capability or limitation."* | **Kivi Stonespark (Kobold Scavenger):** Recruited once from Crystal Cave.<br>• *Production Perk:* Deep mining (+2 extra stone).<br>• *Crafting Perk:* Salvage discount on tools (costs 1 less wood).<br>• *Crafting Limitation:* Cannot forge heavy war weapons. | Base mining: **4 stone/day**.<br>Tool cost: **2 Wood + 2 Stone**.<br>Weapon crafting: **Strictly blocked**. | `src/domain/species.ts`<br>`src/domain/crafting.ts`<br>`src/domain/simulation.ts` |
| **D7: Defense Threshold & Looting** | *"If Stonehome has reached a weapon threshold chosen by your team, the colony defends itself. Otherwise, the attackers loot a deterministic selection... decide whether defense consumes or preserves weapons..."* | **Goblin Outpost Raid Event:**<br>• Hostile destination: `goblin-outpost`<br>• Defense threshold: **2 weapons**.<br>• Weapon consumption: Defense consumes **1 weapon** to battle wear.<br>• Breach looting: Raiders steal 50% of food, up to 4 wood, up to 3 stone. | Threshold: **$\ge 2$ weapons**.<br>Wear: **$-1$ weapon on win**.<br>Looting: $\le 50\%$ food (min 1), $\le 4$ wood, $\le 3$ stone. | `src/domain/defense.ts`<br>`server/index.js` |

---

### In-Depth Breakdown of Requirement Decisions

### 1. Requirement D1 — Food Shortage Consequence
* **The Choice:** When evening food is insufficient (`resources.food < dwarves.length`), stored food is clamped to `0` (preventing invalid negative inventories), and `foodShortage: true` is flagged on the colony state.
* **The Gameplay Consequence:** Workers suffer **Starvation Exhaustion**. On the following simulation day, all active job outputs are halved:
  $$\text{Produced Amount} = \left\lfloor \frac{\text{Base Output} + \text{Tool Bonus}}{2} \right\rfloor$$
* **Why this was chosen:** Halving production punishes poor planning without causing an irreversible death spiral. Because consumption happens at the end of the day, workers finish their shift, eat dinner, and wake up fatigued the next morning.
* **Interface Feedback:** A persistent amber alert banner (`"Food shortage: workers are exhausted and produce half as much today."`) appears in the Colony dashboard, and the Shift Ledger dynamically recalculates and displays the halved expectations.

### 2. Requirement D2 — Weapon Recipe & Armory Storage
* **The Choice:** We chose a recipe of **2 wood and 4 stone** for weapons.
* **Why this was chosen:** Tools require more wood for handles and frames (3 wood, 2 stone), whereas heavy military weaponry requires heavy quarried stone/iron (2 wood, 4 stone). 
* **Collective Storage Rule:** Unlike tools which are equipped 1:1 on workers, weapons are stored collectively in `state.resources.weapons`. Weapons represent the colony's collective perimeter defenses and armory readiness for repelling hostile raids.

### 3. Requirement D4 — Expedition Equipment Policy
* **The Choice:** An equipped tool **remains with the travelling dwarf** on an expedition.
* **Why this was chosen:** Forcing the player to manually unequip a scout before dispatching and re-equip upon return creates tedious inventory micro-management.
* **Invariant Protection:** While travelling, the dwarf's status is strictly `'expedition'`. Because `advanceDay()` requires `dwarf.status === "working"` to generate resources, an equipped tool away in the mountains produces **0** colony bonus. Furthermore, `equipToolState()` and `unequipToolState()` reject any equipment modifications while a worker is on an expedition or crafting, preventing state desynchronization.

### 4. Requirement D5 — Refresh & Interruption Recovery Policies
* **Expedition Interruption Policy:** Cancelled safely. If the player closes or reloads the browser while an asynchronous expedition is in flight, the scout is restored to `'working'` (if assigned) or `'idle'`. No rewards are granted.
  * *Rationale:* The client cannot verify whether an in-flight HTTP request resolved or timed out while the tab was closed. Cancelling avoids ghost expeditions or unresolvable reward promises.
* **Forge Task Interruption Policy:** Preserved and resumed. If the browser refreshes mid-craft, the active task (`activeCrafting`), elapsed progress ticks, and artisan status (`'crafting'`) are restored exactly as saved.
  * *Rationale:* Crafting materials were already deducted upfront when starting the project. Discarding the craft would unjustly penalize the player by destroying their wood and stone.
* **Storage Invariants & Versioning:** Stored under key `dwarfhold.save.v1` in `localStorage`. If JSON parsing fails or schema validation rejects the data (`isSnapshot`), the game falls back to the default colony state with an explanatory warning banner, preventing application crashes.

### 5. Requirement D6 — Non-Dwarf Species: Kivi Stonespark (Kobold Scavenger)
* **Identity & Narrative:** Kivi Stonespark is a Kobold scavenger rescued during the company's first successful trip to the Crystal Cave (`crystal-cave`).
* **Single-Recruitment Invariant:** `checkExpeditionRecruit()` verifies `!state.dwarves.some(w => w.id === "kobold-kivi")`. Kivi joins Stonehome exactly once.
* **Mechanical Differences:**
  1. *Production Trait:* Kivi excels in narrow cave seams, producing **4 stone/day** in Deep Mining (+2 over the standard dwarf yield of 2).
  2. *Crafting Perk:* Kobold salvage expertise reduces the wood cost of forging tools from **3 wood to 2 wood** (`-1 timber`).
  3. *Crafting Limitation:* Kobolds lack the upper-body mass to hammer heavy dwarven war weapons. Kivi is strictly blocked from forging weapons (`canCraftWeapon` returns `false`), with descriptive UI disabled states.
* **Full Integration:** Kivi consumes 1 food per day, can equip tools, can be sent on expeditions, and is persisted in save data.

### 6. Requirement D7 — Expedition Defense & Raid Consequences
* **Hostile Destination:** Exploring the **Goblin Outpost** (`goblin-outpost`) grants high plunder (6 food, 10 stone, 1 tool) but flags `triggersRaid: true`. Hostile warbands track the scout back to Stonehome.
* **Weapon Threshold:** Stonehome requires at least **2 weapons** (`DEFENSE_WEAPON_THRESHOLD = 2`) in the armory to repel the assault.
* **Weapon Consumption Decision:** 
  * If defended ($\ge 2$ weapons), the colony **consumes 1 weapon** due to battle wear and splintering (`weaponsConsumed: 1`).
  * *Rationale:* Making weapons single-use would feel excessively punishing, but having them never break removes any incentive to continue forging weapons. Consuming 1 weapon balances reward with attrition.
* **Breach & Looting Formula:** If weapons are insufficient ($< 2$), raiders breach the hold and deterministically steal:
  - Up to $50\%$ of stored food (minimum 1 if food $> 0$).
  - Up to 4 wood and up to 3 stone.
* **Feedback:** A prominent defense readiness indicator appears on the expedition map, and raid outcomes trigger a high-visibility modal/alert banner (`raid-alert-banner`) and Chronicle entry detailing exact losses.

---

## Part 2: Qualitative Goals (Non-Functional Requirements)

Beyond functional features, our team defined three overarching architectural quality goals:

### 1. Predictable Rules & Separate Domain Logic
* **Goal:** The production, food, equipment, and raid rules should produce predictable results from the same game situation. Crafting task IDs are generated when a task begins.
* **Why this matters:** Players rely on exact numbers to plan assignments, manage rations, and prepare for raids. Non-deterministic or unpredictable state changes undermine trust and make debugging state mutations difficult.
* **Implementation Decision:** Core calculations and state transitions live in `src/domain/` (`simulation.ts`, `crafting.ts`, `equipment.ts`, `defense.ts`, `species.ts`). Most receive the current state and return a new state; `startCraftingTask` also creates a task ID from the current time.
* **Trade-off:** Separate rules require explicit wiring inside `ColonyProvider.tsx`, but are easier to inspect and reason about without the React interface.
* **Evaluation:** Compare the displayed resources with the expected values after a day of work, with and without a tool and after a food shortage. Check the fixed weapon threshold and looting amounts for a Goblin Outpost raid.

### 2. Fault Tolerance & Async Resilience
* **Goal:** Network delays, API errors, rapid user clicks, and browser reloads must never corrupt the colony state or orphan workers.
* **Why this matters:** Expeditions interact with an external asynchronous API, while crafting spans multiple simulation ticks. Without strict invariants, race conditions or failed requests could leave workers permanently stuck in unavailable statuses or duplicate resources.
* **Implementation Decision:**
  - Workers use a mutually exclusive state machine (`'idle' | 'working' | 'crafting' | 'expedition'`).
  - Buttons and inputs are disabled while actions are in flight (`expeditionPending`, `isForgeBusy`).
  - Strict runtime schema validation (`persistence.ts`) guards against corrupted `localStorage` snapshots.
* **Trade-off:** We intentionally cancel in-flight expeditions upon page refresh instead of attempting complex request re-attachment or polling. This ensures the player always returns to a clean, known-good colony state.
* **Evaluation:** Exercise the `blocked-pass` failure and a slow expedition in the browser; check that the scout returns without a reward on failure and cannot be dispatched twice while a request is pending. Refresh during an expedition and a forge task to inspect the recovery rules.

### 3. UX Transparency & Affordance
* **Goal:** Every penalty, restriction, and state change must have a clear cause-and-effect explanation visible in the interface.
* **Why this matters:** A mathematically correct game engine is frustrating if the player cannot understand why their production dropped, why a button is disabled, or where their resources went.
* **Implementation Decision:**
  - Starvation triggers an explicit alert banner and changes Shift Ledger formulas.
  - Raid readiness is displayed directly on the expedition panel, and breaches show exact stolen items.
  - Artisan dropdowns display current assignments and disable busy workers with explanatory tooltips.
  - The Hold Chronicle maintains a running historical log of all game events.
* **Trade-off:** Maintaining informative banners and tooltips requires extra JSX and styling code, but it makes the simulation self-documenting and accessible to the player.
* **Evaluation:** Play through hunger, a raid, tool equipping, and craft completion; check that the visible status or message explains each resource and worker change.
