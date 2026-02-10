# 02-08-26 `src/` Optimizations Investigation

## Status Snapshot (2026-02-08 15:36 EST)
- Overall status: **IMPLEMENTATION COMPLETE FOR THIS BACKLOG LIST**.
- `GamePage` size trend: `~2906` -> `1893` lines.
- Target status: **reached** (`< 2000` lines achieved).
- Runtime path status: `GamePage` is now the canonical route (`#/` and `#/play`).

## Scope
This investigation focused on runtime architecture, loading behavior, rendering backend decisions, hot paths, and code modularity across `src/`, with emphasis on the symptoms shown in `docs/backlog/02-08-26_console_optimise.txt`.

## Executive Summary
The main scalability blockers are architectural duplication and eager initialization:

1. `GamePage` is doing expensive WebGL + sprite + field initialization before `OVERWORLD`, which front-loads work and contributes to noisy logs.
2. Continue-game flow can initialize the world twice (default map then saved map) when the saved map differs from default.
3. There are currently three overlapping game/runtime stacks (`GamePage`, `GameRenderer`, `MapRenderer`/`MapRendererInit`), plus duplicated world/provider abstractions.
4. Tile resolution and render-context creation use repeated linear scans and per-frame object rebuilding in hot paths.
5. Logging is very heavy and mostly unguarded (including stack-trace logging in `setPosition`), obscuring real issues and adding runtime overhead.

## Verification Status
All 13 findings were verified against source code on 2026-02-08. All are substantially accurate. Minor corrections are noted inline with `[VERIFIED]` tags.

## Findings

### 1) Eager loading before state requires it (High) `[VERIFIED]`
Evidence:
- `src/pages/GamePage.tsx:1391` initializes pipeline/player/sprites in a mount effect (`[]`) regardless of game state.
- `src/pages/GamePage.tsx:1437-1612` loads player sprites, field sprites, item ball, and truck sprite immediately.
- `src/pages/GamePage.tsx:1618-1622` render loop itself is gated to `OVERWORLD`, but the expensive loading already happened.
- Log file confirms pre-overworld uploads: `docs/backlog/02-08-26_console_optimise.txt:14-51`.

Impact:
- Startup work happens in `TITLE_SCREEN`/`MAIN_MENU`, increasing time-to-interaction and memory pressure.
- In dev (`StrictMode`), this effect is mounted twice, producing duplicated load/upload logs.

Recommendation:
- Split bootstrap into two phases:
  - Phase A (`TITLE_SCREEN`/`MAIN_MENU`): only state-render loop assets.
  - Phase B (`OVERWORLD` entry): world manager, player sprites, field sprites, NPC sprites, pipeline uploads.
- Make initialization idempotent by state (not only by component mount).

---

### 2) Continue flow likely double-loads world (High) `[VERIFIED]`
Evidence:
- `selectedMapId` defaults to Littleroot: `src/pages/GamePage.tsx:527-528`.
- Continue handling may switch map afterward: `src/pages/GamePage.tsx:2436-2462`.
- Overworld map loader reacts to `selectedMap`: `src/pages/GamePage.tsx:2468+`.
- Console shows initialize for both maps in same transition window:
  - Littleroot init: `docs/backlog/02-08-26_console_optimise.txt:79-83`
  - Then truck init: `docs/backlog/02-08-26_console_optimise.txt:84-88`

Impact:
- Unnecessary world initialization, tileset work, and object/sprite churn.

Recommendation:
- Resolve continue location before first overworld initialize.
- Do not run initial world load until target map is finalized.

---

### 3) Over-broad initial map/object loading (High) `[VERIFIED]`
> **Note:** Processing all loaded maps' object events is expected behavior for the BFS-loaded snapshot. `LOAD_DEPTH=3` is the real tuning knob for controlling breadth.

Evidence:
- Default load depth is `3`: `src/game/WorldManager.ts:56`.
- Initialization BFS loads connected maps immediately: `src/game/WorldManager.ts:217`, `src/game/WorldManager.ts:589+`.
- Object events are parsed for **all snapshot maps** and NPC graphics loaded from all of them:
  - `src/pages/GamePage.tsx:1145-1166`.
- Log shows multi-map loading shortly after overworld entry:
  - `docs/backlog/02-08-26_console_optimise.txt:95-125`.

Impact:
- Sprites/maps are loaded earlier than needed for current viewport/player position.

