---
title: Seamless Tileset & Palette Management for WebGL Overworld
status: reference
last_verified: 2026-01-13
---

# Seamless Tileset & Palette Management for WebGL Overworld

## Overview

This document explores options for seamless (no-fade) tileset and palette management when roaming the connected overworld, comparing GBA hardware constraints with WebGL capabilities.

## GBA Hardware Approach (pokeemerald)

### The GBA Constraint

The GBA has limited VRAM that can only hold **one tileset pair** at a time:
- **Primary tileset**: 512 tiles (indices 0-511), palettes 0-5
- **Secondary tileset**: 512 tiles (indices 512-1023), palettes 6-12
- Total: 1024 tiles, 13 palettes

### How GBA Achieves "Seamless" Connections

**Key insight**: The GBA doesn't actually render multiple tilesets simultaneously. Instead:

1. **Connected maps share primary tilesets** - By design, all outdoor areas in a region use the same primary tileset (e.g., `gTileset_General`)

2. **Secondary tileset can differ** - When crossing to a map with a different secondary tileset, only the secondary is reloaded:

```c
// From overworld.c - LoadMapFromCameraTransition()
CopySecondaryTilesetToVramUsingHeap(gMapHeader.mapLayout);
LoadSecondaryTilesetPalette(gMapHeader.mapLayout);
```

3. **Pre-buffered connections** - Neighboring map tiles are copied to `gBackupMapLayout` so scrolling is smooth:

```c
// From fieldmap.c - Connection data is pre-filled
static void FillConnection(int x, int y, struct MapHeader const *connectedMapHeader, ...)
{
    // Copy neighbor's metatile data into backup buffer
    CpuCopy16(src, dest, width * 2);
}
```

4. **Same-tileset = truly seamless** - If both primary AND secondary match, no VRAM reload needed

5. **Different secondary = brief load** - Happens during VBlank, may cause 1-2 frame stutter but no visible fade

### GBA VRAM Layout

```
Character Base (Tile Graphics):
┌─────────────────────────────────────────┐
│ Primary Tileset (512 tiles @ 32 bytes)  │ 16KB
├─────────────────────────────────────────┤
│ Secondary Tileset (512 tiles @ 32 bytes)│ 16KB
└─────────────────────────────────────────┘

Palette RAM:
┌─────────────────────────────────────────┐
│ Pal 0-5: Primary (96 colors)            │
├─────────────────────────────────────────┤
│ Pal 6-12: Secondary (112 colors)        │
└─────────────────────────────────────────┘
```

## WebGL Advantages Over GBA

WebGL2 has capabilities the GBA lacks:

| Feature | GBA | WebGL2 |
|---------|-----|--------|
| Texture units | 1 per layer | 16+ simultaneously |
| Texture size | 256x256 max | 4096x4096+ |
| Palette storage | 256 colors total | Unlimited (texture) |
| Per-tile data | 16 bits | 32+ bits (custom attributes) |
| Conditional sampling | Not possible | Shader branching |

## WebGL Options for Seamless Tileset Switching

### Option 1: Multi-Texture Units (Recommended)

Load multiple tileset pairs into separate texture units. Shader selects which to sample based on per-tile attribute.

**Architecture:**
```
Texture Unit 0: Primary Tileset A (indexed)
Texture Unit 1: Secondary Tileset A (indexed)
Texture Unit 2: Palette Texture A (16 palettes × 16 colors)
Texture Unit 3: Primary Tileset B (indexed)
Texture Unit 4: Secondary Tileset B (indexed)
Texture Unit 5: Palette Texture B (16 palettes × 16 colors)
```

**Vertex Data (per tile instance):**
```typescript
interface TileInstance {
  x: number;           // World position
  y: number;
  tileId: number;      // Which tile (0-1023)
  paletteId: number;   // Which palette (0-12)
  tilesetPair: number; // 0 = A, 1 = B (NEW)
  flipX: boolean;
  flipY: boolean;
}
```

