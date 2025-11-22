# Debugging Offset & Animation Issues - Update

## Fix Applied: Double Offset Bug
I identified the cause of the "8x8 offset". 
- **The Issue:** When `ChunkManager` is active, it draws chunks at precise screen coordinates. However, the `compositeScene` function was applying a `subTileOffsetX` shift (meant for the legacy renderer) to these already-aligned chunks, causing them to be shifted by ~8px (depending on camera position).
- **The Fix:** I introduced `drawOffsetX` which is `0` when using ChunkManager, and `-subTileOffsetX` when using legacy/fallback rendering.

## Debug Overlay
I added a visual debug overlay to verify alignment.
Enable it by typing in the browser console:
```javascript
window.DEBUG_OVERLAY = true
```
**What you will see:**
- **Red Grid**: Shows the 256x256 Chunk boundaries.
- **Green Box**: Shows the logical tile grid where the player *should* be.
- **Blue Box**: Shows the actual rendered player sprite position.
- **Yellow Dot**: The top-left corner of the player sprite.

If the Green and Blue boxes align, and the Map tiles align with them, the offset is fixed.

## Animation Status
1.  **Flowers**: `src/data/tilesetAnimations.ts` confirms the sequence `[0, 1, 0, 2]`. This visually looks like "Frame 0, Frame 1, Frame 0, Frame 2", which might be perceived as "2 frames" (0 and 1, then 0 and 2). This is accurate to the configuration.
2.  **Arrows**: `ObjectRenderer.ts` confirms the correct 2-frame sequences (e.g., `[0, 4]` for Up). The "rotating between 0, 1, 2" issue should be resolved by the logic fix I verified.

## Logs
Detailed logs are still available via `window.DEBUG_MODE = true`.
