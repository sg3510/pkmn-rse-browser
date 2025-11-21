# Palette Rendering Bug - DEFINITIVE ROOT CAUSE

## The Problem

Tiles across multiple maps are rendering with incorrect colors:
- **Slateport City**: Tiles with palette 0 are all black
- **Rustboro City**: Tiles with palette 3 have purple edges
- **Sootopolis City**: Tiles with palette 3 are all black

## Root Cause Identified

The current React code (MapRenderer.tsx lines 1775-1779) does this:

```typescript
const palette =
  tileSource === 'secondary'
    ? resolved.tileset.secondaryPalettes[tile.palette]
    : resolved.tileset.primaryPalettes[tile.palette];
```

**This is WRONG** because:
1. `tile.palette` is a **global palette index** (0-12)
2. When `tileSource === 'secondary'` and `tile.palette === 0`, this tries to access `secondaryPalettes[0]`
3. But palette index 0 belongs to the PRIMARY tileset, not secondary!

## How Porymap Does It (CORRECT)

From `porymap/src/core/tileset.cpp` lines 287-304:

```cpp
QList<QRgb> Tileset::getPalette(int paletteId, const Tileset *primaryTileset, const Tileset *secondaryTileset) {
    // Choose which tileset based on palette ID
    const Tileset *tileset = paletteId < Project::getNumPalettesPrimary()  // if paletteId < 6
            ? primaryTileset    // Use primary
            : secondaryTileset; // Else use secondary
    
    auto palettes = tileset->palettes;
    
    // Access using paletteId directly - BOTH tilesets have 16 palette slots!
    for (int i = 0; i < palettes.at(paletteId).length(); i++) {
        paletteTable.append(palettes.at(paletteId).at(i));
    }
    return paletteTable;
}
```

**Key insight**: Both primary and secondary tilesets load ALL 16 palette files (`00.pal` through `15.pal`).  
**The palette index directly indexes into the tileset's palette array!**

## How Your Old Working Code Did It

From the old code you provided:

```typescript
// Load all 16 palettes for BOTH tilesets
const primaryPalettes: Palette[] = [];
for (let i = 0; i < 16; i++) {
  const text = await loadText(`${PROJECT_ROOT}/${primaryTilesetPath}/palettes/${i.toString().padStart(2, '0')}.pal`);
  primaryPalettes.push(parsePalette(text));
}

const secondaryPalettes: Palette[] = [];
for (let i = 0; i < 16; i++) {
  const text = await loadText(`${PROJECT_ROOT}/${secondaryTilesetPath}/palettes/${i.toString().padStart(2, '0')}.pal`);
  secondaryPalettes.push(parsePalette(text));
}

// Combine into single global array (32 palettes total - THIS WAS THE KEY!)
const palettes = [...primaryPalettes, ...secondaryPalettes];
```

Then in rendering:

```typescript
const paletteId = tile.palette;  // Global index 0-15
const palette = palettes[paletteId];  // Works! palettes[0] = primaryPalettes[0]
```

**Why this worked:**
- `palettes[0-15]` = Primary tileset palettes
- `palettes[16-31]` = Secondary tileset palettes  
- When a secondary tile uses `palette = 0`, it correctly accesses`palettes[0]` = `primaryPalettes[0]`

## What the Fix Changed (Incorrectly)

The "fix" I suggested changed it to choose tileset based on `tileSource` instead of `palette index`:

```typescript
// WRONG APPROACH:
const palette = tileSource === 'secondary'
  ? resolved.tileset.secondaryPalettes[tile.palette]  // ❌ Wrong!
  : resolved.tileset.primaryPalettes[tile.palette];
```

This breaks because:
- Secondary tiles can reference primary palettes (0-5)
- Primary tiles can reference secondary palettes (6-12) 

The `tileSource` tells us WHERE THE TILE GRAPHICS come from, NOT which palette array to use!

## The Correct Fix

**Option 1: Use the Porymap approach** (check palette index, not tile source):

```typescript
const palette = tile.palette < 6  // NUM_PALS_IN_PRIMARY
  ? resolved.tileset.primaryPalettes[tile.palette]
  : resolved.tileset.secondaryPalettes[tile.palette];
```

**Option 2: Use your old working approach** (global palette array):

In tileset loading:
```typescript
const globalPalettes = [
  ...primaryPalettes,    // indices 0-15
  ...secondaryPalettes   // indices 16-31 (but only 16-22 are meaningful)
];
```

Then in rendering:
```typescript
const palette = globalPalettes[tile.palette];  // Simple and works!
```

## Why Both Primary and Secondary Have 16 Palette Files

Looking at the actual palette loading in pokeemerald and Porymap, **both tilesets load all 16 palette files**, but:
- Primary tileset: Only palettes 0-5 are loaded into hardware
- Secondary tileset: Only palettes 6-12 are loaded into hardware

The palette files `00.pal` through `05.pal` in a secondary tileset exist but are NOT loaded into VRAM by the game. However, they ARE loaded by Porymap for editing purposes!

## Recommended Solution

**Use Option 1** (Porymap approach) for correctness:

```typescript
const palette = tile.palette < 6
  ? resolved.tileset.primaryPalettes[tile.palette]
  : resolved.tileset.secondaryPalettes[tile.palette];
```

This directly mirrors how Pory map does it and is the most explicit about the actual hardware behavior.
