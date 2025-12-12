# NPC Movement Types

This document details all NPC movement behaviors from Pokemon Emerald's `event_object_movement.c`.

## Overview

The GBA uses a state machine approach for NPC movement. Each movement type has a series of "steps" (state functions) that execute in sequence. The `sTypeFuncId` field on the sprite tracks the current state.

### Timing Constants

Movement delays are in **game frames** (60fps = ~16.67ms per frame):

```c
sMovementDelaysShort[]  = {32, 48,  64,  80};   // 0.53-1.33 seconds
sMovementDelaysMedium[] = {32, 64,  96, 128};   // 0.53-2.13 seconds
sMovementDelaysLong[]   = {32, 64, 128, 192};   // Unused
```

A random delay from the array is chosen each time an NPC finishes an action.

---

## Movement Type Categories

### 1. Static Types (No Movement)

#### MOVEMENT_TYPE_NONE (0x00)
- Does nothing, just exists
- Used for scripted objects

#### MOVEMENT_TYPE_FACE_UP/DOWN/LEFT/RIGHT (0x07-0x0A)
- Faces a fixed direction permanently
- Initial direction based on type name
- State machine:
  1. `Step0`: Clear movement, set facing animation
  2. `Step1`: Execute face action
  3. `Step2`: Done, stay idle

#### MOVEMENT_TYPE_INVISIBLE (0x4C)
- Hidden from view
- Used for scripted triggers

---

### 2. Looking Types (Face Different Directions)

#### MOVEMENT_TYPE_LOOK_AROUND (0x01)
- Randomly looks in any of 4 directions
- Uses `sMovementDelaysMedium` between looks
- State machine:
  1. `Step0`: Clear movement state
  2. `Step1`: Set facing animation
  3. `Step2`: Execute face, then set random delay
  4. `Step3`: Wait for delay (or trainer interrupt)
  5. `Step4`: Pick random direction, go to Step1

#### MOVEMENT_TYPE_FACE_DOWN_AND_UP (0x0D)
- Alternates between down and up only
- Uses `sMovementDelaysMedium`

#### MOVEMENT_TYPE_FACE_LEFT_AND_RIGHT (0x0E)
- Alternates between left and right only

#### MOVEMENT_TYPE_FACE_UP_AND_LEFT (0x0F)
- Looks up or left only

#### MOVEMENT_TYPE_FACE_UP_AND_RIGHT (0x10)
- Looks up or right only

#### MOVEMENT_TYPE_FACE_DOWN_AND_LEFT (0x11)
#### MOVEMENT_TYPE_FACE_DOWN_AND_RIGHT (0x12)
#### MOVEMENT_TYPE_FACE_DOWN_UP_AND_LEFT (0x13)
#### MOVEMENT_TYPE_FACE_DOWN_UP_AND_RIGHT (0x14)
#### MOVEMENT_TYPE_FACE_UP_LEFT_AND_RIGHT (0x15)
#### MOVEMENT_TYPE_FACE_DOWN_LEFT_AND_RIGHT (0x16)

All use `sMovementDelaysShort` (faster than LOOK_AROUND).

#### MOVEMENT_TYPE_ROTATE_COUNTERCLOCKWISE (0x17)
- Rotates: South → East → North → West → South
- Fixed 48-frame delay between rotations

#### MOVEMENT_TYPE_ROTATE_CLOCKWISE (0x18)
- Rotates: South → West → North → East → South
- Fixed 48-frame delay

---

### 3. Wander Types (Random Movement)

All wander types follow this pattern:
1. Initialize, face starting direction
2. Execute face animation
3. Wait random delay
4. Pick random direction from allowed set
5. Check collision - if blocked, go to step 2 (face only)
6. If clear, walk one tile
7. Go to step 2

#### MOVEMENT_TYPE_WANDER_AROUND (0x02)
- Can move in any of 4 directions
- Uses `sMovementDelaysMedium`
- Direction pool: `{DIR_SOUTH, DIR_NORTH, DIR_WEST, DIR_EAST}`
- Respects movement range from map data

#### MOVEMENT_TYPE_WANDER_UP_AND_DOWN (0x03)
- Only moves north/south
- Uses `sMovementDelaysMedium`
- Direction pool: `{DIR_SOUTH, DIR_NORTH}`
- Initial direction: NORTH

#### MOVEMENT_TYPE_WANDER_DOWN_AND_UP (0x04)
- Same as above but starts facing SOUTH

#### MOVEMENT_TYPE_WANDER_LEFT_AND_RIGHT (0x05)
- Only moves west/east
- Uses `sMovementDelaysMedium`
- Direction pool: `{DIR_WEST, DIR_EAST}`
- Initial direction: WEST

#### MOVEMENT_TYPE_WANDER_RIGHT_AND_LEFT (0x06)
- Same as above but starts facing EAST

---

### 4. Walk Types (Continuous Pacing)

Walk types move back and forth in a pattern, never stopping to look around.

#### MOVEMENT_TYPE_WALK_UP_AND_DOWN (0x19)
#### MOVEMENT_TYPE_WALK_DOWN_AND_UP (0x1A)
- Walks up, then down, repeat
- Uses movement range to determine turnaround
- No random delay - continuous walking

