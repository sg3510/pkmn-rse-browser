---
title: Truck Scene - Moving Truck Sequence
status: reference
last_verified: 2026-01-13
---

# Truck Scene - Moving Truck Sequence

## Source Files
- `src/field_special_scene.c` - Truck animation logic
- `data/maps/InsideOfTruck/scripts.inc` - Map scripts and flags
- `data/maps/InsideOfTruck/map.json` - Map layout data

## Overview

After the Birch intro speech and `NewGameInitData()`, the player starts inside a moving truck. This is a scripted cinematic sequence with:

1. Truck driving animation (camera shake, box bouncing)
2. Truck stopping and door opening
3. Player gains control and can exit

## Truck Interior Layout

The `InsideOfTruck` map has:
- Fixed tile background (truck interior)
- 3 moveable box objects (sprites) that bounce during driving
- Door area that changes metatiles when opened
- Player spawn position

### Box Object IDs
```c
#define LOCALID_TRUCK_BOX_TOP       1
#define LOCALID_TRUCK_BOX_BOTTOM_L  2
#define LOCALID_TRUCK_BOX_BOTTOM_R  3
```

### Box Sprite Offsets
```c
// Offset positions to make boxes look less perfectly stacked
#define BOX1_X_OFFSET  3   // Top box
#define BOX1_Y_OFFSET  3
#define BOX2_X_OFFSET  0   // Bottom-left box
#define BOX2_Y_OFFSET -3
#define BOX3_X_OFFSET -3   // Bottom-right box
#define BOX3_Y_OFFSET  0
```

## Entry Point

From `new_game.c`:
```c
static void WarpToTruck(void)
{
    SetWarpDestination(MAP_GROUP(MAP_INSIDE_OF_TRUCK), MAP_NUM(MAP_INSIDE_OF_TRUCK), WARP_ID_NONE, -1, -1);
    WarpIntoMap();
}
```

## Truck Sequence State Machine

### Main Controller Task

```c
void ExecuteTruckSequence(void)
{
    // 1. Set door metatiles to closed state
    MapGridSetMetatileIdAt(4 + MAP_OFFSET, 1 + MAP_OFFSET, METATILE_InsideOfTruck_DoorClosedFloor_Top);
    MapGridSetMetatileIdAt(4 + MAP_OFFSET, 2 + MAP_OFFSET, METATILE_InsideOfTruck_DoorClosedFloor_Mid);
    MapGridSetMetatileIdAt(4 + MAP_OFFSET, 3 + MAP_OFFSET, METATILE_InsideOfTruck_DoorClosedFloor_Bottom);
    DrawWholeMapView();

    // 2. Lock player controls
    LockPlayerFieldControls();

    // 3. Fade screen to black
    CpuFastFill(0, gPlttBufferFaded, PLTT_SIZE);

    // 4. Create main sequence task
    CreateTask(Task_HandleTruckSequence, 0xA);
}
```

### Task_HandleTruckSequence State Machine

