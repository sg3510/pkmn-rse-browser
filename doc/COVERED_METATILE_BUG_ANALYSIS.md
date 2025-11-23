# COVERED Metatile Rendering Bug Analysis

## Problem Summary

Metatiles 336, 337, 344, 345 (and similar) on Route115 and Route134 are not rendering correctly. These tiles have:
- **Bottom layer (tiles 0-3)**: Animated water
- **Top layer (tiles 4-7)**: Static rock overlay

The rock is **not appearing** even though it should render on top of the water.

---

## How Pokeemerald (GBA) Renders Metatiles

### Metatile Structure
Each metatile consists of **8 tiles** organized as:
```
Bottom Layer (tiles 0-3):    Top Layer (tiles 4-7):
    Tile 0 | Tile 1              Tile 4 | Tile 5
    -------+-------              -------+-------
    Tile 2 | Tile 3              Tile 6 | Tile 7
```

### Layer Types and BG Layer Mapping

Reference: `public/pokeemerald/src/field_camera.c` lines 245-310

| Layer Type | Value | BG3 (Back) | BG2 (Middle) | BG1 (Front) |
|------------|-------|------------|--------------|-------------|
| NORMAL     | 0     | Garbage    | tiles[0-3]   | tiles[4-7]  |
| COVERED    | 1     | tiles[0-3] | tiles[4-7]   | Transparent |
| SPLIT      | 2     | tiles[0-3] | Transparent  | tiles[4-7]  |

### For COVERED (layerType=1):
```c
case METATILE_LAYER_TYPE_COVERED:
    // BG3 (bottom): Bottom layer of metatile
    gOverworldTilemapBuffer_Bg3[offset] = tiles[0-3];

    // BG2 (middle): Top layer of metatile
    gOverworldTilemapBuffer_Bg2[offset] = tiles[4-7];

    // BG1 (top): Unused (transparent)
    gOverworldTilemapBuffer_Bg1[offset] = 0;
```

**Key insight**: Both layers are rendered to background layers (behind sprites). The GBA composites all BG layers simultaneously, with transparent pixels (palette index 0) allowing lower layers to show through.

---

## How Porymap Renders Metatiles

Reference: `porymap/src/ui/imageproviders.cpp` lines 56-142

Porymap simulates 3 BG layers and renders them in order:

```cpp
for (const auto &layer : layerOrder)  // layerOrder = [0, 1, 2]
for (int y = 0; y < 2; y++)
for (int x = 0; x < 2; x++) {
    // Get tile based on layerType
    switch (layerType) {
    case Metatile::LayerType::Covered:
        if (layer == 2)
            tile = Tile(projectConfig.unusedTileCovered);  // transparent
        else
            tile = metatile->tiles[tileOffset + (layer * 4)];  // tiles on layers 0,1
        break;
    }

    // Color 0 is transparent
    if (tileImage.colorCount()) {
        QColor color(tileImage.color(0));
        color.setAlpha(0);  // Make palette index 0 transparent
        tileImage.setColor(0, color.rgba());
    }

    painter.drawImage(x, y, tileImage);  // Composite with transparency
}
```

**Key insight**: Porymap draws layers in order (0, 1, 2) with transparent pixels (alpha=0) allowing previous layers to show through. The rock (layer 1) is drawn AFTER water (layer 0) and overwrites opaque pixels only.

---

## How React MapRenderer.tsx Renders Metatiles

### Current Implementation (with chunk caching)

Reference: `src/components/MapRenderer.tsx` lines 1476-1502, 1615-1633, 1826-1854

#### Step 1: Chunk Rendering
```typescript
const renderBackgroundChunk = (chunkCtx, region) => {
  drawRegionToContext(
    chunkCtx, ctx, 'background',
    false,  // skipAnimated = false (include animated tiles)
    false,  // onlyAnimated = false
    ...
  );
};
```

For COVERED metatiles:
```typescript
if (pass === 'background') {
  drawLayer(0);  // Draw tiles 0-3 (water)
  if (layerType === METATILE_LAYER_TYPE_COVERED) {
    drawLayer(1);  // Draw tiles 4-7 (rock) - CORRECT ORDER
  }
}
```

**Result**: Chunk has water + rock, with rock on top. Correct!

#### Step 2: Animated Tile Overlay
```typescript
// Draw animated tiles as overlay (after chunk)
drawRegionToContext(
  mainCtx, ctx, 'background',
  false,  // skipAnimated = false
  true,   // onlyAnimated = true - ONLY draw animated tiles
  ...
);
```

With `onlyAnimated=true`:
```typescript
if (onlyAnimated) {
  const isAnimatedTile = animatedTileIds.primary.has(tile.tileId);
  if (!isAnimatedTile) continue;  // Skip rock (not animated)
}
```

**Result**: Overlay draws ONLY animated water tiles. Rock is skipped.

---

## The Bug

### Root Cause

The tile positions within a metatile **overlap between layers**:

| Position | Layer 0 (Water) | Layer 1 (Rock) |
|----------|-----------------|----------------|
| (0,0)    | Tile 0          | Tile 4         |
| (8,0)    | Tile 1          | Tile 5         |
| (0,8)    | Tile 2          | **Tile 6 (ROCK)** |
| (8,8)    | Tile 3          | Tile 7         |

For metatile 337:
- Tile 2 (water) at position (0,8)
- Tile 6 (rock) at position (0,8) - **SAME POSITION**

### Rendering Sequence Bug

1. **Chunk renders**: Water at (0,8) THEN rock at (0,8) = **Rock visible** (correct)
2. **Overlay renders**: Animated water at (0,8) = **Rock OVERWRITTEN** (BUG!)

