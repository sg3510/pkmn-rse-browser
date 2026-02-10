export interface Canvas2DOptions {
  imageSmoothingEnabled?: boolean;
  contextAttributes?: CanvasRenderingContext2DSettings;
}

export interface CanvasWebGLOptions {
  contextAttributes?: WebGLContextAttributes;
}

export function createCanvasElement(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function createCanvas2D(
  width: number,
  height: number,
  options?: Canvas2DOptions
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = createCanvasElement(width, height);
  const ctx = canvas.getContext('2d', options?.contextAttributes);
  if (!ctx) {
    throw new Error('Failed to acquire 2D canvas context');
  }
  ctx.imageSmoothingEnabled = options?.imageSmoothingEnabled ?? false;
  return { canvas, ctx };
}

export function createCanvasWebGL(
  width: number,
  height: number,
  options?: CanvasWebGLOptions
): { canvas: HTMLCanvasElement; gl: WebGLRenderingContext } {
  const canvas = createCanvasElement(width, height);
  const gl = canvas.getContext('webgl', options?.contextAttributes);
  if (!gl) {
    throw new Error('Failed to acquire WebGL canvas context');
  }
  return { canvas, gl };
}
