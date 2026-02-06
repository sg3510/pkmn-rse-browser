---
title: Rendering Optimization Recommendations
status: reference
last_verified: 2026-01-13
---

# Rendering Optimization Recommendations

This document outlines optimization strategies for improving rendering performance, especially for large viewports (40x40 tiles) with heavy animation (water, ripples, weather effects).

## Executive Summary

| Optimization | Impact | Effort | Priority |
|--------------|--------|--------|----------|
| Dirty Rectangle Tracking | 5-10x for animated maps | Medium | **HIGH** |
| WebGL Tile Renderer | 10-50x overall | High | **HIGH** |
| GPU Palette Lookup | 3-5x palette ops | Medium | **MEDIUM** |
| OffscreenCanvas Workers | 2-3x parallelism | Medium | **MEDIUM** |
| Animation Frame Pre-render | 2x animation | Low | **LOW** |
| Texture Atlases | 2-3x draw calls | Medium | **MEDIUM** |

## Current Performance Profile

### Baseline: 20x20 Viewport
- **Tiles per frame**: 400 metatiles × 8 tiles = 3,200 tile draws
- **With animation**: Full re-render every animation frame
- **Measured**: ~4-8ms per frame (acceptable)

### Target: 40x40 Viewport
- **Tiles per frame**: 1,600 metatiles × 8 tiles = 12,800 tile draws
- **With animation**: 4x more tiles to re-render
- **Projected**: ~16-32ms per frame (unacceptable)

---

## HIGH Priority Optimizations

### 1. Dirty Rectangle Tracking

**Problem**: Any animation change triggers full pass re-render.

**Solution**: Track which tiles are animated and only re-render affected regions.

```typescript
interface DirtyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

class DirtyRectangleTracker {
  private dirtyRegions: DirtyRegion[] = [];
  private animatedTilePositions: Map<number, Set<{x: number, y: number}>>;

  markAnimatedTiles(tileId: number, positions: {x: number, y: number}[]) {
    this.animatedTilePositions.set(tileId, new Set(positions));
  }

  onAnimationFrame(changedTileIds: number[]): DirtyRegion[] {
    const regions: DirtyRegion[] = [];

    for (const tileId of changedTileIds) {
      const positions = this.animatedTilePositions.get(tileId);
      if (positions) {
        for (const pos of positions) {
          regions.push({
            x: pos.x * METATILE_SIZE,
            y: pos.y * METATILE_SIZE,
            width: METATILE_SIZE,
            height: METATILE_SIZE
          });
        }
      }
    }

    // Merge overlapping regions
    return this.mergeRegions(regions);
  }

  private mergeRegions(regions: DirtyRegion[]): DirtyRegion[] {
    // Combine adjacent/overlapping rectangles
    // Reduces draw calls while keeping affected area minimal
  }
}
```

**Implementation Steps**:
1. At map load, scan for animated tile positions
2. Store position → animation mapping
3. On animation tick, mark only those positions dirty
4. Render pass clips to union of dirty rectangles
5. Copy only dirty regions to composite canvas

**Expected Impact**: 5-10x improvement for maps with localized animations (water edges, flowers).

### 2. WebGL Tile Renderer

**Problem**: Canvas 2D draws tiles one-by-one with CPU overhead.

**Solution**: WebGL can draw thousands of tiles in a single batch.

```typescript
class WebGLTileRenderer {
  private gl: WebGL2RenderingContext;
  private tileProgram: WebGLProgram;
  private tilesetTexture: WebGLTexture;
  private instanceBuffer: WebGLBuffer;

  // Instance data per tile: x, y, tileIndex, paletteIndex, flags
  private instanceData: Float32Array;

  render(tiles: TileInstance[], viewport: Viewport) {
    // 1. Update instance buffer with all visible tiles
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const offset = i * 5;
      this.instanceData[offset + 0] = tile.x;
      this.instanceData[offset + 1] = tile.y;
      this.instanceData[offset + 2] = tile.tileIndex;
      this.instanceData[offset + 3] = tile.paletteIndex;
      this.instanceData[offset + 4] = tile.flags;  // xflip, yflip packed
    }

    // 2. Upload to GPU (single transfer)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.instanceData);

    // 3. Draw ALL tiles in ONE call
    this.gl.drawArraysInstanced(
      this.gl.TRIANGLE_STRIP,
      0,
      4,  // 4 vertices per tile quad
      tiles.length  // Number of instances
    );
  }
}
```

