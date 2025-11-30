# Reflection Bugs (WebGL first) — Codex Notes (2025-11-30)

Two reflection regressions observed while comparing WebGL / Canvas2D against the GBA C logic (`public/pokeemerald/src/event_object_movement.c` + `field_effect_helpers.c`):

---

## 1) Reflection pops in only after fully stepping onto water when moving **left/right**

**Symptom**  
- Walking horizontally toward a reflective tile: the reflection is invisible until the step finishes (tileX updates), then it suddenly appears.  
- Vertical approach already works (reflection shows while standing one tile above the water).

**Root cause (code drift vs C)**  
- C ground truth (`ObjectEventGetNearbyReflectionType`, lines ~7625-7652) scans **both currentCoords and previousCoords** for reflection tiles, across the sprite footprint (widthTiles × heightTiles) and `y+1` rows.  
- Our detection helpers only use the **current** tile:
  - Canvas2D: `computeObjectReflectionState` in `src/components/map/utils.ts` (uses `tileX/tileY` only).
  - WebGL: `computeReflectionStateFromSnapshot` in `src/pages/WebGLMapPage.tsx` (same limitation).
- Bridge palette/offset also depends on previous behavior in C (`LoadObjectReflectionPalette` checks previous first), but we only read the standing tile.

**Fix plan**  
1) Expose previous tile info from `PlayerController` (we already track `prevTileX/prevTileY/prevTileBehavior` privately). Add getters or return it from `getSpriteSize()`/new helper.  
2) Update both reflection-state helpers to mirror the C loop:
   - For each `i < heightTiles`: check `(current.x, current.y+1+i)` **and** `(prev.x, prev.y+1+i)`.
   - For width, also check `±j` around both current and previous (same as C macro `RETURN_REFLECTION_TYPE_AT`).  
3) Bridge type: try previous behavior first, then current (`MetatileBehavior_GetBridgeType(prev) || ...current`).  
4) Wire callers:
   - Canvas: `computeReflectionState` (and places that cache it in `useRunUpdate`) should pass previous coords.
   - WebGL: `computeReflectionStateFromSnapshot` call in `render loop` needs the previous tile from `PlayerController`.  
5) Quick regression checks (match C intent):
   - Step sideways from land → water: reflection shows during the step.
   - Step off water sideways: reflection lingers for the frame where previous tile is water.

---

## 2) WebGL reflection clipped to ~16px on metatile 177 (water edge), missing the second water row

**Symptom**  
- On WebGL only: standing above water edge (metatile 177) with another water tile immediately below, the reflection stops after ~16px (one tile). The player sprite is ~23–32px tall, so the lower part should continue into the next water tile.  
- Canvas2D renders the full-height reflection as expected.

**Root cause (data lookup gap)**  
- Canvas mask building uses `getMetatileBehavior` → `resolveTileAt`, which falls back to **border/connected tiles** (mirrors `MapGridGetMetatileBehaviorAt` in C).  
- WebGL mask building uses `getReflectionMetaFromSnapshot` (WebGL page, ~lines 240–360) which **returns null** when a tile is outside the loaded map list and has **no border fallback**.  
- When the reflection bounding box crosses into the next row (e.g., 177 then 161/194 just below, often across a connection boundary), the lower tile is skipped, so the mask only contains the first 16px strip. C draws the full sprite; it relies on priority, not per-pixel clipping, so this skip never happens there.

**Fix plan**  
1) Add the same border/anchor fallback used by `resolveTileAt` into `getReflectionMetaFromSnapshot`:
   - If no map contains `(tileX, tileY)`, build a border metatile using `snapshot.anchorBorderMetatiles` and return its behavior + reflection meta (with correct primary/secondary choice).  
2) Optionally share one resolver between Canvas and WebGL to avoid future drift (small util that takes `RenderContext | WorldSnapshot`).  
3) Keep the current pixel-mask compositing, but once the lower tile is returned, the mask will cover both rows and the reflection height will match Canvas/GBA.  
4) Re-test on the reported spot: player tile, then metatile 177 at `y+1`, and another water tile at `y+2` — WebGL should now show the full-height reflection.

---

## Next steps / sanity tests
- Horizontal approach to water (both renderers) → reflection appears during step-in and step-out.
- Edge case near map borders/connection seams (the 177/161 stack) → WebGL reflection height matches Canvas.
- Bridges: verify palette/offset picked from **previous or current** behavior (Route 120 bridges).

These changes should make both renderers obey the original C intent: detection considers previous and current tiles; reflection height is not prematurely clipped when the reflective surface spans multiple rows.***
