---
title: TypeScript/React Rendering Pipeline
status: reference
last_verified: 2026-01-13
---

# TypeScript/React Rendering Pipeline

This document describes the current browser-based rendering implementation.

## Overview

The rendering system is **Canvas 2D-based** with a modular architecture that separates rendering logic from React. Key characteristics:

- **3-pass rendering** mimicking GBA's BG layer system
- **LRU canvas caching** for palette-applied tilesets
- **requestAnimationFrame** with fixed timestep accumulator
- **React orchestration** with imperative canvas rendering

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     MapRenderer.tsx (React)                     │
│  - Manages game state, player controller                        │
│  - Orchestrates rendering and UI                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      GameLoop.ts                                │
│  - requestAnimationFrame loop                                   │
│  - Fixed timestep (60 FPS) with accumulator                     │
│  - Calls UpdateCoordinator and triggers renders                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    RenderPipeline.ts                            │
│  - 3-pass rendering orchestrator                                │
│  - Coordinates PassRenderer, LayerCompositor                    │
│  - Handles dirty checking and caching                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  PassRenderer │   │ TileRenderer  │   │LayerCompositor│
│  - Per-pass   │   │ - 8x8 tiles   │   │ - Combines    │
│    tile loops │   │ - Flip logic  │   │   all passes  │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │
        │                   ▼
        │           ┌───────────────────┐
        │           │TilesetCanvasCache │
        │           │ - LRU cache       │
        │           │ - Palette→Canvas  │
        │           └───────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                    ElevationFilter.ts                          │
