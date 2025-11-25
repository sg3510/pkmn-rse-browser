# Bridge/Elevation System - Quick Reference

## The Core Concept

**Elevation is stored per-map-coordinate in map.bin, NOT per tile graphic or metatile.**

Each 16-bit value in map.bin contains:
```
Bits 0-9:   Metatile ID (which tiles to render)
Bits 10-11: Collision (passable/impassable)
Bits 12-15: Elevation (0-15, determines walkable layer)
```

## Why Bridges Don't Work Currently

❌ **Missing**: No elevation extraction from map.bin  
❌ **Missing**: No player elevation tracking  
❌ **Missing**: No elevation mismatch collision  
✅ **Working**: Layer type rendering (visual appearance is correct)  

Result: Bridges look right but don't function correctly.

## The Fix (In Order)

### 1. Extract Elevation from Map Data
File: `src/utils/mapLoader.ts`

```typescript
interface MapTileData {
  metatileId: number;  // Bits 0-9
  collision: number;   // Bits 10-11
  elevation: number;   // Bits 12-15
}

function parseMapTile(value: number): MapTileData {
  return {
    metatileId: value & 0x03FF,
    collision: (value >> 10) & 0x03,
    elevation: (value >> 12) & 0x0F,
  };
}
```

### 2. Track Player Elevation
File: `src/game/PlayerController.ts`

```typescript
private currentElevation: number = 0;
private previousElevation: number = 0;

private updateElevation(): void {
  const resolved = this.tileResolver?.(this.tileX, this.tileY);
  if (resolved) {
    this.previousElevation = this.currentElevation;
    this.currentElevation = resolved.mapTile.elevation;
  }
}
```

### 3. Check Elevation in Collision
File: `src/game/PlayerController.ts`

```typescript
private isElevationMismatchAt(tileX: number, tileY: number): boolean {
  const playerElev = this.previousElevation;
  
  if (playerElev === 0) return false; // Ground level = universal
  
  const tileElev = resolved.mapTile.elevation;
  
  if (tileElev === 0 || tileElev === 15) return false; // Universal tiles
  
  return tileElev !== playerElev; // Different elevations = collision
}

private isCollisionAt(tileX: number, tileY: number): boolean {
  // ... existing checks ...
  
  if (this.isElevationMismatchAt(tileX, tileY)) {
    return true; // BLOCKED by elevation mismatch
  }
  
  // ... rest of checks ...
}
```

## Elevation Rules (from GBA code)

1. **Elevation 0** (ground level): Can walk anywhere not blocked by other collision
2. **Elevation 1-14** (platforms/bridges): Can ONLY walk on matching elevation
3. **Elevation 15** (universal): Accessible from any player elevation

Player at elevation 0 under bridge → Cannot walk onto elevation 3 bridge  
Player at elevation 3 on bridge → Cannot walk down to elevation 0 ground  

## Testing Your Implementation

### Victory Road Test
1. Spawn player at (29, 19) - should be elevation 0
2. Try walking north to (29, 18) - should be BLOCKED if that tile is elevation 3
3. Teleport to (29, 17) - elevation changes to 3
4. Now can walk on bridge, but BLOCKED from walking south to elevation 0

### Debug Display
Show in UI:
- Player elevation: `{player.getElevation()}`
- Tile elevation: `{tileData.elevation}`
- Collision reason: Show if blocked by elevation mismatch

## Key Files to Modify

1. `src/utils/mapLoader.ts` - Parse elevation from map.bin
2. `src/game/PlayerController.ts` - Track elevation, check collision
3. `src/components/MapRenderer.tsx` - Pass elevation in resolved tiles
4. `src/types/maps.ts` - Update type definitions

## Common Mistakes to Avoid

❌ Using `currentElevation` instead of `previousElevation` for collision  
❌ Forgetting to initialize elevation in `spawn()`  
❌ Not handling elevation 15 (universal) correctly  
❌ Not handling elevation 0 (ground) as universal for player  

## Full Documentation

- **How It Works**: `doc/bridge-elevation-system.md`
- **Implementation Plan**: `doc/bridge-react-implementation.md`

## Quick Verification

After implementing, this should work:
```
Map with elevation layout:
Row 0: [0, 0, 0, 0]  <- Ground
Row 1: [0, 3, 3, 0]  <- Bridge at elevation 3
Row 2: [0, 0, 0, 0]  <- Ground

Player at (1, 0) elevation 0:
- Can walk left/right in row 0
- CANNOT walk up to (1, 1) - elevation mismatch

Player at (1, 1) elevation 3:
- Can walk left/right in row 1 (on bridge)
- CANNOT walk down to (1, 0) - elevation mismatch
- CANNOT walk up to (1, 2) - elevation mismatch
```

That's it! Elevation is simple once you understand it's per-coordinate in the map data.



