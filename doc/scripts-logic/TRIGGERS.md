# Script Triggers

How and when scripts are triggered in Pokemon Emerald.

## Trigger Types

```
┌────────────────────────────────────────────────────────────┐
│                    SCRIPT TRIGGERS                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ NPC/Object │  │   Map      │  │  Position  │           │
│  │ Interaction│  │  Scripts   │  │  Triggers  │           │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘           │
│        │               │               │                   │
│        ▼               ▼               ▼                   │
│  ┌──────────────────────────────────────────────┐         │
│  │           ScriptContext_SetupScript          │         │
│  └──────────────────────────────────────────────┘         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## 1. NPC/Object Interaction

When player presses A facing an object.

### Source
`src/field_control_avatar.c`

### Flow

```c
// Main input processing
int ProcessPlayerFieldInput(struct FieldInput *input)
{
    // ... other checks ...

    GetInFrontOfPlayerPosition(&position);
    metatileBehavior = MapGridGetMetatileBehaviorAt(position.x, position.y);

    // A button pressed → try interaction
    if (input->pressedAButton && TryStartInteractionScript(&position, metatileBehavior, playerDirection))
        return TRUE;
}

// Find and run interaction script
static bool8 TryStartInteractionScript(struct MapPosition *position, u16 metatileBehavior, u8 direction)
{
    const u8 *script = GetInteractionScript(position, metatileBehavior, direction);
    if (script == NULL)
        return FALSE;

    PlaySE(SE_SELECT);
    ScriptContext_SetupScript(script);
    return TRUE;
}

// Get script from object, background event, or metatile
static const u8 *GetInteractionScript(struct MapPosition *position, u8 metatileBehavior, u8 direction)
{
    const u8 *script;

    // 1. Check for object event (NPC, item, etc.)
    script = GetInteractedObjectEventScript(position, metatileBehavior, direction);
    if (script != NULL) return script;

    // 2. Check for background event (sign, hidden item)
    script = GetInteractedBackgroundEventScript(position, metatileBehavior, direction);
    if (script != NULL) return script;

    // 3. Check metatile behavior (bookshelf, PC, etc.)
    script = GetInteractedMetatileScript(position, metatileBehavior, direction);
    if (script != NULL) return script;

    // 4. Check for water interaction
    script = GetInteractedWaterScript(position, metatileBehavior, direction);
    return script;
}
```

### Getting Object Script

```c
// From event_object_movement.c
const u8 *GetObjectEventScriptPointerByObjectEventId(u8 objectEventId)
{
    return GetObjectEventScriptPointerByLocalIdAndMap(
        gObjectEvents[objectEventId].localId,
        gObjectEvents[objectEventId].mapNum,
        gObjectEvents[objectEventId].mapGroup
    );
}

static const u8 *GetObjectEventScriptPointerByLocalIdAndMap(u8 localId, u8 mapNum, u8 mapGroup)
{
    // Look up in map data based on localId
    // Returns pointer to script in object_events array
}
```

## 2. Map Scripts

Automatic scripts triggered by map state.

### Types

| Type | When Triggered | Runs As |
|------|----------------|---------|
| `ON_LOAD` | Tiles load | Immediate |
| `ON_TRANSITION` | Enter map (before fade-in) | Immediate |
| `ON_FRAME_TABLE` | Each frame (condition check) | Global |
| `ON_WARP_INTO_MAP_TABLE` | On warp arrival | Immediate |
| `ON_RESUME` | After battle/menu | Immediate |
| `ON_RETURN_TO_FIELD` | Special return | Immediate |
| `ON_DIVE_WARP` | Dive transition | Immediate |

### Map Scripts Format (ASM)

```asm
LittlerootTown_MapScripts::
    map_script MAP_SCRIPT_ON_LOAD, LittlerootTown_OnLoad
    map_script MAP_SCRIPT_ON_TRANSITION, LittlerootTown_OnTransition
    map_script MAP_SCRIPT_ON_FRAME_TABLE, LittlerootTown_OnFrame
    .byte 0  @ End marker

@ Frame table format: checks conditions each frame
LittlerootTown_OnFrame:
    map_script_2 VAR_LITTLEROOT_INTRO_STATE, 1, LittlerootTown_EventScript_MomGreet
    map_script_2 VAR_LITTLEROOT_INTRO_STATE, 2, LittlerootTown_EventScript_GoInside
    .2byte 0  @ End marker
```

### Map Header Structure

```c
struct MapHeader {
    // ... other fields ...
    const u8 *mapScripts;  // Pointer to script table
};

// Script table format in memory:
// [type:1][pointer:4][type:1][pointer:4]...[0:1]

// Frame table format in memory:
// [var1:2][var2:2][pointer:4]...[0:2]
```

### Running Map Scripts

```c
void RunOnLoadMapScript(void)
{
    MapHeaderRunScriptType(MAP_SCRIPT_ON_LOAD);
}

void MapHeaderRunScriptType(u8 tag)
{
    u8 *ptr = MapHeaderGetScriptTable(tag);
    if (ptr)
        RunScriptImmediately(ptr);  // Runs to completion
}

