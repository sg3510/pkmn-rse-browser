---
title: GBA Source Code Reference
status: reference
last_verified: 2026-01-13
---

# GBA Source Code Reference

Quick reference for key C code from `pokeemerald/src/event_object_movement.c`.

## Movement Delays

```c
// Line 709-711
static const s16 sMovementDelaysMedium[] = {32, 64,  96, 128};
static const s16 sMovementDelaysLong[] =   {32, 64, 128, 192}; // Unused
static const s16 sMovementDelaysShort[] =  {32, 48,  64,  80};
```

At 60fps: 32 frames = 0.53s, 128 frames = 2.13s

## Direction Constants

```c
// From constants/directions.h
#define DIR_NONE   0
#define DIR_SOUTH  1  // down
#define DIR_NORTH  2  // up
#define DIR_WEST   3  // left
#define DIR_EAST   4  // right
```

## Delay Timer Functions

```c
// Line 8534-8544
static void SetMovementDelay(struct Sprite *sprite, s16 timer)
{
    sprite->data[3] = timer;
}

static bool8 WaitForMovementDelay(struct Sprite *sprite)
{
    if (--sprite->data[3] == 0)
        return TRUE;
    else
        return FALSE;
}
```

## Collision Detection

```c
// Line 4650-4672
static u8 GetCollisionInDirection(struct ObjectEvent *objectEvent, u8 direction)
{
    s16 x = objectEvent->currentCoords.x;
    s16 y = objectEvent->currentCoords.y;
    MoveCoords(direction, &x, &y);
    return GetCollisionAtCoords(objectEvent, x, y, direction);
}

u8 GetCollisionAtCoords(struct ObjectEvent *objectEvent, s16 x, s16 y, u32 dir)
{
    u8 direction = dir;
    if (IsCoordOutsideObjectEventMovementRange(objectEvent, x, y))
        return COLLISION_OUTSIDE_RANGE;
    else if (MapGridGetCollisionAt(x, y) || GetMapBorderIdAt(x, y) == CONNECTION_INVALID
             || IsMetatileDirectionallyImpassable(objectEvent, x, y, direction))
        return COLLISION_IMPASSABLE;
    else if (objectEvent->trackedByCamera && !CanCameraMoveInDirection(direction))
        return COLLISION_IMPASSABLE;
    else if (IsElevationMismatchAt(objectEvent->currentElevation, x, y))
        return COLLISION_ELEVATION_MISMATCH;
    else if (DoesObjectCollideWithObjectAt(objectEvent, x, y))
        return COLLISION_OBJECT_EVENT;
    return COLLISION_NONE;
}
```

## Movement Range Check

```c
// Line 4689-4711
static bool8 IsCoordOutsideObjectEventMovementRange(struct ObjectEvent *objectEvent, s16 x, s16 y)
{
    s16 left;
    s16 right;
    s16 top;
    s16 bottom;

    if (objectEvent->range.rangeX != 0)
    {
        left = objectEvent->initialCoords.x - objectEvent->range.rangeX;
        right = objectEvent->initialCoords.x + objectEvent->range.rangeX;

        if (left > x || right < x)
            return TRUE;
    }
    if (objectEvent->range.rangeY != 0)
    {
        top = objectEvent->initialCoords.y - objectEvent->range.rangeY;
        bottom = objectEvent->initialCoords.y + objectEvent->range.rangeY;

        if (top > y || bottom < y)
            return TRUE;
    }
    return FALSE;
}
```

## WANDER_AROUND Implementation

