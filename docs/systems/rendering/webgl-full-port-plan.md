---
title: WebGL Full Port Plan: Path to Main Page Equivalency
status: reference
last_verified: 2026-01-13
---

# WebGL Full Port Plan: Path to Main Page Equivalency

This document outlines the step-by-step plan to port the complete rendering system to WebGL, enabling full replacement of the Canvas 2D renderer on the main page.

## Architecture: Zero Duplication via IRenderPipeline

The codebase already has a clean abstraction for swapping renderers:

```
IRenderPipeline (interface)
       ↑                      ↑
CanvasRenderPipelineAdapter   WebGLRenderPipelineAdapter
       ↑                      ↑
  RenderPipeline         WebGLRenderPipeline
```

**Key insight:** Both renderers implement `IRenderPipeline`. The main `MapRenderer` should use this interface via `RenderPipelineFactory`. All sprite/NPC/effect code stays in `MapRenderer` — no duplication.

**What this means:**
- We do NOT build separate WebGL test pages with duplicate game logic
- We integrate WebGL into the existing `MapRenderer`
- Toggle between renderers with a config flag
- All existing code (NPCs, effects, transitions) works unchanged

## Current State Summary

**What WebGL Already Has:**
- 3-pass tile rendering (background, topBelow, topAbove) via framebuffers
- Instanced tile drawing (1 draw call for all tiles per pass)
- Tileset animation support via `texSubImage2D` partial updates
- Elevation filtering code (splits top layer based on player elevation)
- GBA-accurate 59.73 Hz animation timing
- `IRenderPipeline` interface + `WebGLRenderPipelineAdapter`
- `RenderPipelineFactory` for automatic fallback

**What's Missing for Full Equivalency:**
- WebGL tileset upload integration in MapRenderer
- Testing with real game viewport and camera following
- Verification of sub-pixel scrolling at tile boundaries
- Performance comparison Canvas vs WebGL

## Architecture Strategy

### Hybrid Rendering Approach
Rather than rewriting sprite rendering in WebGL shaders, we'll use a **hybrid approach**:
1. WebGL renders tile layers to framebuffers
2. Framebuffers are composited to a shared canvas
3. Existing Canvas 2D sprite code renders between WebGL composite calls
4. This maximizes code reuse and keeps sprites pixel-perfect

This works because:
- The existing sprite rendering code is well-tested and GBA-accurate
- Sprites don't benefit as much from instancing (fewer draws, more variety)
- The bottleneck is tile rendering, which WebGL already handles

### Integration Points
```
WebGL composite(background)
  ↓
Canvas2D: renderFieldEffects('bottom')
Canvas2D: renderNPCs(priority=0,1)
  ↓
WebGL composite(topBelow)
  ↓
Canvas2D: renderFieldEffects('middle')
Canvas2D: renderPlayer()
Canvas2D: renderNPCs(priority=2)
  ↓
WebGL composite(topAbove)
  ↓
Canvas2D: renderFieldEffects('top')
Canvas2D: renderArrowOverlays()
```

---

## Viewport Strategy

### The Problem
The current `WebGLMapPage` renders **ALL tiles** in the entire map (e.g., a 60x60 map = 3,600 metatiles = 28,800 8x8 tiles), then uses `scrollOffset` to shift the view. This is inefficient.

### The Solution: Viewport Culling
Only render tiles visible in the viewport, matching how the Canvas system works:

```
┌─────────────────────────────────────────┐
│           Full Map (60x60)              │
│                                         │
│      ┌──────────────────┐               │
│      │  Viewport (20x20)│               │
│      │                  │               │
│      │  Only render     │               │
│      │  these tiles!    │               │
│      │                  │               │
│      └──────────────────┘               │
│                                         │
└─────────────────────────────────────────┘
```

### Key Concepts

**WorldCameraView** contains everything needed:
```typescript
interface WorldCameraView {
  // Viewport size in metatiles (typically 20x20 for 320x320 pixels)
  tilesWide: number;      // 20
  tilesHigh: number;      // 20

  // Which world tile is at top-left of viewport (for culling)
  worldStartTileX: number;  // floor(cameraPixelX / 16)
  worldStartTileY: number;  // floor(cameraPixelY / 16)

  // Sub-pixel camera position (for smooth scrolling)
  cameraWorldX: number;     // camera position in pixels
  cameraWorldY: number;
}
```

