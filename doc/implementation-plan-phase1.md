# Implementation Plan: Hardware-Accelerated Rendering (Phase 1)

## Critical Visual Fidelity Requirements

### 1. Palette Handling (CRITICAL - NO REGRESSION ALLOWED)

**Current Correct Behavior** (Lines 1354-1360 in MapRenderer.tsx):
```typescript
// Porymap approach: choose tileset based on palette index, not tile source
// Secondary tiles can use primary palettes (0-5) and vice versa
const NUM_PALS_IN_PRIMARY = 6;
const palette = tile.palette < NUM_PALS_IN_PRIMARY
  ? resolved.tileset.primaryPalettes[tile.palette]
  : resolved.tileset.secondaryPalettes[tile.palette];
```

**Key Facts:**
- Palette index (0-15) determines which tileset's palette array to use
- Palettes 0-5 → Primary tileset palettes
- Palettes 6-15 → Secondary tileset palettes
- **Tile source (primary vs secondary tileset) is INDEPENDENT of palette choice**
- This matches Porymap's implementation

**Validation Required:**
- ✅ Primary tiles can use secondary palettes (palette 6-15)
- ✅ Secondary tiles can use primary palettes (palette 0-5)
- ✅ Palette index 0 must always use primary palette array
- ✅ Each palette has 16 colors (index 0 = transparent)

---

## Architecture Overview

### New Components to Create

```
src/
├── rendering/
│   ├── TilesetCanvasCache.ts      (NEW) - Pre-rendered palette canvases
│   ├── CanvasRenderer.ts           (NEW) - Hardware-accelerated tile drawing
│   └── types.ts                    (NEW) - Rendering types
```

### Modified Components

```
src/components/MapRenderer.tsx
├── Remove: drawTileToImageData (line 1244-1280)
├── Replace: renderPass to use Canvas instead of ImageData
└── Add: TilesetCanvasCache initialization
```

---

## Step-by-Step Implementation

### Step 1: Create Palette Canvas Cache System

**File:** `src/rendering/TilesetCanvasCache.ts`

```typescript
import type { Palette } from '../utils/mapLoader';
import { TILE_SIZE, TILES_PER_ROW_IN_IMAGE, SECONDARY_TILE_OFFSET } from '../utils/mapLoader';

/**
 * Cache key for a specific tileset + palette combination
 */
interface CacheKey {
  tilesetId: string;      // e.g., "primary" or "secondary"
  tilesetDataHash: string; // Hash of Uint8Array (for invalidation)
  paletteIndex: number;    // 0-15
  paletteHash: string;     // Hash of palette colors (for invalidation)
}

/**
 * Pre-rendered canvas for a tileset with a specific palette applied
 */
export class TilesetCanvasCache {
  private cache = new Map<string, HTMLCanvasElement>();
  private maxCacheSize = 64; // Limit memory usage

  /**
   * Generate cache key string
   */
  private getCacheKey(
    tilesetId: string,
    tilesetDataHash: string,
    paletteIndex: number,
    paletteHash: string
  ): string {
    return `${tilesetId}:${tilesetDataHash}:${paletteIndex}:${paletteHash}`;
  }

  /**
   * Generate a simple hash for Uint8Array (for cache invalidation)
   */
  private hashTilesetData(data: Uint8Array): string {
    // Simple hash: sample every 1000th byte
    let hash = data.length;
    for (let i = 0; i < data.length; i += 1000) {
      hash = ((hash << 5) - hash + data[i]) | 0;
    }
    return hash.toString(36);
  }

  /**
   * Generate hash for palette (for cache invalidation)
   */
  private hashPalette(palette: Palette): string {
    return palette.colors.join(',');
  }

  /**
   * Render a tileset with a specific palette applied
   * 
   * CRITICAL: This must produce IDENTICAL output to drawTileToImageData
   */
  getPalettizedCanvas(
    tilesetId: string,
    indexedTiles: Uint8Array,  // 4bpp indexed color data (128px wide)
    palette: Palette,           // 16 colors (palette.colors[0] = transparent)
    width: number,              // 128px
    height: number              // Variable (depends on tileset size)
  ): HTMLCanvasElement {
    const tilesetHash = this.hashTilesetData(indexedTiles);
    const paletteHash = this.hashPalette(palette);
    const cacheKey = this.getCacheKey(tilesetId, tilesetHash, -1, paletteHash);

    // Return cached canvas if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Create new canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { 
      alpha: true,
      willReadFrequently: false // Performance hint
    })!;

    // Create ImageData buffer
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Pre-parse palette colors to RGB (avoid repeated parseInt in loop)
    const paletteRGB = new Uint8Array(16 * 3);
    for (let i = 0; i < 16; i++) {
      const hex = palette.colors[i];
      if (hex) {
        paletteRGB[i * 3] = parseInt(hex.slice(1, 3), 16);      // R
        paletteRGB[i * 3 + 1] = parseInt(hex.slice(3, 5), 16);  // G
        paletteRGB[i * 3 + 2] = parseInt(hex.slice(5, 7), 16);  // B
      }
    }

    // Apply palette to indexed tiles
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const paletteIndex = indexedTiles[y * width + x];
        const pixelIndex = (y * width + x) * 4;

        if (paletteIndex === 0) {
          // Transparent pixel (RGBA = 0,0,0,0)
          data[pixelIndex + 3] = 0;
        } else {
          // Opaque pixel - copy RGB from pre-parsed palette
          data[pixelIndex] = paletteRGB[paletteIndex * 3];
          data[pixelIndex + 1] = paletteRGB[paletteIndex * 3 + 1];
          data[pixelIndex + 2] = paletteRGB[paletteIndex * 3 + 2];
          data[pixelIndex + 3] = 255;
        }
      }
    }

    // Put pixels to canvas (one-time operation)
    ctx.putImageData(imageData, 0, 0);

    // Cache the result
    this.cache.set(cacheKey, canvas);

    // Evict oldest entries if cache is too large
    if (this.cache.size > this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return canvas;
  }

  /**
   * Clear entire cache (e.g., on map change)
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for debugging)
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
    };
  }
}
```

