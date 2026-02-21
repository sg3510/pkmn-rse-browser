/**
 * WebGLCompositor - Composites pass textures to screen or framebuffers
 *
 * Handles the final composition step where rendered pass textures
 * are combined with proper ordering and sub-pixel scrolling.
 *
 * The compositor uses a simple fullscreen quad shader that:
 * - Samples the pass texture
 * - Applies sub-pixel offset for smooth scrolling
 * - Blends with alpha for transparency
 */

import { WebGLShaders, COMPOSITE_VERTEX_SHADER, COMPOSITE_FRAGMENT_SHADER } from './WebGLShaders';
import type { ShaderProgram } from './types';
import { computeCompositeRegionUv } from './compositeRegionUv';

export class WebGLCompositor {
  private gl: WebGL2RenderingContext;
  private shaders: WebGLShaders;
  private program: ShaderProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;

  // Cached uniform locations
  private uniforms: {
    texture: WebGLUniformLocation | null;
    offset: WebGLUniformLocation | null;
    uvScale: WebGLUniformLocation | null;
    uvOffset: WebGLUniformLocation | null;
  } | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.shaders = new WebGLShaders();
  }

  /**
   * Initialize the compositor
   */
  initialize(): void {
    const { gl } = this;

    // Compile composite shader
    this.program = this.shaders.getOrCreateProgram(
      gl,
      'composite',
      COMPOSITE_VERTEX_SHADER,
      COMPOSITE_FRAGMENT_SHADER
    );

    // Cache uniform locations
    this.uniforms = {
      texture: this.shaders.getUniformLocation(gl, this.program, 'u_texture'),
      offset: this.shaders.getUniformLocation(gl, this.program, 'u_offset'),
      uvScale: this.shaders.getUniformLocation(gl, this.program, 'u_uvScale'),
      uvOffset: this.shaders.getUniformLocation(gl, this.program, 'u_uvOffset'),
    };

    // Create an empty VAO for fullscreen quad (uses gl_VertexID in shader)
    this.vao = gl.createVertexArray();
  }

  /**
   * Composite a pass texture to the screen
   *
   * @param passTexture - Texture from a rendered pass
   * @param viewportWidth - Target viewport width
   * @param viewportHeight - Target viewport height
   * @param offsetX - Sub-pixel X offset (0-1 range, normalized to clip space)
   * @param offsetY - Sub-pixel Y offset (0-1 range, normalized to clip space)
   * @param clearFirst - Whether to clear before compositing
   */
  compositeToScreen(
    passTexture: WebGLTexture,
    viewportWidth: number,
    viewportHeight: number,
    offsetX: number = 0,
    offsetY: number = 0,
    clearFirst: boolean = false
  ): void {
    const { gl } = this;

    if (!this.program || !this.uniforms) {
      throw new Error('Compositor not initialized');
    }

    // Bind to screen (null framebuffer)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, viewportWidth, viewportHeight);

    if (clearFirst) {
      gl.clearColor(0, 0, 0, 0); // transparent clear so layers below remain visible
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    this.drawFullscreenQuad(passTexture, offsetX, offsetY, 1, 1, 0, 0);
  }

  /**
   * Composite a cropped region of a pass texture to screen.
   *
   * This avoids CPU-side blits when pass textures include overscan tiles.
   */
  compositeRegionToScreen(
    passTexture: WebGLTexture,
    sourceWidth: number,
    sourceHeight: number,
    sourceX: number,
    sourceY: number,
    sourceRegionWidth: number,
    sourceRegionHeight: number,
    viewportWidth: number,
    viewportHeight: number,
    clearFirst: boolean = false
  ): void {
    const { gl } = this;

    if (!this.program || !this.uniforms) {
      throw new Error('Compositor not initialized');
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, viewportWidth, viewportHeight);

    if (clearFirst) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    const { uvScaleX, uvScaleY, uvOffsetX, uvOffsetY } = computeCompositeRegionUv(
      sourceWidth,
      sourceHeight,
      sourceX,
      sourceY,
      sourceRegionWidth,
      sourceRegionHeight
    );

    this.drawFullscreenQuad(passTexture, 0, 0, uvScaleX, uvScaleY, uvOffsetX, uvOffsetY);
  }

  /**
   * Composite a pass texture to another framebuffer
   *
   * @param passTexture - Source texture
   * @param targetFramebuffer - Target framebuffer
   * @param targetWidth - Target width
   * @param targetHeight - Target height
   * @param offsetX - Sub-pixel X offset
   * @param offsetY - Sub-pixel Y offset
   */
  compositeToFramebuffer(
    passTexture: WebGLTexture,
    targetFramebuffer: WebGLFramebuffer,
    targetWidth: number,
    targetHeight: number,
    offsetX: number = 0,
    offsetY: number = 0
  ): void {
    const { gl } = this;

    if (!this.program || !this.uniforms) {
      throw new Error('Compositor not initialized');
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.viewport(0, 0, targetWidth, targetHeight);

    this.drawFullscreenQuad(passTexture, offsetX, offsetY, 1, 1, 0, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Draw a fullscreen quad with the given texture
   */
  private drawFullscreenQuad(
    texture: WebGLTexture,
    offsetX: number,
    offsetY: number,
    uvScaleX: number,
    uvScaleY: number,
    uvOffsetX: number,
    uvOffsetY: number
  ): void {
    const { gl } = this;

    if (!this.program || !this.uniforms || !this.vao) {
      throw new Error('Compositor not initialized');
    }

    // Use shader
    gl.useProgram(this.program.program);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.uniforms.texture, 0);

    // Set offset (convert from pixels to clip space if needed)
    gl.uniform2f(this.uniforms.offset, offsetX, offsetY);
    gl.uniform2f(this.uniforms.uvScale, uvScaleX, uvScaleY);
    gl.uniform2f(this.uniforms.uvOffset, uvOffsetX, uvOffsetY);

    // Enable blending for transparent composition
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Bind VAO and draw
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  /**
   * Calculate sub-pixel offset from camera view
   *
   * Returns normalized clip-space offsets for smooth scrolling
   */
  calculateSubPixelOffset(
    cameraX: number,
    cameraY: number,
    viewportWidth: number,
    viewportHeight: number
  ): { offsetX: number; offsetY: number } {
    // Get fractional pixel offset
    const fracX = cameraX - Math.floor(cameraX);
    const fracY = cameraY - Math.floor(cameraY);

    // Convert to clip space (-1 to 1 range)
    // Each pixel is 2/viewportWidth in clip space
    const offsetX = -(fracX * 2) / viewportWidth;
    const offsetY = (fracY * 2) / viewportHeight;

    return { offsetX, offsetY };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    const { gl } = this;

    if (this.vao) {
      gl.deleteVertexArray(this.vao);
      this.vao = null;
    }

    this.shaders.dispose(gl);
    this.program = null;
    this.uniforms = null;
  }
}
