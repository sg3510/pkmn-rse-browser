---
title: 09 - Unified WebGL Sprite Renderer
status: reference
last_verified: 2026-01-13
---

# 09 - Unified WebGL Sprite Renderer

This document outlines the plan for implementing a unified WebGL sprite renderer to eliminate the hybrid Canvas2D/WebGL rendering approach and achieve full GPU-accelerated rendering.

> **Last Updated:** 2025-12-01
> **Status:** Phase 1-4 COMPLETE for WebGLMapPage. Phase 5+ (unification) in progress.

## Guiding Principles

1. **Move everything to WebGL in super small bite-sized steps** - Each architecture change MUST be tested
2. **No hybrid rendering** - Either full WebGL (WebGLMapPage) OR full Canvas2D (MapRenderer), never mixed
3. **Minimize logic duplication** - Share game logic (PlayerController, hooks), keep rendering separate
4. **Always refer to C code in `public/pokeemerald/*`** - Stay authentic to GBA behavior
5. **Reflections and animations like puddles MUST be masked by BG1** - Render over BG0 for reflective tiles
6. **Reflection shimmer MUST use authentic GBA matrix multiply code** - Nothing else
7. **Menus and chat messages render in HTML** - Exception to WebGL-everything rule

## Current Implementation Status

### What's DONE in WebGL (WebGLMapPage.tsx)

| Feature | Status | Location |
|---------|--------|----------|
| WebGLSpriteRenderer | ✅ Complete | `src/rendering/webgl/WebGLSpriteRenderer.ts` |
| ISpriteRenderer interface | ✅ Complete | `src/rendering/ISpriteRenderer.ts` |
| SpriteInstance type | ✅ Complete | `src/rendering/types.ts` |
| Player sprite rendering | ✅ Complete | Uses `createSpriteFromFrameInfo()` |
| Player reflection w/ shimmer | ✅ Complete | Uses `createPlayerReflectionSprite()` |
| NPC sprites | ✅ Complete | Uses `createNPCSpriteInstance()` |
| NPC reflections | ✅ Complete | Uses `createNPCReflectionSprite()` |
| Field effects (grass, sand) | ✅ Complete | Uses `createFieldEffectSprite()` |
| Water mask for reflections | ✅ Complete | `buildWaterMaskFromView()` |
| Puddle splash clipping | ✅ Complete | Uses reflection shader |
| Water ripple clipping | ✅ Complete | Uses reflection shader |
| Split layer rendering | ✅ Complete | `renderAndCompositeLayer0Only()`, `renderAndCompositeLayer1Only()` |
| Door animations | ✅ Complete | WebGL sprites via `createDoorAnimationSprite()` |
| Arrow overlay | ✅ Complete | WebGL sprites via inline sprite creation |
| Warp system | ✅ Complete | Uses shared `WarpExecutor`, `DoorActionDispatcher` |
| Fade transitions | ✅ Complete | WebGL via `WebGLFadeRenderer` fullscreen quad |

### What's MISSING in WebGL (needs to be ported)

| Feature | Canvas2D Location | Priority | Status |
|---------|------------------|----------|--------|
| Surf blob rendering | `useCompositeScene.ts:198-242` | HIGH | TODO |
| Item ball rendering | `ObjectRenderer.renderItemBalls()` | MEDIUM | TODO |
| ~~NPC grass effects~~ | ~~`renderNPCGrassEffects()`~~ | ~~MEDIUM~~ | ✅ DONE |
| ~~Long grass clipping~~ | ~~PlayerController inLongGrass~~ | ~~LOW~~ | ✅ DONE (player + NPC) |
| Debug collision/elevation overlay | `DebugRenderer.renderCollisionElevationOverlay()` | LOW | Optional |
| ~~Priority 0 NPC rendering~~ | ~~`useCompositeScene.ts:282-288`~~ | ~~LOW~~ | ✅ DONE |

### Shared Code (Already Unified)

| Component | Location | Used By |
|-----------|----------|---------|
| `ReflectionShimmer` | `src/field/ReflectionShimmer.ts` | Both |
| `computeReflectionState()` | `src/field/ReflectionRenderer.ts` | Both |
| `buildReflectionMask()` | `src/field/ReflectionRenderer.ts` | Canvas2D only (WebGL uses `buildWaterMaskFromView`) |
| `FadeController` | `src/field/FadeController.ts` | Both |
| `WarpHandler` | `src/field/WarpHandler.ts` | Both |
| `useDoorAnimations` | `src/hooks/useDoorAnimations.ts` | Both |
| `useDoorSequencer` | `src/hooks/useDoorSequencer.ts` | Both |
| `useArrowOverlay` | `src/hooks/useArrowOverlay.ts` | Both |
| `WarpExecutor` | `src/game/WarpExecutor.ts` | Both |
| `DoorActionDispatcher` | `src/game/DoorActionDispatcher.ts` | Both |
| `PlayerController` | `src/game/PlayerController.ts` | Both |
| `ObjectEventManager` | `src/game/ObjectEventManager.ts` | Both |
| `fieldEffectUtils` | `src/rendering/fieldEffectUtils.ts` | Both |
| `spriteUtils` (shadow) | `getShadowPosition()`, `createPlayerShadowSprite()` | Both |

### Recently Deduplicated

| Feature | Before | After |
|---------|--------|-------|
| Field effect Y-sorting | Duplicate logic in `ObjectRenderer.ts:110-133` and `spriteUtils.ts:242-265` | Shared `computeFieldEffectLayer()` in `fieldEffectUtils.ts` |
| Field effect Y-offsets | Duplicate logic in `ObjectRenderer.ts:170-187` and `spriteUtils.ts:273-279` | Shared `getFieldEffectYOffset()` in `fieldEffectUtils.ts` |
| Field effect dimensions | Inline constants in both files | Shared `FIELD_EFFECT_DIMENSIONS` + `getFieldEffectDimensions()` |
| Field effect layer filtering | Duplicate visibility/layer logic | Shared `shouldRenderInLayer()` in `fieldEffectUtils.ts` |
| Shadow rendering | Inline in `PlayerController.render()` and `WebGLMapPage` | Shared `getShadowPosition()` + `createPlayerShadowSprite()` in `spriteUtils.ts` |
| NPC priority classification | Inline `npcPriority >= 2` checks | Shared `isLowPriority()`, `isHighPriority()`, `getPriorityLayer()`, `PriorityLayer` type in `elevationPriority.ts`. Used for layer separation: P2/P3 before TopBelow, P1 with player, P0 after TopAbove. |

### Duplicate Code (Needs Unification)

#### Rendering Logic

| Feature | Canvas2D | WebGL | Unified Target |
|---------|----------|-------|----------------|
| Scene compositing | `useCompositeScene` hook | Inline in `WebGLMapPage.tsx:953-1201` | New `useSceneComposer` abstraction |
| Reflection rendering | `ObjectRenderer.renderReflection()` | `createPlayerReflectionSprite()` + shader | Keep WebGL approach, deprecate Canvas2D |
| ~~Field effect building~~ | ~~`ObjectRenderer.renderFieldEffects()`~~ | ~~`createFieldEffectSprite()`~~ | ✅ DONE - Both now use `fieldEffectUtils.ts` |
| NPC rendering | `renderNPCs()` in game/npc/ | Inline in WebGLMapPage | Keep separate (minimal duplication) |

#### Game Logic (Non-Rendering)

| Feature | Canvas2D (MapRenderer) | WebGL (WebGLMapPage) | Recommendation |
|---------|------------------------|----------------------|----------------|
| **Viewport constants** | `DEFAULT_VIEWPORT_CONFIG` in config | `VIEWPORT_TILES_WIDE/HIGH` inline (112-113) | WebGL should import from config |
| **Tile change detection** | `useRunUpdate` hook | Inline (758-766) | Extract `hasTileChanged()` to `WarpHandler` |
| **Arrow overlay constants** | Not extracted | Inline (1242-1246) | Extract to `src/field/ArrowOverlayConstants.ts` |
| **Player sprite loading** | `initializeGame()` | Inline (550-631) | Extract to `src/game/PlayerInitializer.ts` |
| **Object event loading** | Similar inline | Inline (278-359) | Extract to `src/game/ObjectEventLoader.ts` |
| **Door sequence logic** | `useWarpExecution` hook | Inline (806-876) | WebGL should use hook pattern |
| **Render loop structure** | Hook-based (`useRunUpdate`, etc) | Single 650-line inline loop | Consider extracting to hooks |
| **World initialization** | `MapManager` + events | `WorldManager` + snapshot | Evaluate merging approaches |

### Centralization Priority

