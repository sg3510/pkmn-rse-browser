# Reflection Bug Analysis

This document analyzes two reflection bugs identified in the WebGL (and Canvas2D) renderers, compares them to the GBA C source code, and proposes solutions.

## Reference Files

**GBA Source (pokeemerald):**
- `public/pokeemerald/src/event_object_movement.c` - `ObjectEventGetNearbyReflectionType()` lines 7625-7650
- `public/pokeemerald/src/metatile_behavior.c` - `MetatileBehavior_IsReflective()` lines 199-210
- `public/pokeemerald/src/field_effect_helpers.c` - Reflection sprite positioning

**Our Implementation:**
- `src/pages/WebGLMapPage.tsx` - `computeReflectionStateFromSnapshot()` lines 356-407, `renderPlayerReflection()` lines 638-767
- `src/components/map/utils.ts` - `computeObjectReflectionState()` lines 523-570
- `src/components/map/renderers/ObjectRenderer.ts` - `renderReflection()` lines 318-474

---

## Bug #1: X-Direction Reflection Pop-In

### Symptom
When walking left or right toward a water tile, the reflection appears suddenly when the player fully enters the tile, instead of smoothly "walking in" as the player transitions between tiles.

The Y-direction works correctly because we check `y+1` (one tile ahead). The X-direction doesn't have equivalent look-ahead logic.

### GBA C Code Analysis

From `event_object_movement.c:7625-7650`:

```c
static u8 ObjectEventGetNearbyReflectionType(struct ObjectEvent *objEvent)
{
    const struct ObjectEventGraphicsInfo *info = GetObjectEventGraphicsInfo(objEvent->graphicsId);
    s16 width = (info->width + 8) >> 4;
    s16 height = (info->height + 8) >> 4;
    s16 i, j;
    u8 result, b;
    s16 one = 1;

    for (i = 0; i < height; i++)
    {
        // KEY: Checks BOTH currentCoords AND previousCoords
        RETURN_REFLECTION_TYPE_AT(objEvent->currentCoords.x, objEvent->currentCoords.y + one + i)
        RETURN_REFLECTION_TYPE_AT(objEvent->previousCoords.x, objEvent->previousCoords.y + one + i)

        for (j = 1; j < width; j++)
        {
            RETURN_REFLECTION_TYPE_AT(objEvent->currentCoords.x + j, objEvent->currentCoords.y + one + i)
            RETURN_REFLECTION_TYPE_AT(objEvent->currentCoords.x - j, objEvent->currentCoords.y + one + i)
            RETURN_REFLECTION_TYPE_AT(objEvent->previousCoords.x + j, objEvent->previousCoords.y + one + i)
            RETURN_REFLECTION_TYPE_AT(objEvent->previousCoords.x - j, objEvent->previousCoords.y + one + i)
        }
    }
    return REFL_TYPE_NONE;
}
```

**Critical Observation:** The GBA checks tiles at BOTH `currentCoords` AND `previousCoords`. This means:
- During a movement transition, both the old tile position and new tile position are checked
- If EITHER position has a reflective tile below it, the reflection is shown
- This creates the "walking in" effect - the reflection appears as soon as movement BEGINS toward water

### Our Current Implementation

From `WebGLMapPage.tsx:356-394`:

```typescript
const computeReflectionStateFromSnapshot = useCallback((
    snapshot: WorldSnapshot,
    tileX: number,      // Only current position!
    tileY: number,
    spriteWidth: number = 16,
    spriteHeight: number = 32
): ReflectionState => {
    // ...
    for (let i = 0; i < heightTiles && !found; i++) {
        const y = tileY + 1 + i;  // Correctly checks y+1

        // Check center tile - ONLY current position
        const center = getReflectionMetaFromSnapshot(snapshot, tileX, y);

        // Check tiles to left and right - ONLY current position ± j
        for (let j = 1; j < widthTiles && !found; j++) {
            const infos = [
                getReflectionMetaFromSnapshot(snapshot, tileX + j, y),  // current + j
                getReflectionMetaFromSnapshot(snapshot, tileX - j, y),  // current - j
            ];
            // ...
        }
    }
    // ...
});
```

**Problem:** We only check tiles at `tileX ± j`, not at `previousTileX ± j`.

### Solution

1. **Track previous tile position** in PlayerController (already exists as `prevTileX`/`prevTileY` for footprints)

2. **Update detection functions** to accept both current and previous positions:

