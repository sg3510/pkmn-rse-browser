---
title: Reflection Handling Plan (WebGL / Canvas2D) vs GBA
status: planned
last_verified: 2026-01-13
---

# Reflection Handling Plan (WebGL / Canvas2D) vs GBA

## Files in scope
- `src/field/ReflectionRenderer.ts` - Shared constants and utilities
- `src/pages/WebGLMapPage.tsx` - WebGL reflection rendering (~line 625)
- `src/utils/metatileBehaviors.ts` - `getBridgeTypeFromBehavior()`, `BridgeType`
- Reference: GBA C code in `public/pokeemerald/src`:
  - `field_effect_helpers.c` (`UpdateObjectReflectionSprite`, `LoadObjectReflectionPalette`, `GetReflectionVerticalOffset`)
  - `event_object_movement.c` (`ObjectEventGetNearbyReflectionType`, lines 7625-7652)
  - `metatile_behavior.c` (`MetatileBehavior_GetBridgeType`, lines 788-810)
  - `include/metatile_behavior.h` (`BRIDGE_TYPE_*` enums)

## CRITICAL BUG: Bridge Offsets Are Wrong!

**GBA bridge offsets** (`field_effect_helpers.c:78-82`):
```c
u16 bridgeReflectionVerticalOffsets[] = {
    [BRIDGE_TYPE_POND_LOW - 1] = 12,   // 12 pixels
    [BRIDGE_TYPE_POND_MED - 1] = 28,   // 28 pixels
    [BRIDGE_TYPE_POND_HIGH - 1] = 44   // 44 pixels
};
```

**Our current values** (FIXED ✅):
```typescript
BRIDGE_OFFSETS = { none: 0, ocean: 0, pondLow: 12, pondMed: 28, pondHigh: 44 }
```

## GBA Bridge Types

From `include/metatile_behavior.h`:
```c
BRIDGE_TYPE_OCEAN,     // 0 - Routes 110/119 log bridges (NO extra offset)
BRIDGE_TYPE_POND_LOW,  // 1 - Unused in game
BRIDGE_TYPE_POND_MED,  // 2 - Route 120 south bridge
BRIDGE_TYPE_POND_HIGH, // 3 - Route 120 north bridge
```

**Our `BridgeType`** now includes `ocean` ✅: `'none' | 'ocean' | 'pondLow' | 'pondMed' | 'pondHigh'`

## How WebGL currently works
### Detection (`computeReflectionStateFromSnapshot`, ~line 347)
- Derives sprite tile footprint: `widthTiles = ceil((width+8)/16)`, same formula as GBA ✓
- Scans starting at `tileY + 1` downward for `heightTiles` rows ✓
- Uses `ReflectionMeta.isReflective` from tileset runtime ✓
- Bridge type comes from current tile only via `getBridgeTypeFromBehavior` ✗ (should check previous too)

### Rendering (`renderPlayerReflection`, ~line 625)
- Y position: `frame.renderY + height - 2 + BRIDGE_OFFSETS[bridgeType]` ✓
- BRIDGE_OFFSETS = `{ none: 0, ocean: 0, pondLow: 12, pondMed: 28, pondHigh: 44 }` ✅ GBA-accurate
- Tint: Uses `getReflectionTint()` from ReflectionRenderer.ts ✅ Unified
- Alpha: Uses `getReflectionAlpha()` from ReflectionRenderer.ts ✅ Bridge-aware
- Masking: uses reflective mask canvas (BG transparency) to clip reflection
- Bridge tint: ✅ Applied via `getReflectionTint()` for pond bridges (dark blue)

## What ReflectionRenderer.ts provides
- `BRIDGE_OFFSETS`: `{none: 0, ocean: 0, pondLow: 12, pondMed: 28, pondHigh: 44}` ✅ GBA-accurate
- `REFLECTION_VERTICAL_OFFSET = -2` ✓
- `REFLECTION_TINTS.water`: `rgba(70, 120, 200, 0.35)` ✅ Now used by WebGL
- `REFLECTION_TINTS.ice`: `rgba(180, 220, 255, 0.35)` ✅ Now used by WebGL
- `BRIDGE_REFLECTION_TINT`: `rgb(74, 115, 172)` ✅ GBA-accurate solid color from bridge_reflection.pal
- `getReflectionTint()`, `getReflectionAlpha()` ✅ Now used by WebGL renderer
- `isPondBridge()` ✅ Helper to check if bridge needs dark tint (excludes ocean)

## GBA ground truth (detailed)

