# Door/Warp System Unification Plan

This document details the plan to merge door execution and warping code between Canvas2D (MapRenderer) and WebGL (WebGLMapPage) renderers.

**Source of Truth:** `doc/warp/warp-behavior.md` and `public/pokeemerald/src/field_screen_effect.c`

---

## Current Architecture Analysis

### Shared Components (Already Unified)

| Component | Location | Purpose |
|-----------|----------|---------|
| `DoorSequencer` | `src/field/DoorSequencer.ts` | State machine for door entry/exit sequences |
| `useDoorSequencer` | `src/hooks/useDoorSequencer.ts` | React wrapper for DoorSequencer |
| `useDoorAnimations` | `src/hooks/useDoorAnimations.ts` | Door sprite loading and animation spawning |
| `WarpExecutor` | `src/game/WarpExecutor.ts` | Facing direction, door exit sequence dispatch |
| `WarpHandler` | `src/field/WarpHandler.ts` | Warp state (cooldown, inProgress, lastTile) |
| `FadeController` | `src/field/FadeController.ts` | Fade in/out effects |
| `metatileBehaviors.ts` | `src/utils/metatileBehaviors.ts` | Behavior detection (isDoorBehavior, etc.) |
| Timing constants | `src/field/types.ts` | `DOOR_TIMING`, `FADE_TIMING` |

### Canvas2D Implementation (`useWarpExecution.ts`)

**Total: ~593 lines**

| Function | Lines | Description |
|----------|-------|-------------|
| `advanceDoorEntry` | 281-343 (~63 lines) | Process door entry state machine each frame |
| `advanceDoorExit` | 351-433 (~83 lines) | Process door exit state machine each frame |
| `handleDoorWarpAttempt` | 441-578 (~138 lines) | Handle player entering a door |
| `performWarp` | 171-274 (~104 lines) | Execute map transition |
| `startAutoDoorWarp` | 131-159 (~29 lines) | Start non-animated door warp |

### WebGL Implementation (`WebGLMapPage.tsx`)

**Inline door code: ~185 lines**

| Code Section | Lines | Description |
|--------------|-------|-------------|
| Door handler setup | 485-584 (~100 lines) | `player.setDoorWarpHandler()` callback |
| `advanceDoorEntry` inline | 751-788 (~38 lines) | Door entry loop processing |
| `advanceDoorExit` inline | 792-836 (~45 lines) | Door exit loop processing |
| `performWarp` | 301-401 (~100 lines) | WebGL-specific warp execution |

---

## Duplication Analysis

### Identical Logic (Can Be Fully Unified)

#### 1. `advanceDoorEntry` Action Dispatcher (~40 lines × 2 = 80 lines duplicated)

Both Canvas2D and WebGL have nearly identical code:

```typescript
// Canvas2D (useWarpExecution.ts:304-342)
if (result.action === 'startPlayerStep' && result.direction) {
  player.forceMove(result.direction, true);
} else if (result.action === 'hidePlayer') {
  playerHiddenRef.current = true;
  if (entryState.isAnimatedDoor) {
    const pos = doorSequencer.getEntryDoorPosition();
    doorSequencer.setEntryCloseAnimId(-1);
    doorAnimations.spawn('close', pos?.x ?? 0, pos?.y ?? 0, entryState.metatileId, now)
      .then((closeAnimId) => {
        if (closeAnimId !== null) doorSequencer.setEntryCloseAnimId(closeAnimId);
      });
    if (entryState.openAnimId !== undefined) doorAnimations.clearById(entryState.openAnimId);
  }
} else if (result.action === 'removeCloseAnimation' && result.animId !== undefined) {
  doorAnimations.clearById(result.animId);
} else if (result.action === 'startFadeOut' && result.duration) {
  fadeRef.current.startFadeOut(result.duration, now);
} else if (result.action === 'executeWarp' && result.trigger) {
  void performWarp(result.trigger as WarpTrigger, { force: true, fromDoor: true });
}

// WebGL (WebGLMapPage.tsx:765-787) - IDENTICAL LOGIC
```

#### 2. `advanceDoorExit` Action Dispatcher (~45 lines × 2 = 90 lines duplicated)

```typescript
// Both renderers have identical logic for:
// - 'spawnOpenAnimation' action
// - 'startPlayerStep' action
// - 'spawnCloseAnimation' action
// - 'removeCloseAnimation' action
// - result.done handling
```

