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

---

## Requirement D4 — Resilient Expeditions (Branch: `feat/d4-expeditions`)

### 1. Permanent Worker Lock Bug Fix (`src/state/ColonyProvider.tsx`)
* **Problem:**
  * When an expedition failed (e.g. `blocked-pass` returning HTTP 503 or network errors), `sendExpedition()` caught the error and logged a chronicle notice, but never updated `colony.dwarves`.
  * As a result, the dwarf remained permanently stuck in `status: "expedition"`, locked out of assignments and future expeditions.
* **Fix:**
  * Added worker status recovery inside the `catch` block of `sendExpedition()`.
  * On failure, the travelling dwarf's status is automatically restored to `"working"` (if assigned to a job) or `"idle"` (if unassigned).

### 2. Concurrency & Double-Dispatch Prevention (`src/state/ColonyProvider.tsx`, `src/pages/ColonyPage.tsx`)
* **Problem:**
  * Rapid double-clicking the dispatch button or firing concurrent dispatch calls could trigger multiple in-flight expedition requests for the same dwarf before React re-renders.
  * `assignDwarf` permitted reassigning and overriding the status of away or crafting workers.
  * In the UI, the expedition button remained clickable for scouts who were already away or ineligible, causing confusing state mutations.
* **Fix:**
  * **Synchronous Runtime In-Flight Guard:** Added `inFlightDwarves = useRef<Set<string>>(new Set())` in `ColonyProvider.tsx` to synchronously reject repeated dispatches for the same dwarf before event loop microtasks finish.
  * **Eligibility Invariant Enforcement:** `sendExpedition()` and `assignDwarf()` now verify the worker exists and is not currently on an expedition or crafting (`status !== "expedition" && status !== "crafting"`).
  * **Guaranteed Cleanup via `finally`:** Wrapped status reset and in-flight tracking release inside a `finally` block so locks are guaranteed to release whether the request succeeds or throws.
  * **Reactive UI Feedback:** In `ColonyPage.tsx`, dropdown options now clearly display `(Away)` or `(Crafting)` badges, dropdowns are disabled while dispatch is in flight, and the button is disabled with explanatory text (`"Scout is away…"`, `"Scout is crafting…"`, or `"Beyond the gate…"`) when unavailable.

### 3. Reassignment Guard & Single-Activity Invariant (`src/components/DwarfRoster.tsx`, `src/simulation.ts`, `src/pages/ColonyPage.tsx`)
* **Problem:**
  * If a dwarf with an active assignment (e.g. Bromli on mining) was sent on an expedition, the simulation tick (`advanceDay`) still generated stone/wood every 8 seconds because it only checked `if (!dwarf.assignment)`.
  * The Shift Ledger still counted travelling dwarves as active producers.
  * In the Roster UI, assignment dropdowns were only disabled for `expedition`, but not for future `crafting` workers.
* **Fix:**
  * **Strict Production Invariant:** Updated `advanceDay()` in `src/simulation.ts` to require `dwarf.status === "working" && dwarf.assignment` before contributing to daily resource production.
  * **Accurate Ledger Output:** Updated `dailyOutput` and job counter tallies in `ColonyPage.tsx` to only tally dwarves actively in `"working"` status.
  * **UI Reassignment Lock:** Updated `DwarfRoster.tsx` to disable job selection whenever a dwarf is busy (`status === "expedition" || status === "crafting"`).
  * **Automated Verification:** Added a unit test in `src/simulation.test.ts` asserting that dwarves on expeditions do not produce resources.

### 4. Network Timeout & Resilience (`src/api.ts`, `src/api.test.ts`)
* **Problem:**
  * `fetch("/api/expeditions", ...)` had no client-side timeout. If the backend crashed, dropped packets, or hung indefinitely, the traveling dwarf remained locked in `"expedition"` status and the dispatch button was disabled forever.
  * If an HTTP error response returned non-JSON content (such as an HTML error page from a reverse proxy or gateway timeout), calling `response.json()` threw an unhandled syntax parse error that rendered raw JSON syntax errors in the Chronicle.
  * Network disconnects (`TypeError: Failed to fetch`) showed raw JavaScript exception text instead of narrative game feedback.