**Vertex Shader**:
```glsl
#version 300 es
in vec2 a_position;      // Quad corner (0,0), (1,0), (0,1), (1,1)
in vec4 a_instance;      // x, y, tileIndex, paletteIndex
in float a_flags;        // Packed flip flags

uniform vec2 u_viewport;
uniform vec2 u_tilesetSize;

out vec2 v_texCoord;
flat out int v_paletteIndex;

void main() {
  // Decode flip flags
  bool xflip = (int(a_flags) & 1) != 0;
  bool yflip = (int(a_flags) & 2) != 0;

  // Position in viewport
  vec2 pos = a_instance.xy + a_position * 8.0;
  gl_Position = vec4(pos / u_viewport * 2.0 - 1.0, 0.0, 1.0);
  gl_Position.y = -gl_Position.y;

  // Texture coordinate from tile index
  float tileX = mod(a_instance.z, u_tilesetSize.x);
  float tileY = floor(a_instance.z / u_tilesetSize.x);

  vec2 tc = (vec2(tileX, tileY) + a_position) / u_tilesetSize;

  // Apply flip
  if (xflip) tc.x = (tileX + 1.0 - a_position.x) / u_tilesetSize.x;
  if (yflip) tc.y = (tileY + 1.0 - a_position.y) / u_tilesetSize.y;

  v_texCoord = tc;
  v_paletteIndex = int(a_instance.w);
}
```

**Fragment Shader (with GPU palette lookup)**:
```glsl
#version 300 es
precision highp float;

in vec2 v_texCoord;
flat in int v_paletteIndex;

uniform sampler2D u_tileset;      // Indexed color (R channel = palette index)
uniform sampler2D u_palette;      // 16 palettes × 16 colors

out vec4 fragColor;

void main() {
  // Read palette index from tileset
  float index = texture(u_tileset, v_texCoord).r * 255.0;

  // Transparency check (index 0)
  if (index < 0.5) {
    discard;
  }

  // Look up color from palette texture
  // Palette texture is 16 wide (colors) × 16 tall (palettes)
  vec2 paletteCoord = vec2(
    (index + 0.5) / 16.0,
    (float(v_paletteIndex) + 0.5) / 16.0
  );

  fragColor = texture(u_palette, paletteCoord);
}
```

**Expected Impact**: 10-50x improvement. 12,800 tiles in one draw call vs 12,800 separate `drawImage()` calls.

---

## MEDIUM Priority Optimizations

### 3. GPU Palette Lookup

**Problem**: Palette application is per-pixel CPU work.

**Solution**: Store indexed tileset, do palette lookup in fragment shader (see WebGL section above).

**Standalone Canvas 2D version** (if not using WebGL):

```typescript
// Use ImageBitmap for better performance
async function createIndexedTilesetBitmap(tileset: Tileset): Promise<ImageBitmap> {
  // Store palette indices in R channel only
  const canvas = new OffscreenCanvas(tileset.width, tileset.height);
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(tileset.width, tileset.height);

  for (let i = 0; i < tileset.pixels.length; i++) {
    imageData.data[i * 4] = tileset.pixels[i];  // R = palette index
    imageData.data[i * 4 + 1] = 0;
    imageData.data[i * 4 + 2] = 0;
    imageData.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return createImageBitmap(canvas);
}
```

**Expected Impact**: Eliminates per-pixel palette lookup (done on GPU instead).

### 4. OffscreenCanvas + Web Workers

**Problem**: All rendering blocks main thread.

**Solution**: Move pass rendering to workers.

