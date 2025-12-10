/**
 * WebGLScanlineRenderer - CRT-style scanline overlay effect
 *
 * Renders alternating light/dark horizontal lines over the entire screen.
 * Used when menus are open for an authentic retro CRT look.
 */

import { WebGLShaders } from './WebGLShaders';
import type { ShaderProgram } from './types';

// Fullscreen quad vertex shader using gl_VertexID
const SCANLINE_VERTEX_SHADER = `#version 300 es
precision highp float;

out vec2 v_position;

void main() {
  // Generate fullscreen quad vertices from gl_VertexID
  // Triangle strip: 0,1,2,3 -> (-1,-1), (1,-1), (-1,1), (1,1)
  float x = float((gl_VertexID & 1) * 2 - 1);
  float y = float((gl_VertexID >> 1) * 2 - 1);
  gl_Position = vec4(x, y, 0.0, 1.0);
  v_position = vec2(x, y);
}
`;

// Scanline fragment shader - alternating dark/light bands
const SCANLINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float u_intensity;      // 0.0 = no effect, 1.0 = full effect
uniform vec2 u_resolution;      // Screen resolution in pixels
uniform float u_lineSpacing;    // Total band height (dark + light) in pixels
uniform float u_darkRatio;      // Ratio of dark band (0.5 = half dark, half light)

in vec2 v_position;
out vec4 fragColor;

void main() {
  // Convert from NDC (-1 to 1) to pixel coordinates
  vec2 pixelCoord = (v_position * 0.5 + 0.5) * u_resolution;

  // Calculate position within the scanline band
  float row = floor(pixelCoord.y);
  float posInBand = mod(row, u_lineSpacing);

  // Dark band threshold based on ratio
  float darkThreshold = u_lineSpacing * u_darkRatio;

  // Is this pixel in the dark band?
  float isDarkLine = step(posInBand, darkThreshold - 0.5);

  // Strong contrast: 0.35 alpha for very visible dark lines
  float alpha = isDarkLine * 0.35 * u_intensity;

  fragColor = vec4(0.0, 0.0, 0.0, alpha);
}
`;

export class WebGLScanlineRenderer {
  private gl: WebGL2RenderingContext;
  private shaders: WebGLShaders;
  private program: ShaderProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private intensityUniform: WebGLUniformLocation | null = null;
  private resolutionUniform: WebGLUniformLocation | null = null;
  private lineSpacingUniform: WebGLUniformLocation | null = null;
  private darkRatioUniform: WebGLUniformLocation | null = null;
  private initialized = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.shaders = new WebGLShaders();
  }

  /**
   * Initialize the scanline renderer
   */
  initialize(): void {
    if (this.initialized) return;

    const { gl } = this;

    // Compile scanline shader
    this.program = this.shaders.getOrCreateProgram(
      gl,
      'scanline',
      SCANLINE_VERTEX_SHADER,
      SCANLINE_FRAGMENT_SHADER
    );

    // Cache uniform locations
    this.intensityUniform = this.shaders.getUniformLocation(gl, this.program, 'u_intensity');
    this.resolutionUniform = this.shaders.getUniformLocation(gl, this.program, 'u_resolution');
    this.lineSpacingUniform = this.shaders.getUniformLocation(gl, this.program, 'u_lineSpacing');
    this.darkRatioUniform = this.shaders.getUniformLocation(gl, this.program, 'u_darkRatio');

    // Create an empty VAO for fullscreen quad (uses gl_VertexID in shader)
    this.vao = gl.createVertexArray();

    this.initialized = true;
  }

  /**
   * Render scanline overlay
   *
   * @param intensity - Effect intensity (0 = off, 1 = full)
   * @param width - Screen width in pixels
   * @param height - Screen height in pixels
   * @param zoom - Display zoom level (scanlines scale with zoom)
   * @param options - Optional configuration
   */
  render(
    intensity: number,
    width: number,
    height: number,
    zoom: number = 1,
    options: { lineSpacing?: number; darkRatio?: number } = {}
  ): void {
    if (intensity <= 0) return; // Nothing to render
    if (!this.initialized) {
      this.initialize();
    }

    const { gl } = this;

    if (!this.program || !this.vao) {
      console.warn('WebGLScanlineRenderer not properly initialized');
      return;
    }

    // Default: 4 pixel bands (2 dark, 2 light) scaled by zoom
    const lineSpacing = options.lineSpacing ?? 4 * zoom;
    // Default: 50% dark, 50% light
    const darkRatio = options.darkRatio ?? 0.5;

    // Use shader
    gl.useProgram(this.program.program);

    // Set uniforms
    gl.uniform1f(this.intensityUniform, intensity);
    gl.uniform2f(this.resolutionUniform, width, height);
    gl.uniform1f(this.lineSpacingUniform, lineSpacing);
    gl.uniform1f(this.darkRatioUniform, darkRatio);

    // Enable blending for transparent composition
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Bind VAO and draw fullscreen quad
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  /**
   * Check if WebGL context is valid
   */
  isValid(): boolean {
    return !this.gl.isContextLost();
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
    this.intensityUniform = null;
    this.resolutionUniform = null;
    this.lineSpacingUniform = null;
    this.darkRatioUniform = null;
    this.initialized = false;
  }
}