Recommendation:
- Lower initial world depth and load on-demand by camera/player distance.
- Load NPC graphics by visibility window, not entire snapshot.

---

### 4) Hot-path inefficiencies in render/update loop (High) `[VERIFIED]`
Evidence:
- `worldManager.update(...)` is called every frame and not awaited: `src/pages/GamePage.tsx:1708`.
- `createRenderContextFromSnapshot` rebuilds map objects (`maps.map(...)`) each call:
  - implementation `src/game/snapshotUtils.ts:254-307`.
- It is called multiple times per frame in `GamePage` (`src/pages/GamePage.tsx:1807`, `src/pages/GamePage.tsx:1824`).
- 2D context fetched each frame: `src/pages/GamePage.tsx:1633`.
- Debug info updates every ~500ms regardless of debug mode: `src/pages/GamePage.tsx:1781-1802`.

Impact:
- Extra allocations, repeated linear work, avoidable main-thread overhead.

Recommendation:
- Only call world update on tile change / direction change (or fixed tick), not every RAF.
- Cache `RenderContext` per snapshot version.
- Cache `ctx2d` once on canvas init.
- Gate debug info collection by debug flag.

---

### 5) Linear-scan tile/map resolution in frequently used code (Medium) `[VERIFIED — severity lowered]`
> **Correction:** The linear scans happen at **resolver creation time** (per snapshot change), not per-frame tile queries. Once built, the resolver closures capture resolved data. This is still suboptimal but less severe than "many times per frame" as originally stated.

Evidence:
- Snapshot tile resolver loops all maps per query: `src/game/TileResolverFactory.ts:93-150`.
- Border fallback does another full map scan for nearest map: `src/game/TileResolverFactory.ts:158-190`.
- Player resolver also loops all maps: `src/game/TileResolverFactory.ts:273-305`.
- Canvas path resolver uses `.find(...)` across maps: `src/components/map/utils.ts:39-46`.
- Reflection meta lookup scans maps too: `src/game/snapshotUtils.ts:163-203`.

Impact:
- Cost grows with loaded map count; these scans run at resolver creation time (per snapshot change), not per-frame.

Recommendation:
- Introduce spatial index (grid/hash or interval index) per snapshot for O(1)/near-O(1) map lookup.
- Reuse a single indexed resolver for tile, player, and reflection lookups.

---

### 6) Runtime stack duplication / architectural drift (High) `[VERIFIED]`
Evidence:
- Active default route: `GamePage` (`src/main.tsx:55`).
- Alternative WIP stack: `GameRenderer` (`src/main.tsx:45-50`).
- Legacy stack: `LegacyCanvasPage` -> `MapRenderer` (`src/main.tsx:30-31`, `src/pages/LegacyCanvasPage.tsx:12`).
- Overlapping logic appears in multiple stacks:
  - `new WorldManager()` in `GamePage` and `GameRenderer` (`src/pages/GamePage.tsx:2496`, `src/components/GameRenderer.tsx:218`)
  - duplicate player sprite load blocks (`src/pages/GamePage.tsx:1439+`, `src/components/GameRenderer.tsx:288+`, `src/components/MapRendererInit.ts:288+`)
  - duplicate field sprite load (`src/pages/GamePage.tsx:1567`, `src/components/GameRenderer.tsx:310`, `src/components/MapRendererInit.ts:294`)
  - duplicate spawn/collision setup (`src/pages/GamePage.tsx:2564`, `src/components/GameRenderer.tsx:276`, `src/components/MapRendererInit.ts:338`)

Impact:
- Bug fixes must be repeated in multiple paths, increasing divergence and regression risk.

Recommendation:
- Consolidate to one runtime path.
- Move shared boot/update/warp/sprite-load steps into a single orchestration module consumed by all routes.

---

### 7) Duplicate world abstraction layers with unclear ownership (Medium-High) `[VERIFIED]`
> **Note:** `MapManagerAdapter.ts` and `WorldManagerAdapter.ts` are dead code — never imported at runtime.

Evidence:
- `MapManager` and `WorldManager` both load map layouts, borders, events, tilesets, palettes with overlapping logic:
  - `src/services/MapManager.ts:85-159`
  - `src/game/WorldManager.ts:662-739`
- Provider/adapters exist but are not wired into app runtime:
  - `src/services/MapManagerAdapter.ts`
  - `src/services/WorldManagerAdapter.ts`
  - no runtime usage found via repo search.