```typescript
// Main thread
class ParallelRenderPipeline {
  private workers: Worker[] = [];
  private canvases: OffscreenCanvas[] = [];

  constructor() {
    // Create 3 workers for 3 passes
    for (let i = 0; i < 3; i++) {
      const canvas = document.createElement('canvas').transferControlToOffscreen();
      const worker = new Worker('pass-renderer-worker.js');
      worker.postMessage({ type: 'init', canvas }, [canvas]);

      this.workers.push(worker);
      this.canvases.push(canvas);
    }
  }

  async render(context: RenderContext): Promise<RenderResult> {
    // Dispatch all 3 passes in parallel
    const promises = [
      this.renderPassAsync(0, 'background', context),
      this.renderPassAsync(1, 'topBelow', context),
      this.renderPassAsync(2, 'topAbove', context)
    ];

    const [bg, topBelow, topAbove] = await Promise.all(promises);

    // Composite on main thread (or in another worker)
    return this.composite(bg, topBelow, topAbove);
  }

  private renderPassAsync(
    workerIndex: number,
    pass: string,
    context: RenderContext
  ): Promise<ImageBitmap> {
    return new Promise((resolve) => {
      const worker = this.workers[workerIndex];

      worker.onmessage = (e) => {
        if (e.data.type === 'rendered') {
          resolve(e.data.bitmap);
        }
      };

      worker.postMessage({
        type: 'render',
        pass,
        viewport: context.viewport,
        mapData: context.mapData,  // Transfer or SharedArrayBuffer
        tilesetData: context.tilesetData
      });
    });
  }
}
```

**Worker (pass-renderer-worker.js)**:
```typescript
let canvas: OffscreenCanvas;
let ctx: OffscreenCanvasRenderingContext2D;

self.onmessage = async (e) => {
  if (e.data.type === 'init') {
    canvas = e.data.canvas;
    ctx = canvas.getContext('2d')!;
  }

  if (e.data.type === 'render') {
    const { pass, viewport, mapData, tilesetData } = e.data;

    // Render pass to offscreen canvas
    renderPass(ctx, pass, viewport, mapData, tilesetData);

    // Send back as ImageBitmap
    const bitmap = await createImageBitmap(canvas);
    self.postMessage({ type: 'rendered', bitmap }, [bitmap]);
  }
};
```

**Expected Impact**: 2-3x improvement by parallelizing pass rendering.

### 5. Texture Atlases

**Problem**: Multiple tileset textures = multiple GPU state changes.

**Solution**: Pack all tilesets into one atlas.

```typescript
class TilesetAtlas {
  private atlas: HTMLCanvasElement;
  private tilesetOffsets: Map<string, {x: number, y: number}> = new Map();

  constructor(tilesets: Tileset[]) {
    // Calculate atlas size (power of 2 for GPU efficiency)
    const totalTiles = tilesets.reduce((sum, t) => sum + t.tileCount, 0);
    const atlasWidth = Math.ceil(Math.sqrt(totalTiles)) * 8;
    const atlasHeight = atlasWidth;

    this.atlas = document.createElement('canvas');
    this.atlas.width = atlasWidth;
    this.atlas.height = atlasHeight;

    const ctx = this.atlas.getContext('2d')!;

    // Pack tilesets into atlas
    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;

    for (const tileset of tilesets) {
      if (currentX + tileset.width > atlasWidth) {
        currentX = 0;
        currentY += rowHeight;
        rowHeight = 0;
      }

      ctx.drawImage(tileset.canvas, currentX, currentY);
      this.tilesetOffsets.set(tileset.id, { x: currentX, y: currentY });

      currentX += tileset.width;
      rowHeight = Math.max(rowHeight, tileset.height);
    }
  }

  getTileCoords(tilesetId: string, tileIndex: number): {x: number, y: number} {
    const offset = this.tilesetOffsets.get(tilesetId)!;
    const localX = (tileIndex % TILES_PER_ROW) * 8;
    const localY = Math.floor(tileIndex / TILES_PER_ROW) * 8;
    return {
      x: offset.x + localX,
      y: offset.y + localY
    };
  }
}
```

**Expected Impact**: Reduces texture binds from N to 1 per frame.

---

## LOW Priority Optimizations

### 6. Animation Frame Pre-rendering

**Problem**: Animation frames computed on-demand.

**Solution**: Pre-render all animation frames at load time.

