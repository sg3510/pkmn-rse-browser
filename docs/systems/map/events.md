---
title: Map Events System
status: reference
last_verified: 2026-01-13
---

# Map Events System

This document describes the Pokemon Emerald map events system and proposes a modular React implementation.

## Overview

Map events are interactive elements that trigger when the player reaches specific coordinates or interacts with objects. The system includes:

- **Object Events** - NPCs, trainers, item balls, berry trees
- **Warp Events** - Doors, cave entrances, teleport tiles
- **Coord Events** - Position-triggered scripts (weather changes, cutscenes)
- **BG Events** - Signs, hidden items, secret bases

## Source Code Reference

### Key Files in `public/pokeemerald/`
- `include/global.fieldmap.h` - Event data structures
- `include/constants/map_scripts.h` - Script trigger types
- `data/maps/*/map.json` - Per-map event definitions
- `data/maps/*/scripts.inc` - Map-specific scripts
- `src/overworld.c` - Event execution logic
- `src/script.c` - Script interpreter

## Data Structures

### MapHeader
```c
struct MapHeader {
    const struct MapLayout *mapLayout;
    const struct MapEvents *events;        // All event data
    const u8 *mapScripts;                  // Script triggers
    const struct MapConnections *connections;
    u16 music;
    u16 mapLayoutId;
    u8 regionMapSectionId;
    u8 cave;
    u8 weather;                            // Default weather
    u8 mapType;
    bool8 allowCycling:1;
    bool8 allowEscaping:1;
    bool8 allowRunning:1;
    bool8 showMapName:5;
    u8 battleType;
};
```

### MapEvents Container
```c
struct MapEvents {
    u8 objectEventCount;
    u8 warpCount;
    u8 coordEventCount;
    u8 bgEventCount;
    const struct ObjectEventTemplate *objectEvents;
    const struct WarpEvent *warps;
    const struct CoordEvent *coordEvents;
    const struct BgEvent *bgEvents;
};
```

## Object Events

NPCs, trainers, items, and other interactive objects.

### ObjectEventTemplate Structure
```c
struct ObjectEventTemplate {
    u8 localId;           // Unique ID within map
    u8 graphicsId;        // Sprite to use (OBJ_EVENT_GFX_*)
    u8 kind;              // Always OBJ_KIND_NORMAL
    s16 x, y;             // Position (tile coordinates)
    u8 elevation;         // Z-level (0-15)
    u8 movementType;      // MOVEMENT_TYPE_* constant
    u16 movementRangeX:4; // Wander range X
    u16 movementRangeY:4; // Wander range Y
    u16 trainerType;      // TRAINER_TYPE_* for trainers
    u16 trainerRange_berryTreeId;  // Sight range or berry ID
    const u8 *script;     // Script to run on interaction
    u16 flagId;           // Flag controlling visibility
};
```

### Object Event Types

#### Item Balls
```json
{
  "graphics_id": "OBJ_EVENT_GFX_ITEM_BALL",
  "x": 53, "y": 7,
  "elevation": 3,
  "movement_type": "MOVEMENT_TYPE_LOOK_AROUND",
  "script": "Route113_EventScript_ItemMaxEther",
  "flag": "FLAG_ITEM_ROUTE_113_MAX_ETHER"
}
```

#### Trainers
```json
{
  "graphics_id": "OBJ_EVENT_GFX_YOUNGSTER",
  "x": 62, "y": 8,
  "elevation": 3,
  "movement_type": "MOVEMENT_TYPE_FACE_DOWN",
  "trainer_type": "TRAINER_TYPE_NORMAL",
  "trainer_sight_or_berry_tree_id": "3",
  "script": "Route113_EventScript_Jaylen",
  "flag": "0"
}
```

#### Buried NPCs (Ninja Boys)
```json
{
  "graphics_id": "OBJ_EVENT_GFX_NINJA_BOY",
  "x": 29, "y": 6,
  "elevation": 3,
  "movement_type": "MOVEMENT_TYPE_BURIED",
  "trainer_type": "TRAINER_TYPE_BURIED",
  "trainer_sight_or_berry_tree_id": "1",
  "script": "Route113_EventScript_Lao"
}
```