* **Fix:**
  * **Client-Side Timeout with AbortController:** Added an `AbortController` timeout (defaulting to 7000ms, safely above the backend's maximum 5000ms latency). If exceeded, it aborts the request and throws: *"Expedition timed out. The scout lost the trail and returned safely."*
  * **Safe Error Body Parsing:** Safely parses error responses with a fallback to `Expedition failed (${response.status})` if the server returns non-JSON content.
  * **Friendly Network Error Formatting:** Catches low-level fetch failures (e.g. server offline) and formats them into clean chronicle-friendly messages: *"Cannot reach the expedition outpost. Check network connection."*
  * **Automated Test Coverage:** Added unit test suite `src/api.test.ts` covering successful dispatch, custom backend errors, non-JSON gateway fallbacks, timeout aborts, and fetch network errors.

### 5. Expedition Selection UI & Affordance (`src/pages/ColonyPage.tsx`, `src/styles.css`)
* **Problem:**
  * Players had minimal visibility into dwarf assignment and equipment before sending them beyond the gate, risking accidental dispatch of vital workers (e.g. sole farmers).
  * Destinations provided no contextual preview of expected rewards or risks.
  * The agreed equipment policy (*"Equipped tools stay with the travelling dwarf and return safely"*) was not communicated in the interface as required by D4.
* **Fix:**
  * **Enriched Scout Details:** The scout selector now displays each dwarf's current state and assignment (e.g. `[Away]`, `[Crafting]`, `(Mining)`, `(Idle)`) along with a `⚒️` badge if carrying an equipped tool.
  * **Tool Policy Communication:** When a scout carrying an equipped tool is selected, an explicit note renders: *"⚒️ Carrying equipped tool (returns safely after expedition)."*
  * **Destination Intel & Risk Preview:** Added destination descriptions previewing expected rewards and danger level (e.g. warning color for Blocked Pass).
  * **Clear Hold Rule Notice:** Updated panel footer to explicitly state the hold rules: *"The travelling scout is away from the hold and produces no daily resources. Equipped tools remain with the scout and return intact."*

---

## Requirement D7 — Expedition Consequences and Defense (Branch: `feat/d7-expedition-defense`)

### 1. Hostile Destination & Raid Data Contracts (`server/index.js`, `src/types.ts`)
* **What was changed:**
  * Added high-risk `"goblin-outpost"` destination to `outcomes` in `server/index.js` with tempting high-tier plunder (`{ food: 6, tools: 1, stone: 10 }`), narrative return message, and `triggersRaid: true` flag.
  * Preserved backend failure safeguards (`?fail=true` and `blocked-pass`) so failed expeditions abort early with HTTP 503 before returning rewards or setting `triggersRaid`.
  * Added `triggersRaid?: boolean` to `ExpeditionResult` in `src/types.ts`.
  * Added `RaidResolution` interface in `src/types.ts` defining the outcome contract (`defended: boolean`, `weaponsConsumed: number`, `looted: Partial<Resources>`, `message: string`, `tone: "good" | "warning"`).
* **Why:**
  * Fulfills Requirement D7's core premise: an expedition destination that changes the situation in Stonehome by provoking a hostile counterattack rather than solely awarding loot.
  * Establishes a clean, typed contract separating server expedition results from colony defense calculations.

### 2. Pure Deterministic Defense Engine & Automated Tests (`src/defense.ts`, `src/defense.test.ts`)
* **What was changed:**
  * Created `src/defense.ts` containing `resolveRaid(resources, weaponThreshold)` and `applyRaidToResources(resources, resolution)` as pure simulation functions with `DEFENSE_WEAPON_THRESHOLD = 2`.
  * **Defended Path (`weapons >= 2`):** Colony repels the attackers, with a defined weapon wear rule consuming 1 weapon (`weaponsConsumed: 1`) to reflect equipment damage during combat. No resources are lost. Returns a victorious Chronicle log with `tone: "good"`.
  * **Under-Defended Path (`weapons < 2`):** Raid breaches the gates. Raiders deterministically plunder 50% of stored food (minimum 1 if available), up to 4 wood, and up to 3 stone, clamping safely so resources never become negative. 0 weapons are consumed. Returns a warning Chronicle entry with `tone: "warning"` itemizing looted goods.
  * Created unit test suite `src/defense.test.ts` with 6 exhaustive test cases covering threshold boundaries (2 weapons, >2 weapons, 1 weapon, 0 weapons), resource clamping, empty hold edge cases, and deterministic resource mutations.
* **Why:**
  * Adheres strictly to the architectural goal of **State Determinism** documented in `docs/DECISIONS.md`: isolating combat math from React hooks and network side-effects makes defense calculation 100% reproducible and testable.

### 3. Expedition Resolution & Raid Trigger Integration (`src/state/ColonyProvider.tsx`, `src/state/ColonyContext.ts`)
* **What was changed:**
  * Connected `resolveRaid` and `applyRaidToResources` into the `sendExpedition` lifecycle in `src/state/ColonyProvider.tsx`.
  * **Raid Triggering:** When an expedition resolves successfully with `triggersRaid: true`:
    1. Awards expedition spoils to colony inventory.
    2. Runs `resolveRaid(withRewards)` and applies weapon wear (if defended) or resource looting (if breached).
    3. Prepends both the battle chronicle entry and the expedition return chronicle entry to `activities`.
    4. Sets `lastRaid: RaidResolution` in context state with an exposed `dismissRaidAlert()` callback for interactive UI feedback.
  * **Failure Invariant:** If an expedition fails (e.g. `?fail=true`, `blocked-pass`, network timeout, or server error), the error is caught, the scout returns safely, and **no raid is triggered**.
* **Why:**
  * Satisfies D7's core requirement: only successful expeditions to hostile locations trigger a raid, while failed expeditions never cause counterattacks.
  * Integrates the combat resolution into the core state machine without introducing race conditions.

### 4. UI Intel & Defensive Readiness Affordances (`src/pages/ColonyPage.tsx`, `src/styles.css`)
* **What was changed:**
  * Added `"goblin-outpost"` to `destinationDetails` in `ColonyPage.tsx` with high danger warning and `requiresDefense: true`.
  * **Dynamic Defense Readiness Card:** When Goblin Outpost is selected, displays a live defensive assessment showing whether current colony weapons satisfy the garrison threshold:
    - Prepared (`weapons >= 2`): Green status card confirming Stonehome will repel the attackers (`🛡️ Garrison Prepared`).
    - Compromised (`weapons < 2`): Red status card alerting that the hold lacks sufficient weapons and will be plundered (`⚠️ Defenses Vulnerable!`).
  * **Prominent Raid Alert Banner:** Added a dismissible banner at the top of the Shift Ledger in `ColonyPage.tsx` displaying the immediate aftermath of any raid event (repelled vs. breached) along with plundered losses or consumed weapons.
  * Added corresponding styles in `src/styles.css` matching the dwarfhold fantasy aesthetic.
* **Why:**
  * Fulfills Requirement D7's UX mandate: the raid result and its effect on game state must be clearly visible and communicated to the player with strong affordances before and after dispatch.

---

## Requirement D2 — Useful Tools, Weapons, and Equipment (Branch: `feat/d2-tools-and-weapons`)

### Feat 1: Equipped Tool Daily Production Benefit (`src/simulation.ts`, `src/pages/ColonyPage.tsx`)
* **What was changed:**
  * Updated `advanceDay()` in `src/simulation.ts` so that active workers (`status === "working"` with an active `assignment`) carrying an equipped tool (`dwarf.equippedTool === true`) receive a +1 bonus to their produced resource per day (Woodcutting: 3 $\to$ 4, Mining: 2 $\to$ 3, Farming: 4 $\to$ 5).
  * Maintained expedition and work invariants: Dwarves with `status !== "working"` (e.g. `expedition`, `crafting`, or `idle`) or with `assignment === null` produce 0 resources, even if carrying an equipped tool.
  * Maintained food shortage halving: when `foodShortage` is active, the tool-augmented production is halved via `Math.floor(producedAmount / 2)` (e.g., Woodcutting with tool produces $\lfloor 4 / 2 \rfloor = 2$).
  * Updated the `dailyOutput` aggregation in `src/pages/ColonyPage.tsx` so the Shift Ledger accurately projects daily yields including worker equipped tool bonuses.
  * Added 3 comprehensive unit tests in `src/simulation.test.ts` verifying tool bonus across jobs, zero-yield preservation when not working/away on expeditions, and food shortage halving behavior.
* **Why:**
  * Satisfies Requirement D2 specification: "an equipped tool grants +1 additional unit of the dwarf's assigned resource per day" while adhering strictly to the D4/D2 Expedition Tool Policy (equipped tools remain with the scout on expeditions but produce no colony yield while away).

### Feat 2: Tool Inventory & Equipping Invariants (`src/equipment.ts`, `src/equipment.test.ts`, `src/state/ColonyProvider.tsx`, `src/state/ColonyContext.ts`)
* **What was changed:**
  * Created `src/equipment.ts` with pure state transformation functions `equipToolState` and `unequipToolState`:
    - **Equip Invariants:** Enforces that a dwarf cannot equip a tool if none are in stock (`resources.tools < 1`), if already equipped (`dwarf.equippedTool === true`), or if away on an expedition (`status === "expedition"`) or crafting (`status === "crafting"`). Decrements `resources.tools` by 1 and sets `dwarf.equippedTool = true`.
    - **Unequip Invariants:** Enforces that a dwarf cannot unequip unless carrying a tool (`dwarf.equippedTool === true`), and cannot unequip while away on an expedition or crafting. Increments `resources.tools` by 1 and sets `dwarf.equippedTool = false`.
    - **Conservation of Tools:** Enforces strict invariant: `resources.tools + count(equippedTools) === total colony tools`.
  * Connected `equipTool` and `unequipTool` into `ColonyProvider.tsx` and exposed them via `ColonyContextValue` with chronicle activity updates.
  * Created unit test suite `src/equipment.test.ts` (7 tests) covering inventory decrement/increment, tool conservation, empty inventory guards, duplicate equip prevention, and status restrictions (`expedition`, `crafting`).
* **Why:**
  * Satisfies Requirement D2 specification: "Dwarves can equip an available tool from resources.tools. Invariants: 1 dwarf carries at most 1 tool; 1 tool cannot be equipped by multiple dwarves; total equipped tools + unequipped inventory tools = total colony tools. Equipping and unequipped actions must keep inventory strictly consistent."

### Feat 3: Colony Weapons Recipe (`src/crafting.ts`, `src/crafting.test.ts`, `src/state/ColonyProvider.tsx`, `src/state/ColonyContext.ts`)
* **What was changed:**
  * Created `src/crafting.ts` with typed recipe constants (`WEAPON_COST = { wood: 2, stone: 4 }`, `TOOL_COST = { wood: 3, stone: 2 }`), eligibility checkers (`canCraftWeapon`, `canCraftTool`), and pure transformation `craftWeaponState(state)`.
  * Enforced weapon forging invariants:
    - Verifies that colony possesses sufficient materials (`wood >= 2 && stone >= 4`).
    - If wood and/or stone are lacking, aborts cleanly and returns descriptive chronicle warning notices without mutating colony resources.
    - On success: deducts 2 wood and 4 stone, increments `resources.weapons` by 1, and returns a celebratory chronicle notice.
  * Added `craftWeapon()` to `ColonyContextValue` and `ColonyProvider.tsx` with activity chronicle logging.
  * Added unit test suite `src/crafting.test.ts` (5 tests) covering successful weapon forging, partial resource deficiencies (low wood, low stone, low both), and eligibility checker validations.
* **Why:**
  * Satisfies Requirement D2 specification: "Add a weapon recipe to the Forge (e.g., 2 wood + 4 stone -> 1 weapon). Weapons are stored in resources.weapons for colony defense (consumed/checked in D7)."

### Feat 4: UI Affordances (`src/components/DwarfRoster.tsx`, `src/pages/ForgePage.tsx`, `src/pages/ColonyPage.tsx`, `src/styles.css`)
* **What was changed:**
  * **Roster Equipment Affordances (`DwarfRoster.tsx`, `ColonyPage.tsx`, `styles.css`):**
    - Passed `onEquipTool`, `onUnequipTool`, and `availableTools` (`colony.resources.tools`) from `ColonyContext` into `DwarfRoster`.
    - Added an equipped tool badge (`⚒️`) next to the dwarf's name with an explanatory tooltip (`"Equipped tool (+1 resource/day)"`).
    - Added interactive equip/unequip action controls alongside the assignment dropdown:
      - **Equip Action:** When unequipped, renders `+ Equip ⚒️`. Disabled if dwarf is away on expedition or crafting, or if `availableTools < 1`, with tooltips explaining the disable condition.
      - **Unequip Action:** When equipped, renders `Unequip`. Disabled if dwarf is away on expedition or crafting.
  * **Forge Weapon Recipe Card (`ForgePage.tsx`):**
    - Wrapped the forge recipe cards in a vertical `.center-stack` container alongside the right-hand Chronicle panel.
    - Added the weapon crafting card (`2 🪵 + 4 🪨 → 1 ⚔️`) with `"Forge weapon"` trigger button invoking `craftWeapon()`.
* **Why:**
  * Satisfies Requirement D2 specification: "Show equipped tool status, owner, and equip/unequip toggles in the Roster. Add the weapon crafting card to ForgePage.tsx."