│  - Splits topBelow/topAbove based on player elevation          │
│  - Handles bridge rendering, vertical objects                  │
└───────────────────────────────────────────────────────────────┘
```

## 3-Pass Rendering System

### Pass Structure (mirrors GBA BG layers)

| Pass | GBA Equivalent | Content |
|------|----------------|---------|
| **Background** | BG2 | Layer 0 of all metatiles + Layer 1 of COVERED metatiles |
| **TopBelow** | BG1 (behind player) | Layer 1 tiles at lower elevation than player |
| **TopAbove** | BG1 (in front) | Layer 1 tiles at same/higher elevation |

### Metatile Structure

```
┌───────────────────────────────────────────────────────────┐
│  Metatile (16x16 pixels)                                  │
├───────────────────────────────────────────────────────────┤
│  Layer 1 (top):    tiles[4] tiles[5]                      │
│                    tiles[6] tiles[7]                      │
├───────────────────────────────────────────────────────────┤
│  Layer 0 (bottom): tiles[0] tiles[1]                      │
│                    tiles[2] tiles[3]                      │
└───────────────────────────────────────────────────────────┘
Each tile = 8x8 pixels, 4bpp (16 colors from palette)
```

### Rendering Flow

```typescript
// RenderPipeline.ts
render(context: RenderContext): RenderResult {
  // 1. Render each pass to offscreen canvas
  const bgCanvas = this.passRenderer.renderPass('background', context);
  const topBelowCanvas = this.passRenderer.renderPass('topBelow', context);
  const topAboveCanvas = this.passRenderer.renderPass('topAbove', context);

  // 2. Composite layers to screen
  //    Background → Sprites (behind) → TopBelow → Player → TopAbove
  this.compositor.composite(screenCtx, {
    background: bgCanvas,
    topBelow: topBelowCanvas,
    topAbove: topAboveCanvas,
    sprites: spriteLayer
  });
}
```

## Tile Rendering

### TileRenderer.ts

The core tile drawing function with flip optimization:

```typescript
drawTile(ctx, tilesetCanvas, tileIndex, destX, destY, xflip, yflip, palette) {
  const srcX = (tileIndex % TILES_PER_ROW) * TILE_SIZE;
  const srcY = Math.floor(tileIndex / TILES_PER_ROW) * TILE_SIZE;

  if (!xflip && !yflip) {
    // FAST PATH: Direct draw (no transform overhead)
    ctx.drawImage(tilesetCanvas, srcX, srcY, 8, 8, destX, destY, 8, 8);
  } else {
    // SLOW PATH: Flipped tiles need canvas transforms
    ctx.save();
    ctx.translate(destX, destY);
    ctx.scale(xflip ? -1 : 1, yflip ? -1 : 1);
    ctx.translate(xflip ? -8 : 0, yflip ? -8 : 0);
    ctx.drawImage(tilesetCanvas, srcX, srcY, 8, 8, 0, 0, 8, 8);
    ctx.restore();
  }
}
```

### Performance Impact

- **Non-flipped tiles**: ~95% of tiles, use fast path
- **Flipped tiles**: ~5% of tiles, 2-3x slower due to save/restore
- **Optimization**: Avoiding `save()/restore()` yields ~2x speedup

## Palette Caching System

### TilesetCanvasCache.ts

Converts indexed color tilesets to RGB canvases with LRU eviction:

```typescript
class TilesetCanvasCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize = 64;  // ~8MB memory budget

  getOrCreate(tileset: Tileset, palette: Palette): HTMLCanvasElement {
    const key = `${tileset.id}:${tilesetHash}:${paletteHash}`;

    if (this.cache.has(key)) {
      // Move to end (LRU)
      const entry = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.canvas;
    }

    // Create new canvas with palette applied
    const canvas = this.createPaletteCanvas(tileset, palette);
    this.cache.set(key, { canvas, lastUsed: Date.now() });

    // Evict oldest if over limit
    if (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }

    return canvas;
  }
}
```

### Palette Application (One-Time Software Rendering)

```typescript
createPaletteCanvas(tileset: Tileset, palette: Palette): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // Pre-parse palette colors (optimization)
  const paletteRGB = new Uint8Array(16 * 3);
  for (let i = 0; i < 16; i++) {
    const hex = palette.colors[i];
    paletteRGB[i * 3] = parseInt(hex.slice(1, 3), 16);
    paletteRGB[i * 3 + 1] = parseInt(hex.slice(3, 5), 16);
    paletteRGB[i * 3 + 2] = parseInt(hex.slice(5, 7), 16);
  }

  // Apply palette to each pixel
  for (let i = 0; i < indexedPixels.length; i++) {
    const paletteIndex = indexedPixels[i];
    const pixelOffset = i * 4;

    if (paletteIndex === 0) {
      // Transparent (palette index 0)
      data[pixelOffset + 3] = 0;
    } else {
      data[pixelOffset] = paletteRGB[paletteIndex * 3];
      data[pixelOffset + 1] = paletteRGB[paletteIndex * 3 + 1];
      data[pixelOffset + 2] = paletteRGB[paletteIndex * 3 + 2];
      data[pixelOffset + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
```

## Animation System

### Animation Timer

```typescript
// AnimationTimer.ts
class AnimationTimer {
  private frameCounter = 0;
  private readonly FRAME_MS = 1000 / 60;

  update(deltaMs: number): void {
    this.accumulator += deltaMs;
    while (this.accumulator >= this.FRAME_MS) {
      this.frameCounter++;
      this.accumulator -= this.FRAME_MS;
    }
  }

  getCurrentFrame(): number {
    return this.frameCounter;
  }
}
```

### Tileset Animation Configuration

```typescript
// tilesetAnimations.ts
const waterAnimation = {
  id: 'gTileset_General:water',
  tileset: 'primary',
  frames: [
    'water/0.png', 'water/1.png', 'water/2.png', 'water/3.png',
    'water/4.png', 'water/5.png', 'water/6.png', 'water/7.png'
  ],
  interval: 16,  // Update every 16 game frames (~267ms)
  destinations: [{ destStart: 432 }]  // Tiles 432-439
};
```

### Animation Runtime

```typescript
// animations.ts
function getAnimationFrame(config: AnimationConfig, gameFrame: number): number {
  const cycleLength = config.frames.length * config.interval;
  const cyclePosition = gameFrame % cycleLength;
  return Math.floor(cyclePosition / config.interval);
}
```

## Game Loop

### Fixed Timestep with Accumulator

```typescript
// GameLoop.ts
class GameLoop {
  private readonly FRAME_MS = 1000 / 60;  // 16.67ms
  private accumulator = 0;

  private tick = (currentTime: number) => {
    const deltaMs = currentTime - this.lastTime;
    this.lastTime = currentTime;
    this.accumulator += deltaMs;

    // Process multiple updates if frame rate drops
    while (this.accumulator >= this.FRAME_MS) {
      this.animationTimer.update(this.FRAME_MS);

      const result = this.updateCoordinator.update(
        this.FRAME_MS,
        currentTime
      );
      combinedResult = combineResults(combinedResult, result);

      this.accumulator -= this.FRAME_MS;
    }

    // Render once per RAF, even if multiple updates occurred
    this.onFrame(this.state.get(), combinedResult, deltaMs, currentTime);

    this.rafId = requestAnimationFrame(this.tick);
  };
}
```

### Key Feature: Catch-Up Logic

If the browser drops frames (e.g., tab backgrounded), the accumulator builds up. The loop runs multiple updates to catch up, but only renders once.

## Elevation & Layer Priority

### ElevationFilter.ts

Maps GBA sprite priorities to layer visibility:

```typescript
// GBA elevation → sprite priority mapping
const ELEVATION_TO_PRIORITY: Record<number, number> = {
  0: 2, 1: 2, 2: 2, 3: 2,   // Below BG1
  4: 1, 5: 2, 6: 1, 7: 2,   // Mixed
  8: 1, 9: 2, 10: 1, 11: 2,
  12: 1, 13: 0, 14: 0, 15: 2  // 13-14 above all
};
```

### Layer Filtering

```typescript
createFilters(playerElevation: number, playerY: number) {
  return {
    topBelow: (tile, x, y) => {
      // Vertical objects (trees) always render above
      if (isVerticalObject(x, y)) return false;

      // Player below top layer → all top tiles above player
      if (!playerAboveTopLayer) return false;

      // Blocked tiles at player level render above
      if (tile.elevation === playerElevation && tile.collision === 1)
        return false;

      return true;  // Render behind player
    },

    topAbove: (tile, x, y) => {
      if (isVerticalObject(x, y)) return true;
      // ... inverse logic
      return true;  // Render in front of player
    }
  };
}
```

## Sprite/Object Rendering

### Render Order

1. Background pass
2. Field effects behind player (grass, footprints, water ripples)
3. Item balls behind player
4. NPCs behind player (Y-sorted)
5. Grass effects over NPCs
6. **Player sprite**
7. Field effects in front
8. Item balls in front
9. NPCs in front (Y-sorted)
10. TopAbove pass
11. Priority 0 objects (elevation 13-14)

### NPC Renderer

```typescript
renderNPC(ctx: CanvasRenderingContext2D, npc: NPC, viewportOffset: Point) {
  // Viewport culling
  if (!isInViewport(npc.position, viewportOffset, viewportSize)) {
    return;
  }

  // Get frame based on direction and animation state
  const frame = npc.sprite.frames[npc.direction][npc.animFrame];

  // Draw with optional horizontal flip (east-facing)
  if (npc.direction === 'east') {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(frame, -x - width, y);
    ctx.restore();
  } else {
    ctx.drawImage(frame, x, y);
  }
}
```

## Current Optimizations

### 1. Canvas Caching
- Pre-rendered palette canvases (LRU, 64 entries)
- One-time software rendering for palette application
- GPU-accelerated `drawImage()` for all subsequent draws

### 2. Fast Path for Non-Flipped Tiles
- Skip `save()/restore()` for ~95% of tiles
- ~2x speedup on tile-heavy frames

### 3. Conditional Pass Re-rendering
- Skip passes if:
  - View position unchanged
  - Animation frame unchanged
  - Player elevation unchanged

### 4. Hash Caching
- `WeakMap` for tileset/palette hashes
- Samples every 1000th byte (avoids full scan)
- Auto garbage-collected

### 5. Object Culling
- Skip off-screen NPCs/items
- Field effect visibility flags

## Current Bottlenecks

### 1. Full Pass Re-rendering
If **any** animation changes, **all 3 passes** re-render. No dirty rectangle tracking.

### 2. Palette Cache Misses
Water reflections and weather effects create new palette combinations, causing cache misses.

### 3. Software Palette Application
Per-pixel palette lookup still runs in software, even with pre-parsed colors.

### 4. Canvas Memory Limits
Large maps (40x40+ tiles) strain Canvas 2D memory. No WebGL fallback.

### 5. No Worker Thread Usage
All rendering on main thread. Palette generation could be offloaded.

## File Structure

```
src/
├── components/
│   ├── MapRenderer.tsx         # React coordinator (1000+ lines)
│   └── map/
│       └── renderers/
│           ├── ObjectRenderer.ts
│           ├── DebugRenderer.ts
│           └── DoorRenderer.ts
├── rendering/
│   ├── RenderPipeline.ts       # Main orchestrator
│   ├── PassRenderer.ts         # Per-pass rendering
│   ├── TileRenderer.ts         # 8x8 tile drawing
│   ├── TilesetCanvasCache.ts   # LRU palette cache
│   ├── LayerCompositor.ts      # Layer composition
│   ├── ElevationFilter.ts      # Layer splitting
│   └── types.ts
├── engine/
│   ├── GameLoop.ts             # RAF + fixed timestep
│   ├── AnimationTimer.ts       # Frame counter
│   └── UpdateCoordinator.ts    # Hook-based updates
└── utils/
    ├── tilesetUtils.ts         # Runtime tileset data
    ├── animations.ts           # Animation logic
    └── camera.ts               # Viewport calculation
```
