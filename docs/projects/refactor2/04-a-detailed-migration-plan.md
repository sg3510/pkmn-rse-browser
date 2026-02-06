---
title: Phase 4a: Detailed Migration Plan
status: planned
last_verified: 2026-01-13
---

# Phase 4a: Detailed Migration Plan

## Overview

This document provides a detailed, step-by-step plan for migrating MapRenderer.tsx from 3,684 lines to ~200 lines without breaking functionality.

**Current state:** 3,684 lines
**Target state:** ~200 lines (thin orchestrator)

---

## Current MapRenderer.tsx Structure

### 1. Helper Functions (Outside Component) - Lines 53-627

| Function | Lines | Purpose | Migration Target |
|----------|-------|---------|-----------------|
| `isDebugMode()` | 53-55 | Check debug flag | Keep (tiny) |
| `shiftWorld()` | 183-216 | Shift world coordinates | `src/services/MapManager.ts` |
| `applyBehaviorOverrides()` | 337-341 | Override metatile behaviors | `src/utils/metatileBehaviors.ts` |
| `getDoorAssetForMetatile()` | 343-350 | Get door sprite path | `src/field/DoorSequencer.ts` |
| `logDoor()` | 352-357 | Debug logging | `src/field/DoorSequencer.ts` |
| `buildTileTransparencyLUT()` | 359-378 | Build tile masks | Already in `useMapAssets.ts` |
| `buildPaletteRgbLUT()` | 379-388 | Build palette lookup | Already in `useMapAssets.ts` |
| `isWaterColor()` | 390-409 | Detect water palette | Already in `useMapAssets.ts` |
| `isBlueDominantColor()` | 412-420 | Detect blue palette | Already in `useMapAssets.ts` |
| `buildPaletteWaterFlags()` | 422-424 | Build water flags | Already in `useMapAssets.ts` |
| `sampleTilePixel()` | 426-439 | Sample pixel from tile | Already in `useMapAssets.ts` |
| `applyWaterMaskToMetatile()` | 441-479 | Apply water mask | Already in `useMapAssets.ts` |
| `applyTileMaskToMetatile()` | 481-504 | Apply tile mask | Already in `useMapAssets.ts` |
| `buildReflectionMeta()` | 506-570 | Build reflection metadata | Already in `useMapAssets.ts` |
| `buildTilesetRuntime()` | 573-627 | Build tileset runtime | Already in `useMapAssets.ts` |

### 2. Component Refs (Lines 628-700)

~75 refs total. Most should be encapsulated in:
- Game engine state
- Rendering state
- Field effects state

### 3. Small useEffects (Lines 1000-1072)

| Effect | Purpose | Migration |
|--------|---------|-----------|
| Debug flag sync | Sync debug state to window | Keep (small) |
| PlayerController init | Create player controller | Move to `useGameEngine` |
| Debug options sync | Sync debug options ref | Keep (small) |
| Layer decomposition | Update debug layer view | Keep in debug system |

### 4. Rendering Helper Functions (Lines 1074-2500)

| Function | Lines | Purpose | Migration Target |
|----------|-------|---------|-----------------|
| `copyTile()` | 1074-1165 | Copy tile between canvases | `src/rendering/TileRenderer.ts` |
| `ensureAuxiliaryCanvases()` | 1191-1208 | Create offscreen canvases | `src/rendering/RenderPipeline.ts` |
| `loadIndexedFrame()` | 1210-1275 | Load animation frame | `src/hooks/map/useMapAssets.ts` |
| `computeAnimatedTileIds()` | 1278-1305 | Track animated tiles | `src/hooks/map/useMapAssets.ts` |
| `drawTileToImageData()` | 1355-1390 | Draw tile to ImageData | `src/rendering/TileRenderer.ts` |
| `drawTileToCanvas()` | 1394-1530 | Draw tile to canvas | Already in `TileRenderer.ts` |
| Various render passes | 1530-2500 | Render scene layers | Already in `PassRenderer.ts` |

