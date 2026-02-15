/**
 * Shared asset loading helpers with cache.
 *
 * Centralizes image/text/binary fetches and common transparency-key processing
 * so states/hooks don't re-implement per-file loaders.
 */

import { createCanvas2D } from './canvasHelper';
import { toPublicAssetUrl } from './publicAssetUrl';

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

const MB = 1024 * 1024;
const textEncoder = new TextEncoder();

type CacheEntry<T> = {
  value: Promise<T>;
  bytes: number;
};

class BoundedLruCache<T> {
  private entries = new Map<string, CacheEntry<T>>();
  private totalBytes = 0;
  private maxEntries: number;
  private maxBytes: number;

  constructor(maxEntries: number, maxBytes: number) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
  }

  get(key: string): Promise<T> | undefined {
    const existing = this.entries.get(key);
    if (!existing) {
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, existing);
    return existing.value;
  }

  set(key: string, value: Promise<T>, bytes = 0): void {
    const existing = this.entries.get(key);
    if (existing) {
      this.totalBytes -= existing.bytes;
      this.entries.delete(key);
    }
    const next = { value, bytes };
    this.entries.set(key, next);
    this.totalBytes += next.bytes;
    this.evictIfNeeded();
  }

  delete(key: string): void {
    const existing = this.entries.get(key);
    if (!existing) {
      return;
    }
    this.totalBytes -= existing.bytes;
    this.entries.delete(key);
  }

  updateSize(key: string, bytes: number): void {
    const existing = this.entries.get(key);
    if (!existing) {
      return;
    }
    const normalized = Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : 0;
    this.totalBytes += normalized - existing.bytes;
    existing.bytes = normalized;
    this.entries.delete(key);
    this.entries.set(key, existing);
    this.evictIfNeeded();
  }

  clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  stats(): { entries: number; bytes: number; maxEntries: number; maxBytes: number } {
    return {
      entries: this.entries.size,
      bytes: this.totalBytes,
      maxEntries: this.maxEntries,
      maxBytes: this.maxBytes,
    };
  }

  private evictIfNeeded(): void {
    while (
      this.entries.size > this.maxEntries
      || this.totalBytes > this.maxBytes
    ) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.delete(oldestKey);
    }
  }
}

const imageCache = new BoundedLruCache<HTMLImageElement>(192, 96 * MB);
const textCache = new BoundedLruCache<string>(512, 16 * MB);
const binaryCache = new BoundedLruCache<ArrayBuffer>(256, 96 * MB);
const canvasCache = new BoundedLruCache<HTMLCanvasElement>(96, 96 * MB);

const DEV_POKEEMERALD_FETCH_RETRY_ATTEMPTS = 3;
const DEV_POKEEMERALD_FETCH_RETRY_BASE_MS = 120;

function shouldRetryPokeemeraldAssetFetch(url: string, status?: number): boolean {
  if (!import.meta.env.DEV || !url.includes('/pokeemerald/')) {
    return false;
  }

  if (status === undefined) {
    return true;
  }

  return status === 404 || status === 408 || status === 425 || status === 429 || status >= 500;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAssetWithRetry<T>(
  url: string,
  parse: (response: Response) => Promise<T>
): Promise<T> {
  const maxAttempts =
    import.meta.env.DEV && url.includes('/pokeemerald/')
      ? DEV_POKEEMERALD_FETCH_RETRY_ATTEMPTS
      : 1;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (attempt < maxAttempts && shouldRetryPokeemeraldAssetFetch(url, response.status)) {
          await wait(DEV_POKEEMERALD_FETCH_RETRY_BASE_MS * attempt);
          continue;
        }

        throw new Error(`Failed to load ${url}`);
      }

      return await parse(response);
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts && shouldRetryPokeemeraldAssetFetch(url)) {
        await wait(DEV_POKEEMERALD_FETCH_RETRY_BASE_MS * attempt);
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to load ${url}`);
}

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
  const resolvedSrc = toPublicAssetUrl(src);
  const cacheKey = getImageCacheKey(resolvedSrc, options);
  const cached = imageCache.get(cacheKey);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (options?.crossOrigin) {
      img.crossOrigin = options.crossOrigin;
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${resolvedSrc}`));
    img.src = resolvedSrc;
  })
    .then((img) => {
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      imageCache.updateSize(cacheKey, width * height * 4);
      return img;
    })
    .catch((error) => {
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
  const resolvedSrc = toPublicAssetUrl(src);
  const cacheKey = getCanvasCacheKey(resolvedSrc, options);
  let cachedPromise = canvasCache.get(cacheKey);

  if (!cachedPromise) {
    cachedPromise = (async () => {
      const img = await loadImageAsset(resolvedSrc, options);
      const canvas = imageToCanvas(img);
      applyTransparencyToCanvas(canvas, options?.transparency);
      canvasCache.updateSize(cacheKey, canvas.width * canvas.height * 4);
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
  const resolvedUrl = toPublicAssetUrl(url);
  const cached = textCache.get(resolvedUrl);
  if (cached) return cached;

  const promise = fetchAssetWithRetry(resolvedUrl, (response) => response.text())
    .then((text) => {
      textCache.updateSize(resolvedUrl, textEncoder.encode(text).byteLength);
      return text;
    })
    .catch((error) => {
      textCache.delete(resolvedUrl);
      throw error;
    });

  textCache.set(resolvedUrl, promise);
  return promise;
}

export function loadBinaryAsset(url: string): Promise<ArrayBuffer> {
  const resolvedUrl = toPublicAssetUrl(url);
  const cached = binaryCache.get(resolvedUrl);
  if (cached) return cached;

  const promise = fetchAssetWithRetry(resolvedUrl, (response) => response.arrayBuffer())
    .then((buffer) => {
      binaryCache.updateSize(resolvedUrl, buffer.byteLength);
      return buffer;
    })
    .catch((error) => {
      binaryCache.delete(resolvedUrl);
      throw error;
    });

  binaryCache.set(resolvedUrl, promise);
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

export function getAssetCacheStats(): {
  image: { entries: number; bytes: number; maxEntries: number; maxBytes: number };
  text: { entries: number; bytes: number; maxEntries: number; maxBytes: number };
  binary: { entries: number; bytes: number; maxEntries: number; maxBytes: number };
  canvas: { entries: number; bytes: number; maxEntries: number; maxBytes: number };
} {
  return {
    image: imageCache.stats(),
    text: textCache.stats(),
    binary: binaryCache.stats(),
    canvas: canvasCache.stats(),
  };
}
