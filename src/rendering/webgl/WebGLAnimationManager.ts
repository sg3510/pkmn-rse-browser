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

  // Cached tileset buffers for patching
  private primaryBuffer: Uint8Array | null = null;
  private secondaryBuffer: Uint8Array | null = null;
  private primaryWidth: number = 0;
  private primaryHeight: number = 0;
  private secondaryWidth: number = 0;
  private secondaryHeight: number = 0;

  constructor(_gl: WebGL2RenderingContext, textureManager: WebGLTextureManager) {
    this.textureManager = textureManager;
  }

  /**
   * Set the tileset buffers for animation patching
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
   * Register animations for the current map's tilesets
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
   * Update all animations for the current game frame
   */
  updateAnimations(gameFrame: number): boolean {
    if (!this.primaryBuffer || !this.secondaryBuffer) {
      return false;
    }

    let primaryDirty = false;
    let secondaryDirty = false;

    for (const state of this.animations.values()) {
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
        const targetBuffer = anim.tileset === 'primary' ? this.primaryBuffer : this.secondaryBuffer;
        const targetWidth = anim.tileset === 'primary' ? this.primaryWidth : this.secondaryWidth;

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
      this.textureManager.uploadTileset('primary', this.primaryBuffer, this.primaryWidth, this.primaryHeight);
    }
    if (secondaryDirty) {
      this.textureManager.uploadTileset('secondary', this.secondaryBuffer, this.secondaryWidth, this.secondaryHeight);
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
    return this.animations.size > 0;
  }

  /**
   * Clear all registered animations
   */
  clear(): void {
    this.animations.clear();
  }

  /**
   * Get animation count for debugging
   */
  getAnimationCount(): number {
    return this.animations.size;
  }

  /**
   * Get total destination count for debugging
   */
  getDestinationCount(): number {
    let count = 0;
    for (const state of this.animations.values()) {
      count += state.animation.destinations.length;
    }
    return count;
  }
}
