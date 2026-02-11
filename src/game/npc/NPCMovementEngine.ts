/**
 * NPCMovementEngine - GBA-accurate NPC movement state machine
 *
 * Implements movement behaviors from pokeemerald's event_object_movement.c
 * Each NPC runs a state machine based on their movementType.
 *
 * Timing is frame-based (60fps = 16.67ms per frame) to match GBA behavior.
 */

import type { NPCObject, NPCDirection, NPCMovementType } from '../../types/objectEvents';
import { TICK_60FPS_MS } from '../../config/timing';
import { directionToOffset } from '../../utils/direction';

// GBA runs at 60fps
const FRAME_MS = TICK_60FPS_MS;

// Movement delay arrays from GBA (in frames)
// sMovementDelaysShort  = {32, 48, 64, 80}   -> 0.53-1.33 seconds
// sMovementDelaysMedium = {32, 64, 96, 128}  -> 0.53-2.13 seconds
export const MOVEMENT_DELAYS_SHORT = [32, 48, 64, 80];
export const MOVEMENT_DELAYS_MEDIUM = [32, 64, 96, 128];

// Direction constants matching GBA
export const DIR = {
  NONE: 0,
  SOUTH: 1, // down
  NORTH: 2, // up
  WEST: 3,  // left
  EAST: 4,  // right
} as const;

export type GBADirection = typeof DIR[keyof typeof DIR];

// Direction arrays for different movement types
export const STANDARD_DIRECTIONS: GBADirection[] = [DIR.SOUTH, DIR.NORTH, DIR.WEST, DIR.EAST];
export const UP_AND_DOWN_DIRECTIONS: GBADirection[] = [DIR.SOUTH, DIR.NORTH];
export const LEFT_AND_RIGHT_DIRECTIONS: GBADirection[] = [DIR.WEST, DIR.EAST];
export const CLOCKWISE_DIRECTIONS: GBADirection[] = [DIR.SOUTH, DIR.WEST, DIR.NORTH, DIR.EAST];
export const COUNTERCLOCKWISE_DIRECTIONS: GBADirection[] = [DIR.SOUTH, DIR.EAST, DIR.NORTH, DIR.WEST];

// Walk speed: 16 frames to move 1 tile (16 pixels)
export const WALK_FRAMES_PER_TILE = 16;

/**
 * Convert GBA direction to our direction type
 */
export function gbaToDirection(gbaDir: GBADirection): NPCDirection {
  switch (gbaDir) {
    case DIR.NORTH: return 'up';
    case DIR.SOUTH: return 'down';
    case DIR.WEST: return 'left';
    case DIR.EAST: return 'right';
    default: return 'down';
  }
}

/**
 * Convert our direction to GBA direction
 */
export function directionToGBA(dir: NPCDirection): GBADirection {
  switch (dir) {
    case 'up': return DIR.NORTH;
    case 'down': return DIR.SOUTH;
    case 'left': return DIR.WEST;
    case 'right': return DIR.EAST;
  }
}

/**
 * Get direction deltas for movement
 */
export function getDirectionDeltas(dir: GBADirection): { dx: number; dy: number } {
  if (dir === DIR.NONE) {
    return { dx: 0, dy: 0 };
  }
  return directionToOffset(gbaToDirection(dir));
}

/**
 * Movement state for a single NPC
 */
export interface NPCMovementState {
  /** NPC identifier */
  npcId: string;

  /** Current step in the movement type state machine */
  stepFuncId: number;

  /** Delay timer (in frames) */
  delayTimer: number;

  /** Current facing direction (GBA format) */
  facingDirection: GBADirection;

  /** Movement direction when walking (GBA format) */
  movementDirection: GBADirection;

  /** Whether currently executing a single movement action */
  singleMovementActive: boolean;

  /** Walking state */
  isWalking: boolean;
  /** True for animation-only walk actions (no tile displacement) */
  walkInPlace: boolean;

  /** Progress through current walk (0-15 sub-pixels) */
  walkProgress: number;

  /** Initial spawn position (for range checking) */
  initialTileX: number;
  initialTileY: number;

  /** Current sub-tile offset for smooth movement */
  subTileX: number;
  subTileY: number;

  /** Direction sequence index (for WALK_SEQUENCE types) */
  directionSequenceIndex: number;
}

/**
 * Result of a movement step function
 */
export interface MovementStepResult {
  /** Next step to execute (or same step to continue) */
  nextStep: number;
  /** Whether this step completed and we should run the next immediately */
  continueImmediately: boolean;
}

