/**
 * WebGLTileRenderer - Core instanced tile rendering
 *
 * This is the heart of the WebGL optimization. It renders thousands
 * of tiles in a single draw call using instanced rendering.
 *
 * Key features:
 * - Instanced rendering: 1 draw call for thousands of tiles
 * - GPU palette lookup: No CPU palette application
 * - Efficient buffer updates: Only upload changed data
 */

import { WebGLContext } from './WebGLContext';
import { WebGLShaders, TILE_VERTEX_SHADER, TILE_FRAGMENT_SHADER } from './WebGLShaders';
import { WebGLBufferManager } from './WebGLBufferManager';
import { WebGLTextureManager } from './WebGLTextureManager';
import type { TileInstance, ShaderProgram } from './types';

/**
 * Viewport configuration
 */
export interface Viewport {
  width: number;
  height: number;
}

/**
 * Scroll offset for sub-pixel positioning
 */
export interface ScrollOffset {
  x: number;
  y: number;
}

/**
 * WebGL instanced tile renderer
 *
 * Renders tiles using WebGL2 instanced rendering for maximum performance.
 * A single draw call can render thousands of tiles.
 */
export class WebGLTileRenderer {
  private gl: WebGL2RenderingContext;
  private shaders: WebGLShaders;
  private bufferManager: WebGLBufferManager;
  private textureManager: WebGLTextureManager;
  private shaderProgram: ShaderProgram | null = null;

  // Cached uniform locations
  private uniforms: {
    viewportSize: WebGLUniformLocation | null;
    scrollOffset: WebGLUniformLocation | null;
    primaryTilesetSize: WebGLUniformLocation | null;
    secondaryTilesetSize: WebGLUniformLocation | null;
    primaryTileset: WebGLUniformLocation | null;
    secondaryTileset: WebGLUniformLocation | null;
    palette: WebGLUniformLocation | null;
    // Second tileset pair (for multi-tileset worlds)
    primaryTilesetSize1: WebGLUniformLocation | null;
    secondaryTilesetSize1: WebGLUniformLocation | null;
    primaryTileset1: WebGLUniformLocation | null;
    secondaryTileset1: WebGLUniformLocation | null;
    palette1: WebGLUniformLocation | null;
  } | null = null;

  // Cached attribute locations
  private attributes: {
    position: number;
    instanceData: number;
  } | null = null;

  constructor(glContext: WebGLContext) {
    this.gl = glContext.getGL();
    this.shaders = new WebGLShaders();
    this.bufferManager = new WebGLBufferManager(this.gl);
    this.textureManager = new WebGLTextureManager(this.gl);
  }

  /**
   * Initialize the tile renderer
   *
   * Compiles shaders, creates buffers, and sets up the rendering pipeline.
   */
  initialize(): void {
    const { gl } = this;

    // Check for context loss before initialization
    if (gl.isContextLost()) {
      throw new Error('WebGL context is lost - cannot initialize renderer');
    }

    // Compile tile shader
    this.shaderProgram = this.shaders.getOrCreateProgram(
      gl,
      'tile',
      TILE_VERTEX_SHADER,
      TILE_FRAGMENT_SHADER
    );

    // Cache attribute locations
    this.attributes = {
      position: this.shaders.getAttributeLocation(gl, this.shaderProgram, 'a_position'),
      instanceData: this.shaders.getAttributeLocation(gl, this.shaderProgram, 'a_instanceData'),
    };

    // Initialize buffer manager with attribute locations
    this.bufferManager.initialize(
      this.attributes.position,
      this.attributes.instanceData
    );

    // Initialize texture manager
    this.textureManager.initialize();

    // Cache uniform locations
    this.uniforms = {
      viewportSize: this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_viewportSize'),
      scrollOffset: this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_scrollOffset'),
      primaryTilesetSize: this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_primaryTilesetSize'),
      secondaryTilesetSize: this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_secondaryTilesetSize'),
      primaryTileset: this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_primaryTileset'),
      secondaryTileset: this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_secondaryTileset'),
      palette: this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_palette'),
      // Second tileset pair uniforms
      primaryTilesetSize1: this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_primaryTilesetSize1'),
      secondaryTilesetSize1: this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_secondaryTilesetSize1'),
      primaryTileset1: this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_primaryTileset1'),
      secondaryTileset1: this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_secondaryTileset1'),
      palette1: this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_palette1'),
    };
  }

  /**
   * Upload tileset data
   *
   * @param tileset - Which tileset ('primary' or 'secondary')
   * @param data - Indexed color data
   * @param width - Width in pixels
   * @param height - Height in pixels
   */
  uploadTileset(
    tileset: 'primary' | 'secondary',
    data: Uint8Array,
    width: number,
    height: number
  ): void {
    this.textureManager.uploadTileset(tileset, data, width, height);
  }

  /**
   * Upload palette data
   *
   * @param palettes - Array of palettes
   */
  uploadPalettes(palettes: { colors: string[] }[]): void {
    this.textureManager.uploadPalettes(palettes);
  }