### Movement Types

From `constants/event_object_movement.h`:

| Type | Description |
|------|-------------|
| `MOVEMENT_TYPE_NONE` | Stationary |
| `MOVEMENT_TYPE_LOOK_AROUND` | Randomly changes facing |
| `MOVEMENT_TYPE_FACE_UP/DOWN/LEFT/RIGHT` | Fixed facing |
| `MOVEMENT_TYPE_WANDER_AROUND` | Random movement |
| `MOVEMENT_TYPE_WANDER_UP_AND_DOWN` | Vertical pacing |
| `MOVEMENT_TYPE_WANDER_LEFT_AND_RIGHT` | Horizontal pacing |
| `MOVEMENT_TYPE_WALK_UP_AND_DOWN` | Continuous pacing |
| `MOVEMENT_TYPE_WALK_LEFT_AND_RIGHT` | Continuous pacing |
| `MOVEMENT_TYPE_ROTATE_CLOCKWISE` | Spins clockwise |
| `MOVEMENT_TYPE_ROTATE_COUNTERCLOCKWISE` | Spins counter-clockwise |
| `MOVEMENT_TYPE_BURIED` | Hidden until triggered |

### Trainer Types

| Type | Description |
|------|-------------|
| `TRAINER_TYPE_NONE` | Not a trainer (NPC) |
| `TRAINER_TYPE_NORMAL` | Standard trainer |
| `TRAINER_TYPE_BURIED` | Hidden trainer (Ninja Boy) |
| `TRAINER_TYPE_SEE_ALL_DIRECTIONS` | Can spot in any direction |

## Warp Events

Teleport points connecting maps.

### WarpEvent Structure
```c
struct WarpEvent {
    s16 x, y;           // Position
    u8 elevation;       // Z-level (0 = any)
    u8 warpId;          // Destination warp index
    u8 mapNum;          // Destination map number
    u8 mapGroup;        // Destination map group
};
```

### Example
```json
{
  "x": 33, "y": 5,
  "elevation": 0,
  "dest_map": "MAP_ROUTE113_GLASS_WORKSHOP",
  "dest_warp_id": "0"
}
```

### Warp Types (Visual)

1. **Door Warps** - Building entrances with door animation
2. **Cave Warps** - Cave mouths
3. **Stair Warps** - Internal stairways
4. **Teleport Pads** - Instant teleport tiles

## Coord Events

Events triggered by player position.

### CoordEvent Structure
```c
struct CoordEvent {
    s16 x, y;            // Trigger position
    u8 elevation;        // Z-level requirement
    u16 trigger;         // Trigger condition type
    u16 index;           // Sub-index for condition
    const u8 *script;    // Script to execute
};
```

### Weather Coord Events
```json
{
  "type": "weather",
  "x": 19, "y": 11,
  "elevation": 3,
  "weather": "COORD_EVENT_WEATHER_VOLCANIC_ASH"
}
```

### Script Coord Events
```json
{
  "type": "trigger",
  "x": 10, "y": 5,
  "elevation": 0,
  "var": "VAR_TEMP_1",
  "var_value": "0",
  "script": "Route101_EventScript_BlockedByZigzagoon"
}
```

## BG Events

Background interaction events (signs, hidden items, secret bases).

### BgEvent Structure
```c
struct BgEvent {
    u16 x, y;
    u8 elevation;
    u8 kind;              // BG_EVENT_* type
    union {
        const u8 *script;                // For signs/NPCs
        struct {
            u16 item;
            u16 hiddenItemId;
        } hiddenItem;
        u32 secretBaseId;
    } bgUnion;
};
```

### BG Event Types

#### Signs
```json
{
  "type": "sign",
  "x": 85, "y": 6,
  "elevation": 0,
  "player_facing_dir": "BG_EVENT_PLAYER_FACING_ANY",
  "script": "Route113_EventScript_RouteSign111"
}
```

