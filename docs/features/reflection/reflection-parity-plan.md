---
title: Reflection Parity (GBA → React/Canvas2D/WebGL)
status: planned
last_verified: 2026-01-13
---

# Reflection Parity (GBA → React/Canvas2D/WebGL)

Goal: mirror the GBA’s partial-reflection behavior (shorelines, puddles, bridges) in the browser stack and keep the WebGL refactor aligned with Canvas2D.

## Ground truth (GBA)
- Reflection sprite is OAM priority 3, drawn **behind BG1**; any non-transparent BG1 pixels hide it.
- Partial reflections come from BG1 overlays baked into metatiles (no stencil): water on BG0, land/shore on BG1 with transparency holes.
- Detection: `ObjectEventGetNearbyReflectionType` checks both `currentCoords` (destination) and `previousCoords` (origin), scanning width/height footprint at `y+1..`.
- Bridge palette/offset: `LoadObjectReflectionPalette` tries previous behavior first, then current.
- Mask source is data-driven: metatile composition itself — no runtime pixel test on hardware; the BG1 art is the “mask”.
- Examples from `public/pokeemerald/data/tilesets/primary/general/metatiles.bin` (8×16-bit entries, bottom = BG0, top = BG1):
  - 177: BG0 `[270,270,286,286]` water; BG1 `[110,109,0,0]` land on top row → only bottom 8 px reflect.
  - 200: BG1 covers three quadrants; only bottom-right stays open.
  - 202: Mixed shoreline pieces; single open quadrant.

## Browser implementation (today)

### Shared data prep
- `src/utils/tilesetUtils.ts::buildReflectionMeta` builds per-metatile `pixelMask` from BG0 water-looking pixels (color test) **minus BG1 opacity** (tile transparency LUT). This is our software stand-in for the GBA’s BG1 clipping.

### Canvas2D path
- Detection: `computeReflectionState` → `computeObjectReflectionState` in `src/components/map/utils.ts` (dest + origin tiles).
- Mask: `buildReflectionMask` in `src/field/ReflectionRenderer.ts` uses `getMetatileBehavior` (border-aware) to fetch `pixelMask`.
- Rendering: `renderSpriteReflection` in `ReflectionRenderer.ts` composites sprite → tint → `destination-in` with mask; ordering keeps reflection behind BG1 because BG1 was already drawn on the canvas.

### WebGL (current hybrid)
- Detection wrapper: `computeReflectionStateFromSnapshot` in `src/pages/WebGLMapPage.tsx` uses `getReflectionMetaFromSnapshot` (snapshot + tileset runtime).
- Mask builder is the same shared function, but **provider differences matter**.
- Known gaps documented in earlier bugs: runtime lookup fallback and border/connection fallback were missing, causing 16 px clipping on tiles like 177/161 stacks.

## Gaps to close
1) **Border/connection fallback missing in WebGL resolver**  
   Canvas uses `resolveTileAt` which synthesizes anchor-border tiles; `getReflectionMetaFromSnapshot` currently returns `null` outside loaded maps. This skips lower rows when reflections cross a map seam.

2) **Runtime/key mismatch risk**  
   If `tilesetRuntimesRef` lacks a pair id, WebGL returns `meta:null`, silently dropping reflection. Canvas path never hits this because it resolves by tileset key.

3) **Ordering for full WebGL port**  
   When sprites move to GPU, we must keep “reflection behind BG1” by either: (a) rendering a mask into a texture from BG1 pixel masks, then drawing reflection before BG1 top tiles, or (b) draw reflection to an FBO and composite BG1 top over it.

4) **Parity of bridge palette/offset**  
   Ensure bridge type uses previous behavior first (already in shared `resolveBridgeType`) and the same tint/alpha tables are fed to WebGL shader uniforms.

