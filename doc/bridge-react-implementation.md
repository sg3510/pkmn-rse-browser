# Bridge/Elevation System Implementation Plan for React Browser

## Overview

This document provides a **detailed, step-by-step implementation plan** for adding the elevation system to the browser-based Pokémon RSE implementation. The elevation system is what allows bridges, multi-level caves, and platforms to work correctly.

**Key Insight:** Elevation is stored **per map coordinate** in the map.bin file, NOT per tile graphic or metatile definition. Each coordinate stores a 16-bit value containing:
- Bits 0-9: Metatile ID
- Bits 10-11: Collision
- **Bits 12-15: Elevation (0-15)**

## Reference Documentation

- **Investigation**: `doc/bridge-elevation-system.md` - Deep dive into how the system works
- **GBA Source**: `public/pokeemerald/include/global.fieldmap.h` - Data structure definitions
- **GBA Source**: `public/pokeemerald/src/fieldmap.c` - Elevation resolution
- **GBA Source**: `public/pokeemerald/src/event_object_movement.c` - Collision logic

---

## Implementation Phases

### Phase 1: Data Layer - Extract Elevation from Map Data
### Phase 2: Type System - Add Elevation to TypeScript Interfaces  
### Phase 3: Player State - Track Player Elevation
### Phase 4: Collision System - Implement Elevation Mismatch
### Phase 5: Warp System - Add Elevation Requirements
### Phase 6: Debug Tools - Visualize Elevation
### Phase 7: Testing - Verify All Scenarios

---

## Phase 1: Data Layer - Extract Elevation from Map Data

### 1.1 Update Map Data Parser

**File:** `src/utils/mapLoader.ts`

**Current State:**
```typescript
// Currently only extracts metatileId from map.bin
function parseMapLayout(data: ArrayBuffer): number[] {
  const view = new DataView(data);
  const tiles: number[] = [];
  for (let i = 0; i < view.byteLength; i += 2) {
    const value = view.getUint16(i, true); // Little-endian
    const metatileId = value & 0x03FF; // Only bits 0-9
    tiles.push(metatileId);
  }
  return tiles;
}
```

**New Implementation:**

```typescript
/**
 * Represents a single map tile with all its data from map.bin
 * 
 * Reference: public/pokeemerald/include/global.fieldmap.h:4-19
 * Map grid blocks consist of:
 * - 10 bit metatile id (bits 0-9)
 * - 2 bit collision value (bits 10-11)
 * - 4 bit elevation value (bits 12-15)
 */
export interface MapTileData {
  metatileId: number;   // Bits 0-9
  collision: number;    // Bits 10-11
  elevation: number;    // Bits 12-15
}

/**
 * Bit masks and shifts for map.bin tile data
 * Reference: public/pokeemerald/include/global.fieldmap.h:7-12
 */
const MAPGRID_METATILE_ID_MASK = 0x03FF;  // Bits 0-9
const MAPGRID_COLLISION_MASK = 0x0C00;    // Bits 10-11
const MAPGRID_ELEVATION_MASK = 0xF000;    // Bits 12-15

const MAPGRID_METATILE_ID_SHIFT = 0;
const MAPGRID_COLLISION_SHIFT = 10;
const MAPGRID_ELEVATION_SHIFT = 12;

/**
 * Parse a single 16-bit map tile value into its components
 * 
 * Reference: public/pokeemerald/include/global.fieldmap.h:17-19
 */
function parseMapTile(value: number): MapTileData {
  return {
    metatileId: (value & MAPGRID_METATILE_ID_MASK) >>> MAPGRID_METATILE_ID_SHIFT,
    collision: (value & MAPGRID_COLLISION_MASK) >>> MAPGRID_COLLISION_SHIFT,
    elevation: (value & MAPGRID_ELEVATION_MASK) >>> MAPGRID_ELEVATION_SHIFT,
  };
}

/**
 * Parse the entire map.bin file into structured tile data
 */
function parseMapLayout(data: ArrayBuffer): MapTileData[] {
  const view = new DataView(data);
  const tiles: MapTileData[] = [];
  
  for (let i = 0; i < view.byteLength; i += 2) {
    const value = view.getUint16(i, true); // Little-endian
    tiles.push(parseMapTile(value));
  }
  
  return tiles;
}
```

**Testing:**
```typescript
// Test with known values
const testValue = 0xF2BC; // Example: elevation=15, collision=2, metatileId=700
const parsed = parseMapTile(testValue);
console.assert(parsed.metatileId === 700, 'Metatile ID should be 700');
console.assert(parsed.collision === 2, 'Collision should be 2');
console.assert(parsed.elevation === 15, 'Elevation should be 15');
```

### 1.2 Update MapData Interface

**File:** `src/types/maps.ts`