---

### Step 2: Create Canvas-Based Tile Renderer

**File:** `src/rendering/CanvasRenderer.ts`

```typescript
import type { Palette } from '../utils/mapLoader';
import { TILE_SIZE, TILES_PER_ROW_IN_IMAGE, SECONDARY_TILE_OFFSET } from '../utils/mapLoader';
import { TilesetCanvasCache } from './TilesetCanvasCache';

export interface TileDrawParams {
  tileId: number;
  destX: number;
  destY: number;
  palette: Palette;
  xflip: boolean;
  yflip: boolean;
  source: 'primary' | 'secondary';
}

/**
 * Hardware-accelerated tile renderer using Canvas 2D API
 * 
 * CRITICAL: Must produce IDENTICAL visual output to drawTileToImageData
 */
export class CanvasRenderer {
  private cache: TilesetCanvasCache;

  constructor() {
    this.cache = new TilesetCanvasCache();
  }

  /**
   * Draw a single 8x8 tile to a canvas context
   * 
   * This replaces drawTileToImageData with GPU-accelerated drawImage
   */
  drawTile(
    ctx: CanvasRenderingContext2D,
    params: TileDrawParams,
    primaryTiles: Uint8Array,
    secondaryTiles: Uint8Array
  ): void {
    const { tileId, destX, destY, palette, xflip, yflip, source } = params;

    // Get the appropriate tileset data
    const tiles = source === 'primary' ? primaryTiles : secondaryTiles;
    const effectiveTileId = source === 'secondary' ? tileId % SECONDARY_TILE_OFFSET : tileId;

    // Get or create palettized canvas for this tileset + palette
    const tilesetCanvas = this.cache.getPalettizedCanvas(
      source,
      tiles,
      palette,
      128, // Width is always 128px (16 tiles * 8px)
      Math.ceil(tiles.length / 128) // Height based on data size
    );

    // Calculate source position in tileset
    const srcX = (effectiveTileId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
    const srcY = Math.floor(effectiveTileId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;

    // Handle flipping with canvas transforms
    ctx.save();
    ctx.translate(destX, destY);

    if (xflip || yflip) {
      const scaleX = xflip ? -1 : 1;
      const scaleY = yflip ? -1 : 1;
      const offsetX = xflip ? -TILE_SIZE : 0;
      const offsetY = yflip ? -TILE_SIZE : 0;
      
      ctx.scale(scaleX, scaleY);
      ctx.translate(offsetX, offsetY);
    }

    // GPU-accelerated drawImage
    ctx.drawImage(
      tilesetCanvas,
      srcX, srcY, TILE_SIZE, TILE_SIZE,  // Source rect
      0, 0, TILE_SIZE, TILE_SIZE          // Dest rect
    );

    ctx.restore();
  }

  /**
   * Clear cache (e.g., on map change or animation frame)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for debugging)
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}
```

---

### Step 3: Modify MapRenderer to Use Canvas Rendering