- Duplicate interface models:
  - `src/services/IWorldProvider.ts`
  - `src/game/types/IWorldState.ts`

Impact:
- Large maintenance surface and conceptual fragmentation.

Recommendation:
- Create one canonical world-domain API and remove/retire duplicate interfaces/adapters not used by runtime.

---

### 8) Repeated animation loading implementations (Medium) `[VERIFIED]`
> **Note:** The `useMapAssets.ts` variant has slightly different unpacking logic, but all three are near-identical `loadIndexedFrame()` implementations.

Evidence:
- Similar indexed PNG animation frame loading exists in:
  - `src/game/WorldManager.ts:907-975`
  - `src/hooks/useTilesetAnimations.ts:33-105`
  - `src/hooks/map/useMapAssets.ts:49-98`

Impact:
- Inconsistent behavior and duplicated bug surface.

Recommendation:
- Centralize tileset animation frame loading/decoding in one module and share it.

---

### 9) Asset/transparency handling partly centralized but still fragmented (Medium) `[VERIFIED]`
Evidence:
- Central cache utilities in `src/utils/assetLoader.ts` (good).
- Additional separate cache + dataURL conversion in `src/utils/transparentSprite.ts`.
- Hook-local sprite refs in `src/hooks/useFieldSprites.ts`.

Impact:
- Multiple cache layers with different object lifetimes; harder memory control and consistency.

Recommendation:
- Standardize around one asset API for image/canvas/transparency variants and one cache ownership model.

---

### 10) WebGL + Canvas composition strategy is heavy and tightly coupled (Medium) `[VERIFIED]`
Evidence:
- `compositeWebGLFrame` repeatedly renders WebGL batches and blits to 2D canvas:
  - `src/rendering/compositeWebGLFrame.ts:145-166`, `:206`, `:212`, `:222`, `:229`, `:250`, `:259`, `:266`.
- `GamePage` uses this hybrid path each frame.

Impact:
- Additional copy/composite overhead; complex ordering logic duplicated across runtime variants.

Recommendation:
- Keep hybrid path if required for compatibility/UI, but encapsulate it behind one compositor contract and avoid per-route reimplementation.

---

### 11) Renderer policy is inconsistent across modules (Medium) `[VERIFIED]`
Evidence:
- Config defaults disable WebGL (`enableWebGL: false`, `forceCanvas2D: true`): `src/config/rendering.ts:45-48`.
- `GamePage` directly creates `WebGLRenderPipeline` and routes to legacy only if unsupported:
  - `src/pages/GamePage.tsx:1406-1428`.
- `GameRenderer` has Canvas fallback but explicitly states incomplete implementation:
  - `src/components/GameRenderer.tsx:556`.

Impact:
- Hard to reason about intended production path; split behavior between routes.

Recommendation:
- Define one authoritative rendering policy and enforce it in all entry paths.

---

### 12) Logging volume and debug noise are excessive (High) `[VERIFIED]`
Evidence:
- `console.*` calls in `src`: 350.
- Top files:
  - `src/pages/GamePage.tsx` (48),
  - `src/game/PlayerController.ts` (42),
  - `src/game/WorldManager.ts` (24).
- `PlayerController.setPosition` logs stack traces on every call:
  - `src/game/PlayerController.ts:521-529`.
- State transitions/logs appear doubled in console file due strict-mode dev remount:
  - `docs/backlog/02-08-26_console_optimise.txt:3-7`, `:40-51`.

Impact:
- Performance overhead and poor signal-to-noise for real issues.

Recommendation:
- Introduce structured logger with levels + feature flags.
- Remove unconditional stack-trace logging from hot game methods.

---

### 13) `GamePage` is a monolith and mixes unrelated responsibilities (High) `[VERIFIED]`
Evidence:
- `src/pages/GamePage.tsx` is ~2828 lines.
- It currently mixes:
  - state machine integration (`src/pages/GamePage.tsx:238+`)
  - world bootstrap/load (`src/pages/GamePage.tsx:2468+`)
  - render loop (`src/pages/GamePage.tsx:1617+`)
  - warp orchestration (`src/pages/GamePage.tsx:1243+`, `:1868+`)
  - story-script logic and parity patches (`src/pages/GamePage.tsx:594+`, `:689+`)
  - debug UI/state and instrumentation (`src/pages/GamePage.tsx:548+`, `:2283+`)

