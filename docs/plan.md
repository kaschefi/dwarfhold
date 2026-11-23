# Dwarfhold Two-Developer Implementation Plan

This plan organizes the implementation of requirements **D1 through D7** for a team of two developers using **Option 1: Domain-Driven Split**. 

This division separates **Internal Colony & Economy** (Person 1) from **External World, Expeditions & Persistence** (Person 2), minimizing Git merge conflicts and creating clear architectural boundaries.

---

## 1. Overview & Workload Distribution

| Developer | Assigned Requirements | Grade Weight | Primary Focus / Subsystems |
| :--- | :--- | :---: | :--- |
| **Person 1** | **D1** (Colony Work & Survival)<br>**D2** (Tools, Weapons & Equipment)<br>**D3** (Crafting as Colony Work)<br>**D5** (Shared: Crafting recovery policy) | **45% - 50%** | Pure simulation logic, colony jobs, tool equipment, weapon recipes, forge progress over time. |
| **Person 2** | **D4** (Resilient Expeditions)<br>**D7** (Expedition Defense & Consequences)<br>**D6** (New Species Recruitment)<br>**D5** (Shared: LocalStorage engine & recovery) | **45% - 50%** | Express backend API, async resilience, raid events, combat resolution, non-dwarf recruit, persistence. |
| **Joint** | **Qualitative Requirements & Exam Prep** | — | Document non-functional goals, trade-offs, and verification strategy for oral exam defense. |

---

## 2. Step 0: Shared Architectural Contracts (Day 0 Alignment)

Before writing feature code, both developers must agree on and commit the shared types in `src/types.ts`:

### 2.1 Worker Status Enum
Ensure workers can only be in one activity at a time:
```ts
export type WorkerStatus = 'idle' | 'working' | 'crafting' | 'expedition';
```

### 2.2 Colony Resources
Add `weapons` to the resource pool:
```ts
export interface Resources {
  wood: number;
  stone: number;
  food: number;
  tools: number;
  weapons: number; // For D2 recipes and D7 raid defense
}
```

### 2.3 Worker Equipment & Species
Support tool equipping and species distinction:
```ts
export type Species = 'dwarf' | 'goblin' | 'elf' | 'kobold'; // For D6

export interface Worker {
  id: string;
  name: string;
  species: Species;
  assignment: JobId | 'unassigned';
  status: WorkerStatus;
  equippedTool: boolean; // For D2
}
```

### 2.4 Agreed Policy for D4 / D2 Interaction
* **Policy Decision:** *An equipped tool stays with the travelling dwarf on an expedition.* While away, it yields no colony production bonus. If the dwarf returns safely, the tool remains equipped. (This ensures consistency between Person 1's equip logic and Person 2's expedition state).

---

## 3. Person 1: Internal Colony & Economy Track

### Phase 1: Requirement D1 — Colony Work and Survival (15%)
* **Branch:** `feat/p1-d1-colony-survival`
* **Files Touched:** `src/types.ts`, `src/simulation.ts`, `src/state/ColonyProvider.tsx`, `src/components/ShiftLedger.tsx`
* **Tasks:**
  1. **Worker Invariant:** Ensure a dwarf can only have one active state (`working`, `crafting`, `expedition`, or `idle`).
  2. **Food Shortage Consequence (Deterministic):**
     * Define clear consequence when `food < totalWorkers`:
       * *Recommended Rule:* If food is insufficient at the daily tick, consumption consumes all remaining food, and workers suffer **Starvation Exhaustion** (halving production for the next day, or setting production to 0 until fed).
     * Add visual warning badge / alert banner in `ShiftLedger` and record the shortage in the Hold Chronicle.
  3. **Unit Tests:** Add unit tests in `src/simulation.test.ts` verifying food consumption math and starvation penalties.

