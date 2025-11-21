import type { MetatileAttributes } from '../utils/mapLoader';
import { getCollisionFromMapTile, isCollisionPassable } from '../utils/mapLoader';
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
  isDoorBehavior,
  requiresDoorExitSequence,
  isArrowWarpBehavior,

} from '../utils/metatileBehaviors';

export interface ResolvedTileInfo {
  mapTile: number;
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
const JUMP_DURATION = 32; // 32 frames
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

  enter(controller: PlayerController): void {
    // Ensure we are using the walking sprite
    // controller.setSprite('walking'); // We'll implement sprite switching logic in getFrameInfo or similar
  }

  exit(controller: PlayerController): void {}

  update(controller: PlayerController, delta: number): boolean {
    return controller.processMovement(delta, this.SPEED);
  }

  handleInput(controller: PlayerController, keys: { [key: string]: boolean }): void {
    // Check for transition to running
    if (keys['z'] || keys['Z']) { // Z is mapped to B button
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

  enter(controller: PlayerController): void {
    // controller.setSprite('running');
  }

  exit(controller: PlayerController): void {}

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

  handleInput(controller: PlayerController, keys: { [key: string]: boolean }): void {
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
  public prevTileX: number = 0;
  public prevTileY: number = 0;
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
    this.prevTileX = tileX;
    this.prevTileY = tileY;
    this.tileX = tileX;
    this.tileY = tileY;
    this.x = tileX * this.TILE_PIXELS;
    this.y = tileY * this.TILE_PIXELS - 16; // Sprite is 32px tall, feet at bottom
    this.isMoving = false;
    this.pixelsMoved = 0;
  }

  public setPositionAndDirection(tileX: number, tileY: number, dir: 'down' | 'up' | 'left' | 'right') {
    this.setPosition(tileX, tileY);
    this.dir = dir;
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

    return this.currentState.update(this, delta);
  }

  // Helper for states to process movement
  public processMovement(delta: number, speed: number): boolean {
    let didRenderMove = false;

    if (this.isMoving) {
      // Continue movement based on time delta
      const moveAmount = speed * delta;
      this.pixelsMoved += moveAmount;
      
      // Check if movement is complete BEFORE applying movement
      if (this.pixelsMoved >= this.TILE_PIXELS) {
        this.isMoving = false;
        this.pixelsMoved = 0;
        
        // Alternate walk frame for next tile
        this.walkFrameAlternate = !this.walkFrameAlternate;
        
        // Update logical tile position
        this.prevTileX = this.tileX;
        this.prevTileY = this.tileY;
        if (this.dir === 'up') this.tileY--;
        else if (this.dir === 'down') this.tileY++;
        else if (this.dir === 'left') this.tileX--;
        else if (this.dir === 'right') this.tileX++;
        
        // Snap to grid
        this.x = this.tileX * this.TILE_PIXELS;
        this.y = this.tileY * this.TILE_PIXELS - 16;
        didRenderMove = true;
        
        if ((window as unknown as { DEBUG_PLAYER?: boolean }).DEBUG_PLAYER) {
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
        
        if ((window as unknown as { DEBUG_PLAYER?: boolean }).DEBUG_PLAYER) {
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
    const prevDir = this.dir;

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
      
      // Give door interactions a chance to consume input before collision/movement.
      const handled = this.tryInteract(newDir);
      if (handled) {
        return;
      }
      
      // Check collision at target tile
      const targetTileX = this.tileX + dx;
      const targetTileY = this.tileY + dy;
      
      const resolved = this.tileResolver ? this.tileResolver(targetTileX, targetTileY) : null;
      const behavior = resolved?.attributes?.behavior ?? -1;
      const blocked = this.isCollisionAt(targetTileX, targetTileY);
      
      // Check if we're standing on an arrow warp tile
      const currentResolved = this.tileResolver ? this.tileResolver(this.tileX, this.tileY) : null;
      const currentBehavior = currentResolved?.attributes?.behavior ?? -1;
      const isOnArrowWarp = isArrowWarpBehavior(currentBehavior);

      if (!blocked) {
        this.isMoving = true;
        this.pixelsMoved = 0;
      } else if (this.doorWarpHandler && (isDoorBehavior(behavior) || requiresDoorExitSequence(behavior))) {
        console.log('[PLAYER_DOOR_WARP]', { targetX: targetTileX, targetY: targetTileY, behavior });
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
      }
    }
  }

  public forceStep(direction: 'up' | 'down' | 'left' | 'right') {
    this.dir = direction;
    this.isMoving = true;
    this.pixelsMoved = 0;
  }

  public forceMove(direction: 'up' | 'down' | 'left' | 'right', ignoreCollision: boolean = false) {
    this.dir = direction;
    if (ignoreCollision) {
      this.isMoving = true;
      this.pixelsMoved = 0;
      return true;
    }
    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    const targetTileX = this.tileX + dx;
    const targetTileY = this.tileY + dy;
    if (!this.isCollisionAt(targetTileX, targetTileY)) {
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

  private isCollisionAt(tileX: number, tileY: number): boolean {
    const resolved = this.tileResolver ? this.tileResolver(tileX, tileY) : null;
    if (!resolved) return true; // Out of bounds = collision
    const mapTile = resolved.mapTile;
    // Get metatile ID and check behavior
    const attributes = resolved.attributes;
    if (!attributes) {
      return false; // No attributes = passable
    }
    
    // Check behavior (MB_* constants)
    const behavior = attributes.behavior;

    // Check collision bits from map.bin (bits 10-11)
    const collision = getCollisionFromMapTile(mapTile);
    if (!isCollisionPassable(collision) && !isDoorBehavior(behavior)) {
      return true; // Collision bit set
    }

    // Impassable behaviors
    if (behavior === 1) return true; // MB_SECRET_BASE_WALL

    // Surfable/deep water and waterfalls require surf; puddles/shallow water remain walkable.
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
    if (surfBlockers.has(behavior)) return true;

    if (behavior >= 48 && behavior <= 55) return true; // Directionally impassable
    
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
      const shadowY = Math.floor(this.y) - cameraY + 10; // Offset to feet (approx)
      ctx.drawImage(shadow, shadowX, shadowY);
    }

    const frame = this.getFrameInfo();
    if (!frame) return;

    // Disable image smoothing to prevent ghosting on pixel art
    ctx.imageSmoothingEnabled = false;
    
    ctx.save();
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
      if (!this.isCollisionAt(landTileX, landTileY)) {
        this.dir = dir; // Face the ledge
        this.changeState(new JumpingState());
        return true;
      }
    }

    return false;
  }
}
