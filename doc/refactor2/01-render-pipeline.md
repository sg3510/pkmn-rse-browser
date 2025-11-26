# Refactor 2.1: Extract Render Pipeline

## Current State

Rendering logic is scattered across MapRenderer.tsx:
- `renderPass()` - Lines 1451-1578 (ImageData mode)
- `renderPassCanvas()` - Lines 1582-1750 (Canvas mode)
- `compositeScene()` - Lines 1750-2200 (main render loop)

Total: ~750 lines of rendering code in the component.

---

## Target Architecture

```
src/rendering/
├── RenderPipeline.ts      # Main orchestrator (~150 lines)
├── TileRenderer.ts        # Single metatile rendering (~100 lines)
├── PassRenderer.ts        # Render pass (bg/topBelow/topAbove) (~150 lines)
├── LayerCompositor.ts     # Layer composition (~100 lines)
├── ElevationFilter.ts     # Elevation-based filtering (~80 lines)
├── TilesetCanvasCache.ts  # (existing, good as-is)
├── CanvasRenderer.ts      # (existing, good as-is)
├── MapBackingStore.ts     # (existing, good as-is)
└── ViewportBuffer.ts      # (existing, good as-is)
```

---

## New Module: `RenderPipeline.ts`

The main orchestrator that coordinates all rendering.

```typescript
/**
 * RenderPipeline - Orchestrates the 3-pass rendering system
 *
 * This mirrors pokeemerald's BG layer system:
 * - Background pass: BG2 (always behind sprites)
 * - TopBelow pass: BG1 (behind player at certain elevations)
 * - TopAbove pass: BG1 (above player at certain elevations)
 *
 * Reference: pokeemerald/src/bg.c, sElevationToPriority in event_object_movement.c
 */
export class RenderPipeline {
  private passRenderer: PassRenderer;
  private compositor: LayerCompositor;
  private elevationFilter: ElevationFilter;

  // Cached canvases for each pass
  private backgroundCanvas: HTMLCanvasElement | null = null;
  private topBelowCanvas: HTMLCanvasElement | null = null;
  private topAboveCanvas: HTMLCanvasElement | null = null;

  constructor(tilesetCache: TilesetCanvasCache) {
    this.passRenderer = new PassRenderer(tilesetCache);
    this.compositor = new LayerCompositor();
    this.elevationFilter = new ElevationFilter();
  }

  /**
   * Render all three passes for the current frame
   */
  render(
    ctx: CanvasRenderingContext2D,
    world: WorldState,
    view: WorldCameraView,
    playerElevation: number,
    options: RenderOptions
  ): void {
    const { needsFullRender, animationChanged, elevationChanged } = options;

    if (needsFullRender || animationChanged || elevationChanged) {
      // Re-render all passes
      this.backgroundCanvas = this.passRenderer.renderBackground(world, view);

      const filter = this.elevationFilter.createFilter(playerElevation);
      this.topBelowCanvas = this.passRenderer.renderTopLayer(world, view, filter.below);
      this.topAboveCanvas = this.passRenderer.renderTopLayer(world, view, filter.above);
    }

    // Composite to main canvas
    this.compositor.composite(ctx, view, {
      background: this.backgroundCanvas,
      topBelow: this.topBelowCanvas,
      topAbove: this.topAboveCanvas,
    });
  }
}
```

---

## New Module: `PassRenderer.ts`

Renders a single pass (background or top layer).