### Phase 2: Requirement D2 — Useful Tools, Weapons, and Equipment (20%)
* **Branch:** `feat/p1-d2-equipment-weapons`
* **Files Touched:** `src/simulation.ts`, `src/state/ColonyProvider.tsx`, `src/components/Roster.tsx`, `src/pages/ForgePage.tsx`
* **Tasks:**
  1. **Tool Equipping System:**
     * Action to equip/unequip an available tool from `resources.tools` to a worker.
     * Enforce invariants: 1 tool max per dwarf; total equipped tools + unequipped tools = total colony tools.
  2. **Production Benefit:**
     * In `src/simulation.ts`, add **+1 unit** of assigned resource per day if `worker.equippedTool === true` and assigned to Woodcutting, Mining, or Farming.
  3. **Colony Weapons Recipe:**
     * Add weapon recipe to the Forge: e.g. `2 wood + 4 stone -> 1 weapon`.
     * Store weapons in `resources.weapons` for colony defense (consumed/checked in D7).
  4. **UI Updates:**
     * Display equipped tool badge and equip/unequip toggle in `Roster.tsx`.
     * Add weapon crafting card on `ForgePage.tsx`.

### Phase 3: Requirement D3 — Crafting as Colony Work (10%)
* **Branch:** `feat/p1-d3-crafting-time`
* **Files Touched:** `src/types.ts`, `src/state/ColonyProvider.tsx`, `src/pages/ForgePage.tsx`
* **Tasks:**
  1. **Crafting Task State:**
     * Define `CraftingTask { id, recipeId, workerId, progress, durationTicks }`.
  2. **Worker Requirement:**
     * Forging requires selecting an available worker (`status === 'idle'`).
     * While crafting, worker status is set to `'crafting'` (cannot cut wood, mine, or go on expeditions).
  3. **Crafting Over Time:**
     * Crafting advances with simulation ticks (e.g. 2 simulation days / 16s).
     * Deduct materials upon starting; award crafted item upon completion.
     * If materials are insufficient or worker is unavailable, reject without modifying state.
  4. **UI Progress:**
     * Show a progress bar and assigned artisan name on `ForgePage.tsx`.

---

## 4. Person 2: World, Expeditions & Events Track

### Phase 1: Requirement D4 — Resilient Expeditions (10%)
* **Branch:** `feat/p2-d4-resilient-expeditions`
* **Files Touched:** `server/index.js`, `src/api.ts`, `src/state/ColonyProvider.tsx`, `src/components/ExpeditionPanel.tsx`
* **Tasks:**
  1. **Strict Worker Locking:**
     * Set `worker.status = 'expedition'` when request starts. Prevent re-dispatching or reassigning while away.
  2. **Idempotent Single-Reward Application:**
     * Use unique transaction IDs or lock states to ensure rewards are never credited twice on slow responses or double-clicks.
  3. **Robust Error Handling:**
     * Gracefully handle network timeouts or `fail=true` responses: worker returns safely (`status = 'idle'`), no rewards awarded, failed expedition logged in Chronicle.
  4. **UI State & Disabled States:**
     * Disable dropdowns and expedition button while an expedition is in flight. Show countdown or traveling indicator.

### Phase 2: Requirement D7 — Expedition Consequences and Defense (15%)
* **Branch:** `feat/p2-d7-expedition-defense`
* **Files Touched:** `server/index.js`, `src/api.ts`, `src/state/ColonyProvider.tsx`, `src/components/ExpeditionPanel.tsx`
* **Tasks:**
  1. **Hostile Destination:**
     * Add a high-risk destination in `server/index.js` (e.g. `goblin-outpost` or `dragon-chasm`).
  2. **Raid Trigger on Return:**
     * Upon a successful return, hostile forces follow the traveller home and trigger a colony raid.
  3. **Weapon Defense Calculation:**
     * Define defense threshold: e.g. **Stonehome requires at least 2 weapons** to repel the attack.
     * **Success (Repelled):** Weapons hold the line; chronicle logs glorious victory; optionally 1 weapon is damaged/consumed (team rule).
     * **Failure (Raid Breach):** If `weapons < threshold`, enemies loot deterministic resources (e.g. 50% of stored food and 5 stone).
  4. **Communication:**
     * Clear banner / modal alert and Chronicle entry informing the player of the raid result and losses.