```c
// Line 2566-2630
bool8 MovementType_WanderAround_Step0(struct ObjectEvent *objectEvent, struct Sprite *sprite)
{
    ClearObjectEventMovement(objectEvent, sprite);
    sprite->sTypeFuncId = 1;
    return TRUE;
}

bool8 MovementType_WanderAround_Step1(struct ObjectEvent *objectEvent, struct Sprite *sprite)
{
    ObjectEventSetSingleMovement(objectEvent, sprite,
        GetFaceDirectionMovementAction(objectEvent->facingDirection));
    sprite->sTypeFuncId = 2;
    return TRUE;
}

bool8 MovementType_WanderAround_Step2(struct ObjectEvent *objectEvent, struct Sprite *sprite)
{
    if (!ObjectEventExecSingleMovementAction(objectEvent, sprite))
        return FALSE;
    SetMovementDelay(sprite, sMovementDelaysMedium[Random() % ARRAY_COUNT(sMovementDelaysMedium)]);
    sprite->sTypeFuncId = 3;
    return TRUE;
}

bool8 MovementType_WanderAround_Step3(struct ObjectEvent *objectEvent, struct Sprite *sprite)
{
    if (WaitForMovementDelay(sprite))
    {
        sprite->sTypeFuncId = 4;
        return TRUE;
    }
    return FALSE;
}

bool8 MovementType_WanderAround_Step4(struct ObjectEvent *objectEvent, struct Sprite *sprite)
{
    u8 directions[4];
    u8 chosenDirection;

    memcpy(directions, gStandardDirections, sizeof directions);
    chosenDirection = directions[Random() & 3];
    SetObjectEventDirection(objectEvent, chosenDirection);
    sprite->sTypeFuncId = 5;
    if (GetCollisionInDirection(objectEvent, chosenDirection))
        sprite->sTypeFuncId = 1;  // Collision! Just face, don't walk

    return TRUE;
}

bool8 MovementType_WanderAround_Step5(struct ObjectEvent *objectEvent, struct Sprite *sprite)
{
    ObjectEventSetSingleMovement(objectEvent, sprite,
        GetWalkNormalMovementAction(objectEvent->movementDirection));
    objectEvent->singleMovementActive = TRUE;
    sprite->sTypeFuncId = 6;
    return TRUE;
}

bool8 MovementType_WanderAround_Step6(struct ObjectEvent *objectEvent, struct Sprite *sprite)
{
    if (ObjectEventExecSingleMovementAction(objectEvent, sprite))
    {
        objectEvent->singleMovementActive = FALSE;
        sprite->sTypeFuncId = 1;
    }
    return FALSE;
}
```

## LOOK_AROUND Implementation

```c
// Line 2846-2893
bool8 MovementType_LookAround_Step0(struct ObjectEvent *objectEvent, struct Sprite *sprite)
{
    ClearObjectEventMovement(objectEvent, sprite);
    sprite->sTypeFuncId = 1;
    return TRUE;
}

bool8 MovementType_LookAround_Step1(struct ObjectEvent *objectEvent, struct Sprite *sprite)
{
    ObjectEventSetSingleMovement(objectEvent, sprite,
        GetFaceDirectionMovementAction(objectEvent->facingDirection));
    sprite->sTypeFuncId = 2;
    return TRUE;
}

bool8 MovementType_LookAround_Step2(struct ObjectEvent *objectEvent, struct Sprite *sprite)
{
    if (ObjectEventExecSingleMovementAction(objectEvent, sprite))
    {
        SetMovementDelay(sprite, sMovementDelaysMedium[Random() % ARRAY_COUNT(sMovementDelaysMedium)]);
        objectEvent->singleMovementActive = FALSE;
        sprite->sTypeFuncId = 3;
    }
    return FALSE;
}

bool8 MovementType_LookAround_Step3(struct ObjectEvent *objectEvent, struct Sprite *sprite)
{
    if (WaitForMovementDelay(sprite) || ObjectEventIsTrainerAndCloseToPlayer(objectEvent))
    {
        sprite->sTypeFuncId = 4;
        return TRUE;
    }
    return FALSE;
}

bool8 MovementType_LookAround_Step4(struct ObjectEvent *objectEvent, struct Sprite *sprite)
{
    u8 direction;
    u8 directions[4];
    memcpy(directions, gStandardDirections, sizeof directions);
    direction = TryGetTrainerEncounterDirection(objectEvent, RUNFOLLOW_ANY);
    if (direction == DIR_NONE)
        direction = directions[Random() & 3];

    SetObjectEventDirection(objectEvent, direction);
    sprite->sTypeFuncId = 1;
    return TRUE;
}
```

## Initial Facing Directions

```c
// Line 350-432
const u8 gInitialMovementTypeFacingDirections[] = {
    [MOVEMENT_TYPE_NONE] = DIR_SOUTH,
    [MOVEMENT_TYPE_LOOK_AROUND] = DIR_SOUTH,
    [MOVEMENT_TYPE_WANDER_AROUND] = DIR_SOUTH,
    [MOVEMENT_TYPE_WANDER_UP_AND_DOWN] = DIR_NORTH,
    [MOVEMENT_TYPE_WANDER_DOWN_AND_UP] = DIR_SOUTH,
    [MOVEMENT_TYPE_WANDER_LEFT_AND_RIGHT] = DIR_WEST,
    [MOVEMENT_TYPE_WANDER_RIGHT_AND_LEFT] = DIR_EAST,
    [MOVEMENT_TYPE_FACE_UP] = DIR_NORTH,
    [MOVEMENT_TYPE_FACE_DOWN] = DIR_SOUTH,
    [MOVEMENT_TYPE_FACE_LEFT] = DIR_WEST,
    [MOVEMENT_TYPE_FACE_RIGHT] = DIR_EAST,
    // ... more entries
};
```