#### 3. Door Handler Logic (~60 lines similar)

The door warp handler in both renderers follows the same pattern:
1. Check guards (doorSequencer.isEntryActive, warpHandler.isInProgress)
2. Get render context and resolve tile
3. Find warp event at position
4. Check behavior type (arrow, animated door, non-animated door)
5. For arrows: validate player direction, start auto-warp
6. For animated doors: spawn open animation, start entry sequence
7. For non-animated: start auto-warp with fade

### Renderer-Specific Logic (Must Stay Separate)

| Logic | Canvas2D | WebGL | Why Separate |
|-------|----------|-------|--------------|
| World init | `mapManager.buildWorld()` | `worldManager.initialize()` | Different data structures |
| Tile resolution | `RenderContext + resolveTileAt()` | `WorldSnapshot + getRenderContextFromSnapshot()` | Different APIs |
| Tileset upload | N/A | `uploadTilesetsFromSnapshot()` | GPU-specific |
| Pipeline update | `applyTileResolver()` | `pipeline.setTileResolver()` | Different pipelines |
| Context type | `RenderContext` | `WorldSnapshot` | Different state models |

---

## Proposed Solution

### Phase 1: Extract Door Action Dispatchers (~80 lines saved)

Create shared action dispatcher functions that both renderers can use.

**New file:** `src/game/DoorActionDispatcher.ts`

```typescript
/**
 * Door Action Dispatcher
 *
 * Shared action handlers for door entry/exit sequences.
 * Called by both Canvas2D and WebGL after doorSequencer.updateEntry/Exit().
 */

import type { DoorEntryUpdateResult, DoorExitUpdateResult } from '../field/DoorSequencer';
import type { UseDoorSequencerReturn } from '../hooks/useDoorSequencer';
import type { UseDoorAnimationsReturn } from '../hooks/useDoorAnimations';
import type { FadeController } from '../field/FadeController';
import type { PlayerController } from './PlayerController';

export interface DoorActionDeps {
  player: PlayerController;
  doorSequencer: UseDoorSequencerReturn;
  doorAnimations: UseDoorAnimationsReturn;
  fadeController: FadeController;
  playerHiddenRef: { current: boolean };
  onExecuteWarp: (trigger: unknown) => void;
}

/**
 * Process door entry action result
 */
export function handleDoorEntryAction(
  result: DoorEntryUpdateResult,
  entryState: { isAnimatedDoor: boolean; metatileId: number; openAnimId?: number },
  deps: DoorActionDeps,
  now: number
): void {
  const { player, doorSequencer, doorAnimations, fadeController, playerHiddenRef, onExecuteWarp } = deps;

  if (result.action === 'startPlayerStep' && result.direction) {
    player.forceMove(result.direction, true);
  } else if (result.action === 'hidePlayer') {
    playerHiddenRef.current = true;
    if (entryState.isAnimatedDoor) {
      const pos = doorSequencer.getEntryDoorPosition();
      doorSequencer.setEntryCloseAnimId(-1);
      doorAnimations.spawn('close', pos?.x ?? 0, pos?.y ?? 0, entryState.metatileId, now)
        .then((closeAnimId) => {
          if (closeAnimId !== null) doorSequencer.setEntryCloseAnimId(closeAnimId);
        });
      if (entryState.openAnimId !== undefined) {
        doorAnimations.clearById(entryState.openAnimId);
      }
    }
  } else if (result.action === 'removeCloseAnimation' && result.animId !== undefined) {
    doorAnimations.clearById(result.animId);
  } else if (result.action === 'startFadeOut' && result.duration) {
    fadeController.startFadeOut(result.duration, now);
  } else if (result.action === 'executeWarp' && result.trigger) {
    onExecuteWarp(result.trigger);
  }
}

/**
 * Process door exit action result
 */
export function handleDoorExitAction(
  result: DoorExitUpdateResult,
  exitState: { metatileId: number; openAnimId?: number },
  deps: DoorActionDeps,
  now: number
): void {
  const { player, doorSequencer, doorAnimations, playerHiddenRef } = deps;

  if (result.action === 'spawnOpenAnimation') {
    const pos = doorSequencer.getExitDoorPosition();
    doorSequencer.setExitOpenAnimId(-1);
    const alreadyOpenStartedAt = now - 500;
    doorAnimations.spawn('open', pos?.x ?? 0, pos?.y ?? 0, exitState.metatileId, alreadyOpenStartedAt, true)
      .then((openAnimId) => {
        if (openAnimId !== null) doorSequencer.setExitOpenAnimId(openAnimId);
      });
  } else if (result.action === 'startPlayerStep' && result.direction) {
    player.forceMove(result.direction, true);
    playerHiddenRef.current = false;
  } else if (result.action === 'spawnCloseAnimation') {
    const pos = doorSequencer.getExitDoorPosition();
    if (exitState.openAnimId !== undefined && exitState.openAnimId !== -1) {
      doorAnimations.clearById(exitState.openAnimId);
    }
    doorSequencer.setExitCloseAnimId(-1);
    doorAnimations.spawn('close', pos?.x ?? 0, pos?.y ?? 0, exitState.metatileId, now)
      .then((closeAnimId) => {
        if (closeAnimId !== null) doorSequencer.setExitCloseAnimId(closeAnimId);
      });
  } else if (result.action === 'removeCloseAnimation' && result.animId !== undefined) {
    doorAnimations.clearById(result.animId);
  }

  if (result.done) {
    player.unlockInput();
    playerHiddenRef.current = false;
  }
}
```

