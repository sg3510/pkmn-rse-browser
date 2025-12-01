# Architecture Parity & De-duplication (Canvas2D ⇄ WebGL)

This document analyzes the architectural differences between the legacy Canvas2D renderer (`MapRenderer.tsx`) and the new WebGL renderer (`WebGLMapPage.tsx`). It identifies shared components, duplication, and a roadmap for unification.

## 1. Architecture Overview

| Feature | Canvas2D (`MapRenderer`) | WebGL (`WebGLMapPage`) | Shared Component (Goal) |
| :--- | :--- | :--- | :--- |
| **Entry Point** | `MapRenderer.tsx` (React Component) | `WebGLMapPage.tsx` (React Component) | `GameContainer.tsx` (Future) |
| **Game Loop** | `useRunUpdate` + `useCompositeScene` | Custom `requestAnimationFrame` loop | `useUnifiedGameLoop` |
| **World State** | `MapManager` + `RenderContext` | `WorldManager` + `WorldSnapshot` | `WorldManager` |
| **Tile Resolution** | `MapManager.resolveTileAt` (Direct) | `TileResolverFactory` (via Snapshot) | `ITileResolver` |
| **Rendering** | `RenderPipeline` (Canvas 2D API) | `WebGLRenderPipeline` (WebGL2 API) | `IRenderPipeline` |
| **Sprites** | `ObjectRenderer.ts` (Canvas 2D) | Hybrid (Canvas 2D overlay) | `ISpriteRenderer` (Unified) |
| **Animations** | `useTilesetAnimations` (Hook) | `WebGLAnimationManager` (Texture updates) | `TilesetAnimator` (Logic only) |
| **Reflections** | `ReflectionRenderer` + `ctx` | `ReflectionRenderer` + `Snapshot` | `ReflectionRenderer` (Shared) |
| **Warps** | `useWarpExecution` + `WarpHandler` | `executeWarp` + `WarpHandler` | `WarpSystem` (Unified) |

## 2. Shared Components (Already Working)

These components are successfully reused across both pipelines. **Do not duplicate logic here.**

*   **`src/game/PlayerController.ts`**: Handles physics, movement, input, and sprite state.
*   **`src/game/CameraController.ts`**: Manages camera bounds and target following.
*   **`src/field/WarpHandler.ts`**: Manages warp state (cooldowns, in-progress flags).
*   **`src/field/ReflectionRenderer.ts`**: Core reflection math (`computeReflectionState`, `buildReflectionMask`) and GBA shimmer logic (`applyGbaAffineShimmer`).
*   **`src/game/WarpExecutor.ts`**: Shared implementation of warp logic (`executeWarp`), handling spawn positions, facings, and door sequences.
*   **`src/components/map/utils.ts`**: `detectWarpTrigger` is used by both to find warp events.

## 3. Divergence & Refactoring Targets

### A. World Management (The "Source of Truth")
*   **Current:** Canvas2D uses `MapManager` which loads maps on demand and builds a `RenderContext`. WebGL uses `WorldManager` which proactively manages a "stitched world" and produces `WorldSnapshot`s.
*   **Problem:** `MapManager` logic for border handling and neighbor connection is duplicated/diverged in `WorldManager`.
*   **Solution:** `WorldManager` should become the single source of truth. `MapRenderer` (Canvas2D) should eventually consume `WorldSnapshot`s instead of building its own context.
    *   **Refactor:** Create `TileResolverFactory.fromSnapshot` (Done). Make Canvas2D use this resolver instead of `resolveTileAt`.

### B. Tile Resolution
*   **Current:**
    *   Canvas2D: `resolveTileAt` (in `src/components/map/utils.ts`) manually checks neighbors and borders.
    *   WebGL: `TileResolverFactory` (in `src/game/TileResolverFactory.ts`) implements similar logic but optimized for GPU slots and Snapshots.
