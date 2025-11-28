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
 * Manages three textures:
 * - Primary tileset (indexed color, R8)
 * - Secondary tileset (indexed color, R8)
 * - Palette lookup (RGBA 16x16)
 */
export class WebGLTextureManager {
  private gl: WebGL2RenderingContext;
  private primaryTexture: WebGLTexture | null = null;
  private secondaryTexture: WebGLTexture | null = null;
  private paletteTexture: WebGLTexture | null = null;

  // Track texture dimensions for shader uniforms
  private primarySize: { width: number; height: number; tilesWide: number; tilesHigh: number } | null = null;
  private secondarySize: { width: number; height: number; tilesWide: number; tilesHigh: number } | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Initialize textures
   */
  initialize(): void {
    this.primaryTexture = this.createTexture();
    this.secondaryTexture = this.createTexture();
    this.paletteTexture = this.createTexture();
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
   * Bind textures for rendering
   *
   * @param primaryUnit - Texture unit for primary tileset
   * @param secondaryUnit - Texture unit for secondary tileset
   * @param paletteUnit - Texture unit for palette
   */
  bindTextures(primaryUnit: number = 0, secondaryUnit: number = 1, paletteUnit: number = 2): void {
    const { gl } = this;

    // Bind primary tileset
    gl.activeTexture(gl.TEXTURE0 + primaryUnit);
    gl.bindTexture(gl.TEXTURE_2D, this.primaryTexture);

    // Bind secondary tileset
    gl.activeTexture(gl.TEXTURE0 + secondaryUnit);
    gl.bindTexture(gl.TEXTURE_2D, this.secondaryTexture);

    // Bind palette
    gl.activeTexture(gl.TEXTURE0 + paletteUnit);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);
  }

  /**
   * Get tileset size in tiles for shader uniforms
   */
  getTilesetSize(tileset: 'primary' | 'secondary'): { tilesWide: number; tilesHigh: number } {
    const size = tileset === 'primary' ? this.primarySize : this.secondarySize;
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

    this.primarySize = null;
    this.secondarySize = null;
  }
}