### Phase 2: Extract Door Warp Handler Logic (~40 lines saved)

Create a shared handler for starting door warp sequences.

**Add to `DoorActionDispatcher.ts`:**

```typescript
export interface DoorWarpStartDeps {
  player: PlayerController;
  doorSequencer: UseDoorSequencerReturn;
  doorAnimations: UseDoorAnimationsReturn;
  arrowOverlay: { hide: () => void };
  warpHandler: { isInProgress: () => boolean };
}

export interface DoorWarpStartContext {
  targetX: number;
  targetY: number;
  behavior: number;
  metatileId: number;
  warpEvent: WarpEvent;
  sourceMap: WorldMapInstance;
}

/**
 * Start a door warp sequence based on tile behavior
 *
 * @returns true if warp was started, false if rejected
 */
export async function startDoorWarpSequence(
  ctx: DoorWarpStartContext,
  deps: DoorWarpStartDeps
): Promise<boolean> {
  const { player, doorSequencer, doorAnimations, arrowOverlay, warpHandler } = deps;
  const { targetX, targetY, behavior, metatileId, warpEvent, sourceMap } = ctx;

  // Guards
  if (doorSequencer.isEntryActive()) return false;
  if (warpHandler.isInProgress()) return false;

  const isArrow = isArrowWarpBehavior(behavior);
  const isAnimated = isDoorBehavior(behavior);
  const isNonAnimated = isNonAnimatedDoorBehavior(behavior);

  const trigger: WarpTrigger = {
    kind: isArrow ? 'arrow' : 'door',
    sourceMap,
    warpEvent,
    behavior,
    facing: player.dir,
  };

  // Arrow warps
  if (isArrow) {
    const arrowDir = getArrowDirectionFromBehavior(behavior);
    if (!arrowDir || player.dir !== arrowDir) return false;

    arrowOverlay.hide();
    doorSequencer.startAutoWarp({
      targetX: player.tileX,
      targetY: player.tileY,
      metatileId,
      isAnimatedDoor: false,
      entryDirection: arrowDir as CardinalDirection,
      warpTrigger: trigger,
    }, performance.now(), true);
    player.lockInput();
    return true;
  }

  // Animated doors
  if (isAnimated) {
    const startedAt = performance.now();
    const openAnimId = await doorAnimations.spawn('open', targetX, targetY, metatileId, startedAt, true);
    doorSequencer.startEntry({
      targetX,
      targetY,
      metatileId,
      isAnimatedDoor: true,
      entryDirection: player.dir as CardinalDirection,
      warpTrigger: trigger,
      openAnimId: openAnimId ?? undefined,
    }, startedAt);
    if (openAnimId) doorSequencer.setEntryOpenAnimId(openAnimId);
    player.lockInput();
    return true;
  }

  // Non-animated doors (stairs, etc.)
  if (isNonAnimated) {
    doorSequencer.startAutoWarp({
      targetX,
      targetY,
      metatileId,
      isAnimatedDoor: false,
      entryDirection: player.dir as CardinalDirection,
      warpTrigger: trigger,
    }, performance.now(), true);
    player.lockInput();
    return true;
  }

  return false;
}
```

### Phase 3: Update Renderers to Use Shared Code

#### Canvas2D (`useWarpExecution.ts`)