```typescript
export interface MapData {
  name: string;
  width: number;
  height: number;
  layout: MapTileData[];  // CHANGED: was number[], now MapTileData[]
  borderTiles: number[];
  // ... other fields
}
```

**Impact:** This will require updates to all code that accesses `layout` array.

### 1.3 Update Map Loading Functions

**File:** `src/services/MapManager.ts` or wherever maps are loaded

**Before:**
```typescript
const layout = parseMapLayout(mapBinData);
// layout is number[]
```

**After:**
```typescript
const layout = parseMapLayout(mapBinData);
// layout is now MapTileData[]

// When you need just the metatile ID for rendering:
const metatileId = layout[index].metatileId;

// When you need elevation for collision:
const elevation = layout[index].elevation;

// When you need collision bits:
const collision = layout[index].collision;
```

---

## Phase 2: Type System - Add Elevation to TypeScript Interfaces

### 2.1 Update ResolvedTile Interface

**File:** `src/components/MapRenderer.tsx`

**Current:**
```typescript
interface ResolvedTile {
  map: WorldMapInstance;
  tileset: TilesetData;
  metatile: Metatile | null;
  attributes: MetatileAttributes | undefined;
  mapTile: number;  // The raw 16-bit value
  isSecondary: boolean;
  isBorder: boolean;
}
```

**New:**
```typescript
interface ResolvedTile {
  map: WorldMapInstance;
  tileset: TilesetData;
  metatile: Metatile | null;
  attributes: MetatileAttributes | undefined;
  mapTile: MapTileData;  // CHANGED: now the full parsed data
  isSecondary: boolean;
  isBorder: boolean;
}
```

### 2.2 Update resolveTileAt Function

**File:** `src/components/MapRenderer.tsx`

**Reference:** This is the core function that looks up tile data at world coordinates

**Current Implementation:**
```typescript
function resolveTileAt(ctx: RenderContext, worldTileX: number, worldTileY: number): ResolvedTile | null {
  const map = ctx.world.maps.find(/* ... */);
  
  if (map) {
    const localX = worldTileX - map.offsetX;
    const localY = worldTileY - map.offsetY;
    const idx = localY * map.mapData.width + localX;
    const mapTile = map.mapData.layout[idx];  // was number
    const metatileId = getMetatileIdFromMapTile(mapTile);
    // ...
  }
}
```

**New Implementation:**
```typescript
function resolveTileAt(ctx: RenderContext, worldTileX: number, worldTileY: number): ResolvedTile | null {
  const map = ctx.world.maps.find(
    (m) =>
      worldTileX >= m.offsetX &&
      worldTileX < m.offsetX + m.mapData.width &&
      worldTileY >= m.offsetY &&
      worldTileY < m.offsetY + m.mapData.height
  );
  
  if (map) {
    const localX = worldTileX - map.offsetX;
    const localY = worldTileY - map.offsetY;
    const idx = localY * map.mapData.width + localX;
    const mapTileData = map.mapData.layout[idx];  // Now MapTileData
    
    // Extract metatile ID for looking up metatile definition
    const metatileId = mapTileData.metatileId;
    const isSecondary = metatileId >= NUM_PRIMARY_METATILES;
    
    const metatile = isSecondary
      ? map.tilesets.secondaryMetatiles[metatileId - NUM_PRIMARY_METATILES] ?? null
      : map.tilesets.primaryMetatiles[metatileId] ?? null;
      
    const attributes = isSecondary
      ? map.tilesets.secondaryAttributes[metatileId - NUM_PRIMARY_METATILES]
      : map.tilesets.primaryAttributes[metatileId];
      
    return {
      map,
      tileset: map.tilesets,
      metatile,
      attributes,
      mapTile: mapTileData,  // Full data including elevation
      isSecondary,
      isBorder: false,
    };
  }
  
  // Border tile handling...
  return null;
}
```

### 2.3 Remove getMetatileIdFromMapTile Helper

**File:** Wherever this is defined (likely `mapLoader.ts` or `MapRenderer.tsx`)

**Delete this function** as it's no longer needed:
```typescript
// DELETE THIS
function getMetatileIdFromMapTile(mapTile: number): number {
  return mapTile & 0x3FF;
}
```

**Replace with direct access:**
```typescript
// Use this instead
const metatileId = mapTileData.metatileId;
```

### 2.4 Update getCollisionFromMapTile Helper

**File:** Wherever collision is checked

**Current:**
```typescript
function getCollisionFromMapTile(mapTile: number): number {
  return (mapTile >> 10) & 0x03;
}
```

**New:**
```typescript
function getCollisionFromMapTile(mapTileData: MapTileData): number {
  return mapTileData.collision;
}

// Or just access directly:
const collision = mapTileData.collision;
```

---

## Phase 3: Player State - Track Player Elevation

### 3.1 Add Elevation State to PlayerController

**File:** `src/game/PlayerController.ts`

