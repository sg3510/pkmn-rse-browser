# NPC Movement Implementation TODO

Implementation checklist for GBA-accurate NPC movement.

---

## Phase 1: Core Engine

### 1.1 Movement Engine Core
- [ ] Create `src/game/npc/NPCMovementEngine.ts`
  - [ ] `NPCMovementState` interface with step ID, timer, walking state
  - [ ] State storage Map keyed by NPC ID
  - [ ] `update(deltaMs)` method to run all NPCs
  - [ ] `getState(npcId)` to get current state
  - [ ] `initializeNPC(npc)` to set up initial state

### 1.2 Timing System
- [ ] Frame-accurate timing (16.67ms per GBA frame)
- [ ] Delta time accumulator for consistent updates
- [ ] Movement delay constants matching GBA:
  ```typescript
  DELAYS_SHORT  = [32, 48, 64, 80]    // frames
  DELAYS_MEDIUM = [32, 64, 96, 128]   // frames
  ```

### 1.3 Position System
- [ ] Add to `NPCObject`:
  - [ ] `subTileX: number` (0-15 sub-pixel offset)
  - [ ] `subTileY: number`
  - [ ] `isWalking: boolean`
  - [ ] `walkDirection: Direction`
  - [ ] `initialTileX: number` (spawn position)
  - [ ] `initialTileY: number`
- [ ] Position interpolation during walks (1 pixel/frame = 16 frames/tile)

---

## Phase 2: Collision Detection

### 2.1 Collision Module
- [ ] Create `src/game/npc/NPCCollision.ts`
- [ ] `getCollisionInDirection(npc, direction, context)` returns:
  - `'none'` - can move
  - `'outside_range'` - exceeds movement bounds
  - `'impassable'` - wall/water/blocked
  - `'elevation_mismatch'` - different elevation
  - `'object_event'` - another NPC

### 2.2 Range Checking
- [ ] `isOutsideMovementRange(npc, targetX, targetY)`
- [ ] Calculate bounds from initial position ± range

### 2.3 Tile Walkability
- [ ] Use existing metatile behavior data
- [ ] Check `MB_NORMAL`, `MB_BLOCKED`, etc.
- [ ] Handle directional impassability (ledges, etc.)

### 2.4 NPC-NPC Collision
- [ ] Check if target tile is occupied by another NPC
- [ ] Match GBA behavior: blocked, not pass-through

---

## Phase 3: Movement Type Handlers

### 3.1 Handler Infrastructure
- [ ] Create `src/game/npc/movementTypes/` directory
- [ ] `MovementTypeHandler` interface
- [ ] Handler registry mapping movement type → handler

### 3.2 Static Types (Simplest)
- [ ] `faceDirection.ts` - FACE_UP/DOWN/LEFT/RIGHT
  - Just sets direction once, stays idle

### 3.3 Looking Types
- [ ] `lookAround.ts` - LOOK_AROUND
  - Random direction from 4 options
  - MEDIUM delay between looks
- [ ] `faceDirectional.ts` - FACE_DOWN_AND_UP, FACE_LEFT_AND_RIGHT, etc.
  - Random direction from 2-3 options
  - SHORT delay

### 3.4 Rotate Types
- [ ] `rotate.ts` - ROTATE_CLOCKWISE, ROTATE_COUNTERCLOCKWISE
  - Fixed sequence through 4 directions
  - 48-frame delay

### 3.5 Wander Types (Priority!)
- [ ] `wanderAround.ts` - WANDER_AROUND
  - Random direction from 4
  - Check collision before walking
  - MEDIUM delay
- [ ] `wanderDirectional.ts` - WANDER_UP_AND_DOWN, WANDER_LEFT_AND_RIGHT
  - Random direction from 2
  - Same logic, restricted directions

### 3.6 Walk Types
- [ ] `walkBackAndForth.ts` - WALK_UP_AND_DOWN, WALK_LEFT_AND_RIGHT
  - Continuous walking, reverse at range boundary
  - No delay between moves
