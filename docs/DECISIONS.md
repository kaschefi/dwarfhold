# Quality goals and decisions

We chose three goals for Dwarfhold. They matter because the player makes decisions based on the colony's numbers and needs to understand what happened after a day, an expedition, or a refresh.

## 1. Predictable game rules

**Goal:** The same colony state and action should produce the same result.

**Decision:** Daily production, food consumption, crafting progress, species traits, and raid outcomes are calculated in functions under `src/domain/`. These functions take the current state and return a new state. For example, a food shortage halves the next day's production, and a raid without two weapons removes resources according to a fixed rule.

**Trade-off:** The React provider needs extra code to call these functions and show their results. In return, the calculations can be tested without running the browser or server.

**How to check:** Run `npm test`. The simulation, crafting, species, equipment, and defense tests use known inputs and assert exact results.

## 2. Recovery without inconsistent state

**Goal:** A failed request or browser refresh should not duplicate rewards, lose a worker permanently, or load broken data.

**Decision:** An expedition locks its worker while the request is pending. Repeated dispatches are rejected, and a failed or timed-out request returns the worker without rewards. The browser save has a version number and is checked before loading. An expedition interrupted by refresh is cancelled without rewards; an unfinished forge task resumes at its saved progress without charging materials again.

**Trade-off:** We do not try to resume a network request after refresh. Cancelling it is simpler and avoids granting a reward for a result the browser can no longer verify.

**How to check:** Run `npm test` for the saved-state cases. In the browser, start an expedition or forge task and refresh before it finishes. Also try the Blocked Pass to see a failed expedition return its worker.

## 3. Clear feedback for the player

**Goal:** The player should see why resources or worker availability changed.

**Decision:** The interface shows a food-shortage warning, worker status, the daily production ledger, forge progress, a raid result, and the save/refresh policy. The Chronicle records important events.

**Trade-off:** These notices take some screen space, but the rules are visible while playing instead of being hidden in code.

**How to check:** Play through a food shortage, a craft, and a Goblin Outpost expedition. Compare the notices with the resource bar and worker status after each event.
