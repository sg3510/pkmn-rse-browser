---
title: Puddle Reflection Bug - React Implementation Analysis
status: bug
last_verified: 2026-01-13
---

# Puddle Reflection Bug - React Implementation Analysis

## Executive Summary

**The Bug:** Player reflections appear with an incorrect offset when standing on non-reflective tiles (muddy/marsh), showing reflections when they shouldn't appear at all.

**Root Cause:** The React code's `computeReflectionState` function checks tiles **starting from playerY +1** (tiles below the player) to determine if reflection should show, but it **never checks if the player's CURRENT tile is reflective**. This means standing on mud (tile Y=36) with water below (tile Y=37) incorrectly triggers a reflection.

**The Fix:** Change the reflection check to START from the player's current tile (Y offset 0), not from tiles below (Y offset +1). Simply change `const offsetY = 1 + i;` to `const offsetY = 0 + i;` in the `computeReflectionState` function.

---

## Problem Analysis from Debug Dumps

### Dump 1 & 2: Player on Non-Reflective Mud ❌

**Player Position:** (25, 36)  
**Player Tile:** Metatile 657 (secondary), `isReflective: false`, Behavior 22 (muddy/marsh)  
**Tile Below Player:** (25, 37), Metatile 665, `isReflective: true`, Behavior 22 (puddle)  

**What Happens:**
```json
"reflectionState": {
  "hasReflection": true,  // ❌ WRONG - should be false!
  "reflectionType": "water",
  "bridgeType": "none"
},
"reflectionMask": {
  "maskPixels": 256,
  "tilesUsed": [{
    "x": 25,
    "y": 37,   // ← Tile BELOW player, not player's tile
    "metatileId": 665,
    "behavior": 22
  }]
}
```

**Why It's Wrong:**
- Player is standing on mud (metatile 657), NOT water
- Should show **muddy feet effect**, NOT reflection
- Reflection shouldn't trigger just because water/puddles exist below the player

### Dump 3: Player on Reflective Puddle (Partially Working) ⚠️

**Player Position:** (23, 34)  
**Player Tile:** Metatile 209 (primary), `isReflective: true`, Behavior 22 (puddle)  
**Tiles Below:** (23, 35) = Metatile 208 (reflective)  

**What Happens:**
```json
"reflectionMask": {
  "maskPixels": 268,
  "tilesUsed": [
    { "x": 23, "y": 34, "metatileId": 209 },  // Player tile ✓
    { "x": 23, "y": 35, "metatileId": 208 }   // Below player ✓
  ]
}
```

**Issue:** Reflection appears on player's current tile and one tile below, BUT the reflection is incomplete - the hair is cut off and doesn't extend to the 2nd tile below (Y=36) when it should.

### Dump 4: Player on Reflective Puddle (Perfect) ✓

**Player Position:** (23, 32)  
**Player Tile:** Metatile 209, `isReflective: true`  

**What Happens:**
```json
"reflectionMask": {
  "maskPixels": 492,
  "tilesUsed": [
    { "x": 23, "y": 32, "metatileId": 209 },  // Player tile Y+0
    { "x": 23, "y": 33, "metatileId": 210 },  // Y+1
    { "x": 23, "y": 34, "metatileId": 209 }   // Y+2
  ]
}
```

**Why It Works:** Player is on water, and 2 tiles below are also water, so full reflection spans 3 tiles and renders completely.

### Dump 5: Player on Non-Reflective Mud (Correct) ✓

**Player Position:** (21, 34)  
**Player Tile:** Metatile 657, `isReflective: false` (muddy/marsh)  
**Surrounding Tiles:** Metatile 23 (wall/collision), `isReflective: false`  

**What Happens:**
```json
"reflectionMask": {
  "maskPixels": 0,
  "tilesUsed": []
}
```

**Why It Works:** No reflective tiles in search area, so no reflection shows (correct!).

---

## React Code Analysis

### Current Implementation (BROKEN)

From `MapRenderer.tsx:313-367`, the function `computeReflectionState`:

```typescript
function computeReflectionState(
  ctx: RenderContext,
  player: PlayerController | null
): ReflectionState {
  if (!player) {
    return { hasReflection: false, reflectionType: null, bridgeType: 'none' };
  }

  const { width, height } = player.getSpriteSize();
  const widthTiles = (width + 8) >> 4;
  const heightTiles = (height + 8) >> 4;

  const bases = [
    { x: player.tileX, y: player.tileY },
    { x: player.prevTileX, y: player.prevTileY },
  ];

  let found: ReflectionType | null = null;

  for (let i = 0; i < heightTiles && !found; i++) {
    const offsetY = 1 + i;  // ❌ BUG: STARTS AT 1, SKIPS PLAYER'S CURRENT TILE!
    for (const base of bases) {
      const y = base.y + offsetY;
      const center = getMetatileBehavior(ctx, base.x, y);
      if (center?.meta?.isReflective) {
        found = center.meta.reflectionType;
        break;
      }
      // ... also checks left/right tiles
    }
  }

  return {
    hasReflection: !!found,
    reflectionType: found,
    bridgeType,
  };
}
```