**Reference:** `public/pokeemerald/src/field_player_avatar.c:1188` - `PlayerGetElevation()`

**Add to class properties:**
```typescript
export class PlayerController {
  // Existing properties...
  public x: number = 0;
  public y: number = 0;
  public tileX: number = 0;
  public tileY: number = 0;
  
  // NEW: Elevation tracking
  /**
   * Player's current elevation (from current tile)
   * Reference: ObjectEvent.currentElevation in public/pokeemerald/include/global.fieldmap.h
   */
  private currentElevation: number = 0;
  
  /**
   * Player's previous elevation (used for collision checks)
   * Reference: ObjectEvent.previousElevation and PlayerGetElevation()
   * in public/pokeemerald/src/field_player_avatar.c:1188
   */
  private previousElevation: number = 0;
  
  // ... rest of properties
}
```

### 3.2 Add Elevation Getter

```typescript
/**
 * Get the player's elevation for collision detection
 * 
 * Reference: public/pokeemerald/src/field_player_avatar.c:1188
 * Returns previousElevation, which is the elevation of the tile
 * the player is currently standing on.
 */
public getElevation(): number {
  return this.previousElevation;
}
```

### 3.3 Update Elevation When Moving

**Reference:** The GBA updates elevation in `UpdateObjectEventCurrentMovement()` flow

**Add to movement update logic:**

```typescript
private updatePosition(deltaTime: number): void {
  // Existing movement code...
  
  const oldTileX = this.tileX;
  const oldTileY = this.tileY;
  
  this.x += this.vx * deltaTime;
  this.y += this.vy * deltaTime;
  
  const newTileX = Math.floor(this.x / this.TILE_PIXELS);
  const newTileY = Math.floor(this.y / this.TILE_PIXELS);
  
  // Check if we've moved to a new tile
  if (newTileX !== oldTileX || newTileY !== oldTileY) {
    this.tileX = newTileX;
    this.tileY = newTileY;
    
    // NEW: Update elevation when changing tiles
    this.updateElevation();
  }
  
  // ... rest of movement code
}

/**
 * Update player elevation based on current tile
 * 
 * Reference: UpdateObjectEventCurrentMovement() and related functions
 * in public/pokeemerald/src/event_object_movement.c
 */
private updateElevation(): void {
  const resolved = this.tileResolver?.(this.tileX, this.tileY);
  
  if (resolved) {
    this.previousElevation = this.currentElevation;
    this.currentElevation = resolved.mapTile.elevation;
  } else {
    // Out of bounds - keep current elevation
    this.previousElevation = this.currentElevation;
  }
}
```

### 3.4 Initialize Elevation on Spawn

```typescript
public spawn(tileX: number, tileY: number, dir: Direction, onTerrain: TerrainType = 'land'): void {
  // Existing spawn code...
  this.tileX = tileX;
  this.tileY = tileY;
  this.x = tileX * this.TILE_PIXELS;
  this.y = tileY * this.TILE_PIXELS;
  this.dir = dir;
  
  // NEW: Initialize elevation from spawn tile
  const resolved = this.tileResolver?.(this.tileX, this.tileY);
  if (resolved) {
    this.currentElevation = resolved.mapTile.elevation;
    this.previousElevation = resolved.mapTile.elevation;
  } else {
    this.currentElevation = 0;
    this.previousElevation = 0;
  }
  
  // ... rest of spawn code
}
```

---

## Phase 4: Collision System - Implement Elevation Mismatch

### 4.1 Add IsElevationMismatchAt Function

**File:** `src/game/PlayerController.ts`

**Reference:** `public/pokeemerald/src/event_object_movement.c:7707`

```typescript
/**
 * Check if there is an elevation mismatch between player and target tile
 * 
 * Reference: IsElevationMismatchAt() in public/pokeemerald/src/event_object_movement.c:7707
 * 
 * Logic:
 * - Ground level (elevation 0) can move anywhere (unless blocked by other collision)
 * - Tiles with elevation 0 or 15 are accessible from any player elevation
 * - Different non-zero elevations cannot interact (collision)
 * 
 * @param tileX Target tile X coordinate
 * @param tileY Target tile Y coordinate
 * @returns true if elevation mismatch prevents movement
 */
private isElevationMismatchAt(tileX: number, tileY: number): boolean {
  const playerElevation = this.previousElevation;
  
  // Ground level (0) can go anywhere
  // Reference: public/pokeemerald/src/event_object_movement.c:7711-7712
  if (playerElevation === 0) {
    return false;
  }
  
  const resolved = this.tileResolver?.(tileX, tileY);
  if (!resolved) {
    return true; // Out of bounds = mismatch
  }
  
  const tileElevation = resolved.mapTile.elevation;
  
  // Tiles with elevation 0 or 15 are accessible from any elevation
  // Reference: public/pokeemerald/src/event_object_movement.c:7716-7717
  if (tileElevation === 0 || tileElevation === 15) {
    return false;
  }
  
  // Different non-zero elevations = mismatch = COLLISION
  // Reference: public/pokeemerald/src/event_object_movement.c:7719-7720
  if (tileElevation !== playerElevation) {
    return true;
  }
  
  return false;
}
```

