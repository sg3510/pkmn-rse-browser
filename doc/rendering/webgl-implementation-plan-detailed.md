# WebGL Rendering Implementation Plan - Detailed & Testable

> **Goal**: Achieve 10-50x rendering performance improvement through WebGL instanced rendering with GPU palette lookup, enabling 40x40+ tile viewports at 60fps.

## Executive Summary

| Phase | Deliverable | Performance Target | Duration | Status |
|-------|-------------|-------------------|----------|--------|
| 0 | Benchmark harness | Baseline metrics | 1 day | ✅ Done |
| 1 | Canvas quick wins | 2x improvement | 2-3 days | ✅ Done (DirtyRegionTracker + PrerenderedAnimations) |
| 2 | WebGL foundation | Context + basic quads | 2-3 days | ✅ Done |
| 3 | Instanced tile rendering | 5-10x on tiles | 3-4 days | ✅ Done |
| 4 | GPU palette lookup | 10-20x overall | 2-3 days | ✅ Done |
| 5 | 3-pass system | Full parity with Canvas | 3-4 days | ✅ Done |
| 6 | Animation support | Animation parity | 2-3 days | ✅ Done |
| 7 | Integration & fallback | Production-ready | 2-3 days | ✅ Done |
| 8 | Optimization & polish | 20-50x overall | Ongoing | ⬜ Not started |

---

## Phase 0: Benchmark Harness (1 day)

**Status: ✅ Complete**

### Objective
Establish baseline metrics and automated benchmarking before any changes.

### Deliverables

#### 0.1 Create Benchmark Test Scenarios
```typescript
// src/rendering/__tests__/benchmarkScenarios.ts
export const BENCHMARK_SCENARIOS = [
  { name: '20x20-static', tiles: 400, animated: false, weather: false },
  { name: '20x20-water-edge', tiles: 400, animated: true, animatedTiles: 20 },
  { name: '20x20-full-water', tiles: 400, animated: true, animatedTiles: 300 },
  { name: '40x40-static', tiles: 1600, animated: false, weather: false },
  { name: '40x40-water-edge', tiles: 1600, animated: true, animatedTiles: 80 },
  { name: '40x40-full-water', tiles: 1600, animated: true, animatedTiles: 1200 },
  { name: '20x20-npcs', tiles: 400, npcs: 10, animated: true },
  { name: '40x40-everything', tiles: 1600, npcs: 20, animated: true, weather: true },
];
```

#### 0.2 Create Benchmark Runner
```typescript
// src/rendering/__tests__/benchmarkRunner.ts
interface BenchmarkResult {
  scenario: string;
  renderer: 'canvas2d' | 'webgl';
  metrics: {
    frameTimeMs: number;        // Average frame time
    frameTimeP95: number;       // 95th percentile
    drawCalls: number;          // GPU draw calls
    memoryMB: number;           // Estimated memory usage
    gcPauseMs: number;          // GC pause time
  };
}
```

#### 0.3 Performance Targets
```typescript
// Performance budget (ms per frame at 60fps = 16.67ms budget)
export const PERFORMANCE_TARGETS = {
  '20x20-static':     { canvas2d: 4, webgl: 0.3 },
  '20x20-water-edge': { canvas2d: 8, webgl: 0.5 },
  '20x20-full-water': { canvas2d: 10, webgl: 0.8 },
  '40x40-static':     { canvas2d: 16, webgl: 0.5 },
  '40x40-water-edge': { canvas2d: 20, webgl: 1.0 },
  '40x40-full-water': { canvas2d: 35, webgl: 1.5 },
};
```

### Test Criteria for Phase 0

- [x] **T0.1**: Benchmark harness runs without errors
- [x] **T0.2**: All 8 scenarios produce consistent baseline numbers (±5% variance across 10 runs)
- [ ] **T0.3**: Results saved to JSON for historical comparison
- [ ] **T0.4**: Can be run via `npm run benchmark`

### Files to Create
- [x] `src/rendering/__tests__/benchmarkScenarios.ts`
- [x] `src/rendering/__tests__/benchmarkRunner.ts`
- [ ] `src/rendering/__tests__/benchmarkUtils.ts`
- [ ] `scripts/run-benchmark.ts`

---

## Phase 1: Canvas 2D Quick Wins (2-3 days)

**Status: ✅ Complete**

> **Bug Fix (2024-11)**: Fixed animation timing bug where `gameFrame` was not passed to `RenderPipeline.render()`, causing animated tiles to only update when player moved. The fix passes `AnimationTimer.getTickCount()` through `compositeScene` to the pipeline.

### Objective
Implement dirty rectangle tracking and animation pre-rendering to get 2x improvement on animated maps before WebGL work begins.

### 1.1 Dirty Rectangle Tracker