#### Hidden Items
```json
{
  "type": "hidden_item",
  "x": 66, "y": 3,
  "elevation": 3,
  "item": "ITEM_ETHER",
  "flag": "FLAG_HIDDEN_ITEM_ROUTE_113_ETHER"
}
```

#### Secret Bases
```json
{
  "type": "secret_base",
  "x": 49, "y": 8,
  "elevation": 3,
  "secret_base_id": "SECRET_BASE_RED_CAVE1_3"
}
```

## Map Scripts

Scripts that run at specific map lifecycle points.

### Script Trigger Types

From `constants/map_scripts.h`:

| Type | Constant | When |
|------|----------|------|
| 1 | `MAP_SCRIPT_ON_LOAD` | After layout loaded, before draw |
| 2 | `MAP_SCRIPT_ON_TRANSITION` | During map transition |
| 3 | `MAP_SCRIPT_ON_RESUME` | End of load/return from menu |
| 4 | `MAP_SCRIPT_ON_WARP_INTO_MAP_TABLE` | After objects loaded |
| 5 | `MAP_SCRIPT_ON_FRAME_TABLE` | Every frame after fade-in |
| 6 | `MAP_SCRIPT_ON_DIVE_WARP` | On dive/emerge |
| 7 | `MAP_SCRIPT_ON_RETURN_TO_FIELD` | On field reload |

### Script Format (Assembly)

```asm
Route113_MapScripts::
    map_script MAP_SCRIPT_ON_LOAD, Route113_OnLoad
    map_script MAP_SCRIPT_ON_TRANSITION, Route113_OnTransition
    .byte 0

Route113_OnTransition:
    setweather WEATHER_VOLCANIC_ASH
    call_if_set FLAG_SYS_WEATHER_CTRL, Common_EventScript_SetAbnormalWeather
    end
```

## Flag System

Flags control object visibility and event state.

### Flag Types

| Prefix | Description |
|--------|-------------|
| `FLAG_ITEM_*` | Item collection flags |
| `FLAG_HIDDEN_ITEM_*` | Hidden item collection flags |
| `FLAG_TRAINER_*` | Trainer defeat flags |
| `FLAG_RECEIVED_*` | Gift received flags |
| `FLAG_SYS_*` | System state flags |
| `FLAG_BADGE*` | Gym badge flags |

### Flag Usage

- **Object Visibility**: Objects with flagId != 0 only appear if flag is NOT set
- **Script Conditions**: `call_if_set FLAG_NAME, script` runs script if flag set
- **Item Collection**: Setting flag hides item ball permanently

## Proposed React Implementation

### Architecture

```
src/
├── events/
│   ├── EventManager.ts          # Main event coordinator
│   ├── ObjectEventManager.ts    # NPCs, items, trainers
│   ├── WarpEventManager.ts      # Warps and doors
│   ├── CoordEventManager.ts     # Position triggers
│   ├── BgEventManager.ts        # Signs, hidden items
│   ├── FlagManager.ts           # Flag state storage
│   └── types.ts                 # Event interfaces
```

### EventManager Interface

```typescript
interface MapEventData {
  objectEvents: ObjectEvent[];
  warpEvents: WarpEvent[];
  coordEvents: CoordEvent[];
  bgEvents: BgEvent[];
}

class EventManager {
  private flagManager: FlagManager;
  private objectManager: ObjectEventManager;
  private warpManager: WarpEventManager;
  private coordManager: CoordEventManager;
  private bgManager: BgEventManager;

  // Load events for current map
  loadMapEvents(mapId: string): Promise<void>;

  // Called each frame with player position
  update(playerX: number, playerY: number, elevation: number): void;

  // Check for interaction at player position
  checkInteraction(
    facing: Direction,
    playerX: number,
    playerY: number
  ): InteractionResult | null;

  // Get visible objects for rendering
  getVisibleObjects(): RenderableObject[];
}
```

### FlagManager