```typescript
/**
 * PassRenderer - Renders map tiles for a specific layer pass
 *
 * Each metatile has 2 layers (pokeemerald: BG2 and BG1):
 * - Layer 0 (tiles 0-3): Background layer
 * - Layer 1 (tiles 4-7): Top layer
 *
 * Layer rendering depends on MetatileLayerType:
 * - COVERED (1): Both layers in background pass
 * - NORMAL (0): Layer 0 in bg, Layer 1 in top
 * - SPLIT (2): Layer 0 in bg, Layer 1 in top
 *
 * Reference: pokeemerald/include/fieldmap.h METATILE_LAYER_TYPE_*
 */
export class PassRenderer {
  private tileRenderer: TileRenderer;

  constructor(tilesetCache: TilesetCanvasCache) {
    this.tileRenderer = new TileRenderer(tilesetCache);
  }

  renderBackground(world: WorldState, view: WorldCameraView): HTMLCanvasElement {
    const canvas = this.createCanvas(view);
    const ctx = canvas.getContext('2d')!;

    this.forEachVisibleTile(view, (tileX, tileY, screenX, screenY) => {
      const tile = resolveTileAt(world, tileX, tileY);
      if (!tile) return;

      // Background: always draw layer 0
      this.tileRenderer.drawMetatileLayer(ctx, tile, screenX, screenY, 0);

      // COVERED: also draw layer 1 in background
      if (tile.layerType === METATILE_LAYER_TYPE_COVERED) {
        this.tileRenderer.drawMetatileLayer(ctx, tile, screenX, screenY, 1);
      }
    });

    return canvas;
  }

  renderTopLayer(
    world: WorldState,
    view: WorldCameraView,
    elevationFilter: ElevationFilterFn
  ): HTMLCanvasElement {
    const canvas = this.createCanvas(view);
    const ctx = canvas.getContext('2d')!;

    this.forEachVisibleTile(view, (tileX, tileY, screenX, screenY) => {
      const tile = resolveTileAt(world, tileX, tileY);
      if (!tile) return;

      // Top pass: only NORMAL and SPLIT have layer 1 here
      if (tile.layerType === METATILE_LAYER_TYPE_COVERED) return;

      // Apply elevation filter
      if (!elevationFilter(tile.mapTile, tileX, tileY)) return;

      this.tileRenderer.drawMetatileLayer(ctx, tile, screenX, screenY, 1);
    });

    return canvas;
  }

  private forEachVisibleTile(
    view: WorldCameraView,
    callback: (tileX: number, tileY: number, screenX: number, screenY: number) => void
  ): void {
    for (let localY = 0; localY < view.tilesHigh; localY++) {
      const tileY = view.worldStartTileY + localY;
      for (let localX = 0; localX < view.tilesWide; localX++) {
        const tileX = view.worldStartTileX + localX;
        const screenX = localX * METATILE_SIZE;
        const screenY = localY * METATILE_SIZE;
        callback(tileX, tileY, screenX, screenY);
      }
    }
  }
}
```

---

## New Module: `TileRenderer.ts`

Low-level tile drawing. This is the leaf node of the rendering tree.

```typescript
/**
 * TileRenderer - Draws individual tiles to canvas
 *
 * A metatile is 16x16 pixels, composed of 8 tiles (8x8 each):
 * - Layer 0: tiles[0-3] (2x2 grid, bottom layer)
 * - Layer 1: tiles[4-7] (2x2 grid, top layer)
 *
 * Reference: pokeemerald/include/fieldmap.h, Porymap metatile format
 */
export class TileRenderer {
  private tilesetCache: TilesetCanvasCache;

  constructor(cache: TilesetCanvasCache) {
    this.tilesetCache = cache;
  }

  /**
   * Draw one layer (4 tiles) of a metatile
   */
  drawMetatileLayer(
    ctx: CanvasRenderingContext2D,
    resolved: ResolvedTile,
    screenX: number,
    screenY: number,
    layer: 0 | 1
  ): void {
    const metatile = resolved.metatile;
    const patchedTiles = resolved.patchedTiles;

    for (let i = 0; i < 4; i++) {
      const tileIndex = layer * 4 + i;
      const tile = metatile.tiles[tileIndex];

      const subX = (i % 2) * TILE_SIZE;
      const subY = Math.floor(i / 2) * TILE_SIZE;

      this.drawTile(
        ctx,
        tile,
        screenX + subX,
        screenY + subY,
        patchedTiles,
        resolved.palettes
      );
    }
  }

  /**
   * Draw a single 8x8 tile
   */
  private drawTile(
    ctx: CanvasRenderingContext2D,
    tile: TileData,
    destX: number,
    destY: number,
    patchedTiles: TilesetBuffers,
    palettes: PaletteSet
  ): void {
    const source = tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';
    const tiles = source === 'primary' ? patchedTiles.primary : patchedTiles.secondary;
    const effectiveTileId = source === 'secondary'
      ? tile.tileId % SECONDARY_TILE_OFFSET
      : tile.tileId;

    const palette = this.getPalette(tile.palette, palettes);
    if (!palette) return;

    const tilesetCanvas = this.tilesetCache.getPalettizedCanvas(
      source, tiles, palette, 128, Math.ceil(tiles.length / 128)
    );

    const srcX = (effectiveTileId % TILES_PER_ROW) * TILE_SIZE;
    const srcY = Math.floor(effectiveTileId / TILES_PER_ROW) * TILE_SIZE;

    // Fast path: no flip
    if (!tile.xflip && !tile.yflip) {
      ctx.drawImage(tilesetCanvas, srcX, srcY, TILE_SIZE, TILE_SIZE, destX, destY, TILE_SIZE, TILE_SIZE);
      return;
    }

    // Slow path: handle flips
    ctx.save();
    ctx.translate(destX, destY);
    ctx.scale(tile.xflip ? -1 : 1, tile.yflip ? -1 : 1);
    ctx.translate(tile.xflip ? -TILE_SIZE : 0, tile.yflip ? -TILE_SIZE : 0);
    ctx.drawImage(tilesetCanvas, srcX, srcY, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
    ctx.restore();
  }
}
```

