# Water Reflection Implementation Plan (Browser)

Concrete steps to port Emerald's reflection behavior (tile detection, subtile clipping, wobble, bridges) into the current React/Canvas renderer.

## Data prep (on map load)
- Parse behaviors once: add a behavior constants map (from `public/pokeemerald/include/constants/metatile_behaviors.h`) so we can test `MB_POND_WATER`, `MB_PUDDLE`, `MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2`, `MB_ICE`, `MB_SOOTOPOLIS_DEEP_WATER`, `MB_REFLECTION_UNDER_BRIDGE`, and bridge behaviors (`MB_BRIDGE_OVER_OCEAN`, `MB_BRIDGE_OVER_POND_LOW/MED/HIGH`, `MB_BRIDGE_OVER_POND_*_EDGE_*`, `MB_BIKE_BRIDGE_OVER_BARRIER`, `MB_UNUSED_BRIDGE`).
- Build per-metatile metadata for both tilesets:
  - `isReflective` + `reflectionType` (water vs. ice) from the behavior byte.
  - `bridgeType` (`none/low/med/high/ocean`) from the bridge behaviors above.
  - `layerType` already available from attributes.
  - `quadrantMask`: from `metatiles.bin` top-layer entries 4-7 -> 2x2 boolean grid; `true` only if that top-layer tile is zero. This is the subtile-level "reflection allowed" mask.
  - Cache in a lookup keyed by metatile id (primary vs. secondary).
- Optional: precompute a map-sized grid of `ReflectiveMaskTile { type, bridgeType, quadrantMask }` so per-frame lookups are O(1).

## Runtime detection (per frame)
- Track previous tile coords in `PlayerController` (add `prevTileX/prevTileY` updated when snapping to tiles). Use the tile grid as the anchor, just like `currentCoords/previousCoords` in Emerald.
- Derive sprite dimensions: base player is 16x32 px; compute `widthTiles = ceil((w + 8) / 16)` and `heightTiles = ceil((h + 8) / 16)` so custom sprites can reuse the logic.
- Compute the scan rectangle each frame:
  - Start one tile south of the anchor (`tileY + 1`).
  - Check `heightTiles` rows downward, centered around the anchor X (`tileX`, and `+/-j` for width > 1) for both current and previous coords.
  - Short-circuit on first reflective hit; record `reflectionType` (water/ice) and `bridgeType` (from the hit tile).
- Maintain state: `hasReflection`, `reflectionType`, `bridgeOffsetPx` (0/12/28/44), `quadrantMask` for the hit tiles, and a wobble phase counter. Mirror Emerald's sticky behavior by keeping `hasReflection` true only if the current scan finds something; otherwise clear immediately.
- Extend later to NPCs by reusing the same helper with their width/height.

## Rendering pipeline changes
- In `compositeScene` (`src/components/MapRenderer.tsx`), draw order should become: background -> reflection -> player -> top layer.
- Build/refine a `ReflectionRenderer` helper:
  - Source frame: reuse the player's current frame rect (same sprite sheet slice, same hflip choice).
  - Generate a vertically flipped copy on a tiny offscreen canvas; apply tint/darken (palette swap approximation) and bridge variant (darker for bridge types).
  - Apply wobble scale on X (~+/-1.5%, 48-frame loop) with direction-aware phase (matrix 0 vs. 1 logic). Ice skips wobble.
  - Place at `playerScreenX`, `playerScreenY + (spriteHeight - 2) + bridgeOffsetPx`; invert bobbing offset if we add a y2 equivalent.
- Masking to reflective subtiles:
  - Build a per-frame mask covering the reflection's bounding box. For each overlapped map tile, use its `quadrantMask` AND `isReflective`; fill allowed quadrants as opaque rectangles (8x8 px raw, 16x16 on-screen at 2x scale) onto a mask canvas.
  - Composite the reflection offscreen onto the mask via `destination-in`, then draw the masked result to the main canvas. The top-layer canvas will still occlude any land quadrants above.
- Hide/skip drawing when `hasReflection` is false or when the player is offscreen.

## Wobble timing (matching Emerald)
- Global cycle: 48 frames at 60 FPS (~0.8s). Sequence for matrix 1 (H-flipped main): start scale 1.0, shrink 4f (-1 per frame), hold 8f, grow 4f, hold 8f, grow 4f, hold 8f, shrink 4f, hold 8f. Matrix 0 uses the same deltas but with the base X scale negated to cancel the 180-degree base rotation's horizontal flip.
- Implement as two precomputed scale arrays (`scaleXMatrix0`, `scaleXMatrix1`) so we can select by facing direction without branching per pixel.
- Keep the phase running even when `hasReflection` is false to avoid popping when reflections reappear.

## Palette/tint strategy
- Default water: darken + slight blue/alpha drop (approximate `gReflectionEffectPaletteMap`); keep it deterministic so it can be shared across frames.
- Ice: reuse the base palette with minimal darkening, no wobble.
- Bridges: apply a stronger darken/multiply for any `bridgeType` hit (matches Route 120 dark-blue reflection).

## Validation checklist
- Route 117 pond edges: corner tiles only show reflection in water quadrants; feet disappear when standing one tile above water with a grass edge.
- Route 120 bridge: reflection offset matches bridge height and uses the darker palette; wobble direction matches facing east vs. west.
- Puddles: reflection triggered only when over puddle behaviors; no wobble on ice (Shoal Cave) but vertical flip still correct.
- Ensure shadows disappear when reflections are active.