#### MOVEMENT_TYPE_WALK_LEFT_AND_RIGHT (0x1B)
#### MOVEMENT_TYPE_WALK_RIGHT_AND_LEFT (0x1C)
- Walks left, then right, repeat

#### MOVEMENT_TYPE_WALK_SEQUENCE_* (0x1D-0x34)
- 24 variants for different 4-direction sequences
- Example: `WALK_SEQUENCE_UP_RIGHT_LEFT_DOWN`
  - Walks: Up → Right → Left → Down → Up...
- Useful for patrol patterns

---

### 5. Walk In Place Types (Animated but Stationary)

#### MOVEMENT_TYPE_WALK_IN_PLACE_DOWN/UP/LEFT/RIGHT (0x40-0x43)
- Plays walking animation without moving
- Normal walking speed

#### MOVEMENT_TYPE_JOG_IN_PLACE_DOWN/UP/LEFT/RIGHT (0x44-0x47)
- Faster walking animation

#### MOVEMENT_TYPE_RUN_IN_PLACE_DOWN/UP/LEFT/RIGHT (0x48-0x4B)
- Running animation speed

#### MOVEMENT_TYPE_WALK_SLOWLY_IN_PLACE_DOWN/UP/LEFT/RIGHT (0x4D-0x50)
- Slower walking animation

---

### 6. Copy Player Types

#### MOVEMENT_TYPE_COPY_PLAYER (0x35)
- Mirrors player's movement
- Faces same direction as player
- Moves when player moves

#### MOVEMENT_TYPE_COPY_PLAYER_OPPOSITE (0x36)
- Faces opposite direction to player
- Moves opposite direction when player moves

#### MOVEMENT_TYPE_COPY_PLAYER_COUNTERCLOCKWISE (0x37)
- Faces 90° counterclockwise from player

#### MOVEMENT_TYPE_COPY_PLAYER_CLOCKWISE (0x38)
- Faces 90° clockwise from player

#### *_IN_GRASS variants (0x3B-0x3E)
- Same as above but for grass-hidden NPCs

---

### 7. Special Types

#### MOVEMENT_TYPE_PLAYER (0x0B)
- Special handling for player character
- Controlled by input, not AI

#### MOVEMENT_TYPE_BERRY_TREE_GROWTH (0x0C)
- Berry tree animation states
- Handles sparkle effects on growth

#### MOVEMENT_TYPE_TREE_DISGUISE (0x39)
- Sudowoodo disguise behavior
- Reveals when watered

#### MOVEMENT_TYPE_MOUNTAIN_DISGUISE (0x3A)
- Kecleon disguise behavior

#### MOVEMENT_TYPE_BURIED (0x3F)
- Underground trainer (Route 111 etc.)
- Pops up when player is nearby

---

## Collision Detection

Before moving, NPCs check `GetCollisionInDirection()` which returns:

| Collision Type | Value | Meaning |
|---------------|-------|---------|
| COLLISION_NONE | 0 | Clear to move |
| COLLISION_OUTSIDE_RANGE | 1 | Would exceed movement range |
| COLLISION_IMPASSABLE | 2 | Wall/water/blocked tile |
| COLLISION_ELEVATION_MISMATCH | 3 | Different elevation level |
| COLLISION_OBJECT_EVENT | 4 | Another NPC/object in the way |

If collision is detected, the NPC skips the walk and just faces that direction.

---

## Movement Range

NPCs have `rangeX` and `rangeY` fields that limit how far they can wander from their initial position:

```
initialCoords ± rangeX (horizontal)
initialCoords ± rangeY (vertical)
```

Movement range only applies to types in `sMovementTypeHasRange[]`:
- All WANDER_* types
- All WALK_* types
- All COPY_PLAYER_* types

---

## Key Data Structures

### ObjectEvent (NPC State)
```c
struct ObjectEvent {
    u8 movementType;           // Which AI to use
    u8 facingDirection;        // Current facing (for face animation)
    u8 movementDirection;      // Direction of movement (for walk animation)
    u16 currentCoords.x/y;     // Current tile position
    u16 initialCoords.x/y;     // Spawn position (for range check)
    u8 range.rangeX/rangeY;    // Movement bounds
    bool8 singleMovementActive; // Currently executing a move
    u8 directionSequenceIndex; // For WALK_SEQUENCE types
};
```

### Sprite Data
```c
sprite->data[1] = sTypeFuncId;  // State machine state
sprite->data[2] = sActionFuncId; // Sub-action state
sprite->data[3] = timer;         // Delay countdown
```

---

## Animation Integration

Movement types trigger animations via:
- `GetFaceDirectionMovementAction(direction)` - Returns MOVEMENT_ACTION_FACE_*
- `GetWalkNormalMovementAction(direction)` - Returns MOVEMENT_ACTION_WALK_NORMAL_*
- `ObjectEventSetSingleMovement()` - Queues the action
- `ObjectEventExecSingleMovementAction()` - Executes until complete

The animation system uses `ANIM_STD_*` indices:
- FACE_* (0-3): Static facing frames
- GO_* (4-7): Normal walk animation
- GO_FAST_* (8-11): Running animation
- etc.