---

## New Module: `ElevationFilter.ts`

Encapsulates the elevation-based rendering logic.

```typescript
/**
 * ElevationFilter - Determines which tiles go in topBelow vs topAbove
 *
 * Based on pokeemerald's sElevationToPriority (event_object_movement.c:389):
 * - Elevation 0-2: Priority 2 (below BG1)
 * - Elevation 3-4: Priority 2
 * - Elevation 5+:  Priority 1 (above BG1)
 *
 * Bridge tiles use elevation 12-15 for special rendering.
 */
export class ElevationFilter {
  /**
   * Create filter functions for below/above player passes
   */
  createFilter(playerElevation: number): { below: ElevationFilterFn; above: ElevationFilterFn } {
    const playerPriority = getSpritePriorityForElevation(playerElevation);
    const playerAboveTopLayer = playerPriority <= 1;

    return {
      below: (mapTile, tileX, tileY) => {
        // Vertical objects (trees) always go to topAbove
        if (this.isVerticalObject(tileX, tileY)) return false;

        // Player below top layer -> nothing in topBelow
        if (!playerAboveTopLayer) return false;

        // Same elevation + blocked -> goes to topAbove
        if (mapTile.elevation === playerElevation && mapTile.collision === 1) return false;

        return true;
      },

      above: (mapTile, tileX, tileY) => {
        // Vertical objects always render above
        if (this.isVerticalObject(tileX, tileY)) return true;

        // Player above top layer
        if (playerAboveTopLayer) {
          // Only blocked tiles at same elevation
          return mapTile.elevation === playerElevation && mapTile.collision === 1;
        }

        // Player below -> all top tiles render above
        return true;
      },
    };
  }
}
```

---

## New Module: `LayerCompositor.ts`

Handles final composition to the main canvas.

```typescript
/**
 * LayerCompositor - Composites rendered layers to screen
 *
 * Render order (back to front):
 * 1. Background (BG2)
 * 2. TopBelow (BG1, behind player)
 * 3. [Player renders here]
 * 4. TopAbove (BG1, above player)
 */
export class LayerCompositor {
  composite(
    ctx: CanvasRenderingContext2D,
    view: WorldCameraView,
    layers: {
      background: HTMLCanvasElement | null;
      topBelow: HTMLCanvasElement | null;
      topAbove?: HTMLCanvasElement | null;
    }
  ): void {
    const offsetX = -Math.round(view.subTileOffsetX);
    const offsetY = -Math.round(view.subTileOffsetY);

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (layers.background) {
      ctx.drawImage(layers.background, offsetX, offsetY);
    }

    if (layers.topBelow) {
      ctx.drawImage(layers.topBelow, offsetX, offsetY);
    }
  }

  compositeTopAbove(
    ctx: CanvasRenderingContext2D,
    view: WorldCameraView,
    topAbove: HTMLCanvasElement | null
  ): void {
    if (!topAbove) return;

    const offsetX = -Math.round(view.subTileOffsetX);
    const offsetY = -Math.round(view.subTileOffsetY);
    ctx.drawImage(topAbove, offsetX, offsetY);
  }
}
```

---

## Migration Steps

1. **Create new files** in `src/rendering/`
2. **Extract types** to `src/rendering/types.ts`
3. **Move code** from MapRenderer preserving exact logic
4. **Add thin wrapper** in MapRenderer that uses RenderPipeline
5. **Test** - visual output must be identical
6. **Delete old code** from MapRenderer

---

## Testing

```typescript
// Unit test for ElevationFilter
describe('ElevationFilter', () => {
  it('puts vertical objects in topAbove', () => {
    const filter = new ElevationFilter();
    const { below, above } = filter.createFilter(3);

    // Mock vertical object check
    expect(above({ elevation: 0, collision: 0 }, 0, 0)).toBe(true);
  });
});
```