**Tile Culling:** Only build instances for tiles in range:
- X: `worldStartTileX` to `worldStartTileX + tilesWide`
- Y: `worldStartTileY` to `worldStartTileY + tilesHigh`

**Sub-Pixel Scrolling:** The fractional part of camera position:
- `offsetX = cameraWorldX - (worldStartTileX * 16)`  (0-15 pixels)
- `offsetY = cameraWorldY - (worldStartTileY * 16)`  (0-15 pixels)

This offset is applied during compositing to smoothly position the rendered tiles.

### Render Flow with Viewport

```
1. Camera moves to (152, 88) pixels
2. Calculate view:
   - worldStartTileX = floor(152/16) = 9
   - worldStartTileY = floor(88/16) = 5
   - subPixelOffsetX = 152 % 16 = 8
   - subPixelOffsetY = 88 % 16 = 8
3. Build instances for tiles (9,5) to (28,24) only — 400 metatiles
4. Render to framebuffer at (0,0)
5. Composite to screen with (-8, -8) offset for smooth positioning
```

### Performance Impact
| Map Size | All Tiles | Viewport Only | Savings |
|----------|-----------|---------------|---------|
| 30x30    | 7,200     | 3,200         | 56%     |
| 60x60    | 28,800    | 3,200         | 89%     |
| 100x100  | 80,000    | 3,200         | 96%     |

### Overscan (Optional Optimization)

The Canvas system renders **4 extra tiles** on each edge (28x28 for a 20x20 viewport). This reduces rebuild frequency:

```
Without overscan: Rebuild every 16 pixels (every 8 frames at walk speed)
With 4-tile overscan: Rebuild every 64 pixels (every 32 frames)
```

**For WebGL initial implementation:** Skip overscan. Sub-pixel offset already provides smooth scrolling, and WebGL instance rebuilds are cheap (~1ms for 3,200 tiles).

**Add overscan later if:**
- Stuttering observed at tile boundaries
- Low-end device testing shows issues
- Want to reduce CPU work during continuous walking

**Overscan implementation (if needed):**
```typescript
const OVERSCAN = 2; // tiles on each edge
const view: WorldCameraView = {
  tilesWide: 20 + OVERSCAN * 2,  // 24
  tilesHigh: 20 + OVERSCAN * 2,  // 24
  worldStartTileX: Math.floor(cameraX / 16) - OVERSCAN,
  worldStartTileY: Math.floor(cameraY / 16) - OVERSCAN,
  // ...
};
// Composite offset adjusts to account for overscan buffer position
```

### Where This Is Already Implemented
- `TileInstanceBuilder.ts` - Uses `view.worldStartTileX/Y` and `view.tilesWide/High`
- `WebGLPassRenderer.ts` - Passes view to TileInstanceBuilder
- `WebGLRenderPipeline.ts` - Orchestrates the 3-pass system with view

**What's NOT using it:** `WebGLMapPage.tsx` bypasses `WebGLRenderPipeline` and manually builds ALL tiles.

---

## Phase 1: Prove WebGL Pipeline in /webgl-map (SAFE - No Main Page Changes)

**Goal:** Get `/webgl-map` using `WebGLRenderPipeline` with proper viewport culling. Main page (`/`) remains untouched.

**Safety:** All changes in this phase are isolated to `WebGLMapPage.tsx` — zero risk to main game.

### Step 1.1: Switch WebGLMapPage to Use WebGLRenderPipeline ✅
**Files:** `src/pages/WebGLMapPage.tsx` ONLY

Currently WebGLMapPage uses `WebGLTileRenderer` directly and builds ALL tiles.
Switch to `WebGLRenderPipeline` which has viewport culling built-in.

- [x] Replace `WebGLTileRenderer` with `WebGLRenderPipeline`
- [x] Implement `TileResolverFn` to look up tiles from loaded map data
- [x] Create proper `WorldCameraView` from camera position
- [x] Call `pipeline.render()` then `pipeline.composite()`

### Step 1.2: Implement TileResolverFn for WebGLMapPage ✅
**Files:** `src/pages/WebGLMapPage.tsx` ONLY