/**
 * Movement type handler interface
 */
export interface MovementTypeHandler {
  /** Get initial facing direction for this movement type */
  getInitialDirection(movementTypeRaw: string): GBADirection;

  /** Execute a step of the movement state machine */
  executeStep(
    npc: NPCObject,
    state: NPCMovementState,
    context: MovementContext
  ): MovementStepResult;
}

/**
 * Context passed to movement handlers
 */
export interface MovementContext {
  /** Check collision in a direction */
  getCollisionInDirection: (npc: NPCObject, state: NPCMovementState, direction: GBADirection) => CollisionResult;

  /** Random number generator (0-max) */
  random: (max: number) => number;
}

/**
 * Collision check results
 */
export type CollisionResult =
  | 'none'
  | 'outside_range'
  | 'impassable'
  | 'elevation_mismatch'
  | 'object_event';

/**
 * NPC position update from movement engine
 */
export interface NPCPositionUpdate {
  npcId: string;
  tileX: number;
  tileY: number;
  subTileX: number;
  subTileY: number;
  direction: NPCDirection;
  isWalking: boolean;
}

/**
 * Main NPC Movement Engine
 */
class NPCMovementEngineClass {
  private states: Map<string, NPCMovementState> = new Map();
  private handlers: Map<NPCMovementType, MovementTypeHandler> = new Map();
  private frameAccumulator: number = 0;
  private enabled: boolean = true;

  /**
   * Register a movement type handler
   */
  registerHandler(movementType: NPCMovementType, handler: MovementTypeHandler): void {
    this.handlers.set(movementType, handler);
  }

  /**
   * Initialize movement state for an NPC
   */
  initializeNPC(npc: NPCObject): void {
    const handler = this.handlers.get(npc.movementType);
    // Pass movementTypeRaw from map/script data (e.g. MOVEMENT_TYPE_JOG_IN_PLACE_RIGHT),
    // not the parsed enum key (e.g. walk_in_place), so directional variants initialize correctly.
    const initialDir = handler?.getInitialDirection(npc.movementTypeRaw) ?? directionToGBA(npc.direction);

    const state: NPCMovementState = {
      npcId: npc.id,
      stepFuncId: 0,
      delayTimer: 0,
      facingDirection: directionToGBA(npc.direction),
      movementDirection: initialDir,
      singleMovementActive: false,
      isWalking: false,
      walkInPlace: false,
      walkProgress: 0,
      initialTileX: npc.initialTileX ?? npc.tileX,
      initialTileY: npc.initialTileY ?? npc.tileY,
      subTileX: 0,
      subTileY: 0,
      directionSequenceIndex: 0,
    };

    this.states.set(npc.id, state);
  }

  /**
   * Remove movement state for an NPC
   */
  removeNPC(npcId: string): void {
    this.states.delete(npcId);
  }

  /**
   * Clear all movement states
   */
  clear(): void {
    this.states.clear();
    this.frameAccumulator = 0;
  }

  /**
   * Enable/disable the movement engine
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.frameAccumulator = 0;
    }
  }

  /**
   * Get movement state for an NPC
   */
  getState(npcId: string): NPCMovementState | undefined {
    return this.states.get(npcId);
  }

  /**
   * Update all NPCs for the given delta time
   * Returns position updates to apply to NPCObjects
   */
  update(deltaMs: number, npcs: NPCObject[], context: MovementContext): NPCPositionUpdate[] {
    if (!this.enabled) return [];

    // Accumulate time and convert to frames
    this.frameAccumulator += deltaMs;
    let framesToProcess = Math.floor(this.frameAccumulator / FRAME_MS);

    if (framesToProcess === 0) return [];

    // IMPORTANT: Cap frames to process per update to ensure smooth animation
    // Even if we're behind, only process 1 frame per update to keep movement smooth
    // This ensures NPCs move 1 pixel at a time visually, not teleporting
    // We also reset the accumulator to prevent "catching up" which causes teleporting
    if (framesToProcess > 1) {
      // Only process 1 frame, and reset accumulator to avoid buildup
      // This means we drop frames rather than batch them (smoother visually)
      framesToProcess = 1;
      this.frameAccumulator = 0; // Reset to prevent accumulation
    } else {
      this.frameAccumulator -= framesToProcess * FRAME_MS;
    }

    const updates: NPCPositionUpdate[] = [];

    // Process each NPC
    for (const npc of npcs) {
      if (!npc.visible) continue;

      let state = this.states.get(npc.id);
      if (!state) {
        this.initializeNPC(npc);
        state = this.states.get(npc.id)!;
      }

      const handler = this.handlers.get(npc.movementType);
      if (!handler) continue;

      // Process frames for this NPC
      for (let frame = 0; frame < framesToProcess; frame++) {
        // If walking, update position
        if (state.isWalking) {
          if (state.walkInPlace) {
            // Animation-only "walk in place": no tile/sub-tile displacement.
            state.subTileX = 0;
            state.subTileY = 0;
          } else {
            this.updateWalkProgress(npc, state);
          }
        }

        // Run movement state machine
        let iterations = 0;
        const maxIterations = 10; // Prevent infinite loops

        while (iterations < maxIterations) {
          const result = handler.executeStep(npc, state, context);
          state.stepFuncId = result.nextStep;

          if (!result.continueImmediately) break;
          iterations++;
        }
      }

      // Generate position update
      updates.push({
        npcId: npc.id,
        tileX: npc.tileX,
        tileY: npc.tileY,
        subTileX: state.subTileX,
        subTileY: state.subTileY,
        direction: gbaToDirection(state.facingDirection),
        isWalking: state.isWalking,
      });
    }

    return updates;
  }

