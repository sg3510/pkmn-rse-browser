# Rendering Plan Review

## Does the current plan make sense?
- The direction (dirty rectangles → WebGL instancing + GPU palette → workers) is sensible and aligns with the main bottlenecks called out in the docs.
- WebGL is the right long‑term backend: one instanced draw replaces thousands of `drawImage` calls and unlocks GPU palette lookup and sub‑pixel scrolling with minimal CPU cost.
- Keeping Canvas2D as a fallback is important for older/mobile devices and for incremental delivery while WebGL lands.

## Suggested adjustments
- Add a **baseline + regression benchmark harness** before any changes (same scenarios as `optimization-recommendations.md`), run per PR.
- Ship **Canvas quick wins first** (dirty rectangles + animation pre‑render) to de‑risk and give immediate gains while WebGL is built.
- Target **WebGL2 first, WebGL1 with ANGLE_instanced_arrays fallback**, then Canvas2D as last resort.
- Treat **palette/tileset uploads as R8 + NEAREST** and use `texSubImage2D` for animation deltas; avoid full `texImage2D` each frame. citeturn0search6
- Move expensive per-frame work to workers via **OffscreenCanvas**; browsers allow rendering off the main thread and it materially reduces jank. citeturn0search0
- Prefer **instanced rendering** for tile/sprite batches; it is the standard approach to cut draw calls. citeturn0search5
- Use a **single atlas/texture array** per tileset class to minimize binds/state changes. citeturn1search1
- Handle **context loss/restore** early (WebGL contexts can drop on memory pressure); wire a `webglcontextlost` listener and re-upload textures. citeturn0search6

## Piecewise build roadmap
1) **Baseline metrics**: lock scenarios + perf budget; add automated microbench + profile capture scripts.
2) **Canvas quick wins**: dirty rectangle tracker for animated tiles; pre-render animation frames to ImageBitmap; keep existing passes.
3) **Workers**: move palette application and per-pass rendering to OffscreenCanvas workers; main thread only composites.
4) **WebGL MVP (tiles only)**: WebGL2 path that renders one tileset, no animation; instanced quads, palette texture, NEAREST sampling; hook into existing compositor.
5) **WebGL animations**: partial `texSubImage2D` uploads for animated tiles; reuse instance buffers when only textures change.
6) **Multi-tileset + elevation**: support secondary tileset flag, elevation filters, three-pass framebuffers; keep Canvas path intact.
7) **Dirty reuse in WebGL**: skip re-build of instance buffers if camera/elevation stable; only rerender passes whose textures changed.
8) **Fallback & hardening**: WebGL1 + ANGLE path, context-loss recovery, feature flags, mobile QA; document memory ceilings.
9) **Bench & tune**: compare Canvas vs WebGL across target devices; adjust atlas sizing, buffer reuse, worker count.

## WebGL viability call
- **Yes**: Massive draw-call reduction and GPU palette lookup solve the documented hotspots. Risks are manageable (context loss, driver quirks, mobile perf) with fallbacks and feature flags.

## What I would change/clarify
- Make **RenderPipelineFactory** the single entry to select Canvas/WebGL; keep API identical so MapRenderer stays stable.
- Define **texture formats** up front (R8 for tiles, 16×16 RGBA for palettes) and maximum atlas sizes (power-of-two ≤4096 for broad device support).
- Add a **small conformance test**: render known tiles/palettes and pixel-compare to Canvas output to catch shader/palette bugs.
- Document **memory budgets** (e.g., tileset atlas ≤8–16 MB, framebuffers ≤2× viewport) and enforce in code.

## Proposed file changes (next steps)
- Add `doc/rendering/webgl-plan.md` (or merge into this file) capturing formats, fallbacks, and QA checklist.
- Add a `bench/` script to run the scenarios from `optimization-recommendations.md` on both backends.