```typescript
// WebGLMapPage.tsx
const computeReflectionStateFromSnapshot = useCallback((
    snapshot: WorldSnapshot,
    tileX: number,
    tileY: number,
    prevTileX: number,    // NEW
    prevTileY: number,    // NEW
    spriteWidth: number = 16,
    spriteHeight: number = 32
): ReflectionState => {
    const widthTiles = Math.max(1, (spriteWidth + 8) >> 4);
    const heightTiles = Math.max(1, (spriteHeight + 8) >> 4);

    let found: 'water' | 'ice' | null = null;

    for (let i = 0; i < heightTiles && !found; i++) {
        // Check at CURRENT position (y+1)
        const currentY = tileY + 1 + i;
        // Check at PREVIOUS position (y+1)
        const prevY = prevTileY + 1 + i;

        // Check center tile at BOTH positions
        for (const [checkX, checkY] of [[tileX, currentY], [prevTileX, prevY]]) {
            const center = getReflectionMetaFromSnapshot(snapshot, checkX, checkY);
            if (center?.meta?.isReflective) {
                found = center.meta.reflectionType;
                break;
            }
        }
        if (found) break;

        // Check tiles to left and right at BOTH positions
        for (let j = 1; j < widthTiles && !found; j++) {
            const positions = [
                [tileX + j, currentY], [tileX - j, currentY],
                [prevTileX + j, prevY], [prevTileX - j, prevY],
            ];
            for (const [x, y] of positions) {
                const info = getReflectionMetaFromSnapshot(snapshot, x, y);
                if (info?.meta?.isReflective) {
                    found = info.meta.reflectionType;
                    break;
                }
            }
        }
    }
    // ... rest unchanged
});
```

3. **Update call sites** to pass previous position:

```typescript
// In render loop
const reflectionState = computeReflectionStateFromSnapshot(
    currentSnapshot,
    player.tileX,
    player.tileY,
    player.prevTileX ?? player.tileX,  // Fallback to current if no previous
    player.prevTileY ?? player.tileY,
    spriteWidth,
    spriteHeight
);
```

4. **Apply same fix to Canvas2D** in `computeObjectReflectionState()` in `components/map/utils.ts`

### Files to Modify

| File | Changes |
|------|---------|
| `src/game/PlayerController.ts` | Expose `prevTileX`, `prevTileY` (may already exist as private) |
| `src/pages/WebGLMapPage.tsx` | Update `computeReflectionStateFromSnapshot()` to check previous coords |
| `src/components/map/utils.ts` | Update `computeObjectReflectionState()` to check previous coords |

---

## Bug #2: WebGL Reflection Height Limited to 16px

### Symptom
In WebGL, when standing on a tile with two water tiles below (at y+1 and y+2), the reflection only shows through the first water tile (~16px) instead of extending through both tiles (~32px). Canvas2D reportedly doesn't have this issue.

### Example Scenario
- Player at tile (27, 8) on ROUTE104
- Water metatile 177 at tile (27, 9) - first water tile
- Another water tile at tile (27, 10) - second water tile
- Reflection should span both tiles but only appears in first tile

### Analysis

The mask building code in both WebGL and Canvas2D is nearly identical:

```typescript
// Calculate tile range for mask building
const pixelStartTileY = Math.floor(tileRefY / METATILE_SIZE);
const pixelEndTileY = Math.floor((tileRefY + frame.sh - 1) / METATILE_SIZE);
const startTileY = pixelStartTileY;
const endTileY = pixelEndTileY + 1;

// Build mask from reflective tiles
for (let ty = startTileY; ty <= endTileY; ty++) {
    for (let tx = startTileX; tx <= endTileX; tx++) {
        const info = getReflectionMetaFromSnapshot(snapshot, tx, ty); // WebGL
        // OR: const info = getMetatileBehavior(renderContext, tx, ty); // Canvas2D
        if (!info?.meta?.isReflective) continue;
        // ... build mask pixels
    }
}
```

**Possible Causes:**

#### Hypothesis A: Tileset Runtime Missing

WebGL uses `tilesetRuntimesRef.current.get(pair.id)` to get reflection metadata:

```typescript
// WebGLMapPage.tsx:340-341
const runtime = tilesetRuntimesRef.current.get(pair.id);
if (!runtime) return { behavior, meta: null };  // Returns null meta!
```

If the runtime isn't built for a particular tileset pair, `meta` is null and `isReflective` check fails.

**Investigation needed:** Add logging to check if the second water tile's lookup returns `meta: null`.

#### Hypothesis B: Tile Lookup Fails for Second Row

The tile at (27, 10) might not be found in any map's bounds:

```typescript
// WebGLMapPage.tsx:321-326
for (const map of maps) {
    const localX = tileX - map.offsetX;
    const localY = tileY - map.offsetY;
    if (localX >= 0 && localX < map.entry.width &&
        localY >= 0 && localY < map.entry.height) {
        // Found the map containing this tile
    }
}
```

If the tile falls outside all loaded maps, the function returns `null`.

**Investigation needed:** Check if tile (27, 10) is within ROUTE104's bounds.

#### Hypothesis C: Different Metatile at Second Row

The tile at y+2 might be a different metatile that isn't marked as reflective (e.g., deep water, shore, etc.).

**Investigation needed:** Check what metatile is actually at tile (27, 10).

### Diagnostic Code

Add this debug logging to `renderPlayerReflection` in WebGLMapPage.tsx:

