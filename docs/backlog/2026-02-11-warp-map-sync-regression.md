---
title: "Warp Regression Investigation: map sync guard disposes world manager"
status: bug
last_verified: 2026-02-11
---

# Warp Regression Investigation: map sync guard disposes world manager

## Summary
The regression is caused by syncing the debug map selector via `setSelectedMapId` during `performWarpTransition` while a `useEffect` keyed by `selectedMap` owns `worldManager` lifecycle. The guard added to skip map reload on warp runs too late: React executes the previous effect cleanup first, which disposes `worldManagerRef`. The next warp then fails because `performWarpTransition` receives `worldManager = null` and returns early.

## Evidence from current code
- Warp callback now updates selected map state:
  - `src/pages/GamePage.tsx:1088`
- Map-load effect skips when warp-driven:
  - `src/pages/GamePage.tsx:2001`
- Effect cleanup disposes world manager:
  - `src/pages/gamePage/loadSelectedOverworldMap.ts:281`
- Next warp hard-returns when worldManager is missing:
  - `src/pages/gamePage/performWarpTransition.ts:85`
- Door sequence marks warp in progress before calling warp:
  - `src/pages/GamePage.tsx:1581`

## Failure timeline
1. Door warp into house completes.
2. `performWarpTransition` calls `onMapChanged`, which sets `warpDrivenMapChangeRef=true` and calls `setSelectedMapId(...)`.
3. `selectedMap` effect reruns. React first runs previous cleanup from `loadSelectedOverworldMap(...)`, disposing `worldManagerRef`.
4. New effect body sees `warpDrivenMapChangeRef` and returns early (intended skip), so no replacement manager is created.
5. On next door exit, door sequence reaches `onExecuteWarp`, sets `warpingRef=true`, and calls `performWarp(...)`.
6. `performWarpTransition` sees `worldManager=null` and returns before logging `[WARP] ========== WARP START ==========`.
7. Player stays locked/stuck because warp never executes and `warpingRef` is not reset in this early-return path.

This exactly matches the observed symptom: lockInput stack appears, then no warp-start log when trying to exit.

## Proposed fix
### Preferred (clean architecture)
Decouple debug display map from map-loading state.

1. Keep `selectedMapId` as the authoritative map-load selector.
2. Add a separate `debugSelectedMapId` (or `currentMapDisplayId`) for debug UI only.
3. In `performWarpTransition.onMapChanged`, update only debug display state.
4. Remove `warpDrivenMapChangeRef` skip logic from the map-load effect.

Why: avoids triggering the load effect lifecycle during warp-only UI sync, so cleanup cannot destroy runtime state mid-session.

### Minimal patch (if you want smallest diff)
Prevent cleanup disposal on the warp-driven selected-map sync pass.

1. Add `skipDisposeOnNextMapSyncRef` in `GamePage`.
2. Set it to `true` before warp-driven `setSelectedMapId`.
3. In `loadSelectedOverworldMap` cleanup, if this ref is set, clear it and skip `worldManagerRef.current.dispose()` for that pass.
4. Also harden `performWarpTransition` early dependency guard to clear warp state:
   - if missing dependencies, set `warpingRef.current = false` and `warpHandler.setInProgress(false)` before returning.

Why: this preserves the current behavior with minimal movement while preventing the hard-lock failure mode.

## Validation plan
1. Repro flow: Continue game on Route 114 -> enter Lanette/Fossil house -> immediately exit.
2. Confirm every door attempt prints `[WARP] ========== WARP START ==========`.
3. Confirm `worldManagerRef` remains non-null after warp map-sync updates.
4. Confirm no player lock persists when warp cannot execute (defensive guard test).