The animated water overlay draws water at the same screen position as the rock, completely overwriting it because:
- Water tiles have OPAQUE pixels (not all transparent)
- The overlay draws AFTER the chunk
- No layer-awareness in overlay rendering

---

## Visual Diagram

```
CORRECT (what should happen):
+--------+    +--------+    +--------+
| Water  | -> | Rock   | =  | Rock   |
| (anim) |    | (top)  |    | on     |
|        |    |        |    | Water  |
+--------+    +--------+    +--------+
  Layer 0      Layer 1       Final

BUG (what happens with chunk caching):
+--------+    +--------+    +--------+    +--------+
| Water  | -> | Rock   | =  | Rock   | -> | Water  |
| (frame0)|   | (top)  |    | on     |    | (frameN)|
|        |    |        |    | Water  |    | OVERWRITES
+--------+    +--------+    +--------+    +--------+
  Chunk        Chunk         Chunk         Overlay
  Layer 0      Layer 1       Cached        (no rock!)
```

---

## Theories

### Theory 1: Overlay Overwrites Static Top-Layer Content (HIGH CONFIDENCE)

The animated tile overlay mechanism doesn't account for static top-layer content. When drawing animated water, it overwrites the rock that was correctly rendered in the cached chunk.

**Evidence**:
- Bug only occurs with chunk caching (`USE_CHUNK_CACHE = true`)
- Metatiles 336, 337, 344, 345 all have animated bottom + static top
- The debug overlay shows correct layer data, but wrong visual output

### Theory 2: Palette Selection Error (LOW CONFIDENCE)

The palette selection code uses `tileSource` to select palette array:
```typescript
const palette = tileSource === 'primary'
  ? resolved.tileset.primaryPalettes[tile.palette]
  : resolved.tileset.secondaryPalettes[tile.palette];
```

This could cause issues if:
- Tile source doesn't match expected palette source
- Palette arrays are misaligned

**Evidence against**: Palette 1 is a primary palette, and tile 142 is primary. Should work.

### Theory 3: Chunk Cache Key Collision (LOW CONFIDENCE)

The chunk cache uses `animHash = 'static'` when chunk caching is enabled:
```typescript
const animHash = usingChunkCache ? 'static' : getAnimationStateHash(ctx);
```

If animation state affects what's in the chunk, stale cached chunks could show wrong content.

**Evidence against**: Chunks should contain all tiles regardless of animation frame.

---

## Proposed Fixes

### Fix Option A: Layer-Aware Animated Overlay (RECOMMENDED)

**Files to modify**: `src/components/MapRenderer.tsx`

When rendering animated tiles in overlay mode (`onlyAnimated=true`), skip animated tiles at positions where there's non-transparent static content in the top layer.

```typescript
// In drawLayer() when onlyAnimated=true:
if (onlyAnimated && pass === 'background') {
  // For COVERED metatiles, check if top layer has content at this position
  if (layerType === METATILE_LAYER_TYPE_COVERED && layer === 0) {
    const topTile = metatile.tiles[i + 4];  // Corresponding top-layer tile
    if (!isTileFullyTransparent(topTile)) {
      continue;  // Skip - top layer content would be overwritten
    }
  }
}
```

**Pros**: Minimal change, preserves chunk caching benefits
**Cons**: Requires transparency check per tile

### Fix Option B: Separate Bottom/Top Overlay Canvases

**Files to modify**: `src/components/MapRenderer.tsx`

Render animated tiles to separate canvases for bottom and top layers, then composite in correct order:

1. Chunk (static)
2. Bottom-layer animated overlay
3. Top-layer static content (re-rendered)

**Pros**: Correct compositing order
**Cons**: More complex, additional canvas overhead

### Fix Option C: Skip Chunk Caching for COVERED Metatiles

**Files to modify**: `src/components/MapRenderer.tsx`, `src/rendering/ChunkManager.ts`

Don't cache chunks that contain COVERED metatiles with animated bottom layers.

```typescript
// In chunk render decision:
const hasAnimatedCoveredTile = checkForAnimatedCoveredTiles(region);
if (hasAnimatedCoveredTile) {
  // Re-render this region every frame instead of caching
}
```

**Pros**: Simple logic
**Cons**: Performance impact for areas with these tiles

### Fix Option D: Disable Animated Overlay for COVERED Tiles

**Files to modify**: `src/components/MapRenderer.tsx`

For COVERED metatiles, always re-render both layers (don't use overlay approach):

```typescript
if (onlyAnimated) {
  // For COVERED tiles, skip the overlay entirely - they'll be in the chunk
  if (layerType === METATILE_LAYER_TYPE_COVERED) {
    continue;
  }
}
```

**Pros**: Simple
**Cons**: Animated water won't animate on COVERED tiles (wrong)

---

## Recommended Implementation

**Fix Option A** is recommended because:
1. Preserves chunk caching performance
2. Minimal code changes
3. Correct visual output

Implementation steps:
1. Add a transparency check utility function
2. In `drawRegionToContext`, when `onlyAnimated=true` and `layer=0` for COVERED tiles, check if corresponding top-layer tile has opaque content
3. If top layer has content at same position, skip drawing the animated bottom-layer tile (it's already in the chunk and won't be overwritten)

Alternative simpler fix: Just re-render the top layer after the animated overlay for COVERED metatiles:

```typescript
// After animated overlay:
if (usingChunkCache) {
  // Re-render COVERED top layers to restore overwritten content
  drawRegionToContext(
    mainCtx, ctx, 'background',
    false, false,
    ...,
    undefined,
    true  // New flag: onlyCoveredTopLayers
  );
}
```
