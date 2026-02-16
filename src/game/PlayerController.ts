import type { MetatileAttributes, MapTileData } from '../utils/mapLoader';
import { isCollisionPassable } from '../utils/mapLoader';
import {
  MB_JUMP_EAST,
  MB_JUMP_WEST,
  MB_JUMP_NORTH,
  MB_JUMP_SOUTH,
  MB_SAND,
  MB_DEEP_SAND,
  MB_FOOTPRINTS,
  isDoorBehavior,
  requiresDoorExitSequence,
  isArrowWarpBehavior,
  isTallGrassBehavior,
  isLongGrassBehavior,
  isSurfableBehavior,
  isPuddleBehavior,
  hasRipplesBehavior,
  isIceBehavior,
  isForcedSlideBehavior,
  isForceWalkBehavior,
  isBikeRailBehavior,
  isAnyVerticalRailBehavior,
  isAnyHorizontalRailBehavior,
  isIsolatedVerticalRailBehavior,
  isIsolatedHorizontalRailBehavior,
  isVerticalRailBehavior,
  isHorizontalRailBehavior,
  isRunningDisallowedBehavior,
  isMuddySlopeBehavior,
  isBumpySlopeBehavior,
  getSlideDirection,
  getArrowDirectionFromBehavior,
} from '../utils/metatileBehaviors';
import { FieldEffectManager, type FieldEffectDirection } from './FieldEffectManager';
import { SurfingController } from './surfing';
import {
  getPlayerSpriteFrameMetrics,
  resolvePlayerSpriteFrameIndex,
  type PlayerSpriteKey,
} from './playerSprites';
import { getShadowPosition } from '../rendering/spriteUtils';
import { loadImageCanvasAsset } from '../utils/assetLoader';
import { createLogger } from '../utils/logger';
import { isDebugMode } from '../utils/debug';
import { directionToOffset } from '../utils/direction';
import { areElevationsCompatible } from '../utils/elevation';
import { JUMP_ARC_HIGH, JUMP_ARC_NORMAL, JUMP_ARC_LOW } from './jumpArc';
import { inputMap, GameButton } from '../core/InputMap';
import { getUnderwaterBobOffset as getUnderwaterBobOffsetAtTime } from './playerBobbing';
import { getSurfingFrameSelection } from './playerFrameSelection';
import { gameFlags } from './GameFlags';

const playerLogger = createLogger('PlayerController');

export interface ResolvedTileInfo {
  mapTile: MapTileData;  // CHANGED: was number, now MapTileData
  attributes?: MetatileAttributes;
}

export type TileResolver = (tileX: number, tileY: number) => ResolvedTileInfo | null;

/**
 * Callback to check if there's an object (NPC, item ball, etc.) blocking a tile
 * Returns true if the tile is blocked by an object
 */
export type ObjectCollisionChecker = (tileX: number, tileY: number) => boolean;
export type DynamicCollisionChecker = (
  tileX: number,
  tileY: number,
  direction: 'up' | 'down' | 'left' | 'right'
) => boolean;

export interface DoorWarpRequest {
  targetX: number;
  targetY: number;
  behavior: number;
}

export interface FrameInfo {
  spriteKey: PlayerSpriteKey;
  sprite: HTMLCanvasElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  renderX: number;
  renderY: number;
  flip: boolean;
}

export type TraversalMode = 'land' | 'surf' | 'underwater';
export type BikeMode = 'none' | 'mach' | 'acro';

// Jump Physics Constants (arc tables imported from jumpArc.ts)
const JUMP_DISTANCE_FAR = 32;    // 2-tile ledge jump (pixels)
const JUMP_DISTANCE_NORMAL = 16; // 1-tile normal jump (pixels)

function getBikeTrackDirection(
  previousDirection: 'up' | 'down' | 'left' | 'right',
  currentDirection: 'up' | 'down' | 'left' | 'right'
): FieldEffectDirection {
  if (previousDirection === currentDirection) {
    return currentDirection;
  }

  // Mirrors bikeTireTracks_Transitions from pokeemerald.
  const transitions: Record<string, FieldEffectDirection> = {
    'up:right': 'turn_se',
    'up:left': 'turn_sw',
    'down:right': 'turn_ne',
    'down:left': 'turn_nw',
    'left:up': 'turn_ne',
    'left:down': 'turn_se',
    'right:up': 'turn_nw',
    'right:down': 'turn_sw',
  };

  return transitions[`${previousDirection}:${currentDirection}`] ?? currentDirection;
}

// --- Player States ---

interface PlayerState {
  enter(controller: PlayerController): void;
  exit(controller: PlayerController): void;
  update(controller: PlayerController, delta: number): boolean;
  handleInput(controller: PlayerController, keys: { [key: string]: boolean }): void;
  getFrameInfo(controller: PlayerController): FrameInfo | null;
  getSpeed(): number;
}

class NormalState implements PlayerState {
  // Speed in pixels per millisecond
  // 0.06 px/ms is approx 3.6 px/frame at 60fps (16px tile / 4.4 frames)
  // Original GBA walk speed is 1 px/frame (running at 60fps) -> 16 frames per tile.
  // Wait, GBA runs at 60fps. Walk speed is 1 pixel per frame. 16 pixels = 16 frames.
  // 1 px / 16.66ms = 0.06 px/ms. So 0.06 is correct for walking.
  private readonly SPEED = 0.06;

  enter(_controller: PlayerController): void {
    // Ensure we are using the walking sprite
    // controller.setSprite('walking'); // We'll implement sprite switching logic in getFrameInfo or similar
  }

  exit(_controller: PlayerController): void {}

  update(controller: PlayerController, delta: number): boolean {
    const wasMoving = controller.isMoving;
    const result = controller.processMovement(delta, this.SPEED);
    // After movement completes, check for special tile behaviors (ice, slide, forced walk)
    if (wasMoving && !controller.isMoving) {
      if (controller.checkAndHandleSpecialTile()) return true;
    }
    return result;
  }

  handleInput(controller: PlayerController, keys: { [key: string]: boolean }): void {
    // On ice: directional input starts a slide, no running/normal walking
    const currentBehavior = controller.getCurrentTileBehavior();
    if (currentBehavior !== undefined && isIceBehavior(currentBehavior)) {
      let newDir: 'up' | 'down' | 'left' | 'right' | null = null;
      if (inputMap.isHeldInRecord(keys, GameButton.UP)) newDir = 'up';
      else if (inputMap.isHeldInRecord(keys, GameButton.DOWN)) newDir = 'down';
      else if (inputMap.isHeldInRecord(keys, GameButton.LEFT)) newDir = 'left';
      else if (inputMap.isHeldInRecord(keys, GameButton.RIGHT)) newDir = 'right';
      if (newDir) {
        controller.dir = newDir;
        controller.changeState(new IceSlidingState());
      }
      return;
    }

    // Check for transition to running (B held, disabled on long grass)
    if (inputMap.isHeldInRecord(keys, GameButton.B) && !controller.isOnLongGrass()) {
      controller.changeState(new RunningState());
      return;
    }

    // Check for ledge jumping
    if (controller.checkForLedgeJump(keys)) {
      return;
    }

    controller.handleDirectionInput(keys);
  }

  getFrameInfo(controller: PlayerController): FrameInfo | null {
    return controller.calculateFrameInfo('walking');
  }

  getSpeed(): number {
    return this.SPEED;
  }
}

class RunningState implements PlayerState {
  // Running speed is double walking speed
  private readonly SPEED = 0.12;

  enter(_controller: PlayerController): void {
    // controller.setSprite('running');
  }

  exit(_controller: PlayerController): void {}

  update(controller: PlayerController, delta: number): boolean {
    const wasMoving = controller.isMoving;
    const result = controller.processMovement(delta, this.SPEED);
    // After movement completes, check for special tile behaviors (ice, slide, forced walk)
    if (wasMoving && !controller.isMoving) {
      if (controller.checkAndHandleSpecialTile()) return true;
    }
    return result;
  }

  handleInput(controller: PlayerController, keys: { [key: string]: boolean }): void {
    // Check for transition back to walking (B released)
    if (!inputMap.isHeldInRecord(keys, GameButton.B)) {
      controller.changeState(new NormalState());
      return;
    }

    // Check for ledge jumping (pass true for wasRunning)
    if (controller.checkForLedgeJump(keys, true)) {
      return;
    }

    controller.handleDirectionInput(keys);
  }

  getFrameInfo(controller: PlayerController): FrameInfo | null {
    return controller.calculateFrameInfo('running');
  }

  getSpeed(): number {
    return this.SPEED;
  }

}

class BikeState implements PlayerState {
  private mode: Exclude<BikeMode, 'none'>;

  constructor(mode: Exclude<BikeMode, 'none'>) {
    this.mode = mode;
  }

  enter(controller: PlayerController): void {
    controller.onBikeStateEnter(this.mode);
  }

  exit(_controller: PlayerController): void {}

  update(controller: PlayerController, delta: number): boolean {
    const wasMoving = controller.isMoving;
    const speed = controller.getBikeMovementSpeed(this.mode);
    const result = controller.processMovement(delta, speed);
    if (wasMoving && !controller.isMoving) {
      if (controller.checkAndHandleSpecialTile()) return true;
    }
    return result;
  }

  handleInput(controller: PlayerController, keys: { [key: string]: boolean }): void {
    controller.handleBikeInput(keys, this.mode);
  }

  getFrameInfo(controller: PlayerController): FrameInfo | null {
    return controller.calculateFrameInfo(this.mode === 'mach' ? 'machBike' : 'acroBike');
  }

  getSpeed(): number {
    return 0.06;
  }
}

// C refs: public/pokeemerald/src/bike.c (Acro state machine) and
// public/pokeemerald/src/field_player_avatar.c (PlayerAcroTurnJump).
class AcroBunnyHopState implements PlayerState {
  private elapsedMs = 0;
  private readonly DURATION_MS = 16 * (1000 / 60); // ~16 frames

  enter(controller: PlayerController): void {
    controller.isMoving = true;
    controller.showShadow = true;
    controller.spriteYOffset = 0;
    this.elapsedMs = 0;
  }

  exit(controller: PlayerController): void {
    controller.isMoving = false;
    controller.showShadow = false;
    controller.spriteYOffset = 0;
  }

  update(controller: PlayerController, delta: number): boolean {
    this.elapsedMs += delta;

    const progress = Math.min(1, this.elapsedMs / this.DURATION_MS);
    const arcIndex = Math.min(
      JUMP_ARC_HIGH.length - 1,
      Math.floor(progress * (JUMP_ARC_HIGH.length - 1))
    );
    controller.spriteYOffset = JUMP_ARC_HIGH[arcIndex];

    if (progress >= 1) {
      controller.changeState(new BikeState('acro'));
    }

    return true;
  }

  handleInput(_controller: PlayerController, _keys: { [key: string]: boolean }): void {
    // Input locked during hop.
  }

  getFrameInfo(controller: PlayerController): FrameInfo | null {
    return controller.calculateFrameInfo('acroBike', true);
  }

  getSpeed(): number {
    return 0;
  }
}

class AcroTurnJumpState implements PlayerState {
  private readonly targetDirection: 'up' | 'down' | 'left' | 'right';
  private elapsedMs = 0;
  private readonly DURATION_MS = 14 * (1000 / 60); // ~14 frames

  constructor(targetDirection: 'up' | 'down' | 'left' | 'right') {
    this.targetDirection = targetDirection;
  }

  enter(controller: PlayerController): void {
    controller.dir = this.targetDirection;
    controller.isMoving = true;
    controller.showShadow = true;
    controller.spriteYOffset = 0;
    this.elapsedMs = 0;
  }

  exit(controller: PlayerController): void {
    controller.isMoving = false;
    controller.showShadow = false;
    controller.spriteYOffset = 0;
  }

  update(controller: PlayerController, delta: number): boolean {
    this.elapsedMs += delta;

    const progress = Math.min(1, this.elapsedMs / this.DURATION_MS);
    const arcIndex = Math.min(
      JUMP_ARC_NORMAL.length - 1,
      Math.floor(progress * (JUMP_ARC_NORMAL.length - 1))
    );
    controller.spriteYOffset = JUMP_ARC_NORMAL[arcIndex];

    if (progress >= 1) {
      controller.changeState(new BikeState('acro'));
    }

    return true;
  }

  handleInput(_controller: PlayerController, _keys: { [key: string]: boolean }): void {
    // Input locked during turn-jump.
  }

  getFrameInfo(controller: PlayerController): FrameInfo | null {
    return controller.calculateFrameInfo('acroBike', true);
  }

  getSpeed(): number {
    return 0;
  }
}

class JumpingState implements PlayerState {
  private progress: number = 0; // Pixels moved
  private readonly SPEED = 0.06; // 1px/frame approx
  private startX: number = 0;
  private startY: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;
  private landingTileX: number = 0;
  private landingTileY: number = 0;
  private ledgeTileX: number = 0;
  private ledgeTileY: number = 0;
  private farJumpMidpointApplied: boolean = false;
  private wasRunning: boolean;
  private jumpDistance: number;
  private jumpArc: readonly number[];
  private movementDirection: 'up' | 'down' | 'left' | 'right' | null;
  private restoreFacingDirectionOnExit: 'up' | 'down' | 'left' | 'right' | null;

