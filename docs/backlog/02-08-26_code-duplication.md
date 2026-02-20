---
title: "Code Duplication Patterns (#14–#34)"
status: verified
last_verified: 2026-02-20
---

# Code Duplication Patterns (#14–#34)

Addendum to [`02-08-26_optimisations.md`](./02-08-26_optimisations.md). A cross-cutting scan of `src/` revealed 15 duplication patterns — copy-pasted constants, duplicated type definitions, repeated utility functions, and dead code — that are distinct from the 13 runtime/architecture findings in the original doc. Numbering continues from #13.

## Status Snapshot
- Last updated: 2026-02-20
- Tracking: implementation progress for #14-#34
- Legend: `• ■` done, `• □` not done/partial

## Implementation Checklist
• ■ #14 Shared debug utility implemented (`src/utils/debug.ts`) and local `isDebugMode()` copies removed/migrated.
• ■ #15 Shared timing constants implemented (`src/config/timing.ts`) and duplicated `GBA_FRAME_MS` / `1000 / 60` literals consolidated.
• ■ #16 `METATILE_SIZE` literal duplication removed; modules now import canonical map-loader constant.
• □ #17 `resolveMetatileIndex()` added and applied to key hot paths, but not yet migrated in every remaining file.
• □ #18 `ResolvedTile` consolidation is partial (canonical type now reused in more places, but specialized variants still remain).
• ■ #19 `RenderContext` consolidation completed for map/hooks path (shared canonical rendering type now re-exported and reused).
• ■ #20 `WarpKind` duplication removed (`src/components/map/types.ts` now re-exports from `src/field/types.ts`).
• ■ #21 `resolveTileAt()` duplication removed (`src/hooks/map/useMapLogic.ts` now reuses canonical resolver).
• □ #22 `TileResolver` signatures are still not fully unified across player/rendering/backing-store layers.
• □ #23 Camera view computation/types are still split between utility and rendering modules.
• ■ #24 Shared direction utility added (`src/utils/direction.ts`) and wired into player/NPC/field direction math.
• □ #25 Dead code cleanup is partial (adapter layer removed earlier; remaining legacy type-contract files still exist).
• □ #26 Canvas helper added (`src/utils/canvasHelper.ts`) and adopted in shared asset loader, but not fully rolled out to all call sites.
• □ #27 NPC sprite cache still uses custom cache wrapper rather than the generic async cache abstraction.
• ■ #28 Elevation compatibility logic centralized (`src/utils/elevation.ts`) and used by both player + NPC collision paths.
• ■ #29 Typed async menu gateway implemented in `src/menu/MenuStateManager.ts` with shared `openAsync()`/`resolveAsync()` call pattern across field, battle, evolution, and script specials.
• ■ #30 Move-learning prompt adapter centralized (`src/pokemon/moveLearningPromptAdapter.ts`) and reused by battle, evolution, and script relearner flow.
• ■ #31 Legacy duplicate party/summary components removed (`src/menu/components/PartyMenu.tsx`, `src/menu/components/PokemonSummary.tsx`) after reference cleanup.
• ■ #32 Shared location-state + display-name helpers introduced (`src/world/locationStateFactory.ts`, `src/pokemon/displayName.ts`) and wired into runtime call sites.
• ■ #33 Prompt text wrapping/pagination primitives centralized under `src/core/prompt/textLayout.ts` and reused by both battle textbox rendering and dialog pagination.
• □ #34 Overworld `DialogContext` internals still run their own reducer path and are not yet fully migrated onto `src/core/prompt/PromptService.ts`.

## P0: Quick Wins (constants, debug utils, type dedup)

### 14) `isDebugMode()` duplicated across 10+ files with 3 different flag names (High) `[VERIFIED]`
Evidence:
- Identical `isDebugMode()` function copy-pasted in 10 files, each reading a `window` flag via `(window as unknown as Record<string, boolean>)[FLAG]`.
- Three different flag names in use:
  - `'DEBUG_MODE'` — `src/game/FieldEffectManager.ts:14`, `src/game/PlayerController.ts:31`, `src/hooks/useWarpExecution.ts`, `src/hooks/useTilesetAnimations.ts`, `src/pages/GamePage.tsx:136`
  - `'PKMN_DEBUG_MODE'` — `src/components/map/utils.ts:33`
  - `'DEBUG_DOOR'` — `src/hooks/useDoorAnimations.ts`, `src/hooks/useArrowOverlay.ts`, `src/hooks/useCompositeScene.ts`, `src/hooks/useRunUpdate.ts`
- 116 total references to debug-related flags across the codebase.

Impact:
- Toggling debug mode requires knowing which flag name each module reads. Some modules silently ignore the "wrong" flag.