```c
#define tState   data[0]
#define tTimer   data[1]
#define tTaskId1 data[2]  // Task_Truck1 (driving)
#define tTaskId2 data[3]  // Task_Truck2/3 (stopping)

switch (tState)
{
    case 0:
        // WAIT 90 FRAMES (1.5 seconds)
        tTimer++;
        if (tTimer == 90) {
            SetCameraPanningCallback(NULL);
            tTimer = 0;
            tTaskId1 = CreateTask(Task_Truck1, 0xA);  // Start driving animation
            tState = 1;
            PlaySE(SE_TRUCK_MOVE);
        }
        break;

    case 1:
        // WAIT 150 FRAMES (2.5 seconds)
        tTimer++;
        if (tTimer == 150) {
            FadeInFromBlack();
            tTimer = 0;
            tState = 2;
        }
        break;

    case 2:
        // WAIT FOR FADE + 300 FRAMES (5 seconds)
        tTimer++;
        if (!gPaletteFade.active && tTimer > 300) {
            tTimer = 0;
            DestroyTask(tTaskId1);  // Stop driving animation
            tTaskId2 = CreateTask(Task_Truck2, 0xA);  // Start stopping animation
            tState = 3;
            PlaySE(SE_TRUCK_STOP);
        }
        break;

    case 3:
        // WAIT FOR TRUCK TO STOP
        if (!gTasks[tTaskId2].isActive) {
            // Task_Truck2 / Task_Truck3 finished
            InstallCameraPanAheadCallback();
            tTimer = 0;
            tState = 4;
        }
        break;

    case 4:
        // WAIT 90 FRAMES (1.5 seconds)
        tTimer++;
        if (tTimer == 90) {
            PlaySE(SE_TRUCK_UNLOAD);
            tTimer = 0;
            tState = 5;
        }
        break;

    case 5:
        // WAIT 120 FRAMES (2 seconds) THEN OPEN DOOR
        tTimer++;
        if (tTimer == 120) {
            // Change door metatiles to open (light coming in)
            MapGridSetMetatileIdAt(4 + MAP_OFFSET, 1 + MAP_OFFSET, METATILE_InsideOfTruck_ExitLight_Top);
            MapGridSetMetatileIdAt(4 + MAP_OFFSET, 2 + MAP_OFFSET, METATILE_InsideOfTruck_ExitLight_Mid);
            MapGridSetMetatileIdAt(4 + MAP_OFFSET, 3 + MAP_OFFSET, METATILE_InsideOfTruck_ExitLight_Bottom);
            DrawWholeMapView();
            PlaySE(SE_TRUCK_DOOR);
            DestroyTask(taskId);
            UnlockPlayerFieldControls();  // Player can now move
        }
        break;
}
```

## Box Bouncing Animation

### During Driving (Task_Truck1)

```c
static s16 GetTruckBoxYMovement(int time)
{
    // Every 180 frames (offset by 120), boxes jump up
    if (!((time + 120) % 180))
        return -1;  // Jump up
    return 0;       // Stay still
}

static s16 GetTruckCameraBobbingY(int time)
{
    // Every 120 frames, camera dips down
    if (!(time % 120))
        return -1;
    // Every 10 frames, camera bobs up slightly
    else if ((time % 10) <= 4)
        return 1;
    return 0;
}

static void Task_Truck1(u8 taskId)
{
    s16 *data = gTasks[taskId].data;
    s16 cameraYpan = 0;

    // Box 1 (top) jumps with +30 frame offset, 4x amplitude
    yBox1 = GetTruckBoxYMovement(tTimer + 30) * 4;
    SetObjectEventSpritePosByLocalIdAndMap(LOCALID_TRUCK_BOX_TOP, ...,
        BOX1_X_OFFSET, BOX1_Y_OFFSET + yBox1);

    // Box 2 (bottom-left) standard timing, 2x amplitude
    yBox2 = GetTruckBoxYMovement(tTimer) * 2;
    SetObjectEventSpritePosByLocalIdAndMap(LOCALID_TRUCK_BOX_BOTTOM_L, ...,
        BOX2_X_OFFSET, BOX2_Y_OFFSET + yBox2);

    // Box 3 (bottom-right) standard timing, 4x amplitude
    yBox3 = GetTruckBoxYMovement(tTimer) * 4;
    SetObjectEventSpritePosByLocalIdAndMap(LOCALID_TRUCK_BOX_BOTTOM_R, ...,
        BOX3_X_OFFSET, BOX3_Y_OFFSET + yBox3);

    // Increment timer (wraps at 30000)
    if (++tTimer == 30000)
        tTimer = 0;

    // Apply camera shake
    cameraYpan = GetTruckCameraBobbingY(tTimer);
    SetCameraPanning(0, cameraYpan);
}
```

### Stopping Sequence (Task_Truck2 → Task_Truck3)

```c
// Camera panning during stop
static const s8 sTruckCamera_HorizontalTable[] = {
    0, 0, 0, 0, 0, 0, 0, 0,  // Initial pause
    1, 2, 2, 2, 2, 2, 2,     // Move right (truck stopping)
    -1, -1, -1,              // Settle back
    0                        // Done
};

static void Task_Truck2(u8 taskId)
{
    // Advance through horizontal table every 6 frames
    tTimerHorizontal++;
    if (tTimerHorizontal > 5) {
        tTimerHorizontal = 0;
        tMoveStep++;
    }

    // When we hit value 2, switch to Task_Truck3
    if (sTruckCamera_HorizontalTable[tMoveStep] == 2)
        gTasks[taskId].func = Task_Truck3;

    // Apply camera pan and continue box bobbing
    cameraXpan = sTruckCamera_HorizontalTable[tMoveStep];
    cameraYpan = GetTruckCameraBobbingY(tTimerVertical);
    SetCameraPanning(cameraXpan, cameraYpan);

    // Update box positions (compensate for camera pan)
    // Boxes still bob during stopping
}

static void Task_Truck3(u8 taskId)
{
    // Continue through rest of horizontal table
    // But NO vertical bobbing (cameraYpan = 0)
    // Boxes settle to final positions
    // Self-destructs when table is exhausted
}
```