## Direction Arrays for Movement Types

```c
// Line 11-57 in movement_type_func_tables.h
const u8 gStandardDirections[] = {DIR_SOUTH, DIR_NORTH, DIR_WEST, DIR_EAST};
const u8 gUpAndDownDirections[] = {DIR_SOUTH, DIR_NORTH};
const u8 gLeftAndRightDirections[] = {DIR_WEST, DIR_EAST};
const u8 gUpAndLeftDirections[] = {DIR_NORTH, DIR_WEST};
const u8 gUpAndRightDirections[] = {DIR_NORTH, DIR_EAST};
const u8 gDownAndLeftDirections[] = {DIR_SOUTH, DIR_WEST};
const u8 gDownAndRightDirections[] = {DIR_SOUTH, DIR_EAST};
const u8 gCounterclockwiseDirections[] = {DIR_SOUTH, DIR_EAST, DIR_WEST, DIR_SOUTH, DIR_NORTH};
const u8 gClockwiseDirections[] = {DIR_SOUTH, DIR_WEST, DIR_EAST, DIR_NORTH, DIR_SOUTH};
```

## Sprite Data Usage

```c
// Line 60-63
#define sObjEventId   data[0]
#define sTypeFuncId   data[1]  // Current step in state machine
#define sActionFuncId data[2]  // Sub-action state
#define sDirection    data[3]  // Also used as delay timer
```

## Movement Type Callback Table

```c
// Line 221-304
static void (*const sMovementTypeCallbacks[])(struct Sprite *) =
{
    [MOVEMENT_TYPE_NONE] = MovementType_None,
    [MOVEMENT_TYPE_LOOK_AROUND] = MovementType_LookAround,
    [MOVEMENT_TYPE_WANDER_AROUND] = MovementType_WanderAround,
    [MOVEMENT_TYPE_WANDER_UP_AND_DOWN] = MovementType_WanderUpAndDown,
    [MOVEMENT_TYPE_WANDER_DOWN_AND_UP] = MovementType_WanderUpAndDown,
    [MOVEMENT_TYPE_WANDER_LEFT_AND_RIGHT] = MovementType_WanderLeftAndRight,
    [MOVEMENT_TYPE_WANDER_RIGHT_AND_LEFT] = MovementType_WanderLeftAndRight,
    [MOVEMENT_TYPE_FACE_UP] = MovementType_FaceDirection,
    [MOVEMENT_TYPE_FACE_DOWN] = MovementType_FaceDirection,
    [MOVEMENT_TYPE_FACE_LEFT] = MovementType_FaceDirection,
    [MOVEMENT_TYPE_FACE_RIGHT] = MovementType_FaceDirection,
    // ... more entries
};
```

## Which Types Have Range

```c
// Line 306-348
static const bool8 sMovementTypeHasRange[NUM_MOVEMENT_TYPES] = {
    [MOVEMENT_TYPE_WANDER_AROUND] = TRUE,
    [MOVEMENT_TYPE_WANDER_UP_AND_DOWN] = TRUE,
    [MOVEMENT_TYPE_WANDER_DOWN_AND_UP] = TRUE,
    [MOVEMENT_TYPE_WANDER_LEFT_AND_RIGHT] = TRUE,
    [MOVEMENT_TYPE_WANDER_RIGHT_AND_LEFT] = TRUE,
    [MOVEMENT_TYPE_WALK_UP_AND_DOWN] = TRUE,
    [MOVEMENT_TYPE_WALK_DOWN_AND_UP] = TRUE,
    [MOVEMENT_TYPE_WALK_LEFT_AND_RIGHT] = TRUE,
    [MOVEMENT_TYPE_WALK_RIGHT_AND_LEFT] = TRUE,
    [MOVEMENT_TYPE_WALK_SEQUENCE_*] = TRUE,  // All 24 variants
    [MOVEMENT_TYPE_COPY_PLAYER_*] = TRUE,     // All 8 variants
};
```
