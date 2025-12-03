import type { MetatileAttributes, MapTileData } from '../utils/mapLoader';
import { isCollisionPassable } from '../utils/mapLoader';
import {
  MB_EAST_ARROW_WARP,
  MB_WEST_ARROW_WARP,
  MB_NORTH_ARROW_WARP,
  MB_SOUTH_ARROW_WARP,
  MB_WATER_SOUTH_ARROW_WARP,
  MB_JUMP_EAST,
  MB_JUMP_WEST,
  MB_JUMP_NORTH,
  MB_JUMP_SOUTH,
  MB_SAND,
  MB_DEEP_SAND,
  isDoorBehavior,
  requiresDoorExitSequence,
  isArrowWarpBehavior,
  isTallGrassBehavior,
  isLongGrassBehavior,
  isSurfableBehavior,
  isPuddleBehavior,
  hasRipplesBehavior,
} from '../utils/metatileBehaviors';
import { FieldEffectManager } from './FieldEffectManager';
import { SurfingController } from './surfing';
import { getShadowPosition } from '../rendering/spriteUtils';

// Helper to check if debug mode is enabled
const DEBUG_MODE_FLAG = 'DEBUG_MODE';
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG];
}

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

export interface DoorWarpRequest {
  targetX: number;
  targetY: number;
  behavior: number;
}

export interface FrameInfo {
  sprite: HTMLCanvasElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  renderX: number;
  renderY: number;
  flip: boolean;
}

// Jump Physics Constants
const JUMP_DISTANCE = 32; // 2 tiles