## Fix plan (code)
- **Tile resolver**: extend `getReflectionMetaFromSnapshot` to share the border-aware logic from `resolveTileAt` (use `anchorBorderMetatiles` when no map contains the coord). Consider factoring a single resolver used by both Canvas and WebGL providers.
- **Runtime guard**: if a tileset runtime for the pair id is missing, log once and fall back to the first matching primary/secondary pair; surface a dev warning.
- **Mask correctness**: keep `buildReflectionMask` as the single source; for WebGL, generate a mask texture per frame from the same `pixelMask` bytes (Phase 4b). Sampling rule: `discard` when mask texel is 0.
- **Draw order (future WebGL sprites)**:
  1. BG0
  2. BG1 below-player slice (topBelow)
  3. Reflection pass (masked)
  4. Sprites
  5. BG1 above-player slice (topAbove)
- **Validation points**: tiles 177/200/202 should show partial reflections matching BG1 holes; crossing a map seam should no longer clip after resolver fix.

## Quick checklist to implement
- [ ] Share border-aware tile resolver between `getMetatileBehavior` and `getReflectionMetaFromSnapshot`.
- [ ] Add runtime-missing warning + fallback.
- [ ] Port mask building to a WebGL texture path (Phase 4b), sampling `pixelMask`.
- [ ] Keep bridge palette/offset parity (previous behavior first).
- [ ] Re-test known hotspots (metatile 177 + water below, puddles, Route 120 bridges) in Canvas2D and WebGL.

## Animated tiles & layer semantics
- In Emerald, reflective animations (sea/pond/puddle ripples, waterfalls, surf foam) live on **BG0**; the shoreline/edge/puddle outlines that carve the holes stay on **BG1** and generally do not animate.
- Our current `buildReflectionMeta` runs **once on the base tileset frames**; it does not re-run when a tileset animation swaps BG0 frames. That means animated puddle/shore ripples can change water pixels without updating the mask.
- Required parity work:
  - Precompute animated `pixelMask` frames for any animated BG0 tile that participates in reflection, and swap the mask alongside the tile data each frame.
  - Keep BG1 overlay masks static (they are already baked into the `pixelMask` as subtractive opacity).
  - When tileset animations run in WebGL, also refresh the mask texture region for those tile IDs; Canvas2D should rebuild its mask cache similarly.

## C source references (layering, reflection, animations)
- Reflection sprite setup & bridge palette/offset: `public/pokeemerald/src/field_effect_helpers.c`
- Reflection detection (current+previous tiles): `public/pokeemerald/src/event_object_movement.c` (`ObjectEventGetNearbyReflectionType`)
- Metatile behaviors (reflective, bridge types): `public/pokeemerald/src/metatile_behavior.c` and `include/constants/metatile_behaviors.h`
- Layer assignment and map grid access: `public/pokeemerald/src/fieldmap.c` (`MapGridGetMetatileIdAt`, BG0/BG1 tilemap uploads)
- Tileset loading & animation driver: `public/pokeemerald/src/tilesets.c`, `public/pokeemerald/src/tileset_anims.c` (frames, intervals, targets)
- Tileset data (BG0/BG1 composition & attributes): `public/pokeemerald/data/tilesets/**/metatiles.bin`, `public/pokeemerald/data/tilesets/**/metatile_attributes.bin` wired via `public/pokeemerald/src/data/tilesets/metatiles.h`

### How puddle/shore animations are placed on layers (C-side)
- Metatile composition fixes layers: bottom four 8×8 entries → BG0; top four → BG1. `fieldmap.c` writes BG0/BG1 tilemaps accordingly, consulting `layerType` from `metatile_attributes.bin` to decide if BG1 is drawn.
- Puddle/shore tiles are authored with animated water in BG0 and static edge/land in BG1; thus BG1 clips reflections while BG0 animates.
- Animation selection lives in `public/pokeemerald/src/tileset_anims.c` (e.g., `gTilesetAnims_General`); scripts target specific tile IDs in the tileset. Those IDs correspond to the BG0 tiles used by the reflective metatiles; BG1 edge tiles are not animated.
