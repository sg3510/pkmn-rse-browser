/**
 * WebGLQuadRenderer - Basic textured quad rendering
 *
 * This is a simple test renderer to verify WebGL setup is working.
 * It renders a single textured quad at a given position and size.
 *
 * Used for:
 * - Testing WebGL context initialization
 * - Testing shader compilation
 * - Testing texture uploading
 * - Verifying coordinate system and pixel-perfect rendering
 */

import { WebGLContext } from './WebGLContext';
import {
  WebGLShaders,
  SIMPLE_QUAD_VERTEX_SHADER,
  SIMPLE_QUAD_FRAGMENT_SHADER,
} from './WebGLShaders';
import type { ShaderProgram } from './types';

/**
 * Simple quad renderer for testing WebGL setup
 */
export class WebGLQuadRenderer {
  private glContext: WebGLContext;
  private shaders: WebGLShaders;
  private shaderProgram: ShaderProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private testTexture: WebGLTexture | null = null;

  constructor(glContext: WebGLContext) {
    this.glContext = glContext;
    this.shaders = new WebGLShaders();
  }

  /**
   * Initialize the quad renderer
   *
   * Creates shader program, buffers, and VAO
   */
  initialize(): void {
    const gl = this.glContext.getGL();

    // Compile shader program
    this.shaderProgram = this.shaders.getOrCreateProgram(
      gl,
      'simpleQuad',
      SIMPLE_QUAD_VERTEX_SHADER,
      SIMPLE_QUAD_FRAGMENT_SHADER
    );

    // Create VAO
    this.vao = gl.createVertexArray();
    if (!this.vao) {
      throw new Error('Failed to create VAO');
    }

    gl.bindVertexArray(this.vao);

    // Create position buffer (unit quad: 0,0 to 1,1)
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0, 0, // Bottom-left
        1, 0, // Bottom-right
        0, 1, // Top-left
        1, 1, // Top-right
      ]),
      gl.STATIC_DRAW
    );

    const positionLoc = this.shaders.getAttributeLocation(gl, this.shaderProgram, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Create texture coordinate buffer
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0, 1, // Bottom-left (note: Y flipped for texture)
        1, 1, // Bottom-right
        0, 0, // Top-left
        1, 0, // Top-right
      ]),
      gl.STATIC_DRAW
    );

    const texCoordLoc = this.shaders.getAttributeLocation(gl, this.shaderProgram, 'a_texCoord');
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  /**
   * Create a test pattern texture
   *
   * Creates a simple checkerboard pattern for testing
   */
  createTestTexture(width: number = 16, height: number = 16): WebGLTexture {
    const gl = this.glContext.getGL();

    // Create checkerboard pattern
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const isWhite = (x + y) % 2 === 0;
        data[i] = isWhite ? 255 : 0; // R
        data[i + 1] = isWhite ? 255 : 0; // G
        data[i + 2] = isWhite ? 255 : 0; // B
        data[i + 3] = 255; // A
      }
    }

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create texture');
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    );

    // NEAREST filtering for pixel-perfect rendering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.testTexture = texture;
    return texture;
  }

  /**
   * Upload an image as a texture
   *
   * @param image - Image to upload
   * @returns WebGL texture
   */
  uploadTexture(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap): WebGLTexture {
    const gl = this.glContext.getGL();

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create texture');
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image
    );

    // NEAREST filtering for pixel-perfect rendering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return texture;
  }

  /**
   * Draw a textured quad
   *
   * @param texture - Texture to draw
   * @param x - X position in pixels
   * @param y - Y position in pixels
   * @param width - Width in pixels
   * @param height - Height in pixels
   * @param viewportWidth - Viewport width for coordinate conversion
   * @param viewportHeight - Viewport height for coordinate conversion
   */
  drawQuad(
    texture: WebGLTexture,
    x: number,
    y: number,
    width: number,
    height: number,
    viewportWidth: number,
    viewportHeight: number
  ): void {
    const gl = this.glContext.getGL();

    if (!this.shaderProgram || !this.vao) {
      throw new Error('QuadRenderer not initialized');
    }

    gl.useProgram(this.shaderProgram.program);
    gl.bindVertexArray(this.vao);

    // Set uniforms
    const viewportSizeLoc = this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_viewportSize');
    const quadPosLoc = this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_quadPos');
    const quadSizeLoc = this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_quadSize');
    const textureLoc = this.shaders.getUniformLocation(gl, this.shaderProgram, 'u_texture');

    gl.uniform2f(viewportSizeLoc, viewportWidth, viewportHeight);
    gl.uniform2f(quadPosLoc, x, y);
    gl.uniform2f(quadSizeLoc, width, height);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(textureLoc, 0);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);
  }

  /**
   * Draw the test pattern texture
   */
  drawTestQuad(
    x: number,
    y: number,
    width: number,
    height: number,
    viewportWidth: number,
    viewportHeight: number
  ): void {
    if (!this.testTexture) {
      this.createTestTexture();
    }
    this.drawQuad(this.testTexture!, x, y, width, height, viewportWidth, viewportHeight);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    const gl = this.glContext.getGL();

    if (this.vao) {
      gl.deleteVertexArray(this.vao);
      this.vao = null;
    }

    if (this.positionBuffer) {
      gl.deleteBuffer(this.positionBuffer);
      this.positionBuffer = null;
    }

    if (this.texCoordBuffer) {
      gl.deleteBuffer(this.texCoordBuffer);
      this.texCoordBuffer = null;
    }

    if (this.testTexture) {
      gl.deleteTexture(this.testTexture);
      this.testTexture = null;
    }

    this.shaders.dispose(gl);
    this.shaderProgram = null;
  }
}
