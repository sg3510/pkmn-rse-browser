---
title: Viewport & Map Stitching Implementation Plan
status: reference
last_verified: 2026-01-13
---

# Viewport & Map Stitching Implementation Plan

## 1. Goal
Refactor the rendering system to support a fixed-size viewport (e.g., 20x20 tiles) that centers on the player and seamlessly stitches adjacent maps together. This improves performance by avoiding rendering massive canvases for large maps and provides a more authentic GBA-like experience.

## 2. Architecture Overview

### 2.1 Core Concepts
- **Viewport**: A window (Rectangle) into the game world defined by `x, y, width, height` in pixels.
- **World Coordinate System**: A unified coordinate system where the current "Center Map" is at `(0, 0)`. Connected maps are positioned relative to it based on their connection offsets.
- **Active Maps**: The set of maps currently intersecting the Viewport.

### 2.2 Components

1.  **`MapViewport` (Container Component)**
    - Replaces the top-level usage of `MapRenderer`.
    - Manages the `WorldState` (Current Map ID, Player Position).
    - Calculates the `Camera` position based on player movement.
    - Identifies which maps are visible.
    - Delegates rendering to `ViewportRenderer`.

2.  **`MapManager` (Data Service)**
    - Caches loaded map data (Layouts, Tilesets, Connections).
    - Provides a method `getMap(mapId)` that returns the map data and its connections.
    - Prevents duplicate loading of shared tilesets (Primary/Secondary).

3.  **`ViewportRenderer` (Presentation Component)**
    - Renders a *single* canvas of size `VIEWPORT_WIDTH * TILE_SIZE` x `VIEWPORT_HEIGHT * TILE_SIZE`.
    - Accepts a list of `RenderableMapLayer` objects (visible portions of maps).
    - Optimized to only draw tiles that fall within the viewport.

## 3. Detailed Design

### 3.1 Coordinate Systems

*   **Local Map Coordinates**: `(tileX, tileY)` relative to a specific map's top-left (0,0).
*   **World Coordinates**:
    *   The **Current Map** (where the player started or currently is) defines the origin `(0,0)`.
    *   **Connected Maps** are placed relative to this origin.
        *   *North Connection*: `y = -neighborHeight * 16`, `x = offset * 16`
        *   *South Connection*: `y = currentMapHeight * 16`, `x = offset * 16`
        *   *West Connection*: `x = -neighborWidth * 16`, `y = offset * 16`
        *   *East Connection*: `x = currentMapWidth * 16`, `y = offset * 16`
*   **Camera Coordinates**: The top-left of the visible screen in World Coordinates.
    *   `CameraX = PlayerWorldX - (ViewportWidth / 2)`
    *   `CameraY = PlayerWorldY - (ViewportHeight / 2)`
*   **Screen Coordinates**: `PixelX = WorldX - CameraX`.

### 3.2 Stitching Logic

The `mapIndex.json` (and `src/types/maps.ts`) contains a `connections` array for each map.
When the player gets close to the edge of the current map:
1.  Check `connections` for maps in that direction.
2.  Load the connected map's metadata.
3.  Calculate its bounding box in World Coordinates.
4.  If the Camera rectangle intersects with the Connected Map's bounding box, add it to the "Render Queue".

### 3.3 Rendering Loop (Optimization)

Instead of `ctx.drawImage(fullMapCanvas, ...)`:

1.  **Clear Canvas**.
2.  **Background Layer**:
    *   For each `VisibleMap`:
        *   Calculate the intersection of `MapRect` and `CameraRect`.
        *   Iterate *only* the tiles in that intersection.
        *   Draw tiles to the canvas at `(TileWorldX - CameraX, TileWorldY - CameraY)`.
3.  **Object/Player Layer**:
    *   Draw Player at fixed center (or relative offset if near world bounds).
    *   Draw events/NPCs (future).
4.  **Top Layer**:
    *   Repeat logic from Background Layer for "Top" tiles (e.g., tree tops, bridges).

### 3.4 Synchronized Animations

Since multiple maps may be visible, animations (like water or flowers) must be synchronized.
*   The `MapViewport` passes a shared `frameCounter` or `timestamp` to `ViewportRenderer`.
*   The renderer uses this global time to calculate the animation frame for all tilesets, ensuring that a body of water spanning two maps animates as a single cohesive unit.