## Map Scripts

### Map Load Script
```
InsideOfTruck_OnLoad:
    setmetatile 4, 1, METATILE_InsideOfTruck_ExitLight_Top, FALSE
    setmetatile 4, 2, METATILE_InsideOfTruck_ExitLight_Mid, FALSE
    setmetatile 4, 3, METATILE_InsideOfTruck_ExitLight_Bottom, FALSE
    end
```

Note: The OnLoad script sets the door to OPEN, but `ExecuteTruckSequence()` immediately sets it to CLOSED at runtime before the sequence starts.

### Map Resume Script
```
InsideOfTruck_OnResume:
    setstepcallback STEP_CB_TRUCK
    end
```

### Intro Flag Setup (Called when player exits truck)

```
InsideOfTruck_EventScript_SetIntroFlags::
    lockall
    setflag FLAG_HIDE_MAP_NAME_POPUP
    checkplayergender
    goto_if_eq VAR_RESULT, MALE, InsideOfTruck_EventScript_SetIntroFlagsMale
    goto_if_eq VAR_RESULT, FEMALE, InsideOfTruck_EventScript_SetIntroFlagsFemale
    end

InsideOfTruck_EventScript_SetIntroFlagsMale::
    setrespawn HEAL_LOCATION_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F
    setvar VAR_LITTLEROOT_INTRO_STATE, 1
    setflag FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_MOM
    setflag FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_TRUCK
    setflag FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_RIVAL_MOM
    setflag FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_RIVAL_SIBLING
    setflag FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F_POKE_BALL
    setvar VAR_LITTLEROOT_HOUSES_STATE_BRENDAN, 1
    setdynamicwarp MAP_LITTLEROOT_TOWN, 3, 10
    releaseall
    end

InsideOfTruck_EventScript_SetIntroFlagsFemale::
    setrespawn HEAL_LOCATION_LITTLEROOT_TOWN_MAYS_HOUSE_2F
    setvar VAR_LITTLEROOT_INTRO_STATE, 2
    setflag FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_MOM
    setflag FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_TRUCK
    setflag FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_RIVAL_MOM
    setflag FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_RIVAL_SIBLING
    setflag FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_2F_POKE_BALL
    setvar VAR_LITTLEROOT_HOUSES_STATE_MAY, 1
    setdynamicwarp MAP_LITTLEROOT_TOWN, 12, 10
    releaseall
    end
```

## Sound Effects

| Sound | When Played |
|-------|-------------|
| `SE_TRUCK_MOVE` | Truck starts moving (state 0→1) |
| `SE_TRUCK_STOP` | Truck begins stopping (state 2→3) |
| `SE_TRUCK_UNLOAD` | Boxes being unloaded (state 4→5) |
| `SE_TRUCK_DOOR` | Door opens (state 5 end) |

## Timeline Summary

| Time (frames) | Time (seconds) | Event |
|---------------|----------------|-------|
| 0 | 0.0 | Sequence starts, screen black |
| 90 | 1.5 | Truck moving sound, driving animation starts |
| 240 | 4.0 | Fade from black |
| 540+ | 9.0+ | Truck stop sound, stopping animation |
| Variable | - | Stop animation completes |
| +90 | +1.5 | Unload sound |
| +210 | +3.5 | Door opens, player control restored |

Total: Approximately 12-15 seconds

## Browser Implementation

### State Interface