Recommendation:
- Create `src/utils/debug.ts` with a shared `isDebugMode(category?: string)` and `debugLog()`. Consolidate flag names into a single `'DEBUG_MODE'` window property (or a structured `window.__PKMN_DEBUG` object with per-category toggles).

---

### 15) `GBA_FRAME_MS` constant duplicated in 16 files (High) `[VERIFIED]`
Evidence:
- `const GBA_FRAME_MS = 1000 / 59.7275` defined independently in:
  - `src/pages/GamePage.tsx:133`, `src/pages/WebGLTestPage.tsx:105`, `src/hooks/useUnifiedGameLoop.ts:32`, `src/hooks/useGameLoop.ts:17`, `src/field/ReflectionShimmer.ts:25`, `src/states/TitleScreenState.ts:24`
- Additional `1000 / 60` variants (rounded) in:
  - `src/engine/GameLoop.ts:21`, `src/engine/AnimationTimer.ts:13`, `src/game/npc/NPCMovementEngine.ts:13`, `src/game/npc/NPCAnimationEngine.ts:130`, `src/game/FieldEffectManager.ts:18`, `src/game/surfing/SurfBlobRenderer.ts:26`, `src/data/spriteMetadata.ts:256`

Impact:
- Two different base rates (59.7275 Hz vs 60 Hz) are silently mixed, causing subtle timing drift between systems.

Recommendation:
- Create `src/config/timing.ts` exporting `GBA_FPS`, `GBA_FRAME_MS`, and a `ticksToMs()` helper. All files import from there. Decide on one canonical FPS value.

---

### 16) `METATILE_SIZE = 16` in 5+ files (Low)
Evidence:
- Canonical definition in `src/utils/mapLoader.ts`.
- Redefined locally in `src/pages/WebGLTestPage.tsx`, `src/rendering/ReflectionRenderer.ts`, `src/utils/spriteUtils.ts`, and player coordinate helpers.

Impact:
- Low risk (value is unlikely to change), but adds noise and makes grep-based audits harder.

Recommendation:
- Import from `mapLoader.ts` everywhere instead of redefining.

---

### 17) `SECONDARY_TILE_OFFSET` defined in 6 files, `isSecondary` pattern in 24 files (Medium) `[VERIFIED]`
Evidence:
- Canonical export in `src/utils/mapLoader.ts`.
- Redefined locally in `src/pages/WebGLTestPage.tsx:224` and others.
- The `isSecondary = tileIndex >= SECONDARY_TILE_OFFSET` check appears in 24 files including `src/game/snapshotUtils.ts`, `src/components/map/utils.ts`, `src/rendering/TileInstanceBuilder.ts`, `src/rendering/WebGLAnimationManager.ts`.

Impact:
- If the offset value or comparison semantics ever change, 24 files need updating.

Recommendation:
- Import `SECONDARY_TILE_OFFSET` from `mapLoader.ts` everywhere. Add a `resolveMetatileIndex(rawIndex): { index: number; isSecondary: boolean }` helper to eliminate the repeated comparison.

---

### 18) `ResolvedTile` interface — 5+ different versions (Medium-High) `[VERIFIED]`
Evidence:
- `ResolvedTile` in `src/rendering/types.ts:113` (8 fields, canonical)
- `ResolvedTile` in `src/components/map/types.ts:44` (6 fields, missing `isSecondary`/`isBorder`)
- `ResolvedTile` in `src/hooks/map/useMapLogic.ts:10` (7 fields, missing `tilesetPairIndex`)
- `ResolvedTileData` in `src/rendering/MapBackingStore.ts:30` (flattened structure)
- `ResolvedTileForBuffer` in `src/rendering/ViewportBuffer.ts:17` (buffer-specific variant)
- `ResolvedTileInfo` in `src/game/PlayerController.ts:37` (2-field subset)

Impact:
- Type mismatches across module boundaries; easy to pass wrong variant without compiler catching it.

Recommendation:
- Keep `rendering/types.ts` as canonical `ResolvedTile`. Other modules import from there and use `Pick<>` or extend for specialized variants. Remove duplicate definitions.

---

### 19) `RenderContext` interface — 4 versions (Medium) `[VERIFIED]`
Evidence:
- `src/rendering/types.ts` (canonical, used by rendering pipeline)
- `src/components/map/types.ts` (near-identical copy)
- `src/hooks/map/useMapLogic.ts` (near-identical copy)
- `src/core/GameState.ts` (different shape, used by state machine)

Impact:
- Same as #18 — silent type drift between modules.

Recommendation:
- Keep canonical in `rendering/types.ts`. Rename GameState's version to `StateRenderContext` to avoid confusion. Others re-export.

---