### 3.5 Collision Detection

The `PlayerController` currently checks `(tileX, tileY)` against the single loaded map.
*   **Update**: The controller needs access to the `MapManager` or `WorldState`.
*   When `isCollisionAt(x, y)` is called:
    1.  Determine which map contains the coordinate `(x, y)` (Current map or a connected neighbor?).
    2.  Look up the collision data from that specific map.
    3.  If coordinate is not in any loaded map, treat as impassable.

## 4. Implementation Steps

### Step 1: Create `MapManager`
Create a service that handles loading and caching.
```typescript
class MapManager {
  // Cache for loaded resources
  private mapCache = new Map<string, MapData>();
  private tilesetCache = new Map<string, Tileset>();

  async loadMap(mapId: string): Promise<LoadedMap> {
    // Load map layout, primary/secondary tilesets
    // Return standard object with all buffers ready
  }
}
```

### Step 2: Create `ViewportRenderer`
This component accepts a `view` definition and a list of maps.
```typescript
interface ViewportProps {
  viewportSize: { w: number, h: number }; // e.g. 20x20
  center: { x: number, y: number }; // Player position
  maps: LoadedMapWithPosition[]; // Maps with their (x,y) world offsets
  timestamp: number; // For sync animations
}
```
Refactor the existing drawing logic from `MapRenderer` to work on a per-tile basis within a loop, rather than drawing the whole map at once.

### Step 3: Implement `WorldState` & Stitching
Update `PlayerController` or a new parent component to track:
*   `currentMapId`: The map the player is logically inside.
*   `globalX, globalY`: Player position relative to current map origin.

When `player.x` crosses a map boundary:
1.  Find the connection in that direction.
2.  Update `currentMapId` to the new map.
3.  Update `player.x, player.y` to be relative to the NEW map (coordinate transformation).

### Step 4: Configuration
Add a configuration object/context to easily change `VIEWPORT_WIDTH` and `VIEWPORT_HEIGHT` (e.g., 20, 30, 40 tiles).

## 5. Benefits
1.  **Performance**: We strictly render `W * H` tiles (e.g., 400 tiles for 20x20) regardless of map size. A 100x100 map is just as fast as a 20x20 map.
2.  **Seamless World**: No loading screens between connected areas.
3.  **Memory**: Large maps don't need fully rasterized canvases in memory, only their lightweight data arrays.

## 6. Refinements & Authenticity Notes (additive, do not remove previous plan)

- **Viewport sizing & camera clamp**: Default to 20x20 tiles, but make it configurable. Compute a desired camera center on the player, then clamp to the world rect (min/max X/Y over all visible maps + borders). Result: player is centered when possible; near edges the camera slides but the player remains on-screen.
- **Map borders (matches pokeemerald)**:
  - In `public/pokeemerald/src/fieldmap.c`, the engine allocates a larger buffer (`MAP_OFFSET_W/H`) and fills outside-map tiles using `GetBorderBlockAt`, which samples the 2x2 `border` array from the map layout (`global.fieldmap.h`).
  - When a coordinate is outside the map and no connection covers it, the border metatile is returned. Littleroot shows “infinite trees” because its border metatile is a tree; Route 101 connects north so the top is not border-filled.
  - Plan: store `border` metatiles per map and, when the camera requests tiles outside all loaded maps, return the border block of the “current” map (or the map owning the query if we extend that per-connection).
- **Connections fill (matches pokeemerald)**:
  - `InitBackupMapLayoutConnections` + `FillNorth/South/East/WestConnection` copy slices of neighbor maps into the border buffer. Behavior: if a connection overlaps, that neighbor data is shown; otherwise the border metatile is used.
  - Plan: when resolving tiles for rendering/collision, first test connected maps (tile rect), then fall back to border metatile of the base map.
- **Indoor vs overworld**: Indoors usually have no connections; everything outside the map rectangle should be the border metatile (often solid black/void). Keep the same logic, driven purely by the `border` array.
- **Data needed**:
  - Map layout: width/height, map tiles.
  - Border array (2x2 metatile IDs) from map header.
  - Connections (direction, offset, target map).
  - Tilesets (primary/secondary) and palettes per map.