### 4.2 Update Collision Detection

**File:** `src/game/PlayerController.ts`

**Reference:** `public/pokeemerald/src/event_object_movement.c:4658` - `GetCollisionAtCoords()`

**Update isCollisionAt method:**

```typescript
/**
 * Check if movement to a tile is blocked by collision
 * 
 * Reference: GetCollisionAtCoords() in public/pokeemerald/src/event_object_movement.c:4658
 * 
 * Collision checks in order:
 * 1. Out of bounds
 * 2. Collision bit set in map data
 * 3. Impassable behavior
 * 4. ELEVATION MISMATCH (new!)
 * 5. Other special checks (water, directional, etc.)
 */
private isCollisionAt(tileX: number, tileY: number): boolean {
  const resolved = this.tileResolver?.(tileX, tileY);
  if (!resolved) return true; // Out of bounds = collision
  
  const mapTileData = resolved.mapTile;
  const attributes = resolved.attributes;
  
  if (!attributes) {
    return false; // No attributes = passable
  }
  
  const behavior = attributes.behavior;
  
  // Check collision bits from map.bin (bits 10-11)
  const collision = mapTileData.collision;
  if (!isCollisionPassable(collision) && !isDoorBehavior(behavior)) {
    return true; // Collision bit set
  }
  
  // Impassable behaviors
  if (behavior === 1) return true; // MB_SECRET_BASE_WALL
  
  // NEW: Elevation mismatch check
  // Reference: public/pokeemerald/src/event_object_movement.c:4667
  if (this.isElevationMismatchAt(tileX, tileY)) {
    return true; // COLLISION_ELEVATION_MISMATCH
  }
  
  // Surfable/deep water and waterfalls require surf
  const surfBlockers = new Set<number>([
    MB_POND_WATER,
    MB_INTERIOR_DEEP_WATER,
    MB_DEEP_WATER,
    MB_SOOTOPOLIS_DEEP_WATER,
    MB_OCEAN_WATER,
    MB_NO_SURFACING,
    MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2,
    MB_WATERFALL,
    MB_SEAWEED,
    MB_SEAWEED_NO_SURFACING,
  ]);
  if (surfBlockers.has(behavior)) return true;
  
  // Directionally impassable (behaviors 48-55)
  if (behavior >= 48 && behavior <= 55) return true;
  
  return false; // Passable
}
```

### 4.3 Add Collision Type Enum (Optional but Recommended)

**File:** `src/game/PlayerController.ts`

```typescript
/**
 * Collision types matching GBA enum
 * Reference: public/pokeemerald/include/global.fieldmap.h:299
 */
enum CollisionType {
  NONE = 0,
  OUTSIDE_RANGE = 1,
  IMPASSABLE = 2,
  ELEVATION_MISMATCH = 3,  // NEW
  OBJECT_EVENT = 4,
  STOP_SURFING = 5,
  LEDGE_JUMP = 6,
  PUSHED_BOULDER = 7,
  ROTATING_GATE = 8,
}

// Can be used for more detailed collision feedback
private getCollisionType(tileX: number, tileY: number): CollisionType {
  const resolved = this.tileResolver?.(tileX, tileY);
  if (!resolved) return CollisionType.OUTSIDE_RANGE;
  
  // ... collision checks ...
  
  if (this.isElevationMismatchAt(tileX, tileY)) {
    return CollisionType.ELEVATION_MISMATCH;
  }
  
  // ... more checks ...
  
  return CollisionType.NONE;
}
```

---

## Phase 5: Warp System - Add Elevation Requirements

### 5.1 Update WarpEvent Interface

**File:** `src/types/maps.ts` or wherever warp events are defined

**Reference:** `public/pokeemerald/include/global.fieldmap.h:103`

```typescript
/**
 * Warp event structure
 * Reference: struct WarpEvent in public/pokeemerald/include/global.fieldmap.h:103
 */
export interface WarpEvent {
  x: number;
  y: number;
  elevation: number;  // NEW: warp only triggers if player elevation matches
  warpId: number;
  mapNum: number;
  mapGroup: number;
}
```

### 5.2 Update Warp Detection

**File:** `src/components/MapRenderer.tsx` (or wherever warp detection happens)

