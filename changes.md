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




