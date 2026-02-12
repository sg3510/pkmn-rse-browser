/**
 * Canvas2DSpriteRenderer - Canvas2D implementation of ISpriteRenderer
 *
 * Renders sprites using Canvas2D drawImage. This provides a fallback
 * when WebGL is not available or for debugging purposes.
 *
 * Limitations compared to WebGL:
 * - Tinting requires per-pixel manipulation (slower for reflections)
 * - No batching optimization (each sprite is a separate draw call)
 */

import type { ISpriteRenderer, SpriteRenderStats, WaterMaskData } from './ISpriteRenderer';
import type { SpriteInstance, SpriteSheetInfo, WorldCameraView } from './types';
import type { RendererType } from './IRenderPipeline';

interface SpriteSheet {
  source: HTMLCanvasElement | ImageData;
  canvas: HTMLCanvasElement; // Always a canvas for consistent drawing
  info?: Partial<SpriteSheetInfo>;
}

export class Canvas2DSpriteRenderer implements ISpriteRenderer {
  readonly rendererType: RendererType = 'canvas2d';
  private ctx: CanvasRenderingContext2D;
  private spriteSheets: Map<string, SpriteSheet> = new Map();
  private lastBatchSize = 0;
  // Water mask stored for future water clipping support
  private waterMask: WaterMaskData | null = null;

  /**
   * Check if a water mask is set
   */
  hasWaterMask(): boolean {
    return this.waterMask !== null;
  }

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /**
   * Upload a sprite sheet for rendering
   */
  uploadSpriteSheet(
    name: string,
    source: HTMLCanvasElement | ImageData,
    info?: Partial<SpriteSheetInfo>
  ): void {
    // Convert ImageData to canvas if needed
    let canvas: HTMLCanvasElement;
    if (source instanceof HTMLCanvasElement) {
      canvas = source;
    } else {
      canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(source, 0, 0);
      }
    }

    this.spriteSheets.set(name, { source, canvas, info });
  }

  /**
   * Check if a sprite sheet is uploaded
   */
  hasSpriteSheet(name: string): boolean {
    return this.spriteSheets.has(name);
  }

  /**
   * Remove a sprite sheet
   */
  removeSpriteSheet(name: string): void {
    this.spriteSheets.delete(name);
  }

  /**
   * Render a batch of sprites
   *
   * Sprites should be pre-sorted by sortKey.
   */
  renderBatch(sprites: SpriteInstance[], view: WorldCameraView): void {
    const { ctx } = this;
    this.lastBatchSize = sprites.length;

    ctx.imageSmoothingEnabled = false;

    for (const sprite of sprites) {
      const sheet = this.spriteSheets.get(sprite.atlasName);
      if (!sheet) {
        // Skip sprites with missing atlas
        continue;
      }

      // Convert world coords to screen coords
      const screenX = Math.round(sprite.worldX - view.cameraWorldX);
      const screenY = Math.round(sprite.worldY - view.cameraWorldY);

      // Skip if completely off-screen
      if (
        screenX + sprite.width < 0 ||
        screenX > view.pixelWidth ||
        screenY + sprite.height < 0 ||
        screenY > view.pixelHeight
      ) {
        continue;
      }

      // Handle transforms
      const scaleX = sprite.scaleX ?? 1;
      const scaleY = sprite.scaleY ?? 1;
      const rotationDeg = sprite.rotationDeg ?? 0;
      const needsFlip = sprite.flipX || sprite.flipY;
      const needsScale = scaleX !== 1 || scaleY !== 1;
      const needsRotation = rotationDeg !== 0;
      const needsAlpha = sprite.alpha < 1;
      const needsTint = sprite.tintR !== 1 || sprite.tintG !== 1 || sprite.tintB !== 1;

      if (needsFlip || needsScale || needsRotation || needsAlpha || needsTint) {
        ctx.save();

        // Apply alpha
        if (needsAlpha) {
          ctx.globalAlpha = sprite.alpha;
        }

        // Centered transform: flip/scale/rotate around sprite center.
        const centerX = screenX + sprite.width / 2;
        const centerY = screenY + sprite.height / 2;
        ctx.translate(centerX, centerY);
        if (needsRotation) {
          ctx.rotate((rotationDeg * Math.PI) / 180);
        }
        ctx.scale((sprite.flipX ? -1 : 1) * scaleX, (sprite.flipY ? -1 : 1) * scaleY);

        const drawX = -sprite.width / 2;
        const drawY = -sprite.height / 2;

        // Draw sprite (possibly with tint)
        if (needsTint && sprite.isReflection) {
          // For tinted reflections, we need per-pixel manipulation
          this.drawTintedSprite(
            sheet.canvas,
            sprite.atlasX,
            sprite.atlasY,
            sprite.atlasWidth,
            sprite.atlasHeight,
            drawX,
            drawY,
            sprite.width,
            sprite.height,
            sprite.tintR,
            sprite.tintG,
            sprite.tintB
          );
        } else {
          ctx.drawImage(
            sheet.canvas,
            sprite.atlasX,
            sprite.atlasY,
            sprite.atlasWidth,
            sprite.atlasHeight,
            drawX,
            drawY,
            sprite.width,
            sprite.height
          );
        }

        ctx.restore();
      } else {
        // Fast path: no transforms needed
        ctx.drawImage(
          sheet.canvas,
          sprite.atlasX,
          sprite.atlasY,
          sprite.atlasWidth,
          sprite.atlasHeight,
          screenX,
          screenY,
          sprite.width,
          sprite.height
        );
      }
    }
  }

  /**
   * Draw a sprite with color tinting (for reflections)
   * This is slower than normal drawing due to per-pixel manipulation
   */
  private drawTintedSprite(
    source: HTMLCanvasElement,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    tintR: number,
    tintG: number,
    tintB: number
  ): void {
    // Create temp canvas for tinting
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sw;
    tempCanvas.height = sh;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;

    // Draw source region to temp
    tempCtx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);

    // Apply tint via pixel manipulation
    const imageData = tempCtx.getImageData(0, 0, sw, sh);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * tintR);     // R
      data[i + 1] = Math.min(255, data[i + 1] * tintG); // G
      data[i + 2] = Math.min(255, data[i + 2] * tintB); // B
      // Alpha unchanged
    }

    tempCtx.putImageData(imageData, 0, 0);

    // Draw tinted result to main canvas
    this.ctx.drawImage(tempCanvas, 0, 0, sw, sh, dx, dy, dw, dh);
  }

  /**
   * Set water mask for reflection clipping
   */
  setWaterMask(mask: WaterMaskData | null): void {
    this.waterMask = mask;
    // Note: Water masking in Canvas2D would require additional per-pixel work
    // during reflection rendering. Currently not implemented - reflections
    // render without water clipping in Canvas2D mode.
  }

  /**
   * Canvas2D is always valid
   */
  isValid(): boolean {
    return true;
  }

  /**
   * Get rendering statistics
   */
  getStats(): SpriteRenderStats {
    return {
      rendererType: this.rendererType,
      isValid: true,
      spriteSheetCount: this.spriteSheets.size,
      lastBatchSize: this.lastBatchSize,
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.spriteSheets.clear();
    this.waterMask = null;
  }
}
