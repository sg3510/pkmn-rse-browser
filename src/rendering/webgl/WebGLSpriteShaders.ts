/**
 * WebGLSpriteShaders - Shader source for sprite rendering
 *
 * Unlike tile shaders which use indexed color + palette lookup,
 * sprite shaders use direct RGBA textures (pre-processed from PNGs).
 *
 * Features:
 * - Instanced quad rendering for batching
 * - Horizontal/vertical flip support
 * - Per-sprite tint and alpha for reflections
 * - Optional shimmer effect (X-scale for water reflections)
 */

/**
 * Sprite vertex shader source
 *
 * Handles:
 * - Instanced quad rendering
 * - Sprite flipping (xflip, yflip)
 * - Position from screen coordinates
 *
 * NOTE: Shimmer is NOT done in vertex shader! GBA shimmer requires
 * per-pixel inverse affine transform in fragment shader for accuracy.
 * See SPRITE_REFLECTION_FRAGMENT_SHADER for pixel-perfect shimmer.
 */
export const SPRITE_VERTEX_SHADER = `#version 300 es
precision highp float;

// Per-vertex attributes (quad corners: 0,0 -> 1,1)
in vec2 a_position;

// Per-instance attributes
in vec4 a_spriteRect;    // x, y, width, height (screen coordinates)
in vec4 a_atlasRect;     // x, y, width, height (normalized atlas coordinates 0-1)
in vec4 a_colorMod;      // r, g, b, a (tint color and alpha)
in float a_flags;        // packed flags: bit 0 = flipX, bit 1 = flipY
in float a_shimmerScale; // shimmer X-scale for water reflections (1.0 = no shimmer)
in float a_rotationDeg;  // clockwise rotation in degrees around sprite center
in vec2 a_scale;         // centered sprite scale (1,1 = no scale)

// Uniforms
uniform vec2 u_viewportSize;

// Outputs to fragment shader
out vec2 v_texCoord;
out vec4 v_colorMod;
out vec2 v_atlasRegion;      // Pass atlas region for shimmer calculations
out vec2 v_atlasRegionSize;  // Pass atlas region size for shimmer calculations
out float v_shimmerScale;    // Per-instance shimmer scale

void main() {
  // Unpack flags
  float flagsVal = floor(a_flags);
  bool flipX = mod(flagsVal, 2.0) > 0.5;
  bool flipY = mod(floor(flagsVal / 2.0), 2.0) > 0.5;

  // Calculate screen position with optional centered scale + rotation.
  // Defaults are a_scale=(1,1), a_rotationDeg=0.
  vec2 localPos = a_position * a_spriteRect.zw;
  vec2 halfSize = a_spriteRect.zw * 0.5;
  vec2 centeredLocal = localPos - halfSize;
  vec2 scaledLocal = vec2(
    centeredLocal.x * a_scale.x,
    centeredLocal.y * a_scale.y
  );

  float rotationRad = radians(a_rotationDeg);
  float sinR = sin(rotationRad);
  float cosR = cos(rotationRad);
  vec2 rotatedLocal = vec2(
    scaledLocal.x * cosR - scaledLocal.y * sinR,
    scaledLocal.x * sinR + scaledLocal.y * cosR
  );

  vec2 screenPos = a_spriteRect.xy + halfSize + rotatedLocal;

  // Convert to clip space (-1 to 1)
  vec2 clipPos = (screenPos / u_viewportSize) * 2.0 - 1.0;
  clipPos.y = -clipPos.y;  // Flip Y for screen coordinates

  gl_Position = vec4(clipPos, 0.0, 1.0);

  // Calculate texture coordinates with flip
  vec2 texLocalPos = a_position;
  if (flipX) texLocalPos.x = 1.0 - texLocalPos.x;
  if (flipY) texLocalPos.y = 1.0 - texLocalPos.y;

  // Map to atlas region
  v_texCoord = a_atlasRect.xy + texLocalPos * a_atlasRect.zw;

  // Pass through for fragment shader
  v_colorMod = a_colorMod;
  v_atlasRegion = a_atlasRect.xy;
  v_atlasRegionSize = a_atlasRect.zw;
  v_shimmerScale = a_shimmerScale;
}
`;

/**
 * Sprite fragment shader source
 *
 * Handles:
 * - RGBA texture sampling (direct color, no palette lookup)
 * - Transparency discard
 * - Tint application (multiply RGB)
 * - Alpha blending
 */