```typescript
class FlagManager {
  private flags: Set<string> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  isSet(flag: string): boolean {
    return this.flags.has(flag);
  }

  set(flag: string): void {
    this.flags.add(flag);
    this.saveToStorage();
  }

  clear(flag: string): void {
    this.flags.delete(flag);
    this.saveToStorage();
  }

  // Check if object should be visible
  isObjectVisible(flagId: string): boolean {
    if (flagId === '0' || flagId === '') return true;
    return !this.isSet(flagId);  // Visible if flag NOT set
  }

  private loadFromStorage(): void {
    const saved = localStorage.getItem('gameFlags');
    if (saved) {
      this.flags = new Set(JSON.parse(saved));
    }
  }

  private saveToStorage(): void {
    localStorage.setItem('gameFlags', JSON.stringify([...this.flags]));
  }
}
```

### ObjectEventManager

```typescript
interface ObjectEvent {
  localId: number;
  graphicsId: string;
  x: number;
  y: number;
  elevation: number;
  movementType: string;
  movementRangeX: number;
  movementRangeY: number;
  trainerType: string;
  trainerSightRange: number;
  script: string;
  flag: string;
}

class ObjectEventManager {
  private objects: Map<number, ObjectEvent> = new Map();
  private positions: Map<number, { x: number; y: number; facing: Direction }>;

  loadObjects(events: ObjectEvent[], flagManager: FlagManager): void {
    this.objects.clear();
    this.positions.clear();

    for (const event of events) {
      if (flagManager.isObjectVisible(event.flag)) {
        this.objects.set(event.localId, event);
        this.positions.set(event.localId, {
          x: event.x,
          y: event.y,
          facing: this.getInitialFacing(event.movementType)
        });
      }
    }
  }

  update(deltaMs: number): void {
    for (const [id, event] of this.objects) {
      this.updateMovement(id, event, deltaMs);
    }
  }

  // Check if trainer sees player
  checkTrainerSight(
    playerX: number,
    playerY: number,
    playerElevation: number
  ): ObjectEvent | null {
    for (const [id, event] of this.objects) {
      if (event.trainerType === 'TRAINER_TYPE_NONE') continue;

      const pos = this.positions.get(id)!;
      if (this.canTrainerSee(event, pos, playerX, playerY)) {
        return event;
      }
    }
    return null;
  }

  private canTrainerSee(
    trainer: ObjectEvent,
    trainerPos: { x: number; y: number; facing: Direction },
    playerX: number,
    playerY: number
  ): boolean {
    const dx = playerX - trainerPos.x;
    const dy = playerY - trainerPos.y;
    const range = trainer.trainerSightRange;

    switch (trainerPos.facing) {
      case 'up':
        return dx === 0 && dy < 0 && dy >= -range;
      case 'down':
        return dx === 0 && dy > 0 && dy <= range;
      case 'left':
        return dy === 0 && dx < 0 && dx >= -range;
      case 'right':
        return dy === 0 && dx > 0 && dx <= range;
    }
  }
}
```

### CoordEventManager

```typescript
interface CoordEvent {
  type: 'weather' | 'trigger' | 'script';
  x: number;
  y: number;
  elevation: number;
  weather?: string;
  var?: string;
  varValue?: string;
  script?: string;
}

class CoordEventManager {
  private events: CoordEvent[] = [];
  private triggeredCoords: Set<string> = new Set();

  loadEvents(events: CoordEvent[]): void {
    this.events = events;
    this.triggeredCoords.clear();
  }

  checkPosition(
    playerX: number,
    playerY: number,
    elevation: number
  ): CoordEventResult | null {
    const key = `${playerX},${playerY}`;

    // Skip if already triggered this position
    if (this.triggeredCoords.has(key)) {
      return null;
    }

    for (const event of this.events) {
      if (event.x === playerX &&
          event.y === playerY &&
          (event.elevation === 0 || event.elevation === elevation)) {

        this.triggeredCoords.add(key);

        if (event.type === 'weather') {
          return {
            type: 'weather',
            weather: event.weather!
          };
        }

        if (event.type === 'trigger') {
          return {
            type: 'script',
            script: event.script!
          };
        }
      }
    }

    return null;
  }

  // Clear when leaving area
  clearTriggeredCoords(): void {
    this.triggeredCoords.clear();
  }
}
```

### WarpEventManager