- **Rendering outside bounds**:
  - Build a helper `resolveTile(worldX, worldY)` that checks (1) which map rect covers the coord (current or connected); (2) if none, return border metatile of the anchor map; (3) if outside anchor map entirely and no connection, keep returning border.
  - For infinite edge visuals (Littleroot trees), this is just repeated sampling of the border metatile.
- **Animation sync across stitched maps**: Keep global animation frame; use tileset ID + frame to pick pixels so water spanning connections animates coherently.
- **Collision & elevation**: Use the same `resolveTile` for collision/elevation queries so off-map space is impassable unless filled by a connection or a passable border.

## 7. Next Steps Checklist (additive)
- [ ] Add a `ViewportConfig` with default `{tilesWide: 20, tilesHigh: 20}`; ensure camera centering + clamp logic.
- [ ] Implement `resolveTile(worldX, worldY)` that checks connections first, then border metatile if no map covers the coord.
- [ ] Load and store `border` metatiles from map headers; expose via `MapManager`.
- [ ] Mirror pokeemerald connection fill rules: only copy the overlapping slice of neighbor maps into the visible rect; otherwise use border.
- [ ] Validate on Littleroot and an indoor map: player stays in view, infinite trees left/right/down render via border, Route 101 shows north connection, indoors show void/black border.

---

## 8. Pokeemerald Deep Dive: Camera, Viewport & Rendering

### 8.1 Core Camera System (`fieldmap.c`, `event_object_movement.c`)