```typescript
// Replace inline advanceDoorEntry logic with:
const result = doorSequencer.updateEntry(now, player.isMoving, isAnimationDone, isFadeDone);
handleDoorEntryAction(result, entryState, {
  player,
  doorSequencer,
  doorAnimations,
  fadeController: refs.fadeRef.current,
  playerHiddenRef: refs.playerHiddenRef as { current: boolean },
  onExecuteWarp: (trigger) => void performWarp(trigger as WarpTrigger, { force: true, fromDoor: true }),
}, now);

// Replace inline advanceDoorExit logic with:
const result = doorSequencer.updateExit(now, player.isMoving, isAnimationDone, isFadeInDone);
handleDoorExitAction(result, exitState, deps, now);
```

#### WebGL (`WebGLMapPage.tsx`)

```typescript
// Replace inline door entry loop (lines 751-788) with:
if (doorSequencer.isEntryActive()) {
  const player = playerRef.current;
  if (player) {
    const entryState = doorSequencer.sequencer.getEntryState();
    const isAnimationDone = /* ... */;
    const isFadeDone = /* ... */;
    const result = doorSequencer.updateEntry(nowTime, player.isMoving, isAnimationDone, isFadeDone);
    handleDoorEntryAction(result, entryState, doorActionDeps, nowTime);
  }
}
```

---

## Potential Issues and Mitigations

### Issue 1: Different Ref Types

**Problem:** Canvas2D uses `RefObject<FadeController>`, WebGL uses `useRef<FadeController>`.

**Mitigation:** The `DoorActionDeps` interface takes the concrete type, not the ref. Each renderer unwraps its ref before calling:
```typescript
// Canvas2D
fadeController: refs.fadeRef.current

// WebGL
fadeController: fadeControllerRef.current
```

### Issue 2: Async vs Sync `performWarp`

**Problem:** Canvas2D's `performWarp` is async and used in callbacks. WebGL's is also async.

**Mitigation:** Both pass an `onExecuteWarp` callback that wraps the async call:
```typescript
onExecuteWarp: (trigger) => {
  warpingRef.current = true;
  void performWarp(trigger as WarpTrigger, { force: true, fromDoor: true });
}
```

### Issue 3: WebGL Palette Switching

**Problem:** WebGL needs to upload tilesets to GPU during warp, which Canvas2D doesn't.

**Mitigation:** This is in `performWarp`, not the door action dispatchers. Each renderer keeps its own `performWarp` implementation:
- Canvas2D: `mapManager.buildWorld()` + context rebuild
- WebGL: `worldManager.initialize()` + `uploadTilesetsFromSnapshot()` + `initializeWorldFromSnapshot()`

The shared code only handles:
- Door animation sequencing
- Player state (hidden, locked)
- Fade effects
- State machine transitions

### Issue 4: Different Tile Resolution APIs

**Problem:** Canvas2D uses `RenderContext`, WebGL uses `WorldSnapshot`.

**Mitigation:** The door action dispatchers don't need tile resolution. They only work with:
- Door position (`doorSequencer.getEntryDoorPosition()`)
- Metatile ID (already resolved, passed in `entryState`/`exitState`)
- Animation IDs

Tile resolution happens BEFORE the door sequence starts (in the door handler).

### Issue 5: Debug Logging Differences

**Problem:** Canvas2D has `logDoor()` helper, WebGL uses `console.log('[DOOR_HANDLER]')`.

**Mitigation:** Add optional `debug` callback to `DoorActionDeps`:
```typescript
debug?: (event: string, data?: unknown) => void;
```

Or use a shared `doorDebug.ts` module with consistent logging.

---

## Implementation Checklist

### Phase 1: Door Action Dispatchers (Priority: High) ✅ COMPLETE

- [x] Create `src/game/DoorActionDispatcher.ts`
- [x] Add `DoorActionDeps` interface
- [x] Implement `handleDoorEntryAction()`
- [x] Implement `handleDoorExitAction()`
- [x] Add `createAnimationDoneChecker()` helper
- [x] Add `startDoorWarpSequence()` for door warp initiation
- [x] Export types and functions
- [x] **TEST**: Build passes ✅

### Phase 2: Update Canvas2D (Priority: High) ✅ COMPLETE