```typescript
interface WarpEvent {
  x: number;
  y: number;
  elevation: number;
  destMap: string;
  destWarpId: number;
}

interface WarpDestination {
  mapId: string;
  warpId: number;
  x?: number;
  y?: number;
}

class WarpEventManager {
  private warps: WarpEvent[] = [];

  loadWarps(warps: WarpEvent[]): void {
    this.warps = warps;
  }

  checkWarp(
    playerX: number,
    playerY: number,
    elevation: number,
    facing: Direction
  ): WarpDestination | null {
    for (const warp of this.warps) {
      if (warp.x === playerX &&
          warp.y === playerY &&
          (warp.elevation === 0 || warp.elevation === elevation)) {
        return {
          mapId: warp.destMap,
          warpId: warp.destWarpId
        };
      }
    }
    return null;
  }

  // Get warp by ID (for incoming warps)
  getWarpById(warpId: number): WarpEvent | null {
    return this.warps[warpId] || null;
  }

  // Check if position is a warp (for rendering arrows)
  isWarpPosition(x: number, y: number): boolean {
    return this.warps.some(w => w.x === x && w.y === y);
  }
}
```

### BgEventManager

```typescript
interface BgEvent {
  type: 'sign' | 'hidden_item' | 'secret_base';
  x: number;
  y: number;
  elevation: number;
  script?: string;
  item?: string;
  flag?: string;
  secretBaseId?: string;
}

class BgEventManager {
  private events: BgEvent[] = [];

  checkInteraction(
    playerX: number,
    playerY: number,
    facing: Direction,
    flagManager: FlagManager
  ): BgEventResult | null {
    const targetX = playerX + (facing === 'right' ? 1 : facing === 'left' ? -1 : 0);
    const targetY = playerY + (facing === 'down' ? 1 : facing === 'up' ? -1 : 0);

    for (const event of this.events) {
      if (event.x === targetX && event.y === targetY) {
        // Hidden item already collected
        if (event.type === 'hidden_item' && event.flag) {
          if (flagManager.isSet(event.flag)) {
            continue;
          }
        }

        return {
          type: event.type,
          script: event.script,
          item: event.item,
          flag: event.flag
        };
      }
    }

    return null;
  }
}
```

### Integration with Existing Code

```typescript
// In MapRenderer.tsx or game loop

// Load events when map changes
useEffect(() => {
  eventManager.loadMapEvents(currentMapId);
}, [currentMapId]);

// Update each frame
function gameLoop(deltaMs: number) {
  // Update NPC movement
  eventManager.update(deltaMs);

  // Check coord events on player move
  const coordResult = eventManager.checkCoordEvent(playerX, playerY, elevation);
  if (coordResult?.type === 'weather') {
    weatherManager.setWeather(coordResult.weather);
  }

  // Check for trainer sight
  const trainerSpot = eventManager.checkTrainerSight(playerX, playerY, elevation);
  if (trainerSpot) {
    startTrainerBattle(trainerSpot);
  }

  // Check warp on step
  const warp = eventManager.checkWarp(playerX, playerY, elevation, facing);
  if (warp) {
    transitionToMap(warp.mapId, warp.warpId);
  }
}

// Handle A button press
function onInteract() {
  const result = eventManager.checkInteraction(facing, playerX, playerY);
  if (result) {
    handleInteraction(result);
  }
}
```

## Implementation Priority

1. **Phase 1**: Basic object visibility
   - Load object events from map.json
   - Filter by flag state
   - Render NPCs/items

2. **Phase 2**: Warp system
   - Detect warp tiles
   - Handle map transitions
   - Door animations

3. **Phase 3**: Coord events
   - Weather triggers (Route 113)
   - Script triggers

4. **Phase 4**: NPC interaction
   - Dialog on A press
   - Sign reading
   - Item collection

5. **Phase 5**: Trainer mechanics
   - Sight range detection
   - Approach animation
   - Battle trigger

6. **Phase 6**: Hidden items
   - Itemfinder integration
   - Collection with flags

7. **Phase 7**: NPC movement
   - Movement patterns
   - Wander areas
   - Path blocking
