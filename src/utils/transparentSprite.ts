/**
 * Transparent Sprite Utility
 *
 * Compatibility utility for callers that expect a data URL result.
 * Internally delegates image processing to shared asset loader helpers.
 */

import { loadImageCanvasAsset } from './assetLoader';

// Cache processed sprites to avoid re-processing
const spriteCache = new Map<string, string>();

/**
 * Load a sprite and make its background color transparent
 *
 * @param src - Image source URL
 * @param bgColor - Background color to make transparent (default: black)
 * @returns Promise resolving to a data URL with transparency applied
 */
export async function loadTransparentSprite(
  src: string,
  bgColor: { r: number; g: number; b: number } = { r: 0, g: 0, b: 0 }
): Promise<string> {
  // Check cache first
  const cacheKey = `${src}:${bgColor.r},${bgColor.g},${bgColor.b}`;
  const cached = spriteCache.get(cacheKey);
  if (cached) return cached;

  const canvas = await loadImageCanvasAsset(src, {
    crossOrigin: 'anonymous',
    transparency: { type: 'color', color: bgColor, tolerance: 5 },
  });
  const dataUrl = canvas.toDataURL('image/png');
  spriteCache.set(cacheKey, dataUrl);
  return dataUrl;
}

/**
 * React hook-friendly: get transparent sprite URL (returns undefined while loading)
 *
 * Usage:
 * const [src, setSrc] = useState<string>();
 * useEffect(() => { loadTransparentSprite('/path/to/sprite.png').then(setSrc); }, []);
 * return <img src={src} />
 */

/**
 * Preload and cache multiple sprites
 *
 * @param srcs - Array of image source URLs
 * @param bgColor - Background color to make transparent
 */
export async function preloadTransparentSprites(
  srcs: string[],
  bgColor: { r: number; g: number; b: number } = { r: 0, g: 0, b: 0 }
): Promise<void> {
  await Promise.all(srcs.map(src => loadTransparentSprite(src, bgColor)));
}

/**
 * Clear the sprite cache (for memory management)
 */
export function clearSpriteCache(): void {
  spriteCache.clear();
}
