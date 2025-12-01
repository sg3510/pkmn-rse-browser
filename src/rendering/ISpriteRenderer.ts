/**
 * ISpriteRenderer - Common interface for sprite renderers
 *
 * This interface defines the contract that both Canvas2D and WebGL
 * sprite renderers must implement. It enables:
 * - Automatic fallback from WebGL to Canvas2D
 * - Consistent API across rendering backends
 * - Easy testing with mock implementations
 * - Future unification of MapRenderer and WebGLMapPage
 *
 * Design principles:
 * - Renderer-agnostic data: Uses SpriteInstance from types.ts
 * - No React dependencies: Pure rendering logic
 * - World coordinates: Caller provides world positions, renderer converts to screen
 *
 * Usage:
 * ```typescript
 * // Upload sprite sheets once
 * renderer.uploadSpriteSheet('player', playerCanvas);
 * renderer.uploadSpriteSheet('fieldEffects', effectsCanvas);
 *
 * // Each frame, build sprite list and render
 * const sprites: SpriteInstance[] = buildSpriteList(player, npcs, effects);
 * sprites.sort((a, b) => a.sortKey - b.sortKey);
 * renderer.renderBatch(sprites, cameraView);
 * ```
 */

import type { RendererType } from './IRenderPipeline';
import type { SpriteInstance, SpriteSheetInfo, WorldCameraView } from './types';

/**
 * Sprite renderer statistics
 */
export interface SpriteRenderStats {
  /** Which renderer is being used */
  rendererType: RendererType;
  /** Whether the renderer is in a valid state */
  isValid: boolean;
  /** Number of sprite sheets uploaded */
  spriteSheetCount: number;
  /** Number of sprites rendered last frame */
  lastBatchSize: number;
}

/**
 * Water mask data for reflection clipping
 *
 * The mask is a per-pixel bitmap where 1 = water (show reflection)
 * and 0 = ground (hide reflection). This replicates GBA's BG1 overlay
 * transparency mechanism.
 */
export interface WaterMaskData {
  /** Raw mask data (1 byte per pixel, 0 or 255) */
  data: Uint8Array;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** World X offset (top-left corner in world coords) */
  worldOffsetX: number;
  /** World Y offset (top-left corner in world coords) */
  worldOffsetY: number;
}

/**
 * Common interface for sprite renderers
 *
 * Implemented by:
 * - WebGLSpriteRenderer (GPU-accelerated)
 * - Canvas2DSpriteRenderer (fallback, future)
 */
export interface ISpriteRenderer {
  /**
   * Get the renderer type identifier
   */
  readonly rendererType: RendererType;

  /**
   * Upload a sprite sheet to the renderer
   *
   * The sprite sheet becomes available for rendering via atlasName in SpriteInstance.
   * Multiple sheets can be uploaded; they are stored by name.
   *
   * @param name - Unique name for this sprite sheet (used in SpriteInstance.atlasName)
   * @param source - The sprite sheet image (canvas or image data)
   * @param info - Optional metadata about the sprite sheet
   */
  uploadSpriteSheet(
    name: string,
    source: HTMLCanvasElement | ImageData,
    info?: Partial<SpriteSheetInfo>
  ): void;

  /**
   * Check if a sprite sheet is uploaded
   *
   * @param name - Sprite sheet name
   * @returns true if the sheet is available for rendering
   */
  hasSpriteSheet(name: string): boolean;

  /**
   * Remove a sprite sheet from the renderer
   *
   * @param name - Sprite sheet name
   */
  removeSpriteSheet(name: string): void;

  /**
   * Render a batch of sprites
   *
   * Sprites should be pre-sorted by sortKey (caller's responsibility).
   * The renderer converts world coordinates to screen coordinates using the view.
   *
   * @param sprites - Array of sprite instances to render (sorted by sortKey)
   * @param view - Camera view for coordinate conversion
   */
  renderBatch(sprites: SpriteInstance[], view: WorldCameraView): void;

  /**
   * Set water mask for reflection clipping (optional)
   *
   * Required for pixel-perfect reflections on shoreline tiles.
   * If not set, reflections render without masking.
   *
   * @param mask - Water mask data, or null to clear
   */
  setWaterMask(mask: WaterMaskData | null): void;

  /**
   * Check if the renderer is in a valid state
   *
   * For WebGL, returns false if context is lost.
   * For Canvas2D, always returns true.
   */
  isValid(): boolean;

  /**
   * Get rendering statistics
   */
  getStats(): SpriteRenderStats;

  /**
   * Clean up resources
   *
   * Call when the renderer is no longer needed.
   * For WebGL, releases GPU resources.
   */
  dispose(): void;
}

/**
 * Type guard to check if a renderer supports water masking
 */
export function supportsWaterMask(renderer: ISpriteRenderer): boolean {
  return typeof renderer.setWaterMask === 'function';
}
