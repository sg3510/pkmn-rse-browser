---
title: Scripted NPC Movement System Design
status: draft
last_verified: 2026-02-07
---

# Scripted NPC Movement System

Architecture for implementing `applymovement` / `waitmovement` in TypeScript, based on the C source in `public/pokeemerald/src/event_object_movement.c` and `src/scrcmd.c`.

## Architecture Overview

**Two-tier execution model**: A `ScriptMovementManager` runs as a game-loop task, managing concurrent NPC movement scripts. Each NPC tracks its own step-function state.

- **Movement script format**: Array of movement action IDs (bytes), terminated by `STEP_END` (0xFE)
- **Per-frame processing**: For each active NPC, check if current action is finished. If yes, advance to next action in script.
- **Concurrent**: Multiple NPCs can run movement scripts simultaneously.

## Movement Action System

~160 action types organized by category:
- **Face** (4): face_down, face_up, face_left, face_right
- **Walk** (4 speeds x 4 dirs = 16): walk_normal_down, walk_slow_up, walk_fast_left, etc.
- **Walk in place** (4 speeds x 4 dirs = 16): animate without tile change
- **Jump** (4 dirs + in place): hop one tile in a direction
- **Delay** (various): delay_1, delay_2, delay_4, delay_8, delay_16
- **Emote** (5+): exclamation_mark, question_mark, heart, etc.
- **Visibility**: set_invisible, set_visible
- **Lock/unlock**: lock_facing_direction, unlock_facing_direction

Each action is a mini state machine with Step0 (init), Step1+ (update), and a final step (complete).

Action constants from: `include/constants/event_object_movement.h`

## Key TypeScript Interfaces

```ts
interface MovementAction {
  id: number;
  init(npc: NPCObject): void;
  update(npc: NPCObject, dt: number): boolean; // true = complete
}

interface ScriptMovementManager {
  startMovement(localId: string, actions: number[]): void;
  isMovementFinished(localId: string): boolean;
  update(dt: number): void;
}
```

## Movement Speeds

Pixels per frame at 60fps:
| Speed | px/frame |
|-------|----------|
| Slow | 1 |
| Normal | 2 |
| Fast | 3 |
| Faster | 4 |
| Fastest | 6 |

All walking actions take 16 frames to cross one 16px metatile at normal speed.

## Priority Implementation Order

1. **Face actions** (trivial -- just set direction)
2. **Walk normal** (4 dirs) -- most commonly used
3. **Delay actions** (frame counting)
4. **Walk in-place** (animation only, no tile change)
5. **Jump actions**
6. **Emotes** (exclamation mark, question mark, heart)
7. **Walk slow/fast/faster variants**
8. **Diagonal walks**

## Script Commands Needed

```ts
// Queue movement script for NPC
applymovement(localId: string, actions: number[]): void;

// Async wait until movement complete (localId=0 waits for all)
waitmovement(localId: string): Promise<void>;

// Freeze/unfreeze all NPC autonomous movement
lockall(): void;
releaseall(): void;
```

## House Entry Cutscene (Example)

From C source `data/scripts/players_house.inc`:

```
1. lockall
2. msgbox "See, {PLAYER}? Isn't it nice in here, too?"
3. applymovement MOM, Common_Movement_FacePlayer
4. waitmovement 0
5. msgbox "The mover's POKeMON do all the work..."
6. setvar VAR_LITTLEROOT_INTRO_STATE, 4
7. applymovement PLAYER, walk_up
8. applymovement MOM, walk_in_place_faster_up
9. waitmovement 0
10. releaseall
```

Currently implemented as dialog-only in `NewGameFlow.ts` (Issue #10 minimal fix). Full implementation requires this scripted movement system.

## Integration Points

- **NPCMovementEngine**: Already handles autonomous movement types. Scripted movement overrides autonomous behavior while active.
- **PlayerController**: Scripted player movement (walk_up, etc.) disables keyboard input and drives the player like an NPC.
- **ObjectEventManager**: Provides NPC lookup by localId for targeting movement scripts.
- **GamePage render loop**: `ScriptMovementManager.update()` called each frame alongside autonomous NPC movement.

## C Source References

- Movement actions: `src/event_object_movement.c` (7000+ lines)
- Script commands: `src/scrcmd.c:ScrCmd_ApplyMovement`, `ScrCmd_WaitMovement`
- Movement constants: `include/constants/event_object_movement.h`
- Common movements: `data/scripts/movement.inc` (face_player, walk patterns)
