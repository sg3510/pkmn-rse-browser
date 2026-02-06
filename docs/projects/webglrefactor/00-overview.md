---
title: WebGL/Canvas2D Refactoring Plan - Overview
status: reference
last_verified: 2026-01-13
---

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

## Document Index

| Doc | Title | Status |
|-----|-------|--------|
| [01](./01-current-state.md) | Current State Analysis | ✅ Complete |
| [02](./02-shared-abstractions.md) | Shared Abstractions | ✅ Complete |
| [03](./03-implementation-phases.md) | Implementation Phases | ✅ Complete |
| [04](./04-component-breakdown.md) | Component Breakdown | ✅ Complete |
| [05](./05-quick-start.md) | Quick Start Guide | ✅ Complete |
| [06](./06-detailed-checklist.md) | Detailed Checklist | ✅ Complete |
| [07](./07-additional-deduplication.md) | Additional Deduplication | ✅ Complete |
| [08](./08-door-warp-unification.md) | Door/Warp Unification | ✅ Complete |
| [09](./09-webgl-sprite-renderer.md) | **WebGL Sprite Renderer** | 🔲 Planned |

## Current Progress

### Phase 1-8: Completed ✅

- WebGLMapPage.tsx: **1204 lines** (down from 2154, -44%)
- Shared hooks and utilities across Canvas2D and WebGL
- Door/warp system unified via `DoorActionDispatcher`

### Phase 9: Full WebGL Rendering (Next)

**Problem:** Current hybrid rendering requires 3 GPU→CPU→GPU round trips per frame for sprite interleaving.

**Solution:** Unified WebGL sprite renderer that eliminates Canvas2D sprite rendering entirely.

**Expected gains:**
- Eliminate 2 framebuffer copy operations per frame
- Enable future GPU effects (weather, time-of-day, shaders)
- Cleaner single-pipeline architecture

See [09-webgl-sprite-renderer.md](./09-webgl-sprite-renderer.md) for full implementation plan.
