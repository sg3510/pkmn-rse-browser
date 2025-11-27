/**
 * PrerenderedAnimations - Pre-renders animation frames with palettes applied
 *
 * This optimization pre-renders all animation frame combinations at load time,
 * eliminating runtime tileset patching and palette application for animated tiles.
 *
 * Memory budget: ~2MB per tileset (16 animations × 4 frames × 8 palettes × 64x64 avg)
 * Load time target: < 200ms additional
 *
 * Key structure:
 * - frameCanvases: Map<"animId:frameIndex:paletteHash", ImageBitmap>
 * - Each ImageBitmap contains one animation frame with one palette applied
 */

import type { Palette } from '../utils/mapLoader';
import type { LoadedAnimation } from './types';
import { TILE_SIZE } from '../utils/mapLoader';

/**
 * Cache key for a pre-rendered frame
 */
function getFrameKey(animId: string, frameIndex: number, paletteHash: string): string {
  return `${animId}:${frameIndex}:${paletteHash}`;
}

/**
 * Generate a simple hash for a palette (for cache keying)
 */
function hashPalette(palette: Palette): string {
  return palette.colors.join(',');
}

/**
 * Pre-parsed RGB palette for fast pixel conversion
 */
type PaletteRGB = Uint8Array; // 16 colors × 3 channels = 48 bytes

/**
 * Parse palette colors to RGB array
 */
function parsePaletteToRGB(palette: Palette): PaletteRGB {
  const rgb = new Uint8Array(16 * 3);
  for (let i = 0; i < 16; i++) {
    const hex = palette.colors[i];
    if (hex) {
      rgb[i * 3] = parseInt(hex.slice(1, 3), 16);     // R
      rgb[i * 3 + 1] = parseInt(hex.slice(3, 5), 16); // G
      rgb[i * 3 + 2] = parseInt(hex.slice(5, 7), 16); // B
    }
  }
  return rgb;
}

/**
 * Render an animation frame with a palette applied
 *
 * @param frameData - Indexed color frame data (4bpp)
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @param paletteRGB - Pre-parsed RGB palette
 * @returns Canvas with palette applied
 */
