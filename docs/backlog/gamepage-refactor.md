---
title: "GamePage.tsx Refactoring Plan"
status: proposed
last_verified: 2025-02-12
---

# GamePage.tsx Refactoring Plan

**Current**: 3,483 lines | **Target**: <1,800 lines | **Cut**: ~1,700 lines

## Problem

`GamePage.tsx` is a 3,483-line monolith containing game update logic, script runtime
service construction, legendary encounter animations, story parity state management,
NPC collision providers, debug rendering, and the entire overworld render loop. Much of
this code has no business being in a React component file.

## Existing Extractions

12 modules already live in `src/pages/gamePage/`:

| Module | Purpose |
|--------|---------|
| `performWarpTransition.ts` | Warp execution with fade/door sequences |
| `loadSelectedOverworldMap.ts` | Map loading orchestration |
| `runMapEntryScripts.ts` | ON_LOAD / ON_TRANSITION script runner |
| `runMapDiveScript.ts` | Dive warp script evaluation |
| `useHandledStoryScript.ts` | Story script dispatch (hand-coded + ScriptRunner) |
| `useStateMachineRenderLoop.ts` | Title/menu state render loop |
| `useOverworldContinueLocation.ts` | Saved game resume location |
| `overworldAssets.ts` | Sprite/field asset bootstrap |
| `buildDebugState.ts` | Debug panel state builder |
| `buildWebGLDebugState.ts` | WebGL debug info builder |
| `buildPriorityDebugInfo.ts` | Priority layer debug builder |
| `createMapScriptRunnerContext.ts` | Script runner context factory |

These follow a consistent pattern: **accept refs/deps as parameters, return results**.
The refactoring below continues that pattern.

---

## Extraction Plan

### 1. ScriptRuntimeServices factory (~420 lines saved)

**Lines 862–1300** — The `scriptRuntimeServices` useMemo block.

**What it is**: A massive factory that builds the `ScriptRuntimeServices` object consumed
by the script runner. Contains camera movement/shake, fade orchestration, weather
control, field effect management, and legendary encounter logic.

**Why it's here**: It closes over `~15 refs` (playerRef, fadeControllerRef, cameraRef,
objectEventManagerRef, pipelineRef, spriteRendererRef, etc.).

**Extract to**: `src/pages/gamePage/createScriptRuntimeServices.ts`

```typescript
export interface ScriptRuntimeServicesDeps {
  playerRef: MutableRef<PlayerController | null>;
  fadeControllerRef: MutableRef<FadeController>;
  cameraRef: MutableRef<CameraController | null>;
  pipelineRef: MutableRef<WebGLRenderPipeline | null>;
  spriteRendererRef: MutableRef<WebGLSpriteRenderer | null>;
  objectEventManagerRef: MutableRef<ObjectEventManager>;
  worldSnapshotRef: MutableRef<WorldSnapshot | null>;
  scriptedCameraStateRef: MutableRef<ScriptedCameraState>;
  scriptedCameraMoveTokenRef: MutableRef<number>;
  scriptedCameraShakeTokenRef: MutableRef<number>;
  activeScriptFieldEffectsRef: MutableRef<Map<string, Promise<void>>>;
  mewEmergingGrassEffectIdRef: MutableRef<string | null>;
  deoxysRockRenderDebugRef: MutableRef<DeoxysRockDebugState>;
  waitScriptFrames: (frames: number) => Promise<void>;
}

export function createScriptRuntimeServices(
  deps: ScriptRuntimeServicesDeps
): ScriptRuntimeServices;
```

**Deoxys context**: In the C source, the Deoxys rock puzzle lives in
`field_specials.c` (DoDeoxysRockInteraction, ChangeDeoxysRockLevel) and
`field_effect.c` (FLDEFF_MOVE_DEOXYS_ROCK, FLDEFF_DESTROY_DEOXYS_ROCK). It's a
self-contained 11-level pathfinding puzzle where the rock moves between fixed
positions and cycles through 11 palette variants. The Mew encounter lives in its
own `faraway_island.c`. Neither belongs in a React component — they're field-level
special encounter systems. Our code already has `src/game/legendary/` for palette
loading; the movement/animation runtime should join it.

