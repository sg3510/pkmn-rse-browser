/**
 * WebGL-specific types for the tile renderer
 */

/**
 * WebGL capabilities detected at runtime
 */
export interface WebGLCapabilities {
  /** WebGL2 is available */
  webgl2: boolean;
  /** Maximum texture size in pixels */
  maxTextureSize: number;
  /** Maximum texture units available */
  maxTextureUnits: number;
  /** Instanced arrays supported (WebGL1 requires extension) */
  instancedArrays: boolean;
  /** Float textures supported */
  floatTextures: boolean;
  /** Vertex array objects supported */
  vertexArrayObjects: boolean;
}

/**
 * WebGL extensions that may be available
 */
export interface WebGLExtensions {
  /** ANGLE_instanced_arrays for WebGL1 */
  instancedArrays?: ANGLE_instanced_arrays | null;
  /** OES_vertex_array_object for WebGL1 */
  vertexArrayObject?: OES_vertex_array_object | null;
}

/**
 * Tile instance data for WebGL instanced rendering
 */
export interface TileInstance {
  /** Screen X position (pixels) */
  x: number;
  /** Screen Y position (pixels) */
  y: number;
  /** Tile ID in tileset (0-511 primary, 0-511 secondary after offset) */
  tileId: number;
  /** Palette index (0-15) */
  paletteId: number;
  /** Horizontal flip */
  xflip: boolean;
  /** Vertical flip */
  yflip: boolean;
  /** Which tileset (0 = primary, 1 = secondary) */
  tilesetIndex: number;
  /** Which tileset pair (0 or 1) for multi-tileset worlds */
  tilesetPairIndex: number;
}

/**
 * Packed tile instance for GPU upload (16 bytes per instance)
 * Float32 x 4 = 16 bytes
 */
export interface PackedTileInstance {
  /** Screen X position */
  x: number;
  /** Screen Y position */
  y: number;
  /** Tile index in tileset */
  tileId: number;
  /** Packed flags: tilesetPairIndex (1 bit) | paletteId (4 bits) | tilesetIndex (1 bit) | xflip (1 bit) | yflip (1 bit) */
  flags: number;
}

/**
 * Pack tile instance data into GPU format
 * Flags layout: bit 0: yflip, bit 1: xflip, bit 2: tilesetIndex, bits 3-6: paletteId, bit 7: tilesetPairIndex
 */
export function packTileInstance(tile: TileInstance): PackedTileInstance {
  const flags =
    (tile.yflip ? 1 : 0) |
    (tile.xflip ? 2 : 0) |
    (tile.tilesetIndex << 2) |
    (tile.paletteId << 3) |
    ((tile.tilesetPairIndex ?? 0) << 7);

  return {
    x: tile.x,
    y: tile.y,
    tileId: tile.tileId,
    flags,
  };
}

/**
 * Uniform locations for the tile shader
 */
export interface TileShaderUniforms {
  viewportSize: WebGLUniformLocation | null;
  scrollOffset: WebGLUniformLocation | null;
  primaryTilesetSize: WebGLUniformLocation | null;
  secondaryTilesetSize: WebGLUniformLocation | null;
  primaryTileset: WebGLUniformLocation | null;
  secondaryTileset: WebGLUniformLocation | null;
  palette: WebGLUniformLocation | null;
}

/**
 * Attribute locations for the tile shader
 */
export interface TileShaderAttributes {
  position: number;
  instanceData: number;
}

/**
 * Uniform locations for the composite shader
 */
export interface CompositeShaderUniforms {
  texture: WebGLUniformLocation | null;
  offset: WebGLUniformLocation | null;
}

/**
 * Shader program with cached locations
 */
export interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
  attributes: Map<string, number>;
}