  /**
   * Upload tileset data for pair 1 (multi-tileset worlds)
   */
  uploadTilesetPair1(
    tileset: 'primary' | 'secondary',
    data: Uint8Array,
    width: number,
    height: number
  ): void {
    this.textureManager.uploadTilesetPair1(tileset, data, width, height);
  }

  /**
   * Upload palette data for pair 1 (multi-tileset worlds)
   */
  uploadPalettesPair1(palettes: { colors: string[] }[]): void {
    this.textureManager.uploadPalettesPair1(palettes);
  }

  /**
   * Render tiles in a single instanced draw call
   *
   * This is the core rendering function. It takes an array of tile instances
   * and renders them all in one GPU draw call.
   *
   * @param tiles - Array of tile instances to render
   * @param viewport - Viewport dimensions in pixels
   * @param scrollOffset - Sub-pixel scroll offset for smooth panning
   */
  render(
    tiles: TileInstance[],
    viewport: Viewport,
    scrollOffset: ScrollOffset = { x: 0, y: 0 }
  ): void {
    if (tiles.length === 0) return;

    const { gl } = this;

    if (!this.shaderProgram || !this.uniforms || !this.attributes) {
      throw new Error('TileRenderer not initialized');
    }

    // Use shader program
    gl.useProgram(this.shaderProgram.program);

    // Set viewport
    gl.viewport(0, 0, viewport.width, viewport.height);

    // Set uniforms
    gl.uniform2f(this.uniforms.viewportSize, viewport.width, viewport.height);
    gl.uniform2f(this.uniforms.scrollOffset, scrollOffset.x, scrollOffset.y);

    // Set tileset sizes (in tiles, not pixels)
    // Primary and secondary tilesets can have different heights!
    const primarySize = this.textureManager.getTilesetSize('primary');
    const secondarySize = this.textureManager.getTilesetSize('secondary');
    gl.uniform2f(this.uniforms.primaryTilesetSize, primarySize.tilesWide, primarySize.tilesHigh);
    gl.uniform2f(this.uniforms.secondaryTilesetSize, secondarySize.tilesWide, secondarySize.tilesHigh);

    // Set pair 1 tileset sizes
    const primarySize1 = this.textureManager.getTilesetSizePair1('primary');
    const secondarySize1 = this.textureManager.getTilesetSizePair1('secondary');
    gl.uniform2f(this.uniforms.primaryTilesetSize1, primarySize1.tilesWide, primarySize1.tilesHigh);
    gl.uniform2f(this.uniforms.secondaryTilesetSize1, secondarySize1.tilesWide, secondarySize1.tilesHigh);

    // Bind textures and set texture uniforms (both pairs)
    this.textureManager.bindTextures(0, 1, 2);

    // Pair 0 texture uniforms
    gl.uniform1i(this.uniforms.primaryTileset, 0);
    gl.uniform1i(this.uniforms.secondaryTileset, 1);
    gl.uniform1i(this.uniforms.palette, 2);

    // Pair 1 texture uniforms (units 3, 4, 5)
    gl.uniform1i(this.uniforms.primaryTileset1, 3);
    gl.uniform1i(this.uniforms.secondaryTileset1, 4);
    gl.uniform1i(this.uniforms.palette1, 5);

    // Update instance buffer with tile data
    this.bufferManager.updateInstanceBuffer(tiles);

    // Bind VAO and draw
    this.bufferManager.bind();

    // Draw all tiles in ONE call!
    gl.drawArraysInstanced(
      gl.TRIANGLE_STRIP,
      0,              // Start vertex
      4,              // 4 vertices per quad
      tiles.length    // Number of instances
    );

    this.bufferManager.unbind();
  }

  /**
   * Render to a framebuffer (for multi-pass rendering)
   *
   * @param tiles - Tiles to render
   * @param framebuffer - Target framebuffer (null for screen)
   * @param viewport - Viewport dimensions
   * @param scrollOffset - Scroll offset
   */
  renderToFramebuffer(
    tiles: TileInstance[],
    framebuffer: WebGLFramebuffer | null,
    viewport: Viewport,
    scrollOffset: ScrollOffset = { x: 0, y: 0 }
  ): void {
    const { gl } = this;

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    if (framebuffer) {
      // Clear framebuffer
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    this.render(tiles, viewport, scrollOffset);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Update a region of the tileset (for animations)
   */
  updateTilesetRegion(
    tileset: 'primary' | 'secondary',
    data: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    this.textureManager.updateTilesetRegion(tileset, data, x, y, width, height);
  }

  /**
   * Update a single palette
   */
  updatePalette(paletteIndex: number, colors: string[]): void {
    this.textureManager.updatePalette(paletteIndex, colors);
  }

  /**
   * Get buffer statistics
   */
  getBufferStats() {
    return this.bufferManager.getStats();
  }

  /**
   * Get the texture manager (for advanced usage)
   */
  getTextureManager(): WebGLTextureManager {
    return this.textureManager;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.bufferManager.dispose();
    this.textureManager.dispose();
    this.shaders.dispose(this.gl);
    this.shaderProgram = null;
    this.uniforms = null;
    this.attributes = null;
  }
}