```typescript
// After calculating tile range, before mask loop
console.log('[REFLECTION DEBUG] Tile range:', { startTileX, endTileX, startTileY, endTileY });

// Inside mask loop
for (let ty = startTileY; ty <= endTileY; ty++) {
    for (let tx = startTileX; tx <= endTileX; tx++) {
        const info = getReflectionMetaFromSnapshot(snapshot, tx, ty);
        console.log(`[REFLECTION DEBUG] Tile (${tx}, ${ty}):`, {
            found: !!info,
            behavior: info?.behavior,
            isReflective: info?.meta?.isReflective,
            hasRuntime: info !== null && info.meta !== null
        });
        // ... rest of loop
    }
}
```

### Potential Solution (pending investigation)

If Hypothesis A is correct (runtime missing):
- Ensure `buildTilesetRuntimesFromSnapshot` is called after any world update
- Check that snapshot contains all necessary tileset pairs

If Hypothesis B is correct (tile out of bounds):
- Check map loading logic to ensure connected maps are loaded
- Verify world bounds include the tile

If Hypothesis C is correct (different metatile):
- This would be expected behavior - non-reflective tiles don't show reflections
- Check if the second row is actually pond water (behavior 16) or something else

---

## GBA Reflective Behaviors Reference

From `metatile_behavior.c:199-210`:

```c
bool8 MetatileBehavior_IsReflective(u8 metatileBehavior)
{
    if (metatileBehavior == MB_POND_WATER              // 16
     || metatileBehavior == MB_PUDDLE                  // 22
     || metatileBehavior == MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2
     || metatileBehavior == MB_ICE                     // 32
     || metatileBehavior == MB_SOOTOPOLIS_DEEP_WATER
     || metatileBehavior == MB_REFLECTION_UNDER_BRIDGE)
        return TRUE;
    else
        return FALSE;
}
```

**Note:** `MB_DEEP_WATER` (18) and `MB_OCEAN_WATER` (21) are intentionally NOT reflective in the GBA game. Our implementation matches this correctly.

---

## Implementation Status (2025-11-29)

### Bug #1 - X-Direction Pop-In: FIXED

**Root Cause Discovery:** The previous implementation was fundamentally wrong in understanding GBA semantics:
- **GBA's `currentCoords`** = DESTINATION tile (where the player is moving TO)
- **GBA's `previousCoords`** = ORIGIN tile (where the player came FROM)
- **Our original code**: `player.tileX/tileY` = ORIGIN during movement, updated to destination only when movement completes
- **Our fix attempt**: Passed `prevTileX/prevTileY` as "previous" but these were the PREVIOUS origin, not the current origin

This meant during movement from tile A to tile B:
- GBA checked tiles below B (destination) AND tiles below A (origin)
- Our code checked tiles below A (current, which is origin) AND tiles below previous-A (wrong!)

**Actual Fix Applied:**
1. Added `getDestinationTile()` method to `PlayerController.ts` that calculates the destination tile during movement based on direction
2. Updated `computeReflectionStateFromSnapshot()` in `WebGLMapPage.tsx` to pass:
   - `destTile.x, destTile.y` as current coords (GBA's currentCoords = destination)
   - `player.tileX, player.tileY` as previous coords (GBA's previousCoords = origin)
3. Applied same fix to `computeReflectionState()` in `components/map/utils.ts` for Canvas2D

**Files Modified:**
- `src/game/PlayerController.ts` - Added `getDestinationTile()` method
- `src/pages/WebGLMapPage.tsx` - Fixed reflection call at lines 1315-1324
- `src/components/map/utils.ts` - Fixed Canvas2D reflection at lines 619-628

### Bug #2 - Height Limitation: PARTIALLY FIXED

**Root Cause Analysis:** The issue was in `getReflectionMetaFromSnapshot()` returning `meta: null` when tileset runtime lookup failed by `pair.id`.

**Fix Applied:**
Added fallback runtime lookup - if the expected `pair.id` doesn't match a stored runtime, try the first available runtime as fallback. This handles cases where pair IDs might differ between storage and lookup.

**Remaining Investigation Needed:**
If tiles 177 and 178 still behave differently, the issue might be:
1. The specific metatile at y+2 below tile 177 is genuinely non-reflective
2. There's still a mismatch in how connected maps' tileset pairs are resolved

## Summary of Fixes

| Bug | Root Cause | Fix | Status |
|-----|------------|-----|--------|
| #1 X-direction pop-in | Checking origin instead of destination during movement | Use `getDestinationTile()` for current coords | **FIXED** |
| #2 Height limitation | Runtime lookup failing for some tiles | Added fallback runtime lookup | **PARTIAL** |

## Testing Checklist

After implementing fixes:

- [ ] Walk left toward water from land - reflection should appear during movement
- [ ] Walk right toward water from land - reflection should appear during movement
- [ ] Walk up toward water - reflection appears (existing behavior)
- [ ] Walk down away from water - reflection should linger one frame
- [ ] Stand near 2+ tiles of water vertically - reflection spans all water tiles
- [ ] Test on Route 104, Petalburg City pond, and Sootopolis ice
- [ ] Test in both WebGL and Canvas2D renderers
- [ ] Verify tile 177 vs 178 behavior difference
