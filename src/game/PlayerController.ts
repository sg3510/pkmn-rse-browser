import type { MetatileAttributes, MapTileData } from '../utils/mapLoader';
import { isCollisionPassable } from '../utils/mapLoader';
import {
  MB_POND_WATER,
  MB_INTERIOR_DEEP_WATER,
  MB_DEEP_WATER,
  MB_SOOTOPOLIS_DEEP_WATER,
  MB_OCEAN_WATER,
  MB_NO_SURFACING,
  MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2,
  MB_WATERFALL,
  MB_SEAWEED,
  MB_SEAWEED_NO_SURFACING,
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
} from '../utils/metatileBehaviors';
import { GrassEffectManager } from './GrassEffectManager';

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
  private readonly SPEED = 0.12;

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

    // Check for ledge jumping
    if (controller.checkForLedgeJump(keys)) {
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
  }

  update(controller: PlayerController, delta: number): boolean {
    // Move player
    const moveAmount = this.SPEED * delta;
    this.progress += moveAmount;
    
    if (this.progress >= JUMP_DISTANCE) {
      // Jump finished
      controller.changeState(new NormalState());
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
  
  private currentState: PlayerState;
  private grassEffectManager: GrassEffectManager = new GrassEffectManager();
  private currentGrassType: 'long' | null = null; // Track if on long grass (for clipping)

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
   * Player's previous elevation (used for collision checks)
   * Reference: ObjectEvent.previousElevation and PlayerGetElevation()
   * in public/pokeemerald/src/field_player_avatar.c:1188
   */
  private previousElevation: number = 0;
  
  private readonly TILE_PIXELS = 16;
  private readonly SPRITE_WIDTH = 16;
  private readonly SPRITE_HEIGHT = 32;

  constructor() {
    this.currentState = new NormalState();
    this.handleKeyDown = (e: KeyboardEvent) => {
      this.keysPressed[e.key] = true;
    };
    this.handleKeyUp = (e: KeyboardEvent) => {
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
      this.previousElevation = resolved.mapTile.elevation;
      if (isDebugMode()) {
        console.log(`[SPAWN] Player spawned at (${tileX}, ${tileY}) with elevation ${this.previousElevation}, metatile ${resolved.mapTile.metatileId}`);
      }
    } else {
      this.currentElevation = 0;
      this.previousElevation = 0;
      if (isDebugMode()) {
        console.warn(`[SPAWN] Player spawned at (${tileX}, ${tileY}) but tile not found, defaulting to elevation 0`);
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
   * Get the player's elevation for collision detection
   * 
   * Reference: public/pokeemerald/src/field_player_avatar.c:1188
   * Returns previousElevation, which is the elevation of the tile
   * the player is currently standing on.
   */
  public getElevation(): number {
    return this.previousElevation;
  }

  /**
   * Update player elevation based on current tile
   * 
   * Reference: UpdateObjectEventCurrentMovement() and related functions
   * in public/pokeemerald/src/event_object_movement.c
   * 
   * IMPORTANT: In GBA, "previousElevation" represents the elevation of the tile
   * the player is CURRENTLY standing on (used for collision checks).
   * After completing movement, both previousElevation and currentElevation
   * should be set to the new tile's elevation.
   */
  public updateElevation(): void {
    const resolved = this.tileResolver?.(this.tileX, this.tileY);
    
    if (resolved) {
      // Both should reflect the tile we're NOW standing on
      // This is the stable elevation used for collision detection
      const oldElevation = this.previousElevation;
      const mapElevation = resolved.mapTile.elevation;
      
      // IMPORTANT: Elevation 15 is UNIVERSAL.
      // If we step onto a Universal tile, we PRESERVE our previous elevation.
      // This ensures that if we walk from Elev 4 -> Elev 15, we are still effectively at Elev 4.
      // This prevents us from walking off the bridge onto Elev 3 tiles.
      // Reference: public/pokeemerald/src/event_object_movement.c (implied logic)
      let newElevation = mapElevation;
      if (mapElevation === 15) {
        newElevation = oldElevation;
      }
      
      this.currentElevation = newElevation;
      this.previousElevation = newElevation;
      
      if (isDebugMode()) {
        if (oldElevation !== newElevation) {
          console.log(`[ELEVATION] Player elevation changed: ${oldElevation} → ${newElevation} at tile (${this.tileX}, ${this.tileY}) (Map Elev: ${mapElevation})`);
        } else {
          console.log(`[ELEVATION] Player elevation unchanged: ${newElevation} at tile (${this.tileX}, ${this.tileY}) (Map Elev: ${mapElevation})`);
        }
      }
    } else {
      // Out of bounds - keep current elevation
      if (isDebugMode()) {
        console.warn(`[ELEVATION] Out of bounds at (${this.tileX}, ${this.tileY}), keeping elevation ${this.currentElevation}`);
      }
      this.previousElevation = this.currentElevation;
    }
  }

  public lockInput() {
    this.inputLocked = true;
    this.keysPressed = {};
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

    // Update grass effects
    this.grassEffectManager.update();
    
    // Cleanup completed grass effects
    const ownerPositions = new Map();
    ownerPositions.set('player', { tileX: this.tileX, tileY: this.tileY });
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

        // Trigger grass effect on the new tile
        this.checkAndTriggerGrassEffect(this.tileX, this.tileY, false);

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
        
        this.isMoving = true;
        this.pixelsMoved = 0;
        // Grass effect will be triggered at the end of movement in processMovement
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
    
    this.isMoving = true;
    this.pixelsMoved = 0;
    
    // Grass effect will be triggered at the end of movement in processMovement
  }

  public forceMove(direction: 'up' | 'down' | 'left' | 'right', ignoreCollision: boolean = false) {
    this.dir = direction;
    if (ignoreCollision) {
      // Create sand footprint as we START to move
      this.checkAndTriggerSandFootprints();
      this.isMoving = true;
      this.pixelsMoved = 0;
      return true;
    }
    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    const targetTileX = this.tileX + dx;
    const targetTileY = this.tileY + dy;
    if (!this.isCollisionAt(targetTileX, targetTileY)) {
      // Create sand footprint as we START to move
      this.checkAndTriggerSandFootprints();
      this.isMoving = true;
      this.pixelsMoved = 0;
      // Grass effect will be triggered at the end of movement in processMovement
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
    const playerElevation = this.previousElevation;
    
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

    // Surfable/deep water and waterfalls require surf
    const surfBlockers = new Set<number>([
      MB_POND_WATER,
      MB_INTERIOR_DEEP_WATER,
      MB_DEEP_WATER,
      MB_SOOTOPOLIS_DEEP_WATER,
      MB_OCEAN_WATER,
      MB_NO_SURFACING,
      MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2,
      MB_WATERFALL,
      MB_SEAWEED,
      MB_SEAWEED_NO_SURFACING,
    ]);
    if (surfBlockers.has(behavior)) {
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

    // Round to whole pixels to prevent sub-pixel blur and ghosting
    const renderX = Math.floor(this.x);
    const renderY = Math.floor(this.y + this.spriteYOffset);

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

  public render(ctx: CanvasRenderingContext2D, cameraX: number = 0, cameraY: number = 0) {
    // Render shadow if enabled
    if (this.showShadow && this.sprites['shadow']) {
      const shadow = this.sprites['shadow'];
      const shadowX = Math.floor(this.x) - cameraX;
      const shadowY = Math.floor(this.y) - cameraY + 28; // Offset to fees (approx)
      ctx.drawImage(shadow, shadowX, shadowY);
    }

    const frame = this.getFrameInfo();
    if (!frame) return;

    // Disable image smoothing to prevent ghosting on pixel art
    ctx.imageSmoothingEnabled = false;
    
    ctx.save();
    
    // Apply clipping for long grass (hide bottom 50% of sprite)
    if (this.isOnLongGrass()) {
      const destX = frame.renderX - cameraX;
      const destY = frame.renderY - cameraY;
      // Create a clipping rectangle that shows only the top half
      ctx.beginPath();
      ctx.rect(destX, destY, frame.sw, frame.sh / 2);
      ctx.clip();
    }
    
    const destX = frame.renderX - cameraX;
    const destY = frame.renderY - cameraY;
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

  public checkForLedgeJump(keys: { [key: string]: boolean }): boolean {
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
        this.changeState(new JumpingState());
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
   * Based on pokeemerald logic:
   * - GroundEffect_SpawnOnTallGrass / SpawnOnLongGrass (skip animation)
   * - GroundEffect_StepOnTallGrass / StepOnLongGrass (play animation)
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
   * Get the grass effect manager for rendering.
   */
  public getGrassEffectManager(): GrassEffectManager {
    return this.grassEffectManager;
  }

  /**
   * Check if player is currently on long grass (for sprite clipping).
   */
  public isOnLongGrass(): boolean {
    return this.currentGrassType === 'long';
  }
}
