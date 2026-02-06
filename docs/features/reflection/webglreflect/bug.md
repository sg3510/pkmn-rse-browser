---
title: Reflection Fix Plan: The Water Mask
status: bug
last_verified: 2026-01-13
---

# Reflection Fix Plan: The Water Mask

## The Root Cause
The previous attempt to fix reflections on non-reflective tiles (like grass) relied on **layer ordering**. It assumed that by drawing the non-reflective tile's layers *around* the reflection (Layer 0 -> Reflection -> Layer 1), the tile would naturally occlude the reflection.

This failed because many non-reflective tiles (e.g., standard grass) have:
1.  **Layer 0**: The base ground (opaque).
2.  **Layer 1**: Mostly transparent (or empty).

The rendering order became:
1.  **Layer 0 (Grass)**: Drawn.
2.  **Reflection**: Drawn on top of Layer 0.
3.  **Layer 1 (Grass)**: Drawn on top, but is transparent, so it reveals the reflection below.

**Result**: The reflection is visible on top of the grass.

## The GBA Reality
On the GBA, reflection logic is complex, involving priority battles between BG layers and Sprites. However, the behavior essentially acts as a **mask**:
-   Reflections are only visible where there is "Water" (BG0/Layer 0 in our terminology).
-   Reflections are hidden by "Land" (BG1/Layer 1 in our terminology).
-   Crucially, reflections are *also* hidden by "Grass" (BG2/Layer 0 in our terminology) because the GBA treats them as lower priority or masked.

## The Solution: Explicit Water Masking
We cannot rely on simple global layer sorting because "Grass" (non-reflective) and "Water" (reflective) often live on the same layer (Layer 0), yet one must occlude the reflection and the other must reveal it.

We must use the **Water Mask** (pixelMask) that is already computed in `tilesetUtils.ts`. This mask contains the exact data we need:
-   **1 (White)**: Pixel is water/reflective.
-   **0 (Black)**: Pixel is land/non-reflective.

### Implementation Steps

#### 1. Shader Support (`WebGLSpriteShaders.ts`)
We will restore the masking logic in `SPRITE_REFLECTION_FRAGMENT_SHADER`.
The shader will take a `u_waterMask` texture that corresponds 1:1 with the screen viewport.
It will sample this mask using `gl_FragCoord` (Screen Space) to determine if the pixel is allowed to reflect.

```glsl
// In SPRITE_REFLECTION_FRAGMENT_SHADER
uniform sampler2D u_waterMask;
uniform vec2 u_viewportSize;

void main() {
  // ... existing shimmer logic ...

  // Sample screen-space water mask
  vec2 maskUV = gl_FragCoord.xy / u_viewportSize;
  // Handle Y-flip if necessary (gl_FragCoord is bottom-up, texture might be top-down)
  maskUV.y = 1.0 - maskUV.y; 

  float maskVal = texture(u_waterMask, maskUV).r;
  if (maskVal < 0.1) discard;

  // ... existing output ...
}
```

#### 2. Mask Builder (`WaterMaskBuilder.ts`)
We need a helper to construct this 1:1 viewport mask texture on the CPU every frame (or when the camera moves).
While CPU iteration sounds slow, copying ~100KB of data (20x20 tiles) is negligible for JS/WebGL bandwidth (approx 0.2ms).

```typescript
export function buildViewportWaterMask(
  view: WorldCameraView,
  renderContext: RenderContext,
  tilesetRuntimes: Map<string, TilesetRuntime>
): Uint8Array {
  // Allocate buffer (width * height)
  const buffer = new Uint8Array(view.pixelWidth * view.pixelHeight);
  
  // Iterate visible tiles
  // Copy 16x16 pixelMask from runtime into buffer at correct screen position
  // Handle sub-tile offsets (camera scrolling)
}
```

#### 3. Integration (`WebGLMapPage.tsx`)
In the render loop:
1.  Compute `viewportWaterMask`.
2.  Pass to `spriteRenderer.setWaterMask()`.
3.  Render reflections.

### Why this works
-   **Grass (Tile 1)**: `pixelMask` is all 0s. Shader discards reflection.
-   **Water (Tile 177)**: `pixelMask` is 1s (at bottom). Shader keeps reflection.
-   **Shore**: `pixelMask` is 1s where water is visible, 0s where shore covers it. Shader clips perfectly.

This method is robust and mimics the GBA's data-driven masking without needing to reverse-engineer the exact priority hardware quirks.


# Reflection Rendering Investigation

## Current State
The current implementation attempts to handle reflections by splitting the rendering into layers:
1. Render Layer 0 (Background)
2. Render Reflections
3. Render Layer 1 (Foreground)

## The Issue
Reflections are rendering on non-reflective tiles (e.g., Tile 1 - Grass). This happens because:
1. Grass (Tile 1) has a transparent Layer 1.
2. Layer 0 is rendered.
3. Reflection is rendered (intended for a nearby water tile, but due to sprite size/position, it overlaps the grass tile).
4. Layer 1 is rendered. Since Grass Layer 1 is transparent, the reflection is visible on top of Grass Layer 0.

## Proposed Solution: Split Rendering by Reflectivity
We need to separate tiles into "Reflective" and "Non-Reflective" groups.

**Render Order:**
1. **Non-Reflective Tiles:** Render BOTH Layer 0 and Layer 1. This makes them fully opaque (except for actual transparency like edges, but they will block anything behind them if we consider painter's algorithm).
2. **Reflective Tiles (Layer 0):** Render the water base.
3. **Reflections:** Render the reflection sprites.
4. **Reflective Tiles (Layer 1):** Render the shore/edges.

## Investigation Steps
1.  Identify how to determine if a tile is reflective in `TileInstanceBuilder`.
2.  Modify `TileInstanceBuilder` to support filtering by reflectivity.
3.  Update `WebGLPassRenderer` to use these new instance building methods.
4.  Update `WebGLRenderPipeline` to execute the new render order.

## Questions
- How do we efficiently check `isReflective(tile)` inside the tight loop of `TileInstanceBuilder`?
- Do we have access to metatile behavior in `TileInstanceBuilder`? Yes, `resolveTile` returns `attributes`.


# Reflection Leak on Non‑Reflective Tiles — Codex Notes (2025‑12‑01)

Goal: explain why WebGL reflections still draw over non‑reflective tiles like metatile **1 (grass)** while keeping valid reflections (177/178) intact, map the GBA behavior, and outline fixes that do **not** break reflective tiles.

---

## Where I messed up
- I removed the water mask from the WebGL reflection shader (`SPRITE_REFLECTION_FRAGMENT_SHADER` in `src/rendering/webgl/WebGLSpriteShaders.ts`) and always call `spriteRenderer.setWaterMask(null)` (`WebGLMapPage.tsx`, reflection render path). That means reflections are unmasked quads.
- The “render both layers of non‑reflective tiles before reflections” promise never materialized: the split render path now draws **layer 0 of every tile** before reflections and **layer 1 of every tile** after (`renderAndCompositeLayer0Only` / `renderAndCompositeLayer1Only` in `WebGLRenderPipeline` + `TileInstanceBuilder`). Since grass tile 1 has an empty layer 1, nothing occludes the reflection—so it leaks.
- Reflection detection is working as intended (it should trigger when a reflective tile is within the sprite footprint, e.g., y+2 with 16×32 sprites). The problem is purely that we never mask the reflection quad to the reflective pixels.

---

## Current pipelines vs GBA

### GBA (ground truth)
- Detection: `ObjectEventGetNearbyReflectionType` (`public/pokeemerald/src/event_object_movement.c:7625`) scans current **and previous** coords across sprite width/height at `y+1..`. Same as our shared helper.
- Rendering: `SetUpReflection` / `UpdateObjectReflectionSprite` (`field_effect_helpers.c`) clones the sprite, sets **OAM priority 3**, vertical offset = sprite height − 2 (+ bridge offsets), and flips vertically.
- Masking mechanism: hardware ordering. Reflection OBJ sits **behind BG1**; the BG1 layer of reflective metatiles contains the shoreline “holes” that clip the reflection. Non‑reflective tiles don’t expose holes, so the reflection never shows through them.

### Canvas2D (works)
- Uses shared `computeReflectionState` + `buildReflectionMask` (`src/field/ReflectionRenderer.ts`) with `getMetatileBehavior` → `resolveTileAt` (border aware).
- `renderSpriteReflection` tints the flipped sprite and multiplies it by the per‑pixel mask (`destination-in`). Result: reflection only appears where metatile masks say so; grass remains opaque.

### WebGL (broken case)
- Detection matches shared helper (`computeReflectionStateFromSnapshot`), so it correctly triggers near water.
- Rendering path (`WebGLMapPage.tsx` “SPLIT LAYER RENDERING FOR REFLECTIONS”):
  1) `renderAndCompositeLayer0Only` → layer 0 for **all** tiles.
  2) Reflections, **unmasked** (shader no longer samples water mask; water mask texture unused).
  3) `renderAndCompositeLayer1Only` → layer 1 for **all** tiles (grass layer 1 is empty, so it doesn’t occlude).
  4) Normal sprites.
- Net effect: any reflection quad overlaps grass/pavement because nothing clips or occludes it on non‑reflective tiles.

---

## Why tile 1 still shows reflections
1. Reflection quad spans ~32 px; when the reflective tile is at `y+2`, the upper half of the quad sits over tile 1.
2. No mask in the shader → every pixel of the quad draws.
3. Layer ordering draws reflections **after** the only opaque layer tile 1 has (layer 0) and **before** its empty layer 1; so the quad stays visible.

---

## Candidate fixes (pick one)
1) **Re‑enable GPU masking (closest to Canvas/GBA) — preferred**
   - Build an R8 mask texture for the current view using existing `ReflectionMeta.pixelMask` (same data as Canvas). Snap the mask’s origin to `view.worldStartTileX/Y` to prevent jitter.
   - Wire `spriteRenderer.setWaterMask(mask)` before rendering reflections and restore sampling in `SPRITE_REFLECTION_FRAGMENT_SHADER` (discard when mask texel = 0).
   - Because the mask is derived from reflective metatiles only, tiles 177/178 keep their holes; non‑reflective tiles contribute zero and won’t show reflections. Flicker risk is minimized by snapping mask offsets to the tile grid and only rebuilding when camera/view changes.

2) **Ordering-based occlusion for non‑reflective tiles (no shader change)**
   - New pass: draw **both layers of non‑reflective metatiles** into the background FBO.
   - Then draw **only layer 0 of reflective metatiles**, render reflections, then draw **only layer 1 of reflective metatiles**.
   - Requires tagging metatiles as reflective via `TilesetRuntime` during instance building. Reflective tiles remain untouched; non‑reflective tiles become solid before reflections.

3) **CPU clip per reflection sprite (stopgap)**
   - Use existing `buildReflectionMask` to compute the bounding box of “any non‑zero mask row” per reflection; crop the reflection quad (adjust height + worldY) so rows with zero mask are skipped.
   - Doesn’t require shader changes but still leverages mask data; may miss complex shoreline cutouts, so treat as temporary.

---

## Validation checklist (must pass)
- Tile 1 (grass) directly above water: reflection absent on the grass pixels; still visible on the water below.
- Tiles 177/178 retain partial reflections (shoreline holes respected) without flicker while moving.
- NPC reflections: same rules as player; no leaks onto dry land.
- Map seams/border tiles (anchor border) still produce correct mask coverage.
# WebGL Reflection Bug Investigation

**Date:** 2025-11-30
**Issue:** Reflections render on non-reflective tiles (e.g., tile ID 1 - grass)

## Executive Summary

The WebGL reflection rendering fix failed because it relied on **layer ordering alone** without **pixel-level masking**. The Canvas2D implementation works because it uses `buildReflectionMask()` to create a pixel-perfect mask that only allows reflection pixels on reflective tile areas. The WebGL implementation attempted to use layer ordering (render layer 0, then reflections, then layer 1) but this fails when layer 1 is transparent - which is the case for non-reflective tiles like grass.

---

## 0. Self-Reflection: Why Did Multiple Fix Attempts Fail?

Before diving into the technical analysis, it's important to honestly examine **why this bug persisted through multiple fix attempts**. This section serves as a post-mortem of the debugging process itself.

### The Pattern of Failure

Multiple attempts were made to fix this bug, each failing for similar underlying reasons:

1. **Attempt 1: Simple layer reordering**
   - Assumption: "Just render layer 1 after reflections"
   - Why it failed: Didn't consider that layer 1 can be transparent
   - Missing insight: GBA hardware works differently than compositing

2. **Attempt 2: Split rendering for reflective vs non-reflective**
   - Assumption: "Render non-reflective tiles fully, then reflections, then reflective L1"
   - Why it failed: Still drew reflections over non-reflective tiles first
   - Missing insight: Layer ordering can't mask - only cover

3. **Attempt 3-5: Variations on layer ordering**
   - Various tweaks to which layers render when
   - All failed for the same core reason: **no actual masking**

### Root Causes of Repeated Failure

#### 1. **Incomplete Mental Model of GBA Hardware**

I understood that GBA uses "priority 3" for reflections, but I **misunderstood what that means**:
- ❌ What I thought: "Priority 3 means render last"
- ✓ What it actually means: "Priority 3 means render BEHIND layers with higher priority"

The GBA doesn't "cover" reflections with later draws - the reflection is rendered INTO a lower layer from the start. This is fundamentally different from compositing where you draw on top.

#### 2. **False Confidence from Partial Success**

The fix "worked" for tiles 177 and 178 (water with shores), which led to:
- Declaring success prematurely
- Not testing non-reflective tiles like grass (tile 1)
- Confirmation bias: "It works on water, so the approach is correct"

The truth: It only worked on tiles where layer 1 happens to be opaque. That's correlation, not causation.

#### 3. **Ignoring the Canvas2D Implementation**

Canvas2D already solved this problem correctly with `buildReflectionMask()`. The fix attempts:
- Didn't study why Canvas2D uses masking
- Assumed WebGL could take a "simpler" approach with layer ordering
- Didn't ask: "Why does Canvas2D need a pixel mask if layer ordering works?"

The answer is obvious in hindsight: **Canvas2D uses masking BECAUSE layer ordering doesn't work for transparent layer 1.**

#### 4. **Shallow Analysis of Failure Cases**

When the fix failed on tile 1, the debugging was:
- "Tile 1 still shows reflection... maybe the layer order is wrong"
- "Let me try rendering L1 even earlier/later"

Instead of:
- "WHY does tile 1 show reflection when 177 doesn't?"
- "What's DIFFERENT about tile 1's layer 1?"
- "What does Canvas2D do that I'm not doing?"

#### 5. **Overconfidence in Stated Solutions**

Each fix attempt came with confident statements like:
- "This will definitely fix it"
- "Reflections will not render on tile 1"
- "The layer ordering ensures coverage"

This overconfidence prevented:
- Proper verification before declaring success
- Skepticism about the underlying approach
- Willingness to consider fundamentally different solutions

### Lessons Learned

1. **Test the failure cases, not just the success cases**
   - Always test non-reflective tiles (1, 297) alongside reflective ones (177, 178)
   - A fix that works on water but fails on grass isn't a fix

2. **Study existing working implementations before inventing new ones**
   - Canvas2D's `buildReflectionMask()` exists for a reason
   - If the reference implementation uses masking, there's probably a good reason

3. **Understand hardware vs software differences**
   - GBA OAM priority ≠ WebGL/Canvas draw order
   - Hardware layering is fundamentally different from compositing

4. **Don't declare victory until edge cases are verified**
   - "It works on tile 177" ≠ "It works"
   - The bug description said tile 1 - test tile 1!

5. **When multiple fixes fail the same way, question the approach**
   - Layer ordering failed 5 times → maybe layer ordering isn't the answer
   - Step back and reconsider fundamentals

### The Honest Assessment

The fix attempts failed because I:
- Confidently asserted solutions without fully understanding the problem
- Tested on tiles that happened to work, not tiles that were reported broken
- Ignored the existing Canvas2D solution that already worked
- Kept trying variations of the same flawed approach instead of reconsidering

**This is a failure of debugging discipline, not just a technical bug.**

---

## 1. Understanding the GBA Approach

### Hardware Layering (No Pixel Masking)

From `field_effect_helpers.c:47-68`:

```c
void SetUpReflection(struct ObjectEvent *objectEvent, struct Sprite *sprite, bool8 stillReflection)
{
    reflectionSprite = &gSprites[CreateCopySpriteAt(sprite, sprite->x, sprite->y, 152)];
    reflectionSprite->callback = UpdateObjectReflectionSprite;
    reflectionSprite->oam.priority = 3;  // KEY: Priority 3 = behind BG1
    // ...
}
```

**Key insight:** The GBA sets `oam.priority = 3` (lowest priority), which means:
- The reflection sprite renders BEHIND BG1 automatically
- Any non-transparent BG1 pixel naturally occludes the reflection
- No runtime pixel masking is needed - the hardware handles it

### Detection vs. Masking Separation

The GBA has two separate concerns:

1. **Detection** (`ObjectEventGetNearbyReflectionType` at line 7625-7650):
   - Determines IF a reflection should be shown
   - Checks tiles at y+1 from both current and previous coords
   - Returns reflection type (water/ice/none)

2. **Rendering** (OAM priority):
   - Once detected, renders full sprite at priority 3
   - BG1 layer type determines which pixels show through
   - No per-pixel calculation needed

### Why It Works on GBA

For a metatile like 177 (water with shore edge):
- **BG0 (layer 0):** Water tiles
- **BG1 (layer 1):** Shore edge tiles (partially opaque)
- Reflection renders at priority 3 (BEHIND BG1)
- BG1 shore pixels cover reflection; BG0 water pixels show reflection

For a tile like 1 (grass):
- **BG0 (layer 0):** Grass base
- **BG1 (layer 1):** Grass detail (or same as BG0)
- Reflection renders at priority 3 (BEHIND BG1)
- **BG1 grass pixels cover reflection entirely** because grass is opaque

---

## 2. Canvas2D Implementation (Works Correctly)

### Pixel-Level Masking Approach

From `ReflectionRenderer.ts:364-419`:

```typescript
export function buildReflectionMask(
  getReflectionMeta: ReflectionMetaProvider,
  tileRefX: number,
  tileRefY: number,
  width: number,
  height: number
): HTMLCanvasElement {
  // ...
  for (let ty = startTileY; ty <= endTileY; ty++) {
    for (let tx = startTileX; tx <= endTileX; tx++) {
      const info = getReflectionMeta(tx, ty);
      if (!info?.meta?.isReflective) continue;  // KEY: Only reflective tiles

      const mask = info.meta.pixelMask;
      // Copy pixelMask to mask canvas (alpha=255 where reflection allowed)
    }
  }
  // ...
}
```

**Key insight:** The mask is built ONLY from tiles marked as reflective (`isReflective === true`). Non-reflective tiles contribute **nothing** to the mask.

### Rendering with Mask

From `ReflectionRenderer.ts:472-473`:

```typescript
// Apply mask
reflectionCtx.globalCompositeOperation = 'destination-in';
reflectionCtx.drawImage(maskCanvas, 0, 0);
```

The `destination-in` compositing mode clips the reflection to only show where the mask has alpha > 0.

### Why Canvas2D Works

For tile 1 (grass):
- `getReflectionMeta(tx, ty).meta.isReflective` returns `false`
- Tile does NOT contribute to mask
- Reflection is clipped away at grass pixels
- **Result:** No reflection on grass ✓

For tile 177 (water):
- `getReflectionMeta(tx, ty).meta.isReflective` returns `true`
- Tile's `pixelMask` is copied to mask canvas
- Reflection shows only on water pixels (per pixelMask)
- **Result:** Reflection on water, shore covers it ✓

---

## 3. WebGL Implementation (Failed Fix)

### Layer Ordering Approach

From `WebGLMapPage.tsx:1113-1145`:

```typescript
// === SPLIT LAYER RENDERING FOR REFLECTIONS ===
// GBA renders reflections at OAM priority 3 (behind BG1).
// BG1's opaque pixels naturally occlude reflections.
//
// Render order:
// 1. Layer 0 only (water base)
// 2. Reflections (on top of water)
// 3. Layer 1 of ALL tiles (shore edges cover reflections)
// 4. Normal sprites

if (reflectionSprites.length > 0) {
  // === STEP 1: Render and composite ONLY layer 0 ===
  pipeline.renderAndCompositeLayer0Only(ctx2d, view);

  // === STEP 2: Render reflections (after layer 0, before layer 1) ===
  spriteRenderer.renderBatch(reflectionSprites, spriteView);

  // === STEP 3: Render and composite layer 1 of ALL tiles ===
  pipeline.renderAndCompositeLayer1Only(ctx2d, view);
  // ...
}
```

### Why It Failed

The assumption was:
> "Layer 1 of non-reflective tiles will cover the reflection."

But this is **FALSE** for tiles where layer 1 is **transparent or identical to layer 0**.

**For tile 1 (grass):**
1. **Step 1:** Layer 0 rendered (grass base) ✓
2. **Step 2:** Reflection rendered ON TOP of layer 0 ✗ (reflection visible on grass!)
3. **Step 3:** Layer 1 rendered (TRANSPARENT or same as layer 0)
4. **Result:** Reflection still visible because layer 1 doesn't cover it

**For tile 177 (water with shore):**
1. **Step 1:** Layer 0 rendered (water) ✓
2. **Step 2:** Reflection rendered ON TOP of layer 0 ✓
3. **Step 3:** Layer 1 rendered (shore edge, partially opaque)
4. **Result:** Shore covers reflection where opaque ✓

### The Fundamental Problem

The WebGL implementation **doesn't use pixel-level masking**. It draws the full reflection sprite rectangle and relies on layer 1 to cover non-reflective areas. This only works when:
- Layer 1 is opaque over non-reflective pixels

It fails when:
- Layer 1 is transparent (tile 1 - grass)
- Layer 1 matches layer 0 with no coverage (same pixels)

---

## 4. Comparison: GBA vs Canvas2D vs WebGL

| Aspect | GBA | Canvas2D | WebGL (Current) |
|--------|-----|----------|-----------------|
| **Masking Method** | Hardware (OAM priority) | Software (pixel mask) | None (layer order) |
| **Handles Transparent L1** | Yes (BG1 always drawn) | Yes (mask filters) | **NO** |
| **Performance** | Hardware accelerated | CPU-bound | GPU but broken |
| **Correctness** | ✓ | ✓ | ✗ |

---

## 5. Proposed Solutions

### Solution A: Add Pixel-Level Masking to WebGL (Recommended)

**Approach:** Mirror what Canvas2D does - build a mask texture from reflective tile data and use it in the reflection shader.

**Implementation:**

1. **Build mask texture** each frame (or cache per view):
   ```typescript
   function buildReflectionMaskTexture(gl, snapshot, view): WebGLTexture {
     // Iterate over tiles in reflection region
     // For each tile: if isReflective, copy pixelMask to texture
     // Non-reflective tiles contribute nothing (alpha=0)
   }
   ```

2. **Update reflection shader** to sample mask:
   ```glsl
   uniform sampler2D u_reflectionMask;

   void main() {
     vec4 maskSample = texture(u_reflectionMask, v_maskUV);
     if (maskSample.a < 0.5) discard;  // Not a reflective pixel
     // ... rest of reflection rendering
   }
   ```

3. **Upload mask before rendering reflections:**
   ```typescript
   const maskTexture = buildReflectionMaskTexture(gl, snapshot, view);
   spriteRenderer.setReflectionMask(maskTexture);
   spriteRenderer.renderBatch(reflectionSprites, spriteView);
   ```

**Pros:**
- Exactly mirrors Canvas2D behavior
- Pixel-perfect accuracy
- Works for all tile types

**Cons:**
- CPU cost to build mask (can be optimized with caching)
- Additional texture upload per frame

### Solution B: Per-Tile Conditional Rendering

**Approach:** For each tile under the reflection, decide render order:
- Non-reflective tiles: Render both layers BEFORE reflections
- Reflective tiles: Render layer 0 before, layer 1 after reflections

**Implementation:**

1. **Identify tiles under reflection rectangle**
2. **Split tiles into two groups:**
   - Non-reflective: Add to "pre-reflection" batch (both layers)
   - Reflective: Add layer 0 to "pre-reflection", layer 1 to "post-reflection"
3. **Render in order:**
   1. Pre-reflection batch (all non-reflective + L0 of reflective)
   2. Reflections
   3. Post-reflection batch (L1 of reflective only)

**Pros:**
- Doesn't require shader changes
- Uses existing instancing

**Cons:**
- Complex tile-by-tile logic
- May break batching efficiency
- Edge cases with reflection spanning multiple tile types

### Solution C: Pre-Composite Non-Reflective Tiles

**Approach:** Render non-reflective tiles to a separate buffer BEFORE reflections, then composite in correct order.

**Implementation:**

1. **Classify visible tiles** by reflectivity
2. **Render non-reflective tiles** (both layers) to buffer A
3. **Render reflective tile layer 0** to buffer B
4. **Composite:** Buffer A → Screen
5. **Composite:** Buffer B → Screen
6. **Render reflections** → Screen
7. **Render reflective tile layer 1** → Screen

**Pros:**
- Cleaner separation of concerns
- Preserves instancing for each category

**Cons:**
- Multiple render passes
- Complex buffer management
- Memory overhead

---

## 6. Recommended Path Forward

### Phase 1: Quick Fix with Pixel Masking

Implement **Solution A** (pixel-level masking) as it:
1. Matches Canvas2D exactly (parity)
2. Is conceptually simple
3. Handles all edge cases correctly

### Implementation Steps:

1. **Create `WebGLReflectionMask.ts`:**
   - `buildMaskTexture(gl, provider, view)`: Builds mask from reflective tiles
   - Returns WebGLTexture with alpha channel encoding mask

2. **Update `WebGLSpriteShaders.ts`:**
   - Add `u_reflectionMask` sampler
   - Add `v_maskUV` varying
   - Discard fragments where mask alpha is 0

3. **Update `WebGLSpriteRenderer.ts`:**
   - `setReflectionMask(texture)`: Bind mask texture
   - Modify reflection rendering to use mask

4. **Update `WebGLMapPage.tsx`:**
   - Build mask texture before rendering reflections
   - Pass to sprite renderer

### Phase 2: Optimization (Later)

Once working:
- Cache mask per view bounds (invalidate on scroll)
- Use texture atlas for mask regions
- Consider GPU-side mask generation

---

## 7. Validation Criteria

**The fix is correct when:**

1. ✓ Tile 177 (water with shore): Reflection shows on water, shore covers it
2. ✓ Tile 178 (water): Full reflection
3. ✓ Tile 1 (grass): NO reflection visible
4. ✓ Movement across water/land boundary: No flickering
5. ✓ Reflection respects `pixelMask` per-pixel (partial reflections on shore tiles)

**Test locations:**
- Route 104: Grass next to pond
- Petalburg City: Pond with shore edges
- Route 120: Bridges over water

---

## 8. References

### GBA Source Files
- `public/pokeemerald/src/field_effect_helpers.c` - Reflection setup, priority
- `public/pokeemerald/src/event_object_movement.c` - Detection logic (line 7625-7650)
- `public/pokeemerald/src/metatile_behavior.c` - `MetatileBehavior_IsReflective` (line 199-210)

### Browser Implementation Files
- `src/field/ReflectionRenderer.ts` - Canvas2D mask building and rendering
- `src/pages/WebGLMapPage.tsx` - WebGL layer ordering (failed fix)
- `src/rendering/webgl/WebGLRenderPipeline.ts` - Layer rendering methods
- `src/rendering/webgl/TileInstanceBuilder.ts` - Layer 0/1 instance building

---

## Appendix: Layer Type Explanation

From `mapLoader.ts`:

```typescript
export const METATILE_LAYER_TYPE_COVERED = 0;  // Both layers in background
export const METATILE_LAYER_TYPE_NORMAL = 1;   // L0 in bg, L1 in top
export const METATILE_LAYER_TYPE_SPLIT = 2;    // L0 in bg, L1 split by elevation
```

**COVERED tiles** (like grass) have layer 1 rendered in background pass, meaning layer 1 is drawn **before** reflections in the standard path. But layer 1 being transparent means reflections show through.

**NORMAL/SPLIT tiles** (like water shores) have layer 1 in top pass, drawn **after** reflections in standard path. These work correctly because their layer 1 is opaque where needed.

The failed fix tried to force all layer 1 after reflections, but that doesn't help when layer 1 is transparent.