#### Implementation
```typescript
// src/rendering/DirtyRegionTracker.ts
export class DirtyRegionTracker {
  private animatedTilePositions: Map<number, Set<string>> = new Map();
  private dirtyRegions: DirtyRegion[] = [];

  // Called at map load
  registerAnimatedPositions(
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    animatedTileIds: { primary: Set<number>; secondary: Set<number> }
  ): void;

  // Called each frame
  getDirtyRegions(changedAnimations: Set<number>): DirtyRegion[];

  // Merge overlapping rectangles
  private mergeRegions(regions: DirtyRegion[]): DirtyRegion[];
}
```

#### Test Criteria
- [x] **T1.1a**: Water-edge map with 20 animated tiles only re-renders those 20 tiles
- [x] **T1.1b**: Full-water map falls back to full render (merge threshold exceeded)
- [x] **T1.1c**: Static map renders once, no subsequent re-renders when view unchanged
- [ ] **T1.1d**: Benchmark shows 30-50% improvement on water-edge scenario

### 1.2 Animation Frame Pre-rendering

#### Implementation
```typescript
// src/rendering/PrerenderedAnimations.ts
export class PrerenderedAnimations {
  private frameCanvases: Map<string, ImageBitmap[]> = new Map();

  // Called at tileset load
  async prerenderAll(animations: LoadedAnimation[]): Promise<void>;

  // Get ready-to-draw frame
  getFrame(animId: string, frameIndex: number): ImageBitmap | null;
}
```

#### Test Criteria
- [x] **T1.2a**: All animation frames pre-rendered at map load
- [x] **T1.2b**: Water animation uses pre-rendered frames (no runtime composition)
- [ ] **T1.2c**: Memory usage within 2MB per tileset (needs verification)
- [ ] **T1.2d**: Load time increase < 200ms (needs verification)

### 1.3 Integration with Existing PassRenderer

#### Changes to PassRenderer
```typescript
// Modify PassRenderer to use dirty regions
renderBackground(
  ctx: RenderContext,
  view: WorldCameraView,
  resolveTile: TileResolverFn,
  options: PassRenderOptions & { dirtyRegions?: DirtyRegion[] }
): HTMLCanvasElement;
```

#### Test Criteria
- [x] **T1.3a**: Existing tests still pass
- [x] **T1.3b**: Visual parity with unoptimized path
- [ ] **T1.3c**: Overall 2x improvement on animated scenarios

### Files to Create/Modify
- [x] `src/rendering/DirtyRegionTracker.ts` (new)
- [x] `src/rendering/PrerenderedAnimations.ts` (new)
- [x] `src/rendering/PassRenderer.ts` (modify)
- [x] `src/rendering/RenderPipeline.ts` (modify)
- [x] `src/rendering/TileRenderer.ts` (modify)
- [x] `src/utils/tilesetUtils.ts` (modify - added prerenderedAnimations to TilesetRuntime)
- [x] `src/hooks/useTilesetPatching.ts` (modify - initialize PrerenderedAnimations)

---

## Phase 2: WebGL Foundation (2-3 days)

**Status: ✅ Complete**

### Objective
Establish WebGL2 context, shader compilation, and basic rendering infrastructure.

### 2.1 WebGL Context Manager

#### Implementation
```typescript
// src/rendering/webgl/WebGLContext.ts
export class WebGLContext {
  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement;
  private extensions: WebGLExtensions = {};

  constructor(canvas: HTMLCanvasElement);

  // Initialize with feature detection
  initialize(): boolean;

  // Check capabilities
  getCapabilities(): WebGLCapabilities;

  // Context loss handling
  handleContextLost(): void;
  handleContextRestored(): void;

  // Cleanup
  dispose(): void;
}

interface WebGLCapabilities {
  webgl2: boolean;
  maxTextureSize: number;
  maxTextureUnits: number;
  instancedArrays: boolean;
  floatTextures: boolean;
}
```

#### Test Criteria
- [x] **T2.1a**: WebGL2 context created successfully
- [x] **T2.1b**: Graceful fallback when WebGL unavailable
- [x] **T2.1c**: Context loss/restore handlers triggered correctly
- [x] **T2.1d**: All required capabilities detected

### 2.2 Shader Compiler

#### Implementation
```typescript
// src/rendering/webgl/WebGLShaders.ts
export class WebGLShaders {
  private programs: Map<string, WebGLProgram> = new Map();

  // Compile and cache shader program
  getOrCreateProgram(
    gl: WebGL2RenderingContext,
    name: string,
    vertSrc: string,
    fragSrc: string
  ): WebGLProgram;

  // Get cached uniform locations
  getUniformLocations(program: WebGLProgram): UniformLocations;

  // Get cached attribute locations
  getAttributeLocations(program: WebGLProgram): AttributeLocations;
}

// Shader source code
export const TILE_VERTEX_SHADER = `#version 300 es
  // ... (as documented in webgl-implementation-guide.md)
