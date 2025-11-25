# Elevation Rendering & NPC Collision Bug Analysis

## Date: November 25, 2025

## Issue Summary

**User Reports:**
1. **NPC Collision Bug:** Player on a bridge (elevation 4) cannot walk over an NPC below the bridge (elevation 3). GBA allows this.
2. **Rendering Bug:** Player on a platform (elevation 4) is covered by the platform surface instead of appearing on top of it.

---

## Part 1: NPC Collision Elevation Bug

### User's Scenario

```
Player Position: (29, 18)
Player Elevation: 4 (on bridge)
NPC at: (29, 17) - WOMAN_5
NPC Elevation: 3 (below bridge)
Result: BLOCKED (should be ALLOWED)
```

### GBA Source Code Analysis

#### `DoesObjectCollideWithObjectAt` Function

**Location:** `public/pokeemerald/src/event_object_movement.c:4724-4742`

```c
static bool8 DoesObjectCollideWithObjectAt(struct ObjectEvent *objectEvent, s16 x, s16 y)
{
    u8 i;
    struct ObjectEvent *curObject;

    for (i = 0; i < OBJECT_EVENTS_COUNT; i++)
    {
        curObject = &gObjectEvents[i];
        if (curObject->active && curObject != objectEvent)
        {
            if ((curObject->currentCoords.x == x && curObject->currentCoords.y == y)
                || (curObject->previousCoords.x == x && curObject->previousCoords.y == y))
            {
                // CRITICAL: Check elevation compatibility!
                if (AreElevationsCompatible(objectEvent->currentElevation, curObject->currentElevation))
                    return TRUE;  // COLLISION only if elevations compatible
            }
        }
    }
    return FALSE;
}
```

#### `AreElevationsCompatible` Function

**Location:** `public/pokeemerald/src/event_object_movement.c:7791-7800`

```c
static bool8 AreElevationsCompatible(u8 a, u8 b)
{
    // Elevation 0 is compatible with everything (ground level)
    if (a == 0 || b == 0)
        return TRUE;

    // Different non-zero elevations are NOT compatible
    if (a != b)
        return FALSE;

    // Same non-zero elevation = compatible
    return TRUE;
}
```

### GBA Behavior

For player at elevation 4 and NPC at elevation 3:
1. `AreElevationsCompatible(4, 3)`
2. Neither is 0 → continue
3. `4 != 3` → return FALSE (NOT compatible)
4. `DoesObjectCollideWithObjectAt` returns FALSE (NO collision)

**Result:** Player CAN walk through the tile because the NPC is at a different elevation layer.

### Our Implementation (BUGGY)

**Location:** `src/components/MapRenderer.tsx:2496-2507`

```typescript
player.setObjectCollisionChecker((tileX, tileY) => {
  const objectManager = objectEventManagerRef.current;
  // Block if there's an uncollected item ball
  if (objectManager.getItemBallAt(tileX, tileY) !== null) {
    return true;
  }
  // Block if there's a visible NPC
  if (objectManager.hasNPCAt(tileX, tileY)) {
    return true;  // <-- BUG: No elevation check!
  }
  return false;
});
```

**Location:** `src/game/ObjectEventManager.ts:217-232`

```typescript
getNPCAt(tileX: number, tileY: number): NPCObject | null {
  for (const npc of this.npcs.values()) {
    if (npc.tileX === tileX && npc.tileY === tileY && npc.visible) {
      return npc;  // <-- Returns NPC regardless of elevation!
    }
  }
  return null;
}

hasNPCAt(tileX: number, tileY: number): boolean {
  return this.getNPCAt(tileX, tileY) !== null;  // <-- No elevation param!
}
```

### Bug Analysis

The collision checker:
1. Does NOT receive player elevation
2. Does NOT check NPC elevation against player elevation
3. Blocks movement if ANY NPC is at position, regardless of elevation

### Recommended Fix

**Step 1:** Modify `hasNPCAt` to accept and check elevation

