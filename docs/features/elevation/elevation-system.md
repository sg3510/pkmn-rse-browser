---
title: Elevation System Bug Analysis
status: reference
last_verified: 2026-01-13
---

# Elevation System Bug Analysis

## Date: November 25, 2025

## Issue Summary

**User Report:** Player walked from metatile 513 to 516 (elevation 0), but cannot proceed to metatile 529. Debug shows:
- Tile Elevation: 0
- Player Elevation: 3
- Movement blocked due to elevation mismatch

---

## GBA Source Code Analysis

### Key Function: `ObjectEventUpdateElevation`

**Location:** `public/pokeemerald/src/event_object_movement.c:7759-7771`

```c
void ObjectEventUpdateElevation(struct ObjectEvent *objEvent)
{
    u8 curElevation = MapGridGetElevationAt(objEvent->currentCoords.x, objEvent->currentCoords.y);
    u8 prevElevation = MapGridGetElevationAt(objEvent->previousCoords.x, objEvent->previousCoords.y);

    // CRITICAL: If EITHER current or previous tile is elevation 15, DON'T UPDATE ANYTHING
    if (curElevation == 15 || prevElevation == 15)
        return;

    // Always update currentElevation to the tile's elevation
    objEvent->currentElevation = curElevation;

    // ONLY update previousElevation if tile is NOT 0 and NOT 15
    if (curElevation != 0 && curElevation != 15)
        objEvent->previousElevation = curElevation;
}
```

### Key Function: `IsElevationMismatchAt` (Collision Check)

**Location:** `public/pokeemerald/src/event_object_movement.c:7707-7722`

```c
static bool8 IsElevationMismatchAt(u8 elevation, s16 x, s16 y)
{
    u8 mapElevation;

    // Ground level (0) can go ANYWHERE
    if (elevation == 0)
        return FALSE;

    mapElevation = MapGridGetElevationAt(x, y);

    // Tiles with elevation 0 or 15 are accessible from any elevation
    if (mapElevation == 0 || mapElevation == 15)
        return FALSE;

    // Different non-zero elevations = collision
    if (mapElevation != elevation)
        return TRUE;

    return FALSE;
}
```

### Key Function: Collision Check Caller

**Location:** `public/pokeemerald/src/event_object_movement.c:4667`

```c
else if (IsElevationMismatchAt(objectEvent->currentElevation, x, y))
    return COLLISION_ELEVATION_MISMATCH;
```

**CRITICAL:** GBA uses `currentElevation` for collision checks, NOT `previousElevation`!

### Key Function: `PlayerGetElevation` (For Rendering/Display)

**Location:** `public/pokeemerald/src/field_player_avatar.c:1190`

```c
u8 PlayerGetElevation(void)
{
    return gObjectEvents[gPlayerAvatar.objectEventId].previousElevation;
}
```

This is used for **rendering priority**, not collision!

---

## GBA Elevation Update Rules

### Rule 1: Elevation 15 Freezes Updates
If EITHER the current tile OR the previous tile has elevation 15:
- **Do NOT update `currentElevation`**
- **Do NOT update `previousElevation`**
- Player "carries" their existing elevation across elevation 15 tiles

### Rule 2: Elevation 0 Only Updates `currentElevation`
When stepping onto an elevation 0 tile:
- `currentElevation = 0` (updated)
- `previousElevation` = unchanged (preserved from last 1-14 tile)

### Rule 3: Elevation 1-14 Updates Both
When stepping onto an elevation 1-14 tile:
- `currentElevation = tileElevation`
- `previousElevation = tileElevation`

### Collision Check Uses `currentElevation`
- `currentElevation = 0` → Can walk anywhere (no elevation restrictions)
- `currentElevation = 1-14` → Can only walk to matching elevation or 0/15

---

## Current Browser Implementation Analysis

### Our `updateElevation()` Implementation

**Location:** `src/game/PlayerController.ts:590-626`

```typescript
public updateElevation(): void {
    const resolved = this.tileResolver?.(this.tileX, this.tileY);

    if (resolved) {
      const oldElevation = this.previousElevation;
      const mapElevation = resolved.mapTile.elevation;

      // Handle elevation 15
      let newElevation = mapElevation;
      if (mapElevation === 15) {
        newElevation = oldElevation;  // Preserve previous elevation
      }

      this.currentElevation = newElevation;
      this.previousElevation = newElevation;  // <-- BUG: Both set to same value!
    }
}
```

