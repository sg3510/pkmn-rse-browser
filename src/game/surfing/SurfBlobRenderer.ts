/**
 * SurfBlobRenderer - Renders the surf blob sprite with bobbing animation
 * Based on pokeemerald/graphics/field_effects/pics/surf_blob.png
 */

import type { SurfBlobDirection } from './types';

export class SurfBlobRenderer {
  private sprite: HTMLImageElement | null = null;
  private bobPhase: number = 0;
  private readonly BOB_SPEED = 0.15; // Radians per frame
  private readonly BOB_AMPLITUDE = 2; // Pixels
  
  // Surf blob sprite dimensions
  private readonly FRAME_WIDTH = 32;
  private readonly FRAME_HEIGHT = 16;
  
  constructor() {
    this.loadSprite();
  }
  
  private async loadSprite(): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.sprite = img;
        resolve();
      };
      img.onerror = (err) => {
        console.error('Failed to load surf blob sprite:', err);
        reject(err);
      };
      img.src = '/pokeemerald/graphics/field_effects/pics/surf_blob.png';
    });
  }
  
  /**
   * Update bobbing animation phase
   */
  public update(): void {
    this.bobPhase += this.BOB_SPEED;
    if (this.bobPhase >= Math.PI * 2) {
      this.bobPhase -= Math.PI * 2;
    }
  }
  
  /**
   * Get current bob offset (vertical displacement)
   */
  public getBobOffset(): number {
    return Math.sin(this.bobPhase) * this.BOB_AMPLITUDE;
  }
  
  /**
   * Get frame index based on direction
   */
  private getFrameIndex(direction: SurfBlobDirection): number {
    switch (direction) {
      case 'down':
      case 'up':
        return 0; // Frame 0: down/up (same frame)
      case 'left':
        return 1; // Frame 1: left
      case 'right':
        return 1; // Frame 1: right (will be flipped)
      default:
        return 0;
    }
  }
  
  /**
   * Render the surf blob at specified position
   * @param ctx Canvas rendering context
   * @param x Screen X position (pixels)
   * @param y Screen Y position (pixels)
   * @param direction Direction player is facing
   */
  public render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: SurfBlobDirection
  ): void {
    if (!this.sprite) {
      return; // Sprite not loaded yet
    }
    
    const bobOffset = this.getBobOffset();
    const frameIndex = this.getFrameIndex(direction);
    const sourceX = frameIndex * this.FRAME_WIDTH;
    const flip = direction === 'right';
    
    ctx.save();
    
    // Apply horizontal flip if needed
    if (flip) {
      ctx.translate(x + this.FRAME_WIDTH, y + bobOffset);
      ctx.scale(-1, 1);
      ctx.drawImage(
        this.sprite,
        sourceX, 0,
        this.FRAME_WIDTH, this.FRAME_HEIGHT,
        0, 0,
        this.FRAME_WIDTH, this.FRAME_HEIGHT
      );
    } else {
      ctx.drawImage(
        this.sprite,
        sourceX, 0,
        this.FRAME_WIDTH, this.FRAME_HEIGHT,
        x, y + bobOffset,
        this.FRAME_WIDTH, this.FRAME_HEIGHT
      );
    }
    
    ctx.restore();
  }
  
  /**
   * Check if sprite is loaded and ready to render
   */
  public isReady(): boolean {
    return this.sprite !== null;
  }
}