### 5. Main Game Loop useEffect (Lines 2506-3680)

This is the core of MapRenderer. It contains:

| Section | Lines (approx) | Purpose | Migration Target |
|---------|----------------|---------|-----------------|
| Asset loading | 2509-2575 | Load world, sprites | `useMapAssets` |
| Player setup | 2576-2670 | Init player controller | New `usePlayerController` hook |
| Warp state init | 2669-2675 | Init warp handler | Already done (WarpHandler) |
| Door sequences | 2676-2920 | Door entry/exit logic | `DoorSequencer` (exists) |
| Game loop setup | 3181-3440 | runUpdate, frame tick | `useGameEngine` |
| Render frame | 3446-3600 | Draw scene | `RenderPipeline` |
| Cleanup | 3670-3680 | Stop game loop | `useGameEngine` |

---

## Migration Strategy

### Principle: Incremental Extraction

1. **Extract one piece at a time**
2. **Keep old code until new code is verified**
3. **Use feature flags for A/B testing**
4. **Never delete code until replacement is proven**

---

## Step-by-Step Migration

### Step 1: Extract Helper Functions (LOW RISK)

These functions are pure and have no dependencies on React state.

**Files to modify:**
- Remove duplicate functions from MapRenderer.tsx that already exist in useMapAssets.ts

**Functions to remove from MapRenderer.tsx:**
```typescript
// These are already in useMapAssets.ts:
- buildTileTransparencyLUT  (duplicate)
- buildPaletteRgbLUT        (duplicate)
- isWaterColor              (duplicate)
- isBlueDominantColor       (duplicate)
- buildPaletteWaterFlags    (duplicate)
- sampleTilePixel           (duplicate)
- applyWaterMaskToMetatile  (duplicate)
- applyTileMaskToMetatile   (duplicate)
- buildReflectionMeta       (duplicate)
- buildTilesetRuntime       (duplicate)
```

**Verification:** Build passes, game works identically

---

### Step 2: Extract Door Warp Logic (MEDIUM RISK)

The DoorSequencer module exists but isn't integrated.

**Current state:**
- `doorEntry` and `doorExitRef` are local state in useEffect
- `startAutoDoorWarp()`, `advanceDoorEntry()`, `handleDoorWarp()` are inline functions

**Migration:**
1. Create `useDoorSequencer` hook that wraps DoorSequencer class
2. Hook provides: `startEntry()`, `update()`, `getDoorAnims()`, state
3. Replace inline door logic with hook calls

**New file: `src/hooks/useDoorSequencer.ts`**
```typescript
export function useDoorSequencer(warpHandler: WarpHandler) {
  const sequencerRef = useRef(new DoorSequencer());

  const startEntry = useCallback((trigger, player, direction) => {
    sequencerRef.current.startEntry(trigger, player, direction);
    warpHandler.setInProgress(true);
  }, [warpHandler]);

  const update = useCallback((deltaMs) => {
    return sequencerRef.current.update(deltaMs);
  }, []);

  return { startEntry, update, sequencer: sequencerRef.current };
}
```

**Verification:** Doors still animate correctly

---

### Step 3: Consolidate Rendering to RenderPipeline (MEDIUM RISK)

**Current state:**
- Multiple inline rendering functions
- Direct canvas manipulation
- Separate background/top layer refs

**Migration:**
1. RenderPipeline already exists and is initialized
2. Currently runs alongside old rendering code
3. Switch to use RenderPipeline.render() exclusively
4. Remove old `drawTileToImageData`, `drawTileToCanvas` duplicates

**Steps:**
1. Add feature flag: `USE_PIPELINE_RENDERING = true`
2. Replace render calls in `renderFrame()` to use pipeline
3. Verify rendering matches original
4. Remove old rendering code

---

### Step 4: Extract Game Loop (HIGH RISK)

