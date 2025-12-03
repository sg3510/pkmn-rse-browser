/**
 * WebGLFadeRenderer - Fullscreen solid-color fade overlay
 *
 * Renders a fullscreen quad with a solid color and alpha value.
 * Used for screen fade transitions (fade to black, fade from black).
 */

import { WebGLShaders } from './WebGLShaders';
import type { ShaderProgram } from './types';
import type { IFadeRenderer } from '../IFadeRenderer';
import type { RendererType } from '../IRenderPipeline';

// Simple fullscreen quad vertex shader using gl_VertexID
const FADE_VERTEX_SHADER = `#version 300 es
precision highp float;

void main() {
  // Generate fullscreen quad vertices from gl_VertexID
  // Triangle strip: 0,1,2,3 -> (-1,-1), (1,-1), (-1,1), (1,1)
  float x = float((gl_VertexID & 1) * 2 - 1);
  float y = float((gl_VertexID >> 1) * 2 - 1);
  gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

// Solid color fragment shader with uniform alpha
const FADE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec4 u_color;

out vec4 fragColor;

void main() {
  fragColor = u_color;
}
`;

export class WebGLFadeRenderer implements IFadeRenderer {
  readonly rendererType: RendererType = 'webgl';
  private gl: WebGL2RenderingContext;
  private shaders: WebGLShaders;
  private program: ShaderProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private colorUniform: WebGLUniformLocation | null = null;
  private initialized = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.shaders = new WebGLShaders();
  }

  /**
   * Initialize the fade renderer
   */
  initialize(): void {
    if (this.initialized) return;

    const { gl } = this;

    // Compile fade shader
    this.program = this.shaders.getOrCreateProgram(
      gl,
      'fade',
      FADE_VERTEX_SHADER,
      FADE_FRAGMENT_SHADER
    );

    // Cache uniform location
    this.colorUniform = this.shaders.getUniformLocation(gl, this.program, 'u_color');

    // Create an empty VAO for fullscreen quad (uses gl_VertexID in shader)
    this.vao = gl.createVertexArray();

    this.initialized = true;
  }

  /**
   * Render a fullscreen fade overlay
   *
   * @param alpha - Fade alpha (0 = transparent, 1 = fully opaque)
   * @param r - Red component (0-1), defaults to 0 (black)
   * @param g - Green component (0-1), defaults to 0 (black)
   * @param b - Blue component (0-1), defaults to 0 (black)
   */
  render(alpha: number, r: number = 0, g: number = 0, b: number = 0): void {
    if (alpha <= 0) return; // Nothing to render
    if (!this.initialized) {
      this.initialize();
    }

    const { gl } = this;

    if (!this.program || !this.vao) {
      console.warn('WebGLFadeRenderer not properly initialized');
      return;
    }

    // Use shader
    gl.useProgram(this.program.program);

    // Set color uniform
    gl.uniform4f(this.colorUniform, r, g, b, alpha);

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
    this.colorUniform = null;
    this.initialized = false;
  }
}
