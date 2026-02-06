---
title: WebGL Tile Renderer Implementation Guide
status: reference
last_verified: 2026-01-13
---

# WebGL Tile Renderer Implementation Guide

A comprehensive guide for implementing a WebGL-based tile renderer that integrates with the existing rendering architecture. This approach can yield **10-50x performance improvements** by batching thousands of tiles into single draw calls.

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Integration with Current System](#2-integration-with-current-system)
3. [Core Components](#3-core-components)
4. [Shader Design](#4-shader-design)
5. [Texture Management](#5-texture-management)
6. [Animation Handling](#6-animation-handling)
7. [3-Pass Rendering](#7-3-pass-rendering)
8. [Sub-Pixel Scrolling](#8-sub-pixel-scrolling)
9. [Elevation & Layer Filtering](#9-elevation--layer-filtering)
10. [Dirty Rectangle Optimization](#10-dirty-rectangle-optimization)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Fallback Strategy](#12-fallback-strategy)
13. [Performance Benchmarks](#13-performance-benchmarks)

---

## 1. Architecture Overview

### Current vs WebGL Architecture

```
CURRENT (Canvas 2D):
┌─────────────────────────────────────────────────────────────┐
│  For each tile (3200+ per frame):                           │
│    1. Get palettized canvas from cache (may miss)           │
│    2. Calculate source coordinates                          │
│    3. Apply transforms if flipped (save/restore)            │
│    4. ctx.drawImage() ← CPU → GPU transfer per tile         │
└─────────────────────────────────────────────────────────────┘
Result: 3200+ draw calls, 3200+ potential state changes

WEBGL (Proposed):
┌─────────────────────────────────────────────────────────────┐
│  Setup (once per map load):                                 │
│    1. Upload indexed tileset as texture                     │
│    2. Upload palette as 1D texture                          │
│                                                             │
│  Per frame:                                                 │
│    1. Build instance buffer (tileId, x, y, palette, flags)  │
│    2. Upload instance buffer (one transfer)                 │
│    3. gl.drawArraysInstanced() ← ONE draw call              │
│    4. GPU does palette lookup + positioning in shader       │
└─────────────────────────────────────────────────────────────┘
Result: 1 draw call, 1 buffer upload, GPU does all the work
```

### Why 10-50x Improvement?

| Operation | Canvas 2D | WebGL |
|-----------|-----------|-------|
| Draw calls per frame | 3,200+ | 1-3 |
| CPU→GPU transfers | 3,200+ | 1 |
| Palette lookup | CPU (per pixel) | GPU (parallel) |
| Flip transforms | CPU (save/restore) | GPU (vertex shader) |
| State changes | Many | Minimal |

---

## 2. Integration with Current System

### Design Principle: Drop-in Replacement

The WebGL renderer should **replace** `TileRenderer` and `PassRenderer` while keeping:
- Same `RenderPipeline` orchestration
- Same `RenderContext` and `WorldCameraView` types
- Same elevation filtering logic
- Same animation system

### File Structure

```
src/rendering/
├── RenderPipeline.ts          # Unchanged (orchestrator)
├── PassRenderer.ts            # Keep as fallback
├── TileRenderer.ts            # Keep as fallback
├── TilesetCanvasCache.ts      # Keep for Canvas 2D fallback
├── ElevationFilter.ts         # Unchanged
├── LayerCompositor.ts         # Minor changes for WebGL output
├── types.ts                   # Add WebGL types
│
├── webgl/                     # NEW: WebGL implementation
│   ├── WebGLTileRenderer.ts   # Core WebGL renderer
│   ├── WebGLPassRenderer.ts   # Pass rendering with WebGL
│   ├── WebGLTextureManager.ts # Tileset/palette textures
│   ├── WebGLShaders.ts        # Shader source code
│   ├── WebGLBufferManager.ts  # Instance buffer management
│   ├── WebGLContext.ts        # Context setup & state
│   └── types.ts               # WebGL-specific types
│
└── RenderPipelineFactory.ts   # NEW: Creates Canvas or WebGL pipeline
```

### Integration Points

```typescript
// RenderPipelineFactory.ts
export function createRenderPipeline(
  canvas: HTMLCanvasElement,
  options: { preferWebGL?: boolean } = {}
): RenderPipeline {
  const { preferWebGL = true } = options;

  if (preferWebGL && isWebGLSupported(canvas)) {
    return new WebGLRenderPipeline(canvas);
  }

  // Fallback to Canvas 2D
  const tilesetCache = new TilesetCanvasCache();
  return new CanvasRenderPipeline(tilesetCache);
}

function isWebGLSupported(canvas: HTMLCanvasElement): boolean {
  try {
    const gl = canvas.getContext('webgl2');
    return gl !== null;
  } catch {
    return false;
  }
}
```

---

## 3. Core Components

### WebGLTileRenderer

The heart of the system - manages WebGL state and renders tiles.

```typescript
// src/rendering/webgl/WebGLTileRenderer.ts

export class WebGLTileRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private bufferManager: WebGLBufferManager;
  private textureManager: WebGLTextureManager;

  // Uniform locations (cached)
  private uniforms: {
    viewportSize: WebGLUniformLocation;
    tilesetSize: WebGLUniformLocation;
    tilesetTexture: WebGLUniformLocation;
    paletteTexture: WebGLUniformLocation;
    scrollOffset: WebGLUniformLocation;
  };

  // Attribute locations
  private attributes: {
    position: number;      // Quad vertex (0,0), (1,0), (0,1), (1,1)
    instanceData: number;  // Per-tile: x, y, tileId, paletteId
    instanceFlags: number; // Per-tile: xflip, yflip, layer
  };

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = this.createProgram();
    this.bufferManager = new WebGLBufferManager(gl);
    this.textureManager = new WebGLTextureManager(gl);
    this.cacheUniformLocations();
    this.cacheAttributeLocations();
    this.setupVertexArray();
  }

  /**
   * Render a batch of tiles in one draw call
   *
   * @param tiles - Array of tile instances to render
   * @param viewport - Viewport dimensions in pixels
   * @param scrollOffset - Sub-pixel scroll offset for smooth panning
   */
  render(
    tiles: TileInstance[],
    viewport: { width: number; height: number },
    scrollOffset: { x: number; y: number }
  ): void {
    const { gl } = this;

    gl.useProgram(this.program);

    // Set viewport
    gl.viewport(0, 0, viewport.width, viewport.height);

    // Set uniforms
    gl.uniform2f(this.uniforms.viewportSize, viewport.width, viewport.height);
    gl.uniform2f(this.uniforms.scrollOffset, scrollOffset.x, scrollOffset.y);

    // Bind textures
    this.textureManager.bindTilesets(gl, this.uniforms.tilesetTexture);
    this.textureManager.bindPalette(gl, this.uniforms.paletteTexture);

    // Update instance buffer with tile data
    this.bufferManager.updateInstanceBuffer(tiles);

    // Draw all tiles in ONE call
    gl.drawArraysInstanced(
      gl.TRIANGLE_STRIP,
      0,              // Start vertex
      4,              // 4 vertices per quad
      tiles.length    // Number of instances
    );
  }

  /**
   * Update tileset texture (called when animations change tiles)
   */
  updateTilesetRegion(
    tileset: 'primary' | 'secondary',
    data: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    this.textureManager.updateTilesetRegion(tileset, data, x, y, width, height);
  }

  /**
   * Update palette (for weather effects, time of day, etc.)
   */
  updatePalette(paletteIndex: number, colors: string[]): void {
    this.textureManager.updatePalette(paletteIndex, colors);
  }
}
```

### TileInstance Type

```typescript
// src/rendering/webgl/types.ts

export interface TileInstance {
  /** Screen X position (pixels) */
  x: number;
  /** Screen Y position (pixels) */
  y: number;
  /** Tile ID in tileset (0-511 primary, 512-1023 secondary) */
  tileId: number;
  /** Palette index (0-15) */
  paletteId: number;
  /** Horizontal flip */
  xflip: boolean;
  /** Vertical flip */
  yflip: boolean;
  /** Which tileset (0 = primary, 1 = secondary) */
  tilesetIndex: number;
}

// Packed format for GPU upload (16 bytes per instance)
export interface PackedTileInstance {
  // Float32 x 4 = 16 bytes
  x: number;        // screen X
  y: number;        // screen Y
  tileId: number;   // tile index in tileset
  flags: number;    // packed: paletteId (4 bits) | tilesetIndex (1 bit) | xflip (1 bit) | yflip (1 bit)
}
```

---

## 4. Shader Design

### Vertex Shader

```glsl
// src/rendering/webgl/shaders/tile.vert
#version 300 es
precision highp float;

// Per-vertex attributes (the quad corners)
in vec2 a_position;  // (0,0), (1,0), (0,1), (1,1)

// Per-instance attributes
in vec4 a_instanceData;  // x, y, tileId, flags

// Uniforms
uniform vec2 u_viewportSize;    // Viewport in pixels
uniform vec2 u_scrollOffset;    // Sub-pixel scroll offset
uniform vec2 u_tilesetSize;     // Tileset dimensions in tiles (16, varies)

// Outputs to fragment shader
out vec2 v_texCoord;
flat out int v_paletteIndex;
flat out int v_tilesetIndex;

// Constants
const float TILE_SIZE = 8.0;

void main() {
  // Unpack instance data
  float screenX = a_instanceData.x;
  float screenY = a_instanceData.y;
  float tileId = a_instanceData.z;
  float flags = a_instanceData.w;

  // Decode flags
  int flagsInt = int(flags);
  bool xflip = (flagsInt & 1) != 0;
  bool yflip = (flagsInt & 2) != 0;
  v_tilesetIndex = (flagsInt >> 2) & 1;
  v_paletteIndex = (flagsInt >> 3) & 15;

  // Calculate vertex position
  vec2 vertexOffset = a_position * TILE_SIZE;
  vec2 worldPos = vec2(screenX, screenY) + vertexOffset - u_scrollOffset;

  // Convert to clip space (-1 to 1)
  vec2 clipPos = (worldPos / u_viewportSize) * 2.0 - 1.0;
  clipPos.y = -clipPos.y;  // Flip Y for screen coordinates

  gl_Position = vec4(clipPos, 0.0, 1.0);

  // Calculate texture coordinates
  float tilesPerRow = u_tilesetSize.x;
  float tileX = mod(tileId, tilesPerRow);
  float tileY = floor(tileId / tilesPerRow);

  // Base texture coordinate (top-left of tile)
  vec2 tileOrigin = vec2(tileX, tileY) / u_tilesetSize;
  vec2 tileSize = vec2(1.0) / u_tilesetSize;

  // Apply flip by modifying texture coordinate calculation
  vec2 localCoord = a_position;
  if (xflip) localCoord.x = 1.0 - localCoord.x;
  if (yflip) localCoord.y = 1.0 - localCoord.y;

  v_texCoord = tileOrigin + localCoord * tileSize;
}
```

### Fragment Shader

```glsl
// src/rendering/webgl/shaders/tile.frag
#version 300 es
precision highp float;

// Inputs from vertex shader
in vec2 v_texCoord;
flat in int v_paletteIndex;
flat in int v_tilesetIndex;

// Textures
uniform sampler2D u_primaryTileset;    // Indexed color (R = palette index)
uniform sampler2D u_secondaryTileset;  // Indexed color (R = palette index)
uniform sampler2D u_palette;           // 16x16 RGBA (16 palettes × 16 colors)

// Output
out vec4 fragColor;

void main() {
  // Sample the appropriate tileset
  float paletteColorIndex;
  if (v_tilesetIndex == 0) {
    paletteColorIndex = texture(u_primaryTileset, v_texCoord).r * 255.0;
  } else {
    paletteColorIndex = texture(u_secondaryTileset, v_texCoord).r * 255.0;
  }

  // Transparency check (palette index 0 = transparent)
  if (paletteColorIndex < 0.5) {
    discard;
  }

  // Look up color from palette texture
  // Palette texture layout: 16 colors wide × 16 palettes tall
  vec2 paletteCoord = vec2(
    (paletteColorIndex + 0.5) / 16.0,           // Color index (X)
    (float(v_paletteIndex) + 0.5) / 16.0        // Palette index (Y)
  );

  fragColor = texture(u_palette, paletteCoord);
}
```

### Optimized Single-Tileset Variant

For maps using only primary tileset, we can simplify:

```glsl
// tile-simple.frag - optimized for single tileset
#version 300 es
precision highp float;

in vec2 v_texCoord;
flat in int v_paletteIndex;

uniform sampler2D u_tileset;
uniform sampler2D u_palette;

out vec4 fragColor;

void main() {
  float colorIndex = texture(u_tileset, v_texCoord).r * 255.0;

  if (colorIndex < 0.5) {
    discard;
  }

  vec2 paletteCoord = vec2(
    (colorIndex + 0.5) / 16.0,
    (float(v_paletteIndex) + 0.5) / 16.0
  );

  fragColor = texture(u_palette, paletteCoord);
}
```

---

## 5. Texture Management

### Tileset Texture Upload

```typescript
// src/rendering/webgl/WebGLTextureManager.ts

export class WebGLTextureManager {
  private gl: WebGL2RenderingContext;
  private primaryTexture: WebGLTexture;
  private secondaryTexture: WebGLTexture;
  private paletteTexture: WebGLTexture;

  // Track texture dimensions
  private primarySize: { width: number; height: number };
  private secondarySize: { width: number; height: number };

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.primaryTexture = this.createTexture();
    this.secondaryTexture = this.createTexture();
    this.paletteTexture = this.createTexture();
  }

  /**
   * Upload indexed tileset data as R8 texture
   *
   * CRITICAL: Use R8 format (single channel) for indexed colors.
   * Each pixel stores the palette index (0-15).
   */
  uploadTileset(
    tileset: 'primary' | 'secondary',
    data: Uint8Array,
    width: number,
    height: number
  ): void {
    const { gl } = this;
    const texture = tileset === 'primary'
      ? this.primaryTexture
      : this.secondaryTexture;

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Upload as R8 (single channel, 8 bits)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,              // Mip level
      gl.R8,          // Internal format: single red channel
      width,
      height,
      0,              // Border (must be 0)
      gl.RED,         // Source format
      gl.UNSIGNED_BYTE,
      data
    );

    // CRITICAL: Use NEAREST filtering for pixel-perfect rendering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Store dimensions
    if (tileset === 'primary') {
      this.primarySize = { width, height };
    } else {
      this.secondarySize = { width, height };
    }
  }

  /**
   * Update a region of the tileset (for animations)
   *
   * This is the key to efficient animation: instead of re-uploading
   * the entire tileset, we update only the animated tiles.
   */
  updateTilesetRegion(
    tileset: 'primary' | 'secondary',
    data: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const { gl } = this;
    const texture = tileset === 'primary'
      ? this.primaryTexture
      : this.secondaryTexture;

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Partial texture update
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,              // Mip level
      x, y,           // Offset
      width, height,  // Dimensions
      gl.RED,
      gl.UNSIGNED_BYTE,
      data
    );
  }

  /**
   * Upload palette as RGBA texture
   *
   * Layout: 16 colors × 16 palettes = 16×16 RGBA texture
   */
  uploadPalette(palettes: Palette[]): void {
    const { gl } = this;

    // Create 16x16 RGBA data (16 palettes × 16 colors × 4 channels)
    const data = new Uint8Array(16 * 16 * 4);

    for (let paletteIdx = 0; paletteIdx < palettes.length && paletteIdx < 16; paletteIdx++) {
      const palette = palettes[paletteIdx];

      for (let colorIdx = 0; colorIdx < 16; colorIdx++) {
        const offset = (paletteIdx * 16 + colorIdx) * 4;
        const hex = palette.colors[colorIdx] || '#000000';

        // Parse hex color
        data[offset + 0] = parseInt(hex.slice(1, 3), 16);  // R
        data[offset + 1] = parseInt(hex.slice(3, 5), 16);  // G
        data[offset + 2] = parseInt(hex.slice(5, 7), 16);  // B
        data[offset + 3] = colorIdx === 0 ? 0 : 255;       // A (index 0 = transparent)
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      16, 16,  // 16 colors × 16 palettes
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  /**
   * Update a single palette (for weather/time effects)
   */
  updatePalette(paletteIndex: number, colors: string[]): void {
    const { gl } = this;

    const data = new Uint8Array(16 * 4);
    for (let i = 0; i < 16; i++) {
      const hex = colors[i] || '#000000';
      data[i * 4 + 0] = parseInt(hex.slice(1, 3), 16);
      data[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
      data[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
      data[i * 4 + 3] = i === 0 ? 0 : 255;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0, paletteIndex,  // Update one row (one palette)
      16, 1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    );
  }

  bindTilesets(gl: WebGL2RenderingContext, uniformLocation: WebGLUniformLocation): void {
    // Bind primary to texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.primaryTexture);

    // Bind secondary to texture unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.secondaryTexture);

    // Set uniform to use both
    // Note: This requires shader modification to sample from correct texture
  }

  bindPalette(gl: WebGL2RenderingContext, uniformLocation: WebGLUniformLocation): void {
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);
    gl.uniform1i(uniformLocation, 2);
  }
}
```

---

## 6. Animation Handling

### Animation-Aware Texture Updates

```typescript
// src/rendering/webgl/WebGLAnimationManager.ts

interface AnimationRegion {
  tileset: 'primary' | 'secondary';
  startTileId: number;
  tileCount: number;
  x: number;  // Pixel X in tileset
  y: number;  // Pixel Y in tileset
  width: number;   // Pixels
  height: number;  // Pixels
}

export class WebGLAnimationManager {
  private textureManager: WebGLTextureManager;
  private animationRegions: Map<string, AnimationRegion> = new Map();

  constructor(textureManager: WebGLTextureManager) {
    this.textureManager = textureManager;
  }

  /**
   * Register animated tile regions for efficient updates
   *
   * Called once at map load to identify which texture regions
   * will be updated during animation.
   */
  registerAnimations(animations: TilesetAnimationDefinition[]): void {
    this.animationRegions.clear();

    for (const anim of animations) {
      for (const dest of anim.destinations) {
        const region = this.calculateRegion(anim.tileset, dest.destStart, anim.frames.length);
        this.animationRegions.set(`${anim.id}:${dest.destStart}`, region);
      }
    }
  }

  private calculateRegion(
    tileset: 'primary' | 'secondary',
    startTileId: number,
    frameCount: number
  ): AnimationRegion {
    const TILES_PER_ROW = 16;
    const TILE_SIZE = 8;

    // Adjust for secondary tileset offset
    const effectiveId = tileset === 'secondary'
      ? startTileId - 512
      : startTileId;

    const tileX = effectiveId % TILES_PER_ROW;
    const tileY = Math.floor(effectiveId / TILES_PER_ROW);

    // Assume animation frames are sequential tiles
    // Most animations are 2x2 or 4x2 tiles
    const tilesWide = Math.min(4, frameCount);
    const tilesHigh = Math.ceil(frameCount / tilesWide);

    return {
      tileset,
      startTileId,
      tileCount: frameCount,
      x: tileX * TILE_SIZE,
      y: tileY * TILE_SIZE,
      width: tilesWide * TILE_SIZE,
      height: tilesHigh * TILE_SIZE,
    };
  }

  /**
   * Apply animation frame to tileset texture
   *
   * This updates only the specific region of the tileset texture
   * that contains the animated tiles.
   */
  applyAnimationFrame(
    animationId: string,
    destStart: number,
    frameData: Uint8Array,
    frameWidth: number,
    frameHeight: number
  ): void {
    const key = `${animationId}:${destStart}`;
    const region = this.animationRegions.get(key);

    if (!region) {
      console.warn(`Animation region not found: ${key}`);
      return;
    }

    // Update only the animated region in the texture
    this.textureManager.updateTilesetRegion(
      region.tileset,
      frameData,
      region.x,
      region.y,
      frameWidth,
      frameHeight
    );
  }

  /**
   * Batch update all animations for current frame
   *
   * Called once per game frame to update all active animations.
   */
  updateAllAnimations(
    runtime: TilesetRuntime,
    gameFrame: number
  ): void {
    if (!runtime.animations) return;

    for (const anim of runtime.animations) {
      const frameIndex = this.calculateFrameIndex(anim, gameFrame);
      const frameData = anim.frames[frameIndex];

      for (const dest of anim.destinations) {
        const effectiveFrame = this.applyPhase(anim, dest, gameFrame);
        this.applyAnimationFrame(
          anim.id,
          dest.destStart,
          frameData,
          anim.frameWidth,
          anim.frameHeight
        );
      }
    }
  }

  private calculateFrameIndex(
    anim: LoadedAnimation,
    gameFrame: number
  ): number {
    const sequence = anim.sequence || Array.from(
      { length: anim.frames.length },
      (_, i) => i
    );

    const cyclePosition = Math.floor(gameFrame / anim.interval) % sequence.length;
    return sequence[cyclePosition];
  }

  private applyPhase(
    anim: LoadedAnimation,
    dest: AnimationDestination,
    gameFrame: number
  ): number {
    const phase = dest.phase || 0;
    return gameFrame + phase;
  }
}
```

---

## 7. 3-Pass Rendering

### WebGLPassRenderer

```typescript
// src/rendering/webgl/WebGLPassRenderer.ts

export class WebGLPassRenderer {
  private tileRenderer: WebGLTileRenderer;
  private framebuffers: {
    background: WebGLFramebuffer;
    topBelow: WebGLFramebuffer;
    topAbove: WebGLFramebuffer;
  };
  private textures: {
    background: WebGLTexture;
    topBelow: WebGLTexture;
    topAbove: WebGLTexture;
  };

  constructor(gl: WebGL2RenderingContext, tileRenderer: WebGLTileRenderer) {
    this.tileRenderer = tileRenderer;
    this.createFramebuffers(gl);
  }

  /**
   * Create framebuffers for offscreen pass rendering
   *
   * Each pass renders to its own texture, which is then
   * composited with sprites in between.
   */
  private createFramebuffers(gl: WebGL2RenderingContext): void {
    const passes = ['background', 'topBelow', 'topAbove'] as const;

    for (const pass of passes) {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA,
        1, 1, 0,  // Placeholder size, resized on first render
        gl.RGBA, gl.UNSIGNED_BYTE, null
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      );

      this.textures[pass] = texture;
      this.framebuffers[pass] = fb;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Render background pass
   *
   * Contains:
   * - Layer 0 of all metatiles
   * - Layer 1 of COVERED metatiles
   */
  renderBackground(
    ctx: RenderContext,
    view: WorldCameraView,
    resolveTile: TileResolverFn
  ): void {
    const tiles: TileInstance[] = [];

    this.forEachVisibleTile(view, (tileX, tileY, screenX, screenY) => {
      const resolved = resolveTile(tileX, tileY);
      if (!resolved?.metatile) return;

      const layerType = resolved.attributes?.layerType ?? METATILE_LAYER_TYPE_COVERED;

      // Background: always draw layer 0
      this.addMetatileLayer(tiles, resolved, screenX, screenY, 0);

      // COVERED: also draw layer 1 in background
      if (layerType === METATILE_LAYER_TYPE_COVERED) {
        this.addMetatileLayer(tiles, resolved, screenX, screenY, 1);
      }
    });

    this.renderToFramebuffer('background', tiles, view);
  }

  /**
   * Render top layer with elevation filter
   *
   * Split into topBelow (behind player) and topAbove (in front of player)
   * based on elevation filtering.
   */
  renderTopLayer(
    ctx: RenderContext,
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    pass: 'topBelow' | 'topAbove',
    elevationFilter: ElevationFilterFn
  ): void {
    const tiles: TileInstance[] = [];

    this.forEachVisibleTile(view, (tileX, tileY, screenX, screenY) => {
      const resolved = resolveTile(tileX, tileY);
      if (!resolved?.metatile) return;

      const layerType = resolved.attributes?.layerType ?? METATILE_LAYER_TYPE_COVERED;

      // Top pass: only NORMAL and SPLIT have layer 1 here
      if (layerType === METATILE_LAYER_TYPE_COVERED) return;

      // Apply elevation filter
      if (!elevationFilter(resolved.mapTile, tileX, tileY)) return;

      // Draw layer 1
      if (layerType === METATILE_LAYER_TYPE_NORMAL ||
          layerType === METATILE_LAYER_TYPE_SPLIT) {
        this.addMetatileLayer(tiles, resolved, screenX, screenY, 1);
      }
    });

    this.renderToFramebuffer(pass, tiles, view);
  }

  /**
   * Add all 4 tiles from a metatile layer to the instance array
   */
  private addMetatileLayer(
    tiles: TileInstance[],
    resolved: ResolvedTile,
    screenX: number,
    screenY: number,
    layer: 0 | 1
  ): void {
    const metatile = resolved.metatile!;
    const NUM_PALS_IN_PRIMARY = 6;

    for (let i = 0; i < 4; i++) {
      const tileIndex = layer * 4 + i;
      const tile = metatile.tiles[tileIndex];
      if (!tile) continue;

      const subX = (i % 2) * 8;
      const subY = Math.floor(i / 2) * 8;

      const isSecondary = tile.tileId >= 512;
      const tilesetIndex = isSecondary ? 1 : 0;

      // Palette selection matches original logic
      const paletteId = tile.palette;

      tiles.push({
        x: screenX + subX,
        y: screenY + subY,
        tileId: isSecondary ? tile.tileId - 512 : tile.tileId,
        paletteId,
        xflip: tile.xflip,
        yflip: tile.yflip,
        tilesetIndex,
      });
    }
  }

  private renderToFramebuffer(
    pass: 'background' | 'topBelow' | 'topAbove',
    tiles: TileInstance[],
    view: WorldCameraView
  ): void {
    const { gl } = this.tileRenderer;
    const viewport = {
      width: view.tilesWide * METATILE_SIZE,
      height: view.tilesHigh * METATILE_SIZE,
    };

    // Resize framebuffer texture if needed
    this.resizeFramebuffer(pass, viewport.width, viewport.height);

    // Bind framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[pass]);
    gl.viewport(0, 0, viewport.width, viewport.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Render tiles
    // Note: scrollOffset is 0 here because we render to full pass canvas
    // Sub-pixel offset is applied during composition
    this.tileRenderer.render(tiles, viewport, { x: 0, y: 0 });

    // Unbind framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Get rendered pass texture for composition
   */
  getPassTexture(pass: 'background' | 'topBelow' | 'topAbove'): WebGLTexture {
    return this.textures[pass];
  }
}
```

---

## 8. Sub-Pixel Scrolling

### Compositor with WebGL Textures

```typescript
// src/rendering/webgl/WebGLCompositor.ts

export class WebGLCompositor {
  private gl: WebGL2RenderingContext;
  private compositeProgram: WebGLProgram;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.compositeProgram = this.createCompositeProgram();
  }

  /**
   * Composite pass texture to screen with sub-pixel offset
   *
   * This handles the smooth scrolling by applying fractional
   * pixel offsets when drawing the pass textures.
   */
  compositePass(
    passTexture: WebGLTexture,
    screenCanvas: HTMLCanvasElement,
    view: WorldCameraView
  ): void {
    const { gl } = this;

    // Render to screen (null framebuffer)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, screenCanvas.width, screenCanvas.height);

    gl.useProgram(this.compositeProgram);

    // Set sub-pixel offset
    const offsetX = -view.subTileOffsetX;
    const offsetY = -view.subTileOffsetY;
    gl.uniform2f(
      gl.getUniformLocation(this.compositeProgram, 'u_offset'),
      offsetX / screenCanvas.width * 2,
      offsetY / screenCanvas.height * 2
    );

    // Bind pass texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, passTexture);
    gl.uniform1i(
      gl.getUniformLocation(this.compositeProgram, 'u_texture'),
      0
    );

    // Draw fullscreen quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Composite shader for pass textures
   */
  private createCompositeProgram(): WebGLProgram {
    const vertSrc = `#version 300 es
      in vec2 a_position;
      uniform vec2 u_offset;
      out vec2 v_texCoord;

      void main() {
        // Fullscreen quad positions: (-1,-1), (1,-1), (-1,1), (1,1)
        vec2 positions[4] = vec2[4](
          vec2(-1, -1), vec2(1, -1), vec2(-1, 1), vec2(1, 1)
        );
        vec2 pos = positions[gl_VertexID];

        // Apply sub-pixel offset
        gl_Position = vec4(pos + u_offset, 0, 1);

        // Texture coordinates (0,0) to (1,1)
        v_texCoord = pos * 0.5 + 0.5;
        v_texCoord.y = 1.0 - v_texCoord.y;  // Flip Y
      }
    `;

    const fragSrc = `#version 300 es
      precision highp float;
      in vec2 v_texCoord;
      uniform sampler2D u_texture;
      out vec4 fragColor;

      void main() {
        fragColor = texture(u_texture, v_texCoord);
      }
    `;

    return this.compileProgram(vertSrc, fragSrc);
  }
}
```

---

## 9. Elevation & Layer Filtering

The existing `ElevationFilter` class works unchanged. The WebGL pass renderer calls it the same way:

```typescript
// In WebGLRenderPipeline.render()
const { below: filterBelow, above: filterAbove } =
  this.elevationFilter.createFilter(playerElevation);

// Background pass (no elevation filter)
this.passRenderer.renderBackground(ctx, view, resolveTile);

// Top layer split by elevation
this.passRenderer.renderTopLayer(ctx, view, resolveTile, 'topBelow', filterBelow);
this.passRenderer.renderTopLayer(ctx, view, resolveTile, 'topAbove', filterAbove);
```

---

## 10. Dirty Rectangle Optimization

### Combining WebGL with Dirty Tracking

Even with WebGL, we can skip re-rendering unchanged regions:

```typescript
// src/rendering/webgl/DirtyRegionTracker.ts

export class DirtyRegionTracker {
  private animatedTilePositions: Map<number, Set<string>> = new Map();
  private lastAnimationFrame: number = -1;

  /**
   * Build a map of which screen positions contain animated tiles
   */
  registerAnimatedPositions(
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    animatedTileIds: { primary: Set<number>; secondary: Set<number> }
  ): void {
    this.animatedTilePositions.clear();

    for (let y = 0; y < view.tilesHigh; y++) {
      for (let x = 0; x < view.tilesWide; x++) {
        const worldX = view.worldStartTileX + x;
        const worldY = view.worldStartTileY + y;
        const resolved = resolveTile(worldX, worldY);

        if (!resolved?.metatile) continue;

        // Check if any tile in this metatile is animated
        for (const tile of resolved.metatile.tiles) {
          const isAnimated = tile.tileId >= 512
            ? animatedTileIds.secondary.has(tile.tileId - 512)
            : animatedTileIds.primary.has(tile.tileId);

          if (isAnimated) {
            const screenKey = `${x},${y}`;
            if (!this.animatedTilePositions.has(tile.tileId)) {
              this.animatedTilePositions.set(tile.tileId, new Set());
            }
            this.animatedTilePositions.get(tile.tileId)!.add(screenKey);
          }
        }
      }
    }
  }

  /**
   * Determine if full re-render is needed or just animation update
   */
  needsFullRender(
    currentFrame: number,
    viewChanged: boolean,
    elevationChanged: boolean
  ): boolean {
    if (viewChanged || elevationChanged) {
      return true;
    }

    // Animation changes only need texture updates, not full re-render
    return this.lastAnimationFrame === -1;
  }

  /**
   * After animation update, we only need to re-upload texture regions
   * The tile positions haven't changed, so we can reuse the instance buffer
   */
  getAnimationOnlyUpdate(): boolean {
    return this.animatedTilePositions.size > 0;
  }
}
```

### Optimized Render Loop

```typescript
// In WebGLRenderPipeline
render(ctx: RenderContext, view: WorldCameraView, playerElevation: number, options: RenderOptions) {
  const needsFullRender = this.dirtyTracker.needsFullRender(
    ctx.animationFrame,
    options.viewChanged,
    options.elevationChanged
  );

  if (needsFullRender) {
    // Full re-render: rebuild instance buffers and render all passes
    this.renderAllPasses(ctx, view, playerElevation);
  } else if (options.animationChanged) {
    // Animation only: update tileset textures, reuse existing passes
    this.animationManager.updateAllAnimations(ctx.tilesetRuntimes, ctx.animationFrame);
    // Instance buffers unchanged, passes can be reused after texture update
    // Just need to re-render with same instance data
    this.reRenderWithUpdatedTextures();
  }
  // else: nothing changed, reuse previous frame's textures
}
```

---

## 11. Implementation Roadmap

### Phase 1: Foundation (3-5 days)

1. **WebGL Context Setup**
   - Create `WebGLContext.ts` with context initialization
   - Feature detection and fallback logic
   - Extension checking (instanced arrays, etc.)

2. **Shader Compilation**
   - `WebGLShaders.ts` with vertex/fragment sources
   - Compile, link, error handling
   - Uniform/attribute location caching

3. **Basic Tile Rendering**
   - `WebGLTileRenderer.ts` without animations
   - Instance buffer management
   - Single tileset rendering test

### Phase 2: Textures & Palettes (2-3 days)

4. **Texture Management**
   - `WebGLTextureManager.ts`
   - Indexed tileset upload (R8 format)
   - Palette texture upload (RGBA 16x16)

5. **GPU Palette Lookup**
   - Fragment shader palette sampling
   - Transparency handling
   - Primary/secondary tileset switching

### Phase 3: Pass System (3-4 days)

6. **Framebuffer Rendering**
   - Offscreen pass rendering
   - Three framebuffers (bg, topBelow, topAbove)

7. **Pass Renderer**
   - `WebGLPassRenderer.ts`
   - Layer type handling (COVERED, NORMAL, SPLIT)
   - Elevation filtering integration

8. **Compositor**
   - `WebGLCompositor.ts`
   - Sub-pixel scrolling
   - Pass texture blending

### Phase 4: Animation (2-3 days)

9. **Animation Manager**
   - `WebGLAnimationManager.ts`
   - Partial texture updates
   - Frame timing synchronization

10. **Integration Testing**
    - Test with all animation types
    - Phase/sequence/alt-sequence support
    - Performance profiling

### Phase 5: Integration (2-3 days)

11. **Pipeline Factory**
    - `RenderPipelineFactory.ts`
    - WebGL/Canvas2D selection
    - Seamless fallback

12. **MapRenderer Integration**
    - Hook into existing `MapRenderer.tsx`
    - Sprite rendering between passes
    - Debug overlay support

### Phase 6: Optimization (Ongoing)

13. **Dirty Rectangle Tracking**
    - Skip unchanged regions
    - Animation-only updates

14. **Benchmarking**
    - Performance comparison
    - Memory profiling
    - Mobile testing

---

## 12. Fallback Strategy

### Graceful Degradation

```typescript
// src/rendering/RenderPipelineFactory.ts

export class RenderPipelineFactory {
  static create(canvas: HTMLCanvasElement): IRenderPipeline {
    // Try WebGL 2 first (best performance)
    if (this.supportsWebGL2(canvas)) {
      try {
        return new WebGLRenderPipeline(canvas);
      } catch (e) {
        console.warn('WebGL 2 initialization failed, falling back', e);
      }
    }

    // Try WebGL 1 with extensions (good performance)
    if (this.supportsWebGL1WithExtensions(canvas)) {
      try {
        return new WebGL1RenderPipeline(canvas);
      } catch (e) {
        console.warn('WebGL 1 initialization failed, falling back', e);
      }
    }

    // Fall back to Canvas 2D (baseline)
    console.info('Using Canvas 2D renderer');
    return new CanvasRenderPipeline(new TilesetCanvasCache());
  }

  private static supportsWebGL2(canvas: HTMLCanvasElement): boolean {
    try {
      const gl = canvas.getContext('webgl2');
      return gl !== null;
    } catch {
      return false;
    }
  }

  private static supportsWebGL1WithExtensions(canvas: HTMLCanvasElement): boolean {
    try {
      const gl = canvas.getContext('webgl');
      if (!gl) return false;

      // Check for required extensions
      const instanced = gl.getExtension('ANGLE_instanced_arrays');
      return instanced !== null;
    } catch {
      return false;
    }
  }
}
```

### Common Interface

```typescript
// src/rendering/IRenderPipeline.ts

export interface IRenderPipeline {
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

---

## 13. Performance Benchmarks

### Expected Results

| Metric | Canvas 2D | WebGL | Improvement |
|--------|-----------|-------|-------------|
| **20×20 Static** | 4ms | 0.3ms | 13x |
| **20×20 Animated** | 8ms | 0.5ms | 16x |
| **40×40 Static** | 16ms | 0.5ms | 32x |
| **40×40 Animated** | 32ms | 1ms | 32x |
| **Draw Calls** | 3,200+ | 1-3 | 1000x+ |
| **Memory Transfer** | Per tile | Per frame | ~100x |

### Benchmark Code

```typescript
// src/rendering/__tests__/benchmark.ts

async function benchmarkRenderers() {
  const scenarios = [
    { name: '20x20 Static', tiles: 400, animated: false },
    { name: '20x20 Animated', tiles: 400, animated: true },
    { name: '40x40 Static', tiles: 1600, animated: false },
    { name: '40x40 Animated', tiles: 1600, animated: true },
  ];

  for (const scenario of scenarios) {
    const canvasTime = await benchmarkCanvas2D(scenario);
    const webglTime = await benchmarkWebGL(scenario);

    console.log(`${scenario.name}:`);
    console.log(`  Canvas 2D: ${canvasTime.toFixed(2)}ms`);
    console.log(`  WebGL: ${webglTime.toFixed(2)}ms`);
    console.log(`  Speedup: ${(canvasTime / webglTime).toFixed(1)}x`);
  }
}
```

---

## Summary

The WebGL tile renderer provides massive performance improvements by:

1. **Batching**: 3,200+ draw calls → 1 instanced draw
2. **GPU Palette Lookup**: Per-pixel CPU work → parallel GPU work
3. **Texture Updates**: Full re-upload → partial region updates
4. **State Minimization**: Constant state changes → stable GPU state

The implementation integrates cleanly with the existing architecture:
- Same `RenderPipeline` orchestration
- Same elevation filtering logic
- Same animation configuration
- Automatic fallback to Canvas 2D

With a 2-3 week implementation timeline, this optimization enables:
- 40×40 tile viewports at 60fps
- Heavy animation (water, weather) without slowdown
- Headroom for future features (shadows, lighting, particles)