### Our Collision Check Implementation

**Location:** `src/game/PlayerController.ts:956-1008`

```typescript
private isElevationMismatchAt(tileX: number, tileY: number): boolean {
    const playerElevation = this.previousElevation;  // <-- BUG: Should be currentElevation!

    if (playerElevation === 0) {
      return false;
    }
    // ... rest of logic
}
```

---

## Identified Bugs

### BUG 1: Wrong Elevation Field Used for Collision (CRITICAL)

**Problem:** Our collision check uses `previousElevation`, but GBA uses `currentElevation`.

**GBA:**
```c
IsElevationMismatchAt(objectEvent->currentElevation, x, y)
```

**Our Code:**
```typescript
const playerElevation = this.previousElevation;  // WRONG!
```

**Impact:** After stepping onto elevation 0, player should have `currentElevation = 0` and be able to walk anywhere. Instead, we use `previousElevation` which retains the old elevation.

### BUG 2: Incorrect Elevation Update Logic for Elevation 0

**Problem:** We set both `currentElevation` and `previousElevation` to the same value, but GBA only updates `previousElevation` for tiles with elevation 1-14.

**GBA Logic:**
```c
objEvent->currentElevation = curElevation;  // Always set to tile elevation

if (curElevation != 0 && curElevation != 15)
    objEvent->previousElevation = curElevation;  // Only set for 1-14
```

**Our Logic:**
```typescript
this.currentElevation = newElevation;
this.previousElevation = newElevation;  // Always sets both to same value
```

**Impact:** When walking from elevation 3 to elevation 0:
- **GBA:** `currentElevation = 0`, `previousElevation = 3` (preserved)
- **Ours:** `currentElevation = 0`, `previousElevation = 0` (overwritten)

Since we use `previousElevation` for collision, this causes different behavior than expected.

### BUG 3: Incomplete Elevation 15 Handling

**Problem:** We only check if the CURRENT tile is elevation 15, but GBA also checks if the PREVIOUS tile was elevation 15.

**GBA Logic:**
```c
if (curElevation == 15 || prevElevation == 15)
    return;  // Don't update ANYTHING
```

**Our Logic:**
```typescript
if (mapElevation === 15) {
    newElevation = oldElevation;  // Only checks current tile
}
```

**Impact:** When walking FROM an elevation 15 tile to another tile, GBA preserves elevation. Our implementation would update it.

---

## User's Specific Scenario

### What's Happening

