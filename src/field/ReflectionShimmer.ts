/**
 * ReflectionShimmer - GBA-accurate reflection distortion animation
 *
 * On the GBA, water reflections have a subtle horizontal "shimmer" or "breathing"
 * effect created by invisible distortion sprites that own affine matrices.
 *
 * From pokeemerald's sAffineAnim_ReflectionDistortion_0/1:
 * - 48-frame loop (~0.80s at 59.73fps)
 * - X-scale changes by 1/256 PER FRAME during 4-frame transition steps (integer ConvertScaleParam math)
 * - Total change per step: 4/256 ≈ 1.56%
 * - Full shimmer range: 0.984375–1.015625 (≈ ±1.56% from 1.0)
 * - Matrix 0 and Matrix 1 share the same magnitudes; matrix 1 carries the opposite sign (used for east-facing H-flip)
 * - West/North/South facing sprites use matrix 0
 * - East facing sprites use matrix 1 (because base sprite is H-flipped)
 *
 * Animation sequence (from field_effect_objects.h lines 849-892):
 * Matrix 0: starts at 0xFF (~0.996), steps: +1/256×4f, hold 8f, -1/256×4f, hold 8f... loop
 * Matrix 1: starts at 1.0, steps: -1/256×4f, hold 8f, +1/256×4f, hold 8f... loop
 *
 * This module provides renderer-agnostic shimmer state that can be consumed
 * by both Canvas2D and WebGL renderers.
 */

/** GBA frame duration in milliseconds (~59.73 Hz) */
const GBA_FRAME_MS = 1000 / 59.7275;

/** Length of the repeating shimmer loop (commands 1..8) */
const SHIMMER_LOOP_FRAMES = 48;

/** Initial xScale values loaded by sAffineAnim_ReflectionDistortion_* command 0 */
const INITIAL_X_SCALE = {
  0: -0x0100, // matrix 0 starts at 0xFF00 (-256)
  1: 0x0100,  // matrix 1 starts at 0x0100 (256)
} as const;

/** 180° rotation used by the distortion sprites (rotation = -128 << 8) */
const COS_180 = -1;

/** Emulate GBA s16 overflow semantics */
function toS16(value: number): number {
  const v = value & 0xffff;
  return v & 0x8000 ? v - 0x10000 : v;
}

/** ConvertScaleParam from pokeemerald: 0x10000 / scale (trunc toward zero) */
function convertScaleParam(scale: number): number {
  return Math.trunc(0x10000 / scale);
}

/** pa entry for pure X-scale with 180° rotation (sin = 0) */
function computeMatrixA(xScale: number): number {
  const inv = convertScaleParam(xScale);
  return inv * COS_180;
}

/** Absolute X scale factor applied to pixels (|pa| / 256) */
function toScaleFactor(xScale: number): number {
  return Math.abs(computeMatrixA(xScale)) / 0x100;
}

/** Expand {delta, frames} specs into per-frame delta list */
function buildDeltaSequence(steps: { delta: number; frames: number }[]): number[] {
  const seq: number[] = [];
  for (const step of steps) {
    for (let i = 0; i < step.frames; i++) {
      seq.push(step.delta);
    }
  }
  return seq;
}

/** Frame-by-frame delta sequences from sAffineAnim_ReflectionDistortion_* (commands 1..8) */
const DELTA_SEQUENCE_0 = buildDeltaSequence([
  { delta: +1, frames: 4 },
  { delta: 0, frames: 8 },
  { delta: -1, frames: 4 },
  { delta: 0, frames: 8 },
  { delta: -1, frames: 4 },
  { delta: 0, frames: 8 },
  { delta: +1, frames: 4 },
  { delta: 0, frames: 8 },
]);

const DELTA_SEQUENCE_1 = buildDeltaSequence([
  { delta: -1, frames: 4 },
  { delta: 0, frames: 8 },
  { delta: +1, frames: 4 },
  { delta: 0, frames: 8 },
  { delta: +1, frames: 4 },
  { delta: 0, frames: 8 },
  { delta: -1, frames: 4 },
  { delta: 0, frames: 8 },
]);

/** Precomputed shimmer scale tables (frames 1..48 of the loop) */
const SCALE_TABLE_0 = buildScaleTable(INITIAL_X_SCALE[0], DELTA_SEQUENCE_0);
const SCALE_TABLE_1 = buildScaleTable(INITIAL_X_SCALE[1], DELTA_SEQUENCE_1);