**File:** `src/components/MapRenderer.tsx`

**Changes Required:**

1. **Import new renderer** (add after existing imports):
```typescript
import { CanvasRenderer } from '../rendering/CanvasRenderer';
```

2. **Add renderer ref** (around line 650, with other refs):
```typescript
const canvasRendererRef = useRef<CanvasRenderer | null>(null);
```

3. **Initialize renderer** (in useEffect that initializes player, around line 1780):
```typescript
// Initialize canvas renderer
canvasRendererRef.current = new CanvasRenderer();
```

4. **Replace `renderPass` to use Canvas instead of ImageData** (lines 1286-1413):

```typescript
const renderPass = useCallback(
  (
    ctx: RenderContext,
    pass: 'background' | 'top',
    skipAnimated: boolean,
    view: WorldCameraView,
    elevationFilter?: (mapTile: MapTileData, tileX: number, tileY: number) => boolean
  ): HTMLCanvasElement => {  // CHANGED: Return Canvas instead of ImageData
    const widthPx = view.tilesWide * METATILE_SIZE;
    const heightPx = view.tilesHigh * METATILE_SIZE;
    
    // Create offscreen canvas for this pass
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const canvasCtx = canvas.getContext('2d', { alpha: true })!;
    
    const renderer = canvasRendererRef.current;
    if (!renderer) return canvas;

    for (let localY = 0; localY < view.tilesHigh; localY++) {
      const tileY = view.worldStartTileY + localY;
      for (let localX = 0; localX < view.tilesWide; localX++) {
        const tileX = view.worldStartTileX + localX;
        const resolved = resolveTileAt(ctx, tileX, tileY);
        if (!resolved || !resolved.metatile) continue;

        // Apply elevation filter if provided
        if (elevationFilter && !elevationFilter(resolved.mapTile, tileX, tileY)) {
          continue;
        }

        const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
        if (!runtime) continue;

        const attr = resolved.attributes;
        const layerType = attr ? attr.layerType : METATILE_LAYER_TYPE_COVERED;

        const screenX = localX * METATILE_SIZE;
        const screenY = localY * METATILE_SIZE;

        const patchedTiles = runtime.patchedTiles ?? {
          primary: runtime.resources.primaryTilesImage,
          secondary: runtime.resources.secondaryTilesImage,
        };
        const animatedTileIds = runtime.animatedTileIds;
        const metatile = resolved.metatile;

        const drawLayer = (layer: number) => {
          for (let i = 0; i < 4; i++) {
            const tileIndex = layer * 4 + i;
            const tile = metatile.tiles[tileIndex];
            const tileSource = tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';
            
            if (skipAnimated) {
              const shouldSkip =
                tileSource === 'primary'
                  ? animatedTileIds.primary.has(tile.tileId)
                  : animatedTileIds.secondary.has(tile.tileId);
              const skipsForTopPass = pass === 'top' && layer === 1 && shouldSkip;
              const skipsForBottomPass = pass === 'background' && shouldSkip;
              if (skipsForTopPass || skipsForBottomPass) continue;
            }

            const subX = (i % 2) * TILE_SIZE;
            const subY = Math.floor(i / 2) * TILE_SIZE;
            
            // CRITICAL: Palette selection MUST match original logic
            // Choose tileset based on palette index, NOT tile source
            const NUM_PALS_IN_PRIMARY = 6;
            const palette = tile.palette < NUM_PALS_IN_PRIMARY
              ? resolved.tileset.primaryPalettes[tile.palette]
              : resolved.tileset.secondaryPalettes[tile.palette];
            if (!palette) continue;

            // Draw using hardware-accelerated renderer
            renderer.drawTile(
              canvasCtx,
              {
                tileId: tile.tileId,
                destX: screenX + subX,
                destY: screenY + subY,
                palette,
                xflip: tile.xflip,
                yflip: tile.yflip,
                source: tileSource,
              },
              patchedTiles.primary,
              patchedTiles.secondary
            );
          }
        };

        if (pass === 'background') {
          drawLayer(0);
          if (layerType === METATILE_LAYER_TYPE_COVERED) {
            drawLayer(1);
          }
        } else {
          if (layerType === METATILE_LAYER_TYPE_NORMAL || layerType === METATILE_LAYER_TYPE_SPLIT) {
            const shouldRender = !elevationFilter || elevationFilter(resolved.mapTile, tileX, tileY);
            if (shouldRender) {
              drawLayer(1);
            }
          }
        }
      }
    }

    return canvas;
  },
  []
);
```

5. **Update `compositeScene` to use Canvas** (lines 1415-1623):