- [ ] `walkSequence.ts` - WALK_SEQUENCE_* (24 variants)
  - Follow direction sequence
  - Lower priority (rare usage)

### 3.7 Walk In Place Types
- [ ] `walkInPlace.ts` - WALK_IN_PLACE_*, JOG_IN_PLACE_*, RUN_IN_PLACE_*
  - Play walk animation without moving
  - Different animation speeds

---

## Phase 4: Integration

### 4.1 Animation Integration
- [ ] Modify `NPCAnimationEngine.ts` to accept `isWalking` from movement engine
- [ ] Walking NPCs use GO_* animations
- [ ] Standing NPCs use FACE_* animations

### 4.2 Renderer Integration
- [ ] Modify `NPCRenderer.ts` to use sub-tile positions
  ```typescript
  const worldX = npc.tileX * 16 + npc.subTileX;
  const worldY = npc.tileY * 16 + npc.subTileY - spriteOffset;
  ```

### 4.3 Game Loop Integration
- [ ] Call `movementEngine.update(deltaMs)` each frame
- [ ] Before rendering, ensure all NPC states are current
- [ ] Handle pause/resume (don't accumulate time while paused)

### 4.4 Map Loading Integration
- [ ] Initialize movement state when NPCs are loaded
- [ ] Store initial position for range calculations
- [ ] Reset movement state on map change

---

## Phase 5: Testing

### 5.1 Basic Tests
- [ ] FACE_* NPCs don't move
- [ ] LOOK_AROUND NPCs turn but stay in place
- [ ] WANDER_AROUND NPCs move within their range

### 5.2 Collision Tests
- [ ] NPCs don't walk through walls
- [ ] NPCs don't leave their movement range
- [ ] NPCs don't overlap each other
- [ ] NPCs respect elevation

### 5.3 Timing Tests
- [ ] Delay durations feel right (compare to GBA)
- [ ] Walk speed matches GBA (16 frames/tile)
- [ ] Animation syncs with movement

### 5.4 Edge Cases
- [ ] NPCs with 0 range stay in place
- [ ] NPCs spawn at correct initial direction
- [ ] NPCs near map edge don't crash

---

## Files Summary

### New Files
```
src/game/npc/
├── NPCMovementEngine.ts      # Core movement state machine
├── NPCCollision.ts           # Collision detection
└── movementTypes/
    ├── index.ts              # Handler registry
    ├── faceDirection.ts      # FACE_* types
    ├── lookAround.ts         # LOOK_AROUND
    ├── faceDirectional.ts    # FACE_*_AND_* types
    ├── rotate.ts             # ROTATE_* types
    ├── wanderAround.ts       # WANDER_AROUND
    ├── wanderDirectional.ts  # WANDER_*_AND_* types
    ├── walkBackAndForth.ts   # WALK_*_AND_* types
    └── walkInPlace.ts        # *_IN_PLACE_* types
```

### Modified Files
```
src/types/objectEvents.ts     # Add movement fields to NPCObject
src/game/npc/NPCRenderer.ts   # Use sub-tile positions
src/game/npc/NPCAnimationEngine.ts  # Accept walking state
src/game/npc/index.ts         # Export movement engine
src/components/map/MapCanvas.tsx  # Call movement engine in loop
```

---

## Priority Order

1. **Core Engine** - Can't do anything without it
2. **FACE_* types** - Simplest, proves engine works
3. **LOOK_AROUND** - Adds delay timer logic
4. **Collision detection** - Needed for walking
5. **WANDER_AROUND** - The main goal!
6. **Position interpolation** - Smooth walking
7. **Animation integration** - Walk cycles work
8. **Other movement types** - Fill in the rest

---

## Notes

- Start simple: get one NPC wandering before optimizing
- Test frequently against GBA recordings
- Don't overcomplicate - match GBA behavior, not exceed it
- Remember: NPCs don't animate at rest (GBA-accurate!)