### Phase 3: Requirement D6 — A New Species Joins Stonehome (20%)
* **Branch:** `feat/p2-d6-new-species`
* **Files Touched:** `src/types.ts`, `server/index.js`, `src/state/ColonyProvider.tsx`, `src/components/Roster.tsx`
* **Tasks:**
  1. **Recruitment Event:**
     * Choose destination (e.g. `ancient-ruins` or `crystal-cave`). The first successful trip rescues a non-dwarf resident (e.g. **Kobold Scavenger** or **Elven Herbalist**).
     * Ensure this recruitment triggers **exactly once**.
  2. **Visual & UI Differentiation:**
     * Distinct tag, species icon/color, and custom lore badge in `Roster.tsx`.
  3. **Unique Species Traits & Trade-offs:**
     * *Production trait:* e.g. Kobold gathers +2 extra stone when mining, or Elven Herbalist doubles mushroom farming yield.
     * *Crafting trait/limitation:* e.g. Cannot forge heavy iron weapons, but can craft unique gear or gathers double food.
  4. **System Integration:**
     * Participates in daily meals (D1), can be equipped with tools (D2), can be saved/restored (D5).

---

## 5. Joint Milestone: Requirement D5 — Save, Restore & Recovery (10%)

Once D1–D4, D6, and D7 are merged into `main`:

* **Branch:** `feat/joint-d5-save-restore`
* **Files Touched:** `src/storage.ts` (new), `src/state/ColonyProvider.tsx`
* **Division of Work:**
  * **Person 2 (Storage Architecture):**
    * Implement `saveStateToStorage` and `loadStateFromStorage` using `localStorage`.
    * Add schema versioning and validation (safe fallback to initial default state if corrupted or invalid JSON).
  * **Person 1 (Interruption & Recovery Policies):**
    * *Interrupted Crafting:* If a user refreshes mid-craft, restore the craft progress or refund materials with a chronicle notice.
    * *Interrupted Expedition:* If user refreshes while dwarf is away, safely return the dwarf to Stonehome with pending reward resolution or clear cancellation.

---

## 6. Qualitative Requirements & Non-Functional Goals (Exam Defense)

The team will document these non-functional goals in `docs/DECISIONS.md`:

1. **State Determinism (Simulation):** Pure simulation transitions in `simulation.ts` without side effects, making all production, starvation, and raid outcomes fully reproducible and unit-testable.
2. **Fault Tolerance & Async Resilience (Expeditions):** The UI and colony state cannot be desynchronized or corrupted by network delays, unexpected disconnects, or browser refreshes.
3. **UX Transparency & Affordance:** Every penalty (starvation, failed expedition, raid loss) has a clear cause-and-effect trail in the Chronicle and status banners.

---

## 7. Step-by-Step Git Roadmap

```
Week 1: Foundations
├─ Day 1: Joint Step 0 (Merge types.ts into main)
├─ Day 2-3:
│  ├─ Person 1: feat/p1-d1-colony-survival (PR #1 -> main)
│  └─ Person 2: feat/p2-d4-resilient-expeditions (PR #2 -> main)
└─ Day 4-5:
   ├─ Person 1: feat/p1-d2-equipment-weapons (PR #3 -> main)
   └─ Person 2: feat/p2-d7-expedition-defense (PR #4 -> main)

Week 2: Advanced Features & Polish
├─ Day 6-7:
│  ├─ Person 1: feat/p1-d3-crafting-time (PR #5 -> main)
│  └─ Person 2: feat/p2-d6-new-species (PR #6 -> main)
├─ Day 8:
│  └─ Joint: feat/joint-d5-save-restore (PR #7 -> main)
└─ Day 9:
   └─ Integration testing, edge-case validation, exam rehearsal.
```