```typescript
/**
 * Check if there's a blocking NPC at a position WITH elevation check
 * Based on GBA AreElevationsCompatible logic
 */
hasNPCAtElevation(tileX: number, tileY: number, playerElevation: number): boolean {
  for (const npc of this.npcs.values()) {
    if (npc.tileX === tileX && npc.tileY === tileY && npc.visible) {
      // GBA AreElevationsCompatible logic:
      // Elevation 0 collides with everything
      if (playerElevation === 0 || npc.elevation === 0) {
        return true;  // Compatible = collision
      }
      // Same elevation = collision
      if (playerElevation === npc.elevation) {
        return true;
      }
      // Different non-zero elevations = no collision
      // Continue checking other NPCs
    }
  }
  return false;
}
```

**Step 2:** Update collision checker to pass elevation

```typescript
player.setObjectCollisionChecker((tileX, tileY) => {
  const objectManager = objectEventManagerRef.current;
  const playerElevation = player.getElevation();

  // Item balls - also need elevation check
  const itemBall = objectManager.getItemBallAt(tileX, tileY);
  if (itemBall !== null) {
    // Check elevation compatibility for items too
    if (areElevationsCompatible(playerElevation, itemBall.elevation)) {
      return true;
    }
  }

  // NPCs with elevation check
  if (objectManager.hasNPCAtElevation(tileX, tileY, playerElevation)) {
    return true;
  }

  return false;
});
```

---

## Part 2: Rendering Priority Bug (Platform Covers Player)

### User's Scenario

```
Tile: (18, 18), Metatile 707
Tile Elevation: 4
Player Elevation: 4
Behavior: 0x08 (MB_CAVE)
Layer Type: NORMAL

Debug Shows:
  ✗ Top-Below (before player)  <- Should be ✓
  ✓ Top-Above (after player)   <- Should be ✗
```

Player at elevation 4 (even, >= 4) should have **Priority 1**, meaning sprite renders ABOVE top layer. But the top layer is rendering ABOVE the player.

### GBA Elevation-to-Priority System

**Location:** `public/pokeemerald/src/event_object_movement.c:7729-7731`

```c
static const u8 sElevationToPriority[] = {
    2, 2, 2, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 2
//  0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
};
```

**Priority Mapping:**
| Elevation | Priority | Sprite Position |
|-----------|----------|-----------------|
| 0, 1, 2, 3 | 2 | BELOW BG1 (covered by top tiles) |
| 4, 6, 8, 10, 12 | 1 | ABOVE BG1 (on top of top tiles) |
| 5, 7, 9, 11, 15 | 2 | BELOW BG1 (covered by top tiles) |
| 13, 14 | 0 | ABOVE all BGs |

**GBA Hardware:**
- BG1 = Top layer tiles (priority higher than sprites with priority 2)
- Sprite Priority 1 = Renders ABOVE BG1
- Sprite Priority 2 = Renders BELOW BG1

### Our Implementation Analysis

**Location:** `src/components/map/utils.ts:199-246` (`isVerticalObject`)

```typescript
export function isVerticalObject(ctx: RenderContext, tileX: number, tileY: number): boolean {
  // ...

  // Check if this is a bridge tile - bridges are HORIZONTAL platforms
  const behaviorInfo = getMetatileBehavior(ctx, tileX, tileY);
  if (behaviorInfo) {
    const behavior = behaviorInfo.behavior;
    // Bridge behaviors: 112-115, 120, 122-125, 127
    const isBridge = (behavior >= 112 && behavior <= 115) ||
                     behavior === 120 ||
                     (behavior >= 122 && behavior <= 125) ||
                     behavior === 127;
    if (isBridge) return false; // Bridges use elevation-based rendering
  }

  // Check top layer transparency
  // If < 50% transparent, considered "vertical object"
  const VERTICAL_OBJECT_THRESHOLD = 128;
  return topLayerTransparency < VERTICAL_OBJECT_THRESHOLD;
}
```

### Bug Analysis