// Frame scripts run in global context (can yield)
bool8 TryRunOnFrameMapScript(void)
{
    u8 *ptr = MapHeaderCheckScriptTable(MAP_SCRIPT_ON_FRAME_TABLE);
    if (!ptr)
        return FALSE;

    ScriptContext_SetupScript(ptr);
    return TRUE;
}
```

## 3. Position-Based Triggers

Scripts triggered by player position.

### Coord Events

```c
// From map.json coord_events array
{
    "type": "1",  // Coord event type
    "x": 5,
    "y": 10,
    "elevation": 0,
    "var": "VAR_TEMP_1",
    "var_value": "0",
    "script": "Route101_EventScript_EnterGrass"
}
```

### Checking Coord Events

```c
static bool8 TryStartCoordEventScript(struct MapPosition *position)
{
    const u8 *script = GetCoordEventScriptAtPosition(
        &gMapHeader,
        position->x - MAP_OFFSET,
        position->y - MAP_OFFSET,
        position->elevation
    );

    if (script == NULL)
        return FALSE;

    ScriptContext_SetupScript(script);
    return TRUE;
}
```

## 4. Trainer Scripts

Automatic battle triggers when in trainer's sight.

### Source
`src/trainer_see.c`, `src/battle_setup.c`

### Flow

```c
// Check every frame in ProcessPlayerFieldInput
if (CheckForTrainersWantingBattle() == TRUE)
    return TRUE;

// In trainer_see.c
bool8 CheckForTrainersWantingBattle(void)
{
    // Check each trainer object
    // If player in sight range and not defeated:
    //   - Set up approach animation
    //   - ScriptContext_SetupScript(EventScript_StartTrainerApproach)
}
```

## 5. Item Ball Scripts

When interacting with item balls.

### Standard Flow

```c
// Object event has script like:
// Route101_EventScript_Item1::
//     finditem ITEM_POTION
//     end

// finditem is a macro that expands to:
//     setvar VAR_0x8000, ITEM_POTION
//     setvar VAR_0x8001, 1
//     callstd STD_FIND_ITEM
```

## TypeScript Implementation

### Trigger System

```typescript
interface TriggerSystem {
  // NPC interaction
  onInteract(position: Position, direction: Direction): Script | null;

  // Map scripts
  onMapLoad(mapId: string): void;
  onMapTransition(mapId: string): void;
  onFrame(): Script | null;

  // Position triggers
  onPlayerStep(position: Position): Script | null;

  // Trainer sight
  checkTrainerSight(): Script | null;
}

class ScriptTriggerManager implements TriggerSystem {
  private mapScripts: MapScripts;
  private objectEvents: ObjectEventManager;
  private coordEvents: CoordEvent[];

  onInteract(position: Position, direction: Direction): Script | null {
    // 1. Check object events
    const obj = this.objectEvents.getAtPosition(position);
    if (obj?.script) return this.loadScript(obj.script);

    // 2. Check background events
    const bg = this.getBackgroundEvent(position);
    if (bg?.script) return this.loadScript(bg.script);

    // 3. Check metatile behavior
    const behavior = this.getMetatileBehavior(position);
    return this.getMetatileScript(behavior);
  }

  onFrame(): Script | null {
    // Check frame table conditions
    for (const entry of this.mapScripts.frameTable) {
      if (this.vars.get(entry.var1) === this.vars.get(entry.var2)) {
        return this.loadScript(entry.script);
      }
    }
    return null;
  }

  onPlayerStep(position: Position): Script | null {
    // Check coord events
    for (const event of this.coordEvents) {
      if (event.x === position.x &&
          event.y === position.y &&
          this.checkCondition(event.var, event.varValue)) {
        return this.loadScript(event.script);
      }
    }
    return null;
  }
}
```

### Integration with Game Loop

```typescript
class GameLoop {
  private triggerManager: ScriptTriggerManager;
  private scriptEngine: ScriptEngine;

  update(): void {
    // Check for trainer battles first
    const trainerScript = this.triggerManager.checkTrainerSight();
    if (trainerScript) {
      this.scriptEngine.run(trainerScript);
      return;
    }

    // Check frame scripts
    const frameScript = this.triggerManager.onFrame();
    if (frameScript) {
      this.scriptEngine.run(frameScript);
      return;
    }

    // Handle player input
    if (this.input.aPressed) {
      const script = this.triggerManager.onInteract(
        this.player.facingPosition,
        this.player.direction
      );
      if (script) {
        this.scriptEngine.run(script);
        return;
      }
    }

    // Handle step-based triggers
    if (this.player.justTookStep) {
      const script = this.triggerManager.onPlayerStep(this.player.position);
      if (script) {
        this.scriptEngine.run(script);
      }
    }
  }
}
```

## Data Structures from Map JSON

```typescript
interface MapData {
  warp_events: WarpEvent[];
  coord_events: CoordEvent[];
  bg_events: BackgroundEvent[];
  object_events: ObjectEvent[];
}

interface ObjectEvent {
  graphics_id: string;
  x: number;
  y: number;
  elevation: number;
  movement_type: string;
  script: string;       // Script label
  flag: string;         // Visibility flag
  local_id?: string;
}

interface CoordEvent {
  type: string;
  x: number;
  y: number;
  elevation: number;
  var: string;
  var_value: string;
  script: string;
}

interface BackgroundEvent {
  type: string;  // "0"=sign, "1-4"=hidden item, "5"=secret base
  x: number;
  y: number;
  elevation: number;
  player_facing_dir?: string;
  script?: string;
  // For hidden items:
  hidden_item?: string;
  amount?: string;
  item_is_hidden?: string;
}
```
