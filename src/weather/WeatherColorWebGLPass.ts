/**
 * WebGL weather color-map post-process pass.
 *
 * Applies the current C-inspired weather color mapping to the composited
 * frame using a fullscreen shader, with a CPU fallback in WeatherManager.
 */

import { WebGLShaders } from '../rendering/webgl/WebGLShaders';
import type { ShaderProgram } from '../rendering/webgl/types';
import { createLogger } from '../utils/logger';
import type { WeatherColorPipeline } from './WeatherColorPipeline';

const weatherPassLogger = createLogger('WEATHER_WEBGL_PASS');

const WEATHER_PASS_VERTEX_SHADER = `#version 300 es
precision highp float;

void main() {
  float x = float((gl_VertexID & 1) * 2 - 1);
  float y = float((gl_VertexID >> 1) * 2 - 1);
  gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

const WEATHER_PASS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_source;
uniform sampler2D u_colorMap;
uniform sampler2D u_droughtTable;
uniform int u_colorMapIndex;
uniform bool u_useDrought;

out vec4 fragColor;

int channelToByte(float channel) {
  return int(clamp(floor(channel * 255.0 + 0.5), 0.0, 255.0));
}

void main() {
  ivec2 coord = ivec2(gl_FragCoord.xy);
  vec4 sourceColor = texelFetch(u_source, coord, 0);

  if (sourceColor.a <= 0.0) {
    fragColor = sourceColor;
    return;
  }

  int srcR = channelToByte(sourceColor.r);
  int srcG = channelToByte(sourceColor.g);
  int srcB = channelToByte(sourceColor.b);

  if ((srcR | srcG | srcB) == 0) {
    fragColor = sourceColor;
    return;
  }

  if (u_useDrought) {
    int r5 = srcR >> 3;
    int g5 = srcG >> 3;
    int b5 = srcB >> 3;
    int offset = ((b5 & 0x1e) << 7) | ((g5 & 0x1e) << 3) | ((r5 & 0x1e) >> 1);
    ivec2 droughtCoord = ivec2(offset & 63, offset >> 6);
    vec3 droughtMapped = texelFetch(u_droughtTable, droughtCoord, 0).rgb;
    fragColor = vec4(droughtMapped, sourceColor.a);
    return;
  }

  int tableY = max(u_colorMapIndex - 1, 0);
  int r5 = srcR >> 3;
  int g5 = srcG >> 3;
  int b5 = srcB >> 3;

  float mappedR = texelFetch(u_colorMap, ivec2(r5, tableY), 0).r;
  float mappedG = texelFetch(u_colorMap, ivec2(g5, tableY), 0).r;
  float mappedB = texelFetch(u_colorMap, ivec2(b5, tableY), 0).r;

  fragColor = vec4(mappedR, mappedG, mappedB, sourceColor.a);
}
`;

const COLOR_MAP_WIDTH = 32;
const COLOR_MAP_HEIGHT = 19;
const DROUGHT_TABLE_SIZE = 64;
const DROUGHT_TABLE_COUNT = 6;

interface WeatherPassUniforms {
  source: WebGLUniformLocation | null;
  colorMap: WebGLUniformLocation | null;
  droughtTable: WebGLUniformLocation | null;
  colorMapIndex: WebGLUniformLocation | null;
  useDrought: WebGLUniformLocation | null;
}

export class WeatherColorWebGLPass {
  private readonly gl: WebGL2RenderingContext;
  private readonly shaders = new WebGLShaders();

  private program: ShaderProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private uniforms: WeatherPassUniforms | null = null;

  private sourceTexture: WebGLTexture | null = null;
  private colorMapTexture: WebGLTexture | null = null;
  private droughtTextures: Array<WebGLTexture | null> = Array.from(
    { length: DROUGHT_TABLE_COUNT },
    () => null
  );

  private initialized = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  isForContext(gl: WebGL2RenderingContext): boolean {
    return this.gl === gl;
  }