/** Initial absolute frame (command 0, not part of the loop) */
const INITIAL_SCALE = {
  0: toScaleFactor(INITIAL_X_SCALE[0]),
  1: toScaleFactor(INITIAL_X_SCALE[1]),
} as const;

function buildScaleTable(initialXScale: number, deltaSeq: number[]): number[] {
  const table: number[] = [];
  let xScale = initialXScale;
  for (const delta of deltaSeq) {
    xScale = toS16(xScale + delta);
    table.push(toScaleFactor(xScale));
  }
  return table;
}

/**
 * Reflection shimmer state manager
 *
 * Tracks animation state and provides current scale factors for reflection rendering.
 * Call update() each frame with current timestamp, then getScaleX() to get the scale.
 */
export class ReflectionShimmer {
  private _enabled = true;
  private _gbaFrame = 0;
  private _lastUpdateTime = 0;
  private _accumulator = 0;

  /**
   * Enable or disable shimmer effect
   *
   * When disabled, getScaleX() always returns 1.0
   */
  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
  }

  /**
   * Current GBA frame counter (for debugging)
   */
  get gbaFrame(): number {
    return this._gbaFrame;
  }

  /**
   * Update animation state
   *
   * Call once per render frame with current timestamp (performance.now() or similar).
   * Uses GBA frame timing (~59.73 Hz) for accurate animation speed.
   *
   * @param timestamp - Current time in milliseconds
   */
  update(timestamp: number): void {
    if (!this._enabled) return;

    if (this._lastUpdateTime === 0) {
      this._lastUpdateTime = timestamp;
      return;
    }

    const deltaTime = timestamp - this._lastUpdateTime;
    this._lastUpdateTime = timestamp;

    // Accumulate time and step GBA frames
    this._accumulator += deltaTime;
    while (this._accumulator >= GBA_FRAME_MS) {
      this._accumulator -= GBA_FRAME_MS;
      this._gbaFrame++;
    }
  }

  /**
   * Update animation by a specific number of GBA frames
   *
   * Alternative to timestamp-based update for synchronized frame stepping.
   * Use this when you're already tracking GBA frames elsewhere.
   *
   * @param gbaFrames - Number of GBA frames to advance
   */
  advanceFrames(gbaFrames: number): void {
    if (!this._enabled) return;
    this._gbaFrame += gbaFrames;
  }

  /**
   * Get current X scale factor for a reflection
   *
   * @param matrixNum - Which affine matrix to use (0 or 1)
   *                    Matrix 0: west/north/south facing sprites
   *                    Matrix 1: east facing sprites (H-flipped base)
   * @returns Scale factor to apply (0.984–1.016 in steady state)
   */
  getScaleX(matrixNum: 0 | 1): number {
    if (!this._enabled) return 1.0;

    // Frame 0 = initial absolute command; subsequent frames follow the 48f loop.
    if (this._gbaFrame === 0) {
      return INITIAL_SCALE[matrixNum];
    }

    const frameInCycle = (this._gbaFrame - 1) % SHIMMER_LOOP_FRAMES;
    return matrixNum === 0 ? SCALE_TABLE_0[frameInCycle] : SCALE_TABLE_1[frameInCycle];
  }

  /**
   * Get debug info about current shimmer state
   */
  getDebugInfo(): { enabled: boolean; gbaFrame: number; frameInCycle: number; scaleX0: number; scaleX1: number } {
    const frameInCycle = this._gbaFrame === 0 ? -1 : (this._gbaFrame - 1) % SHIMMER_LOOP_FRAMES;
    return {
      enabled: this._enabled,
      gbaFrame: this._gbaFrame,
      frameInCycle,
      scaleX0: this.getScaleX(0),
      scaleX1: this.getScaleX(1),
    };
  }

  /**
   * Get the appropriate matrix number for a sprite facing direction
   *
   * On GBA, east-facing sprites are H-flipped, so they use matrix 1.
   * All other directions use matrix 0.
   *
   * @param direction - Cardinal direction the sprite is facing
   * @param isHFlipped - Whether the sprite is horizontally flipped
   * @returns Matrix number (0 or 1)
   */
  static getMatrixForDirection(direction: 'up' | 'down' | 'left' | 'right', isHFlipped?: boolean): 0 | 1 {
    // East-facing uses matrix 1 because GBA sprite is H-flipped
    // If explicitly told sprite is flipped, use matrix 1
    if (direction === 'right' || isHFlipped) {
      return 1;
    }
    return 0;
  }

  /**
   * Reset animation state
   *
   * Useful for synchronization or testing.
   */
  reset(): void {
    this._gbaFrame = 0;
    this._lastUpdateTime = 0;
    this._accumulator = 0;
  }
}