#### Player-Centered Viewport
**Key Constants** ([fieldmap.h:18-20](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/include/fieldmap.h#L18-L20)):
```c
#define MAP_OFFSET 7                        // 7 tiles of view horizontally in each direction
#define MAP_OFFSET_W (MAP_OFFSET * 2 + 1)  // 15 tiles wide total
#define MAP_OFFSET_H (MAP_OFFSET * 2)      // 14 tiles high total
```

**Why 7?** The GBA screen is ~15 tiles wide (240px ÷ 16px). The player sprite is always kept at the **center** when possible (tile 7 from the left, tile 7 from the top for vertical centering). This creates a 7-tile buffer in all directions.

**Camera Focus Logic** ([fieldmap.c:792-814](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/fieldmap.c#L792-L814)):
```c
void SetCameraFocusCoords(u16 x, u16 y) {
    gSaveBlock1Ptr->pos.x = x - MAP_OFFSET;  // Camera top-left, not player pos
    gSaveBlock1Ptr->pos.y = y - MAP_OFFSET;
}

void GetCameraFocusCoords(u16 *x, u16 *y) {
    *x = gSaveBlock1Ptr->pos.x + MAP_OFFSET;  // Returns player coords
    *y = gSaveBlock1Ptr->pos.y + MAP_OFFSET;
}
```
- **`gSaveBlock1Ptr->pos`** stores the **camera top-left** corner in map tile coordinates, NOT the player position.
- Player position = camera position + MAP_OFFSET (to get center of viewport).

#### Sprite Positioning Relative to Camera
([event_object_movement.c:4801-4819](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/event_object_movement.c#L4801-L4819)):
```c
void SetSpritePosToMapCoords(s16 mapX, s16 mapY, s16 *destX, s16 *destY) {
    s16 dx = -gTotalCameraPixelOffsetX - gFieldCamera.x;
    s16 dy = -gTotalCameraPixelOffsetY - gFieldCamera.y;
    
    // Sub-tile camera adjustments for smooth scrolling
    if (gFieldCamera.x > 0) dx += 16;
    if (gFieldCamera.x < 0) dx -= 16;
    if (gFieldCamera.y > 0) dy += 16;
    if (gFieldCamera.y < 0) dy -= 16;
    
    *destX = ((mapX - gSaveBlock1Ptr->pos.x) << 4) + dx;  // <<4 = *16 (tile to pixel)
    *destY = ((mapY - gSaveBlock1Ptr->pos.y) << 4) + dy;
}
```
- **Tile-to-pixel conversion**: `(mapX - cameraX) * 16` gives pixel offset.
- **Sub-tile offsets** (`gFieldCamera.x/y`): For smooth scrolling during movement (player moving between tiles).
- **Screen coordinates** = player's map position relative to camera, converted to pixels.

**Implication for React**: Player should be rendered at a **fixed screen position** (center of canvas) when centered, and only deviate from center when near map edges.

---

### 8.2 Camera Edge Behavior: When Player Deviates from Center

The player MUST always be visible but doesn't always stay perfectly centered. Here's when the player deviates:

1. **Map is smaller than viewport**:
   - Example: A 10x10 indoor room with 20x20 viewport.
   - Camera clamps to map bounds: `camera.x = max(0, min(playerX - viewportWidth/2, mapWidth - viewportWidth))`.
   - Player appears **off-center** but still **fully visible**.

2. **Player near map edge (no connection)**:
   - If player moves to tile `(mapWidth - 1, y)` and viewport extends 7 tiles right of player:
     - Without connection: Camera stops scrolling, player moves toward right edge of screen.
     - With connection: Camera continues, connected map fills the view.

3. **Connection transitions** ([fieldmap.c:649-678](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/fieldmap.c#L649-L678)):
   - When crossing a connection boundary, `CameraMove()` adjusts `gSaveBlock1Ptr->pos` to the new map's coordinate system.
   - `gCamera.active` flag triggers smooth pan animation, but player stays on screen during transition.

**React Implementation Strategy**:
```typescript
function computeCameraOffset(
  playerTileX: number,
  playerTileY: number,
  mapWidth: number,
  mapHeight: number,
  viewportTilesWide: number,
  viewportTilesHigh: number
): { cameraX: number; cameraY: number } {
  // Ideal: player at center
  let cameraX = playerTileX - Math.floor(viewportTilesWide / 2);
  let cameraY = playerTileY - Math.floor(viewportTilesHigh / 2);
  
  // Clamp camera to ensure player stays in view
  const maxCameraX = mapWidth - viewportTilesWide;
  const maxCameraY = mapHeight - viewportTilesHigh;
  
  cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
  cameraY = Math.max(0, Math.min(cameraY, maxCameraY));
  
  return { cameraX, cameraY };
}
```
- This ensures player is **always in view** and **centered when map allows**.

---

### 8.3 Map Boundary Rendering: Border Tiles

#### Border Metatile Pattern ([fieldmap.c:51-64](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/fieldmap.c#L51-L64))
```c
#define GetBorderBlockAt(x, y) ({
    u16 block;
    int i = (x + 1) & 1;          // i = x % 2
    i += ((y + 1) & 1) * 2;       // + (y % 2) * 2  →  0,1,2,3 pattern
    block = gMapHeader.mapLayout->border[i] | MAPGRID_IMPASSABLE;
})
```
- **2x2 metatile pattern**: `border[0]`, `border[1]`, `border[2]`, `border[3]` tile infinitely in a checkerboard.
- **Littleroot Town**: `border` array contains 4 tree metatiles → infinite tree forest.
- **Indoor maps**: `border` array contains black/void tiles → black borders.

#### Resolving Tiles Outside Map ([fieldmap.c:365-373](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/fieldmap.c#L365-L373))
```c
u32 MapGridGetMetatileIdAt(int x, int y) {
    u16 block = GetMapGridBlockAt(x, y);  // Checks if in bounds or connection
    if (block == MAPGRID_UNDEFINED)
        return UNPACK_METATILE(GetBorderBlockAt(x, y));  // Infinite border pattern
    return UNPACK_METATILE(block);
}
```
**Logic**:
1. Check if `(x, y)` is within current map bounds → return map tile.
2. Check if `(x, y)` is covered by a connection → return connected map tile.
3. Otherwise → return **border metatile** at `(x % 2, y % 2)`.

**React Implementation**:
```typescript
function resolveTile(worldX: number, worldY: number): number {
  // 1. Check if coords are in current map
  if (isInMap(currentMap, worldX, worldY)) {
    return currentMap.tiles[tileIndex];
  }
  
  // 2. Check connections
  for (const conn of currentMap.connections) {
    if (isInConnection(conn, worldX, worldY)) {
      return connectedMapTile(conn, worldX, worldY);
    }
  }
  
  // 3. Fall back to border metatile (infinite pattern)
  const borderIndex = ((worldX + 1) & 1) + (((worldY + 1) & 1) * 2);
  return currentMap.borderMetatiles[borderIndex];
}
```

---

### 8.4 Connection Boundary Filling

Connections are **pre-filled** into `gBackupMapLayout.map`, a larger buffer ([fieldmap.c:100-169](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/fieldmap.c#L100-L169)):
```c
static void InitMapLayoutData(struct MapHeader *mapHeader) {
    mapLayout = mapHeader->mapLayout;
    width = mapLayout->width + MAP_OFFSET_W;   // Padded buffer
    height = mapLayout->height + MAP_OFFSET_H;
    gBackupMapLayout.width = width;
    gBackupMapLayout.height = height;
    
    InitBackupMapLayoutData(mapLayout->map, mapLayout->width, mapLayout->height);  // Copy main map
    InitBackupMapLayoutConnections(mapHeader);  // Fill connections
}
```
- Main map is copied to center of buffer.
- **MAP_OFFSET tiles around edges** are filled with either:
  - Connected map slices (via `FillNorthConnection`, etc.).
  - Border metatiles (if no connection exists).

**Connection Alignment** ([fieldmap.c:190-343](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/fieldmap.c#L190-L343)):
```c
static void FillSouthConnection(
  struct MapHeader const *mapHeader,
  struct MapHeader const *connectedMapHeader,
  s32 offset  // X offset for east-west alignment
) {
    cWidth = connectedMapHeader->mapLayout->width;
    x = offset + MAP_OFFSET;  // Alignment position in buffer
    y = mapHeader->mapLayout->height + MAP_OFFSET;  // Below main map
    
    // Copy only the overlapping slice
    FillConnection(x, y, connectedMapHeader, x2, 0, width, MAP_OFFSET);
}
```
- **Offset parameter**: Aligns the connection horizontally/vertically (e.g., Route 101 may not align perfectly with Littleroot's north edge).
- **Only overlapping region is filled**: If connection is narrower than map width, rest is border tiles.

**React Simplification**: Instead of pre-filling a buffer, use lazy tile resolution during rendering:
```typescript
for (let ty = cameraTileY; ty < cameraTileY + viewportHeight; ty++) {
  for (let tx = cameraTileX; tx < cameraTileX + viewportWidth; tx++) {
    const metatileId = resolveTile(tx, ty);  // Handles map, connections, borders
    renderMetatile(metatileId, (tx - cameraTileX) * 16, (ty - cameraTileY) * 16);
  }
}
```

---

### 8.5 Memory Efficiency for Dual-Map Scenarios

**Pokeemerald Approach**:
- **Single large buffer** (`sBackupMapData[MAX_MAP_DATA_SIZE]`): 10,240 tiles max.
- **Connection data reused**: Tilesets are shared (primary/secondary system).
- **Lazy rendering**: Only visible tiles are sent to VRAM (GBA has 96KB VRAM total).

**React/Canvas Optimization**:
1. **Shared Tilesets**: Load tileset images once, reuse across all maps using them.
   ```typescript
   const tilesetCache = new Map<string, ImageBitmap>();
   async function getTileset(id: string): Promise<ImageBitmap> {
     if (!tilesetCache.has(id)) {
       const img = await loadTilesetImage(id);
       tilesetCache.set(id, await createImageBitmap(img));
     }
     return tilesetCache.get(id)!;
   }
   ```

2. **Map Data Lazy Loading**: Only load connected maps when player approaches boundary.
   - Trigger load when `playerDistanceToEdge < 5 tiles`.
   - Cache most recent 2-3 maps (current + neighbors).

3. **Tile-Level Rendering**: Avoid full-map canvases. Render only the viewport's tiles each frame.

---

### 8.6 60fps React Canvas Rendering Loop

**Critical Performance Strategies**:

#### A. **RequestAnimationFrame with Fixed Timestep**
```typescript
const FRAME_TIME_MS = 1000 / 60;  // 16.67ms per frame
let lastFrameTime = 0;
let accumulator = 0;

function gameLoop(currentTime: number) {
  const deltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;
  accumulator += deltaTime;
  
  // Fixed update step (game logic)
  while (accumulator >= FRAME_TIME_MS) {
    updateGameState(FRAME_TIME_MS);  // Player movement, animations
    accumulator -= FRAME_TIME_MS;
  }
  
  // Render (can run at variable framerate)
  const interpolation = accumulator / FRAME_TIME_MS;
  render(interpolation);
  
  requestAnimationFrame(gameLoop);
}
```
**Why?** Decouples update rate (fixed 60fps) from render rate (variable). Ensures consistent game logic even on slow devices.

#### B. **Dirty Rectangle Rendering** (Optional for Static Layers)
- **Background layer** (non-animated tiles): Render once to offscreen canvas, reuse until map changes.
- **Animated tiles**: Track which tile IDs are animated, only redraw those regions.
- **Player/entities**: Always redraw on separate layer (or use sprites).

```typescript
const backgroundCanvas = document.createElement('canvas');
const backgroundCtx = backgroundCanvas.getContext('2d')!;
let backgroundDirty = true;

function render() {
  if (backgroundDirty) {
    renderBackgroundLayer(backgroundCtx);  // Full redraw
    backgroundDirty = false;
  }
  
  // Main canvas: composite layers
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(backgroundCanvas, 0, 0);
  renderAnimatedTiles(ctx);
  renderPlayer(ctx);
}
```

#### C. **Canvas 2D Optimization Techniques**
1. **ImageBitmap for sprites/tiles**: Faster than `<img>` or `Image()`.
   ```typescript
   const tileBitmap = await createImageBitmap(tileImage);
   ctx.drawImage(tileBitmap, sx, sy, sw, sh, dx, dy, dw, dh);
   ```

2. **Integer pixel coordinates**: Avoid sub-pixel rendering for sharp pixels.
   ```typescript
   ctx.imageSmoothingEnabled = false;  // Crisp pixel art
   const x = Math.floor(playerX);
   const y = Math.floor(playerY);
   ```

3. **Batch `drawImage` calls**: Group similar operations.
   - Render all tiles from same tileset consecutively.
   - Minimize context state changes (fillStyle, globalAlpha, etc.).

4. **Offscreen Canvas for complex compositing**: Use Web Workers if needed.
   ```typescript
   const offscreen = new OffscreenCanvas(width, height);
   // Transfer to worker for heavy tile processing
   ```

#### D. **Animation Frame Synchronization**
**Pokeemerald's approach** ([MapRenderer.tsx:787-800](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/components/MapRenderer.tsx#L787-L800)):
- Global `frameCounter` increments every frame.
- Tileset animations use `frameCounter % animSequence.length` to pick frame.
- This ensures **all water tiles animate in sync** across map boundaries.

**React Implementation**:
```typescript
const [frameCounter, setFrameCounter] = useState(0);

useEffect(() => {
  let animId: number;
  const tick = () => {
    setFrameCounter(prev => (prev + 1) % 3600);  // Reset every minute to avoid overflow
    animId = requestAnimationFrame(tick);
  };
  animId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(animId);
}, []);

// In render loop
const waterFrame = tilesetAnimations['water'].frames[frameCounter % 15];
```

---

### 8.7 Practical Implementation Checklist

#### Phase 1: Viewport & Camera
- [ ] Define `ViewportConfig` with `tilesWide: 20, tilesHigh: 20` (changeable).
- [ ] Implement `computeCameraOffset()` with player centering + edge clamping.
- [ ] Update render loop to only draw tiles within camera bounds.
- [ ] Test: Player stays centered on large map, deviates near edges but stays visible.

#### Phase 2: Border Tiles & Connections
- [ ] Load `border` array from map headers (add to `mapIndex.json` if missing).
- [ ] Implement `resolveTile(worldX, worldY)` with 2x2 border pattern fallback.
- [ ] Add connection data to `MapManager` (direction, offset, target map).
- [ ] Test: Littleroot shows infinite trees left/right/down; Route 101 visible to north.

#### Phase 3: Performance Optimization
- [ ] Convert tileset images to `ImageBitmap` on load.
- [ ] Implement background layer caching (static tiles to offscreen canvas).
- [ ] Profile `render()` function; aim for \u003c10ms per frame (leaves 6ms budget for browser).
- [ ] Add FPS counter to dev tools; verify stable 60fps during scrolling.

#### Phase 4: Memory Management
- [ ] Implement tileset caching (shared across maps).
- [ ] Add map data lazy loading (load neighbors when within 5 tiles of edge).
- [ ] Limit map cache to 3 entries (current + 2 neighbors); evict LRU.
- [ ] Test: Memory usage stable when traversing 10+ connected maps.

#### Phase 5: Animation Sync
- [ ] Ensure global frame counter drives all tile animations.
- [ ] Verify water animations stay in sync when crossing map connections.
- [ ] Test: Stand on Littleroot-Route101 boundary; water should flow seamlessly.

---

### 8.8 Key Pokeemerald Files Reference

| File | Purpose | Key Functions/Sections |
|------|---------|------------------------|
| [`fieldmap.h`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/include/fieldmap.h) | Map constants, API declarations | `MAP_OFFSET`, `GetCameraFocusCoords`, `MapGridGetMetatileIdAt` |
| [`fieldmap.c`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/fieldmap.c) | Map buffer, borders, connections | `InitMapLayoutData`, `GetBorderBlockAt`, `FillNorthConnection` (and S/E/W) |
| [`event_object_movement.c`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/event_object_movement.c) | Sprite positioning, camera offsets | `SetSpritePosToMapCoords` (L4801-4819) |
| [`global.fieldmap.h`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/include/global.fieldmap.h) | Structs for map layout, connections | `struct MapLayout`, `struct MapConnection` |

---

### 8.9 Advanced Camera Features (Future Enhancements)

**Smooth Scrolling** (sub-tile movement):
- Player moves at 0.5 pixels/frame (walking speed in pokeemerald).
- Camera pans smoothly by accumulating fractional pixel offsets.
- `gFieldCamera.x/y` tracks sub-tile offsets (±8 pixels max during movement).

**React Implementation**:
```typescript
const [playerSubPixelX, setPlayerSubPixelX] = useState(0);  // -8 to +8 range
const [playerSubPixelY, setPlayerSubPixelY] = useState(0);

function updatePlayerMovement(direction: Direction) {
  // Increment sub-pixel offset
  setPlayerSubPixelX(prev => {
    const newVal = prev + (direction === 'right' ? 0.5 : direction === 'left' ? -0.5 : 0);
    if (Math.abs(newVal) >= 8) {
      // Full tile crossed, update tile position
      setPlayerTileX(old => old + Math.sign(newVal));
      return 0;  // Reset sub-pixel offset
    }
    return newVal;
  });
}

// In render: offset sprites by sub-pixel amounts
ctx.drawImage(playerSprite, baseX + playerSubPixelX, baseY + playerSubPixelY);
```

**Camera Shake** (damage effects, not needed for MVP):
- Temporarily add random offsets to camera rendering.
- Reset after shake duration.

---

###  8.10 Ensuring Player is ALWAYS in View

**Non-negotiable rule**: Player sprite must NEVER be off-screen, even partially.

**Implementation Safeguards**:
1. **Camera clamp bounds include player sprite size**:
   ```typescript
   const playerWidthTiles = Math.ceil(playerSpriteWidth / 16);
   const playerHeightTiles = Math.ceil(playerSpriteHeight / 16);
   
   const minCameraX = 0;
   const maxCameraX = Math.max(0, mapWidth - viewportWidth);
   const minCameraY = 0;
   const maxCameraY = Math.max(0, mapHeight - viewportHeight);
   
   // Ensure player is fully visible
   cameraX = clamp(cameraX, 
     playerTileX - viewportWidth + playerWidthTiles,  // Player at right edge
     playerTileX - 0  // Player at left edge
   );
   ```

2. **Boundary assertions** (dev mode):
   ```typescript
   function assertPlayerVisible() {
     const playerScreenX = (playerTileX - cameraTileX) * 16;
     const playerScreenY = (playerTileY - cameraTileY) * 16;
     if (playerScreenX \u003c 0 || playerScreenX \u003e canvasWidth - 16) {
       throw new Error(`Player off-screen X: ${playerScreenX}`);
     }
     // Same for Y
   }
   ```

3. **Render layer ordering** (player should never be clipped):
   - Bottom layer: Background tiles
   - Middle layer: Animated tiles (water, flowers)
   - Top layer: Player sprite (always rendered last, never obscured).

---

## 9. Browser Rendering Optimization Plan

### 9.1 The Current Bottleneck: CPU-Bound Pixel Manipulation
The current `MapRenderer.tsx` manually constructs `ImageData` pixel-by-pixel to handle palette swapping:
```typescript
// Current slow approach
for (let px = 0; px < TILE_SIZE; px++) {
  const paletteIndex = tiles[sourceY * 128 + sourceX];
  const colorHex = palette.colors[paletteIndex];
  data[pixelIndex] = ... // Manual RGBA assignment
}
```
This is extremely expensive, especially when re-rendering the entire map buffer.

### 9.2 Solution A: Pre-rendered Tileset Cache
Instead of applying palettes per-pixel during map render, we will **pre-generate** colored tilesets for each palette used.

**Implementation**:
1. **Load Tileset (Grayscale/Indexed)**: Keep raw `Uint8Array` data.
2. **Generate Cached Canvases**:
   - For each palette (Day, Night, etc.):
     - Create an `OffscreenCanvas` (or helper canvas) matching tileset dimensions.
     - Iterate pixels ONCE to apply the palette.
     - Store as `ImageBitmap` (GPU-friendly).
3. **Render Loop**:
   - Use `ctx.drawImage(cachedTilesetBitmap, srcX, srcY, ...)`
   - This moves the work from **CPU (per pixel)** to **GPU (texture copy)**.

**Data Structure**:
```typescript
type TilesetCache = Map<string, ImageBitmap>; // Key: "tilesetId:paletteId"

async function preRenderTileset(
  tiles: Uint8Array, 
  palette: Palette
): Promise<ImageBitmap> {
  // ... generate colored pixels once ...
  return createImageBitmap(imageData);
}
```

### 9.3 Solution B: Viewport Culling (The "Virtual" Canvas)
Currently, `MapRenderer` creates a canvas the size of the **entire map** (e.g., 80x80 tiles).
- **Problem**: 80x80 tiles = 6400 tiles. Even with caching, drawing 6400 tiles is slow.
- **Fix**: Only render the **Visible Viewport + Buffer**.

**Strategy**:
1. **Canvas Size**: Fixed to Viewport Size (e.g., 240x160px + buffer = ~512x512px).
2. **Render Offset**:
   ```typescript
   const startTileX = Math.floor(cameraX / 16);
   const startTileY = Math.floor(cameraY / 16);
   const offsetX = -(cameraX % 16);
   const offsetY = -(cameraY % 16);
   
   // Loop only visible tiles
   for (let y = 0; y < viewportTilesHigh + 1; y++) {
     for (let x = 0; x < viewportTilesWide + 1; x++) {
       renderTile(startTileX + x, startTileY + y, offsetX + x*16, offsetY + y*16);
     }
   }
   ```
3. **Infinite Scrolling**:
   - As camera moves, we just draw the new grid at the new offset.
   - No need for a massive "background canvas" unless we want to cache the *static* viewport (which is valid).

### 9.4 Proposed Rendering Pipeline (React + Canvas)

1. **Init Phase**:
   - Load Map Layout.
   - Load Tileset Images (Raw).
   - **Job**: Generate `ImageBitmap`s for Primary/Secondary tilesets paired with their Palettes.

2. **Render Loop (rAF)**:
   - **Clear** main canvas.
   - **Calculate Viewport**: Determine `minTileX`, `maxTileX`, `minTileY`, `maxTileY` based on Camera.
   - **Layer 0 (Bottom)**:
     - Iterate visible grid.
     - `resolveTile(x, y)` -> gets `metatileId`.
     - Draw 4 sub-tiles using `drawImage(cachedTileset, ...)`
   - **Layer 1 (Top)**:
     - Same iteration, draw top-layer tiles.
   - **Sprites/Player**:
     - Draw on top.

### 9.5 Memory Considerations
- **Tileset Cache**:
  - 1 Tileset (256x512px) = ~500KB in memory.
  - 12 Palettes (Time of day) = ~6MB. Very acceptable.
- **Map Data**:
  - Only store layout arrays (integers).
  - Do not create `ImageData` buffers for maps.

### 9.6 Advanced: Web Worker (Optional but Recommended)
If the main thread is still heavy (React overhead), move the **entire render loop** to a Web Worker.
- **Main Thread**: Handles Input, React UI, sends `canvas` via `transferControlToOffscreen()`.
- **Worker**: Runs `requestAnimationFrame`, handles game logic, renders to OffscreenCanvas.
- **Pros**: Zero UI jank.
- **Cons**: Complexity in message passing (input events).
- **Recommendation**: Stick to Main Thread first with **Solution A & B**. Only move to Worker if 60fps is missed.