**Current state:**
- `runUpdate()` function ~150 lines
- `frameTick()` function ~100 lines
- Animation timer, game state management inline

**Migration:**
1. The `useGameEngine` hook exists but isn't used
2. Create `GameEngine` class that encapsulates:
   - GameLoop
   - UpdateCoordinator
   - AnimationTimer
   - PlayerController reference
3. Hook provides: `start()`, `stop()`, `getState()`

**New architecture:**
```
MapRenderer
  └── useGameEngine(world, assets)
        └── GameEngine
              ├── GameLoop
              ├── UpdateCoordinator
              ├── AnimationTimer
              └── PlayerController
```

---

### Step 5: Extract Asset Loading (LOW RISK)

**Current state:**
- useMapAssets hook exists and is comprehensive
- MapRenderer loads some assets inline (grass sprites, etc.)

**Migration:**
1. Move all sprite loading to useMapAssets
2. useMapAssets returns: `{ world, assets, loading, error }`
3. Assets include: tilesets, sprites, animations

---

### Step 6: Create Thin MapRenderer (FINAL)

After all extractions, MapRenderer becomes:

```typescript
const MapRenderer = forwardRef<MapRendererHandle, MapRendererProps>((props, ref) => {
  // Load assets
  const { world, assets, loading, error } = useMapAssets(props);

  // Initialize game engine
  const { engine, state } = useGameEngine(world, assets);

  // Field effects
  const fade = useFadeController();
  const doors = useDoorSequencer();
  const warps = useWarpHandler();

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render loop
  useEffect(() => {
    if (!engine || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    engine.onFrame((state) => {
      renderPipeline.render(ctx, state);
    });

    return () => engine.stop();
  }, [engine]);

  // Imperative handle
  useImperativeHandle(ref, () => ({
    saveGame: () => engine?.save(),
    loadGame: () => engine?.load(),
    getPlayerPosition: () => engine?.getPlayerPosition(),
  }));

  if (loading) return <Loading />;
  if (error) return <Error error={error} />;

  return (
    <div className="map-renderer">
      <canvas ref={canvasRef} />
      <DebugPanel />
      <DialogBox />
    </div>
  );
});
```

---

## Risk Assessment

| Step | Risk | Reason | Mitigation |
|------|------|--------|------------|
| 1. Helper functions | Low | Pure functions, no state | Unit tests |
| 2. Door logic | Medium | Complex state machine | Feature flag, A/B test |
| 3. Rendering | Medium | Visual changes obvious | Screenshot comparison |
| 4. Game loop | High | Core functionality | Extensive testing |
| 5. Asset loading | Low | Already mostly done | Verify all assets load |
| 6. Thin component | Low | Just wiring | Final integration test |

---

## Recommended Order

1. **Step 1** - Remove duplicate helper functions (safe, reduces noise)
2. **Step 5** - Consolidate asset loading (already mostly done)
3. **Step 3** - Switch to RenderPipeline (visual verification easy)
4. **Step 2** - Extract door logic (complex but isolated)
5. **Step 4** - Extract game loop (highest risk, do last)
6. **Step 6** - Create thin component (final integration)

---

## Testing Checklist

Before each step, verify:
- [ ] Build passes
- [ ] No TypeScript errors
- [ ] Game loads without errors
- [ ] Player can move in all directions
- [ ] NPCs render and animate
- [ ] Doors animate and warp correctly
- [ ] Elevation rendering correct
- [ ] Reflections render
- [ ] Field effects work (grass, water, sand)
- [ ] Save/load works

---

## Rollback Strategy

Each step should be a separate commit. If issues found:
1. `git revert <commit>` - Revert single step
2. Feature flags - Disable new code path
3. Keep old code commented until verified

---

## Next Steps

1. Review this plan
2. Decide which step to start with
3. Create branch: `refactor/phase4-thin-component`
4. Implement step by step with verification
