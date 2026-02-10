/**
 * SurfBlobRenderer - Renders the surf blob sprite with bobbing animation
 * Based on pokeemerald/graphics/field_effects/pics/surf_blob.png
 *
 * The blob sprite is 96x32 (3 frames of 32x32):
 * - Frame 0: Down/Up facing
 * - Frame 1: Left facing
 * - Frame 1 (flipped): Right facing
 */

import type { SurfBlobDirection, BlobBobState } from './types';
import { loadImageCanvasAsset } from '../../utils/assetLoader';
import { TICK_60FPS_MS } from '../../config/timing';

export class SurfBlobRenderer {
  private sprite: HTMLCanvasElement | null = null;
  private loadPromise: Promise<void> | null = null;

  // GBA-accurate discrete stepped bobbing (not smooth sine wave)
  // Reference: pokeemerald/src/field_effect_helpers.c:1107-1135
  // - Updates every 4 frames at 60fps = every 66.67ms
  // - Velocity ±1 pixel per update
  // - Reverses direction every 16 frames at 60fps = every 266.67ms
  // - Range: -4 to +4 pixels
  //
  // We use time-based timing for frame-rate independence
  private readonly FRAME_DURATION_MS = TICK_60FPS_MS;
  private readonly BOB_UPDATE_INTERVAL = 4 * this.FRAME_DURATION_MS; // ~66.67ms
  private readonly BOB_REVERSE_INTERVAL = 16 * this.FRAME_DURATION_MS; // ~266.67ms

  private bobAccumulator: number = 0; // Time accumulator for bob updates
  private reverseAccumulator: number = 0; // Time accumulator for direction reversal
  private bobVelocity: number = -1;  // Start at -1 (go down first), matches C code: sprite->sVelocity = -1
  private bobOffset: number = 0;   // Current Y offset (integer, -4 to +4)

  // Blob bob state - controls whether player bobs with blob
  private bobState: BlobBobState = 'BOB_PLAYER_AND_MON';

  // Surf blob sprite dimensions (sprite is 96x32: 3 frames of 32x32)
  private readonly FRAME_WIDTH = 32;
  private readonly FRAME_HEIGHT = 32;

  constructor() {
    this.loadSprite();
  }

  /**
   * Wait for sprite to finish loading.
   * Call this before attempting to upload to WebGL.
   */
  public waitForLoad(): Promise<void> {
    return this.loadSprite();
  }

  private loadSprite(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = loadImageCanvasAsset('/pokeemerald/graphics/field_effects/pics/surf_blob.png', {
      transparency: { type: 'top-left' },
    })
      .then((canvas) => {
        this.sprite = canvas;
      })
      .catch((err) => {
        console.error('Failed to load surf blob sprite:', err);
        throw err;
      });

    return this.loadPromise;
  }

  /**
   * Update bobbing animation using GBA-accurate discrete stepping.
   *
   * Reference: pokeemerald/src/field_effect_helpers.c:1107-1135
   * - ONLY updates when bobState != BOB_NONE
   * - Updates bob position every 4 frames (timer & 0x3 == 0) = every ~66.67ms
   * - Reverses direction every 16 frames (timer & 15 == 0) = every ~266.67ms
   * - This creates a stepped sawtooth pattern, not smooth sine
   *
   * Uses time-based accumulation for frame-rate independent timing.
   *
   * @param deltaMs Time since last update in milliseconds (optional, defaults to 16.67ms)
   */
  public update(deltaMs: number = this.FRAME_DURATION_MS): void {
    // GBA: if (bobState != BOB_NONE) - skip entire update when BOB_NONE
    if (this.bobState === 'BOB_NONE') {
      return;
    }

    // Accumulate time for bob updates
    this.bobAccumulator += deltaMs;
    this.reverseAccumulator += deltaMs;

    // Update bob position every ~66.67ms (4 frames at 60fps)
    while (this.bobAccumulator >= this.BOB_UPDATE_INTERVAL) {
      this.bobAccumulator -= this.BOB_UPDATE_INTERVAL;
      this.bobOffset += this.bobVelocity;
    }

    // Reverse direction every ~266.67ms (16 frames at 60fps)
    while (this.reverseAccumulator >= this.BOB_REVERSE_INTERVAL) {
      this.reverseAccumulator -= this.BOB_REVERSE_INTERVAL;
      this.bobVelocity = -this.bobVelocity;
    }
  }

  /**
   * Get current bob offset (vertical displacement) for the BLOB.
   * Returns 0 when BOB_NONE (no bobbing during mount).
   * Returns integer value (-4 to +4) for GBA-accurate discrete stepping.
   */
  public getBobOffset(): number {
    // When BOB_NONE, blob doesn't visually bob
    if (this.bobState === 'BOB_NONE') {
      return 0;
    }
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
   * Reset bobbing state (for new surf session)
   */
  public resetBob(): void {
    this.bobAccumulator = 0;
    this.reverseAccumulator = 0;
    this.bobVelocity = -1;  // Start at -1 (go down first), matches C code
    this.bobOffset = 0;
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
   * @param ctx Canvas rendering context
   * @param x Screen X position (pixels)
   * @param y Screen Y position (pixels, without bob offset - we apply it here)
   * @param direction Direction player is facing
   * @param applyBob Whether to apply bob offset (false during jump animations)
   */
  public render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: SurfBlobDirection,
    applyBob: boolean = true
  ): void {
    if (!this.sprite) {
      return; // Sprite not loaded yet
    }

    const frameIndex = this.getFrameIndex(direction);
    const sourceX = frameIndex * this.FRAME_WIDTH;
    const flip = direction === 'right';

    // Apply bob offset if requested
    const bobY = applyBob ? this.bobOffset : 0;

    // Use Math.round() for integer positions to match player rendering
    // and avoid floating-point precision jitter
    const finalX = Math.round(x);
    const finalY = Math.round(y + bobY);

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

  /**
   * Get sprite dimensions for positioning calculations
   */
  public getDimensions(): { width: number; height: number } {
    return { width: this.FRAME_WIDTH, height: this.FRAME_HEIGHT };
  }

  /**
   * Get the sprite canvas for WebGL upload
   * Returns null if sprite not yet loaded
   */
  public getSpriteCanvas(): HTMLCanvasElement | null {
    return this.sprite;
  }
}