The problem is that **cave platform tiles** (behavior 0x08, MB_CAVE) are NOT in the bridge exclusion list. These tiles have:
- Behavior: 8 (MB_CAVE) - not a bridge behavior
- Top layer: Opaque platform surface
- Elevation: Non-zero (e.g., 4)

Because:
1. Behavior 8 is NOT in the bridge list (112-127)
2. Top layer has >50% opaque pixels (platform surface)
3. `isVerticalObject` returns TRUE
4. Tile renders in `topAbove` pass (covers player)

But these tiles are HORIZONTAL platforms (like bridges), not VERTICAL objects (like trees). They should respect elevation-based rendering!

### Root Cause

The `isVerticalObject` function uses only TWO criteria:
1. Is it a bridge behavior? (112-127)
2. Is the top layer mostly opaque?

This misses HORIZONTAL platforms in caves that use other behaviors (like MB_CAVE = 8) but should still use elevation-based rendering.

### Recommended Fixes

#### Fix Option 1: Use Tile Elevation to Detect Platforms

Tiles with non-zero elevation (1-14) are likely platforms/bridges, not vertical objects:

```typescript
export function isVerticalObject(ctx: RenderContext, tileX: number, tileY: number): boolean {
  const resolved = resolveTileAt(ctx, tileX, tileY);
  if (!resolved || !resolved.metatile || !resolved.attributes) return false;

  const layerType = resolved.attributes.layerType;
  if (layerType !== METATILE_LAYER_TYPE_NORMAL) return false;

  // NEW: Check tile elevation
  // Tiles with elevation 1-14 are platforms/bridges, not vertical objects
  // They should use elevation-based rendering
  const tileElevation = resolved.mapTile.elevation;
  if (tileElevation >= 1 && tileElevation <= 14) {
    return false;  // Platform tile, uses elevation rendering
  }

  // Check if this is a bridge behavior
  const behaviorInfo = getMetatileBehavior(ctx, tileX, tileY);
  if (behaviorInfo) {
    const behavior = behaviorInfo.behavior;
    const isBridge = (behavior >= 112 && behavior <= 115) ||
                     behavior === 120 ||
                     (behavior >= 122 && behavior <= 125) ||
                     behavior === 127;
    if (isBridge) return false;
  }

  // Existing transparency check for truly vertical objects (trees at ground level)
  const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
  if (!runtime) return false;

  const metatile = resolved.metatile;
  const tileMasks = resolved.isSecondary ? runtime.secondaryTileMasks : runtime.primaryTileMasks;

  let topLayerTransparency = 0;
  for (let i = 4; i < 8; i++) {
    const tile = metatile.tiles[i];
    const mask = tileMasks[tile.tileId];
    if (mask) {
      topLayerTransparency += mask.reduce((sum, val) => sum + val, 0);
    }
  }

  const VERTICAL_OBJECT_THRESHOLD = 128;
  return topLayerTransparency < VERTICAL_OBJECT_THRESHOLD;
}
```

#### Fix Option 2: Expand Bridge Behavior List

Add more behaviors that represent horizontal platforms:

```typescript
// Behaviors that are horizontal platforms (not vertical objects)
const HORIZONTAL_PLATFORM_BEHAVIORS = new Set([
  // Existing bridge behaviors
  112, 113, 114, 115,  // BRIDGE_OVER_*
  120,                  // FORTREE_BRIDGE
  122, 123, 124, 125,  // BRIDGE edges
  127,                  // BIKE_BRIDGE

  // Cave platform behaviors (NEW)
  8,   // MB_CAVE - cave floor/platform
  // Add more as discovered
]);

const isBridge = HORIZONTAL_PLATFORM_BEHAVIORS.has(behavior);
```

**Note:** Option 1 is more robust as it doesn't require maintaining a list of behaviors.

---

## Part 3: Elevation 15 Special Case on Bridges

### User's Scenario

```
Tile: (29, 18), Metatile 708
Tile Elevation: 15 (universal)
Player Elevation: 4
```

### GBA Behavior for Elevation 15 Tiles

