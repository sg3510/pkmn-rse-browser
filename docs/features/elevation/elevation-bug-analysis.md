---
title: Elevation System Bug Analysis
status: bug
last_verified: 2026-01-13
---

# Elevation System Bug Analysis

## Date: November 22, 2025

## Bugs Identified

### Bug 1: previousElevation Not Updating Correctly

**Problem:** When player moves to a new tile, `previousElevation` keeps the OLD tile's elevation instead of updating to the NEW tile's elevation.

**Evidence from Dump 2:**
```
Player at (33, 17) - metatile 700, elevation 15
Cannot walk to (34, 17) - metatile 701, elevation 4
```

**Why it fails:**
1. Player moves TO tile with elevation 15
2. `updateElevation()` sets: `previousElevation = currentElevation` (old value), `currentElevation = 15`
3. Next move attempt: `getElevation()` returns `previousElevation` (still old elevation, not 15!)
4. Collision check: player at old elevation (not 15) cannot move to elevation 4

**GBA Behavior:**
In `public/pokeemerald/src/field_player_avatar.c:1188`, `PlayerGetElevation()` returns `previousElevation`, which represents **the tile the player is currently standing on**, not the previous tile.

The naming is confusing, but in GBA:
- `previousElevation` = "stable" elevation for collision/rendering (current position)
- `currentElevation` = temporary during movement calculations

After movement completes, both should be set to the new tile's elevation.

### Bug 2: Elevation Not Affecting Rendering Priority

**Problem:** Player at elevation 4 renders UNDER tiles with top layers, even though they're at the same elevation.

**Evidence from Dump 1:**
```
Player at (17, 18) - metatile 529, elevation 4 (no top tiles)
Tile (18, 18) - metatile 707, elevation 4 (HAS top tiles 333, 318)
```

Metatile 707's top tiles render above player despite being same elevation.

**Why it happens:**
- Current rendering: ALL top tiles (layer type NORMAL) render in BG1 above player
- Missing: Elevation-based sprite priority
- GBA uses elevation to determine sprite OAM priority

**Required Fix:**
Need to implement elevation-aware rendering where player sprite priority is based on elevation.

## Fixes Required

### Fix 1: Correct previousElevation Update (CRITICAL)

**File:** `src/game/PlayerController.ts`

**Current Code (WRONG):**
```typescript
private updateElevation(): void {
    const resolved = this.tileResolver?.(this.tileX, this.tileY);
    
    if (resolved) {
      this.previousElevation = this.currentElevation;  // WRONG - keeps old value
      this.currentElevation = resolved.mapTile.elevation;
    }
}
```

**Fixed Code:**
```typescript
private updateElevation(): void {
    const resolved = this.tileResolver?.(this.tileX, this.tileY);
    
    if (resolved) {
      // Both should reflect the tile we're NOW standing on
      const newElevation = resolved.mapTile.elevation;
      this.currentElevation = newElevation;
      this.previousElevation = newElevation;
    } else {
      // Out of bounds - keep current elevation
      this.previousElevation = this.currentElevation;
    }
}
```

### Fix 2: Elevation-Based Rendering (MEDIUM PRIORITY)

**Approach:** Modify rendering to check elevation and adjust player sprite priority.

**GBA Reference:**
```c
// public/pokeemerald/src/event_object_movement.c:7729
static const u8 sElevationToPriority[] = {
    2, 2, 2, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 2
};
```

Elevations 4, 6, 8, 10, 12 have priority 1 (render above default priority 2).

For now, simpler approach:
- If player elevation > tile elevation: render player above top tiles
- If player elevation == tile elevation: render normally
- If player elevation < tile elevation: render top tiles above player

## Testing After Fixes

### Test Case 1: Elevation 15 Universal Movement
```
Player at elevation 15 should be able to walk to ANY elevation
Test: Walk from (33,17) elev 15 to (34,17) elev 4
Expected: ALLOWED ✓
```

### Test Case 2: Same Elevation Movement
```
Player at elevation 4 should walk on other elevation 4 tiles
Test: Walk from (17,18) elev 4 to (18,18) elev 4
Expected: ALLOWED ✓
```

### Test Case 3: Elevation Mismatch Blocking
```
Player at elevation 4 cannot walk to elevation 0
Test: Walk from (17,18) elev 4 to (17,19) elev 0
Expected: BLOCKED ✓
```

### Test Case 4: Ground Level Universal
```
Player at elevation 0 can walk anywhere (unless other collision)
Test: Walk from (16,19) elev 0 to (16,18) elev 4
Expected: ALLOWED ✓ (elevation 0 is universal for player)
```

## Implementation Priority

1. **CRITICAL - Fix previousElevation update** (immediate)
2. **HIGH - Test all elevation collision scenarios** 
3. **MEDIUM - Implement basic elevation priority rendering**
4. **LOW - Full sprite priority system matching GBA**











