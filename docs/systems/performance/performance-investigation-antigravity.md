---
title: Performance Investigation: GamePage & Rendering Pipeline
status: reference
last_verified: 2026-01-13
---

# Performance Investigation: GamePage & Rendering Pipeline

## Executive Summary

The current rendering implementation in `src/pages/GamePage.tsx` and associated components uses a **hybrid WebGL + Canvas2D** approach. While the tile rendering itself is hardware-accelerated via WebGL, the final frame composition relies heavily on the CPU-bound Canvas2D API.

**Critical Bottlenecks:**
1.  **Ping-Pong Rendering**: The pipeline switches between WebGL rendering and Canvas2D drawing multiple times per frame.
2.  **Excessive `drawImage` Calls**: `compositeWebGLFrame` calls `ctx2d.drawImage(webglCanvas)` at least 4-6 times per frame. This forces expensive GPU-to-CPU synchronization and texture readbacks.
3.  **Garbage Collection Pressure**: `useWebGLSpriteBuilder` creates hundreds of new objects every frame and, critically, creates new HTML `<canvas>` elements and 2D contexts every frame for door animations.

**Recommendation**: Move to a **Pure WebGL Compositing** pipeline where the entire frame is assembled on the GPU, and the 2D canvas is reserved strictly for UI overlays.

---

## Detailed Analysis

### 1. The "Ping-Pong" Compositing Issue

**Location**: `src/rendering/compositeWebGLFrame.ts`

The current frame composition logic interleaves WebGL rendering with Canvas2D drawing to achieve specific layer ordering (e.g., sprites between tile layers).

**Current Flow (Simplified):**
1.  **WebGL**: Render Background Layer -> Framebuffer
2.  **Canvas2D**: `drawImage(backgroundFramebuffer)` (Readback!)
3.  **WebGL**: Render Sprites (Low Priority) -> WebGL Canvas
4.  **Canvas2D**: `drawImage(webglCanvas)` (Readback!)
5.  **WebGL**: Render TopBelow Layer -> Framebuffer
6.  **Canvas2D**: `drawImage(topBelowFramebuffer)` (Readback!)
7.  ...and so on for TopAbove, Priority 0 sprites, etc.

**Impact**:
*   **GPU Stalls**: The CPU has to wait for the GPU to finish rendering a layer before it can draw it to the 2D canvas.
*   **Bus Bandwidth**: Transferring frame data from GPU memory to CPU memory (or even texture-to-texture copies via the browser's compositor) is slow compared to keeping it all on the GPU.
*   **Performance Cap**: This architecture likely caps performance well below 60fps on lower-end devices and consumes excessive power.

### 2. Sprite Builder Allocations

**Location**: `src/hooks/useWebGLSpriteBuilder.ts`

This hook runs every frame to prepare sprites for rendering.

**Issue A: Object Churn**
It creates new `SpriteInstance` objects for every entity (Player, NPCs, Field Effects) every single frame.
```typescript
// Inside the loop
const npcSprite = createNPCSpriteInstance(npc, info.sortKey, isOnLongGrass);
// ...
targetArray.push(npcSprite);
```
This generates significant garbage, leading to frequent GC pauses.

**Issue B: The Canvas Leak (Critical)**
For door animations, it creates a new canvas element *every frame*:
```typescript
// Lines 151-154
const canvas = document.createElement('canvas');
canvas.width = spriteData.width;
canvas.height = spriteData.height;
const canvasCtx = canvas.getContext('2d');
```
Creating DOM elements and 2D contexts inside a render loop is extremely expensive and a major performance killer.

### 3. React State Updates

**Location**: `src/pages/GamePage.tsx`

The `renderLoop` triggers React state updates via:
*   `setStats` (every 500ms)
*   `setCameraDisplay` (every 500ms)
*   `setMapDebugInfo` (every ~500ms)
*   `setPlayerDebugInfo` (every ~500ms)
*   `setReflectionTileGridDebug` (every ~100ms)

While mostly throttled, `setReflectionTileGridDebug` running at 10fps (every 6 frames) triggers a full React re-render of `GamePage` and its children 10 times a second. If the component tree is complex, this adds unnecessary main-thread load.

---

## Proposed Optimization Plan

### Phase 1: Pure WebGL Compositing (High Impact)

**Goal**: Eliminate `ctx2d.drawImage` from the render loop.

1.  **Single WebGL Canvas**: Use the WebGL canvas as the main display element.
2.  **Shader-Based Compositing**:
    *   Render all tile layers (Background, TopBelow, TopAbove) to textures (already done).
    *   Render sprites to a texture (or directly to the accumulation buffer) with depth testing or manual sorting.
    *   Use a "Compositor Shader" or simply draw textured quads in the correct order to the default framebuffer (screen).
3.  **Layer Ordering in WebGL**:
    *   Draw Quad (Background Texture)
    *   Draw Sprites (Low Priority)
    *   Draw Quad (TopBelow Texture)
    *   Draw Sprites (Main)
    *   Draw Quad (TopAbove Texture)
    *   Draw Sprites (High Priority)
4.  **UI Overlay**: Keep the 2D canvas *only* for the Dialog Box and Debug Panel, layered on top of the WebGL canvas using CSS absolute positioning.

### Phase 2: Sprite Builder Optimization (Medium Impact)

1.  **Fix Door Animations**:
    *   Upload door animation frames to a texture atlas *once* when the map loads or when the animation starts.
    *   Do not create canvases in the render loop.
2.  **Object Pooling**:
    *   Implement a `SpriteInstancePool` to reuse sprite objects instead of allocating new ones.
    *   Or, use a flat `Float32Array` for sprite data from the start, avoiding objects entirely (Data-Oriented Design).

### Phase 3: React Optimization (Low Impact)

1.  **Detach Render Loop**: Ensure the `renderLoop` is completely independent of React state.
2.  **Throttling**: Reduce the frequency of debug info updates or only update when the Debug Panel is actually open.
3.  **CSS Transforms**: Use CSS transforms for the camera/viewport if possible (though WebGL handles this better).

---

## Immediate Action Items

1.  **Refactor `useWebGLSpriteBuilder`**: Immediately fix the `document.createElement('canvas')` issue.
2.  **Refactor `compositeWebGLFrame`**: Rewrite to use `gl.drawArrays` with textured quads for layer composition instead of `ctx2d.drawImage`.
