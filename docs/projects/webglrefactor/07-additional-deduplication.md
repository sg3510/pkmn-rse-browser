---
title: Additional Deduplication Checklist
status: reference
last_verified: 2026-01-13
---

# Additional Deduplication Checklist

This document tracks additional refactoring opportunities identified after Phase 10.

**Current State:** WebGLMapPage.tsx at 1314 lines (down from 2154)

---

## 1. Extract World Initialization Sequence ✅ DONE

**Problem:** Both `performWarp` and the load `useEffect` had nearly identical 6-step sequences.

**Solution:** Created `initializeWorldFromSnapshot` useCallback in WebGLMapPage (not snapshotUtils, since it needs refs and pipeline)

### Checklist

- [x] Create `initializeWorldFromSnapshot` useCallback in WebGLMapPage
- [x] Function handles:
  - Setting worldSnapshotRef
  - Building tileset runtimes
  - Creating stitched world
  - Setting up tile resolver
  - Uploading tilesets
  - Updating world bounds
- [x] Update `performWarp` to use new helper
- [x] Update load `useEffect` to use new helper
- [x] Update dependency arrays
- [x] **TEST**: Build passes

**Result:** Net -2 lines (added 23-line helper, removed ~25 lines of duplication)
**Benefit:** Single point of truth, cleaner code, easier maintenance

---

## 2. Move `buildTilesetRuntimesFromSnapshot` to snapshotUtils ✅ DONE (~27 lines saved)

**Problem:** `buildTilesetRuntimesFromSnapshot` was defined inline in WebGLMapPage as a `useCallback`.

**Solution:** Created `buildTilesetRuntimesForSnapshot` in `snapshotUtils.ts`

### Checklist

- [x] Add `buildTilesetRuntimesForSnapshot` to `snapshotUtils.ts`
- [x] Function takes snapshot and runtimesMap, updates map in place
- [x] Update WebGLMapPage to import and use
- [x] Simplify inline `useCallback` to single line wrapper
- [x] Remove unused `buildTilesetRuntime` and `TilesetResources` imports
- [x] **TEST**: Build passes

**Actual reduction:** 27 lines (1314 → 1287)

---

## 3. Extract Resolver Setup Helper (~8 lines, 2 places)

**Problem:** Setting up both tile resolver and player resolver is repeated:

```typescript
// In performWarp
const resolver = createSnapshotTileResolver(snapshot);
pipeline.setTileResolver(resolver);
const playerResolver = createSnapshotPlayerTileResolver(snapshot);
player.setTileResolver(playerResolver);

// In load useEffect (split across lines)
const resolver = createSnapshotTileResolver(snapshot);
pipeline.setTileResolver(resolver);
// ... later ...
const playerResolver = createSnapshotPlayerTileResolver(snapshot);
player.setTileResolver(playerResolver);
```

**Solution:** Could be part of `initializeWorldFromSnapshot` or separate helper

### Checklist

- [ ] Include resolver setup in `initializeWorldFromSnapshot` (preferred)
- [ ] OR create separate `setupResolversFromSnapshot` helper
- [ ] **TEST**: Build passes
- [ ] **TEST**: Tile collision works
- [ ] **TEST**: Player movement works

**Estimated reduction:** ~4-8 lines (if standalone helper)

---

## 4. Consolidate Debug Logging (Optional, Low Priority)

**Problem:** performWarp has 4 debug log statements that could be a helper:

```typescript
console.log('[WARP] Warp complete');
console.log('[WARP] World bounds:', snapshot.worldBounds);
console.log('[WARP] Loaded maps:', snapshot.maps.map(m => m.entry.id));
console.log('[WARP] Tileset pairs:', snapshot.tilesetPairs.map(p => p.id));
console.log('[WARP] GPU slots:', Object.fromEntries(snapshot.pairIdToGpuSlot));
```

**Solution:** Create `logWarpDebugInfo(snapshot)` helper (optional)

### Checklist

- [ ] Create `logWarpDebugInfo` in worldManagerEvents.ts or debug utils
- [ ] Update performWarp to use helper
- [ ] **TEST**: Debug logs still appear

**Estimated reduction:** ~4 lines

---

## Summary

| Item | Lines Saved | Priority | Status |
|------|-------------|----------|--------|
| 1. World init sequence | -2 (net) | High | ✅ Done |
| 2. buildTilesetRuntimes | **27** | Medium | ✅ Done |
| 3. Resolver setup | ~4-8 | Low | ⬜ Pending |
| 4. Debug logging | ~4 | Low | ⬜ Skip |
| **Total** | **~29** | | |

**Current state:**
- WebGLMapPage.tsx: **1285 lines** (from 1287, -2 from item 1)
- Started at: 2154 lines
- **Total reduction: 869 lines (40%)**

**Key wins:**
- `initializeWorldFromSnapshot` - single point of truth for world initialization
- `buildTilesetRuntimesForSnapshot` - extracted to snapshotUtils.ts
- Better separation of concerns, easier to understand and maintain
