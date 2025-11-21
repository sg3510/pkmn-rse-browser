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
