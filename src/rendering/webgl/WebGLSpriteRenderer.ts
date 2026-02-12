/**
 * WebGLSpriteRenderer - GPU-accelerated sprite rendering
 *
 * Implements ISpriteRenderer for WebGL2 sprite rendering with:
 * - Instanced quad rendering for batching
 * - RGBA sprite sheets (pre-rendered from PNGs, not indexed color)
 * - Per-sprite tint, alpha, and flip
 * - Optional water masking for reflections (Phase 4)
 * - Pixel-perfect GBA shimmer effect via fragment shader (Phase 4)
 *
 * Key differences from WebGLTileRenderer:
 * - Uses RGBA textures directly (not indexed + palette lookup)
 * - World coordinates → screen coordinates via camera view
 * - Supports multiple sprite sheets by name
 *
 * Reuses existing components:
 * - WebGLShaders for shader compilation with caching
 * - Same patterns as WebGLTileRenderer (initialize, dispose, isValid)
 */

import type { ISpriteRenderer, SpriteRenderStats, WaterMaskData } from '../ISpriteRenderer';
import type { RendererType } from '../IRenderPipeline';
import type { SpriteInstance, SpriteSheetInfo, WorldCameraView } from '../types';
import type { ShaderProgram } from './types';
import { WebGLShaders } from './WebGLShaders';
import {
  SPRITE_VERTEX_SHADER,
  SPRITE_FRAGMENT_SHADER,
  SPRITE_REFLECTION_FRAGMENT_SHADER,
} from './WebGLSpriteShaders';

/** Maximum sprites per batch (can be tuned) */
const MAX_SPRITES_PER_BATCH = 1024;

/** Packed float count and byte size per sprite instance. */
const FLOATS_PER_SPRITE = 17;
const BYTES_PER_SPRITE = FLOATS_PER_SPRITE * 4;

/** Sprite sheet texture info */
interface SpriteSheetTexture {
  texture: WebGLTexture;
  width: number;
  height: number;
  info: SpriteSheetInfo;
}

/**
 * WebGL2 sprite renderer implementing ISpriteRenderer
 *
 * Usage:
 * ```typescript
 * const renderer = new WebGLSpriteRenderer(gl);
 * renderer.initialize();
 *
 * // Upload sprite sheets once
 * renderer.uploadSpriteSheet('player', playerCanvas);
 *
 * // Each frame
 * const sprites: SpriteInstance[] = [...];
 * sprites.sort((a, b) => a.sortKey - b.sortKey);
 * renderer.renderBatch(sprites, cameraView);
 *
 * // Cleanup
 * renderer.dispose();
 * ```
 */
export class WebGLSpriteRenderer implements ISpriteRenderer {
  readonly rendererType: RendererType = 'webgl';

  private gl: WebGL2RenderingContext;
  private shaders: WebGLShaders;

  // Shader programs
  private spriteProgram: ShaderProgram | null = null;
  private reflectionProgram: ShaderProgram | null = null;

  // Geometry buffers
  private quadVAO: WebGLVertexArrayObject | null = null;
  private quadVBO: WebGLBuffer | null = null;
  private instanceVBO: WebGLBuffer | null = null;
  private instanceData: Float32Array;

  // Sprite sheet textures (by name)
  private spriteSheets: Map<string, SpriteSheetTexture> = new Map();

  // Water mask texture (for reflections)
  private waterMaskTexture: WebGLTexture | null = null;