The pipeline needs a function to resolve world coordinates to tile data:

```typescript
const resolveTile: TileResolverFn = (tileX, tileY) => {
  // Look up tile in loaded map data
  // Return metatile, attributes, tileset info
  // Return null for out-of-bounds
};
pipeline.setTileResolver(resolveTile);
```

### Step 1.3: Test Viewport Culling ✅
**Files:** `src/pages/WebGLMapPage.tsx` ONLY

- [x] Load a large map (60x60+)
- [x] Verify tile count shows ~3,500 (21x21 tiles with +1 overscan)
- [x] Move camera with arrow keys
- [x] Verify smooth scrolling at tile boundaries
- [x] Check no visual glitches at map edges

### Step 1.4: Test Sub-Pixel Scrolling ✅
**Files:** `src/pages/WebGLMapPage.tsx` ONLY

- [x] Camera moves 4 pixels per frame (smooth)
- [x] Verify perfectly smooth scrolling (no snapping every 16 pixels)
- [x] Test scrolling in all 4 directions
- [x] Fixed edge flickering by rendering +1 tile overscan

**Fixes Applied During Phase 1:**
- Fixed layer transparency (always clear WebGL canvas before each pass)
- Fixed dirty tracking causing black screen at rest (use `needsFullRender: true`)
- Fixed sub-tile offset calculation (use `subTileOffsetX/Y` not fractional pixels)
- Fixed edge flickering (render 21x21 tiles instead of 20x20)
- Fixed animations not playing (add `animationChanged: true`)

**Success Criteria for Phase 1:** ✅
- `/webgl-map` renders correctly with viewport culling
- Tile count is viewport-sized, not full-map-sized
- Smooth scrolling works
- Tile animations work
- Main page (`/`) completely unchanged and still working

---

## Phase 2: Add Game-Like Features to /webgl-map (Still Safe) ✅

**Goal:** Prove hybrid rendering (WebGL tiles + Canvas2D sprites) works in isolation

**Safety:** Still only modifying `WebGLMapPage.tsx`

### Step 2.1: Add Simple Sprite Rendering Test ✅
**Files:** `src/pages/WebGLMapPage.tsx` ONLY

- [x] After `pipeline.composite()`, draw a test sprite on the 2D context
- [x] Verify sprite appears at correct position relative to tiles
- [x] Test sprite moves correctly with camera

### Step 2.2: Test Layer Ordering ✅
**Files:** `src/pages/WebGLMapPage.tsx` ONLY

- [x] Use `compositeBackgroundOnly()`, then draw sprite, then `compositeTopAbove()`
- [x] Verify sprite appears between background and topAbove layers
- [x] Border tiles working (2x2 repeating pattern from border.bin)

### Step 2.3: Border Tiles ✅
- [x] Load border.bin with map assets
- [x] Tile resolver returns border tiles for out-of-bounds coordinates
- [x] Camera allows scrolling past map edges to see borders

**Success Criteria for Phase 2:** ✅
- Hybrid rendering proven in isolation
- Layer ordering works correctly
- Border tiles render correctly
- Ready to port to main page

---

## Phase 3: Build Full Game Features in /webgl-map (Incremental)

**Goal:** Add real game features to `/webgl-map` one by one until full parity with main page.

**Why this approach:**
- Main page breaks when WebGL enabled (too many things at once)
- Can't debug piecewise in main page
- `/webgl-map` is isolated - safe to experiment
- Reuse rendering code from main game where possible

**Strategy:** Import and use the same Canvas2D rendering utilities from the main game, but with WebGL tile pipeline underneath.

**Important**: Always import modular modules instead of redoing logic. we need 1:1 but no major code duplication. If a module really needs to be change make sure main page doesn't break.

### Step 3.1: Add Real Player Sprite ✅
**Files:** `src/pages/WebGLMapPage.tsx`

Replace the red test square with actual player rendering:
- [x] Import player sprite sheet loading
- [x] Add player position state (not just camera)
- [x] Render player sprite at correct screen position
- [x] Player moves with Arrow Keys, camera follows
- [x] Test: Player renders between topBelow and topAbove