```typescript
function detectWarpTrigger(ctx: RenderContext, player: PlayerController): WarpTrigger | null {
  // Find warp event at player position
  const map = ctx.world.maps.find(
    (m) =>
      player.tileX >= m.offsetX &&
      player.tileX < m.offsetX + m.mapData.width &&
      player.tileY >= m.offsetY &&
      player.tileY < m.offsetY + m.mapData.height
  );
  
  if (!map) return null;
  
  const localX = player.tileX - map.offsetX;
  const localY = player.tileY - map.offsetY;
  
  const warpEvent = map.mapData.warpEvents?.find(
    (w) => w.x === localX && w.y === localY
  );
  
  if (warpEvent) {
    // NEW: Check elevation requirement
    // Reference: Warp elevation check in various places in pokeemerald
    const playerElevation = player.getElevation();
    
    if (warpEvent.elevation !== playerElevation) {
      // Wrong elevation - warp not triggered
      return null;
    }
    
    return {
      kind: 'warp',
      event: warpEvent,
      facing: player.dir,
    };
  }
  
  return null;
}
```

### 5.3 Update Warp Data Parsing

**File:** Wherever map JSON is parsed (likely `MapManager.ts`)

Make sure warp events are parsed with elevation:

```typescript
function parseMapWarpEvents(mapJson: any): WarpEvent[] {
  return mapJson.warp_events?.map((w: any) => ({
    x: w.x,
    y: w.y,
    elevation: w.elevation ?? 0,  // Default to 0 if missing
    warpId: w.dest_warp_id,
    mapNum: w.dest_map_num,
    mapGroup: w.dest_map_group,
  })) ?? [];
}
```

---

## Phase 6: Debug Tools - Visualize Elevation

### 6.1 Update Debug Tile Info Display

**File:** `src/components/MapRenderer.tsx`

**Update describeTile function:**

```typescript
function describeTile(
  ctx: RenderContext,
  tileX: number,
  tileY: number
): DebugTileInfo {
  const resolved = resolveTileAt(ctx, tileX, tileY);
  
  if (!resolved || !resolved.metatile) {
    return {
      inBounds: false,
      // ... empty values
    };
  }
  
  const mapTileData = resolved.mapTile;
  
  return {
    inBounds: true,
    tileX,
    tileY,
    mapTile: mapTileData,  // Include full data
    metatileId: mapTileData.metatileId,
    elevation: mapTileData.elevation,  // NEW: Show elevation
    collision: mapTileData.collision,  // NEW: Show collision bits
    isSecondary: resolved.isSecondary,
    behavior: resolved.attributes?.behavior ?? 0,
    layerType: resolved.attributes?.layerType ?? 0,
    layerTypeLabel: layerTypeToLabel(resolved.attributes?.layerType ?? 0),
    // ... other fields
  };
}
```

### 6.2 Add Elevation to Player Debug Display

```typescript
// In the debug overlay component
<div className="debug-player-info">
  <div>Player: ({player.tileX}, {player.tileY})</div>
  <div>Position: ({player.x.toFixed(1)}, {player.y.toFixed(1)})</div>
  <div>Direction: {player.dir}</div>
  <div>Elevation: {player.getElevation()}</div>  {/* NEW */}
  <div>State: {player.currentState.name}</div>
</div>
```

### 6.3 Add Elevation Visualization Overlay (Optional)

**Create a visual overlay showing elevation zones:**

```typescript
/**
 * Render elevation heatmap overlay for debugging
 */
function renderElevationOverlay(
  ctx: RenderContext,
  canvasCtx: CanvasRenderingContext2D,
  view: WorldCameraView
): void {
  const ELEVATION_COLORS = [
    'rgba(0, 0, 0, 0)',      // 0: Ground (transparent)
    'rgba(255, 0, 0, 0.2)',   // 1: Red
    'rgba(255, 127, 0, 0.2)', // 2: Orange
    'rgba(255, 255, 0, 0.2)', // 3: Yellow (common bridge elevation)
    'rgba(0, 255, 0, 0.2)',   // 4: Green
    'rgba(0, 0, 255, 0.2)',   // 5: Blue
    // ... more colors
  ];
  
  for (let localY = 0; localY < view.tilesHigh; localY++) {
    const tileY = view.worldStartTileY + localY;
    for (let localX = 0; localX < view.tilesWide; localX++) {
      const tileX = view.worldStartTileX + localX;
      
      const resolved = resolveTileAt(ctx, tileX, tileY);
      if (!resolved) continue;
      
      const elevation = resolved.mapTile.elevation;
      if (elevation === 0) continue; // Don't highlight ground
      
      const color = ELEVATION_COLORS[elevation] ?? 'rgba(255, 255, 255, 0.2)';
      
      const screenX = localX * 16;
      const screenY = localY * 16;
      
      canvasCtx.fillStyle = color;
      canvasCtx.fillRect(screenX, screenY, 16, 16);
      
      // Draw elevation number
      canvasCtx.fillStyle = 'white';
      canvasCtx.font = '10px monospace';
      canvasCtx.fillText(elevation.toString(), screenX + 4, screenY + 12);
    }
  }
}
```

