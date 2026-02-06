/**
 * WebGLAnimationManager - Tileset animation via texture updates
 *
 * Manages animated tiles by:
 * 1. Tracking which animations are active
 * 2. Copying animation frames to tileset buffers
 * 3. Re-uploading affected tileset regions
 *
 * Animation frames are copied tile-by-tile to handle the tileset row layout.
 */

import { WebGLTextureManager } from './WebGLTextureManager';
import type { LoadedAnimation } from '../types';

/** Tile size in pixels */
const TILE_SIZE = 8;

/** Tiles per row in tileset texture (128px / 8px) */
const TILES_PER_ROW = 16;

/** Secondary tileset tile ID offset */
const SECONDARY_TILE_OFFSET = 512;

/**
 * Animation frame state
 */
interface AnimationState {
  animation: LoadedAnimation;
  lastCyclePerDest: number[];  // Track cycle per destination for phase handling
}

/**
 * Manages WebGL tileset animations
 */
export class WebGLAnimationManager {
  private textureManager: WebGLTextureManager;
  private animations: Map<string, AnimationState> = new Map();
  private animationsPair1: Map<string, AnimationState> = new Map();
  private animationsPair2: Map<string, AnimationState> = new Map();

  // Cached tileset buffers for patching (pair 0)
  private primaryBuffer: Uint8Array | null = null;
  private secondaryBuffer: Uint8Array | null = null;
  private primaryWidth: number = 0;
  private primaryHeight: number = 0;
  private secondaryWidth: number = 0;
  private secondaryHeight: number = 0;

  // Cached tileset buffers for patching (pair 1)
  private primaryBufferPair1: Uint8Array | null = null;
  private secondaryBufferPair1: Uint8Array | null = null;
  private primaryWidthPair1: number = 0;
  private primaryHeightPair1: number = 0;
  private secondaryWidthPair1: number = 0;
  private secondaryHeightPair1: number = 0;

  // Cached tileset buffers for patching (pair 2)
  private primaryBufferPair2: Uint8Array | null = null;
  private secondaryBufferPair2: Uint8Array | null = null;
  private primaryWidthPair2: number = 0;
  private primaryHeightPair2: number = 0;
  private secondaryWidthPair2: number = 0;
  private secondaryHeightPair2: number = 0;

  constructor(_gl: WebGL2RenderingContext, textureManager: WebGLTextureManager) {
    this.textureManager = textureManager;
  }

  /**
   * Set the tileset buffers for animation patching (pair 0)
   * Must be called after uploading tilesets
   */
  setTilesetBuffers(
    primary: Uint8Array,
    primaryWidth: number,
    primaryHeight: number,
    secondary: Uint8Array,
    secondaryWidth: number,
    secondaryHeight: number
  ): void {
    // Make copies so we can patch them
    this.primaryBuffer = new Uint8Array(primary);
    this.secondaryBuffer = new Uint8Array(secondary);
    this.primaryWidth = primaryWidth;
    this.primaryHeight = primaryHeight;
    this.secondaryWidth = secondaryWidth;
    this.secondaryHeight = secondaryHeight;
  }

  /**
   * Set the tileset buffers for animation patching (pair 1)
   * Must be called after uploading pair 1 tilesets
   */
  setTilesetBuffersPair1(
    primary: Uint8Array,
    primaryWidth: number,
    primaryHeight: number,
    secondary: Uint8Array,
    secondaryWidth: number,
    secondaryHeight: number
  ): void {
    // Make copies so we can patch them
    this.primaryBufferPair1 = new Uint8Array(primary);
    this.secondaryBufferPair1 = new Uint8Array(secondary);
    this.primaryWidthPair1 = primaryWidth;
    this.primaryHeightPair1 = primaryHeight;
    this.secondaryWidthPair1 = secondaryWidth;
    this.secondaryHeightPair1 = secondaryHeight;
  }

  /**
   * Set the tileset buffers for animation patching (pair 2)
   * Must be called after uploading pair 2 tilesets
   */
  setTilesetBuffersPair2(
    primary: Uint8Array,
    primaryWidth: number,
    primaryHeight: number,
    secondary: Uint8Array,
    secondaryWidth: number,
    secondaryHeight: number
  ): void {
    // Make copies so we can patch them
    this.primaryBufferPair2 = new Uint8Array(primary);
    this.secondaryBufferPair2 = new Uint8Array(secondary);
    this.primaryWidthPair2 = primaryWidth;
    this.primaryHeightPair2 = primaryHeight;
    this.secondaryWidthPair2 = secondaryWidth;
    this.secondaryHeightPair2 = secondaryHeight;
  }

