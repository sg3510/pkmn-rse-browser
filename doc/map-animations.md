# Map Animation System

This document details the internal mechanics of the Emerald overworld animation system, derived from a deep analysis of the C engine source code (`tileset_anims.c`, `field_camera.c`, `headers.h`, etc.).

## Core Architecture

The animation system is driven by the **VBlank** interrupt and a per-frame update loop. It operates by queueing DMA transfers to update specific tile data in VRAM.

### Key Files
-   **`src/tileset_anims.c`**: The heart of the system. Contains the `UpdateTilesetAnimations` loop, all animation callbacks, frame data arrays, and destination VRAM addresses.
-   **`src/field_camera.c`**: Handles map rendering and Z-layering logic (`DrawMetatile`).
-   **`src/data/tilesets/headers.h`**: Defines `Tileset` structs and links them to their specific animation initialization functions (e.g., `InitTilesetAnim_Lavaridge`).
-   **`include/fieldmap.h`**: Defines constants like `NUM_TILES_IN_PRIMARY` (512).

### The Animation Loop
1.  **Initialization**: When a map loads, `InitTilesetAnimations()` is called. It triggers:
    -   `_InitPrimaryTilesetAnimation()`: Calls the callback defined in the primary tileset header.
    -   `_InitSecondaryTilesetAnimation()`: Calls the callback defined in the secondary tileset header.
2.  **Update**: `UpdateTilesetAnimations()` runs every frame.
    -   Increments `sPrimaryTilesetAnimCounter` and `sSecondaryTilesetAnimCounter`.
    -   Calls the active callbacks (e.g., `TilesetAnim_General`, `TilesetAnim_Mauville`) with the current counter value.
3.  **Queueing**: Inside a callback, logic checks `timer % INTERVAL == 0`. If true, it calls a helper (e.g., `QueueAnimTiles_General_Flower`) to append a DMA transfer request to `sTilesetDMA3TransferBuffer`.
4.  **Transfer**: `TransferTilesetAnimsBuffer()` executes the queued DMA copies during VBlank, updating the tile patterns in VRAM.

---

## Z-Layering & Transparency

Animated tiles are just standard tiles in VRAM. Their Z-ordering is determined entirely by the **Metatile Layer Type** of the metatile they are part of. This logic is found in `DrawMetatile` in `field_camera.c`.

### Layer Types
The `metatile_attributes.bin` file (bits 12-15 of the attribute word) defines the layer type:

| Layer Type | Value | Bottom Layer (BG3) | Middle Layer (BG2) | Top Layer (BG1) | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Normal** | `0` | Garbage (0x3014) | Metatile Bottom | Metatile Top | Standard ground. Player walks *on* BG2, *under* BG1. |
| **Covered** | `1` | Metatile Bottom | Metatile Top | Transparent | Player walks *on* BG2 (which is now the "top" visual layer of the tile). |
| **Split** | `2` | Metatile Bottom | **Transparent** | Metatile Top | **Crucial for animations**. BG2 is empty (transparent). BG3 is background, BG1 is foreground. |

### Transparency
-   **Palette Index 0**: Always transparent.
-   **Split Layer**: In `METATILE_LAYER_TYPE_SPLIT`, the middle layer (BG2) is explicitly filled with tile `0` (transparent). This allows the bottom layer (BG3) to show through, while the top layer (BG1) renders above the player.
-   **Implication**: Water animations often use "Normal" or "Split" depending on whether the player can surf on them or walk behind/in front of them.

---

## Palette Management

-   **4bpp Frames**: All animation frames are stored as raw 4bpp tile data.
-   **No Palette Swapping**: Most standard animations (flowers, water) **do not** change palettes. They copy new *pixel data* (tile patterns) to VRAM, but use the existing palette assigned to that metatile.
-   **Palette Blending**: A few specific animations (e.g., `BlendAnimPalette_BattleDome_FloorLights`) use `CpuCopy16` to overwrite palette memory (`gPlttBufferUnfaded`) and then `BlendPalette` to fade colors. This is rare and specific to complex effects.

---

## Animation Reference

### Primary Tileset (General)
*Base Tile ID Offset: 0*

| Animation | Dest Tile ID | Size (Tiles) | Interval | Sequence / Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Flower** | 508 | 4 | 16 | `[0, 1, 0, 2]` (Frames) |
| **Water** | 432 | 30 | 16 | `0..7` (Cyclic) |
| **Sand/Water Edge** | 464 | 10 | 16 | `0..6, 0` |
| **Waterfall** | 496 | 6 | 16 | `0..3` |
| **Land/Water Edge** | 480 | 10 | 16 | `0..3` |

