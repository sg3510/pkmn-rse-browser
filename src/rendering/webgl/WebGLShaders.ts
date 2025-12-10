/**
 * WebGLShaders - Shader compilation and management
 *
 * Handles:
 * - Shader source code storage
 * - Compilation with error reporting
 * - Program linking
 * - Uniform/attribute location caching
 */

import type { ShaderProgram } from './types';

/**
 * Tile vertex shader source
 *
 * Handles:
 * - Instanced quad rendering
 * - Tile flipping via texture coordinate manipulation
 * - Sub-pixel scrolling
 */
export const TILE_VERTEX_SHADER = `#version 300 es
precision highp float;

// Per-vertex attributes (the quad corners)
in vec2 a_position;  // (0,0), (1,0), (0,1), (1,1)

// Per-instance attributes
in vec4 a_instanceData;  // x, y, tileId, flags

// Uniforms
uniform vec2 u_viewportSize;    // Viewport in pixels
uniform vec2 u_scrollOffset;    // Sub-pixel scroll offset
uniform vec2 u_primaryTilesetSize;   // Primary tileset dimensions in tiles (pair 0)
uniform vec2 u_secondaryTilesetSize; // Secondary tileset dimensions in tiles (pair 0)
uniform vec2 u_primaryTilesetSize1;  // Primary tileset dimensions in tiles (pair 1)
uniform vec2 u_secondaryTilesetSize1; // Secondary tileset dimensions in tiles (pair 1)
uniform vec2 u_primaryTilesetSize2;  // Primary tileset dimensions in tiles (pair 2)
uniform vec2 u_secondaryTilesetSize2; // Secondary tileset dimensions in tiles (pair 2)

// Outputs to fragment shader
out vec2 v_texCoord;           // UV for pair 0 primary
out vec2 v_texCoordSecondary;  // UV for pair 0 secondary
out vec2 v_texCoord1;          // UV for pair 1 primary
out vec2 v_texCoordSecondary1; // UV for pair 1 secondary
out vec2 v_texCoord2;          // UV for pair 2 primary
out vec2 v_texCoordSecondary2; // UV for pair 2 secondary
out float v_paletteIndex;  // Using float to avoid flat int issues on some GPUs
out float v_tilesetIndex;
out float v_tilesetPairIndex;  // Which tileset pair (0, 1, or 2) for multi-tileset worlds

// Constants
const float TILE_SIZE = 8.0;

void main() {
  // Unpack instance data
  float screenX = a_instanceData.x;
  float screenY = a_instanceData.y;
  float tileId = a_instanceData.z;
  float flags = a_instanceData.w;

  // Decode flags (using float math to avoid integer issues)
  // Flags layout: bit 0: yflip, bit 1: xflip, bit 2: tilesetIndex, bits 3-6: paletteId, bits 7-8: tilesetPairIndex (0-3)
  float flagsVal = floor(flags);
  float yflipVal = mod(flagsVal, 2.0);
  float xflipVal = mod(floor(flagsVal / 2.0), 2.0);
  v_tilesetIndex = mod(floor(flagsVal / 4.0), 2.0);
  v_paletteIndex = mod(floor(flagsVal / 8.0), 16.0);  // 4 bits for paletteId (0-15)
  v_tilesetPairIndex = mod(floor(flagsVal / 128.0), 4.0);  // bits 7-8 for tilesetPairIndex (0-3)

  bool yflip = yflipVal > 0.5;
  bool xflip = xflipVal > 0.5;

  // Calculate vertex position
  vec2 vertexOffset = a_position * TILE_SIZE;
  vec2 worldPos = vec2(screenX, screenY) + vertexOffset - u_scrollOffset;

  // Convert to clip space (-1 to 1)
  vec2 clipPos = (worldPos / u_viewportSize) * 2.0 - 1.0;
  clipPos.y = -clipPos.y;  // Flip Y for screen coordinates

  gl_Position = vec4(clipPos, 0.0, 1.0);

  // Apply flip by modifying texture coordinate calculation
  vec2 localCoord = a_position;
  if (xflip) localCoord.x = 1.0 - localCoord.x;
  if (yflip) localCoord.y = 1.0 - localCoord.y;

  // Calculate texture coordinates for PRIMARY tileset (sample texel centers)
  float primaryTilesPerRow = u_primaryTilesetSize.x;
  float primaryTileX = mod(tileId, primaryTilesPerRow);
  float primaryTileY = floor(tileId / primaryTilesPerRow);
  vec2 primaryTileOrigin = vec2(primaryTileX, primaryTileY) / u_primaryTilesetSize;
  vec2 primaryTexelSize = vec2(1.0) / (u_primaryTilesetSize * TILE_SIZE);
  vec2 primaryOffset = (localCoord * (TILE_SIZE - 1.0) + 0.5) * primaryTexelSize;
  v_texCoord = primaryTileOrigin + primaryOffset;

  // Calculate texture coordinates for SECONDARY tileset pair 0 (sample texel centers)
  float secondaryTilesPerRow = u_secondaryTilesetSize.x;
  float secondaryTileX = mod(tileId, secondaryTilesPerRow);
  float secondaryTileY = floor(tileId / secondaryTilesPerRow);
  vec2 secondaryTileOrigin = vec2(secondaryTileX, secondaryTileY) / u_secondaryTilesetSize;
  vec2 secondaryTexelSize = vec2(1.0) / (u_secondaryTilesetSize * TILE_SIZE);
  vec2 secondaryOffset = (localCoord * (TILE_SIZE - 1.0) + 0.5) * secondaryTexelSize;
  v_texCoordSecondary = secondaryTileOrigin + secondaryOffset;

  // Calculate texture coordinates for PRIMARY tileset pair 1
  float primaryTilesPerRow1 = u_primaryTilesetSize1.x;
  float primaryTileX1 = mod(tileId, primaryTilesPerRow1);
  float primaryTileY1 = floor(tileId / primaryTilesPerRow1);
  vec2 primaryTileOrigin1 = vec2(primaryTileX1, primaryTileY1) / u_primaryTilesetSize1;
  vec2 primaryTexelSize1 = vec2(1.0) / (u_primaryTilesetSize1 * TILE_SIZE);
  vec2 primaryOffset1 = (localCoord * (TILE_SIZE - 1.0) + 0.5) * primaryTexelSize1;
  v_texCoord1 = primaryTileOrigin1 + primaryOffset1;

  // Calculate texture coordinates for SECONDARY tileset pair 1
  float secondaryTilesPerRow1 = u_secondaryTilesetSize1.x;
  float secondaryTileX1 = mod(tileId, secondaryTilesPerRow1);
  float secondaryTileY1 = floor(tileId / secondaryTilesPerRow1);
  vec2 secondaryTileOrigin1 = vec2(secondaryTileX1, secondaryTileY1) / u_secondaryTilesetSize1;
  vec2 secondaryTexelSize1 = vec2(1.0) / (u_secondaryTilesetSize1 * TILE_SIZE);
  vec2 secondaryOffset1 = (localCoord * (TILE_SIZE - 1.0) + 0.5) * secondaryTexelSize1;
  v_texCoordSecondary1 = secondaryTileOrigin1 + secondaryOffset1;

  // Calculate texture coordinates for PRIMARY tileset pair 2
  float primaryTilesPerRow2 = u_primaryTilesetSize2.x;
  float primaryTileX2 = mod(tileId, primaryTilesPerRow2);
  float primaryTileY2 = floor(tileId / primaryTilesPerRow2);
  vec2 primaryTileOrigin2 = vec2(primaryTileX2, primaryTileY2) / u_primaryTilesetSize2;
  vec2 primaryTexelSize2 = vec2(1.0) / (u_primaryTilesetSize2 * TILE_SIZE);
  vec2 primaryOffset2 = (localCoord * (TILE_SIZE - 1.0) + 0.5) * primaryTexelSize2;
  v_texCoord2 = primaryTileOrigin2 + primaryOffset2;

  // Calculate texture coordinates for SECONDARY tileset pair 2
  float secondaryTilesPerRow2 = u_secondaryTilesetSize2.x;
  float secondaryTileX2 = mod(tileId, secondaryTilesPerRow2);
  float secondaryTileY2 = floor(tileId / secondaryTilesPerRow2);
  vec2 secondaryTileOrigin2 = vec2(secondaryTileX2, secondaryTileY2) / u_secondaryTilesetSize2;
  vec2 secondaryTexelSize2 = vec2(1.0) / (u_secondaryTilesetSize2 * TILE_SIZE);
  vec2 secondaryOffset2 = (localCoord * (TILE_SIZE - 1.0) + 0.5) * secondaryTexelSize2;
  v_texCoordSecondary2 = secondaryTileOrigin2 + secondaryOffset2;
}
`;

