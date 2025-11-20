# Water Reflections (Route 117 & friends)

How Emerald decides when to show reflections, how it clips them on mixed land/water tiles, and how to mirror that behavior in the browser renderer.

## What counts as reflective (and how subtiles mask it)
- Metatiles are 16x16 (2x2 of 8x8 tiles). If we render at 2x scale, think "32x32 made of four 16x16 quadrants."
- Behaviors flagged as reflective (`public/pokeemerald/src/metatile_behavior.c:199`): `MB_POND_WATER`, `MB_PUDDLE`, `MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2`, `MB_ICE`, `MB_SOOTOPOLIS_DEEP_WATER`, `MB_REFLECTION_UNDER_BRIDGE`.
- The behavior applies to the whole metatile, but visibility is clipped per 8x8 (our 16x16) quadrant by the metatile's *top layer*:
  - Each metatile has 8 tile entries (`metatiles.bin`): bottom layer = indices 0-3, top layer = 4-7.
  - `DrawMetatile` (`public/pokeemerald/src/field_camera.c`) draws the bottom layer to BG2/3 and the top layer to BG1 (or BG2 for COVERED). Sprite reflections use OAM priority 3, so any non-zero top-layer quadrant sits in front of the reflection. That's why corner/edge tiles can have 1-3 quadrants that hide the reflection even though the whole 16x16 is "reflective."
  - `METATILE_LAYER_TYPE_SPLIT` keeps BG2 transparent; BG1 (top layer) still masks quadrants. `NORMAL`/`COVERED` also mask via their top layer.
- Effectively: a "32x32" block in the browser will only show reflection where its top-layer quadrants are transparent - exactly matching Emerald's per-subtile masking.

## How Emerald decides "you have a reflection"
- Entry point: `GetGroundEffectFlags_Reflection` (`public/pokeemerald/src/event_object_movement.c:7425`).
  - It calls `ObjectEventGetNearbyReflectionType` and sets `GROUND_EFFECT_FLAG_WATER_REFLECTION` or `_ICE_REFLECTION`. `hasReflection` flips from 0->1 on first hit and is cleared when no reflective tiles are found.
- Scan shape (`ObjectEventGetNearbyReflectionType`, same file around line 7625):
  - Width in tiles: `ceil((sprite.width + 8) / 16)`.
  - Height in tiles: `ceil((sprite.height + 8) / 16)`.
  - Offset: starts 1 tile south of the object anchor; checks `height` rows below that.
  - Positions: checks both `currentCoords` and `previousCoords` to keep the reflection alive while moving across a tile edge.
  - For the player (16x32 sprite: `public/pokeemerald/src/data/object_events/object_event_graphics_info.h`), width=1, height=2 -> it checks the tile directly below the feet and the one below that (matching the 4x2 16x16 "subtiles" of a 32x64 drawn player).
- Type resolution: `GetReflectionTypeByMetatileBehavior` returns ICE if the underlying behavior is `MB_ICE`, WATER otherwise; non-reflective behaviors return NONE.

### What this means for per-subtile visibility
- If the tile immediately below the feet is non-reflective (e.g., grass), the reflection still spawns if a reflective tile is in the checked rectangle (e.g., the next 16x16 row down), but the non-reflective top layer in between will visually mask the feet.
- Example (player 4x2 subtiles tall, top-to-bottom): hair-top, hair, face/body, feet. Tiles below: [non-reflective row][reflective row][reflective row][reflective row]. Result: the reflection sprite is present, but the top-land row hides the feet quadrant; the lower reflective rows show body/hair mirrored upward - matching in-game behavior.

## Reflection sprite rendering details
- Creation: `SetUpReflection` (`public/pokeemerald/src/field_effect_helpers.c:47`) copies the main sprite, priority 3, remaps palette via `gReflectionEffectPaletteMap`, hooks `UpdateObjectReflectionSprite`.
- Positioning: `y = main.y + (graphicsInfo.height - 2) + bridgeOffset`; `x2` is copied; `y2` is negated so bobbing is mirrored.
  - Base vertical offset = sprite height - 2 pixels (so the reflection "touches" the feet line).
  - Bridges add 12/28/44 px depending on `MetatileBehavior_GetBridgeType` (low/med/high pond bridges or ocean bridge).
- Palette: `LoadObjectReflectionPalette` picks regular vs. "high bridge" palettes. High bridges darken the reflection to blend with deep water below; weather is reapplied after patching.
- Visibility: hidden if the object is invisible, `hideReflection` is set, or `hasReflection` is cleared. Shadows stop when reflections run (`UpdateShadowFieldEffect` early-outs).

### Orientation and wobble
- Ice reflections pass `stillReflection = TRUE` -> affine mode stays off and simply sets VFLIP.
- Water reflections use affine mode with two global matrices (`CreateReflectionEffectSprites` in `event_object_movement.c`):
  - Two invisible sprites run `sAffineAnims_ReflectionDistortion` for matrices 0 and 1. They set a base 180 degree rotation with xScale either -256 (matrix 0) or +256 (matrix 1) and then oscillate xScale by +/-4 over a 48-frame loop (4f grow, 8f hold, 4f shrink, etc.). Net wobble ~ +/-1.5% horizontal scale, period ~0.8s at 60 FPS.
  - Matrix choice: if the main sprite is H-flipped, matrix 1 (positive xScale) is used; otherwise matrix 0 (negative xScale). Because the base rotation is 180 degrees, using -256 cancels the horizontal flip while keeping the vertical mirror; using +256 preserves both flips. This yields "vertical-only mirror" regardless of facing direction while sharing the wobble timing with the main sprite's flip state.

## Browser parity checklist
- Reflective detection:
  - Decode metatile behaviors; treat behaviors above as reflective.
  - Recreate the scan rectangle: width/height formula above, start at +1 tile south of the anchor, include both current and previous positions.
- Per-subtile masking:
  - For each reflective metatile, derive a 2x2 mask from top-layer tiles (indices 4-7): any nonzero tile blocks the reflection in that quadrant. Respect layer type (NORMAL, COVERED, SPLIT) but note all draw the top layer in front of sprites.
- Rendering order:
  - Draw reflection after the background layer but before top-layer tiles/sprites (same slot where shadows would sit). Suppress shadows while reflections are visible.
- Sprite copy:
  - Mirror vertically, apply reflection palette (darker + slight tint), and offset by height-2 plus bridge offsets; invert bobbing.
  - Apply the horizontal wobble (~+/-1.5% over 48f) and swap which wobble phase to use when the main sprite is H-flipped.
- Types/palette nuances:
  - Ice uses the still (no wobble) path.
  - Bridge tiles (`MB_REFLECTION_UNDER_BRIDGE` or bridge behavior on current/previous tile) use the darker palette + vertical bridge offset.
