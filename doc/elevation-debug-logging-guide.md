# Elevation Debug Logging Guide

## Log Prefixes

All elevation-related logs use clear prefixes to make debugging easier:

### `[SPAWN]` - Initial Player Placement
Logs when player is first placed on the map.
```
[SPAWN] Player spawned at (17, 18) with elevation 4, metatile 529
```

### `[INPUT]` - User Input & Movement Attempts
Logs when player tries to move.
```
[INPUT] Attempting to move right from (17, 18)
[INPUT] Target tile: (18, 18)
[INPUT] Movement ALLOWED, starting move to (18, 18)
```
or
```
[INPUT] Movement BLOCKED to (18, 19)
```

### `[MOVEMENT]` - Movement Completion
Logs when player finishes moving to a new tile.
```
[MOVEMENT] Completed move from (17, 18) → (18, 18)
```

### `[ELEVATION]` - Elevation Changes
Logs elevation updates when player moves to new tiles.
```
[ELEVATION] Player elevation changed: 0 → 4 at tile (17, 18)
[ELEVATION] Player elevation unchanged: 4 at tile (18, 18)
```

Special cases:
```
[ELEVATION] Player at ground level (0), can move to (18, 18)
[ELEVATION] Target (33, 17) is universal (elev 15), player at 3 can access - ALLOWED
[ELEVATION] Player at 4 can move to (18, 18) at 4 - ALLOWED
```

Warnings:
```
[ELEVATION MISMATCH] Player at elevation 4 CANNOT move to (17, 19) at elevation 0 - BLOCKED
[ELEVATION] Out of bounds at (50, 50), keeping elevation 4
```

### `[COLLISION]` - Collision Detection
Detailed collision checks with reasons.
```
[COLLISION] Tile (18, 18) metatile=707 elev=4 behavior=8 - PASSABLE
[COLLISION] Tile (17, 19) metatile=516 has collision bit=1, behavior=0 - BLOCKED
[COLLISION] Tile (18, 19) blocked by ELEVATION MISMATCH
```

## Common Scenarios

### Successful Movement (Same Elevation)
```
[INPUT] Attempting to move right from (17, 18)
[INPUT] Target tile: (18, 18)
[COLLISION] Tile (18, 18) metatile=707 elev=4 behavior=8 - PASSABLE
[ELEVATION] Player at 4 can move to (18, 18) at 4 - ALLOWED
[INPUT] Movement ALLOWED, starting move to (18, 18)
[MOVEMENT] Completed move from (17, 18) → (18, 18)
[ELEVATION] Player elevation unchanged: 4 at tile (18, 18)
```

### Blocked by Elevation Mismatch
```
[INPUT] Attempting to move down from (17, 18)
[INPUT] Target tile: (17, 19)
[COLLISION] Tile (17, 19) metatile=516 elev=0 behavior=0 - checking...
[ELEVATION MISMATCH] Player at elevation 4 CANNOT move to (17, 19) at elevation 0 - BLOCKED
[COLLISION] Tile (17, 19) blocked by ELEVATION MISMATCH
[INPUT] Movement BLOCKED to (17, 19)
```

### Movement to Universal Elevation (15)
```
[INPUT] Attempting to move right from (32, 17)
[INPUT] Target tile: (33, 17)
[COLLISION] Tile (33, 17) metatile=700 elev=15 behavior=8 - checking...
[ELEVATION] Target (33, 17) is universal (elev 15), player at 3 can access - ALLOWED
[COLLISION] Tile (33, 17) metatile=700 elev=15 behavior=8 - PASSABLE
[INPUT] Movement ALLOWED, starting move to (33, 17)
[MOVEMENT] Completed move from (32, 17) → (33, 17)
[ELEVATION] Player elevation changed: 3 → 15 at tile (33, 17)
```

### Movement from Universal Elevation
```
[INPUT] Attempting to move right from (33, 17)
[INPUT] Target tile: (34, 17)
[COLLISION] Tile (34, 17) metatile=701 elev=4 behavior=8 - checking...
[ELEVATION] Target (34, 17) is universal (elev 15), player at 15 can access - ALLOWED
[COLLISION] Tile (34, 17) metatile=701 elev=4 behavior=8 - PASSABLE
[INPUT] Movement ALLOWED, starting move to (34, 17)
[MOVEMENT] Completed move from (33, 17) → (34, 17)
[ELEVATION] Player elevation changed: 15 → 4 at tile (34, 17)
```