*   **Problem:** Divergent border handling behavior.
*   **Solution:** Consolidate around `ITileResolver` interface.
    ```typescript
    interface ITileResolver {
      resolve(x: number, y: number): ResolvedTile | null;
      getReflectionMeta(x: number, y: number): ReflectionMetaResult | null;
    }
    ```
    `TileResolverFactory` becomes the implementation.

### C. Animation Loops
*   **Current:**
    *   Canvas2D: `useTilesetAnimations` hook parses configs and tracks frames.
    *   WebGL: `WebGLAnimationManager` parses configs and tracks frames *separately*.
*   **Problem:** Double parsing, potential timing drift.
*   **Solution:** Extract `AnimationStateTracker`.
    *   Input: `timestamp`.
    *   Output: `Map<TileID, FrameID>`.
    *   Both renderers consume this state. Canvas updates its cache; WebGL updates its textures.

### D. Game Loop Integration
*   **Current:** `WebGLMapPage` implements a "naked" game loop inside a `useEffect`. `MapRenderer` uses the complex `useRunUpdate` hook which mixes React state with game logic.
*   **Solution:** `useUnifiedGameLoop`.
    *   The loop in `WebGLMapPage` is cleaner and closer to the desired end-state (decoupled from React render cycle).
    *   We should move the `WebGLMapPage` loop logic into `useUnifiedGameLoop` and have both renderers use it.

## 4. Renderer-Specific Logic (Keep Separate)

Some things *should* remain separate implementations of a shared interface.

*   **Resource Management:**
    *   **WebGL:** `WebGLTextureManager` (GPU uploads, VRAM management, Texture Units).
    *   **Canvas:** `TilesetCanvasCache` (Offscreen canvases, caching).
*   **Drawing:**
    *   **WebGL:** `gl.drawArraysInstanced`, Shader programs.
    *   **Canvas:** `ctx.drawImage`, dirty rectangle tracking (`DirtyRegionTracker`).
*   **Field Effects (Rendering):**
    *   The *state* of field effects (grass, ash) is shared.
    *   The *rendering* must be specific (Sprite batching for WebGL vs individual draws for Canvas).

## 5. Implementation Roadmap

### Phase 1: WebGL Sprite Renderer (In Progress)
Implement `WebGLSpriteRenderer` to handle players, NPCs, and field effects. This removes the hybrid Canvas2D overlay from `WebGLMapPage`.

### Phase 2: Unified Tile Resolver
Refactor `MapRenderer` (Canvas2D) to accept a `TileResolver` instead of a `RenderContext`. This allows us to plug in `TileResolverFactory` logic, unifying border/warp detection behavior.

### Phase 3: Shared Animation State
Extract animation timing logic from `useTilesetAnimations` and `WebGLAnimationManager` into a shared class.

### Phase 4: Game Loop Unification
Extract the robust loop from `WebGLMapPage` into `useUnifiedGameLoop`. Update `MapRenderer` to use this loop (stripping out `useRunUpdate`).

## 6. Code Parity Checklist

| Logic | Implementation | Status |
| :--- | :--- | :--- |
| **Warp Detection** | `detectWarpTrigger` | ✅ Shared |
| **Warp Execution** | `executeWarp` | ✅ Shared |
| **Reflection Math** | `ReflectionRenderer` | ✅ Shared |
| **Shimmer Effect** | `ReflectionShimmer` | ✅ Shared |
| **Door Sequences** | `DoorActionDispatcher` | ✅ Shared |
| **Tile Lookup** | `TileResolverFactory` vs `resolveTileAt` | ⚠️ Divergent |
| **Anim Timing** | `WebGLAnimationManager` vs `useTilesetAnimations` | ⚠️ Divergent |
| **Map Loading** | `WorldManager` vs `MapManager` | ⚠️ Divergent |

## 7. New Module Recommendations

1.  **`src/game/AnimationSystem.ts`**: Pure logic class for tileset animations.
2.  **`src/game/WorldQuery.ts`**: Unified interface for querying the world (tiles, objects, warps) regardless of backend.
3.  **`src/rendering/ISpriteRenderer.ts`**: Strict interface for sprite rendering (Canvas2D wrapper vs WebGL implementation).