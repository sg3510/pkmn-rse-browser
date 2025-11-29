# Reflection “Shimmer” / Distortion Investigation (GBA vs WebGL)

Goal: determine whether the GBA engine adds a moving/distorting effect to sprite reflections on calm water, and how (if at all) to mirror it.

## What the GBA actually does (including the hidden distortion)
- Reflections are created by `SetUpReflection` → `UpdateObjectReflectionSprite` in `public/pokeemerald/src/field_effect_helpers.c`.
  - A copy sprite is V‑flipped, palette-swapped via `gReflectionEffectPaletteMap`, and positioned at `main.y + height - 2 + bridgeOffset`.
  - The reflection uses affine matrices 0 or 1 (depending on H-flip) so any affine changes to those matrices affect the reflection.
- **Hidden shimmer source: `FLDEFFOBJ_REFLECTION_DISTORTION`**
  - On reset (`ResetObjectEvents`), `CreateReflectionEffectSprites` spawns two invisible sprites from `gFieldEffectObjectTemplate_ReflectionDistortion` with affineMode = `ST_OAM_AFFINE_NORMAL`.
  - Each sprite plays a different affine animation from `sAffineAnims_ReflectionDistortion`:
    - `sAffineAnim_ReflectionDistortion_0` (matrix 0): starts at scale 0xFF00 (~0.996), then:
      - +1/256 X-scale over 4 frames
      - hold 8 frames
      - −1/256 over 4 frames
      - hold 8 frames
      - −1/256 over 4 frames
      - hold 8 frames
      - +1/256 over 4 frames
      - hold 8 frames, loop
    - `sAffineAnim_ReflectionDistortion_1` (matrix 1): starts at 1.0, then:
      - −1/256 over 4 frames
      - hold 8
      - +1/256 over 4
      - hold 8
      - +1/256 over 4
      - hold 8
      - −1/256 over 4
      - hold 8, loop
  - Net effect: two ongoing cycles (~0.33s at 60fps) “breathe” the X-scale of the reflection matrices between 0.984375 and 1.015625 (≈ ±1.56%) while keeping the sprite centered.
  - The distortion sprites are invisible; their only role is to own the affine matrices. Reflection sprites point `oam.matrixNum` to 0 (east-facing uses matrix 1 because the base sprite already flips H).
- Palette handling:
  - Normal water uses reflection palettes; high bridges use `LoadObjectHighBridgeReflectionPalette` (solid dark blue) but the palette itself is static.
  - Weather darkening applies via `UpdateSpritePaletteWithWeather`, uniform per-frame.
- Detection (`ObjectEventGetNearbyReflectionType`, `event_object_movement.c`): scans tiles below (current+previous coords) using the width/height heuristic to decide water/ice; reflection flag gates the sprite.

## Implications for our renderer
- For strict parity, we **should include the micro X-scale wobble** on reflections:
  - Two affine slots that loop a shared 48f cycle; matrix 0 and 1 share the same magnitudes but opposite signs (matrix 1 horizontally flips the reflection).
  - Apply to the reflection draw only (not to the main sprite).
  - Amplitude: 0.984375–1.015625 with 1/256 per-frame steps (pure integer `ConvertScaleParam` maths).
  - Period: 48 frames per loop.
- If performance/visual cleanliness matters, hide it behind a “parity” toggle; default-on keeps accuracy.
- Keep all previous rules: Y offset = height−2 + bridge offset; negate bobbing (`y2`), palette/tint differences for high bridges, etc.

## Pointers in the code
- Distortion setup: `CreateReflectionEffectSprites` in `event_object_movement.c` (lines ~1207–1219).
- Affine data: `sAffineAnim_ReflectionDistortion_*` and `gFieldEffectObjectTemplate_ReflectionDistortion` in `public/pokeemerald/src/data/field_effects/field_effect_objects.h` (lines ~849–892).
- Reflection sprite creation/update: `SetUpReflection` / `UpdateObjectReflectionSprite` in `field_effect_helpers.c`.
- Detection: `GetGroundEffectFlags_Reflection`, `ObjectEventGetNearbyReflectionType` in `event_object_movement.c`.
- Bridge offsets/palettes: `LoadObjectReflectionPalette`, `LoadObjectHighBridgeReflectionPalette` in `field_effect_helpers.c`; `MetatileBehavior_GetBridgeType` in `metatile_behavior.c`.

### When and where the shimmer actually applies
- The affine wobble only runs on **water reflections**. `GroundEffect_WaterReflection` calls `SetUpReflection(..., stillReflection = FALSE)`, which sets `affineMode = ST_OAM_AFFINE_NORMAL` so the sprite uses matrix 0/1 and inherits the wobble.  
- **Ice reflections do not shimmer.** `GroundEffect_IceReflection` passes `stillReflection = TRUE`, leaving `affineMode` off, so the distortion matrices are never referenced.  
- Bridge water and under-bridge reflective tiles still count as water reflections, so they shimmer (but use the dark bridge palette).  
- The two distortion sprites are created once at reset and their affine animations run continuously, regardless of how many reflections exist. Any water reflection sprite that uses matrix 0/1 will pick up the current scale at draw time; there is no per-tile gating or on/off switch.

## Implementation notes for our renderer
- Add two "affine tracks" for reflections:
  - Track A (matrix0): step sequence [ +1/256 ×4f, hold8, −1/256 ×4f, hold8, repeat with an extra −/+ segment as in C ].
  - Track B (matrix1): mirrored sign [ −1/256 ×4f, hold8, +1/256 ×4f, hold8, +1/256 ×4f, hold8, −1/256 ×4f, hold8 ].
  - Loop every 48 frames
  - **CRITICAL**: GBA applies 1/256 change PER FRAME during transitions, so total change per 4-frame step = 4/256 ≈ 1.56%
  - Full shimmer range: 0.984375–1.015625 (≈ ±1.56% from 1.0)
- When rendering the reflection, pick the track based on facing/H-flip (match matrixNum 0/1 rule).
- Keep vertical flip, palette/tint, Y offset, bridge offsets, and masking rules unchanged.

## Implementation Status: ✅ DONE

Shimmer has been implemented in a renderer-agnostic way:

### Files Created/Modified:
- `src/field/ReflectionShimmer.ts` (NEW) - Pure animation math module
  - `ReflectionShimmer` class with GBA-accurate affine animation sequences
  - `getGlobalShimmer()` singleton for shared state across renderers
  - `getMatrixForDirection()` helper to pick matrix 0/1 based on facing
  - Time-based updates using GBA frame timing (~59.73 Hz)

- `src/field/ReflectionRenderer.ts` - Added shimmer exports for convenient imports

- `src/components/map/renderers/ObjectRenderer.ts` (Canvas2D)
  - `renderReflection()` - Player reflection with shimmer
  - `renderObjectReflection()` - Generic NPC reflection with shimmer
  - Shimmer scales horizontally around sprite center

- `src/hooks/useCompositeScene.ts` (Canvas2D render loop)
  - Added `getGlobalShimmer().update(nowMs)` at start of compositeScene

- `src/pages/WebGLMapPage.tsx` (WebGL)
  - Added shimmer to `renderPlayerReflection()` callback
  - Added shimmer update in render loop

### How it works:
1. Both renderers call `getGlobalShimmer().update(timestamp)` once per frame
2. When rendering a **water** reflection, call `shimmer.getScaleX(matrixNum)` to get current scale
3. **Ice reflections do NOT shimmer** - per GBA code, `stillReflection=TRUE` disables affine mode
4. Matrix 0 for west/north/south facing, Matrix 1 for east-facing (H-flipped)
5. Apply scale transform around sprite center: `ctx.translate(centerX, 0); ctx.scale(scaleX, 1); ctx.translate(-centerX, 0)`

### Toggle shimmer:
```typescript
import { setShimmerEnabled } from '../field/ReflectionRenderer';
setShimmerEnabled(false); // Disable shimmer globally
```
