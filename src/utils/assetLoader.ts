/**
 * Shared asset loading helpers with cache.
 *
 * Centralizes image/text/binary fetches and common transparency-key processing
 * so states/hooks don't re-implement per-file loaders.
 */

import { createCanvas2D } from './canvasHelper';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export type TransparencyMode =
  | { type: 'none' }
  | { type: 'top-left'; tolerance?: number }
  | { type: 'color'; color: RgbColor; tolerance?: number }
  | { type: 'most-common'; tolerance?: number; minAlpha?: number };

export interface LoadImageOptions {
  crossOrigin?: string;
}

export interface LoadImageCanvasOptions extends LoadImageOptions {
  transparency?: TransparencyMode;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const textCache = new Map<string, Promise<string>>();
const binaryCache = new Map<string, Promise<ArrayBuffer>>();
const canvasCache = new Map<string, Promise<HTMLCanvasElement>>();

function getImageCacheKey(src: string, options?: LoadImageOptions): string {
  return `${src}|${options?.crossOrigin ?? ''}`;
}

function getCanvasCacheKey(src: string, options?: LoadImageCanvasOptions): string {
  return `${getImageCacheKey(src, options)}|${JSON.stringify(options?.transparency ?? { type: 'none' })}`;
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const { canvas: clone, ctx } = createCanvas2D(source.width, source.height);
  ctx.drawImage(source, 0, 0);
  return clone;
}

function getTopLeftColor(imageData: ImageData): RgbColor {
  const data = imageData.data;
  return { r: data[0], g: data[1], b: data[2] };
}

function getMostCommonColor(imageData: ImageData, minAlpha: number): RgbColor {
  const data = imageData.data;
  const colorCounts = new Map<number, number>();

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < minAlpha) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
  }

  let bestKey = 0;
  let bestCount = -1;
  for (const [key, count] of colorCounts.entries()) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }

  return {
    r: (bestKey >> 16) & 0xff,
    g: (bestKey >> 8) & 0xff,
    b: bestKey & 0xff,
  };
}

function applyTransparencyToCanvas(canvas: HTMLCanvasElement, mode?: TransparencyMode): void {
  if (!mode || mode.type === 'none') {
    return;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const tolerance = mode.type === 'most-common' ? (mode.tolerance ?? 0) : (mode.tolerance ?? 0);

  let target: RgbColor;
  if (mode.type === 'top-left') {
    target = getTopLeftColor(imageData);
  } else if (mode.type === 'color') {
    target = mode.color;
  } else {
    target = getMostCommonColor(imageData, mode.minAlpha ?? 1);
  }

  for (let i = 0; i < data.length; i += 4) {
    if (
      Math.abs(data[i] - target.r) <= tolerance &&
      Math.abs(data[i + 1] - target.g) <= tolerance &&
      Math.abs(data[i + 2] - target.b) <= tolerance
    ) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export function imageToCanvas(image: CanvasImageSource, width?: number, height?: number): HTMLCanvasElement {
  const resolvedWidth =
    width
    ?? ((image as HTMLImageElement).naturalWidth || (image as HTMLImageElement).width || 0);
  const resolvedHeight =
    height
    ?? ((image as HTMLImageElement).naturalHeight || (image as HTMLImageElement).height || 0);
  const { canvas, ctx } = createCanvas2D(resolvedWidth, resolvedHeight);
  ctx.drawImage(image, 0, 0, resolvedWidth, resolvedHeight);
  return canvas;
}

export function makeTransparentCanvas(
  image: CanvasImageSource,
  mode: TransparencyMode = { type: 'top-left' },
  width?: number,
  height?: number
): HTMLCanvasElement {
  const canvas = imageToCanvas(image, width, height);
  applyTransparencyToCanvas(canvas, mode);
  return canvas;
}

export function makeCanvasTransparent(
  canvas: HTMLCanvasElement,
  mode: TransparencyMode = { type: 'top-left' }
): HTMLCanvasElement {
  const clone = cloneCanvas(canvas);
  applyTransparencyToCanvas(clone, mode);
  return clone;
}

export function loadImageAsset(src: string, options?: LoadImageOptions): Promise<HTMLImageElement> {
  const cacheKey = getImageCacheKey(src, options);
  const cached = imageCache.get(cacheKey);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (options?.crossOrigin) {
      img.crossOrigin = options.crossOrigin;
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  }).catch((error) => {
    imageCache.delete(cacheKey);
    throw error;
  });

  imageCache.set(cacheKey, promise);
  return promise;
}

export async function loadImageCanvasAsset(
  src: string,
  options?: LoadImageCanvasOptions
): Promise<HTMLCanvasElement> {
  const cacheKey = getCanvasCacheKey(src, options);
  let cachedPromise = canvasCache.get(cacheKey);

  if (!cachedPromise) {
    cachedPromise = (async () => {
      const img = await loadImageAsset(src, options);
      const canvas = imageToCanvas(img);
      applyTransparencyToCanvas(canvas, options?.transparency);
      return canvas;
    })().catch((error) => {
      canvasCache.delete(cacheKey);
      throw error;
    });
    canvasCache.set(cacheKey, cachedPromise);
  }

  const cachedCanvas = await cachedPromise;
  return cloneCanvas(cachedCanvas);
}

export function loadTextAsset(url: string): Promise<string> {
  const cached = textCache.get(url);
  if (cached) return cached;

  const promise = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      return response.text();
    })
    .catch((error) => {
      textCache.delete(url);
      throw error;
    });

  textCache.set(url, promise);
  return promise;
}

export function loadBinaryAsset(url: string): Promise<ArrayBuffer> {
  const cached = binaryCache.get(url);
  if (cached) return cached;

  const promise = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      return response.arrayBuffer();
    })
    .catch((error) => {
      binaryCache.delete(url);
      throw error;
    });

  binaryCache.set(url, promise);
  return promise;
}

export async function loadUint16LEAsset(url: string): Promise<Uint16Array> {
  const buffer = await loadBinaryAsset(url);
  const bytes = new Uint8Array(buffer);
  const count = Math.floor(bytes.length / 2);
  const out = new Uint16Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
  }
  return out;
}

export function clearAssetCaches(): void {
  imageCache.clear();
  textCache.clear();
  binaryCache.clear();
  canvasCache.clear();
}