### 6.4 Add Keyboard Toggle for Debug Overlays

```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'e' && e.ctrlKey) {
      setShowElevationOverlay(prev => !prev);
    }
  };
  
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

---

## Phase 7: Testing - Verify All Scenarios

### 7.1 Unit Tests for Elevation Parsing

**File:** `src/utils/mapLoader.test.ts` (create if doesn't exist)

```typescript
import { parseMapTile } from './mapLoader';

describe('Map Tile Parsing', () => {
  test('parses elevation correctly', () => {
    // Tile with elevation 3, collision 0, metatileId 700
    const tile = parseMapTile(0x32BC);
    
    expect(tile.metatileId).toBe(700);
    expect(tile.collision).toBe(0);
    expect(tile.elevation).toBe(3);
  });
  
  test('parses elevation 15 (universal)', () => {
    const tile = parseMapTile(0xF000);
    expect(tile.elevation).toBe(15);
  });
  
  test('parses collision bits', () => {
    const tile = parseMapTile(0x0C00); // collision = 3
    expect(tile.collision).toBe(3);
  });
  
  test('parses all bits together', () => {
    // elevation=15, collision=2, metatileId=1023
    const tile = parseMapTile(0xFBFF);
    
    expect(tile.elevation).toBe(15);
    expect(tile.collision).toBe(2);
    expect(tile.metatileId).toBe(1023);
  });
});
```

### 7.2 Integration Tests for Elevation Mismatch

**File:** `src/game/PlayerController.test.ts`

```typescript
describe('Elevation Collision', () => {
  test('player at elevation 0 can walk anywhere', () => {
    const player = new PlayerController();
    // Mock tileResolver that returns elevation 0 for player, 3 for target
    player.spawn(10, 10, 'down');
    
    // Should NOT have elevation mismatch when at elevation 0
    const canMove = !player.isCollisionAt(10, 11);
    expect(canMove).toBe(true);
  });
  
  test('player at elevation 3 cannot walk to elevation 0', () => {
    const player = new PlayerController();
    // Mock tileResolver
    // Player at (10, 10) with elevation 3
    // Target (10, 11) with elevation 0
    
    player.spawn(10, 10, 'down');
    // ... set up mock to return correct elevations
    
    const canMove = !player.isCollisionAt(10, 11);
    expect(canMove).toBe(false); // Should be blocked
  });
  
  test('player at elevation 3 can walk to elevation 15', () => {
    // Elevation 15 is universal - accessible from any elevation
    // ... test implementation
  });
});
```

### 7.3 Manual Testing Scenarios

#### Test Case 1: Victory Road 1F Bridge

**Location:** MAP_VICTORY_ROAD_1F, coordinates (29, 18)

**Setup:**
1. Load Victory Road 1F
2. Spawn player at (29, 19) - should be elevation 0 (under bridge)

**Expected Behavior:**
- [ ] Player can walk left/right at elevation 0
- [ ] Player CANNOT walk north to (29, 18) if that tile has elevation 3
- [ ] Debug display shows elevation 0 for player
- [ ] Debug display shows elevation 3 for bridge tiles

**Then:**
3. Teleport player to (29, 17) - should be elevation 3 (on bridge)

**Expected Behavior:**
- [ ] Player elevation updates to 3
- [ ] Player can walk on bridge (tiles with elevation 3)
- [ ] Player CANNOT walk south to elevation 0 tiles
- [ ] Player appears to walk ON the bridge surface

#### Test Case 2: Route 110 Bridge

**Location:** MAP_ROUTE110, log bridge section

**Setup:**
1. Load Route 110
2. Find the log bridge over water
3. Spawn player under bridge (elevation 0)

**Expected Behavior:**
- [ ] Player walks under bridge
- [ ] Bridge surface visible above player
- [ ] Can walk freely at elevation 0

**Then:**
4. Move to bridge entrance (elevation should change)

**Expected Behavior:**
- [ ] Player elevation changes to 3 or higher
- [ ] Player now walks ON bridge
- [ ] Cannot walk off sides (elevation mismatch)

#### Test Case 3: Fortree City Bridge

**Location:** MAP_FORTREE_CITY

**Setup:**
1. Load Fortree City (famous rope bridge)
2. Test elevation transitions

**Expected Behavior:**
- [ ] Bridges have special behavior MB_FORTREE_BRIDGE
- [ ] Elevation system prevents falling off
- [ ] May need special handling for bridge animations (Phase 8)

#### Test Case 4: Warp with Elevation

**Location:** Any building with stairs (e.g., Pokemon Center)

**Setup:**
1. Load a Pokemon Center
2. Find stairs warp event

**Expected Behavior:**
- [ ] Warp event has elevation requirement
- [ ] Warp only triggers when player elevation matches
- [ ] Player at wrong elevation cannot trigger warp

#### Test Case 5: Multi-Level Cave

**Location:** MAP_METEOR_FALLS or similar

**Setup:**
1. Load a cave with multiple floors
2. Test walking between levels

**Expected Behavior:**
- [ ] Cannot walk between different elevation zones
- [ ] Proper collision at elevation boundaries
- [ ] Rendering shows correct depth perception

### 7.4 Create Test Map (Optional but Recommended)

Create a simple test map with known elevation values:

```
Row 0: [0,0,0,0,0,0,0,0]
Row 1: [0,3,3,3,3,3,3,0]  <- Elevation 3 bridge
Row 2: [0,0,0,0,0,0,0,0]
Row 3: [0,0,6,6,6,0,0,0]  <- Elevation 6 platform
Row 4: [0,0,0,0,0,0,0,0]
```

Test that:
- Player at 0 can walk in Row 0, 2, 4
- Player cannot cross from Row 0 to Row 1
- Player at elevation 3 can walk in Row 1
- Player at elevation 6 can walk in Row 3

---

## Phase 8: Advanced Features (Future Enhancements)

### 8.1 Elevation-Based Sprite Priority

**Reference:** `public/pokeemerald/src/event_object_movement.c:7729`

```typescript
const ELEVATION_TO_PRIORITY = [
  2, 2, 2, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 2
];