### Step 3.2: Add Player Animation ✅
(Already handled by reusing `PlayerController`)
- [x] Walking animation frames
- [x] Direction changes (up/down/left/right)
- [x] Running animation (hold Z)
- [x] Idle animation
- [x] Test: Animations play smoothly with WebGL tiles

### Step 3.3: Add Grass Field Effects ✅
**Reuse:** `ObjectRenderer.renderFieldEffects`, `useFieldSprites`, `FieldEffectManager`

- [x] Load grass sprites (tall grass, long grass, sand, splash, ripple)
- [x] Detect when player walks on grass tile (handled by PlayerController)
- [x] Render grass rustling effect with Y-sorting (bottom/top layers)
- [x] Test: Grass renders at correct layer (covers player feet)

### Step 3.4: Add Water Reflections
**Reuse:** `ObjectRenderer.renderReflection`

- [ ] Detect reflective tiles (water, ice)
- [ ] Render player reflection below player
- [ ] Test: Reflection appears on water tiles

### Step 3.5: Add NPCs
**Reuse:** `renderNPCs`, `renderNPCReflections`, `renderNPCGrassEffects`

- [ ] Load NPC data from map events
- [ ] Render NPCs at correct positions
- [ ] NPC Y-sorting with player
- [ ] NPC grass effects
- [ ] Test: NPCs render correctly relative to player and tiles

### Step 3.6: Add Item Balls
**Reuse:** `ObjectRenderer.renderItemBalls`

- [ ] Load item ball sprite
- [ ] Render item balls from map data
- [ ] Test: Item balls visible and correctly layered

### Step 3.7: Add Elevation/Bridge Test
- [ ] Find map with bridges (Route 119, etc.)
- [ ] Test player walking under bridge (covered by topAbove)
- [ ] Test player walking on bridge (above water)
- [ ] Verify elevation-based layer splitting works

### Step 3.8: Add Map Connections
- [ ] Load connected maps
- [ ] Seamless scrolling between maps
- [ ] Tileset changes at boundaries
- [ ] Test: Walk between connected maps

### Step 3.9: Add Fade Transitions
**Reuse:** `FadeController`

- [ ] Implement fade in/out overlay
- [ ] Test with map transitions

### Step 3.10: Add Surfing (Optional - Complex)
- [ ] Surf blob sprite
- [ ] Mount/dismount logic
- [ ] Blob bob animation

**Success Criteria for Phase 3:**
- `/webgl-map` has feature parity with main page rendering
- Each feature tested in isolation before moving to next
- All Canvas2D sprite code reused (no duplication)
- Main page (`/`) still works unchanged with Canvas2D

---

## Phase 4: Port to Main Page

**Goal:** Enable WebGL in main page now that all features are proven

**Prerequisites:** All Phase 3 steps complete and working in `/webgl-map`

### Step 4.1: Enable Feature Flag
**Files:** `src/config/rendering.ts`

```typescript
enableWebGL: true,
forceCanvas2D: false,
```

### Step 4.2: Test Main Page
Run through full verification checklist:

**Tile Rendering:**
- [ ] Background layer renders correctly
- [ ] TopBelow layer (behind player) works
- [ ] TopAbove layer (bridges, tree tops) covers player correctly
- [ ] Tile animations (flowers, water) animate
- [ ] Border tiles show at map edges

**Player & Movement:**
- [ ] Player sprite renders at correct layer
- [ ] Smooth pixel walking (not tile-snapping)
- [ ] Running works
- [ ] Direction changes work
- [ ] Player covered by topAbove elements (bridges, etc.)

**NPCs:**
- [ ] NPCs render at correct positions
- [ ] NPC Y-sorting with player works
- [ ] NPC walking/animations work
- [ ] NPC grass effects (grass covers feet)

**Field Effects:**
- [ ] Grass rustling animation
- [ ] Long grass animation
- [ ] Sand footprints
- [ ] Water reflections
- [ ] Water splash/ripple effects
- [ ] Player shadow

**Surfing:**
- [ ] Surf blob renders
- [ ] Mount/dismount animations
- [ ] Blob bob animation

**Objects:**
- [ ] Item balls render
- [ ] Door animations
- [ ] Arrow overlays (signs, etc.)