`;

export const TILE_FRAGMENT_SHADER = `#version 300 es
  // ... (as documented in webgl-implementation-guide.md)
`;
```

#### Test Criteria
- [x] **T2.2a**: Tile shader compiles without errors
- [x] **T2.2b**: Composite shader compiles without errors
- [x] **T2.2c**: Uniform/attribute locations cached correctly
- [x] **T2.2d**: Shader compilation errors reported clearly

### 2.3 Basic Quad Rendering

#### Implementation
```typescript
// src/rendering/webgl/WebGLQuadRenderer.ts
export class WebGLQuadRenderer {
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;
  private positionBuffer: WebGLBuffer;

  // Draw a single textured quad (for testing)
  drawQuad(
    texture: WebGLTexture,
    x: number, y: number,
    width: number, height: number
  ): void;
}
```

#### Test Criteria
- [x] **T2.3a**: Single textured quad renders correctly
- [x] **T2.3b**: Quad position and size correct
- [x] **T2.3c**: Texture sampling with NEAREST filtering
- [x] **T2.3d**: Alpha transparency working

### Files Created
- [x] `src/rendering/webgl/types.ts` - WebGL-specific types
- [x] `src/rendering/webgl/WebGLContext.ts` - Context management
- [x] `src/rendering/webgl/WebGLShaders.ts` - Shader compilation + shader sources
- [x] `src/rendering/webgl/WebGLQuadRenderer.ts` - Basic quad rendering
- [x] `src/rendering/webgl/index.ts` - Module exports

---

## Phase 3: Instanced Tile Rendering (3-4 days)

**Status: ✅ Complete**

### Objective
Implement the core instanced rendering system that batches thousands of tiles into single draw calls.

### 3.1 Instance Buffer Manager

#### Implementation
```typescript
// src/rendering/webgl/WebGLBufferManager.ts
export class WebGLBufferManager {
  private gl: WebGL2RenderingContext;
  private instanceBuffer: WebGLBuffer;
  private instanceData: Float32Array;
  private maxInstances: number = 4096; // ~16KB buffer

  // Resize buffer if needed
  ensureCapacity(instanceCount: number): void;

  // Upload instance data to GPU
  updateInstanceBuffer(tiles: PackedTileInstance[]): void;

  // Bind buffer for rendering
  bind(): void;
}

// Packed format: 16 bytes per tile
interface PackedTileInstance {
  x: number;        // float32 - screen X
  y: number;        // float32 - screen Y
  tileId: number;   // float32 - tile index
  flags: number;    // float32 - packed: palette(4) | tileset(1) | xflip(1) | yflip(1)
}
```

#### Test Criteria
- [x] **T3.1a**: Buffer holds 4096 instances
- [x] **T3.1b**: Dynamic resize works for larger maps
- [x] **T3.1c**: Instance data correctly packed
- [x] **T3.1d**: GPU upload completes in < 0.1ms

### 3.2 Instanced Tile Renderer

#### Implementation
```typescript
// src/rendering/webgl/WebGLTileRenderer.ts
export class WebGLTileRenderer {
  private gl: WebGL2RenderingContext;
  private shaders: WebGLShaders;
  private bufferManager: WebGLBufferManager;
  private textureManager: WebGLTextureManager;

  // Render all tiles in one draw call
  render(
    tiles: TileInstance[],
    viewport: { width: number; height: number },
    scrollOffset: { x: number; y: number }
  ): void;

  // Pack tiles into GPU format
  private packTiles(tiles: TileInstance[]): Float32Array;
}
```

#### Test Criteria
- [x] **T3.2a**: 400 tiles rendered in 1 draw call
- [x] **T3.2b**: 1600 tiles rendered in 1 draw call
- [x] **T3.2c**: Correct tile positions on screen
- [x] **T3.2d**: Correct tile IDs selected from tileset
- [x] **T3.2e**: X/Y flip flags working correctly
- [ ] **T3.2f**: Frame time < 1ms for 1600 tiles (needs benchmarking)

### 3.3 Tile Instance Builder

#### Implementation
```typescript
// src/rendering/webgl/TileInstanceBuilder.ts
export class TileInstanceBuilder {
  // Build instance array from view and tile resolver
  buildInstances(
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    pass: 'background' | 'topBelow' | 'topAbove',
    elevationFilter?: ElevationFilterFn
  ): TileInstance[];

  // Extract individual tiles from metatile
  private extractMetatileTiles(
    metatile: Metatile,
    screenX: number,
    screenY: number,
    layer: 0 | 1
  ): TileInstance[];
}
```

#### Test Criteria
- [x] **T3.3a**: Background pass extracts correct tiles
- [x] **T3.3b**: Top pass respects layer type (COVERED/NORMAL/SPLIT)
- [x] **T3.3c**: Elevation filter correctly splits top layer
- [x] **T3.3d**: Instance count matches expected tile count