/**
 * Tile fragment shader source
 *
 * Handles:
 * - Indexed color lookup from tileset texture
 * - Palette lookup from palette texture
 * - Transparency handling (palette index 0)
 * - Primary/secondary tileset selection
 * - Multi-tileset pair support for seamless world rendering
 */
export const TILE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Inputs from vertex shader
in vec2 v_texCoord;           // UV for pair 0 primary
in vec2 v_texCoordSecondary;  // UV for pair 0 secondary
in vec2 v_texCoord1;          // UV for pair 1 primary
in vec2 v_texCoordSecondary1; // UV for pair 1 secondary
in vec2 v_texCoord2;          // UV for pair 2 primary
in vec2 v_texCoordSecondary2; // UV for pair 2 secondary
in float v_paletteIndex;
in float v_tilesetIndex;
in float v_tilesetPairIndex;  // Which tileset pair (0, 1, or 2)

// Tileset pair 0 textures
uniform sampler2D u_primaryTileset;    // Indexed color (R = palette index)
uniform sampler2D u_secondaryTileset;  // Indexed color (R = palette index)
uniform sampler2D u_palette;           // 16x16 RGBA (16 palettes x 16 colors)

// Tileset pair 1 textures (for multi-tileset worlds)
uniform sampler2D u_primaryTileset1;
uniform sampler2D u_secondaryTileset1;
uniform sampler2D u_palette1;

