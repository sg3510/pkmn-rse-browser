/**
 * SurfBlobRenderer - Renders the surf blob sprite with bobbing animation
 * Based on pokeemerald/graphics/field_effects/pics/surf_blob.png
 */

import type { SurfBlobDirection, BlobBobState } from './types';

export class SurfBlobRenderer {
  private sprite: HTMLCanvasElement | null = null;

  // GBA-accurate discrete stepped bobbing (not smooth sine wave)
  // Reference: pokeemerald/src/field_effect_helpers.c:1107-1135
  // - Updates every 4 frames (timer & 0x3 == 0)
  // - Velocity ±1 pixel per update
  // - Reverses direction every 16 frames (timer & 15 == 0)
  // - Range: -4 to +4 pixels
  private bobTimer: number = 0;
  private bobVelocity: number = 1;  // +1 or -1
  private bobOffset: number = 0;   // Current Y offset (integer, -4 to +4)

  // Blob bob state - controls whether player bobs with blob
  // Reference: field_effect_helpers.c:1020-1023 (SetSurfBlob_BobState)
  private bobState: BlobBobState = 'BOB_PLAYER_AND_MON';

  // Surf blob sprite dimensions (sprite is 96x32: 3 frames of 32x32)
  private readonly FRAME_WIDTH = 32;
  private readonly FRAME_HEIGHT = 32;

  constructor() {
    this.loadSprite();
  }

  private async loadSprite(): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas and apply transparency
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);

        // Get image data and remove background color (top-left pixel)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
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
      img.onerror = (err) => {
        console.error('Failed to load surf blob sprite:', err);
        reject(err);
      };
      img.src = '/pokeemerald/graphics/field_effects/pics/surf_blob.png';
    });
  }
  
  /**
   * Update bobbing animation using GBA-accurate discrete stepping.
   *
   * Reference: pokeemerald/src/field_effect_helpers.c:1107-1135
   * - Updates bob position every 4 frames (timer & 0x3 == 0)
   * - Reverses direction every 16 frames (timer & 15 == 0)
   * - This creates a stepped sawtooth pattern, not smooth sine
   */
  public update(): void {
    this.bobTimer++;

    // Update bob position every 4 frames (timer & 0x3 == 0)
    if ((this.bobTimer & 0x3) === 0) {
      this.bobOffset += this.bobVelocity;
    }

    // Reverse direction every 16 frames (timer & 15 == 0)
    if ((this.bobTimer & 15) === 0) {
      this.bobVelocity = -this.bobVelocity;
    }
  }

  /**
   * Get current bob offset (vertical displacement) for the BLOB.
   * Returns integer value (-4 to +4) for GBA-accurate discrete stepping.
   */
  public getBobOffset(): number {
    return this.bobOffset;
  }

  /**
   * Get bob offset for the PLAYER sprite.
   * - BOB_PLAYER_AND_MON: Returns same offset as blob (player bobs with blob)
   * - BOB_JUST_MON: Returns 0 (player doesn't bob, used during dismount jump)
   * - BOB_NONE: Returns 0
   *
   * Reference: field_effect_helpers.c:1124-1130
   */
  public getPlayerBobOffset(): number {
    if (this.bobState === 'BOB_PLAYER_AND_MON') {
      return this.bobOffset;
    }
    return 0;
  }

  /**
   * Set the blob bob state.
   * - BOB_PLAYER_AND_MON: Both player and blob bob together (normal surfing)
   * - BOB_JUST_MON: Only blob bobs, player doesn't (during dismount jump)
   * - BOB_NONE: Neither bobs
   *
   * Reference: field_effect_helpers.c:1020-1023 (SetSurfBlob_BobState)
   */
  public setBobState(state: BlobBobState): void {
    this.bobState = state;
  }

  /**
   * Get current bob state.
   */
  public getBobState(): BlobBobState {
    return this.bobState;
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
   * Render the surf blob at specified screen position.
   *
   * IMPORTANT: The x,y position should already include the bob offset.
   * MapRenderer calculates the position using the same formula as the player
   * to ensure pixel-perfect synchronization.
   *
   * @param ctx Canvas rendering context
   * @param x Screen X position (pixels, already includes bobOffset)
   * @param y Screen Y position (pixels, already includes bobOffset)
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

    const frameIndex = this.getFrameIndex(direction);
    const sourceX = frameIndex * this.FRAME_WIDTH;
    const flip = direction === 'right';

    // Position is already floored and includes bobOffset from MapRenderer
    // Just use integer positions directly
    const finalX = Math.floor(x);
    const finalY = Math.floor(y);

    ctx.save();

    // Apply horizontal flip if needed
    if (flip) {
      ctx.translate(finalX + this.FRAME_WIDTH, finalY);
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
        finalX, finalY,
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