// Jump height arc (sJumpY_High from pokeemerald)
// Indexed by (timer / 2)
const JUMP_HEIGHT_ARC = [
  -4,  -6,  -8, -10, -11, -12, -12, -12,
  -11, -10,  -9,  -8,  -6,  -4,   0,   0
];

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
    return controller.processMovement(delta, this.SPEED);
  }

  handleInput(controller: PlayerController, keys: { [key: string]: boolean }): void {
    // Check for transition to running (disabled on long grass)
    if ((keys['z'] || keys['Z']) && !controller.isOnLongGrass()) { // Z is mapped to B button
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
  private readonly SPEED = 1.2;//0.12;

  enter(_controller: PlayerController): void {
    // controller.setSprite('running');
  }

  exit(_controller: PlayerController): void {}

  update(controller: PlayerController, delta: number): boolean {
    return controller.processMovement(delta, this.SPEED);
  }

  handleInput(controller: PlayerController, keys: { [key: string]: boolean }): void {
    // Check for transition back to walking
    if (!keys['z'] && !keys['Z']) {
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

class JumpingState implements PlayerState {
  private progress: number = 0; // Pixels moved
  private readonly SPEED = 0.06; // 1px/frame approx
  private startX: number = 0;
  private startY: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;
  private wasRunning: boolean = false;

  constructor(wasRunning: boolean = false) {
    this.wasRunning = wasRunning;
  }

  enter(controller: PlayerController): void {
    controller.lockInput();
    controller.isMoving = true;
    controller.showShadow = true;
    this.progress = 0;
    this.startX = controller.x;
    this.startY = controller.y;
    
    // Calculate target position (2 tiles away)
    let dx = 0;
    let dy = 0;
    if (controller.dir === 'down') dy = 32;
    else if (controller.dir === 'up') dy = -32;
    else if (controller.dir === 'left') dx = -32;
    else if (controller.dir === 'right') dx = 32;
    
    this.targetX = this.startX + dx;
    this.targetY = this.startY + dy;
    
    // Update logical tile position immediately to the destination
    // This prevents other events from triggering on the jump-over tile
    controller.tileX += (dx / 16);
    controller.tileY += (dy / 16);
  }

  exit(controller: PlayerController): void {
    controller.unlockInput();
    controller.isMoving = false;
    controller.showShadow = false;
    controller.spriteYOffset = 0;

    // Snap to exact target position
    controller.x = this.targetX;
    controller.y = this.targetY;

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

    if (this.progress >= JUMP_DISTANCE) {
      // Jump finished - return to previous state (running if we were running, normal otherwise)
      if (this.wasRunning) {
        controller.changeState(new RunningState());
      } else {
        controller.changeState(new NormalState());
      }
      return true;
    }
    
    // Update position
    if (controller.dir === 'down') controller.y = this.startX + this.progress; // Wait, startY
    else if (controller.dir === 'up') controller.y = this.startY - this.progress;
    else if (controller.dir === 'left') controller.x = this.startX - this.progress;
    else if (controller.dir === 'right') controller.x = this.startX + this.progress;
    
    // Fix for 'down' direction typo above
    if (controller.dir === 'down') controller.y = this.startY + this.progress;

    // Calculate jump height
    // Map progress (0-32) to index (0-15)
    const index = Math.min(15, Math.floor(this.progress / 2));
    controller.spriteYOffset = JUMP_HEIGHT_ARC[index];
    
    return true;
  }

  handleInput(_controller: PlayerController, _keys: { [key: string]: boolean }): void {
    // Input locked during jump
  }

  getFrameInfo(controller: PlayerController): FrameInfo | null {
    // Use walking frame 2 (index 3, 4, 5 depending on dir?)
    // Actually, pokeemerald uses a specific jump frame or just a fixed frame.
    // For now, let's use the idle frame or a specific walk frame.
    // Research said "GetJump2MovementAction".
    // Let's use the walking frame (frame 1) to look dynamic.
    return controller.calculateFrameInfo('walking', true); // Force walk frame
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

class SurfJumpingState implements PlayerState {
  private readonly SPEED = 0.06;
  private isMount: boolean;

  constructor(isMount: boolean) {
    this.isMount = isMount;
  }

  enter(controller: PlayerController): void {
    controller.lockInput();
    controller.isMoving = true;
    controller.showShadow = true;
  }

  exit(controller: PlayerController): void {
    controller.unlockInput();
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
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;
  private tileResolver: TileResolver | null = null;
  private doorWarpHandler: ((request: DoorWarpRequest) => void) | null = null;
  private objectCollisionChecker: ObjectCollisionChecker | null = null;
  
  private currentState: PlayerState;
  private grassEffectManager: FieldEffectManager = new FieldEffectManager();
  private currentGrassType: 'long' | null = null; // Track if on long grass (for clipping)
  private surfingController: SurfingController = new SurfingController();

  // Previous tile tracking (for sand footprints - they appear on tile you LEFT)
  private prevTileX: number;
  private prevTileY: number;
  private prevTileBehavior: number | undefined;
  
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
  private readonly SPRITE_WIDTH = 16;
  private readonly SPRITE_HEIGHT = 32;

  // Keys that should have their default browser behavior prevented
  // This stops arrow keys from scrolling, space from activating buttons, etc.
  private static readonly GAME_CONTROL_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',  // Movement
    'w', 'W', 'a', 'A', 's', 'S', 'd', 'D',              // WASD movement
    'z', 'Z',                                            // B button (cancel/run)
    'x', 'X',                                            // A button (confirm)
    ' ',                                                 // Space (often used as confirm)
    'Enter',                                             // Enter (often used as confirm)
  ]);

  constructor() {
    this.currentState = new NormalState();
    this.handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default browser behavior for game control keys
      // This stops arrow keys from scrolling the page, space from clicking buttons, etc.
      if (PlayerController.GAME_CONTROL_KEYS.has(e.key)) {
        e.preventDefault();
      }
      this.keysPressed[e.key] = true;
    };
    this.handleKeyUp = (e: KeyboardEvent) => {
      if (PlayerController.GAME_CONTROL_KEYS.has(e.key)) {
        e.preventDefault();
      }
      this.keysPressed[e.key] = false;
    };

    // Initialize prevTileX/Y to current position, behavior to undefined
    this.prevTileX = this.tileX;
    this.prevTileY = this.tileY;
    this.prevTileBehavior = undefined;

    this.bindInputEvents();
  }

  private bindInputEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  public async loadSprite(key: string, src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get sprite context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Assume top-left pixel is the background color
        const bgR = data[0];
        const bgG = data[1];
        const bgB = data[2];
        
        // Replace all matching pixels with transparent
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
            data[i + 3] = 0; // Alpha 0
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
        this.sprites[key] = canvas;
        resolve();
      };
      img.onerror = reject;
    });
  }

  public setPosition(tileX: number, tileY: number) {
    // DEBUG: Log all setPosition calls with stack trace to track teleporting
    const oldX = this.tileX;
    const oldY = this.tileY;
    const oldPixelX = this.x;
    const oldPixelY = this.y;
    console.log(`[TELEPORT_DEBUG] setPosition called: (${oldX},${oldY}) -> (${tileX},${tileY})`,
      `pixel: (${oldPixelX?.toFixed(1)},${oldPixelY?.toFixed(1)}) -> (${tileX * this.TILE_PIXELS},${tileY * this.TILE_PIXELS - 16})`,
      new Error().stack?.split('\n').slice(1, 5).join(' <- '));

    this.tileX = tileX;
    this.tileY = tileY;
    this.x = tileX * this.TILE_PIXELS;
    this.y = tileY * this.TILE_PIXELS - 16; // Sprite is 32px tall, feet at bottom
    this.isMoving = false;
    this.pixelsMoved = 0;
    
    // Initialize elevation from spawn tile
    const resolved = this.tileResolver?.(this.tileX, this.tileY);
    if (resolved) {
      this.currentElevation = resolved.mapTile.elevation;
      // Match base game: start with the actual tile elevation (even 0/15)
      this.previousElevation = this.currentElevation;
      
      if (isDebugMode()) {
        console.log(`[SPAWN] Player spawned at (${tileX}, ${tileY}) with elevation ${this.currentElevation}, set previousElevation to ${this.previousElevation}`);
      }
    } else {
      this.currentElevation = 0;
      this.previousElevation = 3; // Default to ground (3) instead of 0
      if (isDebugMode()) {
        console.warn(`[SPAWN] Player spawned at (${tileX}, ${tileY}) but tile not found, defaulting to elevation 0 (prev 3)`);
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

    // 4. Clear field effects (sand footprints, grass, water ripples)
    this.grassEffectManager.clear();

    // 5. Reset surfing controller if mid-animation
    this.surfingController.reset();
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
          console.log(
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
          console.log(`[ELEVATION] At (${this.tileX}, ${this.tileY}) tileElev=${curTileElevation}: ${changes.join(', ')}`);
        }
      }
    } else {
      // Out of bounds - keep current elevation
      if (isDebugMode()) {
        console.warn(`[ELEVATION] Out of bounds at (${this.tileX}, ${this.tileY}), keeping elevation ${this.currentElevation}`);
      }
    }
  }

  public lockInput() {
    this.inputLocked = true;
    // Don't clear keysPressed - we need to remember held keys (like Z for running)
    // so state can be properly restored after input is unlocked
    this.isMoving = false;
    this.pixelsMoved = 0;
  }

  public unlockInput() {
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

    // Calculate destination tile for grass cleanup logic
    let destTileX = this.tileX;
    let destTileY = this.tileY;
    if (this.isMoving) {
      if (this.dir === 'up') destTileY = this.tileY - 1;
      else if (this.dir === 'down') destTileY = this.tileY + 1;
      else if (this.dir === 'left') destTileX = this.tileX - 1;
      else if (this.dir === 'right') destTileX = this.tileX + 1;
    }

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
    this.grassEffectManager.cleanup(ownerPositions);

    return this.currentState.update(this, delta);
  }

  // Helper for states to process movement
  public processMovement(delta: number, speed: number): boolean {
    let didRenderMove = false;

    if (this.isMoving) {
      // Continue movement based on time delta
      const moveAmount = speed * delta;
      this.pixelsMoved += moveAmount;
      
      // Check if movement just completed
      const movementJustCompleted = this.pixelsMoved >= this.TILE_PIXELS;

      if (movementJustCompleted) {
        // Movement complete - snap to tile
        this.pixelsMoved = 0;
        this.isMoving = false;
        
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
        
        if (isDebugMode()) {
          console.log(`[MOVEMENT] Completed move from (${oldTileX}, ${oldTileY}) → (${this.tileX}, ${this.tileY})`);
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
          console.log(`[Player] COMPLETED MOVEMENT - snapped to tile (${this.tileX}, ${this.tileY}) at pixel (${this.x}, ${this.y}) - next walk frame: ${this.walkFrameAlternate ? 2 : 1}`);
        }
      } else {
        // Only apply movement if we haven't completed the tile
        const oldX = this.x;
        const oldY = this.y;
        
        if (this.dir === 'up') this.y -= moveAmount;
        else if (this.dir === 'down') this.y += moveAmount;
        else if (this.dir === 'left') this.x -= moveAmount;
        else if (this.dir === 'right') this.x += moveAmount;
        
        if (isDebugMode()) {
          console.log(`[Player] delta:${delta.toFixed(2)}ms moveAmt:${moveAmount.toFixed(3)}px x:${oldX.toFixed(2)}->${this.x.toFixed(2)} y:${oldY.toFixed(2)}->${this.y.toFixed(2)} progress:${this.pixelsMoved.toFixed(2)}/${this.TILE_PIXELS}`);
        }

        didRenderMove = true;
      }
    }

    return didRenderMove || this.isMoving;
  }

  public handleDirectionInput(keys: { [key: string]: boolean }) {
    let dx = 0;
    let dy = 0;
    let newDir = this.dir;
    let attemptMove = false;


    if (keys['ArrowUp']) {
      dy = -1;
      newDir = 'up';
      attemptMove = true;
    } else if (keys['ArrowDown']) {
      dy = 1;
      newDir = 'down';
      attemptMove = true;
    } else if (keys['ArrowLeft']) {
      dx = -1;
      newDir = 'left';
      attemptMove = true;
    } else if (keys['ArrowRight']) {
      dx = 1;
      newDir = 'right';
      attemptMove = true;
    }

    if (attemptMove) {
      this.dir = newDir;
      
      if (isDebugMode()) {
        console.log(`[INPUT] Attempting to move ${newDir} from (${this.tileX}, ${this.tileY})`);
      }
      
      // Give door interactions a chance to consume input before collision/movement.
      const handled = this.tryInteract(newDir);
      if (handled) {
        return;
      }
      
      // Check collision at target tile
      const targetTileX = this.tileX + dx;
      const targetTileY = this.tileY + dy;
      
      if (isDebugMode()) {
        console.log(`[INPUT] Target tile: (${targetTileX}, ${targetTileY})`);
      }
      
      const resolved = this.tileResolver ? this.tileResolver(targetTileX, targetTileY) : null;
      const behavior = resolved?.attributes?.behavior ?? -1;
      const blocked = this.isCollisionAt(targetTileX, targetTileY);
      
      // Check if we're standing on an arrow warp tile
      const currentResolved = this.tileResolver ? this.tileResolver(this.tileX, this.tileY) : null;
      const currentBehavior = currentResolved?.attributes?.behavior ?? -1;
      const isOnArrowWarp = isArrowWarpBehavior(currentBehavior);

      if (!blocked) {
        if (isDebugMode()) {
          console.log(`[INPUT] Movement ALLOWED, starting move to (${targetTileX}, ${targetTileY})`);
        }

        // Create sand footprint as we START to move off current tile
        this.checkAndTriggerSandFootprints();

        // Trigger TALL grass effect when we START stepping onto the tile (pokeemerald: OnBeginStep)
        // Long grass effect is triggered at end of movement (pokeemerald: OnFinishStep style)
        this.checkAndTriggerGrassEffectOnBeginStep(targetTileX, targetTileY);

        this.isMoving = true;
        this.pixelsMoved = 0;
      } else if (this.doorWarpHandler && (isDoorBehavior(behavior) || requiresDoorExitSequence(behavior))) {
        if (isDebugMode()) {
          console.log('[PLAYER_DOOR_WARP]', { targetX: targetTileX, targetY: targetTileY, behavior });
        }
        this.doorWarpHandler({ targetX: targetTileX, targetY: targetTileY, behavior });
      } else if (this.doorWarpHandler && isOnArrowWarp) {
        let arrowDir: 'up' | 'down' | 'left' | 'right' | null = null;
        if (currentBehavior === MB_NORTH_ARROW_WARP) arrowDir = 'up';
        else if (currentBehavior === MB_SOUTH_ARROW_WARP || currentBehavior === MB_WATER_SOUTH_ARROW_WARP) arrowDir = 'down';
        else if (currentBehavior === MB_WEST_ARROW_WARP) arrowDir = 'left';
        else if (currentBehavior === MB_EAST_ARROW_WARP) arrowDir = 'right';
        
        if (arrowDir && arrowDir === newDir) {
          this.doorWarpHandler({ targetX: this.tileX, targetY: this.tileY, behavior: currentBehavior });
        }
      } else {
        if (isDebugMode()) {
          console.warn(`[INPUT] Movement BLOCKED to (${targetTileX}, ${targetTileY})`);
        }
      }
    }
  }

  public forceStep(direction: 'up' | 'down' | 'left' | 'right') {
    this.dir = direction;

    // Create sand footprint as we START to move
    this.checkAndTriggerSandFootprints();

    // Calculate target tile and trigger tall grass on begin step
    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    this.checkAndTriggerGrassEffectOnBeginStep(this.tileX + dx, this.tileY + dy);

    this.isMoving = true;
    this.pixelsMoved = 0;
  }

  public forceMove(direction: 'up' | 'down' | 'left' | 'right', ignoreCollision: boolean = false) {
    this.dir = direction;
    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    const targetTileX = this.tileX + dx;
    const targetTileY = this.tileY + dy;

    if (ignoreCollision) {
      // Create sand footprint as we START to move
      this.checkAndTriggerSandFootprints();
      // Trigger tall grass on begin step
      this.checkAndTriggerGrassEffectOnBeginStep(targetTileX, targetTileY);
      this.isMoving = true;
      this.pixelsMoved = 0;
      return true;
    }

    if (!this.isCollisionAt(targetTileX, targetTileY)) {
      // Create sand footprint as we START to move
      this.checkAndTriggerSandFootprints();
      // Trigger tall grass on begin step
      this.checkAndTriggerGrassEffectOnBeginStep(targetTileX, targetTileY);
      this.isMoving = true;
      this.pixelsMoved = 0;
      return true;
    }
    return false;
  }

  public getCameraFocus() {
    const { width, height } = this.getSpriteSize();
    return {
      x: this.x + width / 2,
      y: this.y + height - this.TILE_PIXELS / 2,
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
    
    // Ground level (0) can go anywhere
    // Reference: public/pokeemerald/src/event_object_movement.c:7711-7712
    if (playerElevation === 0) {
      if (isDebugMode()) {
        console.log(`[ELEVATION] Player at ground level (0), can move to (${tileX}, ${tileY})`);
      }
      return false;
    }
    
    const resolved = this.tileResolver?.(tileX, tileY);
    if (!resolved) {
      if (isDebugMode()) {
        console.warn(`[ELEVATION] Target tile (${tileX}, ${tileY}) out of bounds - BLOCKED`);
      }
      return true; // Out of bounds = mismatch
    }
    
    const tileElevation = resolved.mapTile.elevation;
    
    // Tiles with elevation 0 or 15 are accessible from any elevation
    // Reference: public/pokeemerald/src/event_object_movement.c:7716-7717
    if (tileElevation === 0 || tileElevation === 15) {
      if (isDebugMode()) {
        console.log(`[ELEVATION] Target (${tileX}, ${tileY}) is universal (elev ${tileElevation}), player at ${playerElevation} can access - ALLOWED`);
      }
      return false;
    }

    // Player elevation 15 is also universal (can access any target elevation)
    if (playerElevation === 15) {
      if (isDebugMode()) {
        console.log(`[ELEVATION] Player is universal (elev 15), can access target (${tileX}, ${tileY}) at ${tileElevation} - ALLOWED`);
      }
      return false;
    }
    
    // Different non-zero elevations = mismatch = COLLISION
    // Reference: public/pokeemerald/src/event_object_movement.c:7719-7720
    if (tileElevation !== playerElevation) {
      if (isDebugMode()) {
        console.warn(`[ELEVATION MISMATCH] Player at elevation ${playerElevation} CANNOT move to (${tileX}, ${tileY}) at elevation ${tileElevation} - BLOCKED`);
      }
      return true;
    }
    
    if (isDebugMode()) {
      console.log(`[ELEVATION] Player at ${playerElevation} can move to (${tileX}, ${tileY}) at ${tileElevation} - ALLOWED`);
    }
    return false;
  }

  private isCollisionAt(tileX: number, tileY: number, options?: { ignoreElevation?: boolean }): boolean {
    const resolved = this.tileResolver ? this.tileResolver(tileX, tileY) : null;
    if (!resolved) {
      if (isDebugMode()) {
        console.log(`[COLLISION] Tile (${tileX}, ${tileY}) out of bounds - BLOCKED`);
      }
      return true; // Out of bounds = collision
    }

    const mapTile = resolved.mapTile;
    const attributes = resolved.attributes;

    if (!attributes) {
      if (isDebugMode()) {
        console.log(`[COLLISION] Tile (${tileX}, ${tileY}) has no attributes - PASSABLE`);
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
    const currentlySurfing = this.surfingController.isSurfing();

    if (currentlySurfing) {
      // While surfing: check if target is surfable water
      if (isSurfableBehavior(behavior)) {
        // CRITICAL: Still need to check for NPC/object collision even on water!
        // Reference: CheckForObjectEventCollision in event_object_movement.c
        if (this.objectCollisionChecker && this.objectCollisionChecker(tileX, tileY)) {
          if (isDebugMode()) {
            console.log(`[COLLISION] Tile (${tileX}, ${tileY}) is water but blocked by NPC/object - BLOCKED`);
          }
          return true;
        }

        if (isDebugMode()) {
          console.log(`[COLLISION] Tile (${tileX}, ${tileY}) is surfable water while surfing - PASSABLE`);
        }
        return false; // Water is passable when surfing
      }

      // Trying to move onto land while surfing
      // Reference: CanStopSurfing checks MapGridGetElevationAt(x, y) == 3
      // This returns COLLISION_STOP_SURFING which the movement system handles
      // For now, we'll block here and let handleSurfingInput handle dismount
      if (isDebugMode()) {
        console.log(`[COLLISION] Tile (${tileX}, ${tileY}) is not water while surfing - checking dismount`);
      }
      // Don't block here - SurfingState handles dismount logic via handleSurfingInput
      // Return true to signal collision, but the state machine checks canDismount
      return true;
    }

    // === NORMAL WALKING COLLISION LOGIC ===

    // Special case: MB_SAND and MB_DEEP_SAND should be walkable
    const isSand = behavior === MB_SAND || behavior === MB_DEEP_SAND;
    if (isSand) {
      if (isDebugMode()) {
        console.log(`[COLLISION] Tile (${tileX}, ${tileY}) is sand - PASSABLE`);
      }
      return false;
    }

    // Check collision bits from map.bin (bits 10-11)
    if (!isCollisionPassable(collision) && !isDoorBehavior(behavior)) {
      if (isDebugMode()) {
        console.log(`[COLLISION] Tile (${tileX}, ${tileY}) metatile=${metatileId} has collision bit=${collision}, behavior=${behavior} - BLOCKED`);
      }
      return true;
    }

    // Elevation mismatch check
    // Reference: public/pokeemerald/src/event_object_movement.c:4667
    // SKIP if options.ignoreElevation is true (e.g. for ledge jumping)
    if (!options?.ignoreElevation && this.isElevationMismatchAt(tileX, tileY)) {
      if (isDebugMode()) {
        console.log(`[COLLISION] Tile (${tileX}, ${tileY}) blocked by ELEVATION MISMATCH`);
      }
      return true; // COLLISION_ELEVATION_MISMATCH
    }

    // Impassable behaviors
    if (behavior === 1) {
      if (isDebugMode()) {
        console.log(`[COLLISION] Tile (${tileX}, ${tileY}) is SECRET_BASE_WALL - BLOCKED`);
      }
      return true;
    }

    // Surfable/deep water and waterfalls require surf (when NOT surfing)
    if (isSurfableBehavior(behavior)) {
      if (isDebugMode()) {
        console.log(`[COLLISION] Tile (${tileX}, ${tileY}) is water (behavior=${behavior}) without surf - BLOCKED`);
      }
      return true;
    }

    // Directionally impassable
    if (behavior >= 48 && behavior <= 55) {
      if (isDebugMode()) {
        console.log(`[COLLISION] Tile (${tileX}, ${tileY}) is directionally impassable (behavior=${behavior}) - BLOCKED`);
      }
      return true;
    }

    // Check for object events (item balls, NPCs, etc.) blocking this tile
    if (this.objectCollisionChecker && this.objectCollisionChecker(tileX, tileY)) {
      if (isDebugMode()) {
        console.log(`[COLLISION] Tile (${tileX}, ${tileY}) is blocked by object event - BLOCKED`);
      }
      return true;
    }

    if (isDebugMode()) {
      console.log(`[COLLISION] Tile (${tileX}, ${tileY}) metatile=${metatileId} elev=${elevation} behavior=${behavior} - PASSABLE`);
    }
    return false; // Passable
  }

  public getFrameInfo(): FrameInfo | null {
    return this.currentState.getFrameInfo(this);
  }

  // Helper to calculate frame info based on sprite key and current state
  public calculateFrameInfo(spriteKey: string, forceWalkFrame: boolean = false): FrameInfo | null {
    const sprite = this.sprites[spriteKey];
    if (!sprite) return null;

    // Preserve subpixel position; final rounding happens in render() alongside camera coordinates
    // (Flooring here causes 1px shiver when combined with round() in render())
    const renderX = this.x;
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

    const srcX = srcIndex * this.SPRITE_WIDTH;
    const srcY = 0;

    return {
      sprite: sprite,
      sx: srcX,
      sy: srcY,
      sw: this.SPRITE_WIDTH,
      sh: this.SPRITE_HEIGHT,
      renderX,
      renderY,
      flip,
    };
  }

  /**
   * Calculate frame info for surfing sprite (32x32 frames)
   * Surfing sprite layout: 6 frames of 32x32
   * - Frame 0-1: Down (idle, walk)
   * - Frame 2-3: Up (idle, walk)
   * - Frame 4-5: Left/Right (idle, walk) - flip for right
   */
  public calculateSurfingFrameInfo(): FrameInfo | null {
    const sprite = this.sprites['surfing'];
    if (!sprite) {
      // Fall back to walking sprite if surfing not loaded
      return this.calculateFrameInfo('walking');
    }

    const SURF_FRAME_WIDTH = 32;
    const SURF_FRAME_HEIGHT = 32;

    // DO NOT floor here - allow smooth sub-pixel positioning during movement.
    // Rounding will be applied in the render function AFTER adding bob offset
    // to ensure player and blob use the same final integer positions.
    // Center 32px sprite horizontally on 16px player position: offset by (32-16)/2 = 8
    const renderX = this.x - 8;
    // player.y is already set so feet are at tile bottom for 32px tall sprite
    // Surfing sprite is also 32px tall, so just use player.y directly
    const renderY = this.y;

    let srcIndex = 0;
    let flip = false;

    // Surfing sprite layout (6 frames):
    // 0: down idle, 1: down walk (mount/dismount only)
    // 2: up idle, 3: up walk (mount/dismount only)
    // 4: left/right idle, 5: left/right walk (mount/dismount only)
    //
    // GBA behavior during CONTINUOUS SURFING:
    // - Player sprite stays on STATIC IDLE frame (no animation)
    // - Only the Y-position bobs up/down with the surf blob
    // - Walk frames (1, 3, 5) are ONLY used during mount/dismount jump sequences

    // Use walk frames during mount/dismount, idle frames during normal surfing
    const isJumping = this.surfingController.isJumping();
    const frameOffset = isJumping ? 1 : 0; // +1 for walk frame

    if (this.dir === 'down') srcIndex = 0 + frameOffset;
    else if (this.dir === 'up') srcIndex = 2 + frameOffset;
    else if (this.dir === 'left') srcIndex = 4 + frameOffset;
    else if (this.dir === 'right') { srcIndex = 4 + frameOffset; flip = true; }

    const srcX = srcIndex * SURF_FRAME_WIDTH;
    const srcY = 0;

    return {
      sprite: sprite,
      sx: srcX,
      sy: srcY,
      sw: SURF_FRAME_WIDTH,
      sh: SURF_FRAME_HEIGHT,
      renderX,
      renderY,
      flip,
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
    return { width: this.SPRITE_WIDTH, height: this.SPRITE_HEIGHT };
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
   * Get the previous tile position (before current movement).
   * Used for reflection detection - GBA checks both current AND previous coords.
   */
  public getPreviousTilePosition() {
    return { x: this.prevTileX, y: this.prevTileY };
  }

  /**
   * Get the destination tile during movement (where player is moving TO).
   *
   * GBA SEMANTICS (critical for reflection detection):
   * - currentCoords = DESTINATION tile (where moving TO)
   * - previousCoords = ORIGIN tile (where came FROM)
   *
   * During movement from tile A to tile B:
   * - this.tileX/tileY = A (origin, updated to B only when movement completes)
   * - getDestinationTile() = B (destination during movement, A when idle)
   *
   * This matches ObjectEventGetNearbyReflectionType in event_object_movement.c
   * which checks tiles below BOTH currentCoords AND previousCoords.
   */
  public getDestinationTile(): { x: number; y: number } {
    if (!this.isMoving) {
      // Not moving - destination equals current position
      return { x: this.tileX, y: this.tileY };
    }

    // Calculate destination based on movement direction
    let destX = this.tileX;
    let destY = this.tileY;

    switch (this.dir) {
      case 'up':
        destY = this.tileY - 1;
        break;
      case 'down':
        destY = this.tileY + 1;
        break;
      case 'left':
        destX = this.tileX - 1;
        break;
      case 'right':
        destX = this.tileX + 1;
        break;
    }

    return { x: destX, y: destY };
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
  }

  public setDoorWarpHandler(handler: ((request: DoorWarpRequest) => void) | null) {
    this.doorWarpHandler = handler;
  }

  public setObjectCollisionChecker(checker: ObjectCollisionChecker | null) {
    this.objectCollisionChecker = checker;
  }

  public tryInteract(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
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
    let dx = 0;
    let dy = 0;
    let dir: 'up' | 'down' | 'left' | 'right' | null = null;

    if (keys['ArrowUp']) { dy = -1; dir = 'up'; }
    else if (keys['ArrowDown']) { dy = 1; dir = 'down'; }
    else if (keys['ArrowLeft']) { dx = -1; dir = 'left'; }
    else if (keys['ArrowRight']) { dx = 1; dir = 'right'; }

    if (!dir) return false;

    // Check if the tile we are moving INTO is a ledge that allows jumping in our direction
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

    if (isLedge) {
      // Ensure the tile AFTER the ledge is passable
      const landTileX = targetTileX + dx;
      const landTileY = targetTileY + dy;
      // Check collision but IGNORE elevation mismatch because ledges are designed to change elevation
      if (!this.isCollisionAt(landTileX, landTileY, { ignoreElevation: true })) {
        this.dir = dir; // Face the ledge
        this.changeState(new JumpingState(wasRunning));
        return true;
      }
    }

    return false;
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
   * Check if player just left a sand/footprints tile and create footprint effect.
   * Called at END of movement (pokeemerald: GetGroundEffectFlags_Tracks)
   * Uses previousMetatileBehavior and previousCoords
   */
  private checkAndTriggerSandFootprints(): void {
    // Check if previous tile was sand (where we're leaving footprints)
    if (this.prevTileBehavior === undefined) return;
    
    const isSand = this.prevTileBehavior === MB_SAND;
    const isDeepSand = this.prevTileBehavior === MB_DEEP_SAND;
    
    if (isSand || isDeepSand) {
      // Create footprint on the tile we JUST LEFT (prevTile)
      const type = isDeepSand ? 'deep_sand' : 'sand';
      this.grassEffectManager.create(
        this.prevTileX,
        this.prevTileY,
        type,
        false,
        'player',
        this.dir  // Pass current facing direction
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
        console.log(
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
          console.log(
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

  /**
   * Handle input while surfing.
   * Surfing movement is similar to walking but restricted to water tiles.
   * Attempting to move onto land triggers dismount.
   *
   * @param keys Currently pressed keys
   */
  public handleSurfingInput(keys: { [key: string]: boolean }): void {
    let dx = 0;
    let dy = 0;
    let newDir = this.dir;
    let attemptMove = false;

    if (keys['ArrowUp']) {
      dy = -1;
      newDir = 'up';
      attemptMove = true;
    } else if (keys['ArrowDown']) {
      dy = 1;
      newDir = 'down';
      attemptMove = true;
    } else if (keys['ArrowLeft']) {
      dx = -1;
      newDir = 'left';
      attemptMove = true;
    } else if (keys['ArrowRight']) {
      dx = 1;
      newDir = 'right';
      attemptMove = true;
    }

    if (attemptMove) {
      this.dir = newDir;
      this.surfingController.updateBlobDirection(newDir);

      const targetTileX = this.tileX + dx;
      const targetTileY = this.tileY + dy;

      // Check if target is surfable water
      const isSurfable = this.surfingController.isTileSurfable(
        targetTileX,
        targetTileY,
        this.tileResolver ?? undefined
      );

      if (isSurfable) {
        // Match CheckForObjectEventCollision: even on water, block if an object/NPC is present
        const blocked = this.isCollisionAt(targetTileX, targetTileY);
        if (!blocked) {
          // Continue surfing - normal water movement
          this.isMoving = true;
          this.pixelsMoved = 0;
          if (isDebugMode()) {
            console.log(`[SURF] Moving to water tile (${targetTileX}, ${targetTileY})`);
          }
        } else if (isDebugMode()) {
          console.log(`[SURF] Water tile (${targetTileX}, ${targetTileY}) blocked (object/event)`);
        }
      } else {
        // Check if we can dismount to this tile
        const canDismount = this.surfingController.canDismount(
          targetTileX,
          targetTileY,
          this.tileResolver ?? undefined
        );

        if (canDismount) {
          // Start dismount sequence
          if (isDebugMode()) {
            console.log(`[SURF] Starting dismount to (${targetTileX}, ${targetTileY})`);
          }
          this.surfingController.startDismountSequence(
            this.tileX,
            this.tileY,
            this.x,
            this.y,
            newDir
          );
          this.changeState(new SurfJumpingState(false));
        } else {
          if (isDebugMode()) {
            console.log(`[SURF] Cannot move to (${targetTileX}, ${targetTileY}) - blocked`);
          }
        }
      }
    }
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
        console.log(`[SURF] Cannot initiate surf: ${check.reason}`);
      }
      return;
    }

    if (isDebugMode()) {
      console.log(`[SURF] Starting surf sequence to (${check.targetX}, ${check.targetY})`);
    }

    this.surfingController.startSurfSequence(
      check.targetX,
      check.targetY,
      this.x,
      this.y,
      this.dir
    );

    this.changeState(new SurfJumpingState(true));
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

  /**
   * Get the current sprite sheet key for WebGL rendering.
   * Returns 'surfing', 'running', or 'walking'.
   */
  public getCurrentSpriteKey(): string {
    // Check for surfing OR mount/dismount jump (which also uses surfing sprite)
    if (this.isSurfing() || this.surfingController.isJumping()) return 'surfing';
    if (this.isRunning()) return 'running';
    return 'walking';
  }

  /**
   * Get the tile resolver for surfing controller use.
   */
  public getTileResolver(): TileResolver | null {
    return this.tileResolver;
  }
}
