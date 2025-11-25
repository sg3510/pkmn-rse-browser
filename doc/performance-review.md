# Performance Review: Rendering & Asset Management

## Executive Summary

The current rendering implementation relies heavily on software-based pixel manipulation (writing directly to `ImageData` buffers) rather than leveraging the browser's hardware-accelerated Canvas 2D API or WebGL. While this approach provides pixel-perfect control for palette swapping and transparency, it is the primary performance bottleneck. Additionally, there is significant garbage collection (GC) pressure due to frequent object allocation in the render loop.

## Critical Bottlenecks

### 1. Software Rendering Loop (`renderPass` & `drawTileToImageData`)
**Location**: `src/components/MapRenderer.tsx`

The function `drawTileToImageData` manually iterates over every pixel (8x8) of every tile in the viewport to copy palette-mapped colors into an `ImageData` array.
- **Issue**: This runs on the CPU. For a standard viewport, this involves processing tens of thousands of pixels per frame when the camera moves.
- **Impact**: High CPU usage, dropped frames on lower-end devices, and increased battery consumption.
- **Code Reference**:
  ```typescript
  // src/components/MapRenderer.tsx
  const drawTileToImageData = (...) => {
    // ... nested loops over TILE_SIZE (8x8) ...
    // ... manual bit manipulation and array writes ...
  }
  ```

### 2. Memory Churn & Garbage Collection
**Location**: `src/components/MapRenderer.tsx`

- **ImageData Allocation**: `new ImageData(widthPx, heightPx)` is called inside `renderPass`. When the player moves (`viewChanged`), this runs every frame, creating large byte arrays that must be garbage collected.
- **Closure Creation**: The `drawLayer` function is defined *inside* the tile loop in `renderPass`, creating a new function closure for every tile iteration.
- **Field Effects**: `FieldEffectManager.getEffectsForRendering()` creates a new array of objects every frame, contributing to GC pressure.

### 3. Full Viewport Re-rendering
**Location**: `src/components/MapRenderer.tsx`

The engine re-renders the entire viewport's `ImageData` whenever the view coordinates change (player movement).
- **Issue**: Most of the map is static. Re-constructing the pixel buffer for the background layer every frame is unnecessary.
- **Impact**: Wasted cycles redrawing static tiles.

## Animation Performance

### Tileset Animations
**Location**: `src/components/MapRenderer.tsx`, `src/utils/animations.ts`

- **Mechanism**: The engine patches the source `Uint8Array` tileset data when animations update.
- **Verdict**: This is actually a reasonable approach for tile-based animations (patch once, draw many). However, because the drawing downstream is software-based, the benefit is limited. If we switch to `drawImage`, we would need to update the cached source canvas instead of a byte array.

### Field Effects (Grass, Sand)
**Location**: `src/game/FieldEffectManager.ts`

- **Issue**: The method `getEffectsForRendering` returns a fresh array of objects every call.
  ```typescript
  // src/game/FieldEffectManager.ts
  getEffectsForRendering(): FieldEffectForRendering[] {
    const results: FieldEffectForRendering[] = [];
    // ... creates new objects ...
    return results;
  }
  ```
- **Impact**: Minor GC churn. In a busy map with many grass tiles, this adds up.

## Asset Management

### Asset Loading
**Location**: `src/services/MapManager.ts`, `src/utils/mapLoader.ts`

- **Status**: Assets (tilesets, maps) are cached in `MapManager` (`mapCache`, `tilesetCache`). This is good.
- **Duplicate Images**: `ensureDoorSprite` and similar helpers in `MapRenderer` create new `Image` objects. While they use a ref for caching, the initial creation logic is scattered.

## Recommended Improvements

### High Impact

1.  **Switch to Canvas `drawImage` API**
    *   **Proposal**: Instead of `drawTileToImageData`, pre-render the tilesets (primary and secondary) into `OffscreenCanvas` or standard `Canvas` elements *with their palettes applied*.
    *   **Challenge**: Tilesets use indexed colors.
    *   **Solution**: Generate a cached Canvas for each palette (usually 6 primary + 6 secondary). Since palettes are finite, we can store `Map<PaletteID, Canvas>`.
    *   **Expected Gain**: Massive. Browsers optimize `drawImage` heavily (often GPU-accelerated).

2.  **Implement Tiled Backing Store**
    *   **Proposal**: Render the static map layers (Background, Bottom) into a large offscreen canvas (or chunks) that covers the entire map (or a large area around the player).
    *   **Logic**: When the player moves, simply `drawImage` the relevant slice of the large canvas onto the viewport. Only re-render the backing store when the player moves excessively far or into a new chunk.
    *   **Expected Gain**: Eliminates tile-by-tile iteration during movement.

### Medium Impact

3.  **Optimize Field Effect Rendering**
    *   **Proposal**: Reuse object pools for `FieldEffectForRendering` or simply iterate the `effects` Map directly in the renderer instead of converting to an array.

4.  **Reduce GC in Render Loop**
    *   **Proposal**: Move `drawLayer` definition outside the loop. Reuse a single `ImageData` buffer (or Canvas) instead of creating `new ImageData` every frame.

## Proposed Implementation Plan

1.  **Phase 1: Canvas-based Tileset Cache**
    *   Create a `TilesetRenderer` class.
    *   On load, generate `HTMLCanvasElement`s for the tilesets.
    *   Since different metatiles use different palettes, we might need to generate "Palettized Tilesets".
    *   Update `MapRenderer` to use `ctx.drawImage` referencing these cached tilesets.

2.  **Phase 2: Backing Store**
    *   Create a large `OffscreenCanvas` (e.g., 512x512 or map size).
    *   Render the static background to this canvas once.
    *   In `render`, copy from this canvas.