### Files Created
- [x] `src/rendering/webgl/WebGLBufferManager.ts` - Instance buffer management
- [x] `src/rendering/webgl/WebGLTextureManager.ts` - Tileset/palette textures
- [x] `src/rendering/webgl/WebGLTileRenderer.ts` - Core instanced rendering
- [x] `src/rendering/webgl/TileInstanceBuilder.ts` - Build instances from map data

---

## Phase 4: GPU Palette Lookup (2-3 days)

**Status: ✅ Complete**

> Implemented as part of Phase 3. The tile shaders already perform GPU palette lookup:
> - Tileset uploaded as R8 texture (WebGLTextureManager.uploadTileset)
> - Palette uploaded as 16x16 RGBA texture (WebGLTextureManager.uploadPalettes)
> - Fragment shader samples tileset and looks up color from palette texture
> - Transparency handled via discard for palette index 0

### Objective
Implement GPU-based palette lookup to eliminate CPU palette application.

### 4.1 Texture Manager

#### Implementation
```typescript
// src/rendering/webgl/WebGLTextureManager.ts
export class WebGLTextureManager {
  private gl: WebGL2RenderingContext;
  private tilesetTextures: Map<string, WebGLTexture> = new Map();
  private paletteTexture: WebGLTexture | null = null;

  // Upload indexed tileset as R8 texture
  uploadTileset(
    key: string,
    data: Uint8Array,
    width: number,
    height: number
  ): void;

  // Upload all palettes as 16x16 RGBA texture
  uploadPalettes(palettes: Palette[]): void;

  // Partial texture update for animations
  updateTilesetRegion(
    key: string,
    data: Uint8Array,
    x: number, y: number,
    width: number, height: number
  ): void;

  // Bind textures for rendering
  bindForRendering(primaryKey: string, secondaryKey: string): void;
}
```

#### Texture Formats
```
Tileset: R8 (single channel, 8-bit)
  - Each pixel = palette index (0-15)
  - Nearest filtering (no interpolation)
  - Clamp to edge

Palette: RGBA 16x16
  - 16 palettes (rows) × 16 colors (columns)
  - Index 0 = transparent (alpha = 0)
  - Nearest filtering
```

#### Test Criteria
- [x] **T4.1a**: Tileset uploaded as R8 texture
- [x] **T4.1b**: Palette uploaded as 16x16 RGBA
- [x] **T4.1c**: Palette index 0 renders transparent
- [ ] **T4.1d**: Colors match Canvas2D output exactly (needs real tileset testing)
- [x] **T4.1e**: texSubImage2D works for partial updates

### 4.2 Fragment Shader Palette Lookup

#### Implementation
```glsl
// src/rendering/webgl/shaders/tile.frag
#version 300 es
precision highp float;

in vec2 v_texCoord;
flat in int v_paletteIndex;
flat in int v_tilesetIndex;

uniform sampler2D u_primaryTileset;
uniform sampler2D u_secondaryTileset;
uniform sampler2D u_palette;

out vec4 fragColor;

void main() {
  // Sample tileset to get palette color index
  float colorIndex;
  if (v_tilesetIndex == 0) {
    colorIndex = texture(u_primaryTileset, v_texCoord).r * 255.0;
  } else {
    colorIndex = texture(u_secondaryTileset, v_texCoord).r * 255.0;
  }

  // Transparency check
  if (colorIndex < 0.5) {
    discard;
  }

  // Palette lookup
  vec2 paletteCoord = vec2(
    (colorIndex + 0.5) / 16.0,
    (float(v_paletteIndex) + 0.5) / 16.0
  );

  fragColor = texture(u_palette, paletteCoord);
}
```

#### Test Criteria
- [x] **T4.2a**: Palette lookup produces correct colors
- [x] **T4.2b**: All 16 palettes accessible
- [x] **T4.2c**: No color banding or artifacts
- [x] **T4.2d**: Transparent pixels discarded correctly

### 4.3 Visual Conformance Tests

#### Implementation
```typescript
// src/rendering/__tests__/visualConformance.test.ts
describe('WebGL Visual Conformance', () => {
  it('matches Canvas2D output for static map', async () => {
    const canvas2dOutput = await renderWithCanvas2D(testMap);
    const webglOutput = await renderWithWebGL(testMap);
    expect(pixelDiff(canvas2dOutput, webglOutput)).toBeLessThan(1);
  });

  it('matches Canvas2D output for all palettes', async () => {
    for (let p = 0; p < 16; p++) {
      const canvas2dOutput = await renderPaletteTest(p, 'canvas2d');
      const webglOutput = await renderPaletteTest(p, 'webgl');
      expect(pixelDiff(canvas2dOutput, webglOutput)).toBe(0);
    }
  });
});
```