function getSpritePriority(elevation: number): number {
  return ELEVATION_TO_PRIORITY[elevation] ?? 2;
}
```

Use this to control sprite rendering order based on elevation.

### 8.2 Fortree Bridge Animation

**Reference:** `public/pokeemerald/src/field_tasks.c:490`

Implement animated bridge that changes appearance when stepped on:
- Detect when player steps on bridge tile
- Swap metatile to "lowered" version
- Play bridge walk sound effect

### 8.3 Elevation Transitions

For smooth elevation changes (like slopes):
- Allow player to step between adjacent elevations (3→4, 4→5)
- Add transition animations
- Handle gradual elevation changes in map data

---

## Implementation Checklist

### Phase 1: Data Layer ✓
- [ ] Update `parseMapTile()` to extract elevation (bits 12-15)
- [ ] Create `MapTileData` interface
- [ ] Update `MapData.layout` type from `number[]` to `MapTileData[]`
- [ ] Update all code that accesses `layout` array
- [ ] Remove `getMetatileIdFromMapTile()` helper
- [ ] Test elevation parsing with known values

### Phase 2: Type System ✓
- [ ] Update `ResolvedTile` interface
- [ ] Update `resolveTileAt()` function
- [ ] Update `getCollisionFromMapTile()` helper
- [ ] Update all references to `mapTile` to use `MapTileData`
- [ ] Update rendering code to use `mapTileData.metatileId`

### Phase 3: Player State ✓
- [ ] Add `currentElevation` and `previousElevation` to PlayerController
- [ ] Add `getElevation()` public getter
- [ ] Implement `updateElevation()` private method
- [ ] Call `updateElevation()` when player changes tiles
- [ ] Initialize elevation in `spawn()` method

### Phase 4: Collision System ✓
- [ ] Implement `isElevationMismatchAt()` method
- [ ] Add elevation check to `isCollisionAt()` method
- [ ] Add `CollisionType` enum (optional)
- [ ] Test elevation mismatch collision

### Phase 5: Warp System ✓
- [ ] Add `elevation` field to `WarpEvent` interface
- [ ] Update warp event parsing
- [ ] Add elevation check in `detectWarpTrigger()`
- [ ] Test warps with elevation requirements

### Phase 6: Debug Tools ✓
- [ ] Add elevation to `describeTile()` output
- [ ] Add elevation to player debug display
- [ ] Create elevation visualization overlay (optional)
- [ ] Add keyboard toggle for overlays

### Phase 7: Testing ✓
- [ ] Write unit tests for elevation parsing
- [ ] Write unit tests for elevation collision
- [ ] Test Victory Road bridge scenario
- [ ] Test Route 110 bridge scenario
- [ ] Test warp elevation requirements
- [ ] Create test map with known elevations

### Phase 8: Advanced Features (Future)
- [ ] Elevation-based sprite priority
- [ ] Fortree Bridge animation
- [ ] Elevation transition handling

---

## Common Pitfalls and Solutions

### Pitfall 1: Forgetting to Update Elevation on Spawn

**Problem:** Player spawns but elevation is never initialized

**Solution:** Always call `updateElevation()` in `spawn()` method

### Pitfall 2: Using currentElevation Instead of previousElevation

**Problem:** Collision checks use the wrong elevation value

**Solution:** Use `previousElevation` for collision, matching GBA behavior
- Reference: `public/pokeemerald/src/field_player_avatar.c:1188` returns `previousElevation`

### Pitfall 3: Not Handling Border Tiles

**Problem:** Border tiles don't have elevation data

**Solution:** Default border tiles to elevation 0

```typescript
function resolveTileAt(/* ... */): ResolvedTile | null {
  // ... map tile handling ...
  
  // Border tile handling
  const borderMetatileId = /* ... */;
  return {
    // ...
    mapTile: {
      metatileId: borderMetatileId,
      collision: 0,
      elevation: 0,  // Border tiles are always ground level
    },
    // ...
  };
}
```

### Pitfall 4: Elevation Mismatch on Map Transitions

**Problem:** Player enters new map at wrong elevation

**Solution:** Store destination elevation in warp event, apply on map load

### Pitfall 5: Not Testing Edge Cases

**Problem:** Elevation 15 (universal) or elevation 0 edge cases fail

**Solution:** Write specific tests for:
- Elevation 0 → any elevation (should work)
- Any elevation → elevation 0 (should work)
- Any elevation → elevation 15 (should work)
- Elevation 3 → elevation 6 (should block)

---

## Performance Considerations

### Elevation Lookups

The elevation system adds minimal overhead:
- Elevation is already in memory (part of map.bin data)
- One integer comparison per collision check
- No additional file I/O

### Memory Impact

Changing from `number[]` to `MapTileData[]`:
- Before: 2 bytes per tile (just metatile ID)
- After: Still 2 bytes per tile (we store the full 16-bit value and extract on demand)

OR

- After: 6 bytes per tile if we store as an object (metatileId, collision, elevation as separate numbers)

**Recommendation:** Store the raw 16-bit value and use getters:

```typescript
export class MapTileData {
  constructor(private rawValue: number) {}
  