### Secondary Tilesets
*Base Tile ID Offset: 512 (`NUM_TILES_IN_PRIMARY`)*

#### Rustboro
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Windy Water** | 128-156 | 4 (x8) | 8 | 8 slots. Phase shifted: `(timer - slot) % 8`. Creates a wave effect. |
| **Fountain** | 448 | 4 | 8 | `0, 1` |

#### Mauville
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Flowers** | 96-124 (Set 1)<br>128-156 (Set 2) | 4 (x8) | 8 | 8 slots. Complex sequence: `[0,0,1,2,3,3,3,3,3,3,2,1]` then fallback `[0,0,4,4]`. |

#### Lavaridge
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Steam** | 288, 292 | 4 | 16 | Slot 1: `timer % 4`. Slot 2: `(timer + 2) % 4`. |
| **Lava** | 160 | 4 | 16 | `0..3` (Shared with Cave) |

#### Pacifidlog
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Log Bridges** | 464 | 30 | 16 | `0, 1, 2, 1` |
| **Water Currents** | 496 | 8 | 16 | `0..7` |

#### Sootopolis
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Stormy Water** | 240 | 96 | 16 | `0..7`. **Huge transfer** (Kyogre/Groudon variants). |

#### Underwater
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Seaweed** | 496 | 4 | 16 | `0..3` |

#### Cave
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Lava** | 416 | 4 | 16 | `0..7` (Note: Uses Lavaridge frames but different dest/count) |

#### Ever Grande
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Flowers** | 224-252 | 4 (x8) | 8 | 8 slots. Phase shifted: `(timer - slot) % 8`. |

#### Elite Four
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Ground Lights** | 480 | 4 | 64 | `0, 1` |
| **Wall Lights** | 504 | 1 | 8 | `0..3` |

#### Mauville Gym
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Electric Gates** | 144 | 16 | 2 | `0, 1`. Very fast. |

#### Sootopolis Gym
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Side Waterfall** | 496 | 12 | 8 | `0..2` |
| **Front Waterfall** | 464 | 20 | 8 | `0..2` |

#### Battle Frontier
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Flags (West/East)**| 218 | 6 | 8 | `0..3` |

#### Battle Pyramid
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Torch** | 151 | 8 | 8 | `0..2` |
| **Statue Shadow** | 135 | 8 | 8 | `0..2` |

#### Bike Shop
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Blinking Lights** | 496 | 9 | 4 | `0, 1` |

#### Building (Primary)
| Animation | Dest Tile ID | Size | Interval | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **TV Turned On** | 496 | 4 | 8 | `0, 1` |

---

## Programmatic Parsing Strategy

To implement this system "correctly" by reading the source files directly (instead of hardcoding values), you need to follow the dependency chain from the map layout to the raw image assets. Here is the step-by-step parsing logic:

### 1. Entry Point: `layouts.json`
*   **Source**: `public/pokeemerald/data/layouts/layouts.json`
*   **Action**: Read the `primary_tileset` and `secondary_tileset` fields for your target map.
*   **Example**: `"primary_tileset": "gTileset_General"`

### 2. Tileset Definition: `headers.h`
*   **Source**: `public/pokeemerald/src/data/tilesets/headers.h`
*   **Action**: Search for the struct definition matching the tileset name found in step 1.
*   **Extract**: The `.callback` function name.
*   **Example**:
    ```c
    const struct Tileset gTileset_General =
    {
        ...
        .callback = InitTilesetAnim_General,
    };
    ```
    *Result: `InitTilesetAnim_General`*

### 3. Initialization Logic: `tileset_anims.c`
*   **Source**: `public/pokeemerald/src/tileset_anims.c`
*   **Action**: Find the definition of the initialization function.
*   **Extract**: The function assigned to `sPrimaryTilesetAnimCallback` (or `sSecondary...`).
*   **Example**:
    ```c
    void InitTilesetAnim_General(void)
    {
        ...
        sPrimaryTilesetAnimCallback = TilesetAnim_General;
    }
    ```
    *Result: `TilesetAnim_General`*

### 4. Animation Loop & Timing
*   **Source**: `public/pokeemerald/src/tileset_anims.c`
*   **Action**: Parse the callback function found in step 3.
*   **Logic**:
    *   Look for `if (timer % INTERVAL == OFFSET)` blocks.
    *   **Extract**:
        *   `INTERVAL`: The modulo value (e.g., `16`).
        *   `OFFSET`: The remainder check (e.g., `0`, `1`, etc.).
        *   `FUNCTION`: The function called inside the block (e.g., `QueueAnimTiles_General_Flower`).