**Fragment Shader:**
```glsl
#version 300 es
precision highp float;

uniform sampler2D u_primaryTilesetA;
uniform sampler2D u_secondaryTilesetA;
uniform sampler2D u_palettesA;
uniform sampler2D u_primaryTilesetB;
uniform sampler2D u_secondaryTilesetB;
uniform sampler2D u_palettesB;

flat in float v_tilesetPair;
flat in float v_paletteId;
in vec2 v_tileUV;

out vec4 fragColor;

void main() {
    // Select tileset based on tile's tileset pair
    float colorIndex;
    if (v_tilesetPair < 0.5) {
        colorIndex = texture(u_primaryTilesetA, v_tileUV).r;
    } else {
        colorIndex = texture(u_primaryTilesetB, v_tileUV).r;
    }

    // Lookup in appropriate palette
    vec2 palCoord = vec2((colorIndex * 255.0 + 0.5) / 256.0, (v_paletteId + 0.5) / 16.0);
    if (v_tilesetPair < 0.5) {
        fragColor = texture(u_palettesA, palCoord);
    } else {
        fragColor = texture(u_palettesB, palCoord);
    }
}
```

**Pros:**
- Truly seamless - no texture rebinding during gameplay
- Supports 2+ tileset pairs simultaneously
- Per-tile selection is free (just an attribute)
- Can preload upcoming tilesets

**Cons:**
- Uses more texture units (6 per pair)
- Slightly more complex shader
- Need to track which tiles belong to which tileset

---

### Option 2: Texture Array (sampler2DArray)

Pack multiple tilesets into a single 3D texture array.

**Architecture:**
```
Texture Array Layer 0: Primary Tileset A
Texture Array Layer 1: Secondary Tileset A
Texture Array Layer 2: Primary Tileset B
Texture Array Layer 3: Secondary Tileset B
... (up to GL_MAX_ARRAY_TEXTURE_LAYERS, typically 256-2048)
```

**Shader:**
```glsl
uniform sampler2DArray u_tilesets;
uniform sampler2DArray u_palettes;

// Layer index = tilesetPair * 2 + isSecondary
float layer = v_tilesetPair * 2.0 + (v_tileId >= 512.0 ? 1.0 : 0.0);
float colorIndex = texture(u_tilesets, vec3(v_tileUV, layer)).r;
```

**Pros:**
- Single texture bind for all tilesets
- Cleaner shader code
- Scales to many tilesets

**Cons:**
- All tileset textures must be same size
- WebGL2 only
- Less flexible than separate textures

---

### Option 3: Uber-Atlas with UV Regions

Pack all tilesets into one giant texture atlas.

**Architecture:**
```
Single 4096x4096 Atlas:
┌─────────────────┬─────────────────┐
│ Primary A       │ Secondary A     │
│ (0,0)-(1024,1024)│(1024,0)-(2048,1024)│
├─────────────────┼─────────────────┤
│ Primary B       │ Secondary B     │
│ (0,1024)        │ (1024,1024)     │
└─────────────────┴─────────────────┘
```

**Shader:**
```glsl
uniform sampler2D u_atlas;
uniform vec4 u_tilesetRegions[4]; // xy = offset, zw = size

vec2 atlasUV = u_tilesetRegions[tilesetIndex].xy + v_tileUV * u_tilesetRegions[tilesetIndex].zw;
float colorIndex = texture(u_atlas, atlasUV).r;
```

**Pros:**
- Single texture, single bind
- Works in WebGL 1
- Maximum batching

**Cons:**
- Fixed atlas size limits tileset count
- Mipmap bleeding at region boundaries
- Complex UV calculations

---

### Option 4: Dynamic Tileset Streaming

Keep only 2 tileset pairs loaded, swap when player approaches boundary.

