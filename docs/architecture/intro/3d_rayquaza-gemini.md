---
title: Investigation: High-Resolution 3D Rayquaza on Retro Canvas
status: reference
last_verified: 2026-01-13
---

# Investigation: High-Resolution 3D Rayquaza on Retro Canvas

## Objective
We want to render the 3D Rayquaza model on the Title Screen at **native device resolution** (smooth, high-definition edges) while keeping the rest of the UI (logos, clouds, text) at the authentic **retro pixel resolution** (sharp, giant pixels).

## Current State Analysis

### The Bottleneck
Currently, the game renders in a strictly "retro-first" pipeline:

1.  **Logical Resolution**: The game logic operates at `320x320` (GBA-ish resolution).
2.  **Canvas Resolution**: `src/pages/GamePage.tsx` initializes the `stateCanvas` dimensions to exactly `320x320` pixels.
    ```typescript
    // GamePage.tsx
    stateCanvas.width = VIEWPORT_PIXEL_SIZE.width;   // 320
    stateCanvas.height = VIEWPORT_PIXEL_SIZE.height; // 320
    ```
3.  **CSS Scaling**: This tiny canvas is stretched via CSS to fill the screen (e.g., `640x640` at 2x zoom). The `image-rendering: pixelated` CSS property ensures this stretching results in sharp, blocky pixels.

### The Problem
The `TitleScreenState.ts` attempts to render a high-res Rayquaza, but it hits a bottleneck:

1.  It correctly renders Rayquaza to an offscreen canvas at high resolution (`1280x1280`).
2.  It draws this high-res image onto the main `stateCanvas`.
3.  **Rasterization**: Because the `stateCanvas` is physically only `320x320` pixels, the browser **downsamples** the high-res Rayquaza into a jagged 320x320 bitmap.
4.  **Upscaling**: The browser then stretches that jagged bitmap back up to `640x640` via CSS.

**Result**: You lose all the sub-pixel detail. The 3D model looks like low-res pixel art (which is a valid aesthetic, but not the goal here).

## Proposed Solution: Mixed-Resolution Rendering

To achieve pixel-perfect retro art *and* HD 3D effects simultaneously, we must invert the rendering pipeline. Instead of "render small, scale up," we will "render big, scale draw commands."

### 1. Resize the Canvas
The `stateCanvas` in `GamePage.tsx` must be sized to the **Display Resolution** (e.g., 640x640), not the **Game Resolution**.

```typescript
// GamePage.tsx
const displayWidth = VIEWPORT_PIXEL_SIZE.width * zoom;
const displayHeight = VIEWPORT_PIXEL_SIZE.height * zoom;

stateCanvas.width = displayWidth;
stateCanvas.height = displayHeight;
```

### 2. Apply Global Scaling for Retro Art
To keep the pixel art looking correct (i.e., large pixels), we apply a scaling matrix to the 2D context before passing it to the game state.

```typescript
// GamePage.tsx
const ctx = stateCanvas.getContext('2d');
ctx.scale(zoom, zoom); // Global scale matrix
// Now drawing a 16x16 sprite at (0,0) will actually fill 32x32 pixels on screen
```

This ensures that all existing drawing code (drawing logos, text, clouds) continues to work unchanged. It thinks it's drawing to a 320x320 screen, but the browser is painting scaled-up pixels.

### 3. Bypass Scaling for 3D
In `TitleScreenState.ts`, when we are ready to draw Rayquaza, we temporarily break out of the scaling matrix.

```typescript
// TitleScreenState.ts render()

// 1. Draw background (Clouds) - Uses global scale (Retro look)
this.renderCloudsViewport(ctx, ...);

// 2. Draw Rayquaza - Switch to HD mode
ctx.save();
ctx.resetTransform(); // RESET the global scale! We are now in 1:1 screen pixels.

// Draw the 3D canvas directly to the full-size screen canvas
ctx.drawImage(
  this.rayquazaCanvas, 
  0, 0, this.rayquazaCanvas.width, this.rayquazaCanvas.height,
  0, 0, displayWidth, displayHeight
);

ctx.restore(); // RESTORE the global scale for subsequent layers

// 3. Draw Foreground (Logos) - Uses global scale (Retro look)
this.renderPokemonLogoWithShine(ctx, ...);
```

## Implementation Steps

1.  **Modify `src/pages/GamePage.tsx`**:
    *   Update the `stateRenderLoop` to set `stateCanvas.width/height` to the *zoomed* dimensions.
    *   Apply `ctx.scale(zoom, zoom)` immediately after getting the context or clearing the frame.
    *   Ensure `ctx.imageSmoothingEnabled = false` is set on the scaled context.

2.  **Modify `src/states/TitleScreenState.ts`**:
    *   In `renderRayquaza3D`, add `ctx.save()` and `ctx.resetTransform()` before drawing the offscreen canvas.
    *   Draw the offscreen canvas to the full viewport dimensions (e.g., `this.viewportWidth * this.scale`).
    *   Call `ctx.restore()` to put the context back into "retro mode" for the rest of the frame.

3.  **Verify**:
    *   **Logos/Text**: Should look exactly as they did before (sharp, blocky pixels).
    *   **Rayquaza**: Should look smooth and high-res, effectively "sub-pixel" relative to the UI.

## Technical Note: High DPI (Retina)
For true Retina support, we should ideally multiply by `window.devicePixelRatio` as well.

*   **Canvas Size**: `width * zoom * devicePixelRatio`
*   **Context Scale**: `scale(zoom * devicePixelRatio, zoom * devicePixelRatio)`
*   **CSS Size**: `width: width * zoom px`

This would make the UI even sharper on MacBooks, but simply handling the `zoom` factor is sufficient for the "Mixed Resolution" effect requested.