  /**
   * Register animations for the current map's tilesets (pair 0)
   */
  registerAnimations(animations: LoadedAnimation[]): void {
    this.animations.clear();

    for (const anim of animations) {
      this.animations.set(anim.id, {
        animation: anim,
        lastCyclePerDest: anim.destinations.map(() => -999),
      });
    }
  }

  /**
   * Register animations for pair 1 tilesets
   */
  registerAnimationsPair1(animations: LoadedAnimation[]): void {
    this.animationsPair1.clear();

    for (const anim of animations) {
      this.animationsPair1.set(anim.id, {
        animation: anim,
        lastCyclePerDest: anim.destinations.map(() => -999),
      });
    }
  }

  /**
   * Register animations for pair 2 tilesets
   */
  registerAnimationsPair2(animations: LoadedAnimation[]): void {
    this.animationsPair2.clear();

    for (const anim of animations) {
      this.animationsPair2.set(anim.id, {
        animation: anim,
        lastCyclePerDest: anim.destinations.map(() => -999),
      });
    }
  }

  /**
   * Update all animations for the current game frame
   */
  updateAnimations(gameFrame: number): boolean {
    let anyUpdated = false;

    // Update pair 0 animations
    if (this.primaryBuffer && this.secondaryBuffer) {
      const updated = this.updateAnimationsForPair(
        gameFrame,
        this.animations,
        this.primaryBuffer,
        this.secondaryBuffer,
        this.primaryWidth,
        this.primaryHeight,
        this.secondaryWidth,
        this.secondaryHeight,
        0 // pair 0
      );
      if (updated) anyUpdated = true;
    }

    // Update pair 1 animations
    if (this.primaryBufferPair1 && this.secondaryBufferPair1) {
      const updated = this.updateAnimationsForPair(
        gameFrame,
        this.animationsPair1,
        this.primaryBufferPair1,
        this.secondaryBufferPair1,
        this.primaryWidthPair1,
        this.primaryHeightPair1,
        this.secondaryWidthPair1,
        this.secondaryHeightPair1,
        1 // pair 1
      );
      if (updated) anyUpdated = true;
    }

    // Update pair 2 animations
    if (this.primaryBufferPair2 && this.secondaryBufferPair2) {
      const updated = this.updateAnimationsForPair(
        gameFrame,
        this.animationsPair2,
        this.primaryBufferPair2,
        this.secondaryBufferPair2,
        this.primaryWidthPair2,
        this.primaryHeightPair2,
        this.secondaryWidthPair2,
        this.secondaryHeightPair2,
        2 // pair 2
      );
      if (updated) anyUpdated = true;
    }

    return anyUpdated;
  }