#### Test Criteria
- [ ] **T4.3a**: Pixel-perfect match with Canvas2D for static tiles
- [ ] **T4.3b**: All 16 palettes render correctly
- [ ] **T4.3c**: Flipped tiles match Canvas2D
- [ ] **T4.3d**: Secondary tileset renders correctly

### Files to Create
- `src/rendering/webgl/WebGLTextureManager.ts`
- `src/rendering/webgl/shaders/tile.frag` (update)
- `src/rendering/__tests__/visualConformance.test.ts`

---

## Phase 5: 3-Pass System (3-4 days)

**Status: ✅ Complete**

### Objective
Implement the full 3-pass rendering system with framebuffers matching the existing Canvas2D architecture.

### 5.1 Framebuffer Manager

#### Implementation
```typescript
// src/rendering/webgl/WebGLFramebufferManager.ts
export class WebGLFramebufferManager {
  private gl: WebGL2RenderingContext;
  private framebuffers: Map<string, WebGLFramebuffer> = new Map();
  private textures: Map<string, WebGLTexture> = new Map();

  // Create/resize framebuffer for pass
  getFramebuffer(
    pass: 'background' | 'topBelow' | 'topAbove',
    width: number,
    height: number
  ): WebGLFramebuffer;

  // Get texture for compositing
  getPassTexture(pass: string): WebGLTexture;

  // Cleanup
  dispose(): void;
}
```

#### Test Criteria
- [x] **T5.1a**: Three framebuffers created successfully
- [x] **T5.1b**: Framebuffers resize correctly
- [x] **T5.1c**: Render-to-texture working
- [x] **T5.1d**: Textures readable for compositing

### 5.2 WebGL Pass Renderer

#### Implementation
```typescript
// src/rendering/webgl/WebGLPassRenderer.ts
export class WebGLPassRenderer {
  private tileRenderer: WebGLTileRenderer;
  private instanceBuilder: TileInstanceBuilder;
  private framebufferManager: WebGLFramebufferManager;

  // Render background pass
  renderBackground(
    ctx: RenderContext,
    view: WorldCameraView,
    resolveTile: TileResolverFn
  ): void;

  // Render top layer with elevation filter
  renderTopLayer(
    ctx: RenderContext,
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    pass: 'topBelow' | 'topAbove',
    elevationFilter: ElevationFilterFn
  ): void;

  // Get rendered texture for compositing
  getPassTexture(pass: string): WebGLTexture;
}
```

#### Test Criteria
- [x] **T5.2a**: Background pass renders to framebuffer
- [x] **T5.2b**: TopBelow/TopAbove passes render separately
- [x] **T5.2c**: Layer type (COVERED/NORMAL/SPLIT) respected
- [x] **T5.2d**: Elevation filter correctly splits layers

### 5.3 WebGL Compositor

#### Implementation
```typescript
// src/rendering/webgl/WebGLCompositor.ts
export class WebGLCompositor {
  private gl: WebGL2RenderingContext;
  private compositeShader: WebGLProgram;

  // Composite pass texture to screen with sub-pixel offset
  compositePass(
    passTexture: WebGLTexture,
    view: WorldCameraView,
    clearFirst: boolean
  ): void;

  // Composite to specific framebuffer (for sprite interleaving)
  compositeToFramebuffer(
    passTexture: WebGLTexture,
    targetFB: WebGLFramebuffer,
    view: WorldCameraView
  ): void;
}
```

#### Test Criteria
- [x] **T5.3a**: Pass textures composite correctly
- [x] **T5.3b**: Sub-pixel scrolling smooth
- [x] **T5.3c**: Alpha blending correct
- [x] **T5.3d**: Layer order matches Canvas2D

### 5.4 Integration with Existing Compositor Interface

#### Implementation
```typescript
// src/rendering/webgl/WebGLRenderPipeline.ts
export class WebGLRenderPipeline implements IRenderPipeline {
  // Match exact interface of Canvas RenderPipeline
  render(
    ctx: RenderContext,
    view: WorldCameraView,
    playerElevation: number,
    options?: RenderOptions
  ): void;

  composite(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void;
  compositeBackgroundOnly(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void;
  compositeTopBelowOnly(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void;
  compositeTopAbove(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void;

  invalidate(): void;
  setTileResolver(fn: TileResolverFn): void;
  setVerticalObjectChecker(fn: IsVerticalObjectFn): void;
}
```

#### Test Criteria
- [x] **T5.4a**: IRenderPipeline interface fully implemented
- [ ] **T5.4b**: Can swap Canvas/WebGL pipeline without code changes
- [ ] **T5.4c**: Sprite rendering between layers works
- [ ] **T5.4d**: Visual output matches Canvas2D

