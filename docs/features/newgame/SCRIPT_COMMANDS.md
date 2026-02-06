---
title: Script Commands Reference
status: reference
last_verified: 2026-01-13
---

# Script Commands Reference

This document explains how to read and understand Pokemon Emerald's event scripts (.inc files).

## Script File Structure

Scripts are written in GAS (GNU Assembler) macro format. The game compiles these to bytecode.

### Basic Script Format

```asm
ScriptLabel::                    @ Label (:: = global, : = local)
    command1 arg1, arg2          @ Commands with arguments
    command2 arg
    end                          @ Terminate script
```

## Flow Control Commands

### End and Return

```asm
end                              @ Terminate script execution
return                           @ Return from call (back to caller)
```

### Goto and Call

```asm
goto Label                       @ Jump to label (no return)
call Label                       @ Jump to label (can return)
```

### Conditional Jumps

```asm
@ Compare first, then branch
compare VAR_NAME, value
goto_if_eq Label                 @ Jump if equal
goto_if_ne Label                 @ Jump if not equal
goto_if_lt Label                 @ Jump if less than
goto_if_le Label                 @ Jump if less or equal
goto_if_gt Label                 @ Jump if greater than
goto_if_ge Label                 @ Jump if greater or equal

@ Combined compare + jump
goto_if_eq VAR_NAME, value, Label
call_if_eq VAR_NAME, value, Label
```

### Flag Conditionals

```asm
goto_if_set FLAG_NAME, Label     @ Jump if flag is TRUE
goto_if_unset FLAG_NAME, Label   @ Jump if flag is FALSE
call_if_set FLAG_NAME, Label
call_if_unset FLAG_NAME, Label
```

## Variable Commands

### Set/Copy

```asm
setvar VAR_NAME, value           @ Set to constant
copyvar VAR_DEST, VAR_SRC        @ Copy from another var
addvar VAR_NAME, value           @ Add value
subvar VAR_NAME, value           @ Subtract value
```

### Special Variables

| Variable | Purpose |
|----------|---------|
| `VAR_RESULT` | Return value from specials |
| `VAR_0x8000` - `VAR_0x800F` | Temporary variables |
| `VAR_FACING` | Player facing direction |
| `LOCALID_PLAYER` | Player object ID |

## Flag Commands

```asm
setflag FLAG_NAME                @ Set flag TRUE
clearflag FLAG_NAME              @ Set flag FALSE
checkflag FLAG_NAME              @ Result in VAR_RESULT
```

## Message Commands

### Display Messages

```asm
msgbox TextLabel, MSGBOX_TYPE    @ Show message box

@ Message types:
@ MSGBOX_DEFAULT    - Standard message, press A to continue
@ MSGBOX_NPC        - NPC dialogue (lock, message, release)
@ MSGBOX_SIGN       - Sign/object examination
@ MSGBOX_YESNO      - Yes/No choice, result in VAR_RESULT
```

### Message Control

```asm
message TextLabel                @ Start message without wait
waitmessage                      @ Wait for message to finish
closemessage                     @ Close message box
```

## Object/NPC Commands

### Lock and Release

```asm
lock                             @ Lock player, face speaker
lockall                          @ Lock all NPCs and player
release                          @ Release locked player
releaseall                       @ Release all locks
faceplayer                       @ NPC faces player
```

### Object Visibility

```asm
addobject LOCALID                @ Show hidden object
removeobject LOCALID             @ Hide object
```

### Object Properties

```asm
setobjectxy LOCALID, X, Y        @ Set object position
setobjectxyperm LOCALID, X, Y    @ Set permanent position
setobjectmovementtype LOCALID, TYPE
turnobject LOCALID, DIRECTION    @ DIR_UP/DOWN/LEFT/RIGHT
```

## Movement Commands

### Apply Movement

```asm
applymovement LOCALID, MovementLabel
waitmovement 0                   @ Wait for all movements
waitmovement LOCALID             @ Wait for specific object
```

### Movement Data Format

```asm
MovementLabel:
    walk_down
    walk_up
    walk_left
    walk_right
    walk_fast_down               @ Running speed
    walk_slow_down               @ Slow walk
    walk_in_place_faster_down    @ Turn in place
    face_down                    @ Just change facing
    delay_16                     @ Wait 16 frames
    step_end                     @ END MARKER (required!)
```

### Common Movement Macros

| Macro | Effect |
|-------|--------|
| `walk_down/up/left/right` | Walk one tile |
| `walk_fast_*` | Run one tile |
| `walk_slow_*` | Slow walk one tile |
| `walk_in_place_faster_*` | Turn in place (fast) |
| `face_*` | Change facing direction |
| `delay_1/2/4/8/16` | Pause for N frames |
| `step_end` | End movement data |