  /**
   * Update animations for a specific tileset pair
   */
  private updateAnimationsForPair(
    gameFrame: number,
    animations: Map<string, AnimationState>,
    primaryBuffer: Uint8Array,
    secondaryBuffer: Uint8Array,
    primaryWidth: number,
    primaryHeight: number,
    secondaryWidth: number,
    secondaryHeight: number,
    pairIndex: 0 | 1 | 2
  ): boolean {
    let primaryDirty = false;
    let secondaryDirty = false;

    for (const state of animations.values()) {
      const anim = state.animation;
      const cycle = Math.floor(gameFrame / anim.interval);

      // Process each destination
      for (let destIdx = 0; destIdx < anim.destinations.length; destIdx++) {
        const dest = anim.destinations[destIdx];
        const effectiveCycle = cycle + (dest.phase ?? 0);

        // Skip if this destination hasn't changed
        if (effectiveCycle === state.lastCyclePerDest[destIdx]) {
          continue;
        }
        state.lastCyclePerDest[destIdx] = effectiveCycle;

        // Determine which sequence to use
        const useAlt = anim.altSequence !== undefined &&
          anim.altSequenceThreshold !== undefined &&
          effectiveCycle >= anim.altSequenceThreshold;

        const seq = useAlt && anim.altSequence ? anim.altSequence : anim.sequence;

        // Calculate frame index with proper modulo
        let seqIndex = effectiveCycle % seq.length;
        if (seqIndex < 0) seqIndex += seq.length;

        const frameIndex = seq[seqIndex] ?? 0;
        const frameData = anim.frames[frameIndex];
        if (!frameData) continue;

        // Copy tiles from frame to tileset buffer
        const targetBuffer = anim.tileset === 'primary' ? primaryBuffer : secondaryBuffer;
        const targetWidth = anim.tileset === 'primary' ? primaryWidth : secondaryWidth;

        let destId = anim.tileset === 'secondary'
          ? dest.destStart - SECONDARY_TILE_OFFSET
          : dest.destStart;

        // Copy each tile
        for (let ty = 0; ty < anim.tilesHigh; ty++) {
          for (let tx = 0; tx < anim.tilesWide; tx++) {
            // Source position in frame data
            const srcX = tx * TILE_SIZE;
            const srcY = ty * TILE_SIZE;

            // Destination position in tileset
            const destTileX = (destId % TILES_PER_ROW) * TILE_SIZE;
            const destTileY = Math.floor(destId / TILES_PER_ROW) * TILE_SIZE;

            // Copy 8x8 tile
            this.copyTile(
              frameData, srcX, srcY, anim.width,
              targetBuffer, destTileX, destTileY, targetWidth
            );

            destId++;
          }
        }

        if (anim.tileset === 'primary') {
          primaryDirty = true;
        } else {
          secondaryDirty = true;
        }
      }
    }

    // Re-upload dirty tilesets
    if (primaryDirty) {
      if (pairIndex === 0) {
        this.textureManager.uploadTileset('primary', primaryBuffer, primaryWidth, primaryHeight);
      } else if (pairIndex === 1) {
        this.textureManager.uploadTilesetPair1('primary', primaryBuffer, primaryWidth, primaryHeight);
      } else {
        this.textureManager.uploadTilesetPair2('primary', primaryBuffer, primaryWidth, primaryHeight);
      }
    }
    if (secondaryDirty) {
      if (pairIndex === 0) {
        this.textureManager.uploadTileset('secondary', secondaryBuffer, secondaryWidth, secondaryHeight);
      } else if (pairIndex === 1) {
        this.textureManager.uploadTilesetPair1('secondary', secondaryBuffer, secondaryWidth, secondaryHeight);
      } else {
        this.textureManager.uploadTilesetPair2('secondary', secondaryBuffer, secondaryWidth, secondaryHeight);
      }
    }

    return primaryDirty || secondaryDirty;
  }

  /**
   * Copy an 8x8 tile from source to destination buffer
   */
  private copyTile(
    src: Uint8Array,
    srcX: number,
    srcY: number,
    srcStride: number,
    dest: Uint8Array,
    destX: number,
    destY: number,
    destStride: number
  ): void {
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const srcIdx = (srcY + y) * srcStride + (srcX + x);
        const destIdx = (destY + y) * destStride + (destX + x);
        if (srcIdx < src.length && destIdx < dest.length) {
          dest[destIdx] = src[srcIdx];
        }
      }
    }
  }

  /**
   * Get the set of animated tile IDs for dirty region tracking
   */
  getAnimatedTileIds(): { primary: Set<number>; secondary: Set<number> } {
    const primary = new Set<number>();
    const secondary = new Set<number>();

    for (const state of this.animations.values()) {
      const anim = state.animation;

      for (const dest of anim.destinations) {
        // Add all tile IDs covered by this animation
        for (let ty = 0; ty < anim.tilesHigh; ty++) {
          for (let tx = 0; tx < anim.tilesWide; tx++) {
            const tileId = dest.destStart + ty * TILES_PER_ROW + tx;
            if (anim.tileset === 'primary') {
              primary.add(tileId);
            } else {
              secondary.add(tileId);
            }
          }
        }
      }
    }

    return { primary, secondary };
  }

  /**
   * Check if any animations are registered
   */
  hasAnimations(): boolean {
    return this.animations.size > 0 || this.animationsPair1.size > 0 || this.animationsPair2.size > 0;
  }

  /**
   * Clear all registered animations
   */
  clear(): void {
    this.animations.clear();
    this.animationsPair1.clear();
    this.animationsPair2.clear();
  }

  /**
   * Get animation count for debugging
   */
  getAnimationCount(): number {
    return this.animations.size + this.animationsPair1.size + this.animationsPair2.size;
  }

  /**
   * Get total destination count for debugging
   */
  getDestinationCount(): number {
    let count = 0;
    for (const state of this.animations.values()) {
      count += state.animation.destinations.length;
    }
    for (const state of this.animationsPair1.values()) {
      count += state.animation.destinations.length;
    }
    for (const state of this.animationsPair2.values()) {
      count += state.animation.destinations.length;
    }
    return count;
  }
}
