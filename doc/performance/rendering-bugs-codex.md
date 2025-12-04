# Rendering Bugs & Layer Flicker (Codex deep dive)

Context: WebGL hybrid renderer on `GamePage`/`GameRenderer` after the “dirty-tracking” optimizations. Symptoms:  
1) Idle black-out of tiles below the player (reappears when panning/warp).  
2) NPCs drawn under tiles at rest; shoreline (metatile 178) draws over player.  
3) Player/NPCs vanish on sand until movement resumes.

Below are the concrete causes and fixes that keep dirty-tracking intact (no permanent `needsFullRender: true`), with file/line references.

---

## 1) Idle black bottom layer
**Cause (WebGL path):** When only animations tick (`animationChanged=true`) and the pipeline is still unrendered (e.g., right after tileset upload or map stitch), we take the “animation-only” fast path. In `WebGLRenderPipeline.render` (`src/rendering/webgl/WebGLRenderPipeline.ts`, animationOnly branch), we call `passRenderer.rerenderCached()`. If no cached instances/dimensions exist yet (first frame after upload/invalidate), `getCurrentDimensions()` returns `null`, so **no passes are rendered** and the previously cleared framebuffers stay blank. They become visible again once a later frame triggers a full render (camera move/warp), hence the “at rest” black flicker.

**Fix (performance-friendly):**
- In the animationOnly branch, fall back to `needsFullRender=true` when `getCurrentDimensions()` is null or cachedInstances are empty. This keeps dirty-tracking for steady-state but guarantees a full paint the first time after uploads/invalidation.
- Optional guard: if animation manager reports updates but `rerenderCached` drew 0 instances, flip `needsFullRender=true` for the next frame.

Impact: One full render per tileset upload/invalidate; steady-state still uses partial rerenders.

---

## 2) NPCs under tiles & shoreline over player
**Cause:** The reflection path uses the shortcut `renderAndCompositeLayer1Only` (`src/rendering/compositeWebGLFrame.ts` → `WebGLRenderPipeline.renderLayer1Only`). That call renders **layer 1 of *all* metatiles** without elevation filtering or layer-type checks. COVERED tiles and off-elevation BG1 tiles are therefore drawn in front of sprites, breaking priority at rest (NPCs hidden; shoreline top over player).

**Fix (no perf cost):**
- Remove the `renderLayer1Only` shortcut; instead call the normal three-pass render with the existing elevation filters (`renderTopBelow`/`renderTopAbove`) and then composite TopAbove. The reflection sequence can still be: render layer0 -> reflections -> normal split passes.

This keeps cached instances and dirty-tracking; only restores correct filtering.

---

## 3) Player/NPC disappear on sand until movement
**Cause:** In `compositeWebGLFrame.ts` we mutate the already sorted `allSprites` array in-place when inserting the surf blob (binary insert). The same array is later reused by debug/build logic and by the render passes that split around the player. On sand frames where footprints are added concurrently, the in-place splice shifts ordering; the split layers skip the player/NPC for that frame.

**Fix (tiny cost):**
- Insert surf blob into a **copy** (`const sprites = [...allSprites];` then insert) before further use, or move surf-blob creation into the builder so the compositor treats sprite lists as immutable. No change to dirty-tracking.

---

## 4) Dirty-tracking safety net (keep perf, avoid black-outs)
Add two lightweight safeguards:
1. **First-frame guard:** In both Canvas2D and WebGL pipelines, if `dirtyRegions` logic is used but the target canvas/FBO is empty (size known, instance count >0), force a full render once.  
2. **View hash includes tileset epoch:** Extend `lastViewHash` (WebGL) / dirty-tracker state to include a monotonically increasing `tilesetVersion` that increments on `uploadTilesets/clearTilesetCache/pipeline.invalidate`. This triggers one full render when tileset content changes, but still allows dirty renders for subsequent animation ticks.

These keep the optimization benefits while preventing “empty cache” frames.

---

## Recommended implementation order
1) WebGL pipeline guard in animation-only path (full render fallback when no cached dims).  
2) Remove `renderLayer1Only` reflection shortcut; use normal top split.  
3) Make surf-blob insertion immutable.  
4) Add `tilesetVersion` into view-change hash + first-frame dirty guard.

None of the above require reverting to always-full renders; they only force full paint on the rare events where caches are not yet valid. steady-state remains dirty-tracked and fast.