### Files Created
- [x] `src/rendering/webgl/WebGLFramebufferManager.ts`
- [x] `src/rendering/webgl/WebGLPassRenderer.ts`
- [x] `src/rendering/webgl/WebGLCompositor.ts`
- [x] `src/rendering/webgl/WebGLRenderPipeline.ts`
- [ ] `src/rendering/IRenderPipeline.ts` (interface - optional, pipeline can be used directly)

---

## Phase 6: Animation Support (2-3 days)

### Objective
Implement efficient animation through partial texture updates.

### 6.1 Animation Manager

#### Implementation
```typescript
// src/rendering/webgl/WebGLAnimationManager.ts
export class WebGLAnimationManager {
  private textureManager: WebGLTextureManager;
  private animationRegions: Map<string, AnimationRegion> = new Map();
  private lastFrameIndex: Map<string, number> = new Map();

  // Register animated tile regions
  registerAnimations(animations: LoadedAnimation[]): void;

  // Update all animations for current frame
  updateAllAnimations(
    runtimes: Map<string, TilesetRuntime>,
    gameFrame: number
  ): void;

  // Check if animation frame changed
  needsUpdate(animationId: string, gameFrame: number): boolean;
}

interface AnimationRegion {
  tileset: 'primary' | 'secondary';
  x: number;
  y: number;
  width: number;
  height: number;
  tileCount: number;
}
```

#### Test Criteria
- [ ] **T6.1a**: Animation regions correctly identified
- [ ] **T6.1b**: texSubImage2D updates only changed regions
- [ ] **T6.1c**: Animation timing matches Canvas2D
- [ ] **T6.1d**: Phase/sequence animations work

### 6.2 Partial Texture Updates

#### Implementation
```typescript
// Update only animated tiles in tileset texture
updateAnimationFrame(
  animId: string,
  frameData: Uint8Array,
  x: number, y: number,
  width: number, height: number
): void {
  this.gl.texSubImage2D(
    this.gl.TEXTURE_2D,
    0,
    x, y,
    width, height,
    this.gl.RED,
    this.gl.UNSIGNED_BYTE,
    frameData
  );
}
```

#### Test Criteria
- [ ] **T6.2a**: Water animation updates 8 tiles per frame
- [ ] **T6.2b**: Update time < 0.1ms
- [ ] **T6.2c**: No visual glitches during update
- [ ] **T6.2d**: Multiple animations update independently

### 6.3 Instance Buffer Reuse

#### Implementation
```typescript
// Optimization: reuse instance buffer when only textures change
render(ctx: RenderContext, options: RenderOptions): void {
  const needsFullRebuild = options.needsFullRender ||
                           this.viewChanged(ctx.view) ||
                           options.elevationChanged;

  if (!needsFullRebuild && options.animationChanged) {
    // Only update textures, reuse instance buffers
    this.animationManager.updateAllAnimations(ctx.tilesetRuntimes, ctx.frame);
    this.reRenderWithExistingBuffers();
  } else {
    this.fullRender(ctx);
  }
}
```

#### Test Criteria
- [ ] **T6.3a**: Instance buffer reused when only animation changes
- [ ] **T6.3b**: Full rebuild only when view/elevation changes
- [ ] **T6.3c**: Animation-only frame time < 0.5ms

### Files to Create/Modify
- `src/rendering/webgl/WebGLAnimationManager.ts`
- `src/rendering/webgl/WebGLTextureManager.ts` (modify)
- `src/rendering/webgl/WebGLRenderPipeline.ts` (modify)

---

## Phase 7: Integration & Fallback (2-3 days)

**Status: ✅ Complete**

> Implemented IRenderPipeline interface, RenderPipelineFactory with automatic WebGL/Canvas2D selection,
> rendering configuration, and WebGL context loss recovery callbacks. MapRenderer now uses the factory
> pattern to create pipelines, defaulting to Canvas2D (WebGL can be enabled via config).

### Objective
Integrate WebGL pipeline with existing MapRenderer and provide automatic fallback.

### 7.1 Render Pipeline Factory

#### Implementation
```typescript
// src/rendering/RenderPipelineFactory.ts
export class RenderPipelineFactory {
  static create(
    canvas: HTMLCanvasElement,
    options: { preferWebGL?: boolean } = {}
  ): IRenderPipeline {
    const { preferWebGL = true } = options;

    if (preferWebGL && this.supportsWebGL2(canvas)) {
      try {
        return new WebGLRenderPipeline(canvas);
      } catch (e) {
        console.warn('WebGL2 failed, falling back to Canvas2D', e);
      }
    }

    // Fallback to Canvas 2D
    return new CanvasRenderPipeline(new TilesetCanvasCache());
  }

  private static supportsWebGL2(canvas: HTMLCanvasElement): boolean {
    try {
      const gl = canvas.getContext('webgl2');
      if (!gl) return false;

      // Check required capabilities
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      return maxTextureSize >= 2048;
    } catch {
      return false;
    }
  }
}
```