### Bridge Type Detection (`field_effect_helpers.c:84-86`)
```c
if (!GetObjectEventGraphicsInfo(objectEvent->graphicsId)->disableReflectionPaletteLoad
 && ((bridgeType = MetatileBehavior_GetBridgeType(objectEvent->previousMetatileBehavior))
  || (bridgeType = MetatileBehavior_GetBridgeType(objectEvent->currentMetatileBehavior))))
```
**Key insight**: Checks BOTH `previousMetatileBehavior` AND `currentMetatileBehavior`!

### Bridge Palette (`field_effect_helpers.c:112-122`)
```c
// When walking on a bridge high above water (Route 120), the reflection is a solid dark blue color.
// This is so the sprite blends in with the dark water metatile underneath the bridge.
static void LoadObjectHighBridgeReflectionPalette(struct ObjectEvent *objectEvent, u8 paletteNum)
```
Applied for ALL pond bridge types (low/med/high), not just high!

**GBA Bridge Palette** (`graphics/object_events/palettes/bridge_reflection.pal`):
```
RGB(74, 115, 172) × 16 colors
```
This is a SOLID color palette - all 16 entries are identical. The reflection becomes a solid blue silhouette, not a tinted sprite. This helps it blend with the dark water tiles visible under Route 120's tall bridges.

### Reflection Y Position (`field_effect_helpers.c:143`)
```c
reflectionSprite->y = mainSprite->y
    + GetReflectionVerticalOffset(objectEvent)  // height - 2
    + reflectionSprite->sReflectionVerticalOffset;  // bridge offset (0, 12, 28, or 44)
```

### Reflection Detection (`event_object_movement.c:7625-7652`)
```c
static u8 ObjectEventGetNearbyReflectionType(struct ObjectEvent *objEvent)
{
    s16 width = (info->width + 8) >> 4;
    s16 height = (info->height + 8) >> 4;

    for (i = 0; i < height; i++)
    {
        RETURN_REFLECTION_TYPE_AT(objEvent->currentCoords.x, objEvent->currentCoords.y + 1 + i)
        RETURN_REFLECTION_TYPE_AT(objEvent->previousCoords.x, objEvent->previousCoords.y + 1 + i)
        // ... also checks ±j for width
    }
}
```
**Key insight**: Checks BOTH `currentCoords` AND `previousCoords` for reflection type!

## Differences / Gaps Summary

| Issue | Current | GBA | Priority | Status |
|-------|---------|-----|----------|--------|
| Bridge offsets | ~~0/2/4/6~~ 0/0/12/28/44 | 0/12/28/44 | **CRITICAL** | ✅ Fixed |
| Missing ocean bridge type | ~~No~~ Yes | Yes | High | ✅ Fixed |
| Bridge detection | Current only | Prev OR current | Medium | Pending |
| Bridge tint | ~~Not applied~~ Applied for pond bridges | Dark blue for pond bridges | Medium | ✅ Fixed |
| Tint color drift | ~~Different between files~~ Unified | N/A | Low | ✅ Fixed |
| Reflection detection | Current only | Prev AND current | Low | Pending |
| Per-pixel masking | Yes (modern look) | No (OAM priority) | Style choice | N/A |

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
- **Bridge – ocean type**: Route 119/110 wooden bridges (NO extra offset, normal water tint).
- **Bridge – medium/high**: Route 120 south (med +28px) and north (high +44px) bridges; reflection should be much lower and dark blue.
- **No reflection**: Slateport market floor (ensure nothing renders on land).
- **Step-off persistence**: Walk off water onto land; verify one-frame linger if previous-coord check enabled.
- **Weather interaction**: Route 120 in rain—palette should still darken (WebGL equivalent: ensure tint compositing isn't washed out).

## Actionable tasks
- [x] Add GBA bridge offsets and swap WebGL renderer to use them.
- [x] Route tint/alpha through `ReflectionRenderer` helpers; add bridge-specific dark tint.
- [x] Add `ocean` bridge type (Route 110/119 log bridges - no offset, no dark tint).
- [x] Update ObjectRenderer.ts to use shared BRIDGE_OFFSETS from ReflectionRenderer.
- [ ] Consider optional "parity mode" flag to drop pixel-mask and match OAM behaviour; default can stay masked if we prefer fidelity vs cleanliness.
- [ ] Update `computeReflectionStateFromSnapshot` to optionally read previous coords (needs previous tile cached per frame).
- [ ] Mirror changes into Canvas2D reflection path.
- [ ] Visual regression pass using above test matrix (capture before/after).