  /**
   * Update walk progress for a walking NPC
   *
   * GBA behavior: NpcTakeStep is called every frame and moves sprite 1 pixel
   * toward the destination. The tile position was already set to destination
   * when walk started, so we're moving subTile from -16 toward 0.
   */
  private updateWalkProgress(_npc: NPCObject, state: NPCMovementState): void {
    state.walkProgress++;

    const { dx, dy } = getDirectionDeltas(state.movementDirection);

    // Update sub-tile position (move 1 pixel closer to destination each frame)
    // subTile started at -16 and moves toward 0
    // After 16 frames: subTile = -16 + 16 = 0
    state.subTileX = -dx * (16 - state.walkProgress);
    state.subTileY = -dy * (16 - state.walkProgress);

    // Check if walk is complete (16 frames = 1 tile)
    if (state.walkProgress >= WALK_FRAMES_PER_TILE) {
      // Reset sub-tile and walk state
      state.subTileX = 0;
      state.subTileY = 0;
      state.walkProgress = 0;
      state.isWalking = false;
      state.walkInPlace = false;
      state.singleMovementActive = false;
    }
  }
}

// Singleton instance
export const npcMovementEngine = new NPCMovementEngineClass();

// Helper functions for handlers

/**
 * Pick a random delay from an array
 */
export function pickRandomDelay(delays: number[], randomFn: (max: number) => number): number {
  return delays[randomFn(delays.length)];
}

/**
 * Pick a random direction from an array
 */
export function pickRandomDirection(directions: GBADirection[], randomFn: (max: number) => number): GBADirection {
  return directions[randomFn(directions.length)];
}

/**
 * Set the facing direction for an NPC
 */
export function setFacingDirection(state: NPCMovementState, direction: GBADirection): void {
  state.facingDirection = direction;
}

/**
 * Set the movement direction and start walking
 *
 * IMPORTANT: In GBA, when a walk starts:
 * - objectEvent->currentCoords is IMMEDIATELY set to destination tile
 * - sprite->x/y starts at the old position and animates toward the new tile
 *
 * This means walkProgress goes from 0 to 16, and subTileX/Y starts NEGATIVE
 * (offset from new tile position back toward old position)
 */
export function startWalking(state: NPCMovementState, direction: GBADirection, npc: NPCObject): void {
  const { dx, dy } = getDirectionDeltas(direction);

  state.movementDirection = direction;
  state.facingDirection = direction;
  state.isWalking = true;
  state.walkInPlace = false;
  state.walkProgress = 0;
  state.singleMovementActive = true;

  // GBA behavior: immediately update tile position to destination
  npc.tileX += dx;
  npc.tileY += dy;

  // Start subTile at -16 (we're visually at the OLD tile, moving toward NEW tile)
  // As walkProgress goes 0->16, subTile goes from -16 to 0
  state.subTileX = -dx * 16;
  state.subTileY = -dy * 16;
}

/**
 * Decrement delay timer and check if done
 */
export function waitForDelay(state: NPCMovementState): boolean {
  if (state.delayTimer > 0) {
    state.delayTimer--;
  }
  return state.delayTimer === 0;
}

/**
 * Set delay timer
 */
export function setDelay(state: NPCMovementState, frames: number): void {
  state.delayTimer = frames;
}
