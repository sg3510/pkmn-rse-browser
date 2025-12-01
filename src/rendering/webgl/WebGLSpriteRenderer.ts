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

/** Bytes per sprite instance (4 floats × 4 attributes = 64 bytes) */
const BYTES_PER_SPRITE = 64;

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
  private waterMaskData: WaterMaskData | null = null;

  // Stats
  private lastBatchSize = 0;
  private initialized = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.shaders = new WebGLShaders();
    this.instanceData = new Float32Array(MAX_SPRITES_PER_BATCH * 16); // 16 floats per sprite
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

    // Split sprites into normal and reflection groups by atlas
    // We need separate passes because they use different shaders
    const atlasGroups = this.groupByAtlas(sprites);

    for (const [atlasName, atlasSprites] of atlasGroups) {
      const sheet = this.spriteSheets.get(atlasName);
      if (!sheet) {
        console.warn(`Sprite sheet not found: ${atlasName}`);
        continue;
      }

      // Split into normal and reflection sprites
      const normalSprites = atlasSprites.filter((s) => !s.isReflection);
      const reflectionSprites = atlasSprites.filter((s) => s.isReflection);

      // Render normal sprites with standard shader
      if (normalSprites.length > 0 && this.spriteProgram) {
        gl.useProgram(this.spriteProgram.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sheet.texture);
        this.setUniforms(this.spriteProgram, view, sheet);
        this.renderSpriteBatch(normalSprites, view, sheet);
      }

      // Render reflection sprites with reflection shader (water mask + shimmer)
      if (reflectionSprites.length > 0 && this.reflectionProgram) {
        gl.useProgram(this.reflectionProgram.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sheet.texture);
        this.setUniforms(this.reflectionProgram, view, sheet);
        this.setReflectionUniforms(this.reflectionProgram, sheet);
        this.renderSpriteBatch(reflectionSprites, view, sheet);
      }
    }
  }

  /**
   * Set water mask for reflection clipping
   *
   * @param mask - Water mask data, or null to clear
   */
  setWaterMask(mask: WaterMaskData | null): void {
    this.waterMaskData = mask;

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

    // Instance attributes (locations 1-4)
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

    // Padding to 64 bytes (56-64 unused, reserved for future expansion)

    gl.bindVertexArray(null);
  }

  /**
   * Group sprites by atlas name for efficient batching
   */
  private groupByAtlas(sprites: SpriteInstance[]): Map<string, SpriteInstance[]> {
    const groups = new Map<string, SpriteInstance[]>();

    for (const sprite of sprites) {
      let group = groups.get(sprite.atlasName);
      if (!group) {
        group = [];
        groups.set(sprite.atlasName, group);
      }
      group.push(sprite);
    }

    return groups;
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
    if (this.waterMaskTexture && this.waterMaskData) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.waterMaskTexture);

      const maskLoc = this.shaders.getUniformLocation(gl, program, 'u_waterMask');
      gl.uniform1i(maskLoc, 1);

      const maskOffsetLoc = this.shaders.getUniformLocation(gl, program, 'u_maskOffset');
      gl.uniform2f(maskOffsetLoc, this.waterMaskData.worldOffsetX, this.waterMaskData.worldOffsetY);

      const maskSizeLoc = this.shaders.getUniformLocation(gl, program, 'u_maskSize');
      gl.uniform2f(maskSizeLoc, this.waterMaskData.width, this.waterMaskData.height);
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
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData.subarray(0, count * 16));

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

      // Padding (3 floats to reach 16 floats per sprite)
      data[i++] = sprite.shimmerScale ?? 1.0; // Reserved for shimmer
      data[i++] = 0; // Reserved
      data[i++] = 0; // Reserved
    }
  }
}
