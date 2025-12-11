/**
 * Transparent Sprite Utility
 *
 * Converts indexed-color PNG sprites (with black background) to transparent.
 * GBA sprites use palette index 0 (usually black #000000) as the transparent color.
 * When loaded as <img>, the browser decodes them to RGB, losing transparency info.
 * This utility re-applies transparency by keying out the background color.
 */

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

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      // Create canvas at image size
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Replace background color with transparent
      // Allow small tolerance for compression artifacts
      const tolerance = 5;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (
          Math.abs(r - bgColor.r) <= tolerance &&
          Math.abs(g - bgColor.g) <= tolerance &&
          Math.abs(b - bgColor.b) <= tolerance
        ) {
          // Make transparent
          data[i + 3] = 0;
        }
      }

      // Put modified data back
      ctx.putImageData(imageData, 0, 0);

      // Convert to data URL and cache
      const dataUrl = canvas.toDataURL('image/png');
      spriteCache.set(cacheKey, dataUrl);
      resolve(dataUrl);
    };

    img.onerror = () => {
      reject(new Error(`Failed to load sprite: ${src}`));
    };

    img.src = src;
  });
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