  render(
    ctx2d: CanvasRenderingContext2D,
    width: number,
    height: number,
    webglCanvas: HTMLCanvasElement,
    pipeline: WeatherColorPipeline
  ): boolean {
    const colorMapIndex = pipeline.getCurrentColorMapIndex();
    if (colorMapIndex === 0 || width <= 0 || height <= 0) {
      return false;
    }

    if (!this.ensureInitialized(pipeline)) {
      return false;
    }

    const { gl } = this;
    if (!this.program || !this.vao || !this.uniforms || !this.sourceTexture || !this.colorMapTexture) {
      return false;
    }

    let useDrought = false;
    let droughtTexture: WebGLTexture | null = null;
    if (colorMapIndex < 0) {
      const droughtIndex = -colorMapIndex - 1;
      droughtTexture = this.ensureDroughtTexture(pipeline, droughtIndex);
      if (!droughtTexture) {
        return false;
      }
      useDrought = true;
    }

    if (webglCanvas.width !== width || webglCanvas.height !== height) {
      webglCanvas.width = width;
      webglCanvas.height = height;
    }

    const sourceCanvas = ctx2d.canvas;
    if (!(sourceCanvas instanceof HTMLCanvasElement)) {
      return false;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);

    gl.useProgram(this.program.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(this.uniforms.source, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.colorMapTexture);
    gl.uniform1i(this.uniforms.colorMap, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, droughtTexture ?? this.colorMapTexture);
    gl.uniform1i(this.uniforms.droughtTable, 2);

    gl.uniform1i(this.uniforms.colorMapIndex, colorMapIndex);
    gl.uniform1i(this.uniforms.useDrought, useDrought ? 1 : 0);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    ctx2d.save();
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.clearRect(0, 0, width, height);
    ctx2d.drawImage(webglCanvas, 0, 0, width, height);
    ctx2d.restore();

    return true;
  }

  dispose(): void {
    const { gl } = this;

    if (this.sourceTexture) {
      gl.deleteTexture(this.sourceTexture);
      this.sourceTexture = null;
    }
    if (this.colorMapTexture) {
      gl.deleteTexture(this.colorMapTexture);
      this.colorMapTexture = null;
    }
    for (let i = 0; i < this.droughtTextures.length; i++) {
      const texture = this.droughtTextures[i];
      if (!texture) continue;
      gl.deleteTexture(texture);
      this.droughtTextures[i] = null;
    }

    if (this.vao) {
      gl.deleteVertexArray(this.vao);
      this.vao = null;
    }

    this.shaders.dispose(gl);
    this.program = null;
    this.uniforms = null;
    this.initialized = false;
  }

  private ensureInitialized(pipeline: WeatherColorPipeline): boolean {
    if (this.initialized) {
      return true;
    }

    const { gl } = this;
    this.program = this.shaders.getOrCreateProgram(
      gl,
      'weatherColorPass',
      WEATHER_PASS_VERTEX_SHADER,
      WEATHER_PASS_FRAGMENT_SHADER
    );
    this.uniforms = {
      source: this.shaders.getUniformLocation(gl, this.program, 'u_source'),
      colorMap: this.shaders.getUniformLocation(gl, this.program, 'u_colorMap'),
      droughtTable: this.shaders.getUniformLocation(gl, this.program, 'u_droughtTable'),
      colorMapIndex: this.shaders.getUniformLocation(gl, this.program, 'u_colorMapIndex'),
      useDrought: this.shaders.getUniformLocation(gl, this.program, 'u_useDrought'),
    };
    this.vao = gl.createVertexArray();

    this.sourceTexture = gl.createTexture();
    if (!this.sourceTexture) {
      weatherPassLogger.warn('Failed to create weather source texture');
      return false;
    }
    this.configureTexture2D(this.sourceTexture);

    this.colorMapTexture = gl.createTexture();
    if (!this.colorMapTexture) {
      weatherPassLogger.warn('Failed to create weather color-map texture');
      return false;
    }
    this.configureTexture2D(this.colorMapTexture);
    const colorMapData = this.buildColorMapTextureData(pipeline);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.colorMapTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      COLOR_MAP_WIDTH,
      COLOR_MAP_HEIGHT,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      colorMapData
    );

    this.initialized = true;
    return true;
  }

  private ensureDroughtTexture(
    pipeline: WeatherColorPipeline,
    tableIndex: number
  ): WebGLTexture | null {
    if (tableIndex < 0 || tableIndex >= DROUGHT_TABLE_COUNT) {
      return null;
    }

    const existing = this.droughtTextures[tableIndex];
    if (existing) {
      return existing;
    }

    const droughtTable = pipeline.getDroughtColorTable(tableIndex);
    if (!droughtTable) {
      return null;
    }

    const { gl } = this;
    const texture = gl.createTexture();
    if (!texture) {
      weatherPassLogger.warn('Failed to create drought table texture', { tableIndex });
      return null;
    }

    this.configureTexture2D(texture);

    const rgbData = new Uint8Array(DROUGHT_TABLE_SIZE * DROUGHT_TABLE_SIZE * 3);
    for (let i = 0; i < DROUGHT_TABLE_SIZE * DROUGHT_TABLE_SIZE; i++) {
      const color = droughtTable[i] ?? 0;
      const r5 = color & 0x1f;
      const g5 = (color >> 5) & 0x1f;
      const b5 = (color >> 10) & 0x1f;
      const base = i * 3;
      rgbData[base] = (r5 << 3) | (r5 >> 2);
      rgbData[base + 1] = (g5 << 3) | (g5 >> 2);
      rgbData[base + 2] = (b5 << 3) | (b5 >> 2);
    }

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGB8,
      DROUGHT_TABLE_SIZE,
      DROUGHT_TABLE_SIZE,
      0,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      rgbData
    );

    this.droughtTextures[tableIndex] = texture;
    return texture;
  }

  private configureTexture2D(texture: WebGLTexture): void {
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private buildColorMapTextureData(pipeline: WeatherColorPipeline): Uint8Array {
    const data = new Uint8Array(COLOR_MAP_WIDTH * COLOR_MAP_HEIGHT);

    for (let y = 0; y < COLOR_MAP_HEIGHT; y++) {
      const map = pipeline.getDarkenedColorMap(y);
      for (let x = 0; x < COLOR_MAP_WIDTH; x++) {
        const value5 = map?.[x] ?? x;
        data[y * COLOR_MAP_WIDTH + x] = (value5 << 3) | (value5 >> 2);
      }
    }

    return data;
  }
}