**The Problem with `offsetY = 1 + i`:**
- When `i=0`: checks `playerY + 1` (first tile BELOW player) ❌
- When `i=1`: checks `playerY + 2` (second tile below)
- **NEVER checks `playerY + 0`** (the player's current tile!) ❌

**This causes the bugs:**
- **Dump 1/2**: Player on mud (Y=36), water below (Y=37) → Reflection incorrectly triggers
- **Dump 3**: Player on water (Y=34) → Reflection works but starts 1 tile down, cutting off top of reflection
- **Dump 5**: Player on mud (Y=34), no water nearby (Y=35+) → No reflection (correct by accident)

---

## Comparison with C Code

From `event_object_movement.c:7625-7649`:

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
        RETURN_REFLECTION_TYPE_AT(objEvent->currentCoords.x, objEvent->currentCoords.y + one + i)
        RETURN_REFLECTION_TYPE_AT(objEvent->previousCoords.x, objEvent->previousCoords.y + one + i)
        for (j = 1; j < width; j++)
        {
            RETURN_REFLECTION_TYPE_AT(objEvent->currentCoords.x + j, objEvent->currentCoords.y + one + i)
            // ... more checks
        }
    }
    
    return REFL_TYPE_NONE;
}
```

**Wait! The C code ALSO checks `currentY + one + i` where `one = 1`, so when `i=0` it checks `currentY + 1`!**

This seems to match our broken React code... So why does the C code work correctly?

### The Answer: Sprite Position vs Tile Position

The key difference is in how the player's **rendering position** relates to their **logical tile position**:

**In the original GBA game:**
- The player sprite's **feet** (which is what touches the ground) are offset from their logical tile position
- The reflection code checks tiles starting from `currentCoords.y + 1` because the sprite's feet actually **overlap into the tile below**
- When the sprite is at logical tile Y=25, the feet are at pixel position that overlaps tile Y=26
- Therefore checking Y+1, Y+2, etc. is checking tiles that the sprite's feet touch

**In our React implementation:**
- `player.tileY` is the logical tile position of the player
- `player.y = tileY * TILE_PIXELS - 16` (sprite is 32px tall, offset upward)
- The sprite's feet are at `player.y + height = (tileY * 16 - 16) + 32 = tileY * 16 + 16`
- **This means the feet are actually in the SAME tile** as `tileY`, not the tile below!
- Therefore we should check starting from `tileY + 0`, not `tileY + 1`

The offset difference stems from how the player's Y position is calculated in `PlayerController.setPosition`:
```typescript
this.y = tileY * this.TILE_PIXELS - 16; // Sprite is 32px tall, feet at bottom
```

---

## Root Cause Summary

**The bug:** `computeReflectionState` starts checking at `playerY + 1` when it should start at `playerY + 0`.

**Why the offset differs from C code:** The C code's player coordinates system has the sprite's feet overlapping into the tile below the logical position, so checking `currentY + 1` is correct. Our React code has the sprite's feet in the same tile as the logical position, so we need to check `currentY + 0`.

---

## The Fix

### Change the Offset Calculation

In `MapRenderer.tsx`, function `computeReflectionState` (around line 332):

**Before:**
```typescript
for (let i = 0; i < heightTiles && !found; i++) {
  const offsetY = 1 + i;  // ❌ WRONG
  ...
}
```

**After:**
```typescript
for (let i = 0; i < heightTiles && !found; i++) {
  const offsetY = 0 + i;  // ✓ CORRECT - start at player's current tile
  ...
}
```

Or even simpler:
```typescript
for (let i = 0; i < heightTiles && !found; i++) {
  const offsetY = i;  // ✓ Start at 0, then 1, then 2, etc.
  ...
}
```

### Expected Results After Fix

**Dump 1 & 2 scenario (player on mud):**
- Player at (25, 36) on muddy tile 657 (NOT reflective)
- Check (25, 36): NOT reflective → no reflection found
- **Result**: `hasReflection: false` ✓ (muddy feet effect should show instead)

**Dump 3 scenario (player on puddle with incomplete reflection):**
- Player at (23, 34) on puddle tile 209 (reflective)
- Check (23, 34): reflective → found!
- **Result**: `hasReflection: true`, mask includes tiles 34, 35, AND 36 ✓ (full reflection)

**Dump 4 scenario:**
- Already works ✓

**Dump 5 scenario:**
- Already works ✓

---

## Testing Checklist

After applying the fix, verify:

- [ ] **Route 120 marsh areas**: Player on muddy tile (657) with puddles nearby → NO reflection
- [ ] **Route 120 puddles**: Player on puddle tiles → Full reflection appears spanning all necessary tiles
- [ ] **Route 117 pond**: Player on water → Reflection works correctly
- [ ] **Reflection completeness**: Hair and full sprite reflect, no cutoffs
- [ ] **Motion**: Reflection updates correctly when moving between tiles

---

## Summary

**Issue**: Reflection detection started at tiles BELOW player instead of player's current tile  
**Cause**: Incorrect offset calculation (`1 + i` instead of `0 + i`)  
**Fix**: Change `const offsetY = 1 + i;` to `const offsetY = i;` in `computeReflectionState`  
**Impact**: Fixes false reflections on non-reflective terrain and incomplete reflections on puddles
