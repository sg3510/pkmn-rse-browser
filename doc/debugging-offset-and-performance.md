# Debugging Offset & Performance

## Status Update
1.  **Offset Fixed**: The "8x8 offset" was caused by applying the camera's sub-pixel shift *twice* (once in ChunkManager, once in compositeScene). I've corrected this logic.
2.  **Performance**: The "broken/slow" feeling during movement was likely caused by the excessive logging I added to debug the offset. I've moved all verbose logs behind a flag.

## How to Test

### 1. Verify Visual Alignment (Offset)
Enable the visual debugger:
```javascript
window.DEBUG_OVERLAY = true
```
- **Green Box**: Logical tile position.
- **Blue Box**: Rendered sprite position.
- **Red Grid**: Chunk boundaries.
- **Check**: Ensure Green and Blue boxes align perfectly, and the map tiles underneath match the grid.

### 2. Verify Performance
Ensure logs are **OFF** (default):
```javascript
window.DEBUG_LOGS = false
```
- Move around. It should be smooth (60fps).
- If it still feels slow, enable logs to check for "Cache Thrashing":
  ```javascript
  window.DEBUG_LOGS = true
  ```
  - Look for `[CHUNK MISS]` messages in the console.
  - If you see `[CHUNK MISS]` **continuously while moving** (not just initially), then the cache is failing.

### 3. Feature Flags
You can toggle features to isolate issues:
- `window.FORCE_SOFTWARE = true` (Disable new Hardware Renderer entirely)
- `window.FORCE_NO_CACHE = true` (Disable Chunk Cache, use per-frame Hardware Rendering)

