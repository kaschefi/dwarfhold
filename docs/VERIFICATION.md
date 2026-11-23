# Verification notes

The practical exam asks us to verify the implementation using a suitable strategy. We checked the build, concrete game situations, and the local expedition API. These notes describe the inputs and expected results so the checks can be repeated without a test framework.

## Checked on 23 November 2026

- `npm run build` completed, including the TypeScript check and Vite production build.
- **D1:** With one miner and three residents, 2 food is insufficient for the daily meal. The day produces 2 stone, food becomes 0, and the next day produces 1 stone because of exhaustion.
- **D2:** Equipping the only free tool changes the store count from 1 to 0 and makes a miner produce 3 instead of 2 stone. Returning the tool restores the store count to 1.
- **D3:** Starting a tool task consumes 3 wood and 2 stone, sets the artisan to `crafting`, and creates one tool after two daily progress steps. An attempt without materials leaves resources unchanged.
- **D5:** A valid saved forge task restores with its progress. Damaged saved text falls back to the initial colony.
- **D6:** The first successful Crystal Cave recruit check adds Kivi; a second does not. Kivi's mining output is 4 stone and his tool wood cost is 2.
- **D7:** Two weapons defend against a raid and consume one weapon. One weapon is insufficient; with 10 food, 10 wood, and 10 stone, the fixed losses are 5 food, 4 wood, and 3 stone.
- **Expedition API:** The health endpoint returned success. Crystal Cave returned 8 stone. Goblin Outpost returned the raid flag. Blocked Pass returned HTTP 503.

The game-rule situations above were executed directly against the current source modules. The API calls were made against the local server. The temporary checking code is not part of the submitted project.

## Browser walkthrough before submission

The build and direct checks do not prove that every control is displayed and wired correctly. Play through these steps in the browser and record any difference from the expected result:

1. Assign a worker and watch the resource bar after one day; then create a food shortage and check the warning and following day's reduced production.
2. Equip and return a tool in the roster; check the free tool count and next day's production.
3. Start a tool or weapon in Forge; check artisan status, progress, material cost, and the finished item.
4. Send a scout to Blocked Pass; check the warning, return, and unchanged rewards. Try a second click while a request is pending.
5. Refresh during an expedition and during forging; check the visible recovery message, scout status, and forge progress.
6. Complete Crystal Cave twice; check that Kivi joins only once and that his mining and crafting rules appear in the interface.
7. Visit Goblin Outpost first with fewer than two weapons and later with at least two; check the shown losses or defense and the weapon count.

Clear or use a separate browser profile for a fresh scenario if an earlier saved game would affect the starting state. The save belongs to the browser origin, so changing the port creates a separate saved game.
