# Pokemon RSE Browser Implementation Notes

## Overview
This project renders Pokemon Emerald maps in the browser using the decompiled pokeemerald data.

## Architecture

### Map Structure
- **Metatiles**: 16x16 pixel tiles composed of 8 sub-tiles (8x8 pixels each)
  - 2 layers: Bottom (tiles 0-3) and Top (tiles 4-7)
  - Each layer is 2x2 tiles arranged as: TL, TR, BL, BR
- **Tiles**: 8x8 pixel indexed color images (4bpp = 16 colors)
- **Palettes**: JASC-PAL format, 16 colors per palette
  - Primary tileset: Palettes 0-5
  - Secondary tileset: Palettes 6-12

### File Format Details
1. **Map Layout** (`data/layouts/{MapName}/map.bin`):
   - Array of uint16 values (little-endian)
   - Each value: `metatileId (bits 0-9) | collision (bit 10-11) | elevation (bits 12-15)`
   - Metatile IDs: 0-511 = Primary tileset, 512+ = Secondary tileset

2. **Metatile Definitions** (`data/tilesets/{primary|secondary}/{name}/metatiles.bin`):
   - 16 bytes per metatile (8 tiles × 2 bytes)
   - Each tile: `tileId (bits 0-9) | xflip (bit 10) | yflip (bit 11) | palette (bits 12-15)`

3. **Tileset Images** (`tiles.png`):
   - 128px wide, variable height
   - 4-bit indexed PNG (2 pixels per byte, needs unpacking)
   - 16 tiles per row

4. **Palettes** (`palettes/{NN}.pal`):
   - JASC-PAL format
   - Line 1: "JASC-PAL"
   - Line 2: "0100"
   - Line 3: "16"
   - Lines 4+: RGB triplets (0-255 space-separated)

### Animation System

#### Flower Animation (Littleroot Town)
- **Location**: Tiles 508-511 in primary tileset (row 31, columns 12-15)
- **Frames**: `data/tilesets/primary/general/anim/flower/{0,1,2}.png` (16x16 each)
- **Sequence**: `[0, 1, 0, 2]` (4 frames)
- **Timing**: Updates every 16 game frames (~266ms at 60 FPS)
- **Implementation**:
  1. Load 3 unique frames as 16x16 images
  2. Construct sequence array
  3. On each animation update, patch tiles 508-511 in primary tileset
  4. Copy 4 tiles (TL, TR, BL, BR) from flower frame to tileset buffer
  5. Re-render map with patched tileset

#### Scalability
- Animation metadata can be loaded from `src/tileset_anims.c` patterns:
  - `QueueAnimTiles_{Tileset}_{AnimName}` functions
  - VRAM destinations via `TILE_OFFSET_4BPP(tileId)`
  - Frame sequences from `gTilesetAnims_{Tileset}_{AnimName}[]` arrays
- Each tileset can have multiple animations
- Animations update at different intervals (check `timer % N == M` patterns)

## Technical Decisions

### PNG Decoding
- Using `upng-js` library (not `fast-png`)
- Handles 4bpp indexed PNGs correctly
- Unpacking 4bpp: `[(byte >> 4) & 0xF, byte & 0xF]`

### Rendering
- Canvas 2D API for pixel-perfect rendering
- Full redraw per animation frame (simple, fast enough for 20x20 maps)
- Optimizations possible: cache static background, only redraw animated tiles

### Type Safety
- Type declarations for `upng-js` in `vite-env.d.ts`
- Union types for `Uint8Array<ArrayBuffer> | Uint8Array<ArrayBufferLike>`

## Known Issues
- `npm run build` fails due to large `public/pokeemerald` directory (permission issues in sandbox)
- Solution: Use `npm run dev` for development (works perfectly)

## Future Enhancements
1. Load animation metadata from C source
2. Support all animation types (water, waterfall, etc.)
3. Add map selection UI
4. Display object events (NPCs, warps, items)
5. Map connections/scrolling
6. Optimize rendering (dirty rectangles, WebGL)