- [x] Import `handleDoorEntryAction`, `handleDoorExitAction` in `useWarpExecution.ts`
- [x] Replace `advanceDoorEntry` action handling (~40 lines → ~20 lines)
- [x] Replace `advanceDoorExit` action handling (~45 lines → ~20 lines)
- [x] Keep `isAnimationDone` and `isFadeDone` helpers via `createAnimationDoneChecker()`
- [ ] **TEST**: Door entry works (animated door house)
- [ ] **TEST**: Door exit works (exiting house)
- [ ] **TEST**: Non-animated door works (stairs)
- [ ] **TEST**: Arrow warp works (cave entrances)

### Phase 3: Update WebGL (Priority: High) ✅ COMPLETE

- [x] Import `handleDoorEntryAction`, `handleDoorExitAction` in `WebGLMapPage.tsx`
- [x] Replace inline door entry loop (~38 lines → ~20 lines)
- [x] Replace inline door exit loop (~45 lines → ~20 lines)
- [x] Update door handler to use `startDoorWarpSequence()` (~100 lines → ~50 lines)
- [ ] **TEST**: Door entry works (animated door house)
- [ ] **TEST**: Door exit works (exiting house)
- [ ] **TEST**: Non-animated door works (stairs)
- [ ] **TEST**: Arrow warp works (cave entrances)

### Phase 4: Extract Door Warp Handler (Priority: Medium) ✅ COMPLETE (WebGL only)

- [x] Add `startDoorWarpSequence()` to `DoorActionDispatcher.ts`
- [x] Add `DoorWarpStartDeps` and `DoorWarpContext` interfaces
- [ ] Update Canvas2D `handleDoorWarpAttempt` to use shared logic (kept as-is for debug logging)
- [x] Update WebGL door handler callback to use shared logic (~50 lines saved)
- [ ] **TEST**: All door types work in both renderers

### Phase 5: Cleanup (Priority: Low) ⏳ PENDING

- [ ] Remove duplicate `logDoor` implementations
- [ ] Add shared debug logging module if needed
- [x] Update documentation
- [ ] Remove commented-out code

---

## Actual Results

### Line Count Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `WebGLMapPage.tsx` | 1285 | 1204 | **-81** |
| `useWarpExecution.ts` | ~593 | 517 | **-76** |
| `DoorActionDispatcher.ts` | 0 | 419 | +419 (new) |

**Notes:**
- WebGL saved ~81 lines by using shared dispatchers and `startDoorWarpSequence()`
- Canvas2D saved ~76 lines by using shared dispatchers (kept detailed debug logging)
- New shared module includes comprehensive documentation, types, and helper functions
- Net change is +262 lines, but this reflects consolidation into a single source of truth

### Architecture Benefits

1. **Single Source of Truth**: Door action logic in one place
2. **Easier Maintenance**: Bug fixes apply to both renderers
3. **GBA Parity**: Easier to verify behavior matches `doc/warp/warp-behavior.md`
4. **Testability**: Can unit test door action dispatchers independently

### What Stays Renderer-Specific

| Component | Why |
|-----------|-----|
| `performWarp()` | Different world init APIs (MapManager vs WorldManager) |
| Tileset uploads | WebGL-only (GPU) |
| `RenderContext` creation | Different data structures |
| Refs setup | Different React patterns in hooks vs components |

---

## Test Matrix

After implementation, verify against `doc/warp/warp-behavior.md`:

| Case | Test Location | Canvas2D | WebGL |
|------|---------------|----------|-------|
| Animated door entry | LittlerootTown → PlayerHouse_1F | [ ] | [ ] |
| Animated door exit | PlayerHouse_1F → LittlerootTown | [ ] | [ ] |
| Non-animated door (stairs) | RustboroCity_DevonCorp_1F | [ ] | [ ] |
| Arrow warp (north) | AbandonedShip_Deck | [ ] | [ ] |
| Ladder (preserve facing) | GraniteCave_B1F | [ ] | [ ] |
| Deep-south warp | Underwater_SootopolisCity | [ ] | [ ] |

---

## GBA Reference

Always consult source code in `public/pokeemerald/`:

| Function | File | Purpose |
|----------|------|---------|
| `Task_DoDoorWarp` | `field_screen_effect.c:484-728` | Door entry sequence |
| `Task_ExitDoor` | `field_screen_effect.c:272-320` | Animated door exit |
| `Task_ExitNonAnimDoor` | `field_screen_effect.c:322-370` | Non-animated door exit |
| `Task_ExitNonDoor` | `field_screen_effect.c:372-420` | No-door exit |