```typescript
// Replace ImageData refs with Canvas refs
const backgroundCanvasDataRef = useRef<HTMLCanvasElement | null>(null);
const topBelowCanvasDataRef = useRef<HTMLCanvasElement | null>(null);
const topAboveCanvasDataRef = useRef<HTMLCanvasElement | null>(null);

// In compositeScene function:
const needsRender =
  !backgroundCanvasDataRef.current || 
  !topBelowCanvasDataRef.current || 
  !topAboveCanvasDataRef.current || 
  animationFrameChanged || 
  viewChanged ||
  elevationChanged;

if (needsRender) {
  backgroundCanvasDataRef.current = renderPass(ctx, 'background', false, view);
  topBelowCanvasDataRef.current = renderPass(ctx, 'top', false, view, elevationFilter1);
  topAboveCanvasDataRef.current = renderPass(ctx, 'top', false, view, elevationFilter2);
}

// Draw canvases to main canvas
mainCtx.clearRect(0, 0, widthPx, heightPx);

const offsetX = -Math.round(view.subTileOffsetX);
const offsetY = -Math.round(view.subTileOffsetY);

if (backgroundCanvasDataRef.current) {
  mainCtx.drawImage(backgroundCanvasDataRef.current, offsetX, offsetY);
}

if (topBelowCanvasDataRef.current) {
  mainCtx.drawImage(topBelowCanvasDataRef.current, offsetX, offsetY);
}

// ... render door animations, player, effects ...

if (topAboveCanvasDataRef.current) {
  mainCtx.drawImage(topAboveCanvasDataRef.current, offsetX, offsetY);
}
```

6. **Remove old drawTileToImageData** (lines 1244-1280):
```typescript
// DELETE THIS ENTIRE FUNCTION
```

---

## Testing Plan

### Phase 1: Visual Regression Testing

1. **Capture screenshots before optimization**:
   - Slateport City (palette 0 test)
   - Rustboro City (palette 3 test)
   - Sootopolis City (palette 3 test)
   - Fortree City (tree transparency test)
   - Route 119 (water reflection test)

2. **Implement optimization**

3. **Capture screenshots after optimization**

4. **Pixel-perfect comparison**:
   - Use image diff tool to verify 100% match
   - ANY difference = regression, must fix

### Phase 2: Performance Profiling

1. **Before optimization**:
   - Record frame times with Chrome DevTools Performance tab
   - Measure `renderPass` duration
   - Measure `drawTileToImageData` duration

2. **After optimization**:
   - Record frame times with same scenarios
   - Measure `renderPass` duration
   - Verify 5-10× speedup

### Phase 3: Edge Case Testing

- [ ] Animated tiles (flowers, water)
- [ ] Flipped tiles (xflip, yflip)
- [ ] Palette mixing (secondary tile with primary palette)
- [ ] Transparent tiles (palette index 0)
- [ ] Elevation-based rendering splits
- [ ] Map transitions
- [ ] Mobile devices (iPhone, Android)

---

## Risk Mitigation

### Risk 1: Palette Rendering Regression
**Mitigation**: Keep old `drawTileToImageData` as fallback with feature flag

```typescript
const USE_HARDWARE_RENDERING = true; // Feature flag

if (USE_HARDWARE_RENDERING && canvasRendererRef.current) {
  // Use new Canvas renderer
} else {
  // Fall back to old ImageData renderer
}
```

### Risk 2: Browser Compatibility
**Mitigation**: Test on multiple browsers before deploying
- Chrome/Edge (Chromium)
- Firefox
- Safari (iOS and macOS)

### Risk 3: Memory Usage
**Mitigation**: Cache size limit (64 canvases = ~8 MB max)

---

## Success Criteria

✅ **Zero visual regressions** (pixel-perfect match)
✅ **5-10× rendering speedup** (measured in DevTools)
✅ **60 FPS during scrolling** (desktop)
✅ **No memory leaks** (heap stable over time)
✅ **All tests pass** (visual, performance, edge cases)

---

## Implementation Timeline

- **Day 1**: Create TilesetCanvasCache.ts
- **Day 2**: Create CanvasRenderer.ts
- **Day 3**: Modify MapRenderer.tsx (integration)
- **Day 4**: Testing and visual regression verification
- **Day 5**: Performance profiling and optimization

---

## Next Steps

1. Create `src/rendering/` directory
2. Implement TilesetCanvasCache.ts
3. Implement CanvasRenderer.ts
4. Add feature flag to MapRenderer
5. Run visual regression tests