  constructor(
    wasRunning: boolean = false,
    jumpDistance = JUMP_DISTANCE_FAR,
    jumpArc = JUMP_ARC_HIGH,
    movementDirection: 'up' | 'down' | 'left' | 'right' | null = null,
    restoreFacingDirectionOnExit: 'up' | 'down' | 'left' | 'right' | null = null
  ) {
    this.wasRunning = wasRunning;
    this.jumpDistance = jumpDistance;
    this.jumpArc = jumpArc;
    this.movementDirection = movementDirection;
    this.restoreFacingDirectionOnExit = restoreFacingDirectionOnExit;
  }

  enter(controller: PlayerController): void {
    controller.isMoving = true;
    controller.showShadow = true;
    this.progress = 0;
    this.startX = controller.x;
    this.startY = controller.y;
    this.farJumpMidpointApplied = false;

    // Calculate target position based on jump distance.
    const jumpDirection = this.movementDirection ?? controller.dir;
    const move = directionToOffset(jumpDirection);
    const dx = move.dx * this.jumpDistance;
    const dy = move.dy * this.jumpDistance;

    this.targetX = this.startX + dx;
    this.targetY = this.startY + dy;

    const originTileX = controller.tileX;
    const originTileY = controller.tileY;
    const tileDelta = Math.round(this.jumpDistance / 16);
    this.ledgeTileX = originTileX + move.dx;
    this.ledgeTileY = originTileY + move.dy;
    this.landingTileX = originTileX + move.dx * tileDelta;
    this.landingTileY = originTileY + move.dy * tileDelta;

    // Object-event progression parity:
    // - far jump: origin -> ledge on enter, then ledge -> landing at midpoint
    // - normal jump: origin -> landing on enter
    if (this.jumpDistance > 16) {
      controller.setJumpObjectCurrentTile(this.ledgeTileX, this.ledgeTileY);
    } else {
      controller.setJumpObjectCurrentTile(this.landingTileX, this.landingTileY);
      this.farJumpMidpointApplied = true;
    }

    // Update logical tile position immediately to the destination
    // This prevents other events from triggering on the jump-over tile
    controller.tileX = this.landingTileX;
    controller.tileY = this.landingTileY;
  }

  exit(controller: PlayerController): void {
    controller.isMoving = false;
    controller.showShadow = false;
    controller.spriteYOffset = 0;

    // Snap to exact target position
    controller.x = this.targetX;
    controller.y = this.targetY;
    controller.tileX = this.landingTileX;
    controller.tileY = this.landingTileY;
    controller.settleJumpObjectCoords(this.landingTileX, this.landingTileY);

    if (this.restoreFacingDirectionOnExit) {
      controller.dir = this.restoreFacingDirectionOnExit;
    }

    // CRITICAL: Update elevation upon landing!
    // Otherwise collision system thinks we are still at old elevation
    controller.updateElevation();

    // Update previous tile state so subsequent movements track correctly
    controller.updatePreviousTileStatePublic();

    // Trigger grass effect on landing tile (like GroundEffect_JumpLanding in pokeemerald)
    controller.triggerGrassEffectOnLanding();
  }

  update(controller: PlayerController, delta: number): boolean {
    // Move player
    const moveAmount = this.SPEED * delta;
    this.progress += moveAmount;

    if (this.progress >= this.jumpDistance) {
      // Jump finished - restore movement mode.
      const bikeMode = controller.getBikeMode();
      if (bikeMode === 'mach' || bikeMode === 'acro') {
        controller.changeState(new BikeState(bikeMode));
      } else if (this.wasRunning) {
        controller.changeState(new RunningState());
      } else {
        controller.changeState(new NormalState());
      }
      return true;
    }

    const jumpDirection = this.movementDirection ?? controller.dir;
    const move = directionToOffset(jumpDirection);
    controller.x = this.startX + move.dx * this.progress;
    controller.y = this.startY + move.dy * this.progress;

    // Far-jump object-event progression:
    // enter puts current at ledge (+1), midpoint moves current to landing (+2).
    if (!this.farJumpMidpointApplied && this.jumpDistance > 16 && this.progress >= 16) {
      controller.setJumpObjectCurrentTile(this.landingTileX, this.landingTileY);
      this.farJumpMidpointApplied = true;
    }

    // Calculate jump height from arc table
    // Map progress (0..jumpDistance) to arc index (0..15)
    const index = Math.min(15, Math.floor(this.progress * 16 / this.jumpDistance));
    controller.spriteYOffset = this.jumpArc[index];

    return true;
  }

  handleInput(_controller: PlayerController, _keys: { [key: string]: boolean }): void {
    // Input locked during jump
  }

  getFrameInfo(controller: PlayerController): FrameInfo | null {
    const bikeMode = controller.getBikeMode();
    if (bikeMode === 'mach' || bikeMode === 'acro') {
      return controller.calculateFrameInfo(bikeMode === 'mach' ? 'machBike' : 'acroBike', true);
    }
    return controller.calculateFrameInfo('walking', true);
  }

  getSpeed(): number {
    return this.SPEED;
  }
}

class SurfingState implements PlayerState {
  // Surfing uses MOVE_SPEED_FAST_1 = 2 pixels per frame (same as running)
  // Walking is 1 pixel per frame (SPEED = 0.06 px/ms at 60fps ≈ 1 px/frame)
  // Surfing is 2x faster: 0.12 px/ms ≈ 2 px/frame
  private readonly SPEED = 0.12;

  enter(_controller: PlayerController): void {
    // Switch to surfing sprite will be handled by getFrameInfo
  }

  exit(_controller: PlayerController): void {}

  update(controller: PlayerController, delta: number): boolean {
    // Update surfing controller (handles bob animation)
    // delta is in milliseconds for frame-rate independent bobbing
    controller.updateSurfing(delta);
    return controller.processMovement(delta, this.SPEED);
  }

  handleInput(controller: PlayerController, keys: { [key: string]: boolean }): void {
    // Handle surfing movement - can only move on water tiles
    controller.handleSurfingInput(keys);
  }

  getFrameInfo(controller: PlayerController): FrameInfo | null {
    // Use surfing sprite (32x32 frames)
    const frame = controller.calculateSurfingFrameInfo();
    if (frame) {
      // Apply player bob offset (uses getPlayerBobOffset which respects BOB_JUST_MON mode)
      const bobOffset = controller.getSurfingController().getBlobRenderer().getPlayerBobOffset();
      frame.renderY += bobOffset;
    }
    return frame;
  }

  getSpeed(): number {
    return this.SPEED;
  }
}

class UnderwaterState implements PlayerState {
  private readonly SPEED = 0.06;

  enter(_controller: PlayerController): void {}
  exit(_controller: PlayerController): void {}

  update(controller: PlayerController, delta: number): boolean {
    controller.updateUnderwaterBob(delta);
    const wasMoving = controller.isMoving;
    const result = controller.processMovement(delta, this.SPEED);
    if (wasMoving && !controller.isMoving) {
      if (controller.checkAndHandleSpecialTile()) return true;
    }
    return result;
  }

  handleInput(controller: PlayerController, keys: { [key: string]: boolean }): void {
    // C parity: no B-button running while underwater.
    if (controller.checkForLedgeJump(keys)) {
      return;
    }
    controller.handleDirectionInput(keys);
  }

  getFrameInfo(controller: PlayerController): FrameInfo | null {
    const frame = controller.calculateFrameInfo('underwater');
    if (frame) {
      frame.renderY += controller.getUnderwaterBobOffset();
    }
    return frame;
  }

  getSpeed(): number {
    return this.SPEED;
  }
}

class SurfJumpingState implements PlayerState {
  private readonly SPEED = 0.06;
  private isMount: boolean;

  constructor(isMount: boolean) {
    this.isMount = isMount;
  }

  enter(controller: PlayerController): void {
    controller.isMoving = true;
    controller.showShadow = true;
  }

  exit(controller: PlayerController): void {
    controller.isMoving = false;
    controller.showShadow = false;
    controller.spriteYOffset = 0;
  }

  update(controller: PlayerController, delta: number): boolean {
    const surfController = controller.getSurfingController();
    // Pass delta for frame-rate independent bobbing
    const result = surfController.update(delta);

    // Apply jump Y offset
    controller.spriteYOffset = result.jumpYOffset;

    // Calculate new position based on jump progress
    const jumpStart = surfController.getJumpStartPosition();
    const jumpDir = surfController.getJumpDirection();
    if (jumpStart && jumpDir) {
      let dx = 0, dy = 0;
      if (jumpDir === 'left') dx = -1;
      else if (jumpDir === 'right') dx = 1;
      else if (jumpDir === 'up') dy = -1;
      else if (jumpDir === 'down') dy = 1;

      controller.x = jumpStart.x + dx * result.jumpXProgress;
      controller.y = jumpStart.y + dy * result.jumpXProgress;
    }

    if (result.jumpComplete) {
      if (this.isMount) {
        // Mount complete - switch to surfing state
        if (result.newTileX !== undefined && result.newTileY !== undefined) {
          controller.tileX = result.newTileX;
          controller.tileY = result.newTileY;
          controller.x = result.newTileX * 16;
          controller.y = result.newTileY * 16 - 16;
        }
        controller.updateElevation();
        controller.setTraversalMode('surf');
        controller.changeState(new SurfingState());
      } else {
        // Dismount complete - switch to normal state
        if (result.newTileX !== undefined && result.newTileY !== undefined) {
          controller.tileX = result.newTileX;
          controller.tileY = result.newTileY;
          controller.x = result.newTileX * 16;
          controller.y = result.newTileY * 16 - 16;
        }
        controller.updateElevation();
        controller.setTraversalMode('land');
        controller.changeState(new NormalState());
      }
      return true;
    }

    return true;
  }

  handleInput(_controller: PlayerController, _keys: { [key: string]: boolean }): void {
    // Input locked during surf jump
  }

  getFrameInfo(controller: PlayerController): FrameInfo | null {
    // Use surfing sprite (32x32 frames) during mount/dismount
    const frame = controller.calculateSurfingFrameInfo();
    if (frame) {
      // During jump: apply jump Y offset (from spriteYOffset which is set in update())
      frame.renderY += controller.spriteYOffset;
    }
    return frame;
  }

  getSpeed(): number {
    return this.SPEED;
  }
}

/**
 * Ice sliding state - player auto-slides in their current direction on ice tiles.
 * Continues until hitting a wall or leaving ice.
 * Reference: Sootopolis Gym ice floor puzzle.
 */
class IceSlidingState implements PlayerState {
  private readonly SPEED = 0.06; // Same as walking

  enter(controller: PlayerController): void {
    // Start sliding in the player's current facing direction
    if (!controller.forceMove(controller.dir)) {
      // Immediately blocked (wall right next to player) - stop
      controller.changeState(new NormalState());
    }
  }

  exit(_controller: PlayerController): void {}

  update(controller: PlayerController, delta: number): boolean {
    const wasMoving = controller.isMoving;
    const result = controller.processMovement(delta, this.SPEED);

    if (wasMoving && !controller.isMoving) {
      // Tile movement completed - check if we should continue sliding
      const behavior = controller.getCurrentTileBehavior();
      if (behavior !== undefined && isIceBehavior(behavior)) {
        // Still on ice - try to continue sliding in the same direction
        if (!controller.forceMove(controller.dir)) {
          // Hit a wall - stop on this ice tile
          controller.changeState(new NormalState());
        }
      } else {
        // Slid off ice onto non-ice tile - check for other special tiles first
        if (!controller.checkAndHandleSpecialTile()) {
          controller.changeState(new NormalState());
        }
      }
    }

    return result;
  }

  handleInput(_controller: PlayerController, _keys: { [key: string]: boolean }): void {
    // Input locked during ice sliding
  }

  getFrameInfo(controller: PlayerController): FrameInfo | null {
    return controller.calculateFrameInfo('walking', true);
  }

  getSpeed(): number {
    return this.SPEED;
  }
}

/**
 * Forced slide state - player slides in the direction specified by the tile.
 * Continues on subsequent slide tiles; stops on non-slide tiles or walls.
 * Reference: Mossdeep Gym arrow tiles, Trick House spinners.
 */
class ForcedSlideState implements PlayerState {
  private readonly SPEED = 0.06; // Same as walking
  private slideDirection: 'up' | 'down' | 'left' | 'right';

  constructor(direction: 'up' | 'down' | 'left' | 'right') {
    this.slideDirection = direction;
  }

  enter(controller: PlayerController): void {
    // Face and start moving in the tile's specified direction
    controller.dir = this.slideDirection;
    if (!controller.forceMove(this.slideDirection)) {
      // Immediately blocked - stop
      controller.changeState(new NormalState());
    }
  }

  exit(_controller: PlayerController): void {}

  update(controller: PlayerController, delta: number): boolean {
    const wasMoving = controller.isMoving;
    const result = controller.processMovement(delta, this.SPEED);

    if (wasMoving && !controller.isMoving) {
      // Tile movement completed - check if new tile is also a forced slide
      const behavior = controller.getCurrentTileBehavior();
      if (behavior !== undefined && isForcedSlideBehavior(behavior)) {
        const newDir = getSlideDirection(behavior);
        if (newDir) {
          this.slideDirection = newDir;
          controller.dir = newDir;
          if (!controller.forceMove(newDir)) {
            // Blocked - stop
            controller.changeState(new NormalState());
          }
        } else {
          controller.changeState(new NormalState());
        }
      } else {
        // No longer on slide tile - check for other special tiles first
        if (!controller.checkAndHandleSpecialTile()) {
          controller.changeState(new NormalState());
        }
      }
    }

    return result;
  }

  handleInput(_controller: PlayerController, _keys: { [key: string]: boolean }): void {
    // Input locked during forced slide
  }

  getFrameInfo(controller: PlayerController): FrameInfo | null {
    return controller.calculateFrameInfo('walking', true);
  }

