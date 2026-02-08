/**
 * Dominant Color Extractor
 *
 * Extracts the dominant color from a sprite in a sprite sheet.
*/

import { loadImageAsset } from './assetLoader';

/**
 * Extract dominant color from a region of an image.
 * Ignores transparent and near-white pixels.
 */
export function extractDominantColor(
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#808080';

  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Count colors (quantized to reduce noise)
  const colorCounts = new Map<string, number>();
  let totalPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip transparent pixels
    if (a < 128) continue;

    // Skip near-white and near-black pixels (likely background/outline)
    const brightness = (r + g + b) / 3;
    if (brightness > 240 || brightness < 15) continue;

    // Quantize to reduce color variations (round to nearest 16)
    const qr = Math.round(r / 16) * 16;
    const qg = Math.round(g / 16) * 16;
    const qb = Math.round(b / 16) * 16;

    const key = `${qr},${qg},${qb}`;
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    totalPixels++;
  }

  if (totalPixels === 0) return '#808080';

  // Find the most common color
  let maxCount = 0;
  let dominantKey = '128,128,128';

  for (const [key, count] of colorCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantKey = key;
    }
  }

  const [r, g, b] = dominantKey.split(',').map(Number);
  return rgbToHex(r, g, b);
}

/**
 * Extract dominant colors for all sprites in a horizontal sprite sheet.
 * Returns an array of hex colors, one per sprite.
 */
export function extractSpriteSheetColors(
  img: HTMLImageElement,
  spriteWidth: number,
  spriteHeight: number,
  row: number = 0,
  count?: number
): string[] {
  const numSprites = count ?? Math.floor(img.width / spriteWidth);
  const colors: string[] = [];

  for (let i = 0; i < numSprites; i++) {
    const x = i * spriteWidth;
    const y = row * spriteHeight;
    colors.push(extractDominantColor(img, x, y, spriteWidth, spriteHeight));
  }

  return colors;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Cache for extracted colors from sprite sheets
 */
const colorCache = new Map<string, string[]>();

/**
 * Load sprite sheet and extract colors (with caching)
 */
export async function loadSpriteSheetColors(
  src: string,
  spriteWidth: number,
  spriteHeight: number,
  row: number = 0,
  count?: number
): Promise<string[]> {
  const cacheKey = `${src}:${spriteWidth}:${spriteHeight}:${row}:${count}`;

  if (colorCache.has(cacheKey)) {
    return colorCache.get(cacheKey)!;
  }

  try {
    const img = await loadImageAsset(src);
    const colors = extractSpriteSheetColors(img, spriteWidth, spriteHeight, row, count);
    colorCache.set(cacheKey, colors);
    return colors;
  } catch {
    // Return default gray colors on error
    return Array(count || 8).fill('#808080');
  }
}
