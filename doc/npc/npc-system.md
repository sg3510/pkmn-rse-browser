# NPC System Documentation

This document describes how NPCs (Non-Player Characters) work in the Pokemon Emerald overworld, based on the source code in `public/pokeemerald/`.

## Table of Contents

1. [Data Structures](#1-data-structures)
2. [Sprite Display & Graphics](#2-sprite-display--graphics)
3. [Metadata Headers & Map Definitions](#3-metadata-headers--map-definitions)
4. [Movement System](#4-movement-system)
5. [Dialogue & Scripts](#5-dialogue--scripts)
6. [Conditional Appearance (Flags)](#6-conditional-appearance-flags)
7. [Trainer Battle System](#7-trainer-battle-system)
8. [Special Event NPCs](#8-special-event-npcs)
9. [Route 101 Zigzagoon Event](#9-route-101-zigzagoon-event)

---

## 1. Data Structures

### ObjectEventTemplate (Map Definition)

**File:** `include/global.fieldmap.h` (Lines 83-101)

This structure defines NPCs in map data files:

```c
struct ObjectEventTemplate
{
    u8 localId;              // Unique ID within the map (1-255)
    u8 graphicsId;           // Sprite appearance (OBJ_EVENT_GFX_*)
    u8 kind;                 // Object type
    s16 x;                   // X position on map
    s16 y;                   // Y position on map
    u8 elevation;            // Height level (0-15)
    u8 movementType;         // Behavior pattern (MOVEMENT_TYPE_*)
    u16 movementRangeX:4;    // Horizontal wander range (0-15 tiles)
    u16 movementRangeY:4;    // Vertical wander range (0-15 tiles)
    u16 trainerType;         // TRAINER_TYPE_NONE/NORMAL/SEE_ALL_DIRECTIONS/BURIED
    u16 trainerRange_berryTreeId;  // Vision range for trainers
    const u8 *script;        // Script executed on interaction
    u16 flagId;              // Flag controlling visibility
};
```

### ObjectEvent (Runtime State)

**File:** `include/global.fieldmap.h` (Lines 185-246)

The runtime structure extends the template with live state:

```c
struct ObjectEvent
{
    u32 active:1;                    // Is NPC active?
    u32 singleMovementActive:1;      // Currently executing movement?
    u32 triggerGroundEffectsOnMove:1;
    u32 disableCoveringGroundEffects:1;
    u32 landingJump:1;
    u32 heldMovementActive:1;
    u32 heldMovementFinished:1;
    u32 frozen:1;                    // Movement locked?
    u32 facingDirectionLocked:1;
    u32 disableAnim:1;
    u32 enableAnim:1;
    u32 inanimate:1;
    u32 invisible:1;                 // Hidden from view?
    u32 offScreen:1;
    u32 trackedByCamera:1;
    u32 isPlayer:1;
    u32 hasReflection:1;
    u32 inShortGrass:1;
    u32 inShallowFlowingWater:1;
    u32 inSandPile:1;
    u32 inHotSprings:1;
    u32 hasShadow:1;
    // ... position, direction, animation state fields
    u8 spriteId;
    u8 graphicsId;
    u8 movementType;
    u8 trainerType;
    u8 localId;
    u8 mapNum;
    u8 mapGroup;
    struct Coords16 initialCoords;
    struct Coords16 currentCoords;
    struct Coords16 previousCoords;
    u8 facingDirection:4;
    u8 movementDirection:4;
    // ...
};
```

### ObjectEventGraphicsInfo (Sprite Data)

**File:** `include/global.fieldmap.h` (Lines 248-266)

Maps graphics IDs to rendering data:

```c
struct ObjectEventGraphicsInfo
{
    u16 tileTag;                  // Sprite sheet tag
    u16 paletteTag;               // Palette tag
    u16 reflectionPaletteTag;     // Reflection palette
    u16 size;                     // Sprite size in bytes
    s16 width;                    // Width in pixels
    s16 height;                   // Height in pixels
    u8 paletteSlot:4;             // Which palette slot (0-15)
    u8 shadowSize:2;              // Shadow size
    u8 inanimate:1;               // No walking animation?
    u8 disableReflectionPaletteLoad:1;
    u8 tracks;                    // Footprint type
    const struct OamData *oam;
    const struct SubspriteTable *subspriteTables;
    const union AnimCmd *const *anims;
    const struct SpriteFrameImage *images;
    const union AffineAnimCmd *const *affineAnims;
};
```

---

## 2. Sprite Display & Graphics

### Graphics ID Constants

**File:** `include/constants/event_objects.h` (Lines 7-256)

Defines 239 unique graphics types:

```c
#define OBJ_EVENT_GFX_BRENDAN_NORMAL      0
#define OBJ_EVENT_GFX_BRENDAN_MACH_BIKE   1
#define OBJ_EVENT_GFX_NINJA_BOY           5
#define OBJ_EVENT_GFX_GIRL_1              8
#define OBJ_EVENT_GFX_SCIENTIST_1         46
#define OBJ_EVENT_GFX_ITEM_BALL           59
#define OBJ_EVENT_GFX_BERRY_TREE          60
#define OBJ_EVENT_GFX_ZIGZAGOON_1         85
// ... 239 total (NUM_OBJ_EVENT_GFX)
```

### Graphics Info Pointers

**File:** `src/data/object_events/object_event_graphics_info_pointers.h` (Lines 249-339)

```c
const struct ObjectEventGraphicsInfo *const gObjectEventGraphicsInfoPointers[NUM_OBJ_EVENT_GFX] = {
    [OBJ_EVENT_GFX_BRENDAN_NORMAL] = &gObjectEventGraphicsInfo_BrendanNormal,
    [OBJ_EVENT_GFX_SCIENTIST_1] = &gObjectEventGraphicsInfo_Scientist1,
    [OBJ_EVENT_GFX_ITEM_BALL] = &gObjectEventGraphicsInfo_ItemBall,
    // ...
};
```

### Palette Slots

**File:** `include/event_object_movement.h` (Lines 11-26)

```c
#define PALSLOT_PLAYER            0
#define PALSLOT_PLAYER_REFLECTION 1
#define PALSLOT_NPC_1             2
#define PALSLOT_NPC_2             3
#define PALSLOT_NPC_3             4
#define PALSLOT_NPC_4             5
#define PALSLOT_NPC_SPECIAL       10
#define OBJ_PALSLOT_COUNT         12
```

### Sprite Creation Pipeline

**File:** `src/event_object_movement.c`

1. **TrySpawnObjectEvents()** (Line 1645) - Entry point for spawning map NPCs
2. **TrySpawnObjectEventTemplate()** (Lines 1478-1499) - Creates NPC from template
3. **GetObjectEventGraphicsInfo()** (Lines 1914-1931) - Retrieves graphics data
4. **CopyObjectGraphicsInfoToSpriteTemplate()** (Lines 1543-1555) - Maps graphics to sprite
5. **CreateSprite()** (sprite.c Line 502) - Creates the actual sprite

### Animation System

**File:** `include/constants/event_object_movement.h` (Lines 249-269)

Standard animations for all NPCs:

```c
#define ANIM_STD_FACE_SOUTH       0   // Facing down
#define ANIM_STD_FACE_NORTH       1   // Facing up
#define ANIM_STD_FACE_WEST        2   // Facing left
#define ANIM_STD_FACE_EAST        3   // Facing right
#define ANIM_STD_GO_SOUTH         4   // Walking down
#define ANIM_STD_GO_NORTH         5   // Walking up
#define ANIM_STD_GO_WEST          6   // Walking left
#define ANIM_STD_GO_EAST          7   // Walking right
// ... 16 direction-based animations total
```

---

## 3. Metadata Headers & Map Definitions

### Map Header Structure

**File:** `include/global.fieldmap.h` (Lines 162-182)

```c
struct MapHeader
{
    const struct MapLayout *mapLayout;
    const struct MapEvents *events;      // Contains object events
    const u8 *mapScripts;
    const struct MapConnections *connections;
    u16 music;
    u16 mapLayoutId;
    // ...
};
```

### Map Events Structure

**File:** `include/global.fieldmap.h` (Lines 136-146)

```c
struct MapEvents
{
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

### Map JSON Format

**Location:** `data/maps/<MapName>/map.json`

Example from `data/maps/RustboroCity_PokemonSchool/map.json`:

```json
{
  "object_events": [
    {
      "graphics_id": "OBJ_EVENT_GFX_GAMEBOY_KID",
      "x": 8,
      "y": 6,
      "elevation": 3,
      "movement_type": "MOVEMENT_TYPE_FACE_RIGHT",
      "movement_range_x": 0,
      "movement_range_y": 0,
      "trainer_type": "TRAINER_TYPE_NONE",
      "trainer_sight_or_berry_tree_id": "0",
      "script": "RustboroCity_PokemonSchool_EventScript_GameboyKid1",
      "flag": "0"
    }
  ],
  "warp_events": [...],
  "coord_events": [...],
  "bg_events": [...]
}
```

---

## 4. Movement System

### Movement Type Constants

**File:** `include/constants/event_object_movement.h` (Lines 4-85)

81 movement types (0x00-0x50):

```c
#define MOVEMENT_TYPE_NONE                    0x00
#define MOVEMENT_TYPE_LOOK_AROUND             0x01
#define MOVEMENT_TYPE_WANDER_AROUND           0x02
#define MOVEMENT_TYPE_WANDER_UP_AND_DOWN      0x03
#define MOVEMENT_TYPE_WANDER_LEFT_AND_RIGHT   0x05
#define MOVEMENT_TYPE_FACE_UP                 0x07
#define MOVEMENT_TYPE_FACE_DOWN               0x08
#define MOVEMENT_TYPE_FACE_LEFT               0x09
#define MOVEMENT_TYPE_FACE_RIGHT              0x0A
#define MOVEMENT_TYPE_WALK_UP_AND_DOWN        0x19
#define MOVEMENT_TYPE_WALK_LEFT_AND_RIGHT     0x1B
#define MOVEMENT_TYPE_COPY_PLAYER             0x35
#define MOVEMENT_TYPE_TREE_DISGUISE           0x39
#define MOVEMENT_TYPE_MOUNTAIN_DISGUISE       0x3A
#define MOVEMENT_TYPE_BURIED                  0x3F
#define MOVEMENT_TYPE_INVISIBLE               0x4C
// ... 81 total (NUM_MOVEMENT_TYPES = 0x51)
```

### Movement Type Callbacks

**File:** `src/event_object_movement.c` (Lines 222-305)

```c
static u8 (*const sMovementTypeCallbacks[])(struct ObjectEvent *, struct Sprite *) = {
    [MOVEMENT_TYPE_NONE] = MovementType_None,
    [MOVEMENT_TYPE_LOOK_AROUND] = MovementType_LookAround,
    [MOVEMENT_TYPE_WANDER_AROUND] = MovementType_WanderAround,
    [MOVEMENT_TYPE_WALK_IN_PLACE_DOWN] = MovementType_WalkInPlace,
    // ... 81 handlers
};
```

### Random Movement (WanderAround)

**File:** `src/event_object_movement.c` (Lines 2564-2630)

State machine with 7 steps:
1. **Step 0**: Initialize
2. **Step 1**: Face current direction
3. **Step 2**: Execute facing animation
4. **Step 3**: Wait for random delay (32-128 frames)
5. **Step 4**: Choose random direction (N/S/E/W)
6. **Step 5**: Begin walk if no collision
7. **Step 6**: Execute walk, loop back to Step 1

```c
// Random delay values (frames at 60fps)
static const s16 sMovementDelaysMedium[] = {32, 64, 96, 128};

// Direction selection
u8 directions[4];
memcpy(directions, gStandardDirections, sizeof directions);
chosenDirection = directions[Random() & 3];  // Pick random from 4 dirs
```

### Collision Detection

**File:** `src/event_object_movement.c` (Lines 4650-4713)

```c
static u8 GetCollisionInDirection(struct ObjectEvent *objectEvent, u8 direction)
{
    s16 x = objectEvent->currentCoords.x;
    s16 y = objectEvent->currentCoords.y;
    MoveCoords(direction, &x, &y);
    return GetCollisionAtCoords(objectEvent, x, y, direction);
}
```

Collision types:
- `COLLISION_NONE` - Safe to move
- `COLLISION_OUTSIDE_RANGE` - Movement range exceeded
- `COLLISION_IMPASSABLE` - Wall/obstacle
- `COLLISION_ELEVATION_MISMATCH` - Height difference
- `COLLISION_OBJECT_EVENT` - Another NPC blocking

### Movement Range

NPCs are restricted to their initial spawn area:

```c
if (objectEvent->range.rangeX != 0) {
    left = objectEvent->initialCoords.x - objectEvent->range.rangeX;
    right = objectEvent->initialCoords.x + objectEvent->range.rangeX;
}
```

### Copy Player Movement

**File:** `src/event_object_movement.c` (Lines 4157-4340)

The `MOVEMENT_TYPE_COPY_PLAYER` types make NPCs mirror player actions:

```c
[MOVEMENT_TYPE_COPY_PLAYER] = MovementType_CopyPlayer,
[MOVEMENT_TYPE_COPY_PLAYER_OPPOSITE] = MovementType_CopyPlayerOpposite,
[MOVEMENT_TYPE_COPY_PLAYER_COUNTERCLOCKWISE] = MovementType_CopyPlayerCounterclockwise,
[MOVEMENT_TYPE_COPY_PLAYER_CLOCKWISE] = MovementType_CopyPlayerClockwise,
```

Used for NPCs that follow the player (e.g., partner Pokemon, escort missions).

### Script-Based Movement

**File:** `src/script_movement.c`

For complex paths, scripts define movement sequences:

```c
ScriptMovement_StartObjectMovementScript()  // Queue movement
ScriptMovement_MoveObjects()                 // Process each frame
ScriptMovement_TakeStep()                    // Execute single action
```

Movement scripts are byte arrays ending with `MOVEMENT_ACTION_STEP_END` (0xFE).

---

## 5. Dialogue & Scripts

### Script File Structure

**Location:** `data/maps/<MapName>/scripts.inc` and `data/scripts/*.inc`

Scripts use an assembly-like language:

```asm
RustboroCity_PokemonSchool_EventScript_GameboyKid1::
    msgbox RustboroCity_PokemonSchool_Text_TradingRightNow, MSGBOX_NPC
    end

RustboroCity_PokemonSchool_Text_TradingRightNow:
    .string "I'm trading POKéMON with my friend\n"
    .string "right now.$"
```

### Message Box Types

**File:** `data/scripts/std_msgbox.inc`

```c
MSGBOX_NPC      // lock + faceplayer + message + waitmessage + waitbuttonpress + release
MSGBOX_SIGN     // lockall + message + waitmessage + waitbuttonpress + releaseall
MSGBOX_DEFAULT  // message + waitmessage + waitbuttonpress (no lock/release)
MSGBOX_YESNO    // message + waitmessage + yesnobox (for yes/no choices)
```

### Core Script Commands

**Control Flow:**
- `end` - End script
- `return` - Return from subroutine
- `call <LABEL>` - Call subroutine
- `goto <LABEL>` - Unconditional jump
- `goto_if_set <FLAG>, <LABEL>` - Jump if flag set
- `goto_if_eq <VAR>, <VALUE>, <LABEL>` - Jump if equal
- `switch <VAR>` ... `case <VALUE>, <LABEL>` - Switch statement

**Dialogue:**
- `msgbox <TEXT>, <MSGBOX_TYPE>` - Show message
- `message <TEXT>` - Set message
- `waitmessage` - Wait for display
- `waitbuttonpress` - Wait for A button
- `yesnobox <X>, <Y>` - Show yes/no choice

**NPC Control:**
- `lock` / `lockall` - Lock player/all input
- `release` / `releaseall` - Release locks
- `faceplayer` - Face toward player
- `applymovement <OBJ>, <MOVEMENT>` - Move NPC
- `waitmovement <OBJ>` - Wait for movement

**Game State:**
- `setflag <FLAG>` - Set a flag
- `clearflag <FLAG>` - Clear a flag
- `setvar <VAR>, <VALUE>` - Set variable
- `giveitem <ITEM>` - Give item
- `special <FUNCTION>` - Call special function

### Text Special Characters

```
\n  - Line break
\p  - Paragraph break (waits for button)
\l  - Continuation on same line
$   - End of text
{PLAYER}      - Player name
{STR_VAR_1}   - String variable 1
{STR_VAR_2}   - String variable 2
{STR_VAR_3}   - String variable 3
```

### Example: Conditional Dialogue

**File:** `data/maps/RustboroCity_PokemonSchool/scripts.inc` (Lines 163-199)

```asm
RustboroCity_PokemonSchool_EventScript_Scott::
    lock
    faceplayer
    goto_if_set FLAG_MET_SCOTT_AFTER_OBTAINING_STONE_BADGE, RustboroCity_PokemonSchool_EventScript_ScottWatchStudents
    goto_if_set FLAG_MET_SCOTT_RUSTBORO, RustboroCity_PokemonSchool_EventScript_ScottSpokeAlready
    goto_if_set FLAG_BADGE01_GET, RustboroCity_PokemonSchool_EventScript_ScottGreetHasBadge
    msgbox RustboroCity_PokemonSchool_Text_ScottMetAlreadyCut, MSGBOX_DEFAULT
    addvar VAR_SCOTT_STATE, 1
    setflag FLAG_MET_SCOTT_RUSTBORO
    release
    end
```

---

## 6. Conditional Appearance (Flags)

### Flag Field in Object Events

Every NPC has a `flag` field controlling visibility:

```json
{
  "script": "SootopolisCity_EventScript_Steven",
  "flag": "FLAG_HIDE_SOOTOPOLIS_CITY_STEVEN"
}
```

- `"flag": "0"` - Always visible
- `"flag": "FLAG_HIDE_*"` - Hidden when flag is SET

### Flag Categories

**594 unique flags across all maps:**

1. **Always Visible** (`"0"`)
   - Regular townspeople, shopkeepers

2. **Story NPCs** (`FLAG_HIDE_*`)
   ```
   FLAG_HIDE_SOOTOPOLIS_CITY_STEVEN
   FLAG_HIDE_SOOTOPOLIS_CITY_GROUDON
   FLAG_HIDE_SOOTOPOLIS_CITY_KYOGRE
   FLAG_HIDE_LITTLEROOT_TOWN_BIRCHS_LAB_BIRCH
   ```

3. **Group Flags** (Multiple NPCs share one flag)
   ```
   FLAG_HIDE_SOOTOPOLIS_CITY_RESIDENTS  // Hides all residents during crisis
   FLAG_HIDE_AQUA_HIDEOUT_GRUNTS        // Hides all Team Aqua grunts
   ```

4. **Hidden Items** (`FLAG_HIDDEN_ITEM_*`)
   ```
   FLAG_HIDDEN_ITEM_ROUTE_104_POKE_BALL
   FLAG_HIDDEN_ITEM_ROUTE_119_ULTRA_BALL
   ```

5. **Secret Base Decorations** (`FLAG_DECORATION_1` through `FLAG_DECORATION_14`)

6. **Temporary Flags** (`FLAG_TEMP_*`) - Used during cutscenes

### Example: Legendary Pokemon Visibility

**File:** `data/maps/SootopolisCity/map.json`

```json
{"local_id": "LOCALID_GROUDON", "flag": "FLAG_HIDE_SOOTOPOLIS_CITY_GROUDON"},
{"local_id": "LOCALID_KYOGRE", "flag": "FLAG_HIDE_SOOTOPOLIS_CITY_KYOGRE"},
{"local_id": "LOCALID_RAYQUAZA", "flag": "FLAG_HIDE_SOOTOPOLIS_CITY_RAYQUAZA"}
```

---

## 7. Trainer Battle System

### Trainer Types

**File:** `include/constants/trainer_types.h`

```c
#define TRAINER_TYPE_NONE               0  // Not a trainer
#define TRAINER_TYPE_NORMAL             1  // See in facing direction only
#define TRAINER_TYPE_SEE_ALL_DIRECTIONS 2  // See in all 4 directions
#define TRAINER_TYPE_BURIED             3  // Hidden underground
```

### Vision Detection

**File:** `src/trainer_see.c`

**Main Function:** `CheckForTrainersWantingBattle()` (Lines 191-246)

1. Iterates through all object events
2. Checks for trainers with `TRAINER_TYPE_NORMAL` or `TRAINER_TYPE_BURIED`
3. Calls `GetTrainerApproachDistance()` for each

**Direction Functions:** (Lines 327-368)

```c
GetTrainerApproachDistanceSouth()  // Player directly south?
GetTrainerApproachDistanceNorth()  // Player directly north?
GetTrainerApproachDistanceWest()   // Player directly west?
GetTrainerApproachDistanceEast()   // Player directly east?
```

Each checks:
- Same row/column as trainer
- Within sight range (`trainerRange_berryTreeId`)
- Clear line of sight (no obstacles)

### Trainer Approach State Machine

**File:** `src/trainer_see.c` (Lines 74-87)

```c
TRSEE_NONE                  // Idle
TRSEE_EXCLAMATION           // Show ! icon
TRSEE_EXCLAMATION_WAIT      // Wait for icon animation
TRSEE_MOVE_TO_PLAYER        // Walk toward player
TRSEE_PLAYER_FACE           // Player faces trainer
TRSEE_PLAYER_FACE_WAIT      // Wait for player animation
// Special states for disguised/buried trainers
```

### Approach Sequence

1. **Exclamation Mark** (Lines 459-469)
   - Display "!" above trainer
   - Hold trainer facing player

2. **Movement** (Lines 490-506)
   - Walk one tile per frame toward player
   - Decrement range counter

3. **Player Response** (Lines 509-529)
   - Force player to face trainer
   - Lock player movement

4. **Battle Initiation**
   - Call battle setup functions

### Special Trainer Types

**Disguised Trainers:**
- `MOVEMENT_TYPE_TREE_DISGUISE` - Hidden as tree
- `MOVEMENT_TYPE_MOUNTAIN_DISGUISE` - Hidden as rock

**Buried Trainers:**
- `MOVEMENT_TYPE_BURIED` - Pop out with ash effect
- Creates field effect sprite during reveal

### Trainer Data Structure

**File:** `src/data/trainers.h`

```c
struct Trainer {
    u8 partyFlags;
    u8 trainerClass;
    u8 encounterMusic_gender;
    u8 trainerPic;
    const u8 *trainerName;
    u16 items[4];
    bool8 doubleBattle;
    u16 aiFlags;
    u8 partySize;
    const struct pokemon *party;
};
```

---

## 8. Special Event NPCs

### Legendary Pokemon

**Example: Rayquaza (Sky Pillar)**

**File:** `data/maps/SkyPillar_Top/scripts.inc`

Multi-state legendary with awakening sequence:

```asm
SkyPillar_Top_OnTransition:
    call_if_lt VAR_SKY_PILLAR_STATE, 2, SkyPillar_Top_EventScript_SetLayoutClean
    call_if_ge VAR_SKY_PILLAR_STATE, 2, SkyPillar_Top_EventScript_TryShowRayquaza
    end
```

States:
- State < 2: Sleeping Rayquaza (`OBJ_EVENT_GFX_RAYQUAZA`)
- State >= 2: Check `FLAG_DEFEATED_RAYQUAZA`, show interactive version

### State Variables

Common patterns:

```c
VAR_SOOTOPOLIS_CITY_STATE  // 7 states (0-6) for Sootopolis story
VAR_SKY_PILLAR_STATE       // Rayquaza encounter progression
VAR_MT_PYRE_STATE          // Mt. Pyre team encounter
VAR_BIRCH_STATE            // Professor Birch location
```

### Flag Patterns

```c
FLAG_RECEIVED_X    // One-time gift/event receipt
FLAG_HIDE_X        // NPC visibility control
FLAG_CAUGHT_X      // Legendary captured
FLAG_DEFEATED_X    // Legendary defeated (not caught)
FLAG_BATTLED_X     // Battle occurred
FLAG_ENABLE_SHIP_X // Location unlock
FLAG_MET_X         // First encounter
```

### Coordinate Events

Location-based triggers in map.json:

```json
"coord_events": [
  {
    "type": "trigger",
    "x": 14,
    "y": 9,
    "elevation": 3,
    "var": "VAR_SKY_PILLAR_RAYQUAZA_CRY_DONE",
    "var_value": "0",
    "script": "SkyPillar_Top_EventScript_AwakenRayquaza"
  }
]
```

### Recurring NPCs (Gabby & Ty)

**File:** `data/scripts/gabby_and_ty.inc`

- Appear at Route 111, 118, 120 rotation based on battle count
- Use `GabbyAndTyGetBattleNum` to determine encounter number
- Multiple trainer parties that cycle

---

## 9. Route 101 Zigzagoon Event

This is the iconic intro event where Professor Birch is chased by a Zigzagoon.

### Map Configuration

**File:** `data/maps/Route101/map.json`

**Object Events:**
- **Professor Birch** (Lines 42-54): `OBJ_EVENT_GFX_PROF_BIRCH`, position (9, 13)
  - Flag: `FLAG_HIDE_ROUTE_101_BIRCH_ZIGZAGOON_BATTLE`

- **Birch's Bag** (Lines 56-67): Position (7, 14)
  - Script: `Route101_EventScript_BirchsBag`
  - Flag: `FLAG_HIDE_ROUTE_101_BIRCH_STARTERS_BAG`

- **Zigzagoon** (Lines 69-81): `OBJ_EVENT_GFX_ZIGZAGOON_1`, position (10, 13)
  - Flag: `FLAG_HIDE_ROUTE_101_ZIGZAGOON`

**Coordinate Triggers** (Lines 110-191):
- Primary trigger at (10, 19) and (11, 19), requires `VAR_ROUTE101_STATE == 1`
- Exit prevention triggers at south, west, north exits when `VAR_ROUTE101_STATE == 2`

### Event Flow

**File:** `data/maps/Route101/scripts.inc`

1. **Map Entry** (`Route101_OnTransition`, Lines 6-8):
   - Calls `ProfBirch_EventScript_UpdateLocation`
   - Shows/hides Birch based on `VAR_BIRCH_STATE`

2. **First Frame** (`Route101_OnFrame`, Lines 10-17):
   - Sets `VAR_ROUTE101_STATE = 1`
   - Hides map name popup

3. **Trigger Zone** (when player reaches coords 10,19 or 11,19):
   - Executes `Route101_EventScript_StartBirchRescue`

### Main Event Script

**Script:** `Route101_EventScript_StartBirchRescue` (Lines 19-42)

```asm
Route101_EventScript_StartBirchRescue::
    lockall
    playbgm MUS_HELP, FALSE            @ Distress music
    msgbox Route101_Text_Help, MSGBOX_DEFAULT  @ "H-help me!"
    closemessage
    setobjectxyperm LOCALID_BIRCH, 0, 15
    setobjectxyperm LOCALID_ZIGZAGOON, 0, 16
    @ Player walks up, faces left
    applymovement OBJ_EVENT_ID_PLAYER, Route101_Movement_PlayerApproach
    @ Birch runs right 4, up 2
    applymovement LOCALID_BIRCH, Route101_Movement_BirchRunFromZigzagoon1
    @ Zigzagoon chases
    applymovement LOCALID_ZIGZAGOON, Route101_Movement_ZigzagoonChase1
    waitmovement 0
    @ Circular chase sequence
    applymovement LOCALID_BIRCH, Route101_Movement_BirchRunInCircles
    applymovement LOCALID_ZIGZAGOON, Route101_Movement_ZigzagoonChaseInCircles
    waitmovement 0
    @ Standoff
    applymovement LOCALID_BIRCH, Route101_Movement_BirchWalkInPlaceRight
    applymovement LOCALID_ZIGZAGOON, Route101_Movement_ZigzagoonFaceLeft
    waitmovement 0
    @ Dialogue
    msgbox Route101_Text_PleaseHelp, MSGBOX_DEFAULT
    @ "In my BAG! There's a POKé BALL!"
    setvar VAR_ROUTE101_STATE, 2       @ Prevent player escape
    releaseall
    end
```

### Movement Patterns

**Zigzagoon Chase** (Lines 83-133):
- Initial: 1 up, 4 right, 2 up
- Circle pattern: up-up-up, right-right-right, down-down, left-left-left (repeats 3x)
- Face left at end

**Birch Escape** (Lines 143-193):
- Initial: 4 right, 2 up
- Matching circle pattern
- Face right at end

### Getting the Starter

**Script:** `Route101_EventScript_BirchsBag` (Lines 218-246)

1. Set flags marking rescue:
   - `FLAG_SYS_POKEMON_GET`
   - `FLAG_RESCUED_BIRCH`

2. Open starter selection:
   - `special ChooseStarter`

3. After selection:
   - Position player at (6, 13)
   - Birch approaches from right
   - Dialogue: "Whew... I was in the tall grass studying wild POKéMON when I was jumped. You saved me..."
   - Heal party
   - Set `FLAG_HIDE_ROUTE_101_BIRCH_ZIGZAGOON_BATTLE`
   - Show Birch in lab instead
   - Warp to Professor Birch's Lab

### State Variables

| Variable | Purpose |
|----------|---------|
| `VAR_ROUTE101_STATE` | 0: initial, 1: ready for event, 2: event triggered, 3: complete |
| `VAR_BIRCH_STATE` | 2 or 3: Birch at Route 101 |
| `FLAG_RESCUED_BIRCH` | Set after starter selection |
| `FLAG_HIDE_ROUTE_101_BIRCH_ZIGZAGOON_BATTLE` | Hides Birch & Zigzagoon after event |

---

## Key Source Files Summary

| File | Purpose |
|------|---------|
| `include/global.fieldmap.h` | Core data structures |
| `include/constants/event_objects.h` | Graphics ID constants |
| `include/constants/event_object_movement.h` | Movement type constants |
| `include/constants/trainer_types.h` | Trainer type constants |
| `src/event_object_movement.c` | Movement logic (315KB) |
| `src/trainer_see.c` | Trainer vision/battle initiation |
| `src/script_movement.c` | Script-based movement |
| `src/data/object_events/object_event_graphics_info.h` | Graphics definitions |
| `src/data/object_events/movement_type_func_tables.h` | Movement function tables |
| `data/maps/*/map.json` | Map NPC definitions |
| `data/maps/*/scripts.inc` | Map scripts |
| `data/scripts/*.inc` | Global scripts (43 files) |