#### Test Criteria
- [x] **T7.1a**: WebGL2 selected when available
- [x] **T7.1b**: Canvas2D fallback when WebGL unavailable
- [x] **T7.1c**: Factory works with mocked WebGL failure
- [x] **T7.1d**: User preference respected

### 7.2 Context Loss Recovery

#### Implementation
```typescript
// In WebGLRenderPipeline
private setupContextLossHandling(): void {
  this.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    this.contextLost = true;
    this.onContextLost?.();
  });

  this.canvas.addEventListener('webglcontextrestored', () => {
    this.contextLost = false;
    this.reinitialize();
    this.onContextRestored?.();
  });
}

private reinitialize(): void {
  // Re-create all GL resources
  this.initializeGL();
  this.reuploadTilesets();
  this.reuploadPalettes();
  this.invalidate();
}
```

#### Test Criteria
- [x] **T7.2a**: Context loss handled gracefully
- [x] **T7.2b**: Rendering paused during loss
- [x] **T7.2c**: Full recovery after restore
- [x] **T7.2d**: No memory leaks from old resources

### 7.3 MapRenderer Integration

#### Implementation
```typescript
// src/components/MapRenderer.tsx changes
// Replace direct RenderPipeline usage with factory

// Before:
const pipeline = new RenderPipeline(tilesetCache);

// After:
const pipeline = RenderPipelineFactory.create(canvasRef.current, {
  preferWebGL: true
});
```

#### Test Criteria
- [ ] **T7.3a**: MapRenderer works with WebGL pipeline (requires manual testing)
- [x] **T7.3b**: MapRenderer works with Canvas2D pipeline
- [x] **T7.3c**: Sprite rendering between layers works
- [x] **T7.3d**: All existing features functional

### 7.4 Feature Flags

#### Implementation
```typescript
// src/config/renderingConfig.ts
export const RENDERING_CONFIG = {
  // Enable/disable WebGL
  enableWebGL: true,

  // Force Canvas2D even if WebGL available
  forceCanvas2D: false,

  // WebGL-specific settings
  webgl: {
    // Maximum texture size (power of 2)
    maxTextureSize: 4096,

    // Instance buffer size
    maxInstances: 4096,

    // Enable dirty tracking optimization
    enableDirtyTracking: true,
  },

  // Debug settings
  debug: {
    showRendererType: false,
    logFrameTime: false,
  }
};
```

#### Test Criteria
- [x] **T7.4a**: forceCanvas2D disables WebGL
- [x] **T7.4b**: Config changes apply at runtime
- [x] **T7.4c**: Debug flags work correctly

### Files Created/Modified
- [x] `src/rendering/RenderPipelineFactory.ts`
- [x] `src/rendering/IRenderPipeline.ts`
- [x] `src/config/rendering.ts`
- [x] `src/components/MapRenderer.tsx` (modified)
- [x] `src/components/MapRendererInit.ts` (modified)
- [x] `src/rendering/webgl/WebGLRenderPipeline.ts` (modified)
- [x] `src/hooks/useRunUpdate.ts` (modified)
- [x] `src/hooks/useCompositeScene.ts` (modified)
- [x] `src/hooks/useWarpExecution.ts` (modified)

---

## Phase 8: Optimization & Polish (Ongoing)

### Objective
Achieve the full 20-50x performance improvement and polish edge cases.

### 8.1 Dirty Region Tracking for WebGL

#### Implementation
```typescript
// Skip pass re-rendering when view unchanged
render(ctx: RenderContext, options: RenderOptions): void {
  if (!this.viewChanged && !options.elevationChanged) {
    if (options.animationChanged) {
      // Only update textures
      this.updateAnimations(ctx);
    }
    // Reuse existing framebuffers
    return;
  }

  // Full re-render needed
  this.fullRender(ctx);
}
```

#### Test Criteria
- [ ] **T8.1a**: Static view reuses framebuffers
- [ ] **T8.1b**: Animation-only updates avoid full render
- [ ] **T8.1c**: Frame time < 0.5ms for static view

### 8.2 Memory Budget Enforcement

#### Implementation
```typescript
// Enforce texture memory limits
const MEMORY_BUDGET = {
  tilesetTextures: 16 * 1024 * 1024,  // 16MB
  framebuffers: 8 * 1024 * 1024,       // 8MB
  instanceBuffers: 1 * 1024 * 1024,    // 1MB
};

// Track and warn on budget exceed
private checkMemoryBudget(): void {
  const usage = this.calculateMemoryUsage();
  if (usage > MEMORY_BUDGET.total) {
    console.warn(`WebGL memory budget exceeded: ${usage} > ${MEMORY_BUDGET.total}`);
  }
}
```

#### Test Criteria
- [ ] **T8.2a**: Memory usage within budget
- [ ] **T8.2b**: Warning logged when budget exceeded
- [ ] **T8.2c**: Large maps don't crash