  // Stats
  private lastBatchSize = 0;
  private initialized = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.shaders = new WebGLShaders();
    this.instanceData = new Float32Array(MAX_SPRITES_PER_BATCH * FLOATS_PER_SPRITE);
  }

  /**
   * Initialize WebGL resources
   *
   * Must be called before any other methods.
   * Can be called again after dispose() to reinitialize.
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    const { gl } = this;

    // Compile shader programs (reuses WebGLShaders caching)
    this.spriteProgram = this.shaders.getOrCreateProgram(
      gl,
      'sprite',
      SPRITE_VERTEX_SHADER,
      SPRITE_FRAGMENT_SHADER
    );

    this.reflectionProgram = this.shaders.getOrCreateProgram(
      gl,
      'spriteReflection',
      SPRITE_VERTEX_SHADER,
      SPRITE_REFLECTION_FRAGMENT_SHADER
    );

    // Create VAO and buffers
    this.createGeometry();

    // Create and initialize water mask texture with a default 1x1 white pixel
    // This makes the texture "complete" before real data is uploaded
    this.waterMaskTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1); // Use texture unit 1 for water mask
    gl.bindTexture(gl.TEXTURE_2D, this.waterMaskTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      1,
      1,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255]) // Default: all water (show reflection)
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.initialized = true;
  }

  /**
   * Upload a sprite sheet to the renderer
   *
   * @param name - Unique name for lookup (used in SpriteInstance.atlasName)
   * @param source - Canvas or ImageData containing the sprite sheet
   * @param info - Optional metadata about the sheet
   */
  uploadSpriteSheet(
    name: string,
    source: HTMLCanvasElement | ImageData,
    info?: Partial<SpriteSheetInfo>
  ): void {
    const { gl } = this;

    // Remove existing texture if any
    this.removeSpriteSheet(name);

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error(`Failed to create texture for sprite sheet: ${name}`);
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Upload RGBA texture data
    if (source instanceof HTMLCanvasElement) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        source.width,
        source.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source.data
      );
    }

    // CRITICAL: Use NEAREST filtering for pixel-perfect GBA rendering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const width = source.width;
    const height = source.height;

    this.spriteSheets.set(name, {
      texture,
      width,
      height,
      info: {
        name,
        width,
        height,
        frameWidth: info?.frameWidth,
        frameHeight: info?.frameHeight,
        frameCount: info?.frameCount,
      },
    });
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
    const sheet = this.spriteSheets.get(name);
    if (sheet) {
      this.gl.deleteTexture(sheet.texture);
      this.spriteSheets.delete(name);
    }
  }

  /**
   * Render a batch of sprites
   *
   * Sprites should be pre-sorted by sortKey (caller's responsibility).
   * The renderer batches by atlas to minimize texture switches.
   *
   * @param sprites - Array of sprite instances to render (sorted by sortKey)
   * @param view - Camera view for coordinate conversion
   */
  renderBatch(sprites: SpriteInstance[], view: WorldCameraView): void {
    if (!this.initialized || sprites.length === 0) {
      this.lastBatchSize = 0;
      return;
    }

    const { gl } = this;
    this.lastBatchSize = sprites.length;

    // Enable blending for sprite transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // IMPORTANT: Render sprites in INPUT ORDER to preserve Y-sorting!
    // Previously we grouped by atlas which destroyed the sort order.
    // Now we batch CONSECUTIVE sprites with the same atlas + shader type.
    // This preserves Y-sort order while still batching when possible.

    let batchStart = 0;
    while (batchStart < sprites.length) {
      const firstSprite = sprites[batchStart];
      const firstAtlas = firstSprite.atlasName;
      const firstIsReflectionLayer = firstSprite.isReflection || firstSprite.isReflectionLayer;

      // Find the end of this batch (consecutive sprites with same atlas and shader type)
      let batchEnd = batchStart + 1;
      while (batchEnd < sprites.length) {
        const sprite = sprites[batchEnd];
        const sameAtlas = sprite.atlasName === firstAtlas;
        const sameShader = (sprite.isReflection || sprite.isReflectionLayer) === firstIsReflectionLayer;
        if (!sameAtlas || !sameShader) break;
        batchEnd++;
      }

      // Get the sprite sheet for this batch
      const sheet = this.spriteSheets.get(firstAtlas);
      if (!sheet) {
        console.warn(`Sprite sheet not found: ${firstAtlas}`);
        batchStart = batchEnd;
        continue;
      }

      // Extract the batch
      const batch = sprites.slice(batchStart, batchEnd);

      // Render with appropriate shader
      if (firstIsReflectionLayer) {
        // Reflection-layer sprites (reflections + water effects) use reflection shader
        if (this.reflectionProgram) {
          gl.useProgram(this.reflectionProgram.program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, sheet.texture);
          this.setUniforms(this.reflectionProgram, view, sheet);
          this.setReflectionUniforms(this.reflectionProgram, sheet);
          this.renderSpriteBatch(batch, view, sheet);
        }
      } else {
        // Normal sprites use standard shader
        if (this.spriteProgram) {
          gl.useProgram(this.spriteProgram.program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, sheet.texture);
          this.setUniforms(this.spriteProgram, view, sheet);
          this.renderSpriteBatch(batch, view, sheet);
        }
      }

      batchStart = batchEnd;
    }
  }

  /**
   * Set water mask for reflection clipping
   *
   * The mask determines which screen pixels show reflections:
   * - 255 = reflective (water/ice) - show reflection
   * - 0 = non-reflective (grass/land) - hide reflection
   *
   * @param mask - Water mask data, or null to use default (all reflective)
   */
  setWaterMask(mask: WaterMaskData | null): void {
    if (!mask || !this.waterMaskTexture) {
      return;
    }

    const { gl } = this;

    // Explicitly use texture unit 1 for water mask to avoid conflicts
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.waterMaskTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      mask.width,
      mask.height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      mask.data
    );

    // Parameters are already set during initialize(), but set again for safety
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /**
   * Check if the renderer is in a valid state
   */
  isValid(): boolean {
    return this.initialized && !this.gl.isContextLost();
  }

  /**
   * Get rendering statistics
   */
  getStats(): SpriteRenderStats {
    return {
      rendererType: this.rendererType,
      isValid: this.isValid(),
      spriteSheetCount: this.spriteSheets.size,
      lastBatchSize: this.lastBatchSize,
    };
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    const { gl } = this;

    // Delete all sprite sheet textures
    for (const sheet of this.spriteSheets.values()) {
      gl.deleteTexture(sheet.texture);
    }
    this.spriteSheets.clear();

    // Delete water mask texture
    if (this.waterMaskTexture) {
      gl.deleteTexture(this.waterMaskTexture);
      this.waterMaskTexture = null;
    }

    // Delete geometry
    if (this.quadVAO) {
      gl.deleteVertexArray(this.quadVAO);
      this.quadVAO = null;
    }
    if (this.quadVBO) {
      gl.deleteBuffer(this.quadVBO);
      this.quadVBO = null;
    }
    if (this.instanceVBO) {
      gl.deleteBuffer(this.instanceVBO);
      this.instanceVBO = null;
    }

    // Delete shaders
    this.shaders.dispose(gl);
    this.spriteProgram = null;
    this.reflectionProgram = null;

    this.initialized = false;
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Create quad geometry and instance buffer
   */
  private createGeometry(): void {
    const { gl } = this;

    // Create VAO
    this.quadVAO = gl.createVertexArray();
    if (!this.quadVAO) {
      throw new Error('Failed to create VAO');
    }
    gl.bindVertexArray(this.quadVAO);

    // Create quad VBO (unit quad: 0,0 to 1,1)
    this.quadVBO = gl.createBuffer();
    if (!this.quadVBO) {
      throw new Error('Failed to create quad VBO');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);

    // Triangle strip: 4 vertices for a quad
    const quadVertices = new Float32Array([
      0, 0, // Bottom-left
      1, 0, // Bottom-right
      0, 1, // Top-left
      1, 1, // Top-right
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    // Position attribute (location 0)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Create instance VBO
    this.instanceVBO = gl.createBuffer();
    if (!this.instanceVBO) {
      throw new Error('Failed to create instance VBO');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_SPRITES_PER_BATCH * BYTES_PER_SPRITE, gl.DYNAMIC_DRAW);

    // Instance attributes
    // a_spriteRect: vec4 (x, y, width, height)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, BYTES_PER_SPRITE, 0);
    gl.vertexAttribDivisor(1, 1);

    // a_atlasRect: vec4 (x, y, width, height in normalized coords)
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, BYTES_PER_SPRITE, 16);
    gl.vertexAttribDivisor(2, 1);

    // a_colorMod: vec4 (r, g, b, a)
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, BYTES_PER_SPRITE, 32);
    gl.vertexAttribDivisor(3, 1);

    // a_flags: float (packed flags)
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, BYTES_PER_SPRITE, 48);
    gl.vertexAttribDivisor(4, 1);

    // a_shimmerScale: float (shimmer X-scale for water reflections)
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, BYTES_PER_SPRITE, 52);
    gl.vertexAttribDivisor(5, 1);

    // a_rotationDeg: float (clockwise rotation around sprite center)
    gl.enableVertexAttribArray(6);
    gl.vertexAttribPointer(6, 1, gl.FLOAT, false, BYTES_PER_SPRITE, 56);
    gl.vertexAttribDivisor(6, 1);

    // a_scale: vec2 (centered X/Y scale)
    gl.enableVertexAttribArray(7);
    gl.vertexAttribPointer(7, 2, gl.FLOAT, false, BYTES_PER_SPRITE, 60);
    gl.vertexAttribDivisor(7, 1);

    gl.bindVertexArray(null);
  }

  /**
   * Set shader uniforms
   */
  private setUniforms(program: ShaderProgram, view: WorldCameraView, _sheet: SpriteSheetTexture): void {
    const { gl } = this;

    // Viewport size (pixelWidth/Height from CameraView)
    const viewportSizeLoc = this.shaders.getUniformLocation(gl, program, 'u_viewportSize');
    gl.uniform2f(viewportSizeLoc, view.pixelWidth, view.pixelHeight);

    // Sprite atlas sampler
    const atlasLoc = this.shaders.getUniformLocation(gl, program, 'u_spriteAtlas');
    gl.uniform1i(atlasLoc, 0);
  }

  /**
   * Set reflection-specific uniforms
   */
  private setReflectionUniforms(program: ShaderProgram, sheet: SpriteSheetTexture): void {
    const { gl } = this;

    // Atlas size for texelFetch
    const atlasSizeLoc = this.shaders.getUniformLocation(gl, program, 'u_atlasSize');
    gl.uniform2i(atlasSizeLoc, sheet.width, sheet.height);

    // Water mask texture (unit 1)
    // ALWAYS bind the water mask texture - it's required for the shader
    // If no mask data is set, the default 1x1 white texture shows all reflections
    // If mask data IS set, it clips reflections to only reflective tile pixels
    if (this.waterMaskTexture) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.waterMaskTexture);

      const maskLoc = this.shaders.getUniformLocation(gl, program, 'u_waterMask');
      gl.uniform1i(maskLoc, 1);
    }

    // Note: shimmer scale is now per-instance via a_shimmerScale attribute
    // (set in fillInstanceData from sprite.shimmerScale)
  }

  /**
   * Render a batch of sprites for a single atlas
   */
  private renderSpriteBatch(
    sprites: SpriteInstance[],
    view: WorldCameraView,
    sheet: SpriteSheetTexture
  ): void {
    const { gl } = this;

    gl.bindVertexArray(this.quadVAO);

    // Process sprites in chunks of MAX_SPRITES_PER_BATCH
    for (let offset = 0; offset < sprites.length; offset += MAX_SPRITES_PER_BATCH) {
      const batchSprites = sprites.slice(offset, offset + MAX_SPRITES_PER_BATCH);
      const count = batchSprites.length;

      // Fill instance data buffer
      this.fillInstanceData(batchSprites, view, sheet);

      // Upload instance data
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData.subarray(0, count * FLOATS_PER_SPRITE));

      // Draw instanced quads
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    }

    gl.bindVertexArray(null);
  }

  /**
   * Fill instance data buffer from sprite instances
   */
  private fillInstanceData(
    sprites: SpriteInstance[],
    view: WorldCameraView,
    sheet: SpriteSheetTexture
  ): void {
    const data = this.instanceData;
    let i = 0;

    for (const sprite of sprites) {
      // Convert world coordinates to screen coordinates
      const screenX = sprite.worldX - view.cameraWorldX;
      const screenY = sprite.worldY - view.cameraWorldY;

      // a_spriteRect: x, y, width, height (screen pixels)
      data[i++] = screenX;
      data[i++] = screenY;
      data[i++] = sprite.width;
      data[i++] = sprite.height;

      // a_atlasRect: x, y, width, height (normalized 0-1)
      data[i++] = sprite.atlasX / sheet.width;
      data[i++] = sprite.atlasY / sheet.height;
      data[i++] = sprite.atlasWidth / sheet.width;
      data[i++] = sprite.atlasHeight / sheet.height;

      // a_colorMod: r, g, b, a
      data[i++] = sprite.tintR;
      data[i++] = sprite.tintG;
      data[i++] = sprite.tintB;
      data[i++] = sprite.alpha;

      // a_flags: packed flags
      const flags = (sprite.flipX ? 1 : 0) | (sprite.flipY ? 2 : 0);
      data[i++] = flags;

      // a_shimmerScale + a_rotationDeg + a_scale
      data[i++] = sprite.shimmerScale ?? 1.0;
      data[i++] = sprite.rotationDeg ?? 0;
      data[i++] = sprite.scaleX ?? 1.0;
      data[i++] = sprite.scaleY ?? 1.0;
    }
  }
}