### Player at Ground Level (Universal)
```
[INPUT] Attempting to move up from (16, 19)
[INPUT] Target tile: (16, 18)
[COLLISION] Tile (16, 18) metatile=529 elev=4 behavior=8 - checking...
[ELEVATION] Player at ground level (0), can move to (16, 18)
[COLLISION] Tile (16, 18) metatile=529 elev=4 behavior=8 - PASSABLE
[INPUT] Movement ALLOWED, starting move to (16, 18)
[MOVEMENT] Completed move from (16, 19) → (16, 18)
[ELEVATION] Player elevation changed: 0 → 4 at tile (16, 18)
```

## Debugging Tips

### Problem: Movement Blocked Unexpectedly

**Look for:**
```
[ELEVATION MISMATCH] Player at elevation X CANNOT move to (...) at elevation Y - BLOCKED
```

**Check:**
1. Is player elevation correct? Look at the `[ELEVATION]` log from last movement
2. Is target tile elevation what you expect? Check the debug dump
3. Are both elevations non-zero and different? (That's when blocking happens)

**Special Cases to Remember:**
- Elevation 0 = Universal for PLAYER (can move anywhere)
- Elevation 15 = Universal for TILES (any player can access)
- Same elevation = Always allowed

### Problem: Elevation Not Updating

**Look for:**
```
[ELEVATION] Player elevation unchanged: X at tile (...)
```

vs
```
[ELEVATION] Player elevation changed: X → Y at tile (...)
```

**Check:**
1. Did movement complete? Look for `[MOVEMENT] Completed move`
2. Is the new tile's elevation in the map data? Check debug dump
3. Was `updateElevation()` called? Should happen after every movement

### Problem: Can't Determine Why Blocked

**Follow this sequence:**
1. Find the `[INPUT] Attempting to move` log
2. Look at the `[COLLISION]` log for that target tile
3. Check what reason it gives: elevation mismatch, collision bit, behavior, etc.
4. Look at elevation logs to understand player vs tile elevation

### Problem: Wrong Elevation After Spawn

**Look for:**
```
[SPAWN] Player spawned at (...) with elevation X, metatile Y
```

**Check:**
1. Does the spawn tile elevation match map data?
2. Is tileResolver working correctly?

## Console Commands for Testing

Open browser console and try:

```javascript
// Get current player elevation
console.log('Player elevation:', player.getElevation());

// Get current tile info
console.log('Current tile:', player.tileX, player.tileY);

// Force move (bypasses collision)
player.forceMove('right', true);
```

## Filtering Logs

In Chrome DevTools console, use filters:

- `[ELEVATION]` - Only elevation logs
- `[COLLISION]` - Only collision logs  
- `[MOVEMENT]` - Only movement completion logs
- `BLOCKED` - Only blocked movement logs
- `MISMATCH` - Only elevation mismatch logs

## Expected Behavior Reference

### Elevation Rules (from GBA)

1. **Player at elevation 0**: Can walk ANYWHERE (universal)
2. **Tile at elevation 0**: Can be accessed from ANY player elevation (universal)
3. **Tile at elevation 15**: Can be accessed from ANY player elevation (universal)
4. **Player at elevation N (1-14)**: Can ONLY walk on elevation N or 0 or 15
5. **Different non-zero elevations**: ALWAYS blocked (e.g., elev 3 cannot reach elev 4)

### Victory Road Examples

From your dumps:

**Dump 1 - Platform Area:**
- Tiles at (16-18, 17-18): elevation 4 (platform)
- Tiles at (16-18, 19): elevation 0 (ground)
- Player at elevation 4 CANNOT walk to elevation 0
- Player at elevation 0 CAN walk to elevation 4

**Dump 2 - Bridge Area:**
- Tiles at (32-33, 16): elevation 3
- Tiles at (32-33, 17-18): elevation 15 (universal transition)
- Tile at (34, 17): elevation 4
- Player at elevation 3 can access elevation 15 (universal)
- Player at elevation 15 can access elevation 4 (universal)
- Player at elevation 4 at (34, 17) would be BLOCKED from elevation 3 at (33, 16)

## Next Steps

If you see unexpected behavior in the logs:

1. **Copy the entire log sequence** from spawn to blocked movement
2. **Include the debug dump** showing tile data
3. **Describe what you expected** vs what happened
4. Compare the logs to the "Expected Behavior Reference" above

The logs should now give you complete visibility into the elevation system!



