# Reflection Handling Plan (WebGL / Canvas2D) vs GBA

## Files in scope
- `src/field/ReflectionRenderer.ts`
- `src/pages/WebGLMapPage.tsx` (reflection pipeline + render path)
- Reference: GBA C code in `public/pokeemerald/src`:
  - `field_effect_helpers.c` (`UpdateObjectReflectionSprite`, palette + offsets)
  - `event_object_movement.c` (`ObjectEventGetNearbyReflectionType`)
  - `metatile_behavior.c` (`MetatileBehavior_GetBridgeType`, reflective checks)

## How WebGL currently works
### Detection
- `computeReflectionStateFromSnapshot` (WebGLMapPage.tsx):
  - Derives sprite tile footprint: `widthTiles = ceil((width+8)/16)`, same formula as GBA.
  - Scans starting at `tileY + 1` downward for `heightTiles` rows; checks center, then ±j up to widthTiles.
  - Uses `ReflectionMeta.isReflective` from tileset runtime; sets `reflectionType` to water/ice.
  - Bridge type comes from the tile the player stands on via `getBridgeTypeFromBehavior`.
### Rendering
- Y position: `frame.renderY + height - 2 + BRIDGE_OFFSETS[bridgeType]`.
  - BRIDGE_OFFSETS = { pondLow: 2, pondMed: 4, pondHigh: 6 } (pixels).
- Tint: water `rgba(100,150,255,0.35)`, ice `rgba(200,220,255,0.25)`.
- Alpha: hardcoded 0.65 for all; bridges do **not** change tint/alpha.
- Masking: uses reflective mask canvas (BG transparency) to clip reflection.
- Bridge visuals: only offset changes; no darker “bridge reflection” palette.

## What ReflectionRenderer.ts provides
- Constants: `BRIDGE_OFFSETS` (0/2/4/6), `REFLECTION_VERTICAL_OFFSET = -2`, tints, and `BRIDGE_REFLECTION_TINT` (unused in WebGL renderer).
- Utilities to pick alpha and tint by bridge type, but WebGLMapPage currently bypasses them and inlines tint/alpha.

## GBA ground truth
### Detection window (`ObjectEventGetNearbyReflectionType`, event_object_movement.c)
- Same footprint math: width = ceil((spriteWidth+8)/16), height = ceil((spriteHeight+8)/16).
- Scans starting at y+1 for `height` rows; checks current coords and previous coords, center then ±j per row.
- Reflection type: ice if `MetatileBehavior_IsIce`, else water if `MetatileBehavior_IsReflective`, else none.
- Bridge type is taken from previous or current metatile (`MetatileBehavior_GetBridgeType`).

### Rendering offsets & palettes (`field_effect_helpers.c`)
- Base vertical offset: `GetReflectionVerticalOffset` = sprite height − 2 pixels.
- Bridge extra offsets: 12 / 28 / 44 pixels for low / medium / high bridge (huge compared to WebGL’s 2/4/6).
- High-bridge palette: a dark solid blue (`LoadObjectHighBridgeReflectionPalette`) so reflection blends with water under high bridges (Route 120); regular water/ice palette otherwise. Weather tint is applied after palette patch.
- Reflection sprite is vertically flipped OAM copy of the object; y2 inverted.
- Priority fixed to 3; masked only by OAM priority/OBJ window (no BG-mask clipping).

