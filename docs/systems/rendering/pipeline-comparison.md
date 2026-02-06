---
title: Rendering Pipeline Comparison: GBA vs Browser
status: reference
last_verified: 2026-01-13
---

# Rendering Pipeline Comparison: GBA vs Browser

This document compares the original GBA rendering approach with our TypeScript/React implementation, highlighting key differences and opportunities.

## Architecture Comparison

| Aspect | GBA (pokeemerald) | Browser (TypeScript) |
|--------|-------------------|----------------------|
| **Rendering Model** | Hardware-accelerated, interrupt-driven | Software via Canvas 2D API |
| **Frame Rate** | Locked 60 Hz (hardware) | Target 60 FPS (best-effort) |
| **Layer System** | 4 hardware BG layers | 3 software passes |
| **Sprite System** | 128 OAM entries (hardware) | Unlimited canvas draws |
| **Animation** | DMA tile replacement | Full pass re-rendering |
| **Memory** | 96KB VRAM, strict limits | ~8MB cache budget |
| **Parallelism** | DMA runs parallel to CPU | Single-threaded |

## What GBA Does That We Emulate

### 1. Layer-Based Rendering ✅

**GBA**: 4 background layers with hardware priority
```
BG3 (lowest) → BG2 → BG1 → BG0 (highest) → Sprites
```

**Browser**: 3-pass system mimics this
```
Background → TopBelow → [Sprites] → TopAbove
```

**Status**: Well-implemented. Elevation filtering correctly handles bridge rendering and vertical objects.

### 2. Tile-Based Maps ✅

**GBA**: 8x8 tiles combined into 16x16 metatiles

**Browser**: Same structure preserved
- Metatiles stored with 8 tile indices (4 per layer)
- Palette indices per tile
- Flip flags per tile

**Status**: Exact match to original data format.

### 3. Palette System ✅

**GBA**: 16 palettes × 16 colors (256 total colors on screen)

**Browser**: Full palette support with caching
- Index 0 = transparent
- Runtime palette switching for animations

**Status**: Complete implementation with LRU caching.

### 4. Y-Sorted Sprites ✅

**GBA**: Sprites sorted by Y + priority in OAM

**Browser**: Y-sorting in ObjectRenderer

**Status**: Correct depth ordering for NPCs/objects.

## What GBA Does That We Don't (Yet)

### 1. Per-Scanline Effects ❌

**GBA**: HBlank DMA modifies registers every scanline
- Water wave distortion
- Heat shimmer effects
- Palette cycling per scanline

**Browser**: No scanline-level control
- Canvas 2D has no scanline concept
- Would need shader-based approach

**Impact**: Missing some visual fidelity for water/heat effects.

### 2. DMA-Based Tile Animation ❌

**GBA**: Replace 8-32 tiles in VRAM during VBlank (~0.1ms)
- Only modified tiles transferred
- Rest of tileset unchanged

**Browser**: Re-render entire pass when animation changes
- Even one animated tile triggers full pass
- 20x20 viewport = 400 metatiles = 3200 tiles

**Impact**: Major performance bottleneck for animated maps.

### 3. Hardware Sprite Transforms ❌

**GBA**: Affine matrices for rotation/scaling (free)
- 32 transformation matrices
- Applied by hardware during scanout

**Browser**: Canvas transforms have CPU cost
- `save()/restore()` expensive
- Each flip costs 2-3x vs non-flipped

**Impact**: Flipped tiles slower, but only ~5% of tiles.

### 4. Parallel DMA ❌

**GBA**: DMA transfers run while CPU executes game logic

**Browser**: All rendering on main thread
- Blocks game logic during render
- No parallelism

**Impact**: Frame time entirely sequential.

## What Browser Can Do Better

### 1. Memory Budget 💪

**GBA**: 96KB VRAM total

**Browser**: Gigabytes available
- Can cache many more pre-rendered canvases
- No need to decompress on-the-fly
- Can store multiple animation frames ready-to-draw

**Opportunity**: Pre-render animation frames at load time.

### 2. Resolution Independence 💪

**GBA**: Fixed 240×160, 8×8 tiles

**Browser**: Arbitrary resolution
- Can render at 2x, 3x, 4x scale
- Native high-DPI support
- Larger viewports possible

**Opportunity**: Scale viewport beyond 20×20 (original was 15×10 visible).

### 3. Parallel Computation 💪

**GBA**: Single ARM7 CPU

**Browser**: Multiple threads available
- Web Workers for offscreen processing
- OffscreenCanvas for worker rendering
- GPU compute via WebGL/WebGPU

**Opportunity**: Move palette application to workers.

### 4. GPU Acceleration 💪

**GBA**: Fixed-function 2D hardware

**Browser**: Programmable GPU via WebGL/WebGPU
- Custom shaders for effects
- Instanced rendering for tiles
- GPU-side palette lookup

**Opportunity**: WebGL backend for 10-100x performance.

## Performance Characteristics

### Frame Budget

| Platform | Frame Time | CPU Available |
|----------|------------|---------------|
| GBA | 16.67ms | ~5ms (rest is display) |
| Browser | 16.67ms | ~12ms (with overhead) |

### Current Bottlenecks (Browser)

1. **Full Pass Re-render**: Animation change → redraw all 3200 tiles
2. **Palette Cache Misses**: Weather/reflections create new combos
3. **Main Thread Blocking**: No parallelism during render
4. **Canvas 2D Limits**: No GPU batching

### GBA Advantages We Can't Match

1. **Zero-Copy Tile Updates**: DMA directly to VRAM
2. **Scanline Effects**: Hardware-level timing
3. **Guaranteed Frame Rate**: Hardware-locked 60 Hz

### Browser Advantages We Don't Exploit

1. **WebGL Batching**: Draw thousands of tiles in one call
2. **Worker Threads**: Parallel palette/animation processing
3. **GPU Compute**: Shader-based palette lookup
4. **Texture Atlases**: All tiles in one GPU texture

## Key Insight: Different Optimization Strategies

### GBA Strategy: Minimize Changes
- Only update what changed (DMA specific tiles)
- Hardware handles compositing
- CPU does game logic while DMA runs

### Browser Strategy Should Be: Batch Everything
- Pre-compute as much as possible
- Upload once, draw many
- Let GPU do the heavy lifting

## Recommendations Summary

| GBA Technique | Browser Equivalent | Priority |
|---------------|-------------------|----------|
| DMA tile update | Dirty rectangle tracking | High |
| OAM sprites | Sprite batching / WebGL | Medium |
| HBlank effects | Fragment shaders | Low |
| Palette lookup | GPU palette texture | High |
| VBlank sync | RAF + fixed timestep | ✅ Done |
| Layer priority | 3-pass system | ✅ Done |

## Conclusion

The current implementation faithfully reproduces GBA rendering **semantics** but not **performance characteristics**. The GBA's strength was surgical updates (change only what's needed). Our implementation does wholesale re-rendering.

**Key optimization opportunity**: Move from "re-render everything" to "update only changes" through:
1. Dirty rectangle tracking for animations
2. WebGL for GPU-accelerated tile batching
3. Worker threads for parallel processing

See [optimization-recommendations.md](./optimization-recommendations.md) for detailed implementation strategies.