function renderFrameWithPalette(
  frameData: Uint8Array,
  width: number,
  height: number,
  paletteRGB: PaletteRGB
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false })!;

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let i = 0; i < frameData.length; i++) {
    const paletteIndex = frameData[i];
    const pixelIndex = i * 4;

    if (paletteIndex === 0) {
      // Transparent pixel
      data[pixelIndex + 3] = 0;
    } else {
      data[pixelIndex] = paletteRGB[paletteIndex * 3];
      data[pixelIndex + 1] = paletteRGB[paletteIndex * 3 + 1];
      data[pixelIndex + 2] = paletteRGB[paletteIndex * 3 + 2];
      data[pixelIndex + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Information about a pre-rendered frame
 */
export interface PrerenderedFrame {
  /** The rendered canvas/bitmap */
  canvas: HTMLCanvasElement;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Width in 8x8 tiles */
  tilesWide: number;
  /** Height in 8x8 tiles */
  tilesHigh: number;
}

/**
 * Lookup info for an animated tile
 */
export interface AnimatedTileLookup {
  /** Animation ID */
  animId: string;
  /** Starting destination tile ID for this destination group */
  destStart: number;
  /** Phase offset for this destination */
  phase: number;
  /** Pixel X offset within the frame */
  srcX: number;
  /** Pixel Y offset within the frame */
  srcY: number;
}

/**
 * Pre-rendered animation frame cache
 *
 * Stores pre-rendered animation frames with palettes applied,
 * enabling direct drawImage calls without runtime palette conversion.
 */
export class PrerenderedAnimations {
  private frameCanvases: Map<string, PrerenderedFrame> = new Map();
  private animationInfo: Map<string, LoadedAnimation> = new Map();
  /** Lookup table: primary tile ID -> animation info */
  private primaryTileLookup: Map<number, AnimatedTileLookup> = new Map();
  /** Lookup table: secondary tile ID -> animation info */
  private secondaryTileLookup: Map<number, AnimatedTileLookup> = new Map();

  /**
   * Pre-render all animation frames for the given animations and palettes.
   *
   * This should be called at tileset load time. It pre-computes all
   * animation frame × palette combinations for O(1) frame retrieval.
   *
   * @param animations - Loaded animations with frame data
   * @param primaryPalettes - Primary tileset palettes
   * @param secondaryPalettes - Secondary tileset palettes
   */
  async prerenderAll(
    animations: LoadedAnimation[],
    primaryPalettes: Palette[],
    secondaryPalettes: Palette[]
  ): Promise<void> {
    // Clear existing cache
    this.frameCanvases.clear();
    this.animationInfo.clear();
    this.primaryTileLookup.clear();
    this.secondaryTileLookup.clear();

    // Pre-parse all palettes to RGB
    const allPalettes = [...primaryPalettes, ...secondaryPalettes];
    const paletteRGBs = new Map<string, PaletteRGB>();
    for (const palette of allPalettes) {
      const hash = hashPalette(palette);
      if (!paletteRGBs.has(hash)) {
        paletteRGBs.set(hash, parsePaletteToRGB(palette));
      }
    }

    // Pre-render each animation frame with each unique palette
    for (const anim of animations) {
      this.animationInfo.set(anim.id, anim);

      // Build tile lookup table for this animation
      const lookup = anim.tileset === 'primary' ? this.primaryTileLookup : this.secondaryTileLookup;
      for (const dest of anim.destinations) {
        let tileId = dest.destStart;
        for (let ty = 0; ty < anim.tilesHigh; ty++) {
          for (let tx = 0; tx < anim.tilesWide; tx++) {
            lookup.set(tileId, {
              animId: anim.id,
              destStart: dest.destStart,
              phase: dest.phase ?? 0,
              srcX: tx * TILE_SIZE,
              srcY: ty * TILE_SIZE,
            });
            tileId++;
          }
        }
      }

      // Determine which palettes this animation might use
      // For simplicity, we pre-render with all palettes since metatiles
      // can reference any palette. In practice, most animations use
      // only a few palettes, but the memory cost is acceptable.
      const palettesToUse = anim.tileset === 'primary' ? primaryPalettes : secondaryPalettes;

      for (let frameIndex = 0; frameIndex < anim.frames.length; frameIndex++) {
        const frameData = anim.frames[frameIndex];

        for (const palette of palettesToUse) {
          const paletteHash = hashPalette(palette);
          const paletteRGB = paletteRGBs.get(paletteHash);
          if (!paletteRGB) continue;

          const key = getFrameKey(anim.id, frameIndex, paletteHash);
          if (this.frameCanvases.has(key)) continue;

          const canvas = renderFrameWithPalette(
            frameData,
            anim.width,
            anim.height,
            paletteRGB
          );

          this.frameCanvases.set(key, {
            canvas,
            width: anim.width,
            height: anim.height,
            tilesWide: anim.tilesWide,
            tilesHigh: anim.tilesHigh,
          });
        }
      }
    }
  }

  /**
   * Get a pre-rendered frame for the given animation, frame index, and palette.
   *
   * @param animId - Animation ID
   * @param frameIndex - Frame index (from animation sequence)
   * @param palette - Palette to use
   * @returns Pre-rendered frame info, or null if not found
   */
  getFrame(animId: string, frameIndex: number, palette: Palette): PrerenderedFrame | null {
    const paletteHash = hashPalette(palette);
    const key = getFrameKey(animId, frameIndex, paletteHash);
    return this.frameCanvases.get(key) ?? null;
  }

  /**
   * Get the current frame for an animation given the raw game frame.
   *
   * This handles the interval calculation, sequence lookup, and phase offset.
   *
   * @param animId - Animation ID
   * @param gameFrame - Raw game frame count (tick count)
   * @param phase - Phase offset (for staggered animations)
   * @param palette - Palette to use
   * @returns Pre-rendered frame info, or null if not found
   */
  getCurrentFrame(
    animId: string,
    gameFrame: number,
    phase: number,
    palette: Palette
  ): PrerenderedFrame | null {
    const anim = this.animationInfo.get(animId);
    if (!anim) return null;

    // Calculate animation cycle from game frame using the animation's interval
    const animationCycle = Math.floor(gameFrame / anim.interval);
    const effectiveCycle = animationCycle + phase;

    // Determine which sequence to use
    const useAlt =
      anim.altSequence !== undefined &&
      anim.altSequenceThreshold !== undefined &&
      effectiveCycle >= anim.altSequenceThreshold;
    const seq = useAlt && anim.altSequence ? anim.altSequence : anim.sequence;

    // Get frame index from sequence
    const seqIndexRaw = effectiveCycle % seq.length;
    const seqIndex = seqIndexRaw < 0 ? seqIndexRaw + seq.length : seqIndexRaw;
    const frameIndex = seq[seqIndex] ?? 0;

    return this.getFrame(animId, frameIndex, palette);
  }

  /**
   * Get animation info for the given animation ID.
   */
  getAnimationInfo(animId: string): LoadedAnimation | undefined {
    return this.animationInfo.get(animId);
  }

  /**
   * Look up animation info for a tile ID.
   *
   * @param tileId - The tile ID to look up
   * @param tileset - Which tileset ('primary' or 'secondary')
   * @returns Lookup info if this is an animated tile, null otherwise
   */
  lookupTile(tileId: number, tileset: 'primary' | 'secondary'): AnimatedTileLookup | null {
    const lookup = tileset === 'primary' ? this.primaryTileLookup : this.secondaryTileLookup;
    return lookup.get(tileId) ?? null;
  }

  /**
   * Check if a tile is animated.
   */
  isAnimatedTile(tileId: number, tileset: 'primary' | 'secondary'): boolean {
    const lookup = tileset === 'primary' ? this.primaryTileLookup : this.secondaryTileLookup;
    return lookup.has(tileId);
  }

  /**
   * Draw an animated tile to the given context.
   *
   * This is the main entry point for rendering animated tiles.
   * Returns true if the tile was drawn, false if it's not an animated tile
   * or no pre-rendered frame is available.
   *
   * @param ctx - Canvas context to draw to
   * @param tileId - Tile ID to draw
   * @param tileset - Which tileset ('primary' or 'secondary')
   * @param destX - Destination X on canvas
   * @param destY - Destination Y on canvas
   * @param xflip - Horizontal flip
   * @param yflip - Vertical flip
   * @param palette - Palette to use
   * @param gameFrame - Raw game frame count (tick count)
   * @returns true if drawn, false if not an animated tile
   */
  drawAnimatedTile(
    ctx: CanvasRenderingContext2D,
    tileId: number,
    tileset: 'primary' | 'secondary',
    destX: number,
    destY: number,
    xflip: boolean,
    yflip: boolean,
    palette: Palette,
    gameFrame: number
  ): boolean {
    const lookup = this.lookupTile(tileId, tileset);
    if (!lookup) return false;

    const anim = this.animationInfo.get(lookup.animId);
    if (!anim) return false;

    const frame = this.getCurrentFrame(lookup.animId, gameFrame, lookup.phase, palette);
    if (!frame) return false;

    // Draw the tile from the pre-rendered frame
    if (!xflip && !yflip) {
      // Fast path: no transforms
      ctx.drawImage(
        frame.canvas,
        lookup.srcX, lookup.srcY, TILE_SIZE, TILE_SIZE,
        destX, destY, TILE_SIZE, TILE_SIZE
      );
    } else {
      // Slow path: flipped tiles
      ctx.save();
      ctx.translate(destX, destY);

      const scaleX = xflip ? -1 : 1;
      const scaleY = yflip ? -1 : 1;
      const offsetX = xflip ? -TILE_SIZE : 0;
      const offsetY = yflip ? -TILE_SIZE : 0;

      ctx.scale(scaleX, scaleY);
      ctx.translate(offsetX, offsetY);

      ctx.drawImage(
        frame.canvas,
        lookup.srcX, lookup.srcY, TILE_SIZE, TILE_SIZE,
        0, 0, TILE_SIZE, TILE_SIZE
      );

      ctx.restore();
    }

    return true;
  }

  /**
   * Get the tile position offset within a frame for a specific destination tile.
   *
   * @param anim - Animation info
   * @param destTileId - Destination tile ID
   * @param destStart - Starting destination tile ID for this destination
   * @returns Pixel offset within the frame, or null if tile not in this animation
   */
  getTileOffset(
    anim: LoadedAnimation,
    destTileId: number,
    destStart: number
  ): { x: number; y: number } | null {
    const tileOffset = destTileId - destStart;
    if (tileOffset < 0 || tileOffset >= anim.tilesWide * anim.tilesHigh) {
      return null;
    }

    const tileX = tileOffset % anim.tilesWide;
    const tileY = Math.floor(tileOffset / anim.tilesWide);

    return {
      x: tileX * TILE_SIZE,
      y: tileY * TILE_SIZE,
    };
  }

  /**
   * Clear all pre-rendered frames (e.g., on tileset change)
   */
  clear(): void {
    this.frameCanvases.clear();
    this.animationInfo.clear();
    this.primaryTileLookup.clear();
    this.secondaryTileLookup.clear();
  }

  /**
   * Get cache statistics (for debugging/monitoring)
   */
  getStats(): { frameCount: number; animationCount: number; estimatedMemoryMB: number } {
    let totalPixels = 0;
    for (const frame of this.frameCanvases.values()) {
      totalPixels += frame.width * frame.height;
    }

    return {
      frameCount: this.frameCanvases.size,
      animationCount: this.animationInfo.size,
      // 4 bytes per pixel (RGBA)
      estimatedMemoryMB: (totalPixels * 4) / (1024 * 1024),
    };
  }
}