**Sub-extraction**: The `setDeoxysRockLevel` method alone is ~130 lines of
fixed-point interpolation animation. Extract to
`src/game/legendary/deoxysRockMovement.ts`:

```typescript
export async function animateDeoxysRockMovement(
  request: DeoxysRockMoveRequest,
  deps: DeoxysRockMovementDeps
): Promise<void>;
```

This mirrors how C has `Task_MoveDeoxysRock` as a separate task function.

---

### 2. Overworld game update logic (~600 lines saved)

**Lines 2017–2750** — The per-frame game update inside the render loop.

This is the biggest single block. It handles:
- GBA frame advancement
- NPC movement + affine animation
- Truck sequence sync
- Player update (with ON_FRAME pre-check)
- Step callback manager
- World manager position updates
- Coord event processing
- Post-move ON_FRAME evaluation (duplicated!)
- Debug info updates
- Arrow overlay updates
- Warp trigger processing + response
- Door sequence advancement
- Lavaridge warp advancement
- Scripted warp state machine (150 lines!)
- Pending warp fade completion

**Extract to**: `src/pages/gamePage/overworldGameUpdate.ts`

```typescript
export interface OverworldUpdateContext {
  // Bundled refs (see Extraction 7)
  refs: OverworldRefs;
  // Hooks
  npcMovement: ReturnType<typeof useNPCMovement>;
  doorSequencer: ReturnType<typeof useDoorSequencer>;
  doorAnimations: ReturnType<typeof useDoorAnimations>;
  arrowOverlay: ReturnType<typeof useArrowOverlay>;
  lavaridgeWarpSequencer: ReturnType<typeof useLavaridgeWarpSequencer>;
  // Callbacks
  performWarp: (trigger: WarpTrigger, options?: WarpOptions) => Promise<WarpResult>;
  selectMapForLoad: (mapId: string) => void;
  runSeamTransitionScripts: (mapId: string) => Promise<void>;
  getRenderContextFromSnapshot: (snapshot: WorldSnapshot) => RenderContext | null;
  setMapMetatileAndInvalidate: SetMapMetatileFn;
  // State setters (debug only)
  debugSetters: OverworldDebugSetters;
}

export function updateOverworldFrame(
  ctx: OverworldUpdateContext,
  dt: number,
  nowTime: number
): void;
```

**Key deduplication inside**: The ON_FRAME evaluation runs twice today —
once before `player.update()` (lines 2106–2171) and again after movement
(lines 2386–2431). Extract to a shared `evaluateOnFrameScripts()` function
called from both sites.

---

### 3. Overworld sprite rendering (~200 lines saved)

**Lines 2860–3100** — Sprite batch building, rotating gate sprites, and
`compositeWebGLFrame` call.

**Extract to**: `src/pages/gamePage/renderOverworldSprites.ts`

This section is already mostly delegating to `buildSprites()` and
`compositeWebGLFrame()` but still has ~200 lines of glue: rotating gate sprite
creation, door sprite upload tracking, debug priority info, and fade alpha
clamping for scripted warps.

---

### 4. Story parity functions (~80 lines saved)

**Lines 736–828** — `applyStoryOnLoadMetatileParity` and
`applyStoryTransitionObjectParity`.

These set metatile states (truck door, moving boxes) and NPC positions based on
`VAR_LITTLEROOT_INTRO_STATE`. Pure game logic with no React dependency.

**Extract to**: `src/pages/gamePage/storyParity.ts`

```typescript
export function applyStoryOnLoadMetatileParity(
  snapshot: WorldSnapshot,
  setMapMetatile: SetMapMetatileFn
): boolean;

export function applyStoryTransitionObjectParity(
  mapId: string,
  snapshot: WorldSnapshot,
  objectManager: ObjectEventManager
): void;
```

---

### 5. NPC movement providers (~60 lines saved)