Impact:
- High coupling, difficult testing, frequent regressions when changing one subsystem.

Recommendation:
- Split into feature modules:
  - `runtime/overworldBootstrap`
  - `runtime/frameUpdate`
  - `runtime/warpController`
  - `runtime/storyBridge`
  - `runtime/debugBridge`

## Optimization Checklist (Updated 2026-02-08 15:36 EST)

### P0
• ■ Gate overworld asset/world initialization by `OVERWORLD` state only.  
Implemented via deferred `ensureOverworldRuntimeAssets` execution + overworld readiness gating.

• ■ Fix continue flow to resolve saved map before first initialize.  
Implemented via continue-location orchestration hook and deferred map load until saved location is consumed.

• ■ Remove/guard hot-path debug logs and introduce structured logger levels/flags.  
Implemented via shared logger (`src/utils/logger.ts`) and logger integration in core hotspots (`GamePage`, `WorldManager`, `PlayerController`).

• ■ Cache `ctx2d` and `RenderContext` per snapshot; stop rebuilding per frame where possible.  
Implemented via cached display context + snapshot-keyed render context cache.

• ■ Run expensive debug collection only when debug panel is enabled.  
Implemented via debug flag gating around world/debug polling.

### P1
• ■ Define one runtime path as source of truth.  
Implemented by routing both `#/` and `#/play` to `GamePage` in `src/main.tsx`.

• ■ Extract shared boot/update/load/warp pipelines into reusable modules.  
Implemented across `src/pages/gamePage/*` helpers/hooks and `src/game/loadObjectEventsFromSnapshot.ts`.

• ■ Consolidate world abstractions/interfaces and retire unused adapter layers.  
Implemented by removing dead adapter/interface layer files: `src/services/MapManagerAdapter.ts`, `src/services/WorldManagerAdapter.ts`, `src/services/IWorldProvider.ts`.

• ■ Centralize tileset animation frame loading/decoding into one implementation.  
Implemented via `src/game/loadTilesetAnimations.ts`, reused by `WorldManager`, `useTilesetAnimations`, and `useMapAssets`.

### P2
• ■ Add map spatial index for tile/reflection/player resolution.  
Implemented via `src/game/snapshotSpatialIndex.ts`, wired into `TileResolverFactory`, snapshot reflection lookup, and render-context tile lookup acceleration.

• ■ Move world updates to tile-change/fixed-step scheduling instead of every RAF.  
Implemented by updating world only when tile/facing changes in the active runtime loop.

• ■ Narrow initial load breadth/radius and NPC sprite preloads to visible/nearby scope.  
Implemented by reducing `WorldManager` load depth (`LOAD_DEPTH = 2`) and limiting NPC sprite preloads to anchor + neighboring maps.

### Remaining
• □ Remaining checklist items: none.

### Key Files Updated
• `src/pages/GamePage.tsx`
• `src/main.tsx`
• `src/game/WorldManager.ts`
• `src/game/TileResolverFactory.ts`
• `src/game/snapshotUtils.ts`
• `src/game/snapshotSpatialIndex.ts`
• `src/game/loadTilesetAnimations.ts`
• `src/game/loadObjectEventsFromSnapshot.ts`
• `src/game/PlayerController.ts`
• `src/components/map/utils.ts`
• `src/components/GameRenderer.tsx`
• `src/hooks/useTilesetAnimations.ts`
• `src/hooks/map/useMapAssets.ts`
• `src/pages/gamePage/overworldAssets.ts`
• `src/pages/gamePage/buildWebGLDebugState.ts`
• `src/pages/gamePage/buildDebugState.ts`
• `src/pages/gamePage/buildPriorityDebugInfo.ts`
• `src/pages/gamePage/useStateMachineRenderLoop.ts`
• `src/pages/gamePage/useOverworldContinueLocation.ts`
• `src/pages/gamePage/performWarpTransition.ts`
• `src/pages/gamePage/loadSelectedOverworldMap.ts`
• `src/pages/gamePage/useHandledStoryScript.ts`
• `src/utils/logger.ts`

## Notes
- Some duplicate log patterns in the provided console file are expected in React dev `StrictMode`; that does not remove the underlying architecture/performance issues, but it inflates the visible symptom set in development.
- This document now includes both investigation findings and implementation progress tracking.