#### Phase 1: Quick Wins (Low Effort)
- [ ] Move viewport constants to shared config (WebGLMapPage should import `DEFAULT_VIEWPORT_CONFIG`)
- [ ] Extract arrow overlay constants to `src/field/ArrowOverlayConstants.ts`
- [ ] Add `hasTileChanged(tileX, tileY, mapId)` method to `WarpHandler` class

#### Phase 2: Medium Effort
- [ ] Extract player sprite loading to `src/game/PlayerInitializer.ts`
- [ ] Extract object event loading to `src/game/ObjectEventLoader.ts`
- [ ] Cache reflection state (computed 3x per frame in WebGLMapPage)

#### Phase 3: Major Refactoring (High Effort)
- [ ] Unify world initialization (`MapManager` vs `WorldManager`)
- [ ] Extract WebGLMapPage render loop to hooks (following MapRenderer pattern)
- [ ] Create unified scene composer abstraction

## Related Documentation

### Our Implementation
- **`docs/features/reflection/reflection-parity-plan.md`** - Comprehensive reflection system documentation (masking, bridge offsets, layer semantics)
- **`docs/features/reflection/shimmer.md`** - Detailed shimmer/distortion investigation with GBA code analysis
- **`src/field/ReflectionShimmer.ts`** - GBA-accurate shimmer animation (48-frame loop, affine math)
- **`src/field/ReflectionRenderer.ts`** - Reflection rendering utilities, `applyGbaAffineShimmer()`

### GBA Source Code References (pokeemerald)
- **`public/pokeemerald/src/data/field_effects/field_effect_objects.h`** (lines 849-892)
  - `sAffineAnim_ReflectionDistortion_0` / `sAffineAnim_ReflectionDistortion_1` - The affine animation sequences
  - `gFieldEffectObjectTemplate_ReflectionDistortion` - Template for invisible distortion sprites
- **`public/pokeemerald/src/event_object_movement.c`** (lines ~1207-1219)
  - `CreateReflectionEffectSprites()` - Spawns the two invisible distortion sprites at reset
  - `ObjectEventGetNearbyReflectionType()` - Detection logic for water/ice