```typescript
class PrerenderedAnimations {
  private frameCanvases: Map<string, HTMLCanvasElement[]> = new Map();

  async prerender(animations: AnimationConfig[], tilesets: Map<string, Tileset>) {
    for (const anim of animations) {
      const frames: HTMLCanvasElement[] = [];

      for (const frameSrc of anim.frames) {
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = anim.tileCount * 8;
        frameCanvas.height = 8;

        // Load and render frame
        const img = await loadImage(frameSrc);
        frameCanvas.getContext('2d')!.drawImage(img, 0, 0);

        frames.push(frameCanvas);
      }

      this.frameCanvases.set(anim.id, frames);
    }
  }

  getFrame(animId: string, frameIndex: number): HTMLCanvasElement {
    return this.frameCanvases.get(animId)![frameIndex];
  }
}
```

**Expected Impact**: Eliminates per-frame animation computation.

### 7. Visibility Culling with Spatial Index

**Problem**: Checking every tile for viewport intersection.

**Solution**: Spatial index for O(log n) visibility queries.

```typescript
class SpatialIndex {
  private grid: Map<string, Set<number>> = new Map();
  private cellSize = 64;  // 4x4 metatiles per cell

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  getVisibleTiles(viewport: Rect): number[] {
    const startCellX = Math.floor(viewport.x / this.cellSize);
    const startCellY = Math.floor(viewport.y / this.cellSize);
    const endCellX = Math.ceil((viewport.x + viewport.width) / this.cellSize);
    const endCellY = Math.ceil((viewport.y + viewport.height) / this.cellSize);

    const tiles: number[] = [];

    for (let cy = startCellY; cy <= endCellY; cy++) {
      for (let cx = startCellX; cx <= endCellX; cx++) {
        const cell = this.grid.get(`${cx},${cy}`);
        if (cell) {
          tiles.push(...cell);
        }
      }
    }

    return tiles;
  }
}
```

**Expected Impact**: Minor improvement for very large maps.

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 days each)

1. **Dirty Rectangle Tracking**
   - Add animation position tracking at map load
   - Modify PassRenderer to accept clip regions
   - Implement region merging

2. **Animation Pre-rendering**
   - Load all animation frames at startup
   - Cache as ImageBitmap for fast transfer

### Phase 2: Major Improvements (1-2 weeks each)

3. **WebGL Tile Renderer**
   - Create WebGL context alongside Canvas 2D
   - Implement instanced tile rendering
   - Add GPU palette lookup
   - Feature-detect and fallback to Canvas 2D

4. **Worker-Based Rendering**
   - Move pass rendering to OffscreenCanvas workers
   - Implement message passing for render context
   - Handle synchronization

### Phase 3: Polish (ongoing)

5. **Texture Atlases**
   - Pack tilesets at load time
   - Update tile coordinate calculations

6. **Spatial Indexing**
   - Implement for object culling
   - Consider for tile visibility

---

## Benchmarking Strategy

### Metrics to Track

```typescript
interface RenderMetrics {
  frameTime: number;           // Total frame time (ms)
  passRenderTime: number[];    // Time per pass (ms)
  compositeTime: number;       // Layer composition (ms)
  drawCalls: number;           // Number of drawImage/drawArrays
  cacheHits: number;           // Palette cache hits
  cacheMisses: number;         // Palette cache misses
  dirtyRegionArea: number;     // Pixels re-rendered
}
```

### Test Scenarios

1. **Static Map**: No animations, measure baseline
2. **Water Edge**: Small amount of water (localized animation)
3. **Full Water**: Route 104 surfing (wall-to-wall water)
4. **Animated NPCs**: 10+ NPCs walking around
5. **Weather**: Rain + water animations combined

### Performance Targets

| Scenario | Current | Target |
|----------|---------|--------|
| Static 20x20 | 4ms | 2ms |
| Water 20x20 | 8ms | 4ms |
| Static 40x40 | 16ms | 4ms |
| Water 40x40 | 32ms | 8ms |
| Full effects 40x40 | 50ms+ | 12ms |

---

## Conclusion

The biggest wins come from:

1. **Dirty rectangles**: Stop re-rendering unchanged tiles
2. **WebGL**: Batch thousands of tiles into single draw call
3. **GPU palette**: Move per-pixel work off CPU

These three optimizations together could achieve 20-50x improvement, easily supporting 40x40 viewports with heavy animation.

The current Canvas 2D approach is fundamentally limited by:
- Per-tile draw calls (no batching)
- CPU-bound palette application
- No parallelism

Moving to WebGL addresses all three. The investment is significant but the payoff is transformative.