**Warps & Transitions:**
- [ ] Door warps work
- [ ] Cave warps work
- [ ] Map connection warps work
- [ ] Fade in/out transitions
- [ ] Tileset changes on warp

**Camera:**
- [ ] Camera follows player smoothly
- [ ] Sub-pixel scrolling (no jitter)
- [ ] Map boundary handling

**Overlays (Canvas2D on top):**
- [ ] Dialog boxes render on top
- [ ] Menus render on top
- [ ] Debug overlays work

### Step 4.3: Fix Any Remaining Issues
- [ ] Document bugs found
- [ ] Fix in WebGL pipeline
- [ ] Re-test

**Success Criteria for Phase 4:**
- Main page works identically with WebGL
- Easy rollback via feature flag
- No regressions

---

## Phase 5: Performance & Polish

**Goal:** Optimize and verify production-ready

### Step 5.1: Performance Comparison
- [ ] Compare frame times: Canvas2D vs WebGL on same map
- [ ] Test on large maps (Route 119, Safari Zone)
- [ ] Test with many animated tiles
- [ ] Profile any bottlenecks

### Step 5.2: WebGL Context Handling
- [ ] Test context loss recovery
- [ ] Verify fallback to Canvas2D works
- [ ] Test on mobile browsers

### Step 5.3: Default to WebGL
- [ ] Set `enableWebGL: true` by default
- [ ] Keep `forceCanvas2D` option for debugging
- [ ] Test on various browsers (Chrome, Firefox, Safari)

### Step 5.4: Cleanup
- [ ] Keep `/webgl-map` as debug/testing tool
- [ ] Update this documentation
- [ ] Remove any dead code

---

## Summary: Architecture Achieved

### Safe Development Path

| Phase | Where | Risk to Main Page | Status |
|-------|-------|-------------------|--------|
| 1 | `/webgl-map` only | **None** | ✅ Complete |
| 2 | `/webgl-map` only | **None** | ✅ Complete |
| 3 | `/webgl-map` only | **None** | 🔄 In Progress |
| 4 | Feature flag only | **Mitigated by flag** | Pending |
| 5 | Config/docs | **None** | Pending |

### Zero Code Duplication (Achieved!)

| Component | Code Location | WebGL Changes |
|-----------|---------------|---------------|
| Tile rendering | `IRenderPipeline` | Swapped via factory |
| Sprite rendering | `ObjectRenderer`, `renderNPCs` | **None** |
| Player | `PlayerController` | **None** |
| Field effects | `ObjectRenderer.renderFieldEffects` | **None** |
| Reflections | `ObjectRenderer.renderReflection` | **None** |
| NPCs | `renderNPCs`, `renderNPCReflections` | **None** |
| Door animations | `useDoorAnimations` | **None** |
| Warps | `WarpHandler` | **None** |
| Fades | `FadeController` | **None** |
| Dialog/Menus | React components | **None** (on top) |

### Key Integration Points

**`useCompositeScene.ts`** already does:
```typescript
pipeline.compositeBackgroundOnly(mainCtx, view);
// ... render NPCs priority 2 ...
pipeline.compositeTopBelowOnly(mainCtx, view);
// ... render doors, arrows, reflections, grass, player, NPCs ...
pipeline.compositeTopAbove(mainCtx, view);
// ... render priority 0 NPCs, debug overlays, fade ...
```

**`MapRendererInit.ts`** already does:
```typescript
const { pipeline, rendererType } = RenderPipelineFactory.create(webglCanvas, {
  tilesetCache: refs.tilesetCacheRef.current,
  preferWebGL: RENDERING_CONFIG.enableWebGL,
});
if (rendererType === 'webgl') {
  uploadTilesetsToWebGL(refs, renderCtx.tilesetRuntimes);
}
```

### Files Modified Summary

**Phase 1-2:** `src/pages/WebGLMapPage.tsx` + `src/rendering/webgl/*`
**Phase 3:** `src/config/rendering.ts` (flip flag only!)
**Phase 4:** Testing + docs

---

## Success Criteria

- [ ] Main page works with `enableWebGL: true`
- [ ] All features identical to Canvas2D (see Phase 3.3 checklist)
- [ ] Performance equal or better
- [ ] Clean fallback when WebGL unavailable
- [ ] Zero duplicate sprite/game code