1. Player starts on a tile with elevation (let's say 3)
2. Player walks to tile 516 (metatile 516, elevation 0)
3. Debug shows: Tile Elev: 0, Player Elev: 3
4. Player tries to walk to tile 529

### Why It Fails

With our current implementation using `previousElevation` for collision:

1. After stepping onto elevation 0 tile, our code sets:
   - `currentElevation = 0`
   - `previousElevation = 0`

   **BUT** the debug shows Player Elev: 3, which suggests `updateElevation()` may not be called, OR the previous tile had elevation 15 which preserved elevation 3.

2. If `previousElevation = 3` (as debug shows), collision check:
   - `playerElevation = 3` (not 0, so doesn't bypass)
   - Target tile 529 elevation checked
   - If tile 529 has elevation != 0, 3, or 15 → **BLOCKED**

### How GBA Would Handle It

1. After stepping onto elevation 0 tile:
   - `currentElevation = 0`
   - `previousElevation = 3` (preserved for rendering)

2. Collision check uses `currentElevation = 0`:
   - `if (elevation == 0) return FALSE;`
   - **Player can walk ANYWHERE** from ground level!

---

## Recommended Fixes

### Fix 1: Use `currentElevation` for Collision Checks

**File:** `src/game/PlayerController.ts:957`

```typescript
// BEFORE (WRONG):
const playerElevation = this.previousElevation;

// AFTER (CORRECT):
const playerElevation = this.currentElevation;
```

### Fix 2: Correct Elevation Update Logic

**File:** `src/game/PlayerController.ts:590-626`

```typescript
public updateElevation(): void {
    const resolved = this.tileResolver?.(this.tileX, this.tileY);

    if (resolved) {
      const curElevation = resolved.mapTile.elevation;

      // Get previous tile's elevation (need to store this during movement)
      const prevTileElevation = this.previousTileElevation ?? 0;

      // GBA Rule: If EITHER current or previous tile is 15, don't update
      if (curElevation === 15 || prevTileElevation === 15) {
        return;  // Don't update anything!
      }

      // Always update currentElevation to tile's elevation
      this.currentElevation = curElevation;

      // Only update previousElevation for tiles 1-14
      if (curElevation !== 0 && curElevation !== 15) {
        this.previousElevation = curElevation;
      }
      // If curElevation is 0, previousElevation stays unchanged (preserved)
    }
}
```

### Fix 3: Track Previous Tile Elevation

Need to store the previous tile's map elevation (not player's previous elevation) to properly handle the elevation 15 check:

```typescript
private previousTileElevation: number = 0;

// When movement completes, before calling updateElevation():
const currentTileResolved = this.tileResolver?.(this.tileX, this.tileY);
this.previousTileElevation = currentTileResolved?.mapTile.elevation ?? 0;

// Then update to new position and call updateElevation()
```

---

## Rendering vs Collision: The Dual Elevation System

### GBA Design Intent

| Field | Used For | Update Rules |
|-------|----------|--------------|
| `currentElevation` | Collision checks | Always set to tile's elevation (except when tile is 15) |
| `previousElevation` | Rendering priority | Only updated for tiles 1-14, preserved for 0 and 15 |

### Why This Matters

**Bridges (elevation 15):**
- Player walks onto bridge at elevation 4
- Bridge tiles have elevation 15
- `currentElevation = 15` → BUT wait, GBA returns early, so `currentElevation` stays 4!
- `previousElevation` stays 4 (for rendering priority)
- Player can walk to other elevation 4 tiles or elevation 15 tiles

**Ground level (elevation 0):**
- Player walks onto ground at elevation 3
- Ground tile has elevation 0
- `currentElevation = 0` → Player can walk anywhere!
- `previousElevation = 3` (preserved for rendering)
- Player renders at priority level 3

---

## Testing Plan

### Test 1: Ground Level Movement
1. Walk from elevation 3 to elevation 0
2. Verify `currentElevation = 0`
3. Verify player can walk to ANY adjacent tile (no elevation blocking)

### Test 2: Bridge Crossing
1. Walk from elevation 4 onto elevation 15 bridge
2. Verify player elevation unchanged (stays 4)
3. Walk off bridge to elevation 4 tile → should work
4. Walk off bridge to elevation 0 tile → should also work (elev 0 accessible from anywhere)

### Test 3: Victory Road Scenario
1. Position at tile 516 (elevation 0)
2. Verify `currentElevation = 0`
3. Walk to tile 529 → should succeed regardless of tile 529's elevation

---

## Summary

| Issue | GBA Behavior | Our Behavior | Fix |
|-------|--------------|--------------|-----|
| Collision check elevation | Uses `currentElevation` | Uses `previousElevation` | Use `currentElevation` |
| Elevation 0 update | Only updates `currentElevation` | Updates both | Only update `currentElevation` for elev 0 |
| Elevation 15 check | Checks both current AND previous tile | Only checks current | Check both tiles |
| Purpose of `previousElevation` | Rendering priority only | Also used for collision | Separate concerns |

**Root Cause:** The browser implementation conflated `previousElevation` (for rendering) with the collision check, which should use `currentElevation`.

---

## References

- `public/pokeemerald/src/event_object_movement.c:7759-7771` - `ObjectEventUpdateElevation`
- `public/pokeemerald/src/event_object_movement.c:7707-7722` - `IsElevationMismatchAt`
- `public/pokeemerald/src/event_object_movement.c:4667` - Collision check caller
- `public/pokeemerald/src/field_player_avatar.c:1190` - `PlayerGetElevation`
- `src/game/PlayerController.ts:590-626` - Our `updateElevation`
- `src/game/PlayerController.ts:956-1008` - Our `isElevationMismatchAt`