```typescript
interface TruckSequenceState {
  phase: TruckPhase;
  frameCounter: number;
  stateTimer: number;

  // Camera state
  cameraX: number;
  cameraY: number;

  // Box states
  boxes: BoxState[];

  // Animation state
  horizontalTableIndex: number;
  isDoorOpen: boolean;
  playerControlsLocked: boolean;

  // Sub-tasks
  drivingAnimationActive: boolean;
  stoppingAnimationActive: boolean;
}

interface BoxState {
  id: number;
  baseX: number;
  baseY: number;
  offsetX: number;
  offsetY: number;
  bounceAmplitude: number;
  bounceOffset: number;  // Phase offset in frames
}

type TruckPhase =
  | 'pre_fade'       // States 0-1
  | 'driving'        // State 2
  | 'stopping'       // State 3
  | 'settling'       // State 4
  | 'door_opening'   // State 5
  | 'player_control';
```

### Animation Functions

```typescript
// Box bounce calculation (matches C implementation)
const getBoxBounceY = (timer: number, offset: number = 0): number => {
  if (((timer + offset + 120) % 180) === 0) {
    return -1;  // Jump frame
  }
  return 0;
};

// Camera bob calculation
const getCameraBobbingY = (timer: number): number => {
  if ((timer % 120) === 0) {
    return -1;
  } else if ((timer % 10) <= 4) {
    return 1;
  }
  return 0;
};

// Camera horizontal pan table
const TRUCK_CAMERA_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0,  // 8 frames pause
  1, 2, 2, 2, 2, 2, 2,     // 7 frames moving right
  -1, -1, -1,              // 3 frames settling
  0                        // Final position
];

// Box configuration
const BOXES: BoxState[] = [
  { id: 1, baseX: 0, baseY: 0, offsetX: 3, offsetY: 3, bounceAmplitude: 4, bounceOffset: 30 },
  { id: 2, baseX: 0, baseY: 0, offsetX: 0, offsetY: -3, bounceAmplitude: 2, bounceOffset: 0 },
  { id: 3, baseX: 0, baseY: 0, offsetX: -3, offsetY: 0, bounceAmplitude: 4, bounceOffset: 0 },
];
```

### React Component

```typescript
const TruckSequence: React.FC<{
  onComplete: () => void;
}> = ({ onComplete }) => {
  const [state, dispatch] = useReducer(truckReducer, initialTruckState);
  const audioRef = useRef<AudioManager>();

  useGameLoop((deltaFrames) => {
    dispatch({ type: 'TICK', frames: deltaFrames });
  });

  // Handle phase transitions and sound effects
  useEffect(() => {
    switch (state.phase) {
      case 'driving':
        if (state.stateTimer === 0) {
          audioRef.current?.play('SE_TRUCK_MOVE');
        }
        break;
      case 'stopping':
        if (state.stateTimer === 0) {
          audioRef.current?.play('SE_TRUCK_STOP');
        }
        break;
      case 'settling':
        if (state.stateTimer === 90) {
          audioRef.current?.play('SE_TRUCK_UNLOAD');
        }
        break;
      case 'door_opening':
        if (state.stateTimer === 0) {
          audioRef.current?.play('SE_TRUCK_DOOR');
        }
        break;
      case 'player_control':
        onComplete();
        break;
    }
  }, [state.phase, state.stateTimer]);

  return (
    <div
      className="truck-interior"
      style={{
        transform: `translate(${-state.cameraX}px, ${-state.cameraY}px)`,
      }}
    >
      <TruckBackground doorOpen={state.isDoorOpen} />

      {state.boxes.map((box) => (
        <MovingBox
          key={box.id}
          x={box.baseX + box.offsetX - state.cameraX}
          y={box.baseY + box.offsetY + getBoxBounceY(state.frameCounter, box.bounceOffset) * box.bounceAmplitude}
        />
      ))}

      <Player
        locked={state.playerControlsLocked}
        visible={!state.playerControlsLocked}
      />

      {state.phase === 'pre_fade' && <FadeOverlay opacity={1} />}
    </div>
  );
};
```

### Metatile Changes for Door

```typescript
interface DoorMetatiles {
  closed: {
    top: number;
    mid: number;
    bottom: number;
  };
  open: {
    top: number;     // Shows light coming in
    mid: number;
    bottom: number;
  };
}

const setDoorState = (mapRenderer: MapRenderer, open: boolean) => {
  const tiles = open ? DOOR_METATILES.open : DOOR_METATILES.closed;
  mapRenderer.setMetatileAt(4, 1, tiles.top);
  mapRenderer.setMetatileAt(4, 2, tiles.mid);
  mapRenderer.setMetatileAt(4, 3, tiles.bottom);
  mapRenderer.redraw();
};
```