### 20) `WarpKind` type — 2 identical definitions (Low)
Evidence:
- `src/components/map/types.ts`
- `src/field/types.ts`

Impact:
- Low — only two copies, but contributes to the general pattern of type fragmentation.

Recommendation:
- Define once in `src/field/types.ts` (domain home), re-export from `components/map/types.ts`.

---

## P1: Medium Effort (function dedup, dead code removal)

### 21) `resolveTileAt()` copy-pasted (~63 lines each) (Medium)
Evidence:
- Near-identical implementations in `src/components/map/utils.ts` and `src/hooks/map/useMapLogic.ts`.

Impact:
- Bug fixes must be applied twice; divergence risk.

Recommendation:
- Keep canonical in `src/components/map/utils.ts`, import from there in `useMapLogic.ts`.

---

### 22) `TileResolver` type — 3 incompatible versions (Medium)
Evidence:
- `src/game/PlayerController.ts` — `(wx: number, wy: number) => ResolvedTileInfo | null`
- `src/rendering/types.ts` — `(wx: number, wy: number) => ResolvedTile | null`
- `src/rendering/MapBackingStore.ts` — `(wx: number, wy: number) => ResolvedTileData | null`

Impact:
- Cannot share tile resolution logic across subsystems without adapter wrappers.

Recommendation:
- Unify after `ResolvedTile` consolidation (#18). A single `TileResolver` returning the canonical type, with consumers picking the fields they need.

---

### 23) `CameraView` — duplicate interface with extension (Medium)
Evidence:
- Base `CameraView` in `src/utils/camera.ts:4` with `computeCameraView()`.
- Extended `WorldCameraView` in `src/rendering/types.ts:45` that extends `CameraView`.
- Separate `buildWorldCameraView` in `src/game/buildWorldCameraView.ts` that imports from both.
- `computeCameraView()` is actively imported in `src/hooks/useRunUpdate.ts`.

Impact:
- Two entry points for camera view computation; unclear which to use for new code.

Recommendation:
- Consolidate into one module (`src/game/buildWorldCameraView.ts` or `src/utils/camera.ts`). Decide on one `CameraView` type and one builder function.

---

### 24) Direction conversion utilities scattered (Medium)
Evidence:
- Canonical direction helpers in `src/game/npc/NPCMovementEngine.ts`.
- Reimplemented in `src/pages/GamePage.tsx` and `src/game/PlayerController.ts`.

Impact:
- Inconsistent direction mappings between player and NPC systems.

Recommendation:
- Create `src/utils/direction.ts` with shared `directionToOffset()`, `offsetToDirection()`, and related helpers.

---

### 25) Dead code: unused interfaces, placeholder functions, Canvas2D fallback classes (Medium)
Evidence:
- `src/services/IWorldProvider.ts` and adapters (`MapManagerAdapter.ts`, `WorldManagerAdapter.ts`) — already removed per optimisation finding #7.
- `src/game/types/IWorldState.ts` — vestigial interface.
- Various placeholder/no-op functions flagged in earlier findings.

Impact:
- Increases cognitive load and maintenance surface.

Recommendation:
- Remove remaining dead interfaces. Canvas2D fallback removal is contingent on runtime consolidation (finding #6).

---

### 26) `document.createElement('canvas')` boilerplate — 33 occurrences across 20 files (Low-Medium)
Evidence:
- 33 instances of `document.createElement('canvas')` followed by size/context setup across `src/rendering/`, `src/field/`, `src/states/`, `src/utils/`, `src/hooks/`, `src/components/`.

Impact:
- Repeated boilerplate; no centralized error handling for context acquisition failures.

Recommendation:
- Create `src/utils/canvasHelper.ts` with `createCanvas2D(width, height)` and `createCanvasWebGL(width, height)` helpers that handle sizing and context acquisition.

---

## P2: Architecture (cache consolidation, shared utilities)

### 27) `NPCSpriteCache` reimplements generic async caching (Low)
Evidence:
- `src/game/npc/NPCSpriteLoader.ts` implements its own async sprite cache with dedup and error handling.
- `src/utils/assetLoader.ts` provides a generic async cache infrastructure.

Impact:
- Duplicated cache invalidation and error handling logic.

Recommendation:
- Refactor `NPCSpriteLoader` to use the shared cache infrastructure from `assetLoader.ts`.

---

### 28) Elevation compatibility logic not shared (Low)
Evidence:
- `areElevationsCompatible()` in NPC collision system (canonical).
- Separate elevation comparison logic in `src/game/PlayerController.ts`.

Impact:
- Inconsistent elevation rules between player and NPC collision checks.

Recommendation:
- Move `areElevationsCompatible()` to a shared utility (e.g., `src/utils/elevation.ts` or `src/game/collision/elevation.ts`) and import from both systems.