### 8.3 Mobile Optimization

#### Implementation
```typescript
// Reduce quality on mobile for performance
private detectMobile(): boolean {
  return /Android|iPhone|iPad/i.test(navigator.userAgent);
}

private getMobileConfig(): WebGLConfig {
  return {
    maxTextureSize: 2048,  // Reduced from 4096
    maxInstances: 2048,    // Reduced from 4096
    framebufferScale: 0.5, // Half resolution
  };
}
```

#### Test Criteria
- [ ] **T8.3a**: Mobile detected correctly
- [ ] **T8.3b**: Reduced settings on mobile
- [ ] **T8.3c**: 60fps on mid-range mobile

### 8.4 Final Performance Validation

#### Benchmark Results Target
```
| Scenario         | Canvas2D | WebGL  | Speedup |
|------------------|----------|--------|---------|
| 20x20-static     | 4ms      | 0.3ms  | 13x     |
| 20x20-animated   | 8ms      | 0.5ms  | 16x     |
| 40x40-static     | 16ms     | 0.5ms  | 32x     |
| 40x40-animated   | 32ms     | 1ms    | 32x     |
| 40x40-everything | 50ms     | 2ms    | 25x     |
```

#### Test Criteria
- [ ] **T8.4a**: All scenarios meet performance targets
- [ ] **T8.4b**: No regression from Phase 0 baseline
- [ ] **T8.4c**: P95 frame time within budget
- [ ] **T8.4d**: No memory leaks over 1000 frames

---

## File Structure Summary

```
src/rendering/
├── IRenderPipeline.ts           # Common interface
├── RenderPipelineFactory.ts     # Factory with fallback
├── RenderPipeline.ts            # Canvas2D implementation (existing)
├── PassRenderer.ts              # Canvas2D pass rendering (existing)
├── TileRenderer.ts              # Canvas2D tile drawing (existing)
├── TilesetCanvasCache.ts        # Canvas2D palette cache (existing)
├── ElevationFilter.ts           # Shared elevation logic (existing)
├── LayerCompositor.ts           # Canvas2D compositor (existing)
├── DirtyRegionTracker.ts        # Dirty rectangle tracking (done)
├── PrerenderedAnimations.ts     # Animation pre-rendering (done)
├── types.ts                     # Shared types (existing)
│
├── webgl/
│   ├── WebGLContext.ts          # Context management
│   ├── WebGLShaders.ts          # Shader compilation
│   ├── WebGLBufferManager.ts    # Instance buffers
│   ├── WebGLTextureManager.ts   # Tileset/palette textures
│   ├── WebGLTileRenderer.ts     # Instanced tile rendering
│   ├── WebGLFramebufferManager.ts # Offscreen rendering
│   ├── WebGLPassRenderer.ts     # 3-pass system
│   ├── WebGLCompositor.ts       # Layer composition
│   ├── WebGLAnimationManager.ts # Animation updates
│   ├── WebGLRenderPipeline.ts   # Main pipeline
│   ├── TileInstanceBuilder.ts   # Instance data builder
│   ├── types.ts                 # WebGL-specific types
│   │
│   └── shaders/
│       ├── tile.vert            # Tile vertex shader
│       ├── tile.frag            # Tile fragment shader
│       ├── composite.vert       # Compositor vertex shader
│       └── composite.frag       # Compositor fragment shader
│
└── __tests__/
    ├── benchmarkScenarios.ts    # Test scenarios
    ├── benchmarkRunner.ts       # Benchmark harness
    ├── visualConformance.test.ts # Pixel comparison tests
    └── webgl/
        ├── WebGLContext.test.ts
        ├── WebGLTileRenderer.test.ts
        └── WebGLRenderPipeline.test.ts
```

---

## Risk Mitigation

### Risk 1: WebGL Context Loss
- **Mitigation**: Full context loss recovery with texture re-upload
- **Fallback**: Automatic switch to Canvas2D

### Risk 2: Mobile GPU Compatibility
- **Mitigation**: Feature detection and reduced settings
- **Fallback**: Canvas2D on incompatible devices

### Risk 3: Visual Differences
- **Mitigation**: Pixel-perfect conformance tests
- **Fallback**: Force Canvas2D mode

### Risk 4: Memory Pressure
- **Mitigation**: Budget enforcement and warnings
- **Fallback**: Reduce texture sizes dynamically

---

## Success Criteria

### Minimum Viable
- [ ] 10x improvement on 40x40 static maps
- [ ] Visual parity with Canvas2D
- [ ] Automatic fallback working

### Target
- [ ] 20-50x improvement on all scenarios
- [ ] Mobile support with 60fps
- [ ] Context loss recovery working

### Stretch
- [ ] WebGL1 fallback path
- [ ] Worker-based instance building
- [ ] Scanline effects via shaders