/**
 * Singleton shimmer instance for global use
 *
 * Both Canvas2D and WebGL renderers can share this instance since
 * the shimmer animation should be synchronized across all reflections.
 */
let globalShimmer: ReflectionShimmer | null = null;

/**
 * Get the global shimmer instance
 *
 * Creates one if it doesn't exist. Use this for synchronized shimmer
 * across all reflection rendering.
 */
export function getGlobalShimmer(): ReflectionShimmer {
  if (!globalShimmer) {
    globalShimmer = new ReflectionShimmer();
  }
  return globalShimmer;
}

/**
 * Check if shimmer is globally enabled
 */
export function isShimmerEnabled(): boolean {
  return globalShimmer?.enabled ?? true;
}

/**
 * Enable or disable shimmer globally
 */
export function setShimmerEnabled(enabled: boolean): void {
  getGlobalShimmer().enabled = enabled;
}

/**
 * Apply GBA-style affine transformation to an image with nearest-neighbor sampling.
 *
 * In ST_OAM_AFFINE_NORMAL the GBA scales/rotates around the sprite center
 * (centerToCornerVec pre-adjusts the origin). The distortion matrices only
 * change pa (X scale); pb/pc stay 0 and pd is the constant vertical flip
 * handled elsewhere in our pipeline. We mirror ConvertScaleParam sampling by
 * mapping destination pixels back to source using a centered, nearest-neighbor
 * lookup inside the original bounding box (no double-size).
 *
 * @param srcCanvas - Source image (the reflection sprite)
 * @param scaleX - GBA-style affine parameter (1.0 = no change)
 * @param dstCanvas - Optional destination canvas (created if not provided)
 * @returns Canvas with affine-transformed image
 */
export function applyGbaAffineShimmer(
  srcCanvas: HTMLCanvasElement,
  scaleX: number,
  dstCanvas?: HTMLCanvasElement
): HTMLCanvasElement {
  const w = srcCanvas.width;
  const h = srcCanvas.height;

  // Create destination canvas if not provided
  const dst = dstCanvas ?? document.createElement('canvas');
  dst.width = w;
  dst.height = h;

  const srcCtx = srcCanvas.getContext('2d');
  const dstCtx = dst.getContext('2d');
  if (!srcCtx || !dstCtx) return dst;

  // No-op fast path
  if (Math.abs(scaleX - 1) < 1e-6) {
    if (!dstCanvas) return srcCanvas;
    dstCtx.clearRect(0, 0, w, h);
    dstCtx.drawImage(srcCanvas, 0, 0);
    return dst;
  }

  // Get source pixel data
  const srcData = srcCtx.getImageData(0, 0, w, h);
  const srcPixels = srcData.data;

  // Create destination pixel data
  const dstData = dstCtx.createImageData(w, h);
  const dstPixels = dstData.data;

  const centerX = w / 2;
  const invScale = 1 / scaleX;

  for (let dstY = 0; dstY < h; dstY++) {
    const rowOffset = dstY * w;
    for (let dstX = 0; dstX < w; dstX++) {
      // Centered inverse transform: sample source at ((x - cx) / scale) + cx
      const srcXf = centerX + (dstX - centerX) * invScale;
      const srcX = Math.floor(srcXf);
      const srcY = dstY; // No vertical transform for shimmer

      // Bounds check
      if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
        const srcIdx = (srcY * w + srcX) * 4;
        const dstIdx = (rowOffset + dstX) * 4;

        // Copy RGBA
        dstPixels[dstIdx] = srcPixels[srcIdx];
        dstPixels[dstIdx + 1] = srcPixels[srcIdx + 1];
        dstPixels[dstIdx + 2] = srcPixels[srcIdx + 2];
        dstPixels[dstIdx + 3] = srcPixels[srcIdx + 3];
      }
      // Pixels outside bounds remain transparent (default 0)
    }
  }

  dstCtx.putImageData(dstData, 0, 0);
  return dst;
}
