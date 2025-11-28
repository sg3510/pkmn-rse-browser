/**
 * WebGLTextureManager - Manages tileset and palette textures
 *
 * Handles:
 * - Indexed tileset texture upload (R8 format)
 * - Palette texture upload (RGBA 16x16)
 * - Partial texture updates for animations
 * - Texture binding for rendering
 *
 * Key insight: Tilesets are stored as indexed color (1 byte per pixel),
 * and the palette lookup happens in the fragment shader on the GPU.
 */

import type { Palette } from '../../utils/mapLoader';

/** Number of colors per palette */
const COLORS_PER_PALETTE = 16;

/** Number of palettes in the palette texture */
const PALETTES_COUNT = 16;

/**
 * Texture manager for WebGL tile rendering
 *
 * Manages textures for up to 2 tileset pairs:
 * - Pair 0: Primary/Secondary tileset + Palette (indexed color, R8)
 * - Pair 1: Primary/Secondary tileset + Palette (for multi-tileset worlds)
 */
export class WebGLTextureManager {
  private gl: WebGL2RenderingContext;

  // Tileset pair 0 (primary)
  private primaryTexture: WebGLTexture | null = null;
  private secondaryTexture: WebGLTexture | null = null;
  private paletteTexture: WebGLTexture | null = null;

  // Tileset pair 1 (for multi-tileset worlds)
  private primaryTexture1: WebGLTexture | null = null;
  private secondaryTexture1: WebGLTexture | null = null;
  private paletteTexture1: WebGLTexture | null = null;

  // Track texture dimensions for shader uniforms
  private primarySize: { width: number; height: number; tilesWide: number; tilesHigh: number } | null = null;
  private secondarySize: { width: number; height: number; tilesWide: number; tilesHigh: number } | null = null;
  private primarySize1: { width: number; height: number; tilesWide: number; tilesHigh: number } | null = null;
  private secondarySize1: { width: number; height: number; tilesWide: number; tilesHigh: number } | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Initialize textures
   */
  initialize(): void {
    // Pair 0 textures
    this.primaryTexture = this.createTexture();
    this.secondaryTexture = this.createTexture();
    this.paletteTexture = this.createTexture();

    // Pair 1 textures (with placeholder data to avoid shader errors)
    this.primaryTexture1 = this.createTexture();
    this.secondaryTexture1 = this.createTexture();
    this.paletteTexture1 = this.createTexture();

    // Initialize pair 1 with 1x1 placeholder textures
    this.initializePlaceholderTextures();
  }

  /**
   * Initialize pair 1 textures with 1x1 placeholders
   * This prevents shader errors when pair 1 is not yet loaded
   */
  private initializePlaceholderTextures(): void {
    const { gl } = this;
    const placeholder = new Uint8Array([0]); // 1x1 transparent pixel

    // Initialize tileset textures as 1x1 R8
    for (const texture of [this.primaryTexture1, this.secondaryTexture1]) {
      if (!texture) continue;
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, placeholder);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // Initialize palette texture as 1x1 RGBA (transparent black)
    if (this.paletteTexture1) {
      const palettePlaceholder = new Uint8Array([0, 0, 0, 0]);
      gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, palettePlaceholder);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

  }

  /**
   * Upload indexed tileset data as R8 texture
   *
   * CRITICAL: Uses R8 format (single channel) for indexed colors.
   * Each pixel stores the palette index (0-15).
   *
   * @param tileset - Which tileset ('primary' or 'secondary')
   * @param data - Indexed color data (1 byte per pixel)
   * @param width - Width in pixels
   * @param height - Height in pixels
   */
  uploadTileset(
    tileset: 'primary' | 'secondary',
    data: Uint8Array,
    width: number,
    height: number
  ): void {
    const { gl } = this;
    const texture = tileset === 'primary' ? this.primaryTexture : this.secondaryTexture;

    if (!texture) {
      throw new Error('Texture not initialized');
    }

    // Ensure tightly packed rows for single-channel textures (avoids row padding artifacts)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Upload as R8 (single channel, 8 bits)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,              // Mip level
      gl.R8,          // Internal format: single red channel
      width,
      height,
      0,              // Border (must be 0)
      gl.RED,         // Source format
      gl.UNSIGNED_BYTE,
      data
    );

    // CRITICAL: Use NEAREST filtering for pixel-perfect rendering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Store dimensions (tiles are 8x8 pixels)
    const tilesWide = Math.floor(width / 8);
    const tilesHigh = Math.floor(height / 8);

