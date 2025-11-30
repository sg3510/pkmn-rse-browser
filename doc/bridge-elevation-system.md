# Bridge and Elevation System Deep Dive

## Investigation Date
**November 22, 2025**

## Executive Summary

This document provides a comprehensive analysis of how Pokémon Ruby/Sapphire/Emerald determines whether a player is walking **on top of** or **under** a bridge or elevated platform. The investigation reveals that the GBA games use a sophisticated **elevation-based system** stored in the map data, combined with object event tracking and layer type rendering to create multi-level environments.

### Critical Finding

**The browser implementation currently lacks elevation tracking entirely.** The game assumes the player is always at elevation 0 (ground level), which explains why bridges don't work correctly - there's no system to determine if the player should be walking on top of or underneath bridge tiles.

---

## Table of Contents

1. [The Elevation System](#the-elevation-system)
2. [How Bridges Work](#how-bridges-work)
3. [Victory Road Example Analysis](#victory-road-example-analysis)
4. [Stairs and Elevation Changes](#stairs-and-elevation-changes)
5. [Layer Type System](#layer-type-system)
6. [Bridge Behaviors](#bridge-behaviors)
7. [Code Deep Dive](#code-deep-dive)
8. [Implementation Requirements](#implementation-requirements)

---

## The Elevation System

### Data Storage

Every tile in a map stores **three pieces of information** in the map.bin file (16 bits total):

```c
// From public/pokeemerald/include/global.fieldmap.h
#define MAPGRID_METATILE_ID_MASK 0x03FF // Bits 0-9   (metatile ID)
#define MAPGRID_COLLISION_MASK   0x0C00 // Bits 10-11 (collision)
#define MAPGRID_ELEVATION_MASK   0xF000 // Bits 12-15 (elevation)
```

**Elevation values:**
- `0` = Ground level (default, most tiles)
- `1-13` = Various elevated platforms (bridges, upper floors)
- `14` = Special (unused in most maps)
- `15` = "Universal" elevation (matches any object elevation)

### Elevation Resolution

The function `MapGridGetElevationAt(x, y)` extracts the elevation value from map data:

```c
// From public/pokeemerald/src/fieldmap.c:345
u8 MapGridGetElevationAt(int x, int y)
{
    u16 block = GetMapGridBlockAt(x, y);
    
    if (block == MAPGRID_UNDEFINED)
        return 0;
    
    return UNPACK_ELEVATION(block);  // Extracts bits 12-15
}
```

### Object Event Elevation

Every object event (NPCs, player, items) has its own elevation:

```c
// From public/pokeemerald/src/field_player_avatar.c:1188
u8 PlayerGetElevation(void)
{
    return gObjectEvents[gPlayerAvatar.objectEventId].previousElevation;
}
```

**Critical**: The player's elevation is tracked in `previousElevation` (from the tile they're standing on), and this determines collision and rendering priority.

---

## How Bridges Work

### The Core Mechanism

Bridges work through a **three-layer system**:

1. **Map Elevation Data**: Tiles under the bridge have elevation `0`, tiles ON the bridge have elevation `3` (or higher)
2. **Player Elevation Tracking**: The player's `previousElevation` determines their current "layer"
3. **Collision Detection**: Movement is blocked between different elevations

### Elevation Mismatch Collision

```c
// From public/pokeemerald/src/event_object_movement.c:7707
static bool8 IsElevationMismatchAt(u8 elevation, s16 x, s16 y)
{
    u8 mapElevation;
    
    if (elevation == 0)
        return FALSE;  // Ground level can go anywhere
    
    mapElevation = MapGridGetElevationAt(x, y);
    
    if (mapElevation == 0 || mapElevation == 15)
        return FALSE;  // Can always move to ground or universal elevation
    
    if (mapElevation != elevation)
        return TRUE;   // COLLISION! Different elevations can't interact
    
    return FALSE;
}
```

**Key Logic:**
- If player is at elevation `0`, they can walk anywhere not blocked by collision
- If player is at elevation `3` (on bridge), they can ONLY walk on other elevation `3` tiles
- Elevation `15` is universal and matches any object elevation
- Elevation `0` is universal for tiles (ground level)

### Elevation Compatibility for Object Events

```c
// From public/pokeemerald/src/event_object_movement.c:7791
static bool8 AreElevationsCompatible(u8 a, u8 b)
{
    if (a == 0 || b == 0)
        return TRUE;  // Ground elevation is compatible with everything
    
    if (a != b)
        return FALSE; // Different non-zero elevations can't interact
    
    return TRUE;
}
```

This prevents NPCs from one elevation layer interacting with objects on another.

---

## Victory Road Example Analysis

### Player Situation

From the user's debug dump:

```json
{
  "player": {
    "tileX": 29,
    "tileY": 18
  },
  "tiles": [
    {
      "tileX": 29,
      "tileY": 17,
      "metatileId": 700,
      "behavior": 8,  // MB_CAVE
      "layerType": 0,  // NORMAL
      "bottomTiles": [515, 516, 531, 532],
      "topTiles": [317, 317, 333, 333]
    },
    {
      "tileX": 29,
      "tileY": 18,
      "metatileId": 708,
      "behavior": 8,
      "layerType": 0,
      "bottomTiles": [515, 516, 531, 532],
      "topTiles": [333, 333, 318, 318]
    }
  ]
}
```

### What's Happening

**Metatile 700 and 708** are bridge tiles that:
- Have `behavior: 8` (MB_CAVE - just means "walkable cave floor")
- Have `layerType: NORMAL` (bottom layer in BG2, top layer in BG1)
- Have **topTiles** (317, 333, 318) that render the bridge surface

### The Missing Piece: Elevation Data

The debug dump shows **layerType** but NOT **elevation**. This is the critical missing data!

In the actual map.bin file, these tiles would have:
- Tiles at (29, 17), (29, 18), (30, 17), (30, 18): **elevation = 3** (on bridge)
- Tiles at (29, 19), (30, 19): **elevation = 0** (under bridge)
- Tiles at (28, 17), (28, 18): **elevation = 0** (under bridge)

### Why the Player Appears "Below"

From the user's observation: "I appear below the bridge yet can walk to the left"

This happens because:
1. The browser has no elevation system
2. Layer type NORMAL puts the bridge's top layer in BG1 (above player)
3. Visual rendering makes it look like player is "under" the bridge
4. But collision doesn't respect elevation, so player can walk through bridge edges

---

## Stairs and Elevation Changes

### How Stairs Work

**Question:** Does tile 516 (a stair tile in bottomTiles) change elevation?

**Answer:** No! Individual tiles **never** change elevation. The map data does.

### Elevation Transition Tiles

Stairs are simply:
1. **Visually**: Tiles that look like stairs (tile IDs like 515, 516, 531, 532)
2. **Functionally**: Map tiles with **transitional elevation values** or **warps**

### Two Methods for Level Changes

#### Method 1: Warp Events

Most stairs in buildings use **warp events**:

```c
// From public/pokeemerald/include/global.fieldmap.h:103
struct WarpEvent
{
    s16 x, y;
    u8 elevation;  // <- Warp has elevation requirement
    u8 warpId;
    u8 mapNum;
    u8 mapGroup;
};
```

When player steps on a warp:
- If `playerElevation == warpEvent.elevation`, trigger warp
- Warp takes player to different map (or location) with different base elevation

#### Method 2: Gradual Elevation in Map Data

For outdoor slopes (like Jagged Pass or Mt. Pyre exterior):
- Map tiles gradually change elevation values
- Player at elevation `3` can step to elevation `4` tiles seamlessly
- This creates the illusion of walking uphill

**Example from Mt. Pyre:**

```
Row 10: elevation = 3, 3, 3, 3, 3
Row 11: elevation = 3, 4, 4, 4, 3  <- Stairs start
Row 12: elevation = 3, 4, 5, 4, 3
Row 13: elevation = 3, 4, 4, 4, 3
Row 14: elevation = 4, 4, 4, 4, 4  <- Now fully at elevation 4
```

But in practice, most RSE stairs use **method 1** (warps).

---

## Layer Type System

### Three Layer Types

From `public/pokeemerald/include/global.fieldmap.h:40`:

```c
enum {
    METATILE_LAYER_TYPE_NORMAL,  // 0
    METATILE_LAYER_TYPE_COVERED, // 1  
    METATILE_LAYER_TYPE_SPLIT,   // 2
};
```

### GBA Hardware Layers

The GBA has 4 background layers: BG0, BG1, BG2, BG3

In field maps:
- **BG3** (lowest priority) = bottom layer
- **BG2** (middle) = middle layer
- **BG1** (highest priority) = top layer
- **Sprites** (objects/player) render between layers based on priority

### Layer Type Rendering

From `public/pokeemerald/src/field_camera.c:245`:

#### METATILE_LAYER_TYPE_NORMAL (0)

```c
// BG3: Garbage (0x3014) - not used
gOverworldTilemapBuffer_Bg3[offset] = 0x3014;

// BG2: Bottom 4 tiles of metatile (player walks ON this)
gOverworldTilemapBuffer_Bg2[offset] = tiles[0];
gOverworldTilemapBuffer_Bg2[offset + 1] = tiles[1];
gOverworldTilemapBuffer_Bg2[offset + 0x20] = tiles[2];
gOverworldTilemapBuffer_Bg2[offset + 0x21] = tiles[3];

// BG1: Top 4 tiles of metatile (renders ABOVE player)
gOverworldTilemapBuffer_Bg1[offset] = tiles[4];
gOverworldTilemapBuffer_Bg1[offset + 1] = tiles[5];
gOverworldTilemapBuffer_Bg1[offset + 0x20] = tiles[6];
gOverworldTilemapBuffer_Bg1[offset + 0x21] = tiles[7];
```

**Usage:** Standard ground tiles, bridges viewed from below

#### METATILE_LAYER_TYPE_COVERED (1)

```c
// BG3: Bottom 4 tiles (background layer)
gOverworldTilemapBuffer_Bg3[offset] = tiles[0];

// BG2: Top 4 tiles (rendered here, above player)
gOverworldTilemapBuffer_Bg2[offset] = tiles[4];

// BG1: Transparent (0)
gOverworldTilemapBuffer_Bg1[offset] = 0;
```

**Usage:** Tiles where player walks under something (like a roof edge)

#### METATILE_LAYER_TYPE_SPLIT (2)

```c
// BG3: Bottom 4 tiles (background)
gOverworldTilemapBuffer_Bg3[offset] = tiles[0];

// BG2: Transparent (allows BG3 to show through)
gOverworldTilemapBuffer_Bg2[offset] = 0;

// BG1: Top 4 tiles (foreground)
gOverworldTilemapBuffer_Bg1[offset] = tiles[4];
```

**Usage:** Animations like flowers, water - bottom layer shows through, top layer above player

### Bridge Layer Type

Bridges typically use **LAYER_TYPE_NORMAL**:
- Bottom tiles: the underside or ground
- Top tiles: the bridge surface

But elevation determines if player walks on bottom (elevation 0) or top (elevation 3+).

---

## Bridge Behaviors

### Behavior 0x08 (MB_CAVE)

From the dump, bridge tiles have `behavior: 8`.

```c
// From public/pokeemerald/include/constants/metatile_behaviors.h:8
#define MB_CAVE 8
```

This is **NOT a bridge-specific behavior!** It just means "walkable cave floor with encounter rate".

From `public/pokeemerald/src/metatile_behavior.c:17`:
```c
[MB_CAVE] = TILE_FLAG_UNUSED | TILE_FLAG_HAS_ENCOUNTERS,
```

### Actual Bridge Behaviors

The game has **separate behaviors** for bridges over water:

```c
// From metatile_behaviors.h:117-125
MB_BRIDGE_OVER_OCEAN = 112,        // 0x70
MB_BRIDGE_OVER_POND_LOW = 113,     // 0x71
MB_BRIDGE_OVER_POND_MED = 114,     // 0x72
MB_BRIDGE_OVER_POND_HIGH = 115,    // 0x73
MB_FORTREE_BRIDGE = 121,           // 0x79 - Special animated bridge
MB_BRIDGE_OVER_POND_MED_EDGE_1 = 122,   // 0x7A
MB_BRIDGE_OVER_POND_MED_EDGE_2 = 123,   // 0x7B
MB_BRIDGE_OVER_POND_HIGH_EDGE_1 = 124,  // 0x7C
MB_BRIDGE_OVER_POND_HIGH_EDGE_2 = 125,  // 0x7D
MB_BIKE_BRIDGE_OVER_BARRIER = 127, // 0x7F
```

### Purpose of Bridge Behaviors

From `public/pokeemerald/src/metatile_behavior.c:773`:

```c
// For the sections of log bridges that span water / water's edge.
// Note that the rest of the metatiles for these bridges use MB_NORMAL.
// This is used to allow encounters on the water below the bridge.
bool8 MetatileBehavior_IsBridgeOverWater(u8 metatileBehavior)
{
    if ((metatileBehavior == MB_BRIDGE_OVER_OCEAN
      || metatileBehavior == MB_BRIDGE_OVER_POND_LOW
      || metatileBehavior == MB_BRIDGE_OVER_POND_MED
      || metatileBehavior == MB_BRIDGE_OVER_POND_HIGH)
      || (metatileBehavior == MB_BRIDGE_OVER_POND_HIGH_EDGE_1
       || metatileBehavior == MB_BRIDGE_OVER_POND_HIGH_EDGE_2
       || metatileBehavior == MB_UNUSED_BRIDGE
       || metatileBehavior == MB_BIKE_BRIDGE_OVER_BARRIER))
        return TRUE;
    else
        return FALSE;
}
```

**Key point:** Bridge behaviors are used for **battle environment determination** and **encounter rate**:

```c
// From public/pokeemerald/src/battle_setup.c:679
if (TestPlayerAvatarFlags(PLAYER_AVATAR_FLAG_SURFING))
{
    // Is BRIDGE_TYPE_POND_*?
    if (MetatileBehavior_GetBridgeType(tileBehavior) != BRIDGE_TYPE_OCEAN)
        return BATTLE_ENVIRONMENT_POND;
    
    if (MetatileBehavior_IsBridgeOverWater(tileBehavior) == TRUE)
        return BATTLE_ENVIRONMENT_WATER;
}
```

When surfing under a bridge, encounters use water-type environment!

### Victory Road "Bridge"

The Victory Road tiles (700, 708) with behavior `8` are NOT traditional bridges. They are:
- **Platform edges** that create multi-level cave paths
- Using **elevation data** to prevent walking between levels
- The "bridge" appearance comes from elevation + layer rendering

If these had elevation values like:
```
Tile (29, 17): elevation = 3
Tile (29, 18): elevation = 3
Tile (29, 19): elevation = 0
```

Then a player at elevation 0 would collide trying to move north, and a player at elevation 3 would collide trying to move south.

---

## Code Deep Dive

### Collision Check Flow

When player tries to move to tile (x, y):

```c
// 1. Get collision at coordinates
// From public/pokeemerald/src/event_object_movement.c:4658
u8 GetCollisionAtCoords(struct ObjectEvent *objectEvent, s16 x, s16 y, u32 dir)
{
    u8 direction = dir;
    
    // Check basic collision bit
    if (IsCoordOutsideObjectEventMovementRange(objectEvent, x, y))
        return COLLISION_OUTSIDE_RANGE;
    else if (MapGridGetCollisionAt(x, y) || GetMapBorderIdAt(x, y) == CONNECTION_INVALID 
             || IsMetatileDirectionallyImpassable(objectEvent, x, y, direction))
        return COLLISION_IMPASSABLE;
    else if (objectEvent->trackedByCamera && !CanCameraMoveInDirection(direction))
        return COLLISION_IMPASSABLE;
        
    // *** ELEVATION CHECK ***
    else if (IsElevationMismatchAt(objectEvent->currentElevation, x, y))
        return COLLISION_ELEVATION_MISMATCH;
        
    else if (DoesObjectCollideWithObjectAt(objectEvent, x, y))
        return COLLISION_OBJECT_EVENT;
        
    return COLLISION_NONE;
}
```

### Elevation Mismatch Details

```c
// From public/pokeemerald/src/event_object_movement.c:7707
static bool8 IsElevationMismatchAt(u8 elevation, s16 x, s16 y)
{
    u8 mapElevation;
    
    // Ground level (0) can go anywhere
    if (elevation == 0)
        return FALSE;
    
    mapElevation = MapGridGetElevationAt(x, y);
    
    // Tiles with elevation 0 or 15 are accessible from any elevation
    if (mapElevation == 0 || mapElevation == 15)
        return FALSE;
    
    // Different non-zero elevations = mismatch = COLLISION
    if (mapElevation != elevation)
        return TRUE;
    
    return FALSE;
}
```

### Elevation Priority System

```c
// From public/pokeemerald/src/event_object_movement.c:7729
static const u8 sElevationToPriority[] = {
    2, 2, 2, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 2
    // ^        ^     ^     ^     ^     ^
    // 0        4     6     8     10    12
};
```

- Elevations 0,1,2,3,5,7,9,11,13,15: **Priority 2** (normal)
- Elevations 4,6,8,10,12: **Priority 1** (rendered above other sprites)
- Elevations 14: **Priority 0** (highest)

This controls sprite rendering order. Player at elevation 4 renders above NPCs at elevation 3.

### Fortree Bridge Special Case

Fortree City has animated bridges:

```c
// From public/pokeemerald/src/field_tasks.c:490
static void FortreeBridgePerStepCallback(u8 taskId)
{
    // ...
    
    // Make sure player isn't below bridge
    elevation = PlayerGetElevation();
    onBridgeElevation = FALSE;
    if ((u8)(elevation & 1) == 0)  // Even elevation = on bridge
        onBridgeElevation = TRUE;
    
    if (onBridgeElevation && (isFortreeBridgeCur || isFortreeBridgePrev))
        PlaySE(SE_BRIDGE_WALK);  // Play wood plank sound
}
```

The bridge actually **changes metatiles** when stepped on (lowers the planks visually).

### Running Restriction on Bridges

```c
// From public/pokeemerald/src/bike.c:901
static bool8 IsRunningDisallowedByMetatile(u8 tile)
{
    if (MetatileBehavior_IsRunningDisallowed(tile))
        return TRUE;
        
    // Can't run on Fortree Bridge if on TOP (even elevation)
    if (MetatileBehavior_IsFortreeBridge(tile) && (PlayerGetElevation() & 1) == 0)
        return TRUE;
        
    return FALSE;
}
```

---

## Implementation Requirements

### Current State: Browser Implementation

**Missing features:**
1. ❌ No elevation tracking for player
2. ❌ No elevation data extracted from map.bin
3. ❌ No elevation mismatch collision detection
4. ❌ No elevation-based sprite priority
5. ✅ Layer type rendering (NORMAL/COVERED/SPLIT) **is implemented**

### Required Changes

#### 1. Extract Elevation from Map Data

In `mapLoader.ts`, when parsing map.bin:

```typescript
export interface MapTileData {
  metatileId: number;
  collision: number;
  elevation: number;  // ADD THIS
}

function parseMapTile(value: number): MapTileData {
  return {
    metatileId: value & 0x03FF,          // Bits 0-9
    collision: (value >> 10) & 0x03,     // Bits 10-11
    elevation: (value >> 12) & 0x0F,     // Bits 12-15
  };
}
```

#### 2. Add Elevation to Player State

In `PlayerController.ts`:

```typescript
export class PlayerController {
  private currentElevation: number = 0;
  private previousElevation: number = 0;
  
  private updateElevation(): void {
    const resolved = this.tileResolver?.(this.tileX, this.tileY);
    if (resolved) {
      this.previousElevation = this.currentElevation;
      this.currentElevation = resolved.elevation ?? 0;
    }
  }
}
```

#### 3. Elevation Mismatch Collision

```typescript
private isElevationMismatchAt(tileX: number, tileY: number): boolean {
  const playerElev = this.currentElevation;
  
  // Ground level (0) can go anywhere
  if (playerElev === 0) return false;
  
  const resolved = this.tileResolver?.(tileX, tileY);
  if (!resolved) return true;
  
  const tileElev = resolved.elevation ?? 0;
  
  // Tiles with elevation 0 or 15 are accessible from any elevation
  if (tileElev === 0 || tileElev === 15) return false;
  
  // Different non-zero elevations = collision
  return tileElev !== playerElev;
}

private isCollisionAt(tileX: number, tileY: number): boolean {
  // ... existing checks ...
  
  // Add elevation check
  if (this.isElevationMismatchAt(tileX, tileY)) {
    return true;
  }
  
  // ... rest of collision checks ...
}
```

#### 4. Warp Elevation Checking

In warp detection:

```typescript
function detectWarpTrigger(ctx: RenderContext, player: PlayerController): WarpTrigger | null {
  const warpEvent = findWarpEventAt(map, player.tileX, player.tileY);
  
  if (warpEvent) {
    // Check elevation requirement
    if (warpEvent.elevation !== undefined 
        && warpEvent.elevation !== player.currentElevation) {
      return null;  // Wrong elevation, warp not triggered
    }
    
    return {
      kind: 'warp',
      event: warpEvent,
      // ...
    };
  }
}
```

#### 5. Debug Display

Add elevation to tile debug info:

```typescript
function describeTile(ctx: RenderContext, tileX: number, tileY: number): DebugTileInfo {
  const resolved = resolveTileAt(ctx, tileX, tileY);
  
  return {
    metatileId: resolved.metatile.id,
    elevation: resolved.elevation,  // ADD THIS
    behavior: resolved.attributes.behavior,
    layerType: resolved.attributes.layerType,
    // ...
  };
}
```

---

## Testing Scenarios

### Test Case 1: Victory Road Bridge

**Setup:**
- Load Victory Road 1F
- Position player at (29, 19) with elevation 0

**Expected behavior:**
- Player can walk left/right at elevation 0
- Player CANNOT walk north onto tiles at elevation 3
- Collision message: "COLLISION_ELEVATION_MISMATCH"

**Then:**
- Warp player to (29, 17) with elevation 3

**Expected behavior:**
- Player can walk on bridge tiles (elevation 3)
- Player CANNOT walk south to elevation 0 tiles
- Player renders ABOVE the ground-level floor

### Test Case 2: Route 119 Bridge

**Setup:**
- Load Route 119 (log bridge over water)
- Player at elevation 0 under bridge

**Expected behavior:**
- Player can walk under bridge at elevation 0
- Bridge tiles have behavior MB_BRIDGE_OVER_OCEAN
- Water encounters possible while under bridge

**Then:**
- Move player to bridge entrance (elevation changes to 3)

**Expected behavior:**
- Player now walks ON bridge at elevation 3
- Cannot walk off bridge sides (elevation mismatch)
- Bridge plank sound plays (for Fortree-style bridges)

### Test Case 3: Stairs

**Setup:**
- Any building with stairs (e.g., Pokemon Center)

**Expected behavior:**
- Stairs have warp event with elevation requirement
- Player must be at correct elevation to trigger warp
- Warp changes player elevation for next map

---

## Metatile Investigation

### Metatile 700 (Cave Bridge)

```
bottomTiles: [515, 516, 531, 532]
topTiles: [317, 317, 333, 333]
behavior: 8 (MB_CAVE)
layerType: 0 (NORMAL)
```

**Rendering:**
- BG2: Tiles 515, 516, 531, 532 (dark floor)
- BG1: Tiles 317, 333 (bridge platform edge)

### Metatile 708 (Cave Bridge)

```
bottomTiles: [515, 516, 531, 532]
topTiles: [333, 333, 318, 318]
behavior: 8 (MB_CAVE)
layerType: 0 (NORMAL)
```

**Rendering:**
- BG2: Same dark floor
- BG1: Tiles 333, 318 (different bridge platform section)

### Tile 516 Analysis

**Question:** "Does tile 516 change elevation?"

**Answer:** No. Tile 516 is a graphical tile (part of the tileset pixel data). Elevation is stored **per map tile**, not per graphical tile.

Metatile 700 uses tile 516 in its bottom layer. That metatile, when placed on the map at coordinate (X, Y), gets elevation data from the map.bin entry for that coordinate.

```
Coordinate (29, 17):
  map.bin value = 0xF2BC (hypothetical)
  metatileId = 0x2BC = 700
  collision = 0 (passable)
  elevation = 0xF = 15 (universal)
```

---

## Summary

### How Bridges Really Work

1. **Map Data**: Each tile has elevation (0-15) stored in bits 12-15 of map.bin
2. **Player Tracking**: Player object has `currentElevation` updated when stepping
3. **Collision**: `IsElevationMismatchAt()` prevents movement between different non-zero elevations
4. **Rendering**: Layer type controls which BG layers show tiles, but elevation controls sprite priority
5. **Behaviors**: Bridge-specific behaviors (112-127) mainly affect encounters/battle environment, NOT collision

### Why Browser Doesn't Work

- **No elevation extraction**: Map elevation is not read from map.bin
- **No player elevation**: Player always at implicit elevation 0
- **No elevation collision**: Can walk through elevation boundaries
- **Visual only**: Layer types render correctly, but functionality is missing

### Implementation Priority

1. **HIGH**: Extract elevation from map.bin
2. **HIGH**: Track player elevation in PlayerController
3. **HIGH**: Implement IsElevationMismatchAt() in collision check
4. **MEDIUM**: Add elevation requirement to warp events
5. **LOW**: Sprite priority based on elevation
6. **LOW**: Special Fortree Bridge animation handling

---

## References

### Source Files Examined

- `public/pokeemerald/include/global.fieldmap.h` - Data structures
- `public/pokeemerald/include/constants/metatile_behaviors.h` - Behavior constants
- `public/pokeemerald/src/fieldmap.c` - Elevation resolution
- `public/pokeemerald/src/event_object_movement.c` - Collision and elevation mismatch
- `public/pokeemerald/src/field_player_avatar.c` - Player elevation tracking
- `public/pokeemerald/src/metatile_behavior.c` - Bridge behavior checks
- `public/pokeemerald/src/field_camera.c` - Layer type rendering
- `public/pokeemerald/src/field_tasks.c` - Fortree Bridge special handling
- `public/pokeemerald/src/bike.c` - Running restrictions

### Browser Files

- `src/utils/mapLoader.ts` - Map data parsing
- `src/game/PlayerController.ts` - Player movement and collision
- `src/components/MapRenderer.tsx` - Rendering and layer logic

---

**End of Investigation**