### Common Movement Labels

```asm
Common_Movement_FacePlayer       @ NPC faces player
Common_Movement_WalkInPlaceFasterUp
Common_Movement_WalkInPlaceFasterDown
Common_Movement_WalkInPlaceFasterLeft
Common_Movement_WalkInPlaceFasterRight
Common_Movement_ExclamationMark  @ Show ! emote
Common_Movement_QuestionMark     @ Show ? emote
Common_Movement_Delay48          @ 48 frame delay
```

## Warp Commands

```asm
warp MAP_NAME, X, Y              @ Warp to map position
warp MAP_NAME, WARP_ID           @ Warp to map warp point
waitstate                        @ Wait for warp to complete
```

## Special Functions

```asm
special FunctionName             @ Call C function (no return value)
specialvar VAR_NAME, FunctionName @ Call and store result
waitstate                        @ Wait for special to complete
```

### Common Specials

| Special | Purpose |
|---------|---------|
| `ChooseStarter` | Starter selection screen |
| `HealPlayerParty` | Heal all Pokemon |
| `StartWallClock` | Clock setting interface |
| `GetPlayerGender` | Get gender to VAR_RESULT |

## Sound Commands

```asm
playse SE_NAME                   @ Play sound effect
waitse                           @ Wait for sound to finish
playbgm MUS_NAME, TRUE/FALSE     @ Play background music
fadedefaultbgm                   @ Fade to default BGM
playfanfare MUS_NAME             @ Play fanfare
waitfanfare                      @ Wait for fanfare
playmoncry SPECIES, CRY_MODE_NORMAL
waitmoncry                       @ Wait for cry
```

## Screen Effects

```asm
fadescreen FADE_TO_BLACK         @ Fade out
fadescreen FADE_FROM_BLACK       @ Fade in
delay FRAMES                     @ Wait N frames
```

## Metatile Commands

```asm
setmetatile X, Y, METATILE_ID, COLLISION
@ Change map tile at position
@ COLLISION: TRUE = solid, FALSE = passable
```

## Gender Checking Pattern

```asm
checkplayergender
call_if_eq VAR_RESULT, MALE, MaleScript
call_if_eq VAR_RESULT, FEMALE, FemaleScript
```

## Complete Script Example

```asm
@ NPC who gives the player an item
ExampleNPC_EventScript::
    lock
    faceplayer
    goto_if_set FLAG_RECEIVED_ITEM, ExampleNPC_AlreadyGave
    msgbox ExampleNPC_Text_HereHaveThis, MSGBOX_DEFAULT
    giveitem ITEM_POTION
    goto_if_eq VAR_RESULT, FALSE, ExampleNPC_NoBagSpace
    setflag FLAG_RECEIVED_ITEM
    msgbox ExampleNPC_Text_UseItWell, MSGBOX_DEFAULT
    release
    end

ExampleNPC_AlreadyGave::
    msgbox ExampleNPC_Text_HowIsIt, MSGBOX_DEFAULT
    release
    end

ExampleNPC_NoBagSpace::
    msgbox ExampleNPC_Text_BagFull, MSGBOX_DEFAULT
    release
    end

ExampleNPC_Text_HereHaveThis:
    .string "Here, have this!$"

ExampleNPC_Text_UseItWell:
    .string "Use it well!$"

ExampleNPC_Text_HowIsIt:
    .string "How's that item treating you?$"

ExampleNPC_Text_BagFull:
    .string "Your bag is full...$"
```

## Map Script Types

### MAP_SCRIPT_ON_LOAD
Runs when map tiles are loaded. Used for:
- Setting metatiles (visual changes)
- Map-wide setup

### MAP_SCRIPT_ON_TRANSITION
Runs when entering map, before screen fades in. Used for:
- Positioning NPCs
- Setting object properties

### MAP_SCRIPT_ON_FRAME_TABLE
Checks conditions each frame. Format:
```asm
MapName_OnFrame:
    map_script_2 VAR_NAME, VALUE, ScriptLabel
    .2byte 0
```

### MAP_SCRIPT_ON_WARP_INTO_MAP_TABLE
Similar to ON_FRAME but only on warp. Good for one-time setup per entry.

## Text Formatting

```asm
@ Text commands
{PLAYER}         @ Player's name
{RIVAL}          @ Rival's name
{STR_VAR_1}      @ Buffer 1 contents
{STR_VAR_2}      @ Buffer 2
{STR_VAR_3}      @ Buffer 3
\n               @ New line (continue same box)
\l               @ New line (scroll existing text up)
\p               @ New paragraph (new text box)
$                @ End of string (required!)
```