**Lines 476–547** — The `npcMovementProviders` useMemo creating collision/elevation
callbacks for the NPC movement system.

**Extract to**: `src/pages/gamePage/npcMovementProviders.ts`

```typescript
export function createNPCMovementProviders(
  playerRef: MutableRef<PlayerController | null>,
  objectEventManagerRef: MutableRef<ObjectEventManager>
): NPCMovementProviders;
```

---

### 6. Debug tile rendering effect (~70 lines saved)

**Lines 1624–1705** — The `useEffect` that renders the 3x3 debug tile grid
canvas when the debug panel is open.

**Extract to**: `src/pages/gamePage/useDebugTileGrid.ts` (custom hook)

---

### 7. Ref bundling (~100 lines saved)

**Lines 345–472** — 40+ individual `useRef` declarations.

Group related refs into typed bundles via a custom hook:

**Extract to**: `src/pages/gamePage/useOverworldRefs.ts`

```typescript
export interface OverworldRefs {
  // Rendering
  pipeline: MutableRef<WebGLRenderPipeline | null>;
  spriteRenderer: MutableRef<WebGLSpriteRenderer | null>;
  fadeRenderer: MutableRef<WebGLFadeRenderer | null>;
  scanlineRenderer: MutableRef<WebGLScanlineRenderer | null>;
  // World
  stitchedWorld: MutableRef<StitchedWorldData | null>;
  worldManager: MutableRef<WorldManager | null>;
  worldSnapshot: MutableRef<WorldSnapshot | null>;
  worldBounds: MutableRef<WorldBoundsRect>;
  // Player
  player: MutableRef<PlayerController | null>;
  playerLoaded: MutableRef<boolean>;
  playerHidden: MutableRef<boolean>;
  // ... etc
}

export function useOverworldRefs(): OverworldRefs;
```

This doesn't change behavior — just groups declarations. But it cuts 40+ lines
of individual `useRef` calls down to a single destructure and makes the context
bag for extracted functions clean.

---

### 8. Overworld state hook (~80 lines saved)

**Lines 606–700** — Debug state, map selection state, loading state, etc.

Group into `src/pages/gamePage/useOverworldState.ts`:

```typescript
export function useOverworldState(defaultMap: MapIndexEntry | undefined) {
  // All useState declarations for map selection, debug, stats, etc.
  return { selectedMapId, setSelectedMapId, stats, setStats, ... };
}
```

---

### 9. Shared utility: setMapMetatileAndInvalidate (~30 lines saved)

The pattern `setMapMetatileLocal(mapId, x, y, id, collision) → if changed → invalidate()`
appears **7 times** as an inline wrapper. Extract once:

```typescript
// In src/pages/gamePage/mapMetatileUtils.ts
export function createMetatileUpdater(
  setMapMetatileLocal: SetMapMetatileLocalFn,
  pipelineRef: MutableRef<WebGLRenderPipeline | null>
): SetMapMetatileFn {
  return (mapId, tileX, tileY, metatileId, collision?) => {
    const changed = setMapMetatileLocal(mapId, tileX, tileY, metatileId, collision);
    if (changed) pipelineRef.current?.invalidate();
    return changed;
  };
}
```

All 7 call sites collapse to `setMapMetatileAndInvalidate(mapId, x, y, id)`.

---

### 10. Shared utility: delayed input unlock (~15 lines saved)

The pattern appears **4 times**:
```typescript
setTimeout(() => {
  if (!warpingRef.current && !storyScriptRunningRef.current && !dialogIsOpenRef.current) {
    player.unlockInput();
  }
}, FADE_TIMING.DEFAULT_DURATION_MS);
```

Extract to:
```typescript
export function scheduleInputUnlock(
  player: PlayerController,
  guards: InputUnlockGuards,
  delayMs: number
): void;
```

---

## Estimated Impact