  get metatileId(): number {
    return this.rawValue & 0x03FF;
  }
  
  get collision(): number {
    return (this.rawValue >> 10) & 0x03;
  }
  
  get elevation(): number {
    return (this.rawValue >> 12) & 0x0F;
  }
}
```

This keeps memory usage at 2 bytes per tile while providing clean access.

---

## Debugging Tips

### Enable Verbose Logging

```typescript
private isElevationMismatchAt(tileX: number, tileY: number): boolean {
  const playerElevation = this.previousElevation;
  
  if (DEBUG_ELEVATION) {
    console.log(`Elevation check: player=${playerElevation}, tile=(${tileX},${tileY})`);
  }
  
  // ... rest of function
  
  if (DEBUG_ELEVATION && result) {
    console.log(`ELEVATION MISMATCH: player ${playerElevation} cannot enter tile ${tileElevation}`);
  }
  
  return result;
}
```

### Verify Map Data

Check that map.bin files have elevation data:

```typescript
// In browser console
const mapData = await fetch('/pokeemerald/data/layouts/VictoryRoad_1F/map.bin');
const buffer = await mapData.arrayBuffer();
const view = new DataView(buffer);

// Check first tile
const firstTile = view.getUint16(0, true);
console.log({
  metatileId: firstTile & 0x03FF,
  collision: (firstTile >> 10) & 0x03,
  elevation: (firstTile >> 12) & 0x0F,
});
```

### Visual Debugging

Use the elevation overlay to visually verify:
- Bridge tiles are at elevation 3+
- Ground tiles are at elevation 0
- No unexpected elevation values

---

## References

### GBA Source Files (public/pokeemerald/)

**Core System:**
- `include/global.fieldmap.h` - Data structures and bit masks
- `src/fieldmap.c` - Map data access and elevation resolution
- `src/event_object_movement.c` - Collision and elevation mismatch logic

**Player:**
- `src/field_player_avatar.c` - Player elevation tracking
- `src/field_control_avatar.c` - Player position management

**Rendering:**
- `src/field_camera.c` - Layer type rendering (DrawMetatile)

**Special Cases:**
- `src/field_tasks.c` - Fortree Bridge animation
- `src/bike.c` - Running restrictions on bridges

**Warps:**
- `include/global.fieldmap.h:103` - WarpEvent structure

### Browser Implementation Files

**To Modify:**
- `src/utils/mapLoader.ts` - Map data parsing
- `src/game/PlayerController.ts` - Player movement and collision
- `src/components/MapRenderer.tsx` - Rendering and tile resolution
- `src/types/maps.ts` - Type definitions

**Documentation:**
- `doc/bridge-elevation-system.md` - System investigation and how it works
- `doc/bridge-react-implementation.md` - This file (implementation plan)

---

## Conclusion

This implementation plan provides a complete, step-by-step guide to adding elevation support to the browser-based Pokémon RSE implementation. By following these phases in order, you'll create a robust, scalable system that matches the GBA behavior.

The key insight is that **elevation is per-map-coordinate**, stored in the map.bin file alongside the metatile ID and collision data. By properly extracting and utilizing this elevation data, bridges, platforms, and multi-level environments will work correctly.

Each phase builds on the previous one, with clear testing criteria to verify correctness at each step.