- **`public/pokeemerald/src/field_effect_helpers.c`**
  - `SetUpReflection()` / `UpdateObjectReflectionSprite()` - Reflection sprite creation/update
  - `LoadObjectReflectionPalette()` / `LoadObjectHighBridgeReflectionPalette()` - Palette handling

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current Architecture](#current-architecture)
3. [Proposed Architecture](#proposed-architecture)
4. [Modularity Goals](#modularity-goals)
5. [Component Design](#component-design)
6. [Shader Design](#shader-design)
7. [Implementation Phases](#implementation-phases)
8. [Detailed Checklist](#detailed-checklist)
9. [Risk Assessment](#risk-assessment)

---

## Modularity Goals

**Long-term goal:** Merge `src/pages/WebGLMapPage.tsx` and `src/components/MapRenderer.tsx` by separating renderer from game loop.

### Existing Architecture to Leverage

| File | Purpose |
|------|---------|
| `src/rendering/IRenderPipeline.ts` | Interface for tile renderers (Canvas2D/WebGL) |
| `src/rendering/RenderPipelineFactory.ts` | Factory with automatic fallback |
| `src/rendering/types.ts` | React-free shared types |

### New Interfaces to Create

```typescript
// src/rendering/ISpriteRenderer.ts
interface ISpriteRenderer {
  readonly rendererType: 'canvas2d' | 'webgl';

  // Upload sprite sheet to renderer
  uploadSpriteSheet(name: string, source: HTMLCanvasElement | ImageData): void;

  // Render a batch of sprites (sorted by caller)
  renderBatch(sprites: SpriteInstance[], view: WorldCameraView): void;

  // For reflections - set water mask
  setWaterMask?(maskData: Uint8Array, width: number, height: number): void;

  // Cleanup
  dispose(): void;
}

// src/rendering/types.ts (add to existing)
interface SpriteInstance {
  // Position in world pixels
  worldX: number;
  worldY: number;

  // Sprite dimensions
  width: number;
  height: number;

  // Atlas region
  atlasName: string;
  atlasX: number;
  atlasY: number;
  atlasWidth: number;
  atlasHeight: number;

  // Transform
  flipX: boolean;
  flipY: boolean;

  // Appearance
  alpha: number;
  tintR: number;
  tintG: number;
  tintB: number;

  // Sorting
  sortKey: number;  // Y + subpriority

  // Flags
  isReflection: boolean;
  shimmerScale?: number;  // Only for water reflections
}
```

### Integration Path

```
Phase 1-2: WebGLSpriteRenderer (standalone, WebGLMapPage only)
    ↓
Phase 3: Create ISpriteRenderer interface
    ↓
Phase 4: Canvas2DSpriteRenderer implements ISpriteRenderer
    ↓
Phase 5: Add sprites to IRenderPipeline
    ↓
Future: Unified GameRenderer using IRenderPipeline + ISpriteRenderer
         ← Both MapRenderer and WebGLMapPage can use this
```

### Key Design Principles

1. **Renderer-agnostic data:** `SpriteInstance` contains no WebGL/Canvas2D specifics
2. **No React in rendering code:** All rendering logic in `src/rendering/`
3. **Interface-first:** Define `ISpriteRenderer` before Canvas2D implementation
4. **Shared types:** Add sprite types to `src/rendering/types.ts`
5. **Factory pattern:** Eventually `SpriteRendererFactory` like `RenderPipelineFactory`
6. **REUSE EXISTING COMPONENTS:** Never duplicate logic - use what's already built in `src/`

### Components to Reuse (NOT Duplicate)

| Existing Component | Reuse For |
|-------------------|-----------|
| `WebGLContext` | GL context management, shader compilation |
| `WebGLTextureManager` | Texture upload patterns (adapt for sprites) |
| `WebGLBufferManager` | Buffer management patterns |
| `ReflectionShimmer` | Shimmer animation state (already renderer-agnostic) |
| `ReflectionRenderer` | Tint colors, offsets, `applyGbaAffineShimmer()` |
| `WebGLShaders` | Shader compilation helpers |

---

## GBA Architecture Analysis (Key Insights from pokeemerald)

After thorough analysis of the GBA source code, several key insights significantly simplify our approach:

### GBA Hardware Constraints (For Reference)

| Resource | GBA Limit | Our WebGL Equivalent |
|----------|-----------|---------------------|
| OAM entries | 128 (64 active sprites) | Unlimited (GPU instancing) |
| Sprite tiles | 1024 (32KB VRAM) | 2048x2048 texture atlas (~16MB) |
| Palettes | 16 slots × 16 colors | Unlimited (direct RGBA) |
| Affine matrices | 32 | Unlimited (per-instance) |

### Key GBA Patterns We Should Adopt

#### 1. Reflection as Separate Sprite (GBA vs Our Implementation)

**GBA Approach** (`field_effect_helpers.c:SetUpReflection`):
```c
// Reflection is a COPY of the sprite with modified properties
reflectionSprite = CreateCopySpriteAt(sprite, x, y, subpriority=152);
reflectionSprite->oam.paletteNum = gReflectionEffectPaletteMap[paletteNum];
reflectionSprite->oam.affineMode = ST_OAM_AFFINE_NORMAL;  // For V-flip
```

**What actually clips reflections on GBA (not binary!)**
- The reflection sprite is OAM priority 3 (lowest) and sits **behind BG1**. Any non-empty BG1 tile hides the reflection; blank/transparent pixels let it show.
- Edge/puddle metatiles bake the “mask” into BG1: ground art on the top layer, water on the bottom layer.
- Evidence from `public/pokeemerald/data/tilesets/primary/general/metatiles.bin` (8×16‑bit entries per metatile):
  - Metatile **177** → bottom `[270,270,286,286]` (all water), top `[110,109,0,0]`. Top row is land (tiles 110/109), bottom row is blank → reflection only shows in the lower 8px row.
  - Metatile **200** → bottom `[286,286,286,286]`, top `[253,254,269,0]`. Three quadrants of land occlude the reflection; only the bottom‑right quadrant is exposed.
  - Metatile **202** → bottom `[286×4]`, top `[302(yflip),253(xflip),0,285(xflip)]`. Mixed shoreline pieces leave just one quadrant open.
- Puddles and shoreline tiles achieve “partial reflection” entirely through these BG1 overlays—there **is** per-quadrant (and sometimes per-pixel, if the overlay tile has transparent pixels) clipping on hardware.

**Why WE still need an explicit per-pixel mask:**
| Feature | GBA | Our Implementation |
|---------|-----|-------------------|
| Character position | Tile-aligned (16px grid) | Sub-pixel precision |
| Movement | Discrete tile steps | Smooth continuous |
| BG1 clipping | Coarse (8×8 overlay + transparent pixels) | Must replicate, plus handle mid-tile overlap |
| Water/ground overlap while moving | Never sampled | Common; reflection spans water + land in one frame |

Without a mask, smooth movement leaks reflection onto ground and ignores the BG1 holes that the GBA uses to carve puddles/shorelines. Our mask reproduces the BG1 overlay behavior **and** handles sub-tile movement.

#### 2. Bitmap-Based Tile Allocation

**GBA Approach** (`sprite.c`):
```c
// 128-byte bitmap tracks 1024 tile slots
static u8 sSpriteTileAllocBitmap[128];

#define ALLOC_SPRITE_TILE(n) (sSpriteTileAllocBitmap[(n) / 8] |= (1 << ((n) % 8)))
#define FREE_SPRITE_TILE(n)  (sSpriteTileAllocBitmap[(n) / 8] &= ~(1 << ((n) % 8)))

// First-fit contiguous allocation
s16 AllocSpriteTiles(u16 tileCount) {
    // Scan bitmap for first contiguous run of free tiles
}
```

**Our approach:** Use similar bitmap for texture atlas region allocation, but we have 2048×2048 pixels vs 1024 tiles.

#### 3. Sheet-Based vs Individual Frame Loading

**GBA has two sprite modes:**
1. **Sheet-based** (`usingSheet=true`): All frames pre-loaded, animation changes tile offset
2. **Individual frames** (`usingSheet=false`): DMA copy each frame on demand

**Our approach:** Always use sheet-based (pre-load entire sprite sheet to atlas). We have enough VRAM.

#### 4. OAM Buffer + Sort + Single Upload

**GBA Pipeline** (`sprite.c:BuildOamBuffer`):
```c
1. UpdateOamCoords()        // Calculate screen positions
2. BuildSpritePriorities()  // Pack priority values
3. SortSprites()            // Insertion sort by priority
4. AddSpritesToOamBuffer()  // Build final buffer
5. LoadOam()                // Single DMA to hardware
```

**Our approach:** Same pattern!
1. Build sprite instance array
2. Sort by Y-position + subpriority
3. Upload to GPU buffer
4. Single instanced draw call

#### 5. Reflection Palette Remapping

**GBA uses palette slots** (`event_object_movement.c`):
```c
const u8 gReflectionEffectPaletteMap[16] = {
    [PALSLOT_PLAYER] = PALSLOT_PLAYER_REFLECTION,
    // Each sprite type has a corresponding reflection palette
};
```

**Our approach:** Pass tint color as uniform/instance data instead of palette remapping:
- Normal sprite: `colorMod = (1.0, 1.0, 1.0, 1.0)`
- Water reflection: `colorMod = (0.27, 0.47, 0.78, 0.65)` (blue tint + alpha)
- Ice reflection: `colorMod = (0.7, 0.86, 1.0, 0.65)` (white-blue tint)
- Bridge reflection: `colorMod = (0.29, 0.45, 0.67, 0.6)` (solid dark blue)

### Revised Reflection Strategy (Corrected After Deep Investigation)

**⚠️ CORRECTION (updated with metatile evidence):** We must keep per-pixel masking. The GBA achieves partial reflections via BG1 overlays; we need a texture mask to mirror those holes and to cover our smooth sub-tile motion.

**Updated Phase 4 Plan:**

**Phase 4a - Basic reflection (GBA-parity for tile-aligned positions):**
- Reflection as sprite instance with V-flip + tint
- Tile-based visibility check (show if standing tile is reflective)
- Fast, simple, matches GBA behavior for stationary characters

**Phase 4b - Per-pixel masking (required for smooth movement):**
- Build mask texture from water tiles' pixelMask data
- Sample mask in fragment shader
- Discard non-water pixels
- **This is what we already have in Canvas2D - must port to WebGL**

The GBA relies on BG1 overlays to carve the holes; we need the mask to mirror that behavior **and** to handle continuous movement that crosses tile boundaries.

---

## ⚠️ Critical Investigation Findings (Updated After Code Analysis)

### 1. NO STENCIL BUFFER - Critical Blocker for Phase 4

**Location:** `src/rendering/webgl/WebGLContext.ts:41-48`

```typescript
const gl = this.canvas.getContext('webgl2', {
  stencil: false,  // ⚠️ STENCIL DISABLED!
  depth: false,
  // ...
});
```

**Impact:** The original plan for stencil-based reflection masking WILL NOT WORK without modifying `WebGLContext`.

**Options:**
1. **Modify WebGLContext** to enable stencil buffer (adds ~4MB GPU memory for 1080p)
2. **Texture-based masking** - render mask to texture, sample in fragment shader
3. **Hybrid approach** - keep Canvas2D for reflections only (defeats full unification)

**Recommendation:** Option 2 (texture-based masking) for Phase 4. No stencil needed.

### 2. Texture Units Already Allocated

**Location:** `src/rendering/webgl/WebGLTextureManager.ts:392-428`

Current allocation:
- Unit 0: Primary tileset (pair 0)
- Unit 1: Secondary tileset (pair 0)
- Unit 2: Palette (pair 0)
- Unit 3: Primary tileset (pair 1)
- Unit 4: Secondary tileset (pair 1)
- Unit 5: Palette (pair 1)

**Available:** Units 6-15 (minimum 16 units guaranteed by WebGL2)

**Plan:** Use Unit 6 for sprite atlas, Unit 7 for reflection mask texture (if needed)

### 3. Shimmer Effect - PIXEL-PERFECT GBA PARITY REQUIRED

**Our Implementation:**
- `src/field/ReflectionShimmer.ts` - GBA-accurate affine animation
- `src/field/ReflectionRenderer.ts` - `applyGbaAffineShimmer()` per-pixel transform

**Documentation:** See `docs/features/reflection/shimmer.md` for detailed GBA code analysis.

**GBA C Source (for reference during implementation):**
- `public/pokeemerald/src/data/field_effects/field_effect_objects.h` (lines 849-892)
  - `sAffineAnim_ReflectionDistortion_0/1` - The 48-frame affine sequences
- `public/pokeemerald/src/field_effect_helpers.c`
  - `SetUpReflection()` - Sets `affineMode = ST_OAM_AFFINE_NORMAL` for water (shimmer ON)
  - Ice uses `stillReflection = TRUE` → no affine mode → no shimmer

The GBA shimmer effect uses:
- 48-frame loop (~0.8 seconds at 59.73 Hz)
- X-scale varies ±1.56% (0.984375 to 1.015625)
- **Per-pixel nearest-neighbor sampling** (GBA affine hardware)
- Different matrix for east-facing sprites (matrix 1 vs matrix 0)
- ONLY applied to water reflections, NOT ice

**⚠️ NO COMPROMISE - GBA achieved this on a 16.78 MHz CPU. We MUST match it exactly.**

**Current Canvas2D Implementation (REFERENCE):**
```typescript
// applyGbaAffineShimmer() in ReflectionShimmer.ts - PIXEL PERFECT
for (let dstX = 0; dstX < w; dstX++) {
  // Centered inverse transform: sample source at ((x - cx) / scale) + cx
  const srcXf = centerX + (dstX - centerX) * invScale;
  const srcX = Math.floor(srcXf);  // Nearest-neighbor (floor, not round!)
  // ... copy pixel
}
```

**WebGL Implementation (MUST MATCH):**
```glsl
// Fragment shader - per-pixel affine transform with nearest-neighbor
uniform float u_shimmerScale;
uniform vec2 u_spriteCenter;  // Center of sprite in texture coords

void main() {
  // Inverse affine transform (same math as applyGbaAffineShimmer)
  float invScale = 1.0 / u_shimmerScale;
  vec2 centered = v_texCoord - u_spriteCenter;
  centered.x *= invScale;
  vec2 srcCoord = centered + u_spriteCenter;

  // Nearest-neighbor sampling (critical for GBA parity!)
  // Use texelFetch or floor() to pixel coordinates, NOT texture() interpolation
  ivec2 texelCoord = ivec2(floor(srcCoord * u_atlasSize));
  vec4 texColor = texelFetch(u_spriteAtlas, texelCoord, 0);
  // ...
}
```

**Why vertex shader scaling is WRONG:**
- Vertex scaling changes quad corners, then GPU interpolates → linear interpolation
- GBA does per-pixel inverse transform with floor() → nearest-neighbor
- Visual difference: vertex scaling is smooth, GBA shimmer has discrete pixel "jumps"

**Validation:** Compare WebGL shimmer against Canvas2D `applyGbaAffineShimmer()` frame-by-frame. They MUST be identical.

### 4. Reflection Mask Building

**Location:** `src/field/ReflectionRenderer.ts:364-419`

`buildReflectionMask()` iterates through tiles and reads `pixelMask` data (16x16 Uint8Array per tile) to build a per-pixel mask.

**For WebGL:**
1. Pre-compute visible water tile positions
2. Upload pixelMask data to mask texture (or generate from tile data)
3. Sample mask texture in fragment shader to discard non-water pixels

### 5. Long Grass Clipping

**Location:** `src/game/PlayerController.ts` (render method)

When in long grass, bottom 50% of sprite is clipped.

**WebGL Solution:** Use `gl.scissor()` test - simpler than shader-based clipping:
```typescript
gl.enable(gl.SCISSOR_TEST);
gl.scissor(x, y, width, height / 2);  // Clip bottom half
// render sprite
gl.disable(gl.SCISSOR_TEST);
```

### 6. Player Sprite Dimensions

- Normal: 16×32 pixels (walking, running)
- Surfing: 32×32 pixels
- Jump: uses `spriteYOffset` for arc
- Source: HTMLCanvasElement with RGBA (transparency pre-processed)

---

## Problem Statement

### Current Hybrid Rendering Issues

The current WebGL implementation renders tiles via GPU but sprites via Canvas2D, requiring **3 GPU→CPU→GPU round trips per frame**:

```
Current Frame Pipeline:
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. GPU: Render Background tiles to framebuffer                           │
│ 2. GPU: Render TopBelow tiles to framebuffer                             │
│ 3. GPU→CPU: Copy TopBelow framebuffer to 2D canvas  ← EXPENSIVE          │
│ 4. CPU: 2D Canvas renders door animations                                │
│ 5. CPU: 2D Canvas renders player reflection (per-pixel masking)          │
│ 6. CPU: 2D Canvas renders field effects (bottom layer)                   │
│ 7. CPU: 2D Canvas renders player sprite                                  │
│ 8. CPU: 2D Canvas renders field effects (top layer)                      │
│ 9. GPU→CPU: Copy TopAbove framebuffer to 2D canvas  ← EXPENSIVE          │
│10. CPU: 2D Canvas renders fade overlay                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Performance impact:**
- `drawImage()` from WebGL canvas forces GPU sync
- Each composite blocks until GPU finishes rendering
- Can't batch sprites with tiles
- Prevents future GPU effects (weather, time-of-day, shaders)

### What's Currently NOT in WebGL

| Component | Current Renderer | Instances/Frame | Notes |
|-----------|-----------------|-----------------|-------|
| Map tiles | WebGL (instanced) | 300-600 | ✅ Already optimized |
| Player sprite | Canvas2D | 1 | Simple drawImage |
| Player reflection | Canvas2D | 0-1 | Per-pixel water masking |
| NPC sprites | Canvas2D | 0-10 | Y-sorted with player |
| Field effects | Canvas2D | 5-20 | Grass, sand, ripples |
| Door animations | Canvas2D | 0-2 | Temporary overlays |
| Arrow overlay | Canvas2D | 0-1 | Warp indicator |
| Fade overlay | ~~Canvas2D~~ WebGL | 0-1 | WebGLFadeRenderer fullscreen quad |

---

## Current Architecture

### Render Order (WebGLMapPage.tsx:830-974)

```typescript
// 1-2. WebGL tile passes
pipeline.render(ctx, view, playerElevation, options);

// 3. Composite background + topBelow
pipeline.compositeBackgroundOnly(ctx2d, view);
pipeline.compositeTopBelowOnly(ctx2d, view);    // GPU→CPU copy #1

// 4-8. Canvas2D sprite rendering
doorAnimations.render(ctx2d, view, nowTime);
renderPlayerReflection(ctx2d, player, reflectionState, ...);
ObjectRenderer.renderFieldEffects(ctx2d, effects, sprites, view, playerWorldY, 'bottom');
player.render(ctx2d, cameraX, cameraY);
ObjectRenderer.renderFieldEffects(ctx2d, effects, sprites, view, playerWorldY, 'top');

// 9. Composite topAbove
pipeline.compositeTopAbove(ctx2d, view);        // GPU→CPU copy #2

// 10. Fade overlay
fade.render(ctx2d, viewportWidth, viewportHeight, nowTime);
```

### Elevation/Priority System

The `ElevationFilter` class splits the top layer based on player elevation:

```typescript
// Player elevation 3 (under bridge): all top tiles render ABOVE player
// Player elevation 4 (on bridge): bridge tiles render BELOW, ground ABOVE

createFilter(playerElevation) {
  const playerPriority = getSpritePriorityForElevation(playerElevation);
  const playerAboveTopLayer = playerPriority <= 1;

  return {
    below: (tile) => playerAboveTopLayer && !(sameElevation && blocked),
    above: (tile) => !playerAboveTopLayer || (sameElevation && blocked)
  };
}
```

This must be preserved in the WebGL implementation.

---

## Proposed Architecture

### New Render Order (Single GPU Pipeline)

```
Proposed Frame Pipeline:
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. GPU: Render Background tiles to combined framebuffer                  │
│ 2. GPU: Render TopBelow tiles to combined framebuffer                    │
│ 3. GPU: Render sprites to combined framebuffer (single batch, Y-sorted)  │
│    ├── Reflections (with texture-based water pixel masking)              │
│    ├── Field effects (subpriority < player)                              │
│    ├── Player + NPCs (Y-sorted)                                          │
│    ├── Field effects (subpriority >= player)                             │
│    └── Door animations, arrow overlays                                   │
│ 4. GPU: Render TopAbove tiles to combined framebuffer                    │
│ 5. GPU: Render fade overlay (fullscreen quad with alpha)                 │
│ 6. GPU→CPU: Single composite to screen canvas                            │
└──────────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- **1 composite vs 3** - eliminates 2 GPU sync points
- **Unified Z-sorting** - all sprites sorted in single pass
- **GPU effects** - reflections, weather, time-of-day possible
- **Simpler code** - one pipeline, not hybrid

### Component Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WebGLRenderPipeline                             │
├─────────────────────────────────────────────────────────────────────────┤
│  WebGLTileRenderer          │  WebGLSpriteRenderer (NEW)                │
│  ├── TileInstanceBuilder    │  ├── SpriteInstanceBuilder               │
│  ├── Tile shaders           │  ├── Sprite shaders                      │
│  └── Tileset textures       │  ├── Sprite texture atlas                │
│                             │  └── Reflection mask texture             │
├─────────────────────────────────────────────────────────────────────────┤
│  WebGLFramebufferManager    │  WebGLTextureManager                      │
│  └── Combined framebuffer   │  └── Sprite atlas management             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. WebGLSpriteRenderer

**Location:** `src/rendering/webgl/WebGLSpriteRenderer.ts`

**Responsibilities:**
- Compile and manage sprite shaders
- Upload sprite textures to GPU
- Render sprite batches with instancing
- Handle sprite flipping (xflip, yflip)
- Support per-sprite alpha/tint for reflections

```typescript
interface SpriteInstance {
  x: number;           // Screen X position
  y: number;           // Screen Y position
  width: number;       // Sprite width (8, 16, 32, etc.)
  height: number;      // Sprite height
  atlasX: number;      // X offset in texture atlas
  atlasY: number;      // Y offset in texture atlas
  flipX: boolean;      // Horizontal flip
  flipY: boolean;      // Vertical flip (for reflections)
  alpha: number;       // Opacity (1.0 normal, 0.5 for reflections)
  tintR: number;       // Tint red (for water/ice reflections)
  tintG: number;       // Tint green
  tintB: number;       // Tint blue
  sortKey: number;     // Y-position + subpriority for sorting
}

class WebGLSpriteRenderer {
  initialize(): void;
  uploadSpriteAtlas(name: string, imageData: ImageData, width: number, height: number): void;
  renderBatch(sprites: SpriteInstance[], viewportWidth: number, viewportHeight: number): void;
  dispose(): void;
}
```

### 2. SpriteInstanceBuilder

**Location:** `src/rendering/webgl/SpriteInstanceBuilder.ts`

**Responsibilities:**
- Build sprite instance arrays from game state
- Sort sprites by Y-position + subpriority
- Pack sprite data for GPU upload

```typescript
class SpriteInstanceBuilder {
  private instances: SpriteInstance[] = [];

  clear(): void;

  addPlayer(player: PlayerController, cameraX: number, cameraY: number): void;
  addNPCs(npcs: NPCController[], cameraX: number, cameraY: number): void;
  addFieldEffects(effects: FieldEffectForRendering[], sprites: SpriteAtlasInfo): void;
  addDoorAnimations(doors: DoorAnimation[], cameraX: number, cameraY: number): void;
  addReflection(sprite: SpriteInstance, reflectionType: 'water' | 'ice'): void;

  // Sort by sortKey and return packed Float32Array
  buildAndSort(): Float32Array;
}
```

### 3. WebGLSpriteAtlas

**Location:** `src/rendering/webgl/WebGLSpriteAtlas.ts`

**Responsibilities:**
- Pack multiple sprite sheets into a single texture atlas
- Track sprite locations within atlas
- Support dynamic atlas updates (door animation frames)

```typescript
interface AtlasRegion {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  frameWidth: number;   // For animated sprites
  frameHeight: number;
  frameCount: number;
}

class WebGLSpriteAtlas {
  private gl: WebGL2RenderingContext;
  private texture: WebGLTexture;
  private regions: Map<string, AtlasRegion>;

  constructor(gl: WebGL2RenderingContext, maxSize: number);

  addSprite(name: string, canvas: HTMLCanvasElement, frameWidth?: number, frameHeight?: number): AtlasRegion;
  getRegion(name: string): AtlasRegion | undefined;
  getTexture(): WebGLTexture;

  dispose(): void;
}
```

### 4. WebGLWaterMask (Unified Water-Surface Masking)

**Location:** `src/rendering/webgl/WebGLWaterMask.ts`

**Responsibilities:**
- Build per-pixel water mask texture from tile `pixelMask` data
- Upload mask to GPU as R8 texture (texture unit 7)
- Track dirty state and rebuild when camera moves
- **Used by ALL water-surface effects, not just reflections**

**Why texture-based masking (not stencil):**
1. WebGLContext has `stencil: false` - no stencil buffer available
2. Texture masking is more flexible and doesn't require context recreation
3. GBA uses BG1 overlay transparency for masking; we replicate this with a mask texture

**How GBA does it (for reference):**
- **ALL sprites at OAM priority 3** render behind BG1 layer
- Shoreline metatiles have BG1 overlay with transparent pixels on water, opaque on ground
- BG1 naturally occludes **any** priority-3 sprite on ground pixels
- This includes: reflections, puddle splashes, water ripples

**Sprites that need water masking (OAM priority 3 on GBA):**
| Effect | GBA Priority | Needs Mask |
|--------|-------------|------------|
| Player/NPC reflection | 3 | ✅ Yes |
| Puddle splash | 3 | ✅ Yes |
| Water ripple | 3 | ✅ Yes |
| Grass rustling | 1-2 | ❌ No |
| Sand footprints | 1-2 | ❌ No |

**Our approach:**
- Build mask texture from each metatile's `pixelMask` (water=1, ground=0)
- Sample mask in fragment shader for any water-surface sprite
- Discard pixels where mask < 0.5

```typescript
class WebGLWaterMask {
  private maskTexture: WebGLTexture;
  private dirty: boolean = true;

  // Build mask from visible water tiles' pixelMask data
  buildMaskTexture(
    visibleTiles: Array<{x: number, y: number, pixelMask: Uint8Array}>,
    viewportWidth: number,
    viewportHeight: number
  ): void;

  // Upload to GPU
  uploadMaskTexture(gl: WebGL2RenderingContext, textureUnit: number): void;

  // Mark dirty when camera moves
  invalidate(): void;

  // Check if a sprite type needs water masking
  static needsWaterMask(spriteType: SpriteType): boolean {
    return spriteType === 'reflection'
        || spriteType === 'puddle_splash'
        || spriteType === 'water_ripple';
  }
}
```

---

## Shader Design

### Sprite Vertex Shader

```glsl
#version 300 es
precision highp float;

// Per-vertex (quad corners)
in vec2 a_position;  // (0,0), (1,0), (0,1), (1,1)

// Per-instance
in vec4 a_spriteRect;    // x, y, width, height (screen coords)
in vec4 a_atlasRect;     // x, y, width, height (atlas coords, normalized)
in vec4 a_colorMod;      // r, g, b, a (tint + alpha)
in float a_flags;        // packed: flipX, flipY

uniform vec2 u_viewportSize;
uniform vec2 u_atlasSize;

out vec2 v_texCoord;
out vec4 v_colorMod;

void main() {
  // Unpack flags
  float flagsVal = floor(a_flags);
  bool flipX = mod(flagsVal, 2.0) > 0.5;
  bool flipY = mod(floor(flagsVal / 2.0), 2.0) > 0.5;

  // Calculate vertex position
  vec2 localPos = a_position;
  vec2 screenPos = a_spriteRect.xy + localPos * a_spriteRect.zw;

  // Convert to clip space
  vec2 clipPos = (screenPos / u_viewportSize) * 2.0 - 1.0;
  clipPos.y = -clipPos.y;

  gl_Position = vec4(clipPos, 0.0, 1.0);

  // Calculate texture coordinates with flip
  vec2 texCoord = localPos;
  if (flipX) texCoord.x = 1.0 - texCoord.x;
  if (flipY) texCoord.y = 1.0 - texCoord.y;

  // Map to atlas region
  v_texCoord = a_atlasRect.xy + texCoord * a_atlasRect.zw;
  v_colorMod = a_colorMod;
}
```

### Sprite Fragment Shader

```glsl
#version 300 es
precision highp float;

in vec2 v_texCoord;
in vec4 v_colorMod;

uniform sampler2D u_atlas;

out vec4 fragColor;

void main() {
  vec4 texColor = texture(u_atlas, v_texCoord);

  // Discard transparent pixels
  if (texColor.a < 0.01) {
    discard;
  }

  // Apply tint (multiply RGB) and alpha
  fragColor = vec4(texColor.rgb * v_colorMod.rgb, texColor.a * v_colorMod.a);
}
```

### Reflection Fragment Shader (Water Masking + GBA Shimmer)

For rendering reflections with per-pixel water masking AND pixel-perfect GBA shimmer:

```glsl
#version 300 es
precision highp float;

in vec2 v_texCoord;
in vec4 v_colorMod;
in vec2 v_atlasRegion;     // xy = atlas region origin (normalized)
in vec2 v_atlasRegionSize; // Size of sprite in atlas (normalized)

uniform sampler2D u_spriteAtlas;
uniform sampler2D u_waterMask;  // R8 texture: water=1.0, ground=0.0
uniform ivec2 u_atlasSize;      // Atlas dimensions in pixels

// Water mask alignment
uniform vec2 u_maskOffset;
uniform vec2 u_maskSize;

// Shimmer uniforms (water reflections only, NOT ice)
uniform float u_shimmerScale;   // 0.984375 to 1.015625 (from ReflectionShimmer)
uniform bool u_shimmerEnabled;  // false for ice reflections

out vec4 fragColor;

void main() {
  vec2 sampleCoord = v_texCoord;

  // ========== GBA SHIMMER (PIXEL-PERFECT) ==========
  // This MUST match applyGbaAffineShimmer() exactly!
  // GBA uses per-pixel inverse affine transform with floor() for nearest-neighbor
  if (u_shimmerEnabled && abs(u_shimmerScale - 1.0) > 0.0001) {
    // Convert to local sprite coordinates (0-1 within sprite)
    vec2 localCoord = (v_texCoord - v_atlasRegion) / v_atlasRegionSize;

    // Inverse affine transform centered on sprite (same as GBA)
    float invScale = 1.0 / u_shimmerScale;
    float centerX = 0.5;
    localCoord.x = centerX + (localCoord.x - centerX) * invScale;

    // Convert back to atlas coordinates
    sampleCoord = v_atlasRegion + localCoord * v_atlasRegionSize;
  }

  // ========== NEAREST-NEIGHBOR SAMPLING (GBA-ACCURATE) ==========
  // Use texelFetch with floor() - NOT texture() which interpolates!
  ivec2 texelCoord = ivec2(floor(sampleCoord * vec2(u_atlasSize)));

  // Bounds check (shimmer can push coords outside sprite)
  ivec2 regionStart = ivec2(v_atlasRegion * vec2(u_atlasSize));
  ivec2 regionEnd = regionStart + ivec2(v_atlasRegionSize * vec2(u_atlasSize));
  if (texelCoord.x < regionStart.x || texelCoord.x >= regionEnd.x) {
    discard;  // Outside sprite bounds after shimmer transform
  }

  vec4 texColor = texelFetch(u_spriteAtlas, texelCoord, 0);

  // Discard transparent pixels
  if (texColor.a < 0.01) {
    discard;
  }

  // ========== WATER MASK (BG1 OVERLAY REPLICATION) ==========
  vec2 maskCoord = (gl_FragCoord.xy + u_maskOffset) / u_maskSize;
  float isWater = texture(u_waterMask, maskCoord).r;

  if (isWater < 0.5) {
    discard;  // Ground pixel - occluded by BG1
  }

  // Apply tint and alpha
  fragColor = vec4(texColor.rgb * v_colorMod.rgb, texColor.a * v_colorMod.a);
}
```

**GBA Parity Requirements:**
1. **Shimmer transform**: Centered inverse scale with `floor()` for nearest-neighbor (NOT linear interpolation)
2. **Sampling**: `texelFetch()` with integer coordinates (NOT `texture()` which interpolates)
3. **48-frame loop**: Scale from `ReflectionShimmer.getScaleX(matrixNum)` at 59.73 Hz
4. **Matrix selection**: Matrix 0 for W/N/S facing, Matrix 1 for E facing (H-flipped sprites)
5. **Water only**: Shimmer disabled for ice reflections

**Validation**: Frame-by-frame comparison with Canvas2D `applyGbaAffineShimmer()` output. Must be IDENTICAL.

---

## Implementation Phases

### Phase 1: Core Sprite Renderer (~200 lines)

**Goal:** Render player sprite via WebGL

**Files:**
- `src/rendering/webgl/WebGLSpriteShaders.ts` - Shader source code
- `src/rendering/webgl/WebGLSpriteRenderer.ts` - Sprite rendering logic

**Tasks:**
1. Create sprite vertex/fragment shaders
2. Implement basic sprite batch rendering
3. Upload player sprite sheet as texture
4. Render player in correct position (no sorting yet)

**Validation:** Player renders correctly, no visual difference from Canvas2D

### Phase 2: Sprite Atlas + Field Effects (~150 lines)

**Goal:** Render all field effect sprites via WebGL

**Files:**
- `src/rendering/webgl/WebGLSpriteAtlas.ts` - Texture atlas management
- `src/rendering/webgl/SpriteInstanceBuilder.ts` - Instance building

**Tasks:**
1. Create sprite atlas from field effect PNGs
2. Implement SpriteInstanceBuilder for field effects
3. Add Y-sorting logic
4. Render grass, sand, ripples via WebGL

**Validation:** Field effects render correctly with proper Y-sorting

### Phase 3: Unified Render Pipeline (~100 lines)

**Goal:** Single-pass sprite rendering, eliminate hybrid compositing

**Files:**
- `src/rendering/webgl/WebGLRenderPipeline.ts` - Pipeline modifications
- `src/pages/WebGLMapPage.tsx` - Render loop changes

**Tasks:**
1. Modify pipeline to render sprites between tile passes
2. Remove intermediate `composite*` calls
3. Single final composite to screen
4. Add door animations and arrow overlay to sprite batch

**Validation:** 1 composite instead of 3, same visual output

### Phase 4: Reflections (~150 lines)

**Goal:** GPU-accelerated reflection rendering with per-pixel water masking

**⚠️ Key finding:** GBA achieves per-pixel masking via BG1 overlay transparency (shoreline metatiles have opaque ground, transparent water on BG1). We must replicate this with texture masking, plus handle smooth sub-pixel movement.

**Phase 4a - Basic Reflection Sprite (~50 lines):**
1. Add reflection as sprite instance with `flipY=true`
2. Calculate Y position: `spriteY + height - 2 + bridgeOffset`
3. Apply tint via colorMod:
   - Water: `(0.27, 0.47, 0.78, 0.65)`
   - Ice: `(0.7, 0.86, 1.0, 0.65)`
   - Bridge: `(0.29, 0.45, 0.67, 0.6)`
4. Shimmer via `u_shimmerScale` uniform (water only)

**Phase 4b - Per-Pixel Water Masking (~100 lines):**
Required for smooth movement - character can be between water/ground tiles.

1. Build mask texture from visible water tiles' `pixelMask` data
2. Upload mask to texture unit 7 (R8 format)
3. Add reflection fragment shader variant that samples mask
4. Discard pixels where mask < 0.5

**Alternative approach:** Use tile-based visibility for stationary, mask only during movement (optimization)

**Validation:**
- Reflection ONLY appears on water pixels
- No reflection visible on ground during movement between tiles

### Phase 5: Cleanup + NPC Support (~100 lines)

**Goal:** Remove Canvas2D sprite code, add NPC support

**Tasks:**
1. Add NPC sprites to sprite atlas
2. Include NPCs in sprite batch with Y-sorting
3. Remove `ObjectRenderer` Canvas2D code
4. Remove hybrid rendering code paths

**Validation:** Full WebGL rendering, no Canvas2D sprite code

---

## Detailed Checklist

### Phase 1-4: Core WebGL Sprite Rendering ✅ COMPLETE

These phases are implemented in `WebGLMapPage.tsx` and related files.

- [x] `WebGLSpriteShaders.ts` - Vertex and fragment shaders for sprites
- [x] `WebGLSpriteRenderer.ts` - GPU-accelerated sprite batching
- [x] `ISpriteRenderer.ts` - Renderer-agnostic interface
- [x] `spriteUtils.ts` - Convert game objects to SpriteInstance
- [x] Player sprite rendering with flip and animation
- [x] NPC sprite rendering with direction-based frames
- [x] Field effects (grass, sand, splash, ripple)
- [x] Reflection rendering with shimmer and water masking
- [x] Split layer rendering for reflection occlusion
- [x] Door animations via shared hooks
- [x] Arrow overlay via shared hooks
- [x] Warp system via shared WarpExecutor

---

### Phase 5: Complete WebGL Feature Parity

#### 5.1 Add Surf Blob Rendering to WebGL

**Reference:** `src/hooks/useCompositeScene.ts:198-242`

- [ ] Create `createSurfBlobSprite()` in `spriteUtils.ts`
  - [ ] Calculate blob world position based on surf state (mounting/dismounting/normal)
  - [ ] Apply bob offset from `blobRenderer.getBobOffset()`
  - [ ] Handle fixed position during dismount via `surfCtrl.getBlobFixedPosition()`
  - [ ] Set appropriate sort key (render before player)

- [ ] Upload surf blob sprite sheet in WebGLMapPage
  - [ ] Add blob sprite loading similar to player sprites
  - [ ] Use `getPlayerAtlasName('surfing')` or create separate blob atlas

- [ ] Add blob to sprite batch when surfing/jumping
  - [ ] Check `player.isSurfing() || surfCtrl.isJumping()`
  - [ ] Include in sprite array before player sprite

- [ ] **TEST**: Blob appears when entering water
- [ ] **TEST**: Blob stays in place during dismount animation
- [ ] **TEST**: Blob bobs up and down correctly

#### 5.2 Add Item Ball Rendering to WebGL

**Reference:** `src/components/map/renderers/ObjectRenderer.ts:436-479`

- [ ] Create `createItemBallSprite()` in `spriteUtils.ts`
  - [ ] Convert `ItemBallObject` to `SpriteInstance`
  - [ ] World position: `tileX * 16, tileY * 16`
  - [ ] Single 16x16 frame (no animation)
  - [ ] Y-sorting: items at Y < playerY behind, Y >= playerY in front

- [ ] Upload item ball sprite in WebGLMapPage
  - [ ] Add to field sprites loading (`fieldSprites.sprites.itemBall`)
  - [ ] Upload with `getFieldEffectAtlasName('itemBall')`

- [ ] Add items to sprite batch
  - [ ] Get visible items from `objectEventManagerRef.current.getVisibleItemBalls()`
  - [ ] Create sprites for both bottom and top layers

- [ ] **TEST**: Item balls render at correct positions
- [ ] **TEST**: Items appear behind/in front of player correctly

#### 5.3 Add NPC Grass Effect Rendering to WebGL ✅ DONE

**Reference:** `src/game/npc/renderNPCGrassEffects.ts`

- [x] Create `createNPCGrassEffectSprite()` in `spriteUtils.ts`
  - [x] Check NPC's current tile for grass behavior
  - [x] Use same grass sprite as player effects
  - [x] Position at NPC's feet (centered on tile)

- [x] Add NPC grass effects to sprite batch
  - [x] After adding NPC sprites, add their grass effects
  - [x] Only for NPCs in tall/long grass tiles

- [ ] **TEST**: Grass covers NPC lower body like player
- [ ] **TEST**: Works with moving NPCs (when implemented)

#### 5.4 Add Long Grass Clipping to WebGL ✅ DONE

**Reference:** `src/game/PlayerController.ts` - `isOnLongGrass()`

- [x] Check `player.isOnLongGrass()` flag when creating player sprite
- [x] Pass `clipToHalf` parameter to `createSpriteFromFrameInfo()`
- [x] Sprite height and srcHeight reduced to 50% (shows only top half)

**Note:** Used sprite height clipping instead of scissor test - cleaner approach that stays in the batched render path.

- [ ] **TEST**: Player clipped at waist in long grass
- [ ] **TEST**: No visual artifacts at grass edge

#### 5.5 Add Priority-Based NPC Layer Separation ✅ DONE

**Reference:** `src/hooks/useCompositeScene.ts:282-288`, GBA `sElevationToPriority[]`

NPCs are categorized into three priority groups based on elevation:
- **Low priority (P2/P3)** - Elevation 0-3, 5, 7, 9, 11, 15 → Render BEFORE TopBelow (behind bridges)
- **Normal priority (P1)** - Elevation 4, 6, 8, 10, 12 → Render with player (Y-sorted)
- **High priority (P0)** - Elevation 13, 14 → Render AFTER TopAbove (above everything)

**Important:** Low priority NPCs only render in `lowPrioritySprites` batch when the PLAYER is at a higher priority (P1 - on bridge). When player is also at P2 (ground level), NPCs render normally with Y-sorting. This prevents NPCs from incorrectly appearing behind distant bridge tiles.

- [x] Update NPC sprite building to track priority
  - [x] Get NPC priority from `getSpritePriorityForElevation(npc.elevation)`
  - [x] Compare with player priority to determine render batch
  - [x] Only use lowPrioritySprites when `playerPriority < npcPriority`

- [x] Render low priority NPCs BEFORE topBelow layer
  - [x] These are ground-level NPCs that should appear BEHIND bridges
  - [x] Added `lowPrioritySprites` array for P2/P3 NPCs
  - [x] Separate WebGL batch render before `compositeTopBelowOnly()`

- [x] Render priority 0 NPCs AFTER topAbove layer
  - [x] These are "flying" NPCs that appear above everything
  - [x] Hoisted `priority0Sprites` array to outer scope for access after TopAbove
  - [x] Separate WebGL batch render after `compositeTopAbove()`

- [x] Handle reflections for low priority NPCs
  - [x] Added `lowPriorityReflections` array for P2/P3 NPC reflections
  - [x] Render reflections in reflection path before TopBelow

- [x] **TEST**: Low-elevation NPCs (E0-3) render behind bridges on VICTORY_ROAD_1F
- [x] **TEST**: Low-elevation NPCs render normally when player is also at ground level (Route 104 twins)
- [ ] **TEST**: High-elevation NPCs render above bridges

---

### Phase 6: Clean Mode Separation (No Hybrid Fallback)

**Philosophy:** Either WebGL works fully OR we use full Canvas2D. No hybrid in-between.

```
User opens app
    ↓
WebGL2 supported?
    ├── YES → WebGLMapPage (full WebGL rendering)
    └── NO  → MapRenderer (full Canvas2D rendering)
```

#### 6.1 Remove Canvas2D Fallback from WebGLMapPage ✅ DONE

**Goal:** WebGLMapPage is 100% WebGL - if WebGL fails, redirect to Canvas2D mode

- [x] Remove Canvas2D fallback path in WebGLMapPage render loop
  - [x] Delete the `else` branch (Canvas2D sprite fallback using ObjectRenderer)
  - [x] If `spriteRenderer` is invalid, redirect to Canvas2D mode

- [x] Add WebGL capability check on page load
  - [x] If WebGL2 not supported, redirect to `/#/` (Canvas2D App)
  - [x] Console warning message about fallback

- [x] Remove `ObjectRenderer` usage from WebGLMapPage
  - [x] All sprite rendering via `WebGLSpriteRenderer`
  - [x] Arrow overlay inlined (no ObjectRenderer dependency)
  - [x] Removed `objView` variable (no longer needed)

#### 6.2 Keep MapRenderer as Full Canvas2D Mode ✅ ALREADY DONE

**Goal:** MapRenderer stays as the complete Canvas2D implementation

- [x] MapRenderer continues to use:
  - [x] `RenderPipeline` (Canvas2D tile rendering)
  - [x] `ObjectRenderer` (Canvas2D sprite rendering)
  - [x] `useCompositeScene` (Canvas2D compositing)

- [x] No changes needed - it's already the full Canvas2D path

#### 6.3 Shared Code Between Modes

**Goal:** Maximize code reuse without hybrid rendering

**Shared (renderer-agnostic):**
| Component | Location | Notes |
|-----------|----------|-------|
| `PlayerController` | `src/game/` | Movement, animation state |
| `ObjectEventManager` | `src/game/` | NPC management |
| `ReflectionShimmer` | `src/field/` | 48-frame animation timing |
| `computeReflectionState()` | `src/field/` | Detection logic |
| `FadeController` | `src/field/` | Fade timing |
| `useDoorAnimations` | `src/hooks/` | Door sprite loading, animation state |
| `useDoorSequencer` | `src/hooks/` | Door/warp state machine |
| `WarpExecutor` | `src/game/` | Warp logic |

**Mode-specific:**
| Feature | WebGL Mode | Canvas2D Mode |
|---------|------------|---------------|
| Tile rendering | `WebGLRenderPipeline` | `RenderPipeline` |
| Sprite rendering | `WebGLSpriteRenderer` | `ObjectRenderer` |
| Scene compositing | Inline in WebGLMapPage | `useCompositeScene` |
| World state | `WorldManager` + snapshots | `MapManager` + RenderContext |

#### 6.4 Future: Optional Unified GameRenderer

**Goal:** Eventually merge into single component with renderer selection

This is OPTIONAL and can be done later. For now, two separate pages is fine:
- `/#/webgl-map` → WebGLMapPage (WebGL mode)
- `/#/map` → MapRenderer (Canvas2D mode)

- [ ] (Future) Create `GameRenderer` that:
  - [ ] Detects WebGL2 support
  - [ ] Instantiates appropriate pipeline/renderer
  - [ ] Uses shared game logic hooks
  - [ ] Switches render implementation at component level, not per-frame

---

### Phase 7: Cleanup and Optimization

#### 7.1 Clean Up WebGLMapPage ✅ DONE

- [x] Remove Canvas2D fallback code from WebGLMapPage
  - [x] `ObjectRenderer` NOT imported (all sprites via WebGL)
  - [x] No fallback `else` branch for sprite rendering
  - [x] All field effects, reflections, NPCs rendered via WebGLSpriteRenderer

- [x] Door animations and arrow overlay converted to WebGL
  - [x] Doors use `createDoorAnimationSprite()` → WebGL sprite batch
  - [x] Arrows use inline sprite creation → WebGL sprite batch
  - [x] Reuses shared hooks (`useDoorAnimations`, `useArrowOverlay`) for state management
  - [x] Fade overlay uses `WebGLFadeRenderer` fullscreen quad

#### 7.2 Keep ObjectRenderer for Canvas2D Mode

**Note:** `ObjectRenderer` stays for MapRenderer (Canvas2D mode) - it's NOT duplicate code, it's the Canvas2D implementation.

- [ ] `ObjectRenderer` methods stay as-is:
  - [ ] `renderFieldEffects()` - used by MapRenderer
  - [ ] `renderReflection()` - used by MapRenderer
  - [ ] `renderArrow()` - used by MapRenderer
  - [ ] `renderItemBalls()` - used by MapRenderer

- [ ] WebGL equivalents are in `spriteUtils.ts` + `WebGLSpriteRenderer`

#### 7.3 Performance Optimization

- [ ] Profile WebGL vs Canvas2D performance
  - [ ] Measure FPS on various maps
  - [ ] Measure frame time breakdown

- [ ] Optimize water mask rebuilding
  - [ ] Only rebuild when camera crosses tile boundary
  - [ ] Use dirty tracking similar to DirtyRegionTracker

- [ ] Optimize sprite batching
  - [ ] Pool Float32Array for instance data
  - [ ] Minimize array allocations per frame

#### 7.4 Documentation

- [ ] Update architecture diagram showing two separate paths
- [ ] Document when to use WebGL vs Canvas2D mode
- [ ] Add inline comments for GBA parity decisions

---

## Micro-Step Implementation Guide

For each feature, follow this pattern:

### Step Pattern Template

```
1. Read the Canvas2D implementation to understand the feature
2. Identify the GBA C code reference (if applicable)
3. Create/update spriteUtils helper function
4. Add sprite building to WebGLMapPage render loop
5. Test in isolation (single map, specific scenario)
6. Test edge cases (boundaries, transitions)
7. Commit with descriptive message
```

### Example: Adding Surf Blob

```
Step 1: Read useCompositeScene.ts:198-242
Step 2: Reference field_effect_helpers.c SynchroniseSurfPosition
Step 3: Create createSurfBlobSprite() in spriteUtils.ts
Step 4: Add to WebGLMapPage after field effects, before player
Step 5: Test on Route 102/103 (water areas)
Step 6: Test mounting/dismounting animation
Step 7: Commit "feat(webgl): add surf blob sprite rendering"
```

---

## GBA Reference Code Locations

| Feature | File | Function/Lines |
|---------|------|----------------|
| Reflection creation | `field_effect_helpers.c` | `SetUpReflection()` L47-68 |
| Reflection update | `field_effect_helpers.c` | `UpdateObjectReflectionSprite()` L124-163 |
| Reflection type detection | `event_object_movement.c` | `ObjectEventGetNearbyReflectionType()` L7625-7650 |
| Shimmer animation | `field_effect_objects.h` | `sAffineAnim_ReflectionDistortion_*` L849-892 |
| Bridge palette | `field_effect_helpers.c` | `LoadObjectHighBridgeReflectionPalette()` L114-122 |
| Surf blob | `field_effect_helpers.c` | `SynchroniseSurfPosition()`, `UpdateBobbingEffect()` |
| Grass effect | `field_effect_helpers.c` | `UpdateGrassFieldEffectSubpriority()` |
| Arrow warp | `field_effect_helpers.c` | `CreateWarpArrowSprite()`, `ShowWarpArrowSprite()` L175-200 |
| OAM priority | `event_object_movement.c` | `sElevationToPriority[]` |

---

## Testing Checklist by Map Type

### Water Areas (Route 102, 103, 110)
- [ ] Reflection shows on water
- [ ] Reflection hidden on shore edges
- [ ] Shimmer animation runs
- [ ] Surf blob appears/disappears correctly

### Bridge Areas (Route 110, 119, 120)
- [ ] Player under bridge renders correctly
- [ ] Player on bridge elevation works
- [ ] Reflection uses dark blue tint on pond bridges
- [ ] Reflection Y offset correct for bridge height

### Grass Areas (Route 101, 102)
- [ ] Tall grass covers player feet
- [ ] Long grass clips player at waist
- [ ] Sand footprints appear and fade
- [ ] Grass effects Y-sort with player

### Indoor Areas (Pokemon Centers, Houses)
- [ ] Door animations work
- [ ] Arrow warps work
- [ ] No reflections on non-water tiles
- [ ] NPCs render correctly

### Town Areas (Littleroot, Oldale)
- [ ] Item balls visible
- [ ] NPCs visible with correct direction
- [ ] Warp transitions smooth
- [ ] No visual artifacts at map boundaries

---

## Risk Assessment

### MEDIUM Risk: Water-Surface Masking (Replicating GBA BG1 Overlay)

**How GBA handles this:**
- **ALL sprites at OAM priority 3** render behind BG1 layer
- Shoreline metatiles (177, 200, 202, etc.) have BG1 overlay with transparent pixels on water, opaque on ground
- BG1 naturally occludes **any priority-3 sprite** on ground pixels via hardware compositing
- This masks: reflections, puddle splashes, water ripples - all with ONE mechanism

**Sprites that need water masking:**
| Effect | GBA Priority | Why |
|--------|-------------|-----|
| Player/NPC reflection | 3 | Continuous, follows player |
| Puddle splash | 3 | One-shot, but spans partial tiles |
| Water ripple | 3 | One-shot, but spans partial tiles |

**Why WE need explicit masking:**
1. We don't have GBA's layer-priority hardware compositing
2. Our smooth sub-pixel movement means sprites can span water+ground in one frame
3. We must replicate the BG1 overlay behavior in software via texture masking

**Challenges:**
- Must build mask texture from visible water tiles' `pixelMask` data (same data the Canvas2D path uses)
- Mask must update when camera/player moves
- Need to align mask coordinates with sprite position in fragment shader
- **Same mask texture serves ALL water-surface effects** (simplifies implementation)

**Mitigation:**
- Cache mask texture, rebuild only when camera moves by full tile
- Use R8 format for minimal memory (1 byte per pixel)
- Use existing `pixelMask` data from tiles (already computed for Canvas2D path)
- Single `WebGLWaterMask` component reused by reflections, puddles, ripples

**Phase 4a (LOW risk):** Basic reflection sprite with V-flip + tint
**Phase 4b (MEDIUM risk):** Per-pixel masking for all water-surface effects

### LOW Risk: Texture Atlas Size (GBA Pattern: Bitmap Allocation)

**Risk:** All sprites must fit in one atlas for single-batch rendering.

**How GBA handles this (32KB VRAM!):**
```c
// 128-byte bitmap tracks 1024 tile slots - O(1) alloc/dealloc
static u8 sSpriteTileAllocBitmap[128];
#define ALLOC_SPRITE_TILE(n) (sSpriteTileAllocBitmap[(n)/8] |= (1 << ((n)%8)))
```
- GBA fits ALL overworld sprites in 32KB
- Uses bitmap allocation for contiguous free-space finding
- Tag system for bulk alloc/free of sprite sheets

**Why this is LOW risk for us:**
- We have 2048x2048 atlas = **16MB** vs GBA's 32KB (500x more space)
- Player (256x256) + field effects + doors + NPCs ≈ 500KB total
- Bitmap allocation pattern ensures no fragmentation
- Can lazy-load sprite sheets on demand, free when despawned

### LOW Risk: Y-Sorting Precision (GBA Pattern: Incremental Insertion Sort)

**Risk:** Float precision for sort keys across large worlds.

**How GBA handles this:**
```c
// Two-level priority: [oam.priority:2 bits][subpriority:8 bits]
u16 priority = sprite->subpriority | (sprite->oam.priority << 8);

// Insertion sort - O(n) when mostly sorted (typical case)
while (prevPriority > currentPriority ||
       (prevPriority == currentPriority && prevY < currentY)) {
    swap(renderOrder[j], renderOrder[j-1]);
}
```
- Composite sort key fits in 16 bits
- Incremental sort: sprites mostly stay in order between frames
- Only re-sorts sprites that actually moved

**Why this is LOW risk for us:**
- Use 32-bit integer sort keys: `(layer << 24) | (subpriority << 16) | (yPos & 0xFFFF)`
- World coordinates bounded (< 10000 tiles = fits in 16 bits)
- Same incremental sort pattern: O(n) typical case

### LOW Risk: Performance Regression (GBA Pattern: Phased Rendering)

**Risk:** Instanced sprite rendering might not be faster than Canvas2D for small sprite counts.

**How GBA handles this (16.78 MHz CPU!):**
```c
void BuildOamBuffer(void) {
    UpdateOamCoords();         // Phase 1: positions
    BuildSpritePriorities();   // Phase 2: sort keys
    SortSprites();             // Phase 3: incremental sort
    AddSpritesToOamBuffer();   // Phase 4: build buffer
    // Phase 5: DMA copy at VBlank (hardware accelerated)
}
```
- Decoupled update/render phases
- Buffer in fast RAM, bulk DMA to hardware
- Deferred tile copies spread across frames

**Why this is LOW risk for us:**
- Main win: eliminating 2 GPU→CPU composite round-trips
- Single instanced draw call vs multiple `drawImage()` calls
- GPU handles sorting implicitly via depth buffer (if needed)
- Even worst case: same sprite performance, better overall frame time

---

## File Summary (Corrected After Deep GBA Investigation)

| File | Lines | Phase | Notes |
|------|-------|-------|-------|
| `WebGLSpriteShaders.ts` | ~100 | 1,4 | Includes reflection mask shader variant |
| `WebGLSpriteRenderer.ts` | ~250 | 1-4 | Handles mask texture upload/sampling |
| `WebGLSpriteAtlas.ts` | ~120 | 2 | Bitmap-based allocation (GBA pattern) |
| `SpriteInstanceBuilder.ts` | ~150 | 2-5 | Includes reflection as sprite instance |
| `WebGLWaterMask.ts` | ~100 | 4b | Build mask texture for all water-surface effects |
| Pipeline/Page updates | ~100 | 3-5 | |
| **Total** | **~820** | | |

**Estimated reduction after cleanup:** ~200 lines removed from ObjectRenderer and hybrid code

**Net change:** +620 lines, cleaner architecture and better performance

**Key insights from GBA analysis:**
- GBA DOES have per-pixel masking via BG1 overlay transparency (not binary on/off)
- Shoreline metatiles (177, 200, 202) bake the mask into BG1: opaque ground, transparent water
- **ALL sprites at OAM priority 3** are occluded by opaque BG1 pixels (reflections, puddles, ripples)
- ONE mechanism masks ALL water-surface effects - we replicate with single `WebGLWaterMask`
- We must replicate this BG1 overlay behavior via texture masking in fragment shader
- Our smooth sub-pixel movement adds an extra requirement: handling mid-tile overlap

---

## Implementation Notes

### Phase 1 Scope (Minimal First Implementation)

For Phase 1, focus on the absolute minimum to prove the approach works:

1. **Single sprite rendering** (not batched yet)
2. **Player sprite only** (16×32 or 32×32)
3. **Basic features:** position, flip, frame selection
4. **No reflections, no field effects, no sorting**

This allows testing the shader pipeline before adding complexity.

### Texture Unit Assignment

| Unit | Current Use | Sprite Renderer Use |
|------|------------|---------------------|
| 0-5 | Tileset pairs | (unchanged) |
| 6 | (free) | Sprite atlas |
| 7 | (free) | Reflection mask texture |
| 8-15 | (free) | Future use |

### Long Grass Clipping Strategy

Use scissor test for simplicity:
```typescript
if (player.inLongGrass) {
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(screenX, screenY, width, height / 2);
}
spriteRenderer.renderSprite(...);
if (player.inLongGrass) {
  gl.disable(gl.SCISSOR_TEST);
}
```
