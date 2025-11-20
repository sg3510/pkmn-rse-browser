import type { MapData, MetatileAttributes } from '../utils/mapLoader';
import { getCollisionFromMapTile, getMetatileIdFromMapTile, isCollisionPassable } from '../utils/mapLoader';
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
} from '../utils/metatileBehaviors';

interface RenderContext {
  mapData: MapData;
  primaryAttributes: MetatileAttributes[];
  secondaryAttributes: MetatileAttributes[];
}

export class PlayerController {
  public x: number = 0;
  public y: number = 0;
  public tileX: number = 0;
  public tileY: number = 0;
  public prevTileX: number = 0;
  public prevTileY: number = 0;
  public dir: 'down' | 'up' | 'left' | 'right' = 'down';
  public isMoving: boolean = false;
  
  private pixelsMoved: number = 0;
  private sprite: HTMLCanvasElement | null = null;
  private keysPressed: { [key: string]: boolean } = {};
  private walkFrameAlternate: boolean = false; // Alternates between walk frame 1 and 2
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;
  
  // Speed in pixels per millisecond
  // Previous was 0.5px per frame (approx 16.66ms) => 0.5 / 16.66 ≈ 0.03 px/ms
  private readonly MOVE_SPEED = 0.06; 
  private readonly TILE_PIXELS = 16;
  private readonly SPRITE_WIDTH = 16;
  private readonly SPRITE_HEIGHT = 32;

  constructor() {
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

  public async loadSprite(src: string): Promise<void> {
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
        this.sprite = canvas;
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
  }

  private isCollisionAt(tileX: number, tileY: number, ctx: RenderContext): boolean {
    const { mapData, primaryAttributes, secondaryAttributes } = ctx;
    
    // Check bounds
    if (tileX < 0 || tileX >= mapData.width || tileY < 0 || tileY >= mapData.height) {
      return true; // Out of bounds = collision
    }
    
    // Get map tile data
    const mapTile = mapData.layout[tileY * mapData.width + tileX];
    
    // Check collision bits from map.bin (bits 10-11)
    const collision = getCollisionFromMapTile(mapTile);
    if (!isCollisionPassable(collision)) {
      return true; // Collision bit set
    }
    
    // Get metatile ID and check behavior
    const metatileId = getMetatileIdFromMapTile(mapTile);
    const isSecondary = metatileId >= 512;
    const attributes = isSecondary 
      ? secondaryAttributes[metatileId - 512]
      : primaryAttributes[metatileId];
    
    if (!attributes) {
      return false; // No attributes = passable
    }
    
    // Check behavior (MB_* constants)
    // MB_SECRET_BASE_WALL = 1 is impassable
    // Water tiles (16-20, etc.) are impassable without surf
    const behavior = attributes.behavior;
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

  public update(delta: number, ctx: RenderContext): boolean {
    let didRenderMove = false;

    if (this.isMoving) {
      // Continue movement based on time delta
      const moveAmount = this.MOVE_SPEED * delta;
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
      
      // Animation handled in render based on progress
    } else {
      // Check for new input
      let dx = 0;
      let dy = 0;
      let newDir = this.dir;
      let attemptMove = false;
      const prevDir = this.dir;

      if (this.keysPressed['ArrowUp']) {
        dy = -1;
        newDir = 'up';
        attemptMove = true;
      } else if (this.keysPressed['ArrowDown']) {
        dy = 1;
        newDir = 'down';
        attemptMove = true;
      } else if (this.keysPressed['ArrowLeft']) {
        dx = -1;
        newDir = 'left';
        attemptMove = true;
      } else if (this.keysPressed['ArrowRight']) {
        dx = 1;
        newDir = 'right';
        attemptMove = true;
      }

      if (attemptMove) {
        this.dir = newDir;
        if (newDir !== prevDir) {
          didRenderMove = true;
        }
        
        // Check collision at target tile
        const targetTileX = this.tileX + dx;
        const targetTileY = this.tileY + dy;
        
        if (!this.isCollisionAt(targetTileX, targetTileY, ctx)) {
          this.isMoving = true;
          this.pixelsMoved = 0;
          didRenderMove = true;
        }
      }
    }

    return didRenderMove || this.isMoving;
  }

  public getFrameInfo():
    | {
        sprite: HTMLCanvasElement;
        sx: number;
        sy: number;
        sw: number;
        sh: number;
        renderX: number;
        renderY: number;
        flip: boolean;
      }
    | null {
    if (!this.sprite) return null;

    // Round to whole pixels to prevent sub-pixel blur and ghosting
    const renderX = Math.floor(this.x);
    const renderY = Math.floor(this.y);

    let srcIndex = 0;
    let flip = false;

    if (!this.isMoving) {
      // Idle frames
      if (this.dir === 'down') srcIndex = 0;
      else if (this.dir === 'up') srcIndex = 1;
      else if (this.dir === 'left') srcIndex = 2;
      else if (this.dir === 'right') { srcIndex = 2; flip = true; }
    } else {
      // Walking animation: show walk frame in first half, idle in second half of tile
      const progress = this.pixelsMoved / this.TILE_PIXELS;
      if (progress < 0.5) {
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
      sprite: this.sprite,
      sx: srcX,
      sy: srcY,
      sw: this.SPRITE_WIDTH,
      sh: this.SPRITE_HEIGHT,
      renderX,
      renderY,
      flip,
    };
  }

  public render(ctx: CanvasRenderingContext2D) {
    const frame = this.getFrameInfo();
    if (!frame) return;

    // Disable image smoothing to prevent ghosting on pixel art
    ctx.imageSmoothingEnabled = false;
    
    ctx.save();
    if (frame.flip) {
      // Use whole pixel translation for flipped sprites
      ctx.translate(frame.renderX + frame.sw, frame.renderY);
      ctx.scale(-1, 1);
      ctx.drawImage(frame.sprite, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, frame.sw, frame.sh);
    } else {
      ctx.drawImage(
        frame.sprite,
        frame.sx,
        frame.sy,
        frame.sw,
        frame.sh,
        frame.renderX,
        frame.renderY,
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
}