    if (tileset === 'primary') {
      this.primarySize = { width, height, tilesWide, tilesHigh };
    } else {
      this.secondarySize = { width, height, tilesWide, tilesHigh };
    }
  }

  /**
   * Upload tileset data for pair 1 (for multi-tileset worlds)
   *
   * @param tileset - Which tileset ('primary' or 'secondary')
   * @param data - Indexed color data (1 byte per pixel)
   * @param width - Width in pixels
   * @param height - Height in pixels
   */
  uploadTilesetPair1(
    tileset: 'primary' | 'secondary',
    data: Uint8Array,
    width: number,
    height: number
  ): void {
    const { gl } = this;
    const texture = tileset === 'primary' ? this.primaryTexture1 : this.secondaryTexture1;

    if (!texture) {
      throw new Error('Pair 1 texture not initialized');
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      data
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Store dimensions (tiles are 8x8 pixels)
    const tilesWide = Math.floor(width / 8);
    const tilesHigh = Math.floor(height / 8);

    if (tileset === 'primary') {
      this.primarySize1 = { width, height, tilesWide, tilesHigh };
    } else {
      this.secondarySize1 = { width, height, tilesWide, tilesHigh };
    }
  }

  /**
   * Upload palettes for pair 1 (for multi-tileset worlds)
   */
  uploadPalettesPair1(palettes: Palette[]): void {
    const { gl } = this;

    if (!this.paletteTexture1) {
      throw new Error('Pair 1 palette texture not initialized');
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    const data = new Uint8Array(PALETTES_COUNT * COLORS_PER_PALETTE * 4);

    for (let paletteIdx = 0; paletteIdx < palettes.length && paletteIdx < PALETTES_COUNT; paletteIdx++) {
      const palette = palettes[paletteIdx];

      for (let colorIdx = 0; colorIdx < COLORS_PER_PALETTE; colorIdx++) {
        const offset = (paletteIdx * COLORS_PER_PALETTE + colorIdx) * 4;
        const hex = palette.colors[colorIdx] || '#000000';

        data[offset + 0] = parseInt(hex.slice(1, 3), 16);
        data[offset + 1] = parseInt(hex.slice(3, 5), 16);
        data[offset + 2] = parseInt(hex.slice(5, 7), 16);
        data[offset + 3] = colorIdx === 0 ? 0 : 255;
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      COLORS_PER_PALETTE,
      PALETTES_COUNT,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /**
   * Update a region of the tileset (for animations)
   *
   * This is the key to efficient animation: instead of re-uploading
   * the entire tileset, we update only the animated tiles.
   *
   * @param tileset - Which tileset
   * @param data - Indexed color data for the region
   * @param x - X offset in pixels
   * @param y - Y offset in pixels
   * @param width - Region width in pixels
   * @param height - Region height in pixels
   */
  updateTilesetRegion(
    tileset: 'primary' | 'secondary',
    data: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const { gl } = this;
    const texture = tileset === 'primary' ? this.primaryTexture : this.secondaryTexture;

    if (!texture) {
      throw new Error('Texture not initialized');
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Partial texture update
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,              // Mip level
      x, y,           // Offset
      width, height,  // Dimensions
      gl.RED,
      gl.UNSIGNED_BYTE,
      data
    );
  }

  /**
   * Upload all palettes as RGBA texture
   *
   * Layout: 16 colors × 16 palettes = 16×16 RGBA texture
   *
   * @param palettes - Array of palettes (primary + secondary)
   */
  uploadPalettes(palettes: Palette[]): void {
    const { gl } = this;

    if (!this.paletteTexture) {
      throw new Error('Palette texture not initialized');
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // Create 16x16 RGBA data (16 palettes × 16 colors × 4 channels)
    const data = new Uint8Array(PALETTES_COUNT * COLORS_PER_PALETTE * 4);

    for (let paletteIdx = 0; paletteIdx < palettes.length && paletteIdx < PALETTES_COUNT; paletteIdx++) {
      const palette = palettes[paletteIdx];

      for (let colorIdx = 0; colorIdx < COLORS_PER_PALETTE; colorIdx++) {
        const offset = (paletteIdx * COLORS_PER_PALETTE + colorIdx) * 4;
        const hex = palette.colors[colorIdx] || '#000000';

        // Parse hex color
        data[offset + 0] = parseInt(hex.slice(1, 3), 16);  // R
        data[offset + 1] = parseInt(hex.slice(3, 5), 16);  // G
        data[offset + 2] = parseInt(hex.slice(5, 7), 16);  // B
        data[offset + 3] = colorIdx === 0 ? 0 : 255;       // A (index 0 = transparent)
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      COLORS_PER_PALETTE,  // 16 colors
      PALETTES_COUNT,       // 16 palettes
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /**
   * Update a single palette (for weather/time effects)
   *
   * @param paletteIndex - Which palette to update (0-15)
   * @param colors - Array of 16 hex color strings
   */
  updatePalette(paletteIndex: number, colors: string[]): void {
    const { gl } = this;

    if (!this.paletteTexture) {
      throw new Error('Palette texture not initialized');
    }

    const data = new Uint8Array(COLORS_PER_PALETTE * 4);
    for (let i = 0; i < COLORS_PER_PALETTE; i++) {
      const hex = colors[i] || '#000000';
      data[i * 4 + 0] = parseInt(hex.slice(1, 3), 16);
      data[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
      data[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
      data[i * 4 + 3] = i === 0 ? 0 : 255;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0, paletteIndex,  // Update one row (one palette)
      COLORS_PER_PALETTE, 1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    );
  }

  /**
   * Bind textures for rendering (both tileset pairs)
   *
   * Texture units layout:
   * - 0: Primary tileset (pair 0)
   * - 1: Secondary tileset (pair 0)
   * - 2: Palette (pair 0)
   * - 3: Primary tileset (pair 1)
   * - 4: Secondary tileset (pair 1)
   * - 5: Palette (pair 1)
   *
   * @param primaryUnit - Texture unit for primary tileset (pair 0)
   * @param secondaryUnit - Texture unit for secondary tileset (pair 0)
   * @param paletteUnit - Texture unit for palette (pair 0)
   */
  bindTextures(primaryUnit: number = 0, secondaryUnit: number = 1, paletteUnit: number = 2): void {
    const { gl } = this;

    // Bind pair 0 textures
    gl.activeTexture(gl.TEXTURE0 + primaryUnit);
    gl.bindTexture(gl.TEXTURE_2D, this.primaryTexture);

    gl.activeTexture(gl.TEXTURE0 + secondaryUnit);
    gl.bindTexture(gl.TEXTURE_2D, this.secondaryTexture);

    gl.activeTexture(gl.TEXTURE0 + paletteUnit);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);

    // Bind pair 1 textures (units 3, 4, 5)
    gl.activeTexture(gl.TEXTURE0 + 3);
    gl.bindTexture(gl.TEXTURE_2D, this.primaryTexture1);

    gl.activeTexture(gl.TEXTURE0 + 4);
    gl.bindTexture(gl.TEXTURE_2D, this.secondaryTexture1);

    gl.activeTexture(gl.TEXTURE0 + 5);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture1);
  }

  /**
   * Get tileset size in tiles for shader uniforms (pair 0)
   */
  getTilesetSize(tileset: 'primary' | 'secondary'): { tilesWide: number; tilesHigh: number } {
    const size = tileset === 'primary' ? this.primarySize : this.secondarySize;
    if (!size) {
      return { tilesWide: 16, tilesHigh: 64 }; // Default fallback
    }
    return { tilesWide: size.tilesWide, tilesHigh: size.tilesHigh };
  }

  /**
   * Get tileset size in tiles for shader uniforms (pair 1)
   */
  getTilesetSizePair1(tileset: 'primary' | 'secondary'): { tilesWide: number; tilesHigh: number } {
    const size = tileset === 'primary' ? this.primarySize1 : this.secondarySize1;
    if (!size) {
      return { tilesWide: 16, tilesHigh: 64 }; // Default fallback
    }
    return { tilesWide: size.tilesWide, tilesHigh: size.tilesHigh };
  }

  /**
   * Create a texture with default settings
   */
  private createTexture(): WebGLTexture {
    const { gl } = this;
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create texture');
    }
    return texture;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    const { gl } = this;

    // Dispose pair 0 textures
    if (this.primaryTexture) {
      gl.deleteTexture(this.primaryTexture);
      this.primaryTexture = null;
    }

    if (this.secondaryTexture) {
      gl.deleteTexture(this.secondaryTexture);
      this.secondaryTexture = null;
    }

    if (this.paletteTexture) {
      gl.deleteTexture(this.paletteTexture);
      this.paletteTexture = null;
    }

    // Dispose pair 1 textures
    if (this.primaryTexture1) {
      gl.deleteTexture(this.primaryTexture1);
      this.primaryTexture1 = null;
    }

    if (this.secondaryTexture1) {
      gl.deleteTexture(this.secondaryTexture1);
      this.secondaryTexture1 = null;
    }

    if (this.paletteTexture1) {
      gl.deleteTexture(this.paletteTexture1);
      this.paletteTexture1 = null;
    }

    this.primarySize = null;
    this.secondarySize = null;
  }
}
