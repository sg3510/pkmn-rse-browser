---
title: Overworld Objects Documentation
status: reference
last_verified: 2026-01-13
---

# Overworld Objects Documentation

This document describes interactable overworld objects in Pokemon Emerald, based on the source code in `public/pokeemerald/`.

## Table of Contents

1. [Item Balls (Pokeballs)](#1-item-balls-pokeballs)
2. [Hidden Items](#2-hidden-items)
3. [Breakable Rocks (Rock Smash)](#3-breakable-rocks-rock-smash)
4. [Cuttable Trees (Cut)](#4-cuttable-trees-cut)
5. [Strength Boulders](#5-strength-boulders)
6. [Berry Trees](#6-berry-trees)
7. [Kecleon (Invisible Pokemon)](#7-kecleon-invisible-pokemon)
8. [Secret Base Entrances](#8-secret-base-entrances)
9. [Dive Spots](#9-dive-spots)
10. [Waterfall Spots](#10-waterfall-spots)
11. [Surf Interaction](#11-surf-interaction)
12. [Water Currents](#12-water-currents)

---

## 1. Item Balls (Pokeballs)

Item balls are the collectible Pokeball sprites on the ground containing items.

### Graphics Definition

**File:** `include/constants/event_objects.h`
```c
// Line 66
#define OBJ_EVENT_GFX_ITEM_BALL 59
```

**File:** `src/data/object_events/object_event_graphics.h`
```c
// Line 127
const u32 gObjectEventPic_ItemBall[] = INCBIN_U32("graphics/object_events/pics/misc/item_ball.4bpp");
```

**Graphics File:** `graphics/object_events/pics/misc/item_ball.png`

### Map Definition Format

**Example from** `data/maps/Route116/map.json`:
```json
{
  "graphics_id": "OBJ_EVENT_GFX_ITEM_BALL",
  "x": 50,
  "y": 17,
  "elevation": 3,
  "movement_type": "MOVEMENT_TYPE_LOOK_AROUND",
  "movement_range_x": 1,
  "movement_range_y": 1,
  "trainer_type": "TRAINER_TYPE_NONE",
  "trainer_sight_or_berry_tree_id": "0",
  "script": "Route134_EventScript_ItemCarbos",
  "flag": "FLAG_ITEM_ROUTE_134_CARBOS"
}
```

### Pickup Scripts

**File:** `data/scripts/item_ball_scripts.inc` (660+ lines)

Contains 100+ item ball pickup scripts using the `finditem` command:

```asm
Route102_EventScript_ItemPotion::
    finditem ITEM_POTION
    end

Route134_EventScript_ItemCarbos::
    finditem ITEM_CARBOS
    end
```

**Macro Definition:** `asm/macros/event.inc` (Lines 1930-1936)
```asm
.macro finditem item:req, amount=1
    setvar VAR_0x8000, \item
    setvar VAR_0x8001, \amount
    callstd STD_FIND_ITEM
.endm
```

### Flag Tracking

**File:** `include/constants/flags.h`

Item flags start at `0x3E8` (Lines 1053-1486):
```c
#define FLAG_ITEM_ROUTE_102_POTION      0x3E8   // Line 1053
#define FLAG_ITEM_ROUTE_116_X_SPECIAL   0x3E9   // Line 1054
#define FLAG_ITEM_ROUTE_134_CARBOS      0x486   // Line 1486
```

When a flag is SET, the item ball is hidden (already collected).

---

## 2. Hidden Items

Items found with the Itemfinder/Dowsing Machine, defined as background events.

### Flag Definitions

**File:** `include/constants/flags.h` (Lines 545-643)

Hidden item flags start at `FLAG_HIDDEN_ITEMS_START` (`0x1F4`):
```c
#define FLAG_HIDDEN_ITEM_LAVARIDGE_TOWN_ICE_HEAL     (FLAG_HIDDEN_ITEMS_START + 0x00)  // Line 546
#define FLAG_HIDDEN_ITEM_TRICK_HOUSE_NUGGET          (FLAG_HIDDEN_ITEMS_START + 0x01)  // Line 547
#define FLAG_HIDDEN_ITEM_ROUTE_114_CARBOS            (FLAG_HIDDEN_ITEMS_START + 0x04)  // Line 550
```

### Map Definition

Hidden items are defined in `bg_events` arrays in map JSON files:
```json
{
  "type": "hidden_item",
  "x": 10,
  "y": 15,
  "elevation": 0,
  "item": "ITEM_CARBOS",
  "flag": "FLAG_HIDDEN_ITEM_ROUTE_114_CARBOS"
}
```

---

## 3. Breakable Rocks (Rock Smash)

Rocks destroyed using the Rock Smash HM move.

### Graphics Definition

**File:** `include/constants/event_objects.h`
```c
// Line 93
#define OBJ_EVENT_GFX_BREAKABLE_ROCK 86
```

**File:** `src/data/object_events/object_event_graphics_info.h` (Lines 1635-1652)
```c
const struct ObjectEventGraphicsInfo gObjectEventGraphicsInfo_BreakableRock = {
    .tileTag = TAG_NONE,
    .paletteTag = OBJ_EVENT_PAL_TAG_NPC_1,
    .size = 128,
    .width = 16,
    .height = 16,
    .paletteSlot = PALSLOT_NPC_1,
    .shadowSize = SHADOW_SIZE_S,
    .inanimate = TRUE,
    .oam = &gObjectEventBaseOam_16x16,
    .anims = sAnimTable_BreakableRock,
    .images = sPicTable_BreakableRock,
};
```

**Graphics File:** `graphics/object_events/pics/misc/breakable_rock.png`

### Animation

**File:** `src/data/object_events/object_event_anims.h` (Lines 610-618)
```c
static const union AnimCmd sAnim_RockBreak[] = {
    ANIMCMD_FRAME(0, 8),
    ANIMCMD_FRAME(1, 8),
    ANIMCMD_FRAME(2, 8),
    ANIMCMD_FRAME(3, 8),
    ANIMCMD_END,
};
```

**Animation Table:** (Lines 1112-1115)
```c
static const union AnimCmd *const sAnimTable_BreakableRock[] = {
    [ANIM_STAY_STILL] = sAnim_StayStill,
    [ANIM_REMOVE_OBSTACLE] = sAnim_RockBreak,
};
```

### Field Move Implementation

**File:** `src/fldeff_rocksmash.c`

| Function | Line | Purpose |
|----------|------|---------|
| `SetUpFieldMove_RockSmash()` | 121-142 | Check for rock in front of player |
| `FieldCallback_RockSmash()` | 144-148 | Setup callback after party menu |
| `FldEff_UseRockSmash()` | 150-158 | Create field move task |
| `FieldMove_RockSmash()` | 161-166 | Execute rock smash |

**File:** `src/event_object_movement.c` (Lines 6530-6556)

Movement action for rock breaking:
```c
// Step 0: Play breaking animation
bool8 MovementAction_RockSmashBreak_Step0(struct ObjectEvent *objectEvent, struct Sprite *sprite)

// Step 1: Wait for animation
bool8 MovementAction_RockSmashBreak_Step1(struct ObjectEvent *objectEvent, struct Sprite *sprite)

// Step 2: Toggle visibility and hide rock
bool8 MovementAction_RockSmashBreak_Step2(struct ObjectEvent *objectEvent, struct Sprite *sprite)
```

### Scripts

**File:** `data/scripts/field_move_scripts.inc` (Lines 60-104)

```asm
EventScript_RockSmash::
    lockall
    goto_if_unset FLAG_BADGE03_GET, EventScript_CantRockSmash
    checkpartymove MOVE_ROCK_SMASH
    goto_if_eq VAR_RESULT, PARTY_SIZE, EventScript_CantRockSmash
    msgbox Text_WantToRockSmash, MSGBOX_YESNO
    goto_if_eq VAR_RESULT, NO, EventScript_CancelRockSmash
    closemessage
    dofieldeffect FLDEFF_USE_ROCK_SMASH
    waitstate
    goto EventScript_SmashRock
    end

EventScript_SmashRock::
    applymovement VAR_LAST_TALKED, Movement_SmashRock
    waitmovement 0
    removeobject VAR_LAST_TALKED
    specialvar VAR_RESULT, TryStartRockSmashWildBattle
    goto_if_eq VAR_RESULT, TRUE, EventScript_RockSmashWildBattle
    releaseall
    end
```

### Wild Encounters

**File:** `src/wild_encounter.c` (Lines 668-695)
```c
bool8 RockSmashWildEncounter(void)
{
    // Gets rockSmashMonsInfo from current map header
    // Generates wild Pokemon with WILD_AREA_ROCKS type
}
```

### Map Example

**File:** `data/maps/GraniteCave_B2F/map.json`
```json
{
  "graphics_id": "OBJ_EVENT_GFX_BREAKABLE_ROCK",
  "x": 12,
  "y": 43,
  "elevation": 4,
  "movement_type": "MOVEMENT_TYPE_LOOK_AROUND",
  "script": "EventScript_RockSmash",
  "flag": "FLAG_TEMP_11"
}
```

### Constants

**File:** `include/constants/field_effects.h`
```c
// Line 41
#define FLDEFF_USE_ROCK_SMASH 37
```

**File:** `include/constants/event_object_movement.h`
```c
// Line 177
#define MOVEMENT_ACTION_ROCK_SMASH_BREAK 0x5A
```

---

## 4. Cuttable Trees (Cut)

Trees destroyed using the Cut HM move.

### Graphics Definition

**File:** `include/constants/event_objects.h`
```c
// Line 89
#define OBJ_EVENT_GFX_CUTTABLE_TREE 82
```

**File:** `src/data/object_events/object_event_graphics_info.h` (Lines 1559-1576)
```c
const struct ObjectEventGraphicsInfo gObjectEventGraphicsInfo_CuttableTree = {
    .tileTag = TAG_NONE,
    .paletteTag = OBJ_EVENT_PAL_TAG_NPC_3,
    .size = 128,
    .width = 16,
    .height = 16,
    .shadowSize = SHADOW_SIZE_S,
    .inanimate = TRUE,
    .oam = &gObjectEventBaseOam_16x16,
    .anims = sAnimTable_CuttableTree,
    .images = sPicTable_CuttableTree,
};
```

**Graphics File:** `graphics/object_events/pics/misc/cuttable_tree.png`

### Animation

**File:** `src/data/object_events/object_event_anims.h` (Lines 619-626)
```c
static const union AnimCmd sAnim_TreeCut[] = {
    ANIMCMD_FRAME(0, 6),
    ANIMCMD_FRAME(1, 6),
    ANIMCMD_FRAME(2, 6),
    ANIMCMD_FRAME(3, 6),
    ANIMCMD_END,
};
```

### Field Move Implementation

**File:** `src/fldeff_cut.c`

| Function | Line | Purpose |
|----------|------|---------|
| `SetUpFieldMove_Cut()` | 138 | Check for cuttable tree or grass |
| `FldEff_UseCutOnGrass()` | 284 | Handle grass cutting |
| `FldEff_UseCutOnTree()` | 300 | Handle tree cutting |
| `FldEff_CutGrass()` | 316 | Main grass cutting effect |
| `SetCutGrassMetatile()` | 354 | Transform grass tiles |

**Cut Areas:**
- Normal Cut: 3x3 area (`CUT_NORMAL_SIDE = 3`)
- Hyper Cutter ability: 5x5 area (`CUT_HYPER_SIDE = 5`)

### Scripts

**File:** `data/scripts/field_move_scripts.inc` (Lines 2-48)

```asm
EventScript_CutTree::
    lockall
    goto_if_unset FLAG_BADGE01_GET, EventScript_CantCut
    checkpartymove MOVE_CUT
    goto_if_eq VAR_RESULT, PARTY_SIZE, EventScript_CantCut
    msgbox Text_TreeCanBeCut, MSGBOX_YESNO
    goto_if_eq VAR_RESULT, NO, EventScript_CancelCut
    closemessage
    dofieldeffect FLDEFF_USE_CUT_ON_TREE
    waitstate
    applymovement VAR_LAST_TALKED, Movement_CutTreeDown
    waitmovement 0
    removeobject VAR_LAST_TALKED
    releaseall
    end
```

### Grass Cutting Metatile Transformations

**File:** `src/fldeff_cut.c` (Line 354)

| Original Metatile | Transformed To |
|-------------------|----------------|
| `METATILE_General_TallGrass` | `METATILE_General_Grass` |
| `METATILE_General_LongGrass` | `METATILE_General_Grass` |
| `METATILE_Lavaridge_AshGrass` | `METATILE_Lavaridge_LavaField` |
| `METATILE_Fallarbor_AshGrass` | `METATILE_Fallarbor_AshField` |

### Cuttable Grass Detection

**File:** `src/metatile_behavior.c` (Line 1269)
```c
bool8 MetatileBehavior_IsCuttableGrass(u8 metatileBehavior)
{
    // Checks for MB_TALL_GRASS, MB_LONG_GRASS, MB_ASHGRASS, MB_LONG_GRASS_SOUTH_EDGE
}
```

### Constants

**File:** `include/constants/field_effects.h`
```c
#define FLDEFF_USE_CUT_ON_GRASS  1   // Line 1
#define FLDEFF_USE_CUT_ON_TREE   2   // Line 2
#define FLDEFF_CUT_GRASS         58  // Line 62
```

---

## 5. Strength Boulders

Pushable rocks using the Strength HM move.

### Graphics Definition

**File:** `include/constants/event_objects.h`
```c
// Line 94
#define OBJ_EVENT_GFX_PUSHABLE_BOULDER 87
```

**File:** `src/data/object_events/object_event_graphics_info.h` (Lines 1654-1671)
```c
const struct ObjectEventGraphicsInfo gObjectEventGraphicsInfo_PushableBoulder = {
    .size = 128,
    .width = 16,
    .height = 16,
    .inanimate = TRUE,
    .shadowSize = SHADOW_SIZE_S,
    // ...
};
```

### Field Move Implementation

**File:** `src/fldeff_strength.c`

| Function | Line | Purpose |
|----------|------|---------|
| `SetUpFieldMove_Strength()` | 18-28 | Check for boulder in front |
| `FieldCallback_Strength()` | 30-34 | Setup strength script |
| `FldEff_UseStrength()` | 36-43 | Create field move task |
| `StartStrengthFieldEffect()` | 45-50 | Enable script execution |

### Push Detection & Movement

**File:** `src/field_player_avatar.c`

**TryPushBoulder()** (Lines 748-768):
```c
static bool8 TryPushBoulder(s16 x, s16 y, u8 direction)
{
    if (FlagGet(FLAG_SYS_USE_STRENGTH))  // Check Strength active
    {
        u8 objectEventId = GetObjectEventIdByXY(x, y);
        if (objectEventId != OBJECT_EVENTS_COUNT
         && gObjectEvents[objectEventId].graphicsId == OBJ_EVENT_GFX_PUSHABLE_BOULDER)
        {
            // Check destination passable
            // StartStrengthAnim() if valid
        }
    }
}
```

**Push Animation Task** (Lines 1469-1532):
```c
static void StartStrengthAnim(u8 objectEventId, u8 direction)
{
    u8 taskId = CreateTask(Task_PushBoulder, 0xFF);
    gTasks[taskId].tBoulderObjId = objectEventId;
    gTasks[taskId].tDirection = direction;
}
```

**Push States:**
1. `PushBoulder_Start()` (Lines 1486-1492) - Lock controls
2. `PushBoulder_Move()` (Lines 1494-1518) - Execute push, create dust effect, play sound
3. `PushBoulder_End()` (Lines 1520-1532) - Unlock controls

### Scripts

**File:** `data/scripts/field_move_scripts.inc` (Lines 124-160)

```asm
EventScript_StrengthBoulder::
    lockall
    goto_if_unset FLAG_BADGE04_GET, EventScript_CantStrength
    goto_if_set FLAG_SYS_USE_STRENGTH, EventScript_CheckActivatedBoulder
    checkpartymove MOVE_STRENGTH
    goto_if_eq VAR_RESULT, PARTY_SIZE, EventScript_CantStrength
    msgbox Text_WantToStrength, MSGBOX_YESNO
    goto_if_eq VAR_RESULT, NO, EventScript_CancelStrength
    closemessage
    dofieldeffect FLDEFF_USE_STRENGTH
    waitstate
    goto EventScript_ActivateStrength
    end

EventScript_ActivateStrength::
    setflag FLAG_SYS_USE_STRENGTH
    msgbox Text_MonUsedStrength, MSGBOX_DEFAULT
    releaseall
    end
```

### Position Tracking

Boulder positions are tracked in the `ObjectEvent` structure:

**File:** `include/global.fieldmap.h` (Lines 185-246)
```c
struct ObjectEvent {
    struct Coords16 initialCoords;    // Original position
    struct Coords16 currentCoords;    // Current position (updated when pushed)
    struct Coords16 previousCoords;   // Previous position
};
```

### Map Examples

**File:** `data/maps/SeafloorCavern_Room8/map.json` - 10 boulders (major puzzle)
**File:** `data/maps/VictoryRoad_B1F/map.json` - Multiple boulder puzzles

### Constants

**File:** `include/constants/field_effects.h`
```c
// Line 44
#define FLDEFF_USE_STRENGTH 40
```

**File:** `include/global.fieldmap.h`
```c
// Line 308
#define COLLISION_PUSHED_BOULDER
```

---

## 6. Berry Trees

Plantable trees that grow berries over time.

### Data Structure

**File:** `include/global.berry.h` (Lines 63-75)
```c
struct BerryTree
{
    u8 berry;                    // Berry type planted
    u8 stage:7;                  // Growth stage (0-5)
    u8 stopGrowth:1;             // Pause until seen
    u16 minutesUntilNextStage;   // Time to next stage
    u8 berryYield;               // Number of berries
    u8 regrowthCount:4;          // Regrowth cycles
    u8 watered1:1;               // Stage 1 watered
    u8 watered2:1;               // Stage 2 watered
    u8 watered3:1;               // Stage 3 watered
    u8 watered4:1;               // Stage 4 watered
};
```

**File:** `include/global.berry.h` (Lines 7-23)
```c
struct Berry
{
    const u8 name[BERRY_NAME_LENGTH + 1];
    u8 firmness;
    u16 size;
    u8 maxYield;       // Maximum berries per tree
    u8 minYield;       // Minimum berries per tree
    const u8 *description1;
    const u8 *description2;
    u8 stageDuration;  // Minutes per growth stage
    u8 spicy, dry, sweet, bitter, sour;
    u8 smoothness;
};
```

### Growth Stages

**File:** `include/constants/berry.h` (Lines 20-26)
```c
#define BERRY_STAGE_NO_BERRY   0   // Empty soil
#define BERRY_STAGE_PLANTED    1   // Just planted
#define BERRY_STAGE_SPROUTED   2   // Sprout appeared
#define BERRY_STAGE_TALLER     3   // Growing taller
#define BERRY_STAGE_FLOWERING  4   // Flowers blooming
#define BERRY_STAGE_BERRIES    5   // Ready to harvest
#define BERRY_STAGE_SPARKLING  255 // Special animation
```

### Core Functions

**File:** `src/berry.c`

| Function | Line | Purpose |
|----------|------|---------|
| `GetBerryTreeInfo()` | 994-997 | Get tree data from SaveBlock |
| `BerryTreeGrow()` | 1048-1076 | Advance growth stage |
| `BerryTreeTimeUpdate()` | 1078-1114 | Update all tree timers |
| `PlantBerryTree()` | 1116-1134 | Initialize new tree |
| `RemoveBerryTree()` | 1136-1139 | Clear tree data |
| `CalcBerryYield()` | 1210-1243 | Calculate harvest amount |
| `ObjectEventInteractionGetBerryTreeData()` | 1255-1276 | Get display data |
| `ObjectEventInteractionPlantBerryTree()` | 1297-1303 | Plant from item |
| `ObjectEventInteractionPickBerryTree()` | 1305-1311 | Harvest berries |
| `SetBerryTreesSeen()` | 1326-1353 | Allow growth for visible trees |

### Graphics System

**File:** `src/data/object_events/berry_tree_graphics_tables.h`

- **Frame tables** (Lines 1-420): Sprite images for each berry type
- **Palette tables** (Lines 13+): Palette slots per growth stage
- **Graphics ID tables** (Lines 421-423): Stage-based graphics switching
- **Lookup tables** (Lines 425-565): Maps berry items to graphics

### Movement Type

**File:** `src/event_object_movement.c` (Lines 3071-3182)

```c
#define BERRY_FLAG_SET_GFX    (1 << 0)  // Graphics initialized
#define BERRY_FLAG_SPARKLING  (1 << 1)  // Currently sparkling
#define BERRY_FLAG_JUST_PICKED (1 << 2) // Recently harvested

// State machine functions:
MovementType_BerryTreeGrowth()       // Line 3075 - Main update
SetBerryTreeGraphics()               // Line 1890 - Set graphics by stage
```

**Berry Tree States:**
- `BERRYTREEFUNC_NORMAL` - Idle or visibility control
- `BERRYTREEFUNC_MOVE` - Tree appearing animation
- `BERRYTREEFUNC_SPARKLE_START` - Begin sparkle effect
- `BERRYTREEFUNC_SPARKLE` - Blinking animation (64 frames)
- `BERRYTREEFUNC_SPARKLE_END` - Fade sparkle (64 frames)

### Scripts

**File:** `data/scripts/berry_tree.inc` (251 lines)

```asm
BerryTreeScript::
    special ObjectEventInteractionGetBerryTreeData
    switch VAR_0x8004
    case BERRY_STAGE_SPARKLING, BerryTree_EventScript_Sparkling
    case BERRY_STAGE_NO_BERRY, BerryTree_EventScript_CheckSoil
    case BERRY_STAGE_PLANTED, BerryTree_EventScript_CheckBerryStage1
    case BERRY_STAGE_SPROUTED, BerryTree_EventScript_CheckBerryStage2
    case BERRY_STAGE_TALLER, BerryTree_EventScript_CheckBerryStage3
    case BERRY_STAGE_FLOWERING, BerryTree_EventScript_CheckBerryStage4
    case BERRY_STAGE_BERRIES, BerryTree_EventScript_CheckBerryFullyGrown
    end
```

### Storage

**File:** `include/global.h` (Line 1169)
```c
struct BerryTree berryTrees[BERRY_TREES_COUNT];  // 128 trees in SaveBlock1
```

### Tree Locations

**File:** `include/constants/berry.h` (Lines 38-130)
```c
#define BERRY_TREE_ROUTE_102_PECHA  1
#define BERRY_TREE_ROUTE_102_ORAN   2
// ... 128 total tree locations
#define BERRY_TREES_COUNT           128
```

---

## 7. Kecleon (Invisible Pokemon)

Invisible Pokemon revealed by the Devon Scope item.

### Object Event Definition

**File:** `include/constants/event_objects.h`
```c
#define OBJ_EVENT_GFX_KECLEON              204
#define OBJ_EVENT_GFX_KECLEON_DOLL         160
#define OBJ_EVENT_GFX_KECLEON_BRIDGE_SHADOW 212
```

### Map Locations

**File:** `data/maps/Route120/map.json` (Lines 410-567)
- Bridge Kecleon at (12, 16)
- 5 additional Kecleon at various positions

**File:** `data/maps/Route119/map.json` (Lines 473-497)
- 2 Kecleon locations

**File:** `data/maps/FortreeCity/map.json` (Lines 106-118)
- City Kecleon blocking gym entrance

### Map Definition
```json
{
  "graphics_id": "OBJ_EVENT_GFX_KECLEON",
  "x": 12,
  "y": 16,
  "elevation": 4,
  "movement_type": "MOVEMENT_TYPE_INVISIBLE",
  "script": "Route120_EventScript_Kecleon",
  "flag": "FLAG_HIDE_ROUTE_120_KECLEON_BRIDGE"
}
```

### Devon Scope Item

**File:** `include/constants/items.h`
```c
// Line 322
#define ITEM_DEVON_SCOPE 288
```

**File:** `src/data/items.h` (Lines 3502-3512)
```c
[ITEM_DEVON_SCOPE] = {
    .name = _("DEVON SCOPE"),
    .price = 0,
    .importance = 1,
    .pocket = POCKET_KEY_ITEMS,
    .type = ITEM_USE_BAG_MENU,
    .fieldUseFunc = ItemUseOutOfBattle_CannotUse,
}
```

### Reveal Animation

**File:** `data/scripts/kecleon.inc` (Lines 89-111)
```asm
Movement_KecleonAppears:
    set_visible
    delay_4
    set_invisible
    delay_4
    set_visible
    delay_4
    set_invisible
    delay_4
    set_visible
    delay_8
    set_invisible
    delay_8
    set_visible
    delay_8
    set_invisible
    delay_8
    set_visible
    delay_16
    set_invisible
    delay_16
    set_visible
    step_end
```

### Interaction Script

**File:** `data/scripts/kecleon.inc` (Lines 50-88)
```asm
EventScript_Kecleon::
    lock
    faceplayer
    checkitem ITEM_DEVON_SCOPE
    goto_if_eq VAR_RESULT, FALSE, EventScript_KecleonNoScope
    msgbox Text_WantToUseDevonScope, MSGBOX_YESNO
    goto_if_eq VAR_RESULT, NO, EventScript_KecleonDeclined
    closemessage
    applymovement VAR_LAST_TALKED, Movement_KecleonAppears
    waitmovement 0
    playmoncry SPECIES_KECLEON, CRY_MODE_ENCOUNTER
    waitmoncry
    setflag FLAG_SYS_CTRL_OBJ_DELETE
    setwildbattle SPECIES_KECLEON, 30
    dowildbattle
    // Handle battle outcome...
```

### Visibility Flags

**File:** `include/constants/flags.h`
```c
#define FLAG_RECEIVED_DEVON_SCOPE              0x11D
#define FLAG_HIDE_FORTREE_CITY_KECLEON         0x3C9
#define FLAG_HIDE_ROUTE_120_KECLEON_BRIDGE     0x3CA
#define FLAG_HIDE_ROUTE_120_KECLEON_1          0x3D6
#define FLAG_HIDE_ROUTE_119_KECLEON_1          0x3DD
#define FLAG_KECLEON_FLED_FORTREE              0x127
```

### Movement Type

**File:** `include/constants/event_object_movement.h`
```c
// Line 0x4C
#define MOVEMENT_TYPE_INVISIBLE 0x4C
```

---

## 8. Secret Base Entrances

Trees, shrubs, and caves that can become Secret Bases.

### Entrance Types

**File:** `include/constants/secret_bases.h` (Lines 1-172)
```c
#define SECRET_BASE_RED_CAVE     // 4 locations
#define SECRET_BASE_BROWN_CAVE   // 4 locations
#define SECRET_BASE_BLUE_CAVE    // 4 locations
#define SECRET_BASE_YELLOW_CAVE  // 4 locations
#define SECRET_BASE_TREE         // 4 locations
#define SECRET_BASE_SHRUB        // 4 locations
```

### Metatile Behaviors

**File:** `include/constants/metatile_behaviors.h` (Lines 149-162)
```c
#define MB_SECRET_BASE_SPOT_RED_CAVE         0x95
#define MB_SECRET_BASE_SPOT_RED_CAVE_OPEN    0x96
#define MB_SECRET_BASE_SPOT_BROWN_CAVE       0x97
#define MB_SECRET_BASE_SPOT_BROWN_CAVE_OPEN  0x98
#define MB_SECRET_BASE_SPOT_TREE_LEFT        0xA1
#define MB_SECRET_BASE_SPOT_TREE_LEFT_OPEN   0xA2
#define MB_SECRET_BASE_SPOT_SHRUB            0xA5
#define MB_SECRET_BASE_SPOT_SHRUB_OPEN       0xA6
```

### Metatile Labels

**File:** `include/constants/metatile_labels.h` (Lines 202-239)
```c
#define METATILE_General_SecretBase_TreeLeft   0x026
#define METATILE_General_SecretBase_TreeRight  0x027
#define METATILE_General_SecretBase_VineLeft   0x036  // Opened tree
#define METATILE_General_SecretBase_VineRight  0x037
#define METATILE_Fortree_SecretBase_Shrub      0x271
#define METATILE_Fortree_SecretBase_ShrubOpen  0x278
```

### Field Effects

**File:** `include/constants/field_effects.h`
```c
#define FLDEFF_USE_SECRET_POWER_CAVE  11   // Line 15
#define FLDEFF_USE_SECRET_POWER_TREE  26   // Line 26
#define FLDEFF_USE_SECRET_POWER_SHRUB 27   // Line 27
#define FLDEFF_SECRET_POWER_CAVE      55   // Line 59
#define FLDEFF_SECRET_POWER_TREE      56   // Line 60
#define FLDEFF_SECRET_POWER_SHRUB     57   // Line 61
```

### Implementation

**File:** `src/fldeff_misc.c`

| Function | Line | Purpose |
|----------|------|---------|
| `SetUpFieldMove_SecretPower()` | 547 | Check for valid entrance |
| `SetCurrentSecretBase()` | 493 | Set current base ID |
| `FieldCallback_SecretBaseCave()` | 586 | Cave entrance callback |
| `FieldCallback_SecretBaseTree()` | 646 | Tree entrance callback |
| `FieldCallback_SecretBaseShrub()` | 720 | Shrub entrance callback |
| `FldEff_UseSecretPowerCave()` | 592 | Cave field effect |
| `FldEff_UseSecretPowerTree()` | 652 | Tree field effect |
| `SpriteCB_CaveEntranceInit()` | 618 | Cave sprite animation |
| `SpriteCB_TreeEntranceInit()` | 691 | Tree sprite animation |
| `SpriteCB_ShrubEntranceInit()` | 754 | Shrub sprite animation |

**File:** `src/secret_base.c`

| Function | Line | Purpose |
|----------|------|---------|
| `GetSecretBaseTypeInFrontOfPlayer_()` | 267 | Detect entrance type |
| `CheckPlayerHasSecretBase()` | 258 | Check if player owns a base |
| `SetPlayerSecretBase()` | 365 | Create player's base |
| `ToggleSecretBaseEntranceMetatile()` | 321 | Open/close entrance |
| `EnterSecretBase()` | 446 | Enter a base |
| `WarpIntoSecretBase()` | 674 | Warp into base interior |
| `InitSecretBaseAppearance()` | 519 | Setup base appearance |

### Map Definition

**File:** `data/maps/Route119/map.json` (bg_events)
```json
{
  "type": "secret_base",
  "x": 5,
  "y": 2,
  "elevation": 0,
  "secret_base_id": "SECRET_BASE_SHRUB1_1"
}
```

### Scripts

**File:** `data/scripts/secret_base.inc`
```asm
SecretBase_EventScript_CheckEntrance::  // Line 27
SecretBase_EventScript_Cave::           // Line 42
SecretBase_EventScript_Tree::           // Line 72
SecretBase_EventScript_Shrub::          // Line 102
SecretBase_EventScript_FirstEntrance::  // Line 146
```

### Graphics Files

```
graphics/field_effects/pics/secret_power_cave.png
graphics/field_effects/pics/secret_power_tree.png
graphics/field_effects/pics/secret_power_shrub.png
graphics/field_effects/palettes/secret_power_cave.pal
graphics/field_effects/palettes/secret_power_plant.pal
```

---

## 9. Dive Spots

Underwater entry/exit points using the Dive HM move.

### Metatile Behaviors

**File:** `include/constants/metatile_behaviors.h`
```c
#define MB_INTERIOR_DEEP_WATER    0x16   // Line 22
#define MB_DEEP_WATER             0x17   // Line 23
#define MB_SOOTOPOLIS_DEEP_WATER  0x19   // Line 25
```

### Field Effects

**File:** `include/constants/field_effects.h`
```c
#define FLDEFF_USE_DIVE        48   // Line 48
#define FLDEFF_WATER_SURFACING 26   // Line 26
```

### Implementation

**File:** `src/field_effect.c`

| Function | Line | Purpose |
|----------|------|---------|
| `FldEff_UseDive()` | 1902 | Main dive effect |
| `DiveFieldEffect_Init()` | 1917 | Initialize dive |
| `DiveFieldEffect_ShowMon()` | 1924 | Show Pokemon animation |
| `DiveFieldEffect_TryWarp()` | 1933 | Warp to underwater map |

**File:** `src/field_control_avatar.c`

| Function | Line | Purpose |
|----------|------|---------|
| `TryDoDiveWarp()` | 940 | Handle dive warp logic |
| `TrySetDiveWarp()` | 965 | Check if dive possible |

**File:** `src/metatile_behavior.c`

| Function | Line | Purpose |
|----------|------|---------|
| `MetatileBehavior_IsDiveable()` | 853 | Check diveable tiles |
| `MetatileBehavior_IsUnableToEmerge()` | 863 | Check emergence restrictions |

**File:** `src/overworld.c`

| Function | Line | Purpose |
|----------|------|---------|
| `SetDiveWarpEmerge()` | 774 | Setup emerging warp |
| `SetDiveWarpDive()` | 779 | Setup diving warp |

### Scripts

**File:** `data/scripts/field_move_scripts.inc`
```asm
EventScript_UseDive::           // Line 218
EventScript_UseDiveUnderwater:: // Line 241 - Surface from underwater
```

---

## 10. Waterfall Spots

Climbable waterfalls using the Waterfall HM move.

### Metatile Behavior

**File:** `include/constants/metatile_behaviors.h`
```c
#define MB_WATERFALL 0x18   // Line 24
```

### Field Effect

**File:** `include/constants/field_effects.h`
```c
#define FLDEFF_USE_WATERFALL 47   // Line 47
```

### Implementation

**File:** `src/field_effect.c`

| Function | Line | Purpose |
|----------|------|---------|
| `FldEff_UseWaterfall()` | 1828 | Main waterfall effect |
| `Task_UseWaterfall()` | 1837 | Task handler |
| `WaterfallFieldEffect_Init()` | 1842 | Initialize state |
| `WaterfallFieldEffect_ShowMon()` | 1850 | Show Pokemon |
| `WaterfallFieldEffect_WaitForShowMon()` | 1863 | Wait for animation |
| `WaterfallFieldEffect_RideUp()` | 1873 | Move player upward |
| `WaterfallFieldEffect_ContinueRideOrEnd()` | 1880 | Continue or finish |

**File:** `src/metatile_behavior.c`
```c
// Line 995
bool8 MetatileBehavior_IsWaterfall(u8 metatileBehavior)
```

### Scripts

**File:** `data/scripts/field_move_scripts.inc`
```asm
EventScript_UseWaterfall::       // Line 185
EventScript_CannotUseWaterfall:: // Line 197
```

---

## 11. Surf Interaction

Water traversal using the Surf HM move.

### Metatile Behaviors

**File:** `include/constants/metatile_behaviors.h`
```c
#define MB_POND_WATER           0x15   // Line 21
#define MB_OCEAN_WATER          0x1A   // Line 26
#define MB_DEEP_WATER           0x17   // Line 23
#define MB_SOOTOPOLIS_DEEP_WATER 0x19  // Line 25
#define MB_SHALLOW_WATER        0x1B   // Line 27
```

### Field Effects

**File:** `include/constants/field_effects.h`
```c
#define FLDEFF_SURF_BLOB  8   // Line 8 - The water blob sprite
#define FLDEFF_USE_SURF   9   // Line 9
```

### Implementation

**File:** `src/field_effect.c`

| Function | Line | Purpose |
|----------|------|---------|
| `FldEff_UseSurf()` | 2985 | Main surf effect |
| `Task_SurfFieldEffect()` | 3002 | Task handler |
| `SurfFieldEffect_Init()` | 3007 | Initialize |
| `SurfFieldEffect_FieldMovePose()` | 3018 | Field move pose |
| `SurfFieldEffect_ShowMon()` | 3030 | Show Pokemon |
| `SurfFieldEffect_JumpOnSurfBlob()` | 3042 | Jump onto water blob |

**File:** `src/field_effect_helpers.c`

| Function | Line | Purpose |
|----------|------|---------|
| `UpdateSurfBlobFieldEffect()` | 1052 | Update surf blob sprite |
| `SynchroniseSurfAnim()` | 1062 | Sync animation with direction |
| `SynchroniseSurfPosition()` | 1081 | Keep blob synced with player |
| `UpdateBobbingEffect()` | 1107 | Water bobbing animation |
| `StartUnderwaterSurfBlobBobbing()` | 1150 | Underwater bobbing |

### Surf Blob Sprite

**File:** `src/data/field_effects/field_effect_objects.h`
```c
// Line 211
const struct SpriteTemplate gFieldEffectObjectTemplate_SurfBlob
```

### Scripts

**File:** `data/scripts/surf.inc`
```asm
EventScript_UseSurf::   // Line 1
```

---

## 12. Water Currents

Tiles that push the player in a direction while surfing.

### Metatile Behaviors

**File:** `include/constants/metatile_behaviors.h`
```c
#define MB_EASTWARD_CURRENT   0x55   // Line 85
#define MB_WESTWARD_CURRENT   0x56   // Line 86
#define MB_NORTHWARD_CURRENT  0x57   // Line 87
#define MB_SOUTHWARD_CURRENT  0x58   // Line 88
```

### Implementation

**File:** `src/metatile_behavior.c` (Lines 411-435)

Current direction handlers check metatile behavior and apply forced movement in the corresponding direction.

---

## Key File Summary

| Category | Key Files |
|----------|-----------|
| **Graphics Constants** | `include/constants/event_objects.h` |
| **Graphics Info** | `src/data/object_events/object_event_graphics_info.h` |
| **Graphics Data** | `src/data/object_events/object_event_graphics.h` |
| **Field Effects** | `include/constants/field_effects.h` |
| **Metatile Behaviors** | `include/constants/metatile_behaviors.h` |
| **Field Move Scripts** | `data/scripts/field_move_scripts.inc` |
| **Berry Scripts** | `data/scripts/berry_tree.inc` |
| **Kecleon Scripts** | `data/scripts/kecleon.inc` |
| **Secret Base Scripts** | `data/scripts/secret_base.inc` |
| **Item Ball Scripts** | `data/scripts/item_ball_scripts.inc` |
| **Field Effect Impl** | `src/field_effect.c`, `src/fldeff_*.c` |
| **Movement System** | `src/event_object_movement.c` |
| **Metatile Checks** | `src/metatile_behavior.c` |
| **Player Avatar** | `src/field_player_avatar.c` |
| **Berry System** | `src/berry.c` |
| **Secret Base System** | `src/secret_base.c` |
