---
title: What the user sees
status: reference
last_verified: 2026-01-13
---

Viewport resize stretch investigation (Codex)  
Date: 2025-12-04

## What the user sees
- Changing the viewport in the debug panel (e.g., 20×20 → 30×20) makes the map **stretch** instead of showing more tiles. A 320 px wide view simply scales up to 480 px instead of revealing ~10 extra tiles.

## How the viewport size is supposed to flow
- `DebugPanel` → `onViewportChange` updates `GamePage` state `viewportConfig`.
- `GamePage` derives `viewportPixelSize = tilesWide * 16` / `tilesHigh * 16` in render.
- `useEffect([stateManager, viewportConfig])` pushes the config to the `GameStateManager` so states know the new viewport.
- `useEffect([viewportConfig])` calls `camera.updateConfig(...)`, so the camera math (tile count, clamping) picks up the new size.
- The render loop then sizes the display canvas and builds the camera view from `camera.getView(...)` before invoking the WebGL pipeline.

## Where it breaks
- The main WebGL render loop in `src/pages/GamePage.tsx` is created inside a `useEffect` with an **empty dependency array** (`}, []);` at line ~1446).  
- Inside that loop, the canvas dimensions come from `viewportPixelSize` captured at mount:
  - Lines 1074–1082 use `const viewportWidth = viewportPixelSize.width;` and set `displayCanvas.width/height` only if they differ.
  - Because the effect never re-runs, `viewportPixelSize` is forever the initial 20×20 (320×320) even after the debug panel changes it.
- React *does* re-render JSX when the debug slider changes, so the `<canvas>` style `width/height` props update to the new pixel size (`style={{ width: viewportPixelSize.width * zoom }}` at ~1686). The DOM canvas’ intrinsic resolution, however, stays at 320×320 because the render loop keeps resetting it to the stale value.
- Resulting chain:
  - CSS size grows to 480 px (or whatever) → browser scales the 320 px backing store → tiles look bigger (stretch).
  - Camera and pipeline think the viewport is larger (camera config is updated), so `camera.getView(1)` returns ~31×21 tiles and the pipeline renders a ~496 px-wide frame.
  - That 496 px frame is drawn onto a 320 px `displayCanvas` (set by the stale value), so only the left portion lands in the backing store; then the browser scales that 320 px buffer to the larger CSS size. Visible outcome: still ~20 tiles, just magnified.

## Key code references
- Render loop effect and stale closure: `src/pages/GamePage.tsx` lines 680–1446, dependency `[]`.
- Canvas sizing using stale viewport: `src/pages/GamePage.tsx` lines 1074–1082.
- JSX style that *does* respond to the new viewport: `src/pages/GamePage.tsx` lines 1686–1705.
- Camera config update when viewport changes (works correctly): `src/pages/GamePage.tsx` lines 1659–1668.

## Fix direction (not applied)
- Make the render loop aware of the latest viewport size. Options:
  1) Add `viewportPixelSize`/`viewportConfig` as dependencies and recreate the loop when they change (reset RAF + canvas sizing).  
  2) Store the latest viewport dimensions in a ref and read from that inside the loop instead of the captured value.
- Ensure the display canvas `.width/.height` attributes are updated when the viewport changes so the backing store matches the CSS size (maintains 1:1 pixels and the correct tile count).

