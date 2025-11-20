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

## Implementation Guide for React

To replicate this system in the browser:

1.  **Map Loading**:
    -   Read `layouts.json` to get the `primary_tileset` and `secondary_tileset` names.
    -   Map these names to the corresponding animation logic (e.g., "gTileset_General" -> `TilesetAnim_General`).

2.  **Animation Loop**:
    -   Maintain a global `frameCounter` (or per-tileset counters).
    -   Run an update function every ~16.7ms (60fps).
    -   For each active tileset, check the intervals defined above.

3.  **Rendering**:
    -   **Do not** re-render the entire map.
    -   Use a **Canvas Overlay** or **Texture Replacement** approach.
    -   Identify the *screen coordinates* of the tiles that match the **Dest Tile IDs**.
    -   Draw the current frame's pixel data over those tiles.
    -   Respect Z-layering: If the tile is `SPLIT` or `NORMAL`, ensure the animation draws at the correct depth relative to the player.

4.  **Data Handling**:
    -   Load the `.4bpp` (or converted PNG) frame files.
    -   Store them as textures/images.
    -   Map the frame indices (0, 1, 2...) to these textures.

5.  **Special Cases**:
    -   **Phased Animations**: For Rustboro/Mauville/Ever Grande flowers, calculate the frame index based on the *tile position* or slot index to recreate the wave effect.
    -   **Palette Blending**: For Battle Dome, you might need a shader or CSS filter to handle the color shifts, as this is not just tile swapping.