Tiles with elevation 15 are "universal" - they match any player elevation. This is used for:
- Bridge surfaces (player can walk from elevation 4 onto the bridge)
- Transition tiles between different elevation levels

### Rendering Priority for Elevation 15 Tiles

Looking at `sElevationToPriority[15] = 2`, elevation 15 tiles would give priority 2. But the player might be at elevation 4 (priority 1).

The question is: **Which elevation determines rendering - the tile's or the player's?**

**Answer:** The PLAYER's elevation determines their sprite priority. The tile's elevation only affects collision.

So for player at elevation 4 on a tile with elevation 15:
- Player priority = sElevationToPriority[4] = 1
- Player renders ABOVE BG1 (top layer)
- This is correct - player appears on top of the bridge

The bug is that our `isVerticalObject` check is overriding this logic.

---

## Summary of Bugs

### Bug 1: NPC Collision Missing Elevation Check

| Aspect | GBA Behavior | Our Behavior | Status |
|--------|--------------|--------------|--------|
| Elevation Check | `AreElevationsCompatible()` | None | **BUG** |
| Same Elevation | Collision | Collision | Correct |
| Different Elevation | No Collision | Collision | **BUG** |
| Ground Level (0) | Collision with all | Not checked | **BUG** |

**Impact:** Player blocked by NPCs on different elevation layers.

### Bug 2: Platform Tiles Detected as Vertical Objects

| Aspect | Expected | Actual | Status |
|--------|----------|--------|--------|
| Bridge Tiles (112-127) | Elevation-based | Elevation-based | Correct |
| Cave Platforms (behavior 8) | Elevation-based | Vertical Object | **BUG** |
| Trees (ground level) | Always cover player | Always cover player | Correct |

**Impact:** Player covered by platform surface even when at same elevation.

### Bug 3: Elevation Update Logic (from previous analysis)

| Aspect | GBA Behavior | Our Behavior | Status |
|--------|--------------|--------------|--------|
| Collision Check Uses | `currentElevation` | `previousElevation` | **BUG** |
| Elevation 0 Update | Only `currentElevation` | Both fields | **BUG** |
| Elevation 15 Check | Both tiles | Only current | **BUG** |

---

## Implementation Priority

### Critical (Movement Broken)
1. **NPC Elevation Collision** - Add `AreElevationsCompatible` check
2. **Elevation Field for Collision** - Use `currentElevation` not `previousElevation`

### High (Visual Bugs)
3. **Platform Detection** - Check tile elevation to identify horizontal platforms
4. **Elevation 0 Update Logic** - Preserve `previousElevation` for rendering

### Medium (Edge Cases)
5. **Item Ball Elevation** - Add elevation check for item collision
6. **Elevation 15 Tile Check** - Check both current and previous tile

---

## GBA Code References

| Function | Location | Purpose |
|----------|----------|---------|
| `DoesObjectCollideWithObjectAt` | `event_object_movement.c:4724` | NPC collision detection |
| `AreElevationsCompatible` | `event_object_movement.c:7791` | Elevation layer comparison |
| `IsElevationMismatchAt` | `event_object_movement.c:7707` | Tile elevation collision |
| `ObjectEventUpdateElevation` | `event_object_movement.c:7759` | Player elevation update |
| `sElevationToPriority` | `event_object_movement.c:7729` | Sprite rendering priority |
| `DrawMetatile` | `field_camera.c:245` | Tile layer rendering |

---

## Our Code Locations

| File | Function/Line | Issue |
|------|---------------|-------|
| `src/components/MapRenderer.tsx:2496` | Object collision checker | No elevation param |
| `src/game/ObjectEventManager.ts:217` | `getNPCAt` | No elevation check |
| `src/game/ObjectEventManager.ts:230` | `hasNPCAt` | No elevation param |
| `src/game/PlayerController.ts:957` | `isElevationMismatchAt` | Uses wrong field |
| `src/components/map/utils.ts:199` | `isVerticalObject` | Missing platform detection |
| `src/components/map/utils.ts:216` | Bridge behavior list | Incomplete |