| # | Extraction | Lines cut | New file |
|---|-----------|-----------|----------|
| 1 | ScriptRuntimeServices factory | ~420 | `createScriptRuntimeServices.ts` |
| 1a| Deoxys rock movement | (included above) | `src/game/legendary/deoxysRockMovement.ts` |
| 2 | Overworld game update | ~600 | `overworldGameUpdate.ts` |
| 3 | Sprite rendering section | ~200 | `renderOverworldSprites.ts` |
| 4 | Story parity | ~80 | `storyParity.ts` |
| 5 | NPC movement providers | ~60 | `npcMovementProviders.ts` |
| 6 | Debug tile grid | ~70 | `useDebugTileGrid.ts` |
| 7 | Ref bundling | ~100 | `useOverworldRefs.ts` |
| 8 | State hook | ~80 | `useOverworldState.ts` |
| 9 | Metatile+invalidate helper | ~30 | `mapMetatileUtils.ts` |
| 10| Input unlock guard | ~15 | (in mapMetatileUtils or shared) |
| | **Total** | **~1,735** | |

**Projected result**: 3,483 − 1,735 = **~1,748 lines** (under 1,800 target)

---

## Implementation Order

Ordered by risk (safest first) and dependency:

1. **Utilities first** (#9, #10) — Pure functions, zero risk, unblock later steps
2. **Story parity** (#4) — Self-contained, easy to test via intro state
3. **NPC movement providers** (#5) — Self-contained factory
4. **Debug tile grid** (#6) — Isolated useEffect
5. **ScriptRuntimeServices** (#1, #1a) — Large but mechanical; just moving code
6. **Ref bundling** (#7) — Refactoring aid, simplifies #2
7. **State hook** (#8) — Refactoring aid, simplifies #2
8. **Overworld game update** (#2) — The big one; depends on #7 for clean API
9. **Sprite rendering** (#3) — Depends on #2 for context structure

Steps 1–4 can be done as independent PRs. Steps 5–9 should be one coordinated PR.

---

## Duplicated Code to Eliminate

### ON_FRAME evaluation (runs twice)

**Pre-input** (lines 2106–2171) and **post-move** (lines 2386–2431) both do:
```
for each onFrame entry:
  if var matches value and not suppressed:
    suppress and run script
```

Consolidate into `evaluateOnFrameScripts(ctx, mapId, cachedData)` called
from both sites with a `preInputTriggered` flag.

### Location state building (appears twice)

`buildLocationStateFromPlayer` (line 830) and `getLocationState` (line 3286)
build nearly identical `LocationState` objects. Consolidate into one.

### Map script cache loading (appears twice)

Lines 2118–2124 and 2402–2408 both load map scripts with identical
cache-check logic. Extract to `ensureMapScriptsCached(mapId, cache, loadingSet)`.

---

## What Stays in GamePage.tsx

After extraction, GamePage.tsx retains:

1. **GamePage wrapper** (~70 lines) — DialogProvider, state manager init
2. **GamePageContent component** (~100 lines) — Hook wiring, ref/state setup
3. **WebGL init useEffect** (~80 lines) — Pipeline/player creation, cleanup
4. **Render loop shell** (~60 lines) — rAF wrapper calling extracted update/render
5. **Map load useEffect** (~70 lines) — Calling loadSelectedOverworldMap
6. **Smaller useEffects** (~50 lines) — Viewport update, overworld entry, etc.
7. **JSX return** (~130 lines) — Canvas, debug panel, footer

**Total**: ~560 lines of component orchestration + ~130 lines of JSX = **~1,750 lines**
(accounting for imports, types, and minor glue code).

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Stale closure bugs from ref passing | All extracted functions take refs (not values). Same pattern as existing `performWarpTransition.ts`. |
| Render loop performance regression | The extraction is mechanical code movement. No new allocations in the hot path. Context object is created once, not per frame. |
| Large PR size | Split into 2-3 PRs: utilities + small extractions, then ScriptRuntimeServices, then render loop. |
| TypeScript type complexity | Define `OverworldRefs` and `OverworldUpdateContext` interfaces upfront. Existing extracted modules already use this pattern. |
