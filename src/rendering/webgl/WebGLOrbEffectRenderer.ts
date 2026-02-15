import { WebGLShaders } from './WebGLShaders.ts';
import type { ShaderProgram } from './types.ts';
import type { OrbEffectRenderState } from '../../game/scriptEffects/orbEffectRuntime.ts';

const GBA_WIDTH = 240;
const GBA_HEIGHT = 160;

export interface OrbViewportTransform {
  centerPxX: number;
  centerPxY: number;
  radiusPx: number;
}

export function computeOrbViewportTransform(
  centerX: number,
  centerY: number,
  radius: number,
  viewportWidth: number,
  viewportHeight: number,
): OrbViewportTransform {
  const safeWidth = Math.max(1, viewportWidth);
  const safeHeight = Math.max(1, viewportHeight);
  const centerPxX = (centerX / GBA_WIDTH) * safeWidth;
  const centerPxY = (centerY / GBA_HEIGHT) * safeHeight;
  const radiusScale = Math.min(safeWidth / GBA_WIDTH, safeHeight / GBA_HEIGHT);
  const radiusPx = Math.max(1, radius * radiusScale);

  return { centerPxX, centerPxY, radiusPx };
}

const ORB_VERTEX_SHADER = `#version 300 es
precision highp float;

void main() {
  float x = float((gl_VertexID & 1) * 2 - 1);
  float y = float((gl_VertexID >> 1) * 2 - 1);
  gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

const ORB_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_radius;
uniform vec3 u_color;
uniform float u_fadeAlpha;

out vec4 fragColor;

void main() {
  vec2 screenPos = vec2(gl_FragCoord.x - 0.5, u_resolution.y - gl_FragCoord.y - 0.5);
  float dist = distance(screenPos, u_center);
  float feather = 1.5;
  float edge0 = max(0.0, u_radius - feather);
  float edgeMask = 1.0 - smoothstep(edge0, u_radius + feather, dist);
  float coreMask = 1.0 - smoothstep(0.0, max(1.0, u_radius * 0.92), dist);
  float intensity = mix(0.86, 1.0, coreMask);

  float fadeAlpha = clamp(u_fadeAlpha, 0.0, 1.0);
  float alpha = clamp(edgeMask * fadeAlpha, 0.0, 1.0);
  vec3 rgb = u_color * intensity;

  fragColor = vec4(rgb, alpha);
}
`;

export class WebGLOrbEffectRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly shaders: WebGLShaders;
  private program: ShaderProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private resolutionUniform: WebGLUniformLocation | null = null;
  private centerUniform: WebGLUniformLocation | null = null;
  private radiusUniform: WebGLUniformLocation | null = null;
  private colorUniform: WebGLUniformLocation | null = null;
  private fadeAlphaUniform: WebGLUniformLocation | null = null;
  private initialized = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.shaders = new WebGLShaders();
  }

  initialize(): void {
    if (this.initialized) return;

    const { gl } = this;
    this.program = this.shaders.getOrCreateProgram(gl, 'orbEffect', ORB_VERTEX_SHADER, ORB_FRAGMENT_SHADER);
    this.resolutionUniform = this.shaders.getUniformLocation(gl, this.program, 'u_resolution');
    this.centerUniform = this.shaders.getUniformLocation(gl, this.program, 'u_center');
    this.radiusUniform = this.shaders.getUniformLocation(gl, this.program, 'u_radius');
    this.colorUniform = this.shaders.getUniformLocation(gl, this.program, 'u_color');
    this.fadeAlphaUniform = this.shaders.getUniformLocation(gl, this.program, 'u_fadeAlpha');
    this.vao = gl.createVertexArray();
    this.initialized = true;
  }

  render(state: OrbEffectRenderState, viewportWidth: number, viewportHeight: number): void {
    if (!this.initialized) {
      this.initialize();
    }
    if (!this.program || !this.vao) return;
    const viewport = computeOrbViewportTransform(
      state.centerX,
      state.centerY,
      state.radius,
      viewportWidth,
      viewportHeight,
    );
    const color = state.color === 'red'
      ? { r: 1.0, g: 0.25, b: 0.18 }
      : { r: 0.23, g: 0.52, b: 1.0 };

    const { gl } = this;
    gl.useProgram(this.program.program);
    gl.uniform2f(this.resolutionUniform, viewportWidth, viewportHeight);
    gl.uniform2f(this.centerUniform, viewport.centerPxX, viewport.centerPxY);
    gl.uniform1f(this.radiusUniform, viewport.radiusPx);
    gl.uniform3f(this.colorUniform, color.r, color.g, color.b);
    gl.uniform1f(this.fadeAlphaUniform, state.fadeAlpha);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const { gl } = this;
    if (this.vao) {
      gl.deleteVertexArray(this.vao);
      this.vao = null;
    }
    this.shaders.dispose(gl);
    this.program = null;
    this.resolutionUniform = null;
    this.centerUniform = null;
    this.radiusUniform = null;
    this.colorUniform = null;
    this.fadeAlphaUniform = null;
    this.initialized = false;
  }
}