**Architecture:**
```typescript
class TilesetManager {
  currentPair: { primary: Texture, secondary: Texture, palettes: Texture };
  nextPair: { primary: Texture, secondary: Texture, palettes: Texture } | null;

  // Called each frame
  update(playerX: number, playerY: number) {
    const nearBoundary = this.checkTilesetBoundary(playerX, playerY);

    if (nearBoundary && !this.nextPair) {
      // Preload upcoming tileset pair (async)
      this.preloadTilesetPair(nearBoundary.tilesetId);
    }

    if (this.playerCrossedBoundary()) {
      // Instant swap - textures already loaded
      [this.currentPair, this.nextPair] = [this.nextPair, this.currentPair];
      this.rebuildTileInstances();
    }
  }
}
```

**Pros:**
- Minimal texture memory (only 2 pairs)
- Works with any number of tilesets
- Matches GBA behavior closely

**Cons:**
- Requires preloading logic
- Brief rebuild when crossing boundary
- More complex state management

---

## Recommended Implementation

### For Pokemon RSE Browser: Option 1 + Option 4 Hybrid

**Phase 1: Multi-Texture Foundation**
1. Modify `WebGLRenderPipeline` to support 2 tileset pairs (6 texture units)
2. Add `tilesetPairIndex` to `TileInstance` vertex data
3. Update shaders to conditionally sample from either pair

**Phase 2: Smart Loading**
1. Track current tileset pair for each loaded map
2. When stitching maps, identify tileset boundaries
3. Load both tileset pairs upfront if world spans 2 different pairs
4. For 3+ pairs: use Option 4's preloading at boundaries

**Phase 3: Boundary Detection**
1. Mark tiles at tileset boundaries
2. When player approaches boundary, ensure next tileset is loaded
3. If not loaded, either:
   - Block movement briefly while loading (< 100ms)
   - Use connection warp (fade transition)

### Data Structure Changes

```typescript
// Enhanced StitchedWorldData
type StitchedWorldData = {
  maps: StitchedMapInstance[];

  // Multiple tileset pairs for boundary maps
  tilesetPairs: Array<{
    id: string;  // e.g., "General+Petalburg"
    primaryTilesetId: string;
    secondaryTilesetId: string;
    primaryImage: TilesetImageData;
    secondaryImage: TilesetImageData;
    palettes: Palette[];
    animations: LoadedAnimation[];
  }>;

  // Map tileset pair index
  mapTilesetIndex: Map<string, number>;  // mapId -> tilesetPairs index

  // Boundary info
  tilesetBoundaries: Array<{
    fromMap: string;
    toMap: string;
    direction: 'north' | 'south' | 'east' | 'west';
    fromPairIndex: number;
    toPairIndex: number;
  }>;
};
```

### Shader Uniforms

```glsl
// Support 2 tileset pairs
uniform sampler2D u_primaryTileset[2];
uniform sampler2D u_secondaryTileset[2];
uniform sampler2D u_palettes[2];

// Per-tile attribute
flat in int v_tilesetPairIndex;  // 0 or 1
```

## Performance Considerations

| Approach | Texture Binds | Memory | Draw Calls | Complexity |
|----------|---------------|--------|------------|------------|
| Single pair | 3 | Low | 1 | Simple |
| Multi-texture (2 pairs) | 6 | Medium | 1 | Medium |
| Texture array | 2 | Medium | 1 | Medium |
| Uber-atlas | 2 | High | 1 | High |
| Dynamic streaming | 3-6 | Low | 1+ | High |

## Conclusion

The GBA achieved "seamless" transitions through careful level design (shared primary tilesets) and accepting brief secondary tileset loads during VBlank.

WebGL can do better by:
1. Loading multiple tileset pairs simultaneously
2. Using per-tile attributes to select which tileset to sample
3. Preloading upcoming tilesets before player reaches boundaries

The recommended approach is **Multi-Texture Units** for areas spanning 2 tileset pairs, with **Dynamic Streaming** as fallback for larger world exploration.

## References

- `public/pokeemerald/src/fieldmap.c` - GBA tileset loading
- `public/pokeemerald/src/overworld.c` - Map transition handling
- `public/pokeemerald/include/fieldmap.h` - Tileset constants
- `docs/systems/rendering/webglmap/webgl-gba-shaders.md` - WebGL palette techniques