  getSpeed(): number {
    return this.SPEED;
  }
}

// --- Player Controller ---

export class PlayerController {
  public x: number = 0;
  public y: number = 0;
  public tileX: number = 0;
  public tileY: number = 0;
  public dir: 'down' | 'up' | 'left' | 'right' = 'down';
  public isMoving: boolean = false;
  public inputLocked: boolean = false;
  
  public pixelsMoved: number = 0;
  public spriteYOffset: number = 0;
  public showShadow: boolean = false;
  private sprites: { [key: string]: HTMLCanvasElement } = {};
  private keysPressed: { [key: string]: boolean } = {};
  public walkFrameAlternate: boolean = false; // Alternates between walk frame 1 and 2
  // Scripted applymovement may need per-step speed overrides (C MOVE_SPEED_* parity).
  private scriptedMoveSpeedPxPerMs: number | null = null;
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;
  private tileResolver: TileResolver | null = null;
  private doorWarpHandler: ((request: DoorWarpRequest) => void) | null = null;
  private objectCollisionChecker: ObjectCollisionChecker | null = null;
  private dynamicCollisionChecker: DynamicCollisionChecker | null = null;
  
  private currentState: PlayerState;
  private grassEffectManager: FieldEffectManager = new FieldEffectManager();
  private currentGrassType: 'long' | null = null; // Track if on long grass (for clipping)
  private surfingController: SurfingController = new SurfingController();
  private traversalMode: TraversalMode = 'land';
  private underwaterBobElapsedMs: number = 0;
  private bikeMode: BikeMode = 'none';
  private bikeRiding: boolean = false;
  private scriptSpriteOverride: PlayerSpriteKey | null = null;
  private machBikeSpeedTier: 0 | 1 | 2 = 0;
  private previousTrackDirection: 'up' | 'down' | 'left' | 'right' = 'down';
  private mapAllowsCyclingResolver: (() => boolean) | null = null;
  private cyclingRoadChallengeActive: boolean = false;
  private cyclingRoadCollisions: number = 0;

  private readonly BIKE_SPEED_WALK = 0.06;
  private readonly BIKE_SPEED_FAST = 0.12;
  private readonly BIKE_SPEED_FASTER = 0.18;
  private readonly BIKE_SPEED_FASTEST = 0.24;

  // Previous tile tracking (for sand footprints - they appear on tile you LEFT)
  private prevTileX: number;
  private prevTileY: number;
  private prevTileBehavior: number | undefined;

  // Object-event coordinate tracking (pokeemerald currentCoords/previousCoords parity).
  // While moving, current is destination and previous is origin.
  private objCurrentTileX: number;
  private objCurrentTileY: number;
  private objPreviousTileX: number;
  private objPreviousTileY: number;
  
  /**
   * Player's current elevation (from current tile)
   * Reference: ObjectEvent.currentElevation in public/pokeemerald/include/global.fieldmap.h
   */
  private currentElevation: number = 0;
  
  /**
   * Player's previous elevation (used for RENDERING priority, not collision!)
   * Reference: ObjectEvent.previousElevation and PlayerGetElevation()
   * in public/pokeemerald/src/field_player_avatar.c:1188
   *
   * Only updated when stepping onto tiles with elevation 1-14.
   * Preserved when stepping onto elevation 0 or 15 tiles.
   */
  private previousElevation: number = 0;

  /**
   * Map elevation of the tile the player was standing on before the current move.
   * Used for the GBA elevation 15 rule: if EITHER current or previous tile
   * has elevation 15, don't update any elevation fields.
   */
  private previousTileElevation: number = 0;

  private readonly TILE_PIXELS = 16;
  // Keys that should have their default browser behavior prevented.
  // Derived from InputMap bindings (uses e.code values).
  private static readonly GAME_CONTROL_KEYS = inputMap.getAllCodes();

  private debugLog(...args: unknown[]): void {
    if (!(isDebugMode() || isDebugMode('field'))) return;
    playerLogger.debug(...args);
  }

  private debugWarn(...args: unknown[]): void {
    if (!(isDebugMode() || isDebugMode('field'))) return;
    playerLogger.warn(...args);
  }

  constructor() {
    this.currentState = new NormalState();
    this.handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default browser behavior for game control keys (uses e.code)
      if (PlayerController.GAME_CONTROL_KEYS.has(e.code)) {
        e.preventDefault();
      }
      this.keysPressed[e.code] = true;
    };
    this.handleKeyUp = (e: KeyboardEvent) => {
      if (PlayerController.GAME_CONTROL_KEYS.has(e.code)) {
        e.preventDefault();
      }
      this.keysPressed[e.code] = false;
    };

    // Initialize prevTileX/Y to current position, behavior to undefined
    this.prevTileX = this.tileX;
    this.prevTileY = this.tileY;
    this.prevTileBehavior = undefined;

    // Initialize object-event coords to current tile.
    this.objCurrentTileX = this.tileX;
    this.objCurrentTileY = this.tileY;
    this.objPreviousTileX = this.tileX;
    this.objPreviousTileY = this.tileY;

