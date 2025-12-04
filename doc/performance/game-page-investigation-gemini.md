# Game Page Performance Investigation (Gemini)

**Date:** December 3, 2025
**Target:** `src/pages/GamePage.tsx` and the Rendering Pipeline

## Executive Summary

The current implementation of `GamePage` and its rendering pipeline suffers from a major architectural bottleneck: **Hybrid Canvas 2D / WebGL Rendering**. 

The game renders layers to off-screen WebGL Framebuffers, composites them to a WebGL Canvas, and then—**critical flaw**—copies the WebGL canvas content to a 2D Canvas context (`ctx2d.drawImage`) *multiple times per frame* (up to 6 times) to achieve layer interleaving (Z-ordering). This forces frequent GPU-CPU synchronizations and heavy texture bandwidth usage.

Additionally, the React component structure causes unnecessary re-renders of the main game loop container, and the render loop itself generates significant Garbage Collection (GC) pressure through frequent object allocation.

**Potential Gain:** Converting to a **Pure WebGL** pipeline (removing the 2D canvas entirely) could yield a 2x-5x performance improvement on low-end devices and eliminate micro-stuttering.

---

## 1. Major Bottleneck: Hybrid Rendering Pipeline

### The Problem
In `src/rendering/compositeWebGLFrame.ts`, the function `compositeWebGLFrame` orchestrates the frame rendering. It interleaves tile layers and sprite layers. The current sequence is:

1.  **Render Layer 0** (Tiles) -> WebGL Canvas -> `ctx2d.drawImage`
2.  **Render Reflections** (Sprites) -> WebGL Canvas -> `ctx2d.drawImage`
3.  **Render Layer 1** (Tiles) -> WebGL Canvas -> `ctx2d.drawImage`
4.  **Render Door/Arrow Overlays** -> WebGL Canvas -> `ctx2d.drawImage`
5.  **Render Main Sprites** -> WebGL Canvas -> `ctx2d.drawImage`
6.  **Render TopAbove** (Tiles) -> WebGL Canvas -> `ctx2d.drawImage`
7.  **Render Fade** -> WebGL Canvas -> `ctx2d.drawImage`

**Why this is slow:**
*   `ctx2d.drawImage(webglCanvas)` is not a simple copy. It requires the browser to synchronize the WebGL context, potentially read back pixels (or copy the texture resource), and composite it into the 2D canvas bitmap.
*   Doing this ~6-7 times *every 16ms* is extremely expensive.
*   The `displayCanvas` is fundamentally redundant. The `webglCanvas` already contains the rendered pixels; we just need to keep them there and layer them correctly using WebGL blending.

### The Solution: Pure WebGL Compositing
We must eliminate `displayCanvas` (Canvas 2D) and render everything directly to the visible `webglCanvas`.

**New Rendering Flow (Single Frame):**
1.  Bind `webglCanvas` (Default Framebuffer). Clear.
2.  **Draw Background FBO** (via `WebGLCompositor` quad).
3.  **Draw Reflections** (via `WebGLSpriteRenderer` directly to screen).
4.  **Draw TopBelow FBO** (via `WebGLCompositor` quad).
5.  **Draw Main Sprites** (via `WebGLSpriteRenderer` directly to screen).
6.  **Draw TopAbove FBO** (via `WebGLCompositor` quad).
7.  **Draw Fade** (via `WebGLFadeRenderer` directly to screen).

This reduces the frame to a series of cheap draw calls on the GPU, with zero CPU pixel copying.

---

## 2. Garbage Collection (GC) Pressure

The main render loop in `GamePage.tsx` and `useWebGLSpriteBuilder.ts` allocates many short-lived objects every frame. This fills the heap and triggers the Garbage Collector (GC), causing "stop-the-world" pauses (stutter).

### Offenders