## Differences / Gaps
1) **Bridge offsets**: WebGL uses +2/4/6px; GBA uses +12/28/44px in addition to height−2. Reflections should appear much lower on bridges.
2) **Bridge tint**: GBA swaps to dark blue palette on high bridges; WebGL keeps same tint/alpha.
3) **Tint/alpha on water vs ice**: WebGL uses RGBA overlays; GBA uses palette remap (weather-adjusted). Visual tone differs; alpha not reduced on bridges in WebGL.
4) **Masking**: WebGL masks with reflective pixels; GBA does not mask per-pixel—reflection always renders, relying on metatile priority. This is an intentional stylistic change; decide if we want parity.
5) **Detection scope**: WebGL ignores previousCoords; GBA checks both current and previous tiles each frame, so reflections persist one frame into water when stepping off. Minor difference.
6) **Bridge type mapping**: WebGL `getBridgeTypeFromBehavior` mirrors GBA, but bridge reflection tint is unused in the renderer.
7) **Duplicated constants & color drift**: `ReflectionRenderer.ts` defines BRIDGE_OFFSETS {0,2,4,6}, `REFLECTION_VERTICAL_OFFSET = -2`, water tint `rgba(70,120,200,0.35)`, ice tint `rgba(180,220,255,0.35)`, alpha 0.65. WebGLMapPage.tsx re-declares offsets, hardcodes height-2, uses slightly different tints (`rgba(100,150,255,0.35)` water, `rgba(200,220,255,0.25)` ice) but same alpha. These should be deduped and aligned.

## Plan to reach 1:1 (WebGL first)
1) **Centralize constants**: Use `getReflectionTint`, `getReflectionAlpha`, `BRIDGE_OFFSETS`, and introduce GBA-accurate bridge offsets `{12, 28, 44}` (pixel) plus `height-2`. Keep a compatibility flag if needed.
2) **Bridge palette emulation**: When `bridgeType !== none`, use `BRIDGE_REFLECTION_TINT` (dark blue) and slightly lower alpha to mimic high-bridge palette.
3) **Offset formula**: `reflectionY = renderY + height - 2 + gbaBridgeOffset[bridgeType]`. Provide toggle to keep current look for non-bridge tiles.
4) **Detection parity**: Optionally include previousCoords in `computeReflectionStateFromSnapshot` to mirror GBA lingering reflections.
5) **Masking decision**: Choose parity (no mask) or keep modern mask; document choice. If parity, skip destination-in mask step.
6) **Refactor WebGL renderer**: Use `ReflectionRenderer` helpers instead of inline RGBA to keep behavior consistent across systems.
7) **Canvas2D**: Once WebGL parity is correct, port the same detection/offset/tint helpers to Canvas2D renderer (currently uses `computeReflectionState` in map utils).
8) **Deduplicate constants now**: Import BRIDGE_OFFSETS, REFLECTION_VERTICAL_OFFSET, tints, and alpha from `ReflectionRenderer.ts` into WebGLMapPage.tsx; pick a single tint set (the drift is almost certainly accidental). Keep rendering paths separate since data sources differ (WorldSnapshot vs RenderContext).

## Test matrix (maps & spots)
- **Water reflection baseline**: Petalburg City pond edge; Surf tiles on Route 110.
- **Ice reflection**: Sootopolis Gym ice puzzle tiles (reflection should render, ice tint).
- **Bridge – ocean type (low)**: Route 119 wooden bridge (expect extra drop and darker tint).
- **Bridge – medium/high**: Route 120 south (med) and north (high) bridges; reflection should be much lower and dark blue.
- **No reflection**: Slateport market floor (ensure nothing renders on land).
- **Step-off persistence**: Walk off water onto land; verify one-frame linger if previous-coord check enabled.
- **Weather interaction**: Route 120 in rain—palette should still darken (WebGL equivalent: ensure tint compositing isn’t washed out).

## Actionable tasks
- [ ] Add GBA bridge offsets and swap WebGL renderer to use them.
- [ ] Route tint/alpha through `ReflectionRenderer` helpers; add bridge-specific dark tint.
- [ ] Consider optional “parity mode” flag to drop pixel-mask and match OAM behaviour; default can stay masked if we prefer fidelity vs cleanliness.
- [ ] Update `computeReflectionStateFromSnapshot` to optionally read previous coords (needs previous tile cached per frame).
- [ ] Mirror changes into Canvas2D reflection path.
- [ ] Visual regression pass using above test matrix (capture before/after).
