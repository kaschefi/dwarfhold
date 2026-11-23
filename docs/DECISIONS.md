# Quality goals and team decisions

The requirements D1-D7 describe what the game must do. We also chose three goals for how the game should behave. These are quality goals, not extra game features.

## 1. Predictable rules

**Goal:** Given the same colony state and action, the game should produce the same next state.

**Why this matters:** Players use the resource numbers to decide who should work, what to forge, and whether the colony can survive a raid. The same situation should not produce a different result for no clear reason.

**Our decision:** Production, food consumption, crafting progress, species traits, equipment, and raid outcomes are calculated in functions under `src/domain/`. They receive the current state and return the next state. Food shortage reduces the next day's production to the rounded-down half. A raid uses a fixed weapon threshold and a fixed looting rule rather than a random outcome.

**Trade-off:** Keeping these calculations separate from the React interface means the provider needs code to connect actions and results to the screen. It also makes the rules easier to test without opening the browser. The fixed raid rule is less surprising, although it offers less variety than a random one.

**How we evaluate it:** Run `npm test` and check that the same input produces the expected resources and worker states. In the browser, compare the Shift Ledger with the resources after a day, both with and without an equipped tool and after a food shortage.

## 2. Safe recovery from failures and refreshes

**Goal:** Failures and refreshes should leave the colony in a usable state, without duplicate rewards or permanently unavailable workers.

**Why this matters:** An expedition uses a delayed network request, and the browser can be refreshed while a worker is away or forging. The player should not receive a reward twice, lose a worker permanently, or continue with an invalid save.

**Our decision:** An expedition marks its worker as unavailable and blocks repeated dispatches. Failed or timed-out requests return the worker without rewards. The saved game has a version number and is validated before loading. After a refresh, an unfinished expedition is cancelled without rewards and its worker returns. An unfinished forge task keeps its progress and does not charge materials again.

**Trade-off:** We cancel an expedition after refresh instead of trying to reconnect to an old request whose result the browser can no longer confirm. Saves are kept in this browser's `localStorage`, so they do not transfer to another browser or device.

**How we evaluate it:** Run `npm test` for valid, damaged, and incompatible saves and for interrupted work. In the browser, send a scout to Blocked Pass and confirm that the scout returns without loot. Refresh during an expedition and during forging, then check the worker, resources, and craft progress. Replace the `dwarfhold.save.v1` value with invalid text in DevTools and reload; the game should start a new colony with a notice instead of crashing.

## 3. Understandable feedback

**Goal:** The player should be able to see why important resources or worker statuses changed.

**Why this matters:** A correct calculation is still confusing if the player cannot tell why production fell, why a worker is unavailable, or what the raiders took.

**Our decision:** The interface shows worker status, the daily production ledger, a food-shortage warning, forge progress, defense readiness, raid results, and the save/refresh policy. The Chronicle records important events, including failures and successful returns.

**Trade-off:** These explanations use space on the screen. We chose visible feedback so that players can understand the rules while playing instead of needing to inspect the code.

**How we evaluate it:** Without looking at the source, play through a food shortage, a craft, a failed expedition, and a successful Goblin Outpost expedition. After each action, the visible message should explain the resource change or worker status. For the raid, compare the warning and result with the weapon and resource counts.