// Tileset pair 2 textures (for multi-tileset worlds)
uniform sampler2D u_primaryTileset2;
uniform sampler2D u_secondaryTileset2;
uniform sampler2D u_palette2;

// Output
out vec4 fragColor;

void main() {
  // Sample the appropriate tileset based on pair index and tileset index
  // Use the correct UV coordinates for each tileset pair
  float paletteColorIndex;

  if (v_tilesetPairIndex < 0.5) {
    // Tileset pair 0 - use v_texCoord and v_texCoordSecondary
    if (v_tilesetIndex < 0.5) {
      paletteColorIndex = texture(u_primaryTileset, v_texCoord).r * 255.0;
    } else {
      paletteColorIndex = texture(u_secondaryTileset, v_texCoordSecondary).r * 255.0;
    }
  } else if (v_tilesetPairIndex < 1.5) {
    // Tileset pair 1 - use v_texCoord1 and v_texCoordSecondary1
    if (v_tilesetIndex < 0.5) {
      paletteColorIndex = texture(u_primaryTileset1, v_texCoord1).r * 255.0;
    } else {
      paletteColorIndex = texture(u_secondaryTileset1, v_texCoordSecondary1).r * 255.0;
    }
  } else {
    // Tileset pair 2 - use v_texCoord2 and v_texCoordSecondary2
    if (v_tilesetIndex < 0.5) {
      paletteColorIndex = texture(u_primaryTileset2, v_texCoord2).r * 255.0;
    } else {
      paletteColorIndex = texture(u_secondaryTileset2, v_texCoordSecondary2).r * 255.0;
    }
  }

  // Transparency check (palette index 0 = transparent)
  if (paletteColorIndex < 0.5) {
    discard;
  }

  // Look up color from palette texture (selecting correct pair)
  // Palette texture layout: 16 colors wide x 16 palettes tall
  vec2 paletteCoord = vec2(
    (paletteColorIndex + 0.5) / 16.0,   // Color index (X)
    (v_paletteIndex + 0.5) / 16.0       // Palette index (Y)
  );

  if (v_tilesetPairIndex < 0.5) {
    fragColor = texture(u_palette, paletteCoord);
  } else if (v_tilesetPairIndex < 1.5) {
    fragColor = texture(u_palette1, paletteCoord);
  } else {
    fragColor = texture(u_palette2, paletteCoord);
  }
}
`;

/**
 * Composite vertex shader source
 *
 * Simple fullscreen quad with sub-pixel offset support
 */
export const COMPOSITE_VERTEX_SHADER = `#version 300 es
precision highp float;

uniform vec2 u_offset;
out vec2 v_texCoord;

void main() {
  // Fullscreen quad positions: (-1,-1), (1,-1), (-1,1), (1,1)
  vec2 positions[4] = vec2[4](
    vec2(-1.0, -1.0),
    vec2(1.0, -1.0),
    vec2(-1.0, 1.0),
    vec2(1.0, 1.0)
  );
  vec2 pos = positions[gl_VertexID];

  // Apply sub-pixel offset
  gl_Position = vec4(pos + u_offset, 0.0, 1.0);

  // Texture coordinates (0,0) to (1,1)
  // Note: No Y-flip needed here because the tile shader already flips Y
  // when rendering to the framebuffer, so the texture is in screen orientation
  v_texCoord = pos * 0.5 + 0.5;
}
`;

/**
 * Composite fragment shader source
 *
 * Simple texture sampling for pass compositing
 */
export const COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
out vec4 fragColor;

void main() {
  fragColor = texture(u_texture, v_texCoord);
}
`;

