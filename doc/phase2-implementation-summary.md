# Phase 2 Implementation: Chunk-Based Backing Store

## Overview

We have implemented **Performance Idea #2**: a chunk-based backing store to optimize scrolling performance.

### Changes

1.  **New `ChunkManager`**:
    *   Splits the world into 256x256 pixel chunks (16x16 metatiles).
    *   Caches rendered chunks in offscreen canvases.
    *   Handles precise sub-pixel scrolling by drawing chunks at `WorldPixel - CameraPixel`.
    *   Uses LRU caching (max 50 chunks) to manage memory.

2.  **MapRenderer Integration**:
    *   Added `USE_CHUNK_CACHE` feature flag (default: `true`).
    *   Refactored tile drawing logic into `drawRegionToContext`.
    *   Updated `compositeScene` to use `chunkManager.drawLayer` for:
        *   Background Layer
        *   Top Layer (Below Player)
        *   Top Layer (Above Player)

### Key Improvements

*   **Scrolling Performance**: When scrolling, we no longer iterate 150 metatiles x 8 tiles. Instead, we blit ~4-6 pre-rendered large canvases. This should keep frame times extremely low (< 1ms).
*   **Animation Support**: Chunks include `animHash` in their cache key. When tiles animate (every ~250ms), new chunks are rendered. This balances static scrolling speed with dynamic content.
*   **Coordinate Precision**: Fixed previous "8x8 offset" bugs by strictly using `cameraWorldX` floating point coordinates for `drawImage` destination.

### How to Test

1.  **Enable Chunks**: Ensure `const USE_CHUNK_CACHE = true` in `src/components/MapRenderer.tsx`.
2.  **Scroll**: Move the player. Scrolling should be buttery smooth (60 FPS).
3.  **Observe Animations**: Flowers and water should still animate correctly.
4.  **Verify Alignment**: Player sprite should be perfectly aligned with the grid (no sliding or offset).
5.  **Check Debug Console**: Look for `[PERF] Chunk-based backing store enabled`.

### Rollback

To disable chunks and revert to Phase 1 (Per-frame Hardware Rendering):
```typescript
const USE_CHUNK_CACHE = false;
```

