# Map Transition Jitter Investigation

## Problem Description

When the character moves into a new map or chunk area, especially while running, there is visible jitter that feels like the character is being teleported back a few steps. This creates a jarring visual experience instead of smooth continuous movement.

**Introduced by**: Refactoring of MapRenderer.tsx and implementation of chunk-based caching

## Root Cause Analysis

After investigating the camera, rendering, chunk management, and warp systems, I've identified multiple contributing factors:

### 1. **Chunk Cache Invalidation on Map Transition**

**Location**: [MapRenderer.tsx:L1843-1854](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/components/MapRenderer.tsx#L1843-L1854)

```typescript
// Clear chunk cache when player enters a different map
if (resolved) {
  const currentMapId = resolved.map.entry.id;
  if (currentMapId !== lastPlayerMapIdRef.current) {
    lastPlayerMapIdRef.current = currentMapId;
    chunkManagerRef.current?.clear();
    // ...
  }
}
```

**Issue**: When the player crosses from one map to another (e.g., Route 103 → Oldale Town), the entire chunk cache is cleared. This happens **during the frame** when the player is moving, causing a complete re-render of all visible chunks. The cache miss causes a synchronous render of 15-25 chunks (at 256×256px each), which takes significant time (~16-50ms depending on complexity).

**Visual Impact**: The player sprite continues moving smoothly, but the background tiles momentarily lag behind during chunk regeneration, creating the illusion that the player "jumped" backwards when the background catches up.

### 2. **Camera Position Rounding Inconsistencies**

**Location**: [ChunkManager.ts:L227-229](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/rendering/ChunkManager.ts#L227-L229)

```typescript
// Round to integers to prevent sub-pixel rendering artifacts
const destX = Math.round(chunkWorldX - view.cameraWorldX);
const destY = Math.round(chunkWorldY - view.cameraWorldY);
```

**Issue**: Camera world coordinates (`cameraWorldX`, `cameraWorldY`) are computed based on player pixel position, which is updated incrementally during movement (e.g., `player.x += moveAmount * delta`). These can be fractional values.

When chunks are rendered, `Math.round()` is used to snap to integer pixel positions to prevent anti-aliasing artifacts between chunks. However, during chunk cache regeneration, the rounding happens at different moments in the animation cycle, causing slight positional shifts.

**Example Scenario**:
- Frame N: `cameraWorldX = 1234.6`, chunks render at positions based on `Math.round(chunkWorldX - 1234.6)`
- Frame N+1 (map transition): Cache clears, `cameraWorldX = 1235.8`, chunks regenerate at positions based on `Math.round(chunkWorldX - 1235.8)`
- Result: Background shifts by 1-2 pixels inconsistently

### 3. **Player Position Snapping During Map Re-anchoring**

**Location**: [MapRenderer.tsx:L1865-1884](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/components/MapRenderer.tsx#L1865-L1884)

```typescript
if (nearEdge) {
  reanchorInFlightRef.current = true;
  // ... async world rebuild ...
  const newWorld = shiftWorld(newWorldRaw, targetOffsetX, targetOffsetY);
  await rebuildContextForWorld(newWorld, targetId);
  playerControllerRef.current?.setPosition(playerWorldX, playerWorldY);
  // ...
}
```

**Issue**: When the player approaches the edge of the loaded world (within `marginTiles`), an asynchronous re-anchoring process begins. During this process:

1. `reanchorInFlightRef.current = true` pauses further re-anchoring
2. The world is rebuilt with new connections
3. `setPosition(playerWorldX, playerWorldY)` is called, which **snaps** pixel coordinates to exact tile boundaries

**Code in PlayerController.ts:L602-606**:
```typescript
public setPosition(tileX: number, tileY: number) {
  this.tileX = tileX;
  this.tileY = tileY;
  this.x = tileX * this.TILE_PIXELS;  // ← Snaps to exact pixels
  this.y = tileY * this.TILE_PIXELS - 16;
  // ...
}
```

**Visual Impact**: If the player was mid-movement (e.g., `pixelsMoved = 8` of 16 pixels), calling `setPosition()` snaps them back to the tile boundary. This is the most noticeable "teleport backwards" effect.

### 4. **Asynchronous Re-anchoring During Movement**

**Location**: [MapRenderer.tsx:L1872-1884](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/components/MapRenderer.tsx#L1872-L1884)

The re-anchoring process is asynchronous (`async () => { ... }`), which means:
- The player continues moving during `await mapManagerRef.current.buildWorld(targetId, CONNECTION_DEPTH)`
- The player continues moving during `await rebuildContextForWorld(newWorld, targetId)`
- When `setPosition()` is finally called, the player may have moved 1-2 tiles forward
- The snap-back is even more pronounced

### 5. **Chunk Prewarming Ineffectiveness During Map Transitions**

**Location**: [ChunkManager.ts:L148-156](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/rendering/ChunkManager.ts#L148-L156)

```typescript
// Prewarm a small ring of chunks around the viewport
if (prewarmPadding > 0) {
  for (let cy = startChunkY - prewarmPadding; cy <= endChunkY + prewarmPadding; cy++) {
    for (let cx = startChunkX - prewarmPadding; cx <= endChunkX + prewarmPadding; cx++) {
      // ...
      this.ensureChunkCached(cx, cy, layer, extraHash, renderCallback);
    }
  }
}
```

**Issue**: Prewarming only works when the `extraHash` (which includes animation frame and player elevation) matches. When:
- The player enters a new map → `lastPlayerMapIdRef` changes → cache clears → prewarm cache is gone
- The player changes elevation → `extraHash` changes → old prewarmed chunks are invalidated
- This makes the prewarming ineffective at map boundaries

### 6. **Camera Computation During Transition**

**Location**: [camera.ts:L33-37](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/utils/camera.ts#L33-L37)

```typescript
const idealCameraX = focusX - viewportWidthPx / 2;
const idealCameraY = focusY - viewportHeightPx / 2;

const cameraX = clamp(idealCameraX, 0, Math.max(0, mapWidthPx - viewportWidthPx));
const cameraY = clamp(idealCameraY, 0, Math.max(0, mapHeightPx - viewportHeightPx));
```

**Issue**: The camera is clamped to map boundaries, which change during re-anchoring:
- Before re-anchor: `mapWidthPx` and `mapHeightPx` are based on old world bounds
- After re-anchor: Bounds expand to include new connected maps
- The sudden change in clamp limits can cause camera to "jump" to follow new constraints

## Summary of Jitter Sources

| Issue | Severity | Timing | Visual Effect |
|-------|----------|--------|---------------|
| Chunk cache clear on map change | **High** | Every map transition | 1-3 frame pause + background lag |
| Camera rounding inconsistency | Medium | During chunk regeneration | 1-2px background shift |
| Player position snapping | **Critical** | Re-anchoring (near world edges) | Character teleports backward 0-32px |
| Async re-anchoring during movement | **High** | Re-anchoring (near world edges) | Exaggerates snap-back effect |
| Chunk prewarming ineffective | Medium | Map/elevation changes | Increases cache miss hitching |
| Camera bounds changing | Low | Re-anchoring | Slight camera jump |

## Proposed Solutions

### Solution 1: Preserve Player Sub-Tile Position During Re-anchoring (Critical)

**Target**: Fix the most noticeable teleport-back effect

**Implementation**:
1. Capture `pixelsMoved` and `isMoving` state before calling `setPosition()`
2. After `setPosition()`, restore interpolated position:
   ```typescript
   if (wasMoving) {
     const progress = savedPixelsMoved;
     if (dir === 'right') player.x += progress;
     else if (dir === 'left') player.x -= progress;
     // ... etc for other directions
     player.pixelsMoved = savedPixelsMoved;
     player.isMoving = true;
   }
   ```

**Location**: [MapRenderer.tsx:L1878](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/components/MapRenderer.tsx#L1878)

### Solution 2: Defer Chunk Cache Clearing Until Movement Completes

**Target**: Prevent background lag during active movement

**Implementation**:
1. Instead of immediately clearing cache on map ID change, set a flag: `chunkClearPending = true`
2. Check if player is moving (`player.isMoving`)
3. Only clear cache when `!player.isMoving` or after a short delay (e.g., 100ms)
4. Alternatively, use a gradual cache eviction strategy instead of `clear()`

**Location**: [MapRenderer.tsx:L1843-1854](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/components/MapRenderer.tsx#L1843-L1854)

### Solution 3: Defer Re-anchoring Until Movement Completes

**Target**: Prevent re-anchoring from interrupting smooth movement

**Implementation**:
1. When `nearEdge` is detected, check if `player.isMoving`
2. If moving, set a flag to re-anchor on the **next frame after movement stops**
3. Only start async re-anchoring when player is idle

**Location**: [MapRenderer.tsx:L1865-1884](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/components/MapRenderer.tsx#L1865-L1884)

### Solution 4: Improve Chunk Cache Key to Include Map ID

**Target**: Allow chunks from different maps to coexist in cache

**Implementation**:
1. Modify `getCacheKey()` to include map ID: `${chunkX}:${chunkY}:${layer}:${mapId}:${extraHash}`
2. Remove the cache clear on map change
3. Rely on LRU eviction to naturally remove old map chunks
4. Increase `MAX_CACHE_SIZE` to accommodate multiple maps (e.g., 180-200 chunks)

**Location**: [ChunkManager.ts:L82-84](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/rendering/ChunkManager.ts#L82-L84)

**Trade-off**: Higher memory usage (~30-40MB instead of ~20-25MB)

### Solution 5: Consistent Camera Rounding

**Target**: Eliminate 1-2px jitter during chunk rendering

**Implementation**:
1. Round `cameraWorldX` and `cameraWorldY` at the source (when computing camera view)
2. Store rounded values in `WorldCameraView`
3. Remove `Math.round()` in `ChunkManager.drawChunk()`

**Location**: [camera.ts:L47-58](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/utils/camera.ts#L47-L58) and [ChunkManager.ts:L227-229](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/rendering/ChunkManager.ts#L227-L229)

**Alternative**: Keep fractional camera coordinates but ensure consistent rounding across all rendering operations

### Solution 6: Progressive Cache Warming for Map Transitions

**Target**: Reduce chunk cache misses when entering new maps

**Implementation**:
1. Detect when player is within N tiles of a map boundary
2. Pre-fetch chunks from the adjacent map using the correct map-specific `extraHash`
3. Cache chunks before player actually crosses the boundary

**Complexity**: Medium-High (requires predicting which map the player will enter)

## Recommended Implementation Order

1. **Solution 1** (Critical) - Preserve sub-tile position during re-anchoring
2. **Solution 3** (High) - Defer re-anchoring until movement completes
3. **Solution 2** (High) - Defer chunk cache clearing until movement completes
4. **Solution 4** (Medium) - Include map ID in chunk cache key
5. **Solution 5** (Low) - Consistent camera rounding
6. **Solution 6** (Optional) - Progressive cache warming

## Testing Recommendations

### Manual Testing
1. **Map Boundary Crossing**: Walk from Route 103 → Oldale Town at normal and running speeds. Observe for jitter or snap-back.
2. **Chunk Boundary Crossing**: Enable chunk borders in debug panel. Walk across chunk boundaries. Look for background lag or player teleporting.
3. **Elevation Changes**: Walk onto/off bridges. Check for jitter during elevation transitions.
4. **Re-anchoring**: Walk continuously in one direction across multiple connected maps. Watch for teleporting when approaching world edges.

### Debug Panel Monitoring
- Enable "Show Chunk Borders" to visualize chunk loading
- Enable "Log Chunk Operations" to see cache misses in console
- Monitor "Cache Hits" vs "Cache Misses" ratio during map transitions
- Watch "Recent Misses" list for patterns

### Performance Metrics
- Measure frame time during map transitions (should stay \u003c 16.67ms for 60fps)
- Count chunk cache misses per map transition (target: \u003c 5 misses)
- Measure re-anchoring duration (should be imperceptible to user)

## References

- [MapRenderer.tsx](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/components/MapRenderer.tsx)
- [PlayerController.ts](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/game/PlayerController.ts)
- [ChunkManager.ts](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/rendering/ChunkManager.ts)
- [camera.ts](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/utils/camera.ts)
- [useWarpSystem.ts](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/components/map/hooks/useWarpSystem.ts)