/**
 * Simple textured quad vertex shader (for testing)
 */
export const SIMPLE_QUAD_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

uniform vec2 u_viewportSize;
uniform vec2 u_quadPos;
uniform vec2 u_quadSize;

out vec2 v_texCoord;

void main() {
  // Calculate screen position
  vec2 screenPos = u_quadPos + a_position * u_quadSize;

  // Convert to clip space
  vec2 clipPos = (screenPos / u_viewportSize) * 2.0 - 1.0;
  clipPos.y = -clipPos.y;

  gl_Position = vec4(clipPos, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

/**
 * Simple textured quad fragment shader (for testing)
 */
export const SIMPLE_QUAD_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
out vec4 fragColor;

void main() {
  fragColor = texture(u_texture, v_texCoord);
}
`;

/**
 * Shader compilation and caching manager
 */
export class WebGLShaders {
  private programs: Map<string, ShaderProgram> = new Map();

  /**
   * Get or create a shader program
   *
   * @param gl - WebGL2 context
   * @param name - Unique name for caching
   * @param vertSrc - Vertex shader source
   * @param fragSrc - Fragment shader source
   * @returns Compiled and linked shader program
   */
  getOrCreateProgram(
    gl: WebGL2RenderingContext,
    name: string,
    vertSrc: string,
    fragSrc: string
  ): ShaderProgram {
    const cached = this.programs.get(name);
    if (cached) {
      return cached;
    }

    const program = this.compileProgram(gl, name, vertSrc, fragSrc);
    const shaderProgram: ShaderProgram = {
      program,
      uniforms: new Map(),
      attributes: new Map(),
    };

    this.programs.set(name, shaderProgram);
    return shaderProgram;
  }

  /**
   * Get a cached program by name
   */
  getProgram(name: string): ShaderProgram | undefined {
    return this.programs.get(name);
  }

  /**
   * Get uniform location (with caching)
   */
  getUniformLocation(
    gl: WebGL2RenderingContext,
    shaderProgram: ShaderProgram,
    name: string
  ): WebGLUniformLocation | null {
    const cached = shaderProgram.uniforms.get(name);
    if (cached !== undefined) {
      return cached;
    }

    const location = gl.getUniformLocation(shaderProgram.program, name);
    shaderProgram.uniforms.set(name, location);
    return location;
  }

  /**
   * Get attribute location (with caching)
   */
  getAttributeLocation(
    gl: WebGL2RenderingContext,
    shaderProgram: ShaderProgram,
    name: string
  ): number {
    const cached = shaderProgram.attributes.get(name);
    if (cached !== undefined) {
      return cached;
    }

    const location = gl.getAttribLocation(shaderProgram.program, name);
    shaderProgram.attributes.set(name, location);
    return location;
  }

  /**
   * Clean up all shader programs
   */
  dispose(gl: WebGL2RenderingContext): void {
    for (const shaderProgram of this.programs.values()) {
      gl.deleteProgram(shaderProgram.program);
    }
    this.programs.clear();
  }

  /**
   * Compile a shader program
   */
  private compileProgram(
    gl: WebGL2RenderingContext,
    name: string,
    vertSrc: string,
    fragSrc: string
  ): WebGLProgram {
    const vertShader = this.compileShader(gl, gl.VERTEX_SHADER, vertSrc, `${name}.vert`);
    const fragShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragSrc, `${name}.frag`);

    const program = gl.createProgram();
    if (!program) {
      throw new Error(`Failed to create shader program: ${name}`);
    }

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    // Check link status
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      throw new Error(`Shader program link failed [${name}]: ${info}`);
    }

    // Shaders can be deleted after linking
    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);

    return program;
  }

  /**
   * Compile a single shader
   */
  private compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string,
    name: string
  ): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error(`Failed to create shader: ${name} (createShader returned null)`);
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    // Check compile status
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      const glError = gl.getError();
      gl.deleteShader(shader);

      // Provide more debugging information
      const errorDetails = [
        `Shader: ${name}`,
        `Type: ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'}`,
        `Info log: ${info || '(empty)'}`,
        `GL error: ${glError}`,
        `Source lines: ${source.split('\n').length}`,
      ].join('\n');

      console.error('Shader compilation failed:\n' + errorDetails);
      console.error('Shader source:\n' + source);

      throw new Error(`Shader compilation failed [${name}]: ${info || 'no info available'}`);
    }

    return shader;
  }
}
