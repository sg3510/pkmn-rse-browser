import type { MapData } from '../utils/mapLoader';

export class PlayerController {
  public x: number = 0;
  public y: number = 0;
  public tileX: number = 0;
  public tileY: number = 0;
  public dir: 'down' | 'up' | 'left' | 'right' = 'down';
  public isMoving: boolean = false;
  
  private pixelsMoved: number = 0;
  private frameIndex: number = 0;
  private lastFrameTime: number = 0;
  private sprite: HTMLCanvasElement | null = null;
  private keysPressed: { [key: string]: boolean } = {};
  
  private readonly MOVE_SPEED = 0.5;
  private readonly TILE_PIXELS = 16;

  constructor() {
    this.bindInputEvents();
  }

  private bindInputEvents() {
    window.addEventListener('keydown', (e) => {
      this.keysPressed[e.key] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keysPressed[e.key] = false;
    });
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
    this.tileX = tileX;
    this.tileY = tileY;
    this.x = tileX * this.TILE_PIXELS;
    this.y = tileY * this.TILE_PIXELS - 16; // Sprite is 32px tall, feet at bottom
  }

  public update(timestamp: number, mapData: MapData) {
    if (this.isMoving) {
      // Continue movement
      this.pixelsMoved += this.MOVE_SPEED;
      
      if (this.dir === 'up') this.y -= this.MOVE_SPEED;
      else if (this.dir === 'down') this.y += this.MOVE_SPEED;
      else if (this.dir === 'left') this.x -= this.MOVE_SPEED;
      else if (this.dir === 'right') this.x += this.MOVE_SPEED;

      // Check if movement is complete
      if (this.pixelsMoved >= this.TILE_PIXELS) {
        this.isMoving = false;
        this.pixelsMoved = 0;
        
        // Update logical tile position
        if (this.dir === 'up') this.tileY--;
        else if (this.dir === 'down') this.tileY++;
        else if (this.dir === 'left') this.tileX--;
        else if (this.dir === 'right') this.tileX++;
        
        // Snap to grid
        this.x = this.tileX * this.TILE_PIXELS;
        this.y = this.tileY * this.TILE_PIXELS - 16;
      }
      
      // Update animation frame every 150ms
      if (timestamp - this.lastFrameTime > 150) {
        this.frameIndex = (this.frameIndex + 1) % 2;
        this.lastFrameTime = timestamp;
      }
    } else {
      // Check for new input
      let dx = 0;
      let dy = 0;
      let newDir = this.dir;
      let attemptMove = false;

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
        
        // Check boundaries
        const targetTileX = this.tileX + dx;
        const targetTileY = this.tileY + dy;
        
        if (targetTileX >= 0 && targetTileX < mapData.width &&
            targetTileY >= 0 && targetTileY < mapData.height) {
          this.isMoving = true;
          this.pixelsMoved = 0;
        }
      } else {
        this.frameIndex = 0; // Idle
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D) {
    if (!this.sprite) return;

    const spriteW = 16;
    const spriteH = 32;
    
    let srcIndex = 0;
    let flip = false;

    if (!this.isMoving) {
      if (this.dir === 'down') srcIndex = 0;
      else if (this.dir === 'up') srcIndex = 1;
      else if (this.dir === 'left') srcIndex = 2;
      else if (this.dir === 'right') { srcIndex = 2; flip = true; }
    } else {
      const offset = this.frameIndex; // 0 or 1
      if (this.dir === 'down') srcIndex = 3 + offset;
      else if (this.dir === 'up') srcIndex = 5 + offset;
      else if (this.dir === 'left') srcIndex = 7 + offset;
      else if (this.dir === 'right') { srcIndex = 7 + offset; flip = true; }
    }

    const srcX = srcIndex * spriteW;
    const srcY = 0;

    ctx.save();
    if (flip) {
      ctx.translate(this.x + spriteW, this.y);
      ctx.scale(-1, 1);
      ctx.drawImage(this.sprite, srcX, srcY, spriteW, spriteH, 0, 0, spriteW, spriteH);
    } else {
      ctx.drawImage(this.sprite, srcX, srcY, spriteW, spriteH, this.x, this.y, spriteW, spriteH);
    }
    ctx.restore();
  }
  
  public destroy() {
      // Remove event listeners if needed, though window listeners are tricky with anonymous functions.
      // In a real app we'd store the bound functions.
      // For now, we'll rely on the fact that this component likely persists or we can add cleanup later.
  }
}