1.  **`buildSprites` (in `useWebGLSpriteBuilder.ts`)**:
    *   Creates new arrays (`lowPrioritySprites = []`, `allSprites = []`, etc.) every frame.
    *   Creates new `SpriteInstance` objects (POJOs) for every single sprite, player, and effect, every frame.
    *   *Fix:* Implement an **Object Pool** for `SpriteInstance` and reuse the arrays (clear them instead of creating new ones).

2.  **`buildWorldCameraView` (in `GamePage.tsx`)**:
    *   Allocates a new object `{ cameraX, ... }` every frame.
    *   *Fix:* Use a mutable object that persists across frames.

3.  **Debug Info**:
    *   `sortedSpritesDebug` inside `GamePage.tsx` iterates all sprites and creates massive amounts of debug objects when the debug panel is open (or even just enabled).

---

## 3. React Performance

### The Problem
`GamePage` manages high-frequency state:
*   `setStats` (every 500ms)
*   `setCameraDisplay` (every 500ms)
*   `setMapDebugInfo` (every 30 frames)
*   `setReflectionTileGridDebug` (every 6 frames)

When these update, the **entire `GamePage` component re-renders**. This means React runs its reconciliation algorithm, diffing the VDOM for the whole page.

While the render loop itself is inside a `useEffect` (and thus immune to function recreation), the *surrounding* component work steals CPU time from the main thread, which is shared with the game loop.

### The Solution
*   **Decouple State:** Move high-frequency stats to a `ref` or a mutable store (e.g., `Zustand` with transient updates, or just a `MutableRefObject` that the `DebugPanel` polls).
*   **Leaf Components:** If visual updates are needed, push the state down to tiny leaf components (e.g., `<FPSCounter />`) so only they re-render, not the whole page.

---

## 4. Texture Management Overhead

### Door Animations
In `useWebGLSpriteBuilder.ts`:
```typescript
const canvas = document.createElement('canvas'); // HEAVY!
canvas.getContext('2d'); // HEAVY!
spriteRenderer.uploadSpriteSheet(...)
```
This happens inside the loop whenever a new door animation frame is needed. Creating DOM elements and 2D contexts in a render loop is a performance antipattern.

**Fix:** Pre-allocate a single "scratch" canvas or, better yet, generate all door animation frames onto a single texture atlas at load time (or lazily but permanently).

---

## 5. Specific Code Hotspots

*   **`src/rendering/compositeWebGLFrame.ts`**: The logic here is sound for ordering, but the implementation (targeting `ctx2d`) is the bottleneck.
*   **`src/hooks/useWebGLSpriteBuilder.ts`**: The `create*Sprite` functions allocate new objects.
*   **`src/game/WorldManager.ts`**: `scheduler.update` runs every frame. If the logic is complex, it should be throttled (e.g., run every 10 frames), as tile loading doesn't need 60fps precision.

---

## Implementation Plan

### Phase 1: Pure WebGL (High Impact)
1.  Modify `GamePage.tsx`:
    *   Make `webglCanvasRef` the visible canvas.
    *   Remove `displayCanvasRef`.
    *   Ensure `DialogBox` and other UI sits *on top* (z-index) of the WebGL canvas.
2.  Modify `compositeWebGLFrame.ts`:
    *   Change signature to accept `gl` context instead of `ctx2d`.
    *   Replace `ctx2d.drawImage` calls with `compositor.compositeToScreen(...)`.
    *   Replace `spriteRenderer.renderBatch` calls to target the default framebuffer directly.

### Phase 2: GC Reduction (Medium Impact)
1.  Create a `SpriteInstancePool` class.
2.  Refactor `useWebGLSpriteBuilder` to acquire instances from the pool and release them at the end of the frame.
3.  Refactor `GamePage` to reuse `WorldCameraView` object.

### Phase 3: React Optimization (Polish)
1.  Wrap `DebugPanel` in `React.memo`.
2.  Move stats state out of `GamePage`.

---

**Recommendation:** Start with **Phase 1**. It requires changes to `GamePage.tsx` and `compositeWebGLFrame.ts` but will provide the most immediate and drastic smoothness improvement.
