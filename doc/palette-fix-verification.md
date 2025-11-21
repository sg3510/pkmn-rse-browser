# Palette Fix Verification

## Porymap Implementation (C++)

From `/porymap/porymap/src/core/tileset.cpp` lines 287-304:

```cpp
QList<QRgb> Tileset::getPalette(int paletteId, const Tileset *primaryTileset, const Tileset *secondaryTileset, bool useTruePalettes) {
    QList<QRgb> paletteTable;
    
    // Choose tileset based on palette index
    const Tileset *tileset = paletteId < Project::getNumPalettesPrimary()  // getNumPalettesPrimary() returns 6
            ? primaryTileset      // If palette 0-5, use primary
            : secondaryTileset;   // If palette 6+, use secondary
    
    if (!tileset) {
        return paletteTable;
    }
    
    auto palettes = useTruePalettes ? tileset->palettes : tileset->palettePreviews;
    
    // Access using paletteId directly
    for (int i = 0; i < palettes.at(paletteId).length(); i++) {
        paletteTable.append(palettes.at(paletteId).at(i));
    }
    return paletteTable;
}
```

## React Implementation (TypeScript)

From `/src/components/MapRenderer.tsx` lines 1773-1781:

```typescript
const subX = (i % 2) * TILE_SIZE;
const subY = Math.floor(i / 2) * TILE_SIZE;

// Porymap approach: choose tileset based on palette index, not tile source
// Secondary tiles can use primary palettes (0-5) and vice versa
const NUM_PALS_IN_PRIMARY = 6;
const palette = tile.palette < NUM_PALS_IN_PRIMARY
  ? resolved.tileset.primaryPalettes[tile.palette]  // If palette 0-5, use primary
  : resolved.tileset.secondaryPalettes[tile.palette]; // If palette 6+, use secondary

if (!palette) continue;
```

## Logic Comparison

| Aspect | Porymap | React Implementation | Match? |
|--------|---------|---------------------|--------|
| **Condition** | `paletteId < Project::getNumPalettesPrimary()` | `tile.palette < NUM_PALS_IN_PRIMARY` | ✅ YES (both use 6) |
| **True branch** | Use `primaryTileset` | Use `primaryPalettes[tile.palette]` | ✅ YES |
| **False branch** | Use `secondaryTileset` | Use `secondaryPalettes[tile.palette]` | ✅ YES |
| **Index used** | `palettes.at(paletteId)` | Direct array access `[tile.palette]` | ✅ YES |

## Key Insight

Both implementations:
1. **Select tileset based on palette index** (not based on where the tile graphics come from)
2. **Use palette index directly** to access that tileset's palette array
3. **Allow cross-referencing**: Secondary tiles can use primary palettes (0-5) and primary tiles can use secondary palettes (6-12)

## Expected Behavior After Fix

- **Slateport tiles with palette 0**: Will now correctly use `primaryPalettes[0]` instead of `secondaryPalettes[0]`
- **Rustboro tiles with palette 3**: Will now correctly use `primaryPalettes[3]` instead of `secondaryPalettes[3]`
- **Sootopolis tiles with palette 3**: Will now correctly use `primaryPalettes[3]` instead of `secondaryPalettes[3]`

All these tiles are secondary tiles (tile ID >= 512) but use primary palette indices (< 6), which is why they were broken before.

## Verification Status

✅ **CONFIRMED**: The React implementation now matches Porymap's logic exactly.
