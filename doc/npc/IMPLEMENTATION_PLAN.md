# NPC Movement System Implementation Plan

This document outlines how to implement GBA-accurate NPC movement in our browser-based Pokemon Emerald viewer.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Game Loop (60fps)                        │
│                    requestAnimationFrame                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NPCMovementEngine                            │
│  - Manages all NPC movement state machines                      │
│  - Runs each NPC's movement type handler                        │
│  - Updates positions based on walking state                     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ MovementHandler │  │ MovementHandler │  │ MovementHandler │
│  WanderAround   │  │   LookAround    │  │    FaceDir      │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NPCAnimationEngine                           │
│  - Already implemented!                                         │
│  - Receives isMoving + direction from movement engine           │
│  - Handles walk cycle frame selection                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NPCRenderer                                │
│  - Already implemented!                                         │
│  - Reads position from NPCObject                                │
│  - Reads frame from animation engine                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Movement Engine

**New File: `src/game/npc/NPCMovementEngine.ts`**

```typescript
interface NPCMovementState {
  npcId: string;
  stepFuncId: number;           // Current state in state machine
  delayTimer: number;           // Frames until next action
  walkProgress: number;         // 0-16 pixels during walk
  walkDirection: Direction;     // Direction of current walk
  isWalking: boolean;           // Currently in walk animation
  initialTileX: number;         // Spawn position for range check
  initialTileY: number;
}

class NPCMovementEngine {
  private states: Map<string, NPCMovementState>;

  update(deltaFrames: number): NPCUpdate[];
  getState(npcId: string): NPCMovementState;
}
```

### Phase 2: Movement Type Handlers

**New File: `src/game/npc/movementTypes/index.ts`**

Each handler is a state machine that returns the next state:

```typescript
type MovementStepResult = {
  nextStep: number;
  action?: 'face' | 'walk' | 'delay';
  direction?: Direction;
  delayFrames?: number;
};

interface MovementTypeHandler {
  step0(npc: NPCObject, state: NPCMovementState): MovementStepResult;
  step1?(npc: NPCObject, state: NPCMovementState): MovementStepResult;
  // ... more steps as needed
}
```

**Individual handlers:**
- `src/game/npc/movementTypes/wanderAround.ts`
- `src/game/npc/movementTypes/lookAround.ts`
- `src/game/npc/movementTypes/faceDirection.ts`
- `src/game/npc/movementTypes/wanderUpAndDown.ts`
- `src/game/npc/movementTypes/wanderLeftAndRight.ts`
- `src/game/npc/movementTypes/walkBackAndForth.ts`
- `src/game/npc/movementTypes/rotate.ts`
- `src/game/npc/movementTypes/walkInPlace.ts`

### Phase 3: Collision Detection

**New File: `src/game/npc/NPCCollision.ts`**

```typescript
type CollisionResult =
  | 'none'
  | 'outside_range'
  | 'impassable'
  | 'elevation_mismatch'
  | 'object_event';

function getCollisionInDirection(
  npc: NPCObject,
  direction: Direction,
  mapData: MapData,
  allNPCs: NPCObject[]
): CollisionResult;

function isCoordOutsideRange(
  npc: NPCObject,
  x: number,
  y: number
): boolean;
```

### Phase 4: Position Updates

**Modify: `src/types/objectEvents.ts`**

Add position interpolation fields:

```typescript
interface NPCObject {
  // Existing fields...

  // New movement fields
  currentSubX: number;     // Sub-tile X position (0-15)
  currentSubY: number;     // Sub-tile Y position (0-15)
  isMoving: boolean;       // Currently walking between tiles
  movementDirection: Direction; // Direction of current movement
}
```

### Phase 5: Rendering Integration

**Modify: `src/game/npc/NPCRenderer.ts`**

Calculate world position using sub-tile coordinates:

```typescript
// Current (tile-based only):
const worldX = npc.tileX * METATILE_SIZE;
const worldY = npc.tileY * METATILE_SIZE - (sh - METATILE_SIZE);

// New (with sub-tile):
const worldX = npc.tileX * METATILE_SIZE + npc.currentSubX;
const worldY = npc.tileY * METATILE_SIZE + npc.currentSubY - (sh - METATILE_SIZE);
```

---

## GBA-Accurate Timing

### Frame Timing
- GBA runs at 60fps (~16.67ms per frame)
- Our engine uses `requestAnimationFrame` (~60fps on most displays)
- Track delta time to handle variable frame rates

### Movement Speed (Normal Walk)
- GBA: 1 tile per 16 frames = 16 pixels in 16 frames = 1 pixel/frame
- Our equivalent: Move 1 pixel per ~16.67ms