*   **Example**:
    ```c
    static void TilesetAnim_General(u16 timer)
    {
        if (timer % 16 == 0)
            QueueAnimTiles_General_Flower(timer / 16);
        ...
    }
    ```

### 5. Frame Data & VRAM Destination
*   **Source**: `public/pokeemerald/src/tileset_anims.c`
*   **Action**: Parse the `QueueAnimTiles_*` function.
*   **Extract**:
    *   **Frame Array**: The array being accessed (e.g., `gTilesetAnims_General_Flower`).
    *   **Destination ID**: The argument to `TILE_OFFSET_4BPP(...)`.
        *   *Note*: If it uses `NUM_TILES_IN_PRIMARY + X`, the ID is `512 + X`.
    *   **Size**: The size argument (e.g., `4 * TILE_SIZE_4BPP` -> 4 tiles).
*   **Example**:
    ```c
    static void QueueAnimTiles_General_Flower(u16 timer)
    {
        u16 i = timer % ARRAY_COUNT(gTilesetAnims_General_Flower);
        AppendTilesetAnimToBuffer(gTilesetAnims_General_Flower[i], (u16 *)(BG_VRAM + TILE_OFFSET_4BPP(508)), 4 * TILE_SIZE_4BPP);
    }
    ```

### 6. Frame File Paths
*   **Source**: `public/pokeemerald/src/tileset_anims.c` (Global scope)
*   **Action**: Look up the definition of the Frame Array found in step 5.
*   **Extract**: The list of frame pointers (e.g., `gTilesetAnims_General_Flower_Frame0`).
*   **Action**: Look up the definition of each frame pointer.
*   **Extract**: The file path inside `INCBIN_U16("...")`.
*   **Example**:
    ```c
    const u16 gTilesetAnims_General_Flower_Frame0[] = INCBIN_U16("data/tilesets/primary/general/anim/flower/0.4bpp");
    ```
    *Result: `data/tilesets/primary/general/anim/flower/0.4bpp`*

### Summary of Extracted Data
By following this chain, you can build a JSON structure for each tileset:

```json
{
  "tilesetName": "gTileset_General",
  "animations": [
    {
      "name": "Flower",
      "interval": 16,
      "destinationTileId": 508,
      "numTiles": 4,
      "frames": [
        "data/tilesets/primary/general/anim/flower/0.4bpp",
        "data/tilesets/primary/general/anim/flower/1.4bpp",
        "data/tilesets/primary/general/anim/flower/0.4bpp",
        "data/tilesets/primary/general/anim/flower/2.4bpp"
      ]
    }
  ]
}
```

### 7. Advanced Animation Patterns
Some animations use logic beyond simple looping. Your parser should look for these patterns:

#### A. Phase Shifting (Wave Effects)
*   **Pattern**: The callback calls the queue function multiple times with different "slot" indices.
*   **Code**:
    ```c
    // TilesetAnim_Rustboro
    for (i = 0; i < 8; i++)
        QueueAnimTiles_Rustboro_WindyWater(timer / 8, i);
    ```
*   **Logic**: Inside the queue function, the frame index is calculated as `(timer - slot) % COUNT`. This creates a wave effect where each tile is slightly behind the previous one.

#### B. Intro + Loop Sequences
*   **Pattern**: The queue function checks if the timer is below a threshold to play an "Intro" sequence, otherwise it plays a "Loop" sequence.
*   **Code**:
    ```c
    // QueueAnimTiles_Mauville_Flowers
    if (timer < 12)
        Append(IntroArray[timer]);
    else
        Append(LoopArray[timer % LoopCount]);
    ```
*   **Handling**: You may need to extract *two* frame arrays (`gTilesetAnims_...` and `gTilesetAnims_..._B`) and the threshold logic.

#### C. Palette Animations
*   **Pattern**: Functions starting with `BlendAnimPalette_` instead of `QueueAnimTiles_`.
*   **Action**: These do **not** update tile graphics. Instead, they update the palette RAM.
*   **Code**:
    ```c
    CpuCopy16(PaletteArray[i], &gPlttBufferUnfaded[BG_PLTT_ID(8)], ...);
    ```
*   **Implementation**: In React, this requires updating the texture palette or using a fragment shader to shift colors for specific palette indices (e.g., Palette 8).