export const SPRITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Inputs from vertex shader (must match vertex shader outputs)
in vec2 v_texCoord;
in vec4 v_colorMod;
in vec2 v_atlasRegion;      // Unused in normal shader, but must match vertex output
in vec2 v_atlasRegionSize;  // Unused in normal shader, but must match vertex output
in float v_shimmerScale;    // Unused in normal shader, but must match vertex output

// Texture samplers
uniform sampler2D u_spriteAtlas;

// Output
out vec4 fragColor;

void main() {
  // Sample sprite texture
  vec4 texColor = texture(u_spriteAtlas, v_texCoord);

  // Discard transparent pixels
  if (texColor.a < 0.01) {
    discard;
  }

  // Apply tint (multiply RGB) and alpha
  // For normal sprites: colorMod = (1,1,1,1)
  // For reflections: colorMod = (tintR, tintG, tintB, alpha)
  fragColor = vec4(texColor.rgb * v_colorMod.rgb, texColor.a * v_colorMod.a);
}
`;

/**
 * Reflection fragment shader source (for Phase 4)
 *
 * PIXEL-PERFECT GBA SHIMMER + WATER MASKING
 *
 * This shader replicates GBA behavior exactly:
 * 1. Per-pixel inverse affine transform for shimmer (NOT vertex scaling!)
 * 2. Nearest-neighbor sampling via texelFetch() (NOT texture() interpolation!)
 * 3. Water mask sampling to replicate BG1 overlay occlusion
 *
 * Reference: src/field/ReflectionShimmer.ts::applyGbaAffineShimmer()
 * The fragment shader math MUST match the CPU implementation exactly.
 */
export const SPRITE_REFLECTION_FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Inputs from vertex shader
in vec2 v_texCoord;
in vec4 v_colorMod;
in vec2 v_atlasRegion;      // Atlas region origin (normalized 0-1)
in vec2 v_atlasRegionSize;  // Atlas region size (normalized 0-1)
in float v_shimmerScale;    // Per-instance shimmer scale (1.0 = no shimmer)

// Texture samplers
uniform sampler2D u_spriteAtlas;
uniform sampler2D u_waterMask;  // R8 texture: water=1.0, ground=0.0

// Atlas dimensions for texelFetch
uniform ivec2 u_atlasSize;

// Viewport size for screen-space water mask sampling
uniform vec2 u_viewportSize;

// Output
out vec4 fragColor;

void main() {
  // ========== GBA-ACCURATE SHIMMER + NEAREST-NEIGHBOR SAMPLING ==========
  // Get sprite dimensions in pixels
  ivec2 atlasSize = u_atlasSize;
  ivec2 spriteStart = ivec2(floor(v_atlasRegion * vec2(atlasSize)));
  ivec2 spriteSize = ivec2(floor(v_atlasRegionSize * vec2(atlasSize)));

  // Convert current texcoord to LOCAL sprite pixel coordinate (0 to spriteSize-1)
  vec2 localTexCoord = (v_texCoord - v_atlasRegion) / v_atlasRegionSize;
  int dstX = int(floor(localTexCoord.x * float(spriteSize.x)));
  int dstY = int(floor(localTexCoord.y * float(spriteSize.y)));

  // Apply GBA shimmer transform (X-axis only, centered)
  float centerX = float(spriteSize.x) / 2.0;
  float invScale = 1.0 / v_shimmerScale;
  int srcX = int(floor(centerX + (float(dstX) - centerX) * invScale));
  int srcY = dstY;

  // Bounds check
  if (srcX < 0 || srcX >= spriteSize.x) {
    discard;
  }

  // texelFetch for nearest-neighbor sampling
  ivec2 texelCoord = spriteStart + ivec2(srcX, srcY);
  vec4 texColor = texelFetch(u_spriteAtlas, texelCoord, 0);

  // Discard transparent pixels
  if (texColor.a < 0.01) {
    discard;
  }

  // ========== WATER MASK SAMPLING ==========
  // Sample the water mask texture in screen space.
  // gl_FragCoord is in screen pixels (origin bottom-left).
  // The mask is viewport-sized, so UV = fragCoord / viewportSize.
  // Y-flip is already handled in buildWaterMaskFromView().
  vec2 maskUV = gl_FragCoord.xy / u_viewportSize;
  float maskVal = texture(u_waterMask, maskUV).r;

  // Discard pixels that are NOT on reflective tiles (mask = 0)
  // This prevents reflections from appearing on non-reflective tiles like grass
  if (maskVal < 0.5) {
    discard;
  }

  // ========== OUTPUT ==========
  fragColor = vec4(texColor.rgb * v_colorMod.rgb, texColor.a * v_colorMod.a);
}
`;