### Delay Values
```typescript
const MOVEMENT_DELAYS_SHORT  = [32, 48, 64, 80];   // ~0.5-1.3 seconds
const MOVEMENT_DELAYS_MEDIUM = [32, 64, 96, 128];  // ~0.5-2.1 seconds
```

---

## State Machine Example: WANDER_AROUND

```
Step 0: Initialize
  └─→ Clear movement state
  └─→ Go to Step 1

Step 1: Face Current Direction
  └─→ Set face animation
  └─→ Go to Step 2

Step 2: Execute Face Animation
  └─→ Wait for animation complete
  └─→ Set random delay from MEDIUM array
  └─→ Go to Step 3

Step 3: Wait Delay
  └─→ Decrement timer each frame
  └─→ If timer == 0, go to Step 4

Step 4: Choose Direction
  └─→ Pick random direction (any of 4)
  └─→ Check collision
  └─→ If blocked, go to Step 1 (just face)
  └─→ If clear, go to Step 5

Step 5: Start Walk
  └─→ Begin walk animation
  └─→ Set isMoving = true
  └─→ Go to Step 6

Step 6: Execute Walk
  └─→ Update sub-tile position each frame
  └─→ When complete (16 pixels), update tile coords
  └─→ Set isMoving = false
  └─→ Go to Step 1
```

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `src/game/npc/NPCMovementEngine.ts` | Core movement state management |
| `src/game/npc/NPCCollision.ts` | Collision detection utilities |
| `src/game/npc/movementTypes/index.ts` | Movement handler registry |
| `src/game/npc/movementTypes/wanderAround.ts` | WANDER_AROUND handler |
| `src/game/npc/movementTypes/lookAround.ts` | LOOK_AROUND handler |
| `src/game/npc/movementTypes/faceDirection.ts` | FACE_* handlers |
| `src/game/npc/movementTypes/wanderDirectional.ts` | WANDER_UP_AND_DOWN etc. |
| `src/game/npc/movementTypes/walkBackAndForth.ts` | WALK_* handlers |
| `src/game/npc/movementTypes/rotate.ts` | ROTATE_* handlers |
| `src/game/npc/movementTypes/walkInPlace.ts` | WALK_IN_PLACE_* handlers |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/objectEvents.ts` | Add movement state fields to NPCObject |
| `src/game/npc/NPCRenderer.ts` | Use sub-tile position for rendering |
| `src/game/npc/NPCAnimationEngine.ts` | Accept movement state from engine |
| `src/game/npc/index.ts` | Export new movement engine |
| `src/components/map/MapCanvas.tsx` | Call movement engine in game loop |

---

## TODO Checklist

### Infrastructure
- [ ] Create `NPCMovementEngine.ts` with state management
- [ ] Create `NPCCollision.ts` with collision detection
- [ ] Add sub-tile position fields to `NPCObject`
- [ ] Update `NPCRenderer.ts` to use sub-tile positions
- [ ] Integrate movement engine into game loop

### Movement Type Handlers (Priority Order)
- [ ] `faceDirection.ts` - Simplest, good starting point
- [ ] `lookAround.ts` - Face + delay + random direction
- [ ] `wanderAround.ts` - Full movement with collision
- [ ] `wanderDirectional.ts` - UP_AND_DOWN, LEFT_AND_RIGHT variants
- [ ] `walkBackAndForth.ts` - Continuous pacing
- [ ] `rotate.ts` - Clockwise/counterclockwise rotation
- [ ] `walkInPlace.ts` - Animated but stationary

### Collision Detection
- [ ] Check tile walkability from metatile behaviors
- [ ] Check movement range boundaries
- [ ] Check elevation matching
- [ ] Check other NPCs/objects

### Testing
- [ ] Verify WANDER_AROUND NPCs move correctly
- [ ] Verify LOOK_AROUND NPCs turn but don't move
- [ ] Verify movement ranges are respected
- [ ] Verify collision with walls works
- [ ] Verify NPC-NPC collision works
- [ ] Compare timing with actual GBA recordings

---

## Notes

### What We Already Have
- `NPCAnimationEngine.ts` - Handles walk cycle animations
- `NPCRenderer.ts` - Renders sprites with correct frames
- `NPCSpriteLoader.ts` - Loads and caches sprites
- Metatile behavior data - Can check walkability
- Elevation system - Already tracking NPC elevations

### What We Need to Add
- Movement state machine execution
- Position interpolation (sub-tile movement)
- Collision detection
- Game loop integration

### Future Considerations
- COPY_PLAYER types need player position tracking
- WALK_SEQUENCE types need direction sequence storage
- Trainer types may interrupt movement for battle triggers
- Script commands (`applymovement`) override AI movement