    this.bindInputEvents();
  }

  private bindInputEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  /**
   * Begin an object-event step (GBA currentCoords/previousCoords behavior):
   * previous <- current, current <- target
   */
  private beginObjectStep(targetTileX: number, targetTileY: number): void {
    this.objPreviousTileX = this.objCurrentTileX;
    this.objPreviousTileY = this.objCurrentTileY;
    this.objCurrentTileX = targetTileX;
    this.objCurrentTileY = targetTileY;
  }

  /**
   * Settle object-event coords after movement completes:
   * previous = current = landed tile
   */
  private settleObjectStepAt(tileX: number, tileY: number): void {
    this.objCurrentTileX = tileX;
    this.objCurrentTileY = tileY;
    this.objPreviousTileX = tileX;
    this.objPreviousTileY = tileY;
  }

  /**
   * Sync object-event coords to the player's current tile.
   * Used when movement is interrupted/reset.
   */
  private syncObjectCoordsToTile(): void {
    this.settleObjectStepAt(this.tileX, this.tileY);
  }

  /**
   * Internal state hook for jump movement phases.
   * Uses beginObjectStep semantics to preserve previous/current parity.
   */
  public setJumpObjectCurrentTile(targetTileX: number, targetTileY: number): void {
    this.beginObjectStep(targetTileX, targetTileY);
  }

  /**
   * Internal state hook for jump completion.
   */
  public settleJumpObjectCoords(tileX: number, tileY: number): void {
    this.settleObjectStepAt(tileX, tileY);
  }

  public async loadSprite(key: string, src: string): Promise<void> {
    this.sprites[key] = await loadImageCanvasAsset(src, {
      transparency: { type: 'top-left' },
    });
  }

  public setPosition(tileX: number, tileY: number) {
    if (isDebugMode()) {
      const oldX = this.tileX;
      const oldY = this.tileY;
      const oldPixelX = this.x;
      const oldPixelY = this.y;
      this.debugLog(`[TELEPORT_DEBUG] setPosition called: (${oldX},${oldY}) -> (${tileX},${tileY})`,
        `pixel: (${oldPixelX?.toFixed(1)},${oldPixelY?.toFixed(1)}) -> (${tileX * this.TILE_PIXELS},${tileY * this.TILE_PIXELS - 16})`,
        new Error().stack?.split('\n').slice(1, 5).join(' <- '));
    }

    this.tileX = tileX;
    this.tileY = tileY;
    this.x = tileX * this.TILE_PIXELS;
    this.y = tileY * this.TILE_PIXELS - 16; // Sprite is 32px tall, feet at bottom
    this.previousTrackDirection = this.dir;
    this.isMoving = false;
    this.pixelsMoved = 0;
    this.scriptedMoveSpeedPxPerMs = null;
    this.syncObjectCoordsToTile();
    
    // Initialize elevation from spawn tile
    const resolved = this.tileResolver?.(this.tileX, this.tileY);
    if (resolved) {
      this.currentElevation = resolved.mapTile.elevation;
      // Match base game: start with the actual tile elevation (even 0/15)
      this.previousElevation = this.currentElevation;
      
      if (isDebugMode()) {
        this.debugLog(`[SPAWN] Player spawned at (${tileX}, ${tileY}) with elevation ${this.currentElevation}, set previousElevation to ${this.previousElevation}`);
      }
    } else {
      this.currentElevation = 0;
      this.previousElevation = 3; // Default to ground (3) instead of 0
      if (isDebugMode()) {
        this.debugWarn(`[SPAWN] Player spawned at (${tileX}, ${tileY}) but tile not found, defaulting to elevation 0 (prev 3)`);
      }
    }
    
    // Initialize previous tile state to current position
    this.updatePreviousTileState();
    // Check if spawning on tall grass (skip animation)
    this.checkAndTriggerGrassEffect(tileX, tileY, true);
  }

  public setPositionAndDirection(tileX: number, tileY: number, dir: 'down' | 'up' | 'left' | 'right') {
    this.setPosition(tileX, tileY);
    this.dir = dir;
    this.previousTrackDirection = dir;
  }

  /**
   * Reset all map-specific state when warping to a new map.
   * Called at the start of executeWarp() before setting new position.
   *
   * Clears:
   * - Player movement state (resets to walking)
   * - Key input state (prevents held keys from carrying over)
   * - Previous tile tracking (prevents stale data affecting new map)
   * - Field effects (sand footprints, grass, water ripples)
   * - Surfing controller state (if mid-animation)
   */
  public resetForWarp(): void {
    // 1. Reset to walking state (GBA always walks through doors)
    if (!(this.currentState instanceof NormalState)) {
      this.changeState(new NormalState());
    }

    // 2. Clear key input state - prevents held keys from carrying over
    this.keysPressed = {};

    // 3. Clear previous tile tracking - prevents stale data affecting new map
    this.prevTileX = -1;
    this.prevTileY = -1;
    this.prevTileBehavior = undefined;
    this.previousTrackDirection = this.dir;
    this.scriptedMoveSpeedPxPerMs = null;

    // 4. Clear field effects (sand footprints, grass, water ripples)
    this.grassEffectManager.clear();

    // 5. Reset surfing controller if mid-animation
    this.surfingController.reset();
    this.setTraversalMode('land');
    this.syncObjectCoordsToTile();
  }

  /**
   * Get the player's elevation for RENDERING priority
   *
   * Reference: public/pokeemerald/src/field_player_avatar.c:1188
   * Returns previousElevation, preserved when walking on ground level (0) tiles.
   */
  public getElevation(): number {
    return this.previousElevation;
  }

  /**
   * Get the player's current facing direction
   * Used for predictive tileset loading in WorldManager
   */
  public getFacingDirection(): 'up' | 'down' | 'left' | 'right' {
    return this.dir;
  }

  /**
   * Get the player's current elevation for COLLISION checks
   *
   * This is the actual tile elevation the player is on.
   * When on ground level (0), player can move anywhere.
   */
  public getCurrentElevation(): number {
    return this.currentElevation;
  }

  /**
   * Update player elevation based on current tile
   *
   * Reference: ObjectEventUpdateElevation() in
   * public/pokeemerald/src/event_object_movement.c:7759-7771
   *
   * GBA Elevation Update Rules:
   * 1. If EITHER current OR previous tile has elevation 15, don't update ANYTHING
   * 2. currentElevation = tile's elevation (used for collision checks)
   * 3. previousElevation ONLY updates for tiles with elevation 1-14
   *    (preserved for elevation 0 and 15, used for rendering priority)
   */
  public updateElevation(): void {
    const resolved = this.tileResolver?.(this.tileX, this.tileY);

    if (resolved) {
      const curTileElevation = resolved.mapTile.elevation;
      const prevTileElevation = this.previousTileElevation;
      const oldCurrentElevation = this.currentElevation;
      const oldPreviousElevation = this.previousElevation;

      // GBA Rule 1: If EITHER current or previous tile is elevation 15, don't update anything
      // Reference: event_object_movement.c:7762-7763
      if (curTileElevation === 15 || prevTileElevation === 15) {
        if (isDebugMode()) {
          this.debugLog(
            `[ELEVATION] Universal tile (15) involved: cur=${curTileElevation}, prev=${prevTileElevation}. ` +
            `Preserving currentElev=${this.currentElevation}, previousElev=${this.previousElevation}`
          );
        }
        // Still update previousTileElevation for next move
        this.previousTileElevation = curTileElevation;
        return;
      }

      // GBA Rule 2: Always update currentElevation to tile's elevation
      // Reference: event_object_movement.c:7766
      this.currentElevation = curTileElevation;

      // GBA Rule 3: Only update previousElevation for tiles 1-14, preserve for 0 and 15
      // Reference: event_object_movement.c:7768-7769
      if (curTileElevation !== 0 && curTileElevation !== 15) {
        this.previousElevation = curTileElevation;
      }

      // Update previousTileElevation for next move
      this.previousTileElevation = curTileElevation;

      if (isDebugMode()) {
        const changes: string[] = [];
        if (oldCurrentElevation !== this.currentElevation) {
          changes.push(`currentElev: ${oldCurrentElevation}→${this.currentElevation}`);
        }
        if (oldPreviousElevation !== this.previousElevation) {
          changes.push(`previousElev: ${oldPreviousElevation}→${this.previousElevation}`);
        }
        if (changes.length > 0) {
          this.debugLog(`[ELEVATION] At (${this.tileX}, ${this.tileY}) tileElev=${curTileElevation}: ${changes.join(', ')}`);
        }
      }
    } else {
      // Out of bounds - keep current elevation
      if (isDebugMode()) {
        this.debugWarn(`[ELEVATION] Out of bounds at (${this.tileX}, ${this.tileY}), keeping elevation ${this.currentElevation}`);
      }
    }
  }

  public lockInput() {
    if (isDebugMode('field')) {
      console.debug(
        `[INPUT] lockInput() called at tile(${this.tileX},${this.tileY}) ` +
        `wasLocked=${this.inputLocked} moving=${this.isMoving}`
      );
      console.trace('[INPUT] lockInput stack');
    }
    const wasMoving = this.isMoving;
    this.inputLocked = true;
    // Don't clear keysPressed - we need to remember held keys (like Z for running)
    // so state can be properly restored after input is unlocked
    // Scripts should start on tile boundaries. If lock hits during movement
    // (e.g. seam coord events), snap to the logical tile to avoid XY desync.
    if (wasMoving) {
      this.x = this.tileX * this.TILE_PIXELS;
      this.y = this.tileY * this.TILE_PIXELS - 16;
      this.syncObjectCoordsToTile();
    }
    this.isMoving = false;
    this.pixelsMoved = 0;
    this.scriptedMoveSpeedPxPerMs = null;
    // Preserve traversal sprite domain during modal prompts.
    // Surf/underwater prompts should not force walking state, or frame/atlas
    // selection can desync in the renderer.
    if (
      this.traversalMode === 'land'
      && !(this.currentState instanceof NormalState)
      && !(this.currentState instanceof BikeState)
    ) {
      this.changeState(new NormalState());
    }
  }

  public unlockInput() {
    if (isDebugMode('field')) {
      console.debug(`[INPUT] unlockInput() called at tile(${this.tileX},${this.tileY}) wasLocked=${this.inputLocked}`);
      console.trace('[INPUT] unlockInput stack');
    }
    this.inputLocked = false;
  }

  public changeState(newState: PlayerState) {
    this.currentState.exit(this);
    this.currentState = newState;
    this.currentState.enter(this);
  }

  public update(delta: number): boolean {
    if (this.inputLocked && !this.isMoving) {
      return false;
    }

    if (!this.isMoving) {
      this.currentState.handleInput(this, this.keysPressed);
    }

    // Update grass effects (pass delta for accurate timing)
    this.grassEffectManager.update(delta);

    // Calculate destination using object-event current coords (PlayerGetDestCoords parity)
    const destination = this.getDestinationTile();
    const destTileX = destination.x;
    const destTileY = destination.y;

    // Cleanup completed grass effects with full position info
    const isJumping = this.currentState instanceof JumpingState;
    const ownerPositions = new Map<string, {
      tileX: number;
      tileY: number;
      destTileX: number;
      destTileY: number;
      prevTileX: number;
      prevTileY: number;
      direction: 'up' | 'down' | 'left' | 'right';
      isMoving: boolean;
      isJumping: boolean;
    }>();
    ownerPositions.set('player', {
      tileX: this.tileX,
      tileY: this.tileY,
      destTileX,
      destTileY,
      prevTileX: this.prevTileX,
      prevTileY: this.prevTileY,
      direction: this.dir,
      isMoving: this.isMoving,
      isJumping,
    });

    // Include NPC positions for grass effect cleanup
    for (const [id, pos] of this.additionalOwnerPositions) {
      ownerPositions.set(id, pos);
    }

    this.grassEffectManager.cleanup(ownerPositions);

    return this.currentState.update(this, delta);
  }

  // Helper for states to process movement
  public processMovement(delta: number, speed: number): boolean {
    let didRenderMove = false;

    if (this.isMoving) {
      // Continue movement based on time delta
      const moveSpeed = this.scriptedMoveSpeedPxPerMs ?? speed;
      const moveAmount = moveSpeed * delta;
      this.pixelsMoved += moveAmount;
      
      // Check if movement just completed
      const movementJustCompleted = this.pixelsMoved >= this.TILE_PIXELS;

      if (movementJustCompleted) {
        // Movement complete - snap to tile
        this.pixelsMoved = 0;
        this.isMoving = false;
        this.scriptedMoveSpeedPxPerMs = null;
        
        // Calculate target tile
        let dx = 0;
        let dy = 0;
        if (this.dir === 'up') dy = -1;
        else if (this.dir === 'down') dy = 1;
        else if (this.dir === 'left') dx = -1;
        else if (this.dir === 'right') dx = 1;

        const oldTileX = this.tileX;
        const oldTileY = this.tileY;
        
        this.tileX += dx;
        this.tileY += dy;
        this.x = this.tileX * this.TILE_PIXELS;
        this.y = this.tileY * this.TILE_PIXELS - 16; // Sprite is 32px tall, feet at bottom
        this.settleObjectStepAt(this.tileX, this.tileY);
        
        if (isDebugMode()) {
          this.debugLog(`[MOVEMENT] Completed move from (${oldTileX}, ${oldTileY}) → (${this.tileX}, ${this.tileY})`);
        }
        
        // Update elevation when changing tiles
        this.updateElevation();
        
        // Alternate walk frame for next tile
        this.walkFrameAlternate = !this.walkFrameAlternate;

        // Update previous tile state for next movement
        this.updatePreviousTileState();

        // Trigger LONG grass effect on movement completion (tall grass was already triggered on begin step)
        this.checkAndTriggerLongGrassEffectOnFinishStep(this.tileX, this.tileY);

        // Check for puddle splash effect (walking)
        // Puddles only trigger when BOTH current AND previous tiles are puddles
        this.checkAndTriggerPuddleSplash(this.tileX, this.tileY, oldTileX, oldTileY);

        // Check for water ripple effect (surfing or walking on ripple-causing tiles)
        this.checkAndTriggerWaterRipple(this.tileX, this.tileY);

        didRenderMove = true;
        
        if (isDebugMode()) {
          this.debugLog(`[Player] COMPLETED MOVEMENT - snapped to tile (${this.tileX}, ${this.tileY}) at pixel (${this.x}, ${this.y}) - next walk frame: ${this.walkFrameAlternate ? 2 : 1}`);
        }
      } else {
        // Only apply movement if we haven't completed the tile
        const oldX = this.x;
        const oldY = this.y;

        const move = directionToOffset(this.dir);
        this.x += move.dx * moveAmount;
        this.y += move.dy * moveAmount;
        
        if (isDebugMode()) {
          this.debugLog(`[Player] delta:${delta.toFixed(2)}ms moveAmt:${moveAmount.toFixed(3)}px x:${oldX.toFixed(2)}->${this.x.toFixed(2)} y:${oldY.toFixed(2)}->${this.y.toFixed(2)} progress:${this.pixelsMoved.toFixed(2)}/${this.TILE_PIXELS}`);
        }

        didRenderMove = true;
      }
    }

    return didRenderMove || this.isMoving;
  }

  private getDirectionFromKeys(keys: { [key: string]: boolean }): 'up' | 'down' | 'left' | 'right' | null {
    if (inputMap.isHeldInRecord(keys, GameButton.UP)) return 'up';
    if (inputMap.isHeldInRecord(keys, GameButton.DOWN)) return 'down';
    if (inputMap.isHeldInRecord(keys, GameButton.LEFT)) return 'left';
    if (inputMap.isHeldInRecord(keys, GameButton.RIGHT)) return 'right';
    return null;
  }

  private tryMoveDirection(
    direction: 'up' | 'down' | 'left' | 'right',
    options?: {
      countBikeCollision?: boolean;
      allowAcroBumpySlope?: boolean;
      allowAcroIsolatedRailLanding?: boolean;
    }
  ): boolean {
    this.dir = direction;

    if (isDebugMode()) {
      this.debugLog(`[INPUT] Attempting to move ${direction} from (${this.tileX}, ${this.tileY})`);
    }

    if (this.tryTriggerArrowWarpFromCurrentTile(direction)) {
      return true;
    }

    if (this.tryInteract(direction)) {
      return true;
    }

    if (this.tryStartLedgeJump(direction, this.currentState instanceof RunningState)) {
      return true;
    }

    const { dx, dy } = directionToOffset(direction);
    const targetTileX = this.tileX + dx;
    const targetTileY = this.tileY + dy;

    if (isDebugMode()) {
      this.debugLog(`[INPUT] Target tile: (${targetTileX}, ${targetTileY})`);
    }

    const resolved = this.tileResolver ? this.tileResolver(targetTileX, targetTileY) : null;
    const behavior = resolved?.attributes?.behavior ?? -1;
    const blocked = this.isCollisionAt(targetTileX, targetTileY, {
      allowAcroBumpySlope: options?.allowAcroBumpySlope,
      allowAcroIsolatedRailLanding: options?.allowAcroIsolatedRailLanding,
    });

    if (!blocked) {
      if (isDebugMode()) {
        this.debugLog(`[INPUT] Movement ALLOWED, starting move to (${targetTileX}, ${targetTileY})`);
      }

      this.checkAndTriggerSandFootprints();
      this.checkAndTriggerGrassEffectOnBeginStep(targetTileX, targetTileY);
      this.beginObjectStep(targetTileX, targetTileY);
      this.isMoving = true;
      this.pixelsMoved = 0;
      this.previousTrackDirection = direction;
      return true;
    }

    if (this.doorWarpHandler && (isDoorBehavior(behavior) || requiresDoorExitSequence(behavior))) {
      if (isDebugMode()) {
        this.debugLog('[PLAYER_DOOR_WARP]', { targetX: targetTileX, targetY: targetTileY, behavior });
      }
      this.doorWarpHandler({ targetX: targetTileX, targetY: targetTileY, behavior });
      return true;
    }

    if (options?.countBikeCollision && this.bikeRiding && this.cyclingRoadChallengeActive) {
      const previousCollisions = this.cyclingRoadCollisions;
      const nextCollisions = Math.min(100, previousCollisions + 1);
      if (nextCollisions !== previousCollisions) {
        this.cyclingRoadCollisions = nextCollisions;
        this.debugLog(
          '[CYCLING] Collision increment',
          {
            before: previousCollisions,
            after: nextCollisions,
            targetTileX,
            targetTileY,
            bikeMode: this.bikeMode,
            bikeRiding: this.bikeRiding,
          },
        );
      }
    }

    if (isDebugMode()) {
      this.debugWarn(`[INPUT] Movement BLOCKED to (${targetTileX}, ${targetTileY})`);
    }

    return false;
  }

  public handleDirectionInput(keys: { [key: string]: boolean }) {
    const direction = this.getDirectionFromKeys(keys);
    if (!direction) {
      return;
    }
    this.tryMoveDirection(direction);
  }

  public onBikeStateEnter(mode: Exclude<BikeMode, 'none'>): void {
    this.bikeMode = mode;
    this.bikeRiding = true;
    if (mode !== 'mach') {
      this.machBikeSpeedTier = 0;
    }
  }

  public getBikeMovementSpeed(mode: Exclude<BikeMode, 'none'>): number {
    if (mode === 'acro') {
      return this.BIKE_SPEED_FASTER;
    }

    if (this.machBikeSpeedTier >= 2) return this.BIKE_SPEED_FASTEST;
    if (this.machBikeSpeedTier === 1) return this.BIKE_SPEED_FAST;
    return this.BIKE_SPEED_WALK;
  }

  public handleBikeInput(
    keys: { [key: string]: boolean },
    mode: Exclude<BikeMode, 'none'>
  ): void {
    const direction = this.getDirectionFromKeys(keys);
    const isBHeld = inputMap.isHeldInRecord(keys, GameButton.B);

    if (direction === null) {
      if (mode === 'acro' && isBHeld) {
        this.changeState(new AcroBunnyHopState());
        return;
      }

      // Mach bike keeps rolling briefly when input is released.
      if (mode === 'mach' && !this.isMoving && this.machBikeSpeedTier > 0) {
        const continued = this.tryMoveDirection(this.dir, { countBikeCollision: true });
        if (continued) {
          this.machBikeSpeedTier = Math.max(0, this.machBikeSpeedTier - 1) as 0 | 1 | 2;
        } else {
          this.machBikeSpeedTier = 0;
        }
      }
      return;
    }

    if (this.isMoving) {
      return;
    }

    if (mode === 'acro' && isBHeld && this.tryStartAcroTurnJump(direction)) {
      return;
    }

    if (mode === 'acro' && isBHeld && this.tryStartAcroRailSideJump(direction)) {
      return;
    }

    // Ledge jumps work while biking in Emerald.
    if (this.tryStartLedgeJump(direction, false)) {
      if (mode === 'mach') {
        this.machBikeSpeedTier = 0;
      }
      return;
    }

    if (mode === 'mach') {
      const previousDir = this.dir;
      const sameDirection = direction === previousDir;

      if (!sameDirection && this.machBikeSpeedTier > 0) {
        // Turning while at speed takes a beat and drops momentum.
        this.dir = direction;
        this.machBikeSpeedTier = Math.max(0, this.machBikeSpeedTier - 1) as 0 | 1 | 2;
        return;
      }

      if (!this.canBikeFaceDirectionOnCurrentTile(direction)) {
        return;
      }

      const moved = this.tryMoveDirection(direction, { countBikeCollision: true });
      if (moved) {
        this.machBikeSpeedTier = sameDirection
          ? (Math.min(2, this.machBikeSpeedTier + 1) as 0 | 1 | 2)
          : 1;
      } else {
        this.machBikeSpeedTier = 0;
      }
      return;
    }

    if (!this.canBikeFaceDirectionOnCurrentTile(direction)) {
      return;
    }

    this.tryMoveDirection(direction, {
      countBikeCollision: true,
      allowAcroBumpySlope: isBHeld,
    });
  }

  private getOppositeDirection(direction: 'up' | 'down' | 'left' | 'right'): 'up' | 'down' | 'left' | 'right' {
    switch (direction) {
      case 'up': return 'down';
      case 'down': return 'up';
      case 'left': return 'right';
      case 'right': return 'left';
    }
  }

  private canBikeFaceDirectionOnCurrentTile(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    const currentBehavior = this.getCurrentTileBehavior();
    if (currentBehavior === undefined) {
      return true;
    }

    if (direction === 'left' || direction === 'right') {
      return !isAnyVerticalRailBehavior(currentBehavior);
    }

    return !isAnyHorizontalRailBehavior(currentBehavior);
  }

  private tryStartAcroTurnJump(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    const currentBehavior = this.getCurrentTileBehavior();
    if (currentBehavior === undefined) {
      return false;
    }

    const onVerticalRail = isAnyVerticalRailBehavior(currentBehavior);
    const onHorizontalRail = isAnyHorizontalRailBehavior(currentBehavior);
    if (!onVerticalRail && !onHorizontalRail) {
      return false;
    }

    if (direction !== this.getOppositeDirection(this.dir)) {
      return false;
    }

    this.changeState(new AcroTurnJumpState(direction));
    return true;
  }

  private tryStartAcroRailSideJump(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    const currentBehavior = this.getCurrentTileBehavior();
    if (currentBehavior === undefined) {
      return false;
    }

    const onVerticalRail = isAnyVerticalRailBehavior(currentBehavior);
    const onHorizontalRail = isAnyHorizontalRailBehavior(currentBehavior);
    if (!onVerticalRail && !onHorizontalRail) {
      return false;
    }

    const isPerpendicularJump =
      (onVerticalRail && (direction === 'left' || direction === 'right'))
      || (onHorizontalRail && (direction === 'up' || direction === 'down'));
    if (!isPerpendicularJump) {
      return false;
    }

    const { dx, dy } = directionToOffset(direction);
    const targetTileX = this.tileX + dx;
    const targetTileY = this.tileY + dy;
    const targetResolved = this.tileResolver?.(targetTileX, targetTileY);
    if (!targetResolved?.attributes) {
      return false;
    }

    // C parity: Acro side-jumps cannot land onto a rail that matches jump axis.
    if (this.isAcroSideJumpBlockedByTargetRail(direction, targetResolved.attributes.behavior)) {
      return false;
    }

    if (this.isCollisionAt(targetTileX, targetTileY, { allowAcroIsolatedRailLanding: true })) {
      return false;
    }

    // C parity: side-jump keeps facing locked while movement direction is perpendicular.
    this.changeState(new JumpingState(false, JUMP_DISTANCE_NORMAL, JUMP_ARC_LOW, direction));
    return true;
  }

  private isAcroSideJumpBlockedByTargetRail(
    direction: 'up' | 'down' | 'left' | 'right',
    targetBehavior: number
  ): boolean {
    if (direction === 'up' || direction === 'down') {
      return isAnyVerticalRailBehavior(targetBehavior);
    }
    return isAnyHorizontalRailBehavior(targetBehavior);
  }

  private isMapCyclingAllowed(): boolean {
    return this.mapAllowsCyclingResolver ? this.mapAllowsCyclingResolver() : true;
  }

  private getDestinationTileBehavior(): number | undefined {
    const destination = this.getDestinationTile();
    const resolved = this.tileResolver?.(destination.x, destination.y);
    return resolved?.attributes?.behavior;
  }

  private isBikingDisallowedByPlayer(): boolean {
    if (this.traversalMode !== 'land') {
      return true;
    }

    const behavior = this.getDestinationTileBehavior();
    if (behavior === undefined) {
      return true;
    }

    return isRunningDisallowedBehavior(behavior);
  }

  private isBikeDismountBlocked(): boolean {
    if (gameFlags.isSet('FLAG_SYS_CYCLING_ROAD')) {
      return true;
    }

    const behavior = this.getDestinationTileBehavior();
    return behavior !== undefined && isBikeRailBehavior(behavior);
  }

  private mountBike(mode: Exclude<BikeMode, 'none'>): void {
    this.bikeMode = mode;
    this.bikeRiding = true;
    this.machBikeSpeedTier = 0;
    this.spriteYOffset = 0;
    this.changeState(new BikeState(mode));
  }

  private dismountBike(): void {
    this.bikeMode = 'none';
    this.bikeRiding = false;
    this.machBikeSpeedTier = 0;
    this.spriteYOffset = 0;
    if (this.traversalMode === 'land' && !(this.currentState instanceof NormalState)) {
      this.changeState(new NormalState());
    }
  }

  public tryUseBikeItem(mode: Exclude<BikeMode, 'none'>): 'mounted' | 'dismounted' | 'blocked' | 'forbidden' {
    if (this.isMoving || this.inputLocked) {
      return 'forbidden';
    }

    if (this.bikeRiding) {
      if (this.isBikeDismountBlocked()) {
        return 'blocked';
      }
      this.dismountBike();
      return 'dismounted';
    }

    if (!this.isMapCyclingAllowed() || this.isBikingDisallowedByPlayer()) {
      return 'forbidden';
    }

    this.mountBike(mode);
    return 'mounted';
  }

  public forceStep(direction: 'up' | 'down' | 'left' | 'right') {
    this.dir = direction;

    // Create sand footprint as we START to move
    this.checkAndTriggerSandFootprints();

    // Calculate target tile and trigger tall grass on begin step
    const { dx, dy } = directionToOffset(direction);
    const targetTileX = this.tileX + dx;
    const targetTileY = this.tileY + dy;
    this.checkAndTriggerGrassEffectOnBeginStep(targetTileX, targetTileY);

    this.beginObjectStep(targetTileX, targetTileY);
    this.isMoving = true;
    this.pixelsMoved = 0;
    this.previousTrackDirection = direction;
  }

  public forceMove(
    direction: 'up' | 'down' | 'left' | 'right',
    ignoreCollision: boolean = false,
    speedOverridePxPerMs?: number
  ) {
    this.dir = direction;
    const { dx, dy } = directionToOffset(direction);
    const targetTileX = this.tileX + dx;
    const targetTileY = this.tileY + dy;

    if (ignoreCollision) {
      // Create sand footprint as we START to move
      this.checkAndTriggerSandFootprints();
      // Trigger tall grass on begin step
      this.checkAndTriggerGrassEffectOnBeginStep(targetTileX, targetTileY);
      this.beginObjectStep(targetTileX, targetTileY);
      this.isMoving = true;
      this.pixelsMoved = 0;
      this.previousTrackDirection = direction;
      this.scriptedMoveSpeedPxPerMs = speedOverridePxPerMs ?? null;
      return true;
    }

    if (!this.isCollisionAt(targetTileX, targetTileY)) {
      // Create sand footprint as we START to move
      this.checkAndTriggerSandFootprints();
      // Trigger tall grass on begin step
      this.checkAndTriggerGrassEffectOnBeginStep(targetTileX, targetTileY);
      this.beginObjectStep(targetTileX, targetTileY);
      this.isMoving = true;
      this.pixelsMoved = 0;
      this.previousTrackDirection = direction;
      this.scriptedMoveSpeedPxPerMs = speedOverridePxPerMs ?? null;
      return true;
    }
    this.scriptedMoveSpeedPxPerMs = null;
    return false;
  }

  /**
   * Force the player into a jump animation (used by cutscenes).
   * @param direction Direction to jump
   * @param distance 'normal' = 1 tile (truck exit), 'far' = 2 tiles (ledge)
   */
  public forceJump(direction: 'up' | 'down' | 'left' | 'right', distance: 'normal' | 'far' = 'normal'): void {
    this.dir = direction;
    const dist = distance === 'far' ? JUMP_DISTANCE_FAR : JUMP_DISTANCE_NORMAL;
    const arc = distance === 'far' ? JUMP_ARC_HIGH : JUMP_ARC_NORMAL;
    this.changeState(new JumpingState(false, dist, arc));
  }

  public getCameraFocus() {
    const spriteKey = this.getCurrentSpriteKey();
    const { frameWidth, frameHeight, renderXOffset } = this.getSpriteFrameMetrics(spriteKey);
    // Keep camera anchoring tied to world feet position, not raw frame width.
    // Surf/underwater sprites are 32px wide with -8 render offset, which should
    // still focus at the same tile center as 16px walking/running sprites.
    return {
      x: this.x + renderXOffset + frameWidth / 2,
      y: this.y + frameHeight - this.TILE_PIXELS / 2,
    };
  }

  /**
   * Check if there is an elevation mismatch between player and target tile
   *
   * Reference: IsElevationMismatchAt() in public/pokeemerald/src/event_object_movement.c:7707
   *
   * CRITICAL: GBA uses currentElevation for collision checks, NOT previousElevation!
   * - currentElevation = actual tile elevation player is on (0 = ground level = can go anywhere)
   * - previousElevation = preserved elevation for rendering priority only
   *
   * Logic:
   * - Ground level (elevation 0) can move anywhere (unless blocked by other collision)
   * - Tiles with elevation 0 or 15 are accessible from any player elevation
   * - Different non-zero elevations cannot interact (collision)
   *
   * @param tileX Target tile X coordinate
   * @param tileY Target tile Y coordinate
   * @returns true if elevation mismatch prevents movement
   */
  private isElevationMismatchAt(tileX: number, tileY: number): boolean {
    // CRITICAL FIX: Use currentElevation for collision, not previousElevation!
    // Reference: event_object_movement.c:4667 uses objectEvent->currentElevation
    const playerElevation = this.currentElevation;

    const resolved = this.tileResolver?.(tileX, tileY);
    if (!resolved) {
      if (isDebugMode()) {
        this.debugWarn(`[ELEVATION] Target tile (${tileX}, ${tileY}) out of bounds - BLOCKED`);
      }
      return true; // Out of bounds = mismatch
    }
    
    const tileElevation = resolved.mapTile.elevation;
    
    if (!areElevationsCompatible(playerElevation, tileElevation)) {
      if (isDebugMode()) {
        this.debugWarn(`[ELEVATION MISMATCH] Player at elevation ${playerElevation} CANNOT move to (${tileX}, ${tileY}) at elevation ${tileElevation} - BLOCKED`);
      }
      return true;
    }

    if (isDebugMode()) {
      this.debugLog(`[ELEVATION] Player at ${playerElevation} can move to (${tileX}, ${tileY}) at ${tileElevation} - ALLOWED`);
    }
    return false;
  }

  private isCollisionAt(
    tileX: number,
    tileY: number,
    options?: {
      ignoreElevation?: boolean;
      allowAcroBumpySlope?: boolean;
      allowAcroIsolatedRailLanding?: boolean;
    }
  ): boolean {
    const resolved = this.tileResolver ? this.tileResolver(tileX, tileY) : null;
    if (!resolved) {
      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) out of bounds - BLOCKED`);
      }
      return true; // Out of bounds = collision
    }

    const mapTile = resolved.mapTile;
    const attributes = resolved.attributes;

    if (!attributes) {
      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) has no attributes - PASSABLE`);
      }
      return false; // No attributes = passable
    }

    const behavior = attributes.behavior;
    const metatileId = mapTile.metatileId;
    const collision = mapTile.collision;
    const elevation = mapTile.elevation;

    // === SURFING COLLISION LOGIC ===
    // Reference: pokeemerald/src/field_player_avatar.c - CheckForObjectEventCollision
    // When surfing, water is passable but land (elevation 3) triggers dismount check
    const currentlySurfing = this.isCurrentlySurfing();

    if (this.traversalMode === 'underwater') {
      if (this.objectCollisionChecker && this.objectCollisionChecker(tileX, tileY)) {
        if (isDebugMode()) {
          this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is blocked by object event while underwater - BLOCKED`);
        }
        return true;
      }

      if (!isCollisionPassable(collision) && !isDoorBehavior(behavior)) {
        if (isDebugMode()) {
          this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) metatile=${metatileId} has collision bit=${collision}, behavior=${behavior} - BLOCKED`);
        }
        return true;
      }

      if (!options?.ignoreElevation && this.isElevationMismatchAt(tileX, tileY)) {
        if (isDebugMode()) {
          this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) blocked by ELEVATION MISMATCH while underwater`);
        }
        return true;
      }

      if (behavior === 1) {
        if (isDebugMode()) {
          this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is SECRET_BASE_WALL - BLOCKED`);
        }
        return true;
      }

      if (behavior >= 48 && behavior <= 55) {
        if (isDebugMode()) {
          this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is directionally impassable (behavior=${behavior}) - BLOCKED`);
        }
        return true;
      }

      if (this.dynamicCollisionChecker && this.dynamicCollisionChecker(tileX, tileY, this.dir)) {
        if (isDebugMode()) {
          this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) blocked by dynamic collision checker`);
        }
        return true;
      }

      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) metatile=${metatileId} elev=${elevation} behavior=${behavior} - PASSABLE (underwater)`);
      }
      return false;
    }

    if (currentlySurfing) {
      // GBA parity: while already surfing, movement collision uses normal map/object/elevation checks.
      // It does NOT require the target behavior to be surfable (important for under-bridge tiles).
      if (!isCollisionPassable(collision) && !isDoorBehavior(behavior)) {
        if (isDebugMode()) {
          this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) metatile=${metatileId} has collision bit=${collision}, behavior=${behavior} - BLOCKED (surfing)`);
        }
        return true;
      }

      if (!options?.ignoreElevation && this.isElevationMismatchAt(tileX, tileY)) {
        if (isDebugMode()) {
          this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) blocked by ELEVATION MISMATCH while surfing`);
        }
        return true;
      }

      if (this.objectCollisionChecker && this.objectCollisionChecker(tileX, tileY)) {
        if (isDebugMode()) {
          this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is blocked by object event while surfing - BLOCKED`);
        }
        return true;
      }

      if (behavior === 1) {
        if (isDebugMode()) {
          this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is SECRET_BASE_WALL - BLOCKED`);
        }
        return true;
      }

      if (behavior >= 48 && behavior <= 55) {
        if (isDebugMode()) {
          this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is directionally impassable (behavior=${behavior}) - BLOCKED`);
        }
        return true;
      }

      if (this.dynamicCollisionChecker && this.dynamicCollisionChecker(tileX, tileY, this.dir)) {
        if (isDebugMode()) {
          this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) blocked by dynamic collision checker`);
        }
        return true;
      }

      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) metatile=${metatileId} elev=${elevation} behavior=${behavior} - PASSABLE (surfing)`);
      }
      return false;
    }

    // === NORMAL WALKING COLLISION LOGIC ===

    // CRITICAL: Check for object events FIRST, before any terrain checks
    // NPCs/items block movement regardless of what terrain they're standing on
    // (This was a bug where NPCs on sand tiles could be walked through)
    if (this.objectCollisionChecker && this.objectCollisionChecker(tileX, tileY)) {
      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is blocked by object event - BLOCKED`);
      }
      return true;
    }

    const isOnAcroBike = this.bikeRiding && this.bikeMode === 'acro';
    const allowAcroBumpySlope = isOnAcroBike && options?.allowAcroBumpySlope === true;
    const allowAcroIsolatedRailLanding = isOnAcroBike && options?.allowAcroIsolatedRailLanding === true;

    if (isBumpySlopeBehavior(behavior) && !allowAcroBumpySlope) {
      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is bumpy slope and Acro wheelie-hop is not active - BLOCKED`);
      }
      return true;
    }

    if (
      (isIsolatedVerticalRailBehavior(behavior) || isIsolatedHorizontalRailBehavior(behavior))
      && !allowAcroIsolatedRailLanding
    ) {
      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is isolated rail and side-jump landing is not active - BLOCKED`);
      }
      return true;
    }

    if ((isVerticalRailBehavior(behavior) || isHorizontalRailBehavior(behavior)) && !this.bikeRiding) {
      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is bike rail and player is on foot - BLOCKED`);
      }
      return true;
    }

    // Special case: MB_SAND and MB_DEEP_SAND should be walkable (if no object blocking)
    const isSand = behavior === MB_SAND || behavior === MB_DEEP_SAND;
    if (isSand) {
      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is sand - PASSABLE`);
      }
      return false;
    }

    // Check collision bits from map.bin (bits 10-11)
    if (!isCollisionPassable(collision) && !isDoorBehavior(behavior)) {
      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) metatile=${metatileId} has collision bit=${collision}, behavior=${behavior} - BLOCKED`);
      }
      return true;
    }

    // Elevation mismatch check
    // Reference: public/pokeemerald/src/event_object_movement.c:4667
    // SKIP if options.ignoreElevation is true (e.g. for ledge jumping)
    if (!options?.ignoreElevation && this.isElevationMismatchAt(tileX, tileY)) {
      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) blocked by ELEVATION MISMATCH`);
      }
      return true; // COLLISION_ELEVATION_MISMATCH
    }

    // Impassable behaviors
    if (behavior === 1) {
      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is SECRET_BASE_WALL - BLOCKED`);
      }
      return true;
    }

    // Surfable/deep water and waterfalls require surf (when NOT surfing)
    if (isSurfableBehavior(behavior)) {
      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is water (behavior=${behavior}) without surf - BLOCKED`);
      }
      return true;
    }

    // Directionally impassable
    if (behavior >= 48 && behavior <= 55) {
      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) is directionally impassable (behavior=${behavior}) - BLOCKED`);
      }
      return true;
    }

    if (this.dynamicCollisionChecker && this.dynamicCollisionChecker(tileX, tileY, this.dir)) {
      if (isDebugMode()) {
        this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) blocked by dynamic collision checker`);
      }
      return true;
    }

    if (isDebugMode()) {
      this.debugLog(`[COLLISION] Tile (${tileX}, ${tileY}) metatile=${metatileId} elev=${elevation} behavior=${behavior} - PASSABLE`);
    }
    return false; // Passable
  }

  private isCurrentlySurfing(): boolean {
    return (this.traversalMode === 'surf' || this.surfingController.isSurfing()) && !this.isUnderwater();
  }

  public getFrameInfo(): FrameInfo | null {
    return this.currentState.getFrameInfo(this);
  }

  private getSpriteFrameMetrics(spriteKey: PlayerSpriteKey): ReturnType<typeof getPlayerSpriteFrameMetrics> {
    return getPlayerSpriteFrameMetrics(spriteKey);
  }

  // Helper to calculate frame info based on sprite key and current state
  public calculateFrameInfo(spriteKey: PlayerSpriteKey, forceWalkFrame: boolean = false): FrameInfo | null {
    const sprite = this.sprites[spriteKey];
    if (!sprite) return null;
    const { frameWidth, frameHeight, renderXOffset } = this.getSpriteFrameMetrics(spriteKey);

    // Preserve subpixel position; final rounding happens in render() alongside camera coordinates
    // (Flooring here causes 1px shiver when combined with round() in render())
    const renderX = this.x + renderXOffset;
    const renderY = this.y + this.spriteYOffset;

    let srcIndex = 0;
    let flip = false;

    if (!this.isMoving && !forceWalkFrame) {
      // Idle frames
      if (this.dir === 'down') srcIndex = 0;
      else if (this.dir === 'up') srcIndex = 1;
      else if (this.dir === 'left') srcIndex = 2;
      else if (this.dir === 'right') { srcIndex = 2; flip = true; }
    } else {
      // Walking animation: show walk frame in first half, idle in second half of tile
      // Or if forced (jumping)
      const progress = this.pixelsMoved / this.TILE_PIXELS;
      if (progress < 0.5 || forceWalkFrame) {
        // First half: walking frame (alternates between frame 1 and 2 each tile)
        const walkOffset = this.walkFrameAlternate ? 1 : 0;
        if (this.dir === 'down') srcIndex = 3 + walkOffset;
        else if (this.dir === 'up') srcIndex = 5 + walkOffset;
        else if (this.dir === 'left') srcIndex = 7 + walkOffset;
        else if (this.dir === 'right') { srcIndex = 7 + walkOffset; flip = true; }
      } else {
        // Second half: idle frame
        if (this.dir === 'down') srcIndex = 0;
        else if (this.dir === 'up') srcIndex = 1;
        else if (this.dir === 'left') srcIndex = 2;
        else if (this.dir === 'right') { srcIndex = 2; flip = true; }
      }
    }

    srcIndex = resolvePlayerSpriteFrameIndex(spriteKey, srcIndex);

    const srcX = srcIndex * frameWidth;
    const srcY = 0;

    return {
      spriteKey,
      sprite: sprite,
      sx: srcX,
      sy: srcY,
      sw: frameWidth,
      sh: frameHeight,
      renderX,
      renderY,
      flip,
    };
  }

  /**
   * Calculate frame info for surfing sprite (32x32 frames)
   *
   * C parity references:
   * - public/pokeemerald/src/data/object_events/object_event_pic_tables.h
   *   (sPicTable_BrendanSurfing frameMap)
   * - public/pokeemerald/src/data/object_events/object_event_anims.h
   *   (ANIM_GET_ON_OFF_POKEMON_* uses logical 9/10/11)
   */
  public calculateSurfingFrameInfo(): FrameInfo | null {
    const sprite = this.sprites['surfing'];
    if (!sprite) {
      // Fall back to walking sprite if surfing not loaded
      return this.calculateFrameInfo('walking');
    }

    // DO NOT floor here - allow smooth sub-pixel positioning during movement.
    // Rounding will be applied in the render function AFTER adding bob offset
    // to ensure player and blob use the same final integer positions.
    const { frameWidth, frameHeight, renderXOffset } = this.getSpriteFrameMetrics('surfing');
    const renderX = this.x + renderXOffset;
    // player.y is already set so feet are at tile bottom for 32px tall sprite
    // Surfing sprite is also 32px tall, so just use player.y directly
    const renderY = this.y;

    const isJumping = this.surfingController.isJumping();
    const frameSelection = getSurfingFrameSelection(this.dir, isJumping);
    const srcIndex = resolvePlayerSpriteFrameIndex('surfing', frameSelection.logicalFrame);

    const srcX = srcIndex * frameWidth;
    const srcY = 0;

    return {
      spriteKey: 'surfing',
      sprite: sprite,
      sx: srcX,
      sy: srcY,
      sw: frameWidth,
      sh: frameHeight,
      renderX,
      renderY,
      flip: frameSelection.flip,
    };
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number = 0, cameraY: number = 0) {
    // Render shadow if enabled (during jumps)
    // Shadow stays on ground while player sprite moves up/down via spriteYOffset
    // Uses shared getShadowPosition() for consistent positioning with WebGL
    if (this.showShadow && this.sprites['shadow']) {
      const shadow = this.sprites['shadow'];
      const shadowPos = getShadowPosition(this.x, this.y);
      const shadowX = Math.round(shadowPos.worldX - cameraX);
      const shadowY = Math.round(shadowPos.worldY - cameraY);
      ctx.drawImage(shadow, shadowX, shadowY);
    }

    const frame = this.getFrameInfo();
    if (!frame) return;

    // Disable image smoothing to prevent ghosting on pixel art
    ctx.imageSmoothingEnabled = false;

    ctx.save();

    // Use Math.round() for screen positions to avoid floating-point precision errors.
    // Example: 456.0040 - 8 - 304.0040 = 143.99999999999997 (not 144.0!)
    // floor(143.999...) = 143, but round(143.999...) = 144 (correct)
    // This matches the blob rendering calculation in MapRenderer.
    const destX = Math.round(frame.renderX - cameraX);
    const destY = Math.round(frame.renderY - cameraY);

    // Apply clipping for long grass (hide bottom 50% of sprite)
    if (this.isOnLongGrass()) {
      // Create a clipping rectangle that shows only the top half
      ctx.beginPath();
      ctx.rect(destX, destY, frame.sw, frame.sh / 2);
      ctx.clip();
    }

    if (frame.flip) {
      // Use whole pixel translation for flipped sprites
      ctx.translate(destX + frame.sw, destY);
      ctx.scale(-1, 1);
      ctx.drawImage(frame.sprite, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, frame.sw, frame.sh);
    } else {
      ctx.drawImage(
        frame.sprite,
        frame.sx,
        frame.sy,
        frame.sw,
        frame.sh,
        destX,
        destY,
        frame.sw,
        frame.sh
      );
    }
    ctx.restore();
  }

  public getSpriteSize() {
    const frame = this.getFrameInfo();
    if (frame) {
      return { width: frame.sw, height: frame.sh };
    }

    const spriteKey = this.getCurrentSpriteKey();
    const { frameWidth, frameHeight } = this.getSpriteFrameMetrics(spriteKey);
    return { width: frameWidth, height: frameHeight };
  }

  /**
   * Get all loaded sprite sheets for WebGL upload
   * Returns a map of sprite name to HTMLCanvasElement
   */
  public getSpriteSheets(): Map<string, HTMLCanvasElement> {
    const sheets = new Map<string, HTMLCanvasElement>();
    for (const [key, canvas] of Object.entries(this.sprites)) {
      if (canvas) {
        sheets.set(key, canvas);
      }
    }
    return sheets;
  }

  /**
   * Get the previous tile position (for begin-step effects such as footprints).
   */
  public getPreviousTilePosition() {
    return { x: this.prevTileX, y: this.prevTileY };
  }

  /**
   * Get object-event current/previous coords.
   * Matches pokeemerald objectEvent->{currentCoords, previousCoords}.
   */
  public getObjectEventCoords(): {
    current: { x: number; y: number };
    previous: { x: number; y: number };
  } {
    return {
      current: { x: this.objCurrentTileX, y: this.objCurrentTileY },
      previous: { x: this.objPreviousTileX, y: this.objPreviousTileY },
    };
  }

  /**
   * Get player destination coords with GBA PlayerGetDestCoords parity.
   * This now returns object-event current coords.
   */
  public getDestinationTile(): { x: number; y: number } {
    return { x: this.objCurrentTileX, y: this.objCurrentTileY };
  }

  public destroy() {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
  }

  public setTileResolver(resolver: TileResolver | null) {
    this.tileResolver = resolver;
    
    // Initialize previous tile to current tile
    this.prevTileX = this.tileX;
    this.prevTileY = this.tileY;
    this.prevTileBehavior = undefined; // Will be set by updatePreviousTileState
    this.updatePreviousTileState(); // Populate initial prevTileBehavior
    this.syncObjectCoordsToTile();
  }

  public setMapAllowsCyclingResolver(resolver: (() => boolean) | null): void {
    this.mapAllowsCyclingResolver = resolver;
  }

  public setDoorWarpHandler(handler: ((request: DoorWarpRequest) => void) | null) {
    this.doorWarpHandler = handler;
  }

  public setObjectCollisionChecker(checker: ObjectCollisionChecker | null) {
    this.objectCollisionChecker = checker;
  }

  public setDynamicCollisionChecker(checker: DynamicCollisionChecker | null) {
    this.dynamicCollisionChecker = checker;
  }

  public tryInteract(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    const { dx, dy } = directionToOffset(direction);
    const targetTileX = this.tileX + dx;
    const targetTileY = this.tileY + dy;
    const resolved = this.tileResolver ? this.tileResolver(targetTileX, targetTileY) : null;
    const behavior = resolved?.attributes?.behavior;
    
    // Only animated doors can be interacted with (not stairs)
    if (behavior !== undefined && isDoorBehavior(behavior) && this.doorWarpHandler) {
      this.doorWarpHandler({ targetX: targetTileX, targetY: targetTileY, behavior });
      return true;
    }
    return false;
  }

  public checkForLedgeJump(keys: { [key: string]: boolean }, wasRunning: boolean = false): boolean {
    let dir: 'up' | 'down' | 'left' | 'right' | null = null;

    if (inputMap.isHeldInRecord(keys, GameButton.UP)) dir = 'up';
    else if (inputMap.isHeldInRecord(keys, GameButton.DOWN)) dir = 'down';
    else if (inputMap.isHeldInRecord(keys, GameButton.LEFT)) dir = 'left';
    else if (inputMap.isHeldInRecord(keys, GameButton.RIGHT)) dir = 'right';

    if (!dir) return false;
    return this.tryStartLedgeJump(dir, wasRunning);
  }

  private tryStartLedgeJump(
    dir: 'up' | 'down' | 'left' | 'right',
    wasRunning: boolean = false
  ): boolean {
    const { dx, dy } = directionToOffset(dir);

    // Check if the tile we are moving INTO is a ledge that allows jumping in our direction.
    const targetTileX = this.tileX + dx;
    const targetTileY = this.tileY + dy;
    const resolved = this.tileResolver ? this.tileResolver(targetTileX, targetTileY) : null;
    const behavior = resolved?.attributes?.behavior;

    if (behavior === undefined) return false;

    let isLedge = false;
    if (dir === 'down' && behavior === MB_JUMP_SOUTH) isLedge = true;
    else if (dir === 'up' && behavior === MB_JUMP_NORTH) isLedge = true;
    else if (dir === 'left' && behavior === MB_JUMP_WEST) isLedge = true;
    else if (dir === 'right' && behavior === MB_JUMP_EAST) isLedge = true;

    if (!isLedge) return false;

    // Ensure the tile AFTER the ledge is passable.
    const landTileX = targetTileX + dx;
    const landTileY = targetTileY + dy;
    // Ignore elevation mismatch because ledges are intended elevation changes.
    if (this.isCollisionAt(landTileX, landTileY, { ignoreElevation: true })) {
      return false;
    }

    this.dir = dir;
    this.changeState(new JumpingState(wasRunning));
    return true;
  }

  /**
   * Update previous tile state after movement.
   * Called after player position changes.
   */
  private updatePreviousTileState(): void {
    this.prevTileX = this.tileX;
    this.prevTileY = this.tileY;

    const resolved = this.tileResolver ? this.tileResolver(this.tileX, this.tileY) : null;
    this.prevTileBehavior = resolved?.attributes?.behavior;
  }

  /**
   * Public wrapper for updatePreviousTileState, used by JumpingState.
   */
  public updatePreviousTileStatePublic(): void {
    this.updatePreviousTileState();
  }

  /**
   * Check if player just left a sand/footprints tile and create track effect.
   * On foot this emits sand/deep-sand footprints; on bike it emits tire tracks.
   * Called at BEGIN step (pokeemerald: GetGroundEffectFlags_Tracks in OnBeginStep)
   * Uses previousMetatileBehavior and previousCoords
   */
  private checkAndTriggerSandFootprints(): void {
    // Check if previous tile was sand (where we're leaving footprints)
    if (this.prevTileBehavior === undefined) return;
    
    const isSand = this.prevTileBehavior === MB_SAND || this.prevTileBehavior === MB_FOOTPRINTS;
    const isDeepSand = this.prevTileBehavior === MB_DEEP_SAND;
    
    if (isSand || isDeepSand) {
      const useBikeTracks = this.bikeRiding && (this.bikeMode === 'mach' || this.bikeMode === 'acro');
      const type = useBikeTracks ? 'bike_tire_tracks' : (isDeepSand ? 'deep_sand' : 'sand');
      const direction: FieldEffectDirection = useBikeTracks
        ? getBikeTrackDirection(this.previousTrackDirection, this.dir)
        : this.dir;

      this.grassEffectManager.create(
        this.prevTileX,
        this.prevTileY,
        type,
        false,
        'player',
        direction
      );
    }
  }

  /**
   * Check if current tile is tall or long grass and trigger grass effect if so.
   * Used for spawn cases where animation should be skipped.
   *
   * Based on pokeemerald logic:
   * - GroundEffect_SpawnOnTallGrass / SpawnOnLongGrass (skip animation)
   *
   * NOTE: Sand footprints are handled separately in checkAndTriggerSandFootprints()
   * which uses previousTile, not currentTile
   */
  private checkAndTriggerGrassEffect(tileX: number, tileY: number, skipAnimation: boolean) {
    const resolved = this.tileResolver ? this.tileResolver(tileX, tileY) : null;
    const behavior = resolved?.attributes?.behavior;

    if (behavior !== undefined) {
      if (isTallGrassBehavior(behavior)) {
        this.grassEffectManager.create(tileX, tileY, 'tall', skipAnimation, 'player');
        this.currentGrassType = null; // Tall grass doesn't clip player
      } else if (isLongGrassBehavior(behavior)) {
        this.grassEffectManager.create(tileX, tileY, 'long', skipAnimation, 'player');
        this.currentGrassType = 'long'; // Long grass clips player bottom half
      } else {
        this.currentGrassType = null;
      }
    } else {
      this.currentGrassType = null;
    }
  }

  /**
   * Trigger grass effect when movement STARTS (OnBeginStep).
   *
   * Based on pokeemerald logic in event_object_movement.c:
   * - GetGroundEffectFlags_TallGrassOnBeginStep AND GetGroundEffectFlags_LongGrassOnBeginStep
   *   BOTH check currentMetatileBehavior and are called in GetAllGroundEffectFlags_OnBeginStep
   * - The effect is triggered in DoGroundEffects_OnBeginStep
   * - In pokeemerald, currentCoords is shifted to destination BEFORE triggerGroundEffectsOnMove is set
   *
   * This makes the grass animation start the moment the player begins stepping onto the tile.
   *
   * @param targetTileX - The X coordinate of the tile being stepped onto
   * @param targetTileY - The Y coordinate of the tile being stepped onto
   */
  private checkAndTriggerGrassEffectOnBeginStep(targetTileX: number, targetTileY: number) {
    const resolved = this.tileResolver ? this.tileResolver(targetTileX, targetTileY) : null;
    const behavior = resolved?.attributes?.behavior;

    if (behavior !== undefined) {
      if (isTallGrassBehavior(behavior)) {
        // Trigger tall grass animation immediately when starting to step onto the tile
        this.grassEffectManager.create(targetTileX, targetTileY, 'tall', false, 'player');
        // Note: currentGrassType will be updated on finish step
      } else if (isLongGrassBehavior(behavior)) {
        // Trigger long grass animation immediately when starting to step onto the tile
        this.grassEffectManager.create(targetTileX, targetTileY, 'long', false, 'player');
        // Note: currentGrassType will be updated on finish step
      }
    }
  }

  /**
   * Update grass state when movement FINISHES (OnFinishStep style).
   * Updates the currentGrassType for sprite clipping.
   *
   * Note: The grass ANIMATION is triggered on begin step (above), but the
   * sprite clipping state needs to update when we actually arrive on the tile.
   *
   * @param tileX - The X coordinate of the tile just landed on
   * @param tileY - The Y coordinate of the tile just landed on
   */
  private checkAndTriggerLongGrassEffectOnFinishStep(tileX: number, tileY: number) {
    const resolved = this.tileResolver ? this.tileResolver(tileX, tileY) : null;
    const behavior = resolved?.attributes?.behavior;

    if (behavior !== undefined) {
      if (isLongGrassBehavior(behavior)) {
        // Long grass clips the bottom half of the player sprite
        this.currentGrassType = 'long';
      } else {
        this.currentGrassType = null;
      }
    } else {
      this.currentGrassType = null;
    }
  }

  /**
   * Trigger grass effect when landing from a jump.
   * Based on pokeemerald's GetGroundEffectFlags_JumpLanding.
   */
  public triggerGrassEffectOnLanding(): void {
    const resolved = this.tileResolver ? this.tileResolver(this.tileX, this.tileY) : null;
    const behavior = resolved?.attributes?.behavior;

    if (behavior !== undefined) {
      if (isTallGrassBehavior(behavior)) {
        // Jump landing in tall grass - trigger animation
        this.grassEffectManager.create(this.tileX, this.tileY, 'tall', false, 'player');
        this.currentGrassType = null;
      } else if (isLongGrassBehavior(behavior)) {
        // Jump landing in long grass - trigger animation
        this.grassEffectManager.create(this.tileX, this.tileY, 'long', false, 'player');
        this.currentGrassType = 'long';
      } else {
        this.currentGrassType = null;
      }
    } else {
      this.currentGrassType = null;
    }
  }

  /**
   * Check for puddle splash effect when completing a step.
   *
   * Based on pokeemerald GetGroundEffectFlags_Puddle (event_object_movement.c ~line 7520):
   * Puddles ONLY trigger when BOTH current AND previous tiles have MB_PUDDLE behavior.
   *
   * This means:
   * - Entering a puddle from dry ground: NO splash
   * - Walking within a puddle area: Splash on every step
   * - Exiting a puddle onto dry ground: NO splash
   *
   * @param currentTileX - Current tile X after movement
   * @param currentTileY - Current tile Y after movement
   * @param previousTileX - Previous tile X before movement
   * @param previousTileY - Previous tile Y before movement
   */
  private checkAndTriggerPuddleSplash(
    currentTileX: number,
    currentTileY: number,
    previousTileX: number,
    previousTileY: number
  ): void {
    // Resolve behaviors for both current and previous tiles
    const currentResolved = this.tileResolver ? this.tileResolver(currentTileX, currentTileY) : null;
    const previousResolved = this.tileResolver ? this.tileResolver(previousTileX, previousTileY) : null;

    const currentBehavior = currentResolved?.attributes?.behavior;
    const previousBehavior = previousResolved?.attributes?.behavior;

    // CRUCIAL: Both tiles must be puddles for splash to occur
    // This matches the C code: MetatileBehavior_IsPuddle(current) && MetatileBehavior_IsPuddle(previous)
    if (
      currentBehavior !== undefined &&
      previousBehavior !== undefined &&
      isPuddleBehavior(currentBehavior) &&
      isPuddleBehavior(previousBehavior)
    ) {
      // Create puddle splash effect at current position
      this.grassEffectManager.create(currentTileX, currentTileY, 'puddle_splash', false, 'player');

      if (isDebugMode()) {
        this.debugLog(
          `[PUDDLE] Splash triggered at (${currentTileX}, ${currentTileY}) - ` +
            `both current and previous tiles are puddles`
        );
      }
    }
  }

  /**
   * Check for water ripple effect when completing a step.
   *
   * Based on pokeemerald MetatileBehavior_HasRipples (metatile_behavior.c):
   * - MB_POND_WATER (16)
   * - MB_PUDDLE (22)
   * - MB_SOOTOPOLIS_DEEP_WATER (20)
   *
   * Ripples trigger when moving on water while surfing OR walking on puddles.
   * The ripple stays in place (unlike splash which follows player in C code).
   *
   * @param currentTileX - Current tile X after movement
   * @param currentTileY - Current tile Y after movement
   */
  private checkAndTriggerWaterRipple(
    currentTileX: number,
    currentTileY: number
  ): void {
    const currentResolved = this.tileResolver ? this.tileResolver(currentTileX, currentTileY) : null;
    const currentBehavior = currentResolved?.attributes?.behavior;

    if (currentBehavior !== undefined && hasRipplesBehavior(currentBehavior)) {
      // Only trigger ripples if surfing (on water tiles) or on puddles
      // Check if we're surfing or the tile has ripple behavior
      const isSurfing = this.surfingController?.isSurfing() ?? false;

      // Ripples occur when:
      // 1. Surfing on any water with ripple behavior
      // 2. Walking on puddles (but puddles also trigger splash - ripple is in addition)
      if (isSurfing || isPuddleBehavior(currentBehavior)) {
        // Create ripple at current position
        this.grassEffectManager.create(currentTileX, currentTileY, 'water_ripple', false, 'player');

        if (isDebugMode()) {
          this.debugLog(
            `[RIPPLE] Water ripple triggered at (${currentTileX}, ${currentTileY}) - ` +
              `behavior: ${currentBehavior}, surfing: ${isSurfing}`
          );
        }
      }
    }
  }

  /**
   * Get the grass effect manager for rendering.
   */
  public getGrassEffectManager(): FieldEffectManager {
    return this.grassEffectManager;
  }

  /** Additional owner positions (from NPCs) for grass effect cleanup */
  private additionalOwnerPositions: Map<string, {
    tileX: number;
    tileY: number;
    destTileX: number;
    destTileY: number;
    prevTileX: number;
    prevTileY: number;
    direction: 'up' | 'down' | 'left' | 'right';
    isMoving: boolean;
    isJumping: boolean;
  }> = new Map();

  /**
   * Set additional owner positions for grass effect cleanup.
   * Call this before player.update() with NPC positions.
   */
  public setAdditionalOwnerPositions(positions: Map<string, {
    tileX: number;
    tileY: number;
    destTileX: number;
    destTileY: number;
    prevTileX: number;
    prevTileY: number;
    direction: 'up' | 'down' | 'left' | 'right';
    isMoving: boolean;
    isJumping: boolean;
  }>): void {
    this.additionalOwnerPositions = positions;
  }

  /**
   * Check if player is currently on long grass (for sprite clipping).
   */
  public isOnLongGrass(): boolean {
    return this.currentGrassType === 'long';
  }

  // --- Surfing Methods ---

  /**
   * Get the surfing controller instance.
   */
  public getSurfingController(): SurfingController {
    return this.surfingController;
  }

  /**
   * Update surfing state (bob animation, etc.)
   * Called by SurfingState.update()
   */
  public updateSurfing(deltaMs?: number): void {
    // Update surfing controller for bob animation (pass delta for frame-rate independent timing)
    this.surfingController.update(deltaMs);

    // Update blob direction based on player facing
    this.surfingController.updateBlobDirection(this.dir);
  }

  public updateUnderwaterBob(deltaMs: number): void {
    this.underwaterBobElapsedMs += deltaMs;
  }

  public getUnderwaterBobOffset(): number {
    return getUnderwaterBobOffsetAtTime(this.underwaterBobElapsedMs);
  }

  /**
   * Handle input while surfing.
   * Surfing movement uses normal collision/elevation checks while in surf mode.
   * Dismount is only triggered when movement is blocked and the target tile is a valid shore.
   *
   * @param keys Currently pressed keys
   */
  public handleSurfingInput(keys: { [key: string]: boolean }): void {
    let newDir = this.dir;
    let attemptMove = false;

    if (inputMap.isHeldInRecord(keys, GameButton.UP)) {
      newDir = 'up';
      attemptMove = true;
    } else if (inputMap.isHeldInRecord(keys, GameButton.DOWN)) {
      newDir = 'down';
      attemptMove = true;
    } else if (inputMap.isHeldInRecord(keys, GameButton.LEFT)) {
      newDir = 'left';
      attemptMove = true;
    } else if (inputMap.isHeldInRecord(keys, GameButton.RIGHT)) {
      newDir = 'right';
      attemptMove = true;
    }

    if (attemptMove) {
      this.dir = newDir;
      this.surfingController.updateBlobDirection(newDir);

      // Arrow warps can trigger while surfing (e.g. MB_WATER_SOUTH_ARROW_WARP).
      if (this.tryTriggerArrowWarpFromCurrentTile(newDir)) {
        return;
      }

      const { dx, dy } = directionToOffset(newDir);

      const targetTileX = this.tileX + dx;
      const targetTileY = this.tileY + dy;

      const blocked = this.isCollisionAt(targetTileX, targetTileY);

      if (!blocked) {
        this.beginObjectStep(targetTileX, targetTileY);
        this.isMoving = true;
        this.pixelsMoved = 0;
        if (isDebugMode()) {
          this.debugLog(`[SURF] Moving to (${targetTileX}, ${targetTileY})`);
        }
        return;
      }

      // Blocked while surfing: only dismount if the target tile is a valid shore tile.
      const canDismount = this.surfingController.canDismount(
        targetTileX,
        targetTileY,
        this.tileResolver ?? undefined
      );

      if (canDismount) {
        if (isDebugMode()) {
          this.debugLog(`[SURF] Starting dismount to (${targetTileX}, ${targetTileY})`);
        }
        this.surfingController.startDismountSequence(
          this.tileX,
          this.tileY,
          this.x,
          this.y,
          newDir
        );
        this.changeState(new SurfJumpingState(false));
      } else if (isDebugMode()) {
        this.debugLog(`[SURF] Cannot move to (${targetTileX}, ${targetTileY}) - blocked`);
      }
    }
  }

  /**
   * Trigger a warp when the player is standing on an arrow-warp tile and inputs the matching direction.
   *
   * C parity: field_control_avatar.c TryArrowWarp checks the player's current tile behavior
   * against directional input before front-tile door warps.
   */
  private tryTriggerArrowWarpFromCurrentTile(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    if (!this.doorWarpHandler || !this.tileResolver) return false;

    const currentResolved = this.tileResolver(this.tileX, this.tileY);
    const currentBehavior = currentResolved?.attributes?.behavior;
    if (currentBehavior === undefined || !isArrowWarpBehavior(currentBehavior)) return false;

    const arrowDirection = getArrowDirectionFromBehavior(currentBehavior);
    if (!arrowDirection || arrowDirection !== direction) return false;

    if (isDebugMode()) {
      this.debugLog('[PLAYER_ARROW_WARP]', {
        tileX: this.tileX,
        tileY: this.tileY,
        behavior: currentBehavior,
        direction,
      });
    }

    this.doorWarpHandler({
      targetX: this.tileX,
      targetY: this.tileY,
      behavior: currentBehavior,
    });
    return true;
  }

  /**
   * Check if player can initiate surf from current position.
   * Called when player presses A while facing water.
   */
  public canInitiateSurf(): { canSurf: boolean; reason?: string; targetX?: number; targetY?: number } {
    return this.surfingController.canInitiateSurf(
      this.tileX,
      this.tileY,
      this.dir,
      this.previousElevation,
      this.tileResolver ?? undefined
    );
  }

  /**
   * Start the surf mount sequence.
   * Called when player initiates surf (e.g., uses Surf HM).
   */
  public startSurfing(): void {
    const check = this.canInitiateSurf();
    if (!check.canSurf || check.targetX === undefined || check.targetY === undefined) {
      if (isDebugMode()) {
        this.debugLog(`[SURF] Cannot initiate surf: ${check.reason}`);
      }
      return;
    }

    if (isDebugMode()) {
      this.debugLog(`[SURF] Starting surf sequence to (${check.targetX}, ${check.targetY})`);
    }
    this.setTraversalMode('surf', this.dir);

    this.surfingController.startSurfSequence(
      check.targetX,
      check.targetY,
      this.x,
      this.y,
      this.dir
    );

    this.changeState(new SurfJumpingState(true));
  }

  public isUnderwater(): boolean {
    return this.traversalMode === 'underwater';
  }

  public getTraversalMode(): TraversalMode {
    return this.traversalMode;
  }

  public setTraversalMode(
    mode: TraversalMode,
    direction: 'up' | 'down' | 'left' | 'right' = this.dir
  ): void {
    const wasMoving = this.isMoving;
    const previousMode = this.traversalMode;
    this.traversalMode = mode;
    this.surfingController.setSurfingActive(mode === 'surf', direction);

    if (mode !== 'underwater') {
      this.underwaterBobElapsedMs = 0;
    } else if (previousMode !== 'underwater') {
      this.underwaterBobElapsedMs = 0;
    }

    this.isMoving = false;
    this.pixelsMoved = 0;
    this.spriteYOffset = 0;
    this.scriptedMoveSpeedPxPerMs = null;
    if (mode !== 'land') {
      this.bikeMode = 'none';
      this.bikeRiding = false;
      this.machBikeSpeedTier = 0;
    }
    if (wasMoving) {
      this.syncObjectCoordsToTile();
    }

    if (mode === 'surf') {
      if (!(this.currentState instanceof SurfingState)) {
        this.changeState(new SurfingState());
      }
      return;
    }

    if (mode === 'underwater') {
      if (!(this.currentState instanceof UnderwaterState)) {
        this.changeState(new UnderwaterState());
      }
      return;
    }

    if (this.bikeRiding && this.bikeMode !== 'none') {
      if (!(this.currentState instanceof BikeState)) {
        this.changeState(new BikeState(this.bikeMode as Exclude<BikeMode, 'none'>));
      }
      return;
    }

    if (!(this.currentState instanceof NormalState)) {
      this.changeState(new NormalState());
    }
  }

  public setTraversalState(state: {
    surfing: boolean;
    underwater: boolean;
    bikeMode?: BikeMode;
    bikeRiding?: boolean;
  }): void {
    if (state.underwater) {
      this.setTraversalMode('underwater');
      return;
    }
    this.setTraversalMode(state.surfing ? 'surf' : 'land');

    if (state.surfing) {
      return;
    }

    const desiredBikeMode = state.bikeMode ?? 'none';
    const shouldRideBike = Boolean(state.bikeRiding && desiredBikeMode !== 'none');
    if (!shouldRideBike) {
      this.bikeMode = 'none';
      this.bikeRiding = false;
      if (this.traversalMode === 'land' && this.currentState instanceof BikeState) {
        this.changeState(new NormalState());
      }
      return;
    }

    this.bikeMode = desiredBikeMode;
    this.bikeRiding = true;
    this.machBikeSpeedTier = 0;
    if (!(this.currentState instanceof BikeState)) {
      this.changeState(new BikeState(desiredBikeMode as Exclude<BikeMode, 'none'>));
    }
  }

  /**
   * Check if currently surfing.
   */
  public isSurfing(): boolean {
    return this.surfingController.isSurfing();
  }

  /**
   * Check if currently running (for WebGL sprite sheet selection).
   */
  public isRunning(): boolean {
    return this.currentState instanceof RunningState;
  }

  public isBikeRiding(): boolean {
    return this.bikeRiding;
  }

  public getBikeMode(): BikeMode {
    return this.bikeRiding ? this.bikeMode : 'none';
  }

  public getBikeSpecialValue(): 0 | 1 | 2 {
    if (!this.bikeRiding) {
      return 0;
    }
    if (this.bikeMode === 'acro') {
      return 1;
    }
    if (this.bikeMode === 'mach') {
      return 2;
    }
    return 0;
  }

  /**
   * Override the sprite sheet used for rendering scripted actions (e.g. watering).
   */
  public setScriptSpriteOverride(spriteKey: PlayerSpriteKey | null): void {
    this.scriptSpriteOverride = spriteKey;
  }

  public setCyclingRoadChallengeActive(active: boolean): void {
    const wasActive = this.cyclingRoadChallengeActive;
    const previousCollisions = this.cyclingRoadCollisions;
    this.cyclingRoadChallengeActive = active;
    if (!active || wasActive !== active) {
      this.cyclingRoadCollisions = 0;
    }
    this.debugLog(
      '[CYCLING] setCyclingRoadChallengeActive',
      {
        from: wasActive,
        to: active,
        collisionsFrom: previousCollisions,
        collisionsTo: this.cyclingRoadCollisions,
        bikeMode: this.bikeMode,
        bikeRiding: this.bikeRiding,
      },
    );
  }

  public getCyclingRoadChallengeCollisions(): number {
    return this.cyclingRoadCollisions;
  }

  /**
   * Get the current sprite sheet key for WebGL rendering.
   * Returns 'surfing', 'running', or 'walking'.
   */
  public getCurrentSpriteKey(): PlayerSpriteKey {
    if (this.scriptSpriteOverride && this.sprites[this.scriptSpriteOverride]) {
      return this.scriptSpriteOverride;
    }
    if (this.traversalMode === 'underwater') return 'underwater';
    // Check for surfing OR mount/dismount jump (which also uses surfing sprite)
    if (this.isSurfing() || this.surfingController.isJumping()) return 'surfing';
    if (this.bikeRiding && this.bikeMode === 'mach') return 'machBike';
    if (this.bikeRiding && this.bikeMode === 'acro') return 'acroBike';
    if (this.isRunning()) return 'running';
    return 'walking';
  }

  /**
   * Get the tile resolver for surfing controller use.
   */
  public getTileResolver(): TileResolver | null {
    return this.tileResolver;
  }

  /**
   * Get the current state name for debugging.
   */
  public getStateName(): string {
    return this.currentState.constructor.name;
  }

  /**
   * Get the metatile behavior of the player's current tile.
   */
  public getCurrentTileBehavior(): number | undefined {
    const resolved = this.tileResolver?.(this.tileX, this.tileY);
    return resolved?.attributes?.behavior;
  }

  /**
   * Check if the current tile has a special behavior (ice, forced slide, forced walk)
   * and transition to the appropriate state if so.
   * Called after movement completes in NormalState/RunningState/IceSlidingState/ForcedSlideState.
   * @returns true if state was changed
   */
  public checkAndHandleSpecialTile(): boolean {
    const behavior = this.getCurrentTileBehavior();
    if (behavior === undefined) return false;

    // Ice sliding - auto-slide in current direction
    if (isIceBehavior(behavior)) {
      this.changeState(new IceSlidingState());
      return true;
    }

    // Forced slide (MB_SLIDE_*) - slide in tile's direction
    if (isForcedSlideBehavior(behavior)) {
      const dir = getSlideDirection(behavior);
      if (dir) {
        this.changeState(new ForcedSlideState(dir));
        return true;
      }
    }

    // Forced walk (MB_WALK_*) - force one step in tile's direction
    if (isForceWalkBehavior(behavior)) {
      const dir = getSlideDirection(behavior);
      if (dir) {
        this.forceStep(dir);
        return true;
      }
    }

    // Muddy slope (MB_MUDDY_SLOPE):
    // force player south unless climbing north on max-speed Mach bike.
    if (isMuddySlopeBehavior(behavior) && !this.canClimbMuddySlope()) {
      this.machBikeSpeedTier = 0; // C parity: Bike_UpdateBikeCounterSpeed(0)
      this.forceStep('down');
      return true;
    }

    return false;
  }

  private canClimbMuddySlope(): boolean {
    return this.bikeRiding
      && this.bikeMode === 'mach'
      && this.dir === 'up'
      && this.machBikeSpeedTier >= 2;
  }

  /**
   * Check if object collision checker is set up (for debugging).
   */
  public hasObjectCollisionChecker(): boolean {
    return this.objectCollisionChecker !== null;
  }

  /**
   * Get the previous elevation (used for rendering priority).
   */
  public getPreviousElevation(): number {
    return this.previousElevation;
  }
}
