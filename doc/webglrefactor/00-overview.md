# WebGL/Canvas2D Refactoring Plan - Overview

## Goal

Refactor `WebGLMapPage.tsx` (2154 lines) into smaller, modular components that can be shared with `MapRenderer.tsx` (466 lines), enabling:

1. **Renderer-agnostic game logic** - Same player controller, warp system, door animations across both renderers
2. **Swappable rendering pipelines** - WebGL for performance, Canvas2D for compatibility
3. **Smaller, maintainable files** - Target ~200-400 lines per component
4. **Code reuse** - Eliminate duplication between WebGLMapPage and MapRenderer

## Current State Summary

| File | Lines | Purpose |
|------|-------|---------|
| `WebGLMapPage.tsx` | 2154 | Full WebGL renderer with player, warps, world management |
| `MapRenderer.tsx` | 466 | Canvas2D renderer using extracted hooks |

### Key Observation

`MapRenderer.tsx` is already well-structured using hooks:
- `useRunUpdate` - Game loop logic
- `useCompositeScene` - Scene rendering
- `useWarpExecution` - Warp handling
- `useDoorSequencer`, `useDoorAnimations`, `useArrowOverlay` - Field effects

`WebGLMapPage.tsx` has similar logic but implemented inline, creating massive duplication.

## Proposed Architecture

```
src/
├── components/
│   └── game/
│       ├── GameContainer.tsx        # Unified container (renderer-agnostic)
│       ├── GameCanvas.tsx           # Canvas management
│       ├── PlayerRenderer.tsx       # Player sprite rendering
│       └── DebugPanels/             # Extracted debug UI
│           ├── TileDebugPanel.tsx
│           ├── MapDebugPanel.tsx
│           └── WarpDebugPanel.tsx
├── hooks/
│   ├── useGameLoop.ts              # Unified game loop (NEW)
│   ├── useWorldManager.ts          # World/map loading (NEW)
│   ├── useCamera.ts                # Camera positioning (NEW)
│   └── [existing hooks]
├── services/
│   └── GameEngine.ts               # Core game engine (NEW)
└── rendering/
    ├── IRenderPipeline.ts          # Already exists!
    ├── RenderPipelineFactory.ts    # Already exists!
    └── ...
```

## Success Metrics

1. `WebGLMapPage.tsx` reduced to <500 lines
2. `MapRenderer.tsx` and `WebGLMapPage.tsx` share 80%+ of game logic
3. Adding new field effects works in both renderers automatically
4. Switching renderers requires only pipeline swap, not code changes
