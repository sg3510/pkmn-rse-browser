---
title: Infinite World Roaming - Implementation Plan
status: reference
last_verified: 2026-02-20
---

# Infinite World Roaming - Implementation Plan

## Goal

Allow the player to roam the entire Pokemon Emerald overworld seamlessly, with no fades or loading screens when crossing between maps with different tilesets.

## 2026-02-20 Implementation Notes

- `WorldManager.initialize` now supports `WorldInitializeOptions`:
  - `initialDepth` (default `1`)
  - `targetDepth` (default `2`)
  - `backgroundStitch` (default `true`)
- Startup now uses two-phase stitching:
  - phase 1 blocks only on depth `1` for faster first paint
  - phase 2 continues stitching to depth `2` in background.
- Per-map `mapsChanged` / `tilesetsChanged` emissions are suppressed during blocking initialize to reduce startup churn.
- Runtime stitching depth remains `2` during movement updates.
- `loadingStateChanged` was added to `WorldManagerEvent` and is now used by the UI to show non-blocking stitch progress.
- Runtime/background stitching now uses cooperative yields so map loading work does not monopolize the main thread.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     WorldManager                                 │
│  - Tracks player position in world coordinates                  │
│  - Manages loaded map chunks around player                      │
│  - Handles tileset pair loading/unloading                       │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ TilesetManager  │ │  MapChunkCache  │ │ BoundaryTracker │
│ - 2 active pairs│ │ - Loaded maps   │ │ - Edge detection│
│ - Preload queue │ │ - LRU eviction  │ │ - Tileset edges │
└─────────────────┘ └─────────────────┘ └─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   WebGLRenderPipeline                           │
│  - Multi-texture rendering (2 tileset pairs)                    │
│  - Per-tile tileset selection via vertex attribute              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Multi-Texture Foundation

### Step 1.1: Extend TileInstance Data Structure

**File:** `src/rendering/webgl/TileInstanceBuilder.ts`

Add `tilesetPairIndex` to vertex data:

```typescript
// Current: 16 bytes per instance
// New: 20 bytes per instance (add 4 bytes for tileset index + padding)

interface TileInstanceData {
  // Existing
  x: number;              // float32
  y: number;              // float32
  tileId: number;         // uint16
  paletteId: number;      // uint8
  flags: number;          // uint8 (flipX, flipY, layer)

  // New
  tilesetPairIndex: number; // uint8 (0 or 1)
  _padding: number;         // uint8 (alignment)
}
```

**Tasks:**
- [ ] Update `TileInstanceBuilder` to include `tilesetPairIndex` in vertex buffer
- [ ] Update vertex attribute layout (add `a_tilesetPairIndex`)
- [ ] Update `buildTileInstances()` to accept tileset pair index per tile

---

### Step 1.2: Update Vertex Shader

**File:** `src/rendering/webgl/shaders/tile.vert`

```glsl
// Add new attribute
attribute float a_tilesetPairIndex;

// Pass to fragment shader
flat varying float v_tilesetPairIndex;

void main() {
    // ... existing code ...
    v_tilesetPairIndex = a_tilesetPairIndex;
}
```

**Tasks:**
- [ ] Add `a_tilesetPairIndex` attribute
- [ ] Add `v_tilesetPairIndex` varying
- [ ] Update attribute location bindings in pipeline

---

### Step 1.3: Update Fragment Shader for Multi-Texture

**File:** `src/rendering/webgl/shaders/tile.frag`

```glsl
// Two tileset pairs
uniform sampler2D u_primaryTileset0;
uniform sampler2D u_secondaryTileset0;
uniform sampler2D u_palettes0;

uniform sampler2D u_primaryTileset1;
uniform sampler2D u_secondaryTileset1;
uniform sampler2D u_palettes1;

flat varying float v_tilesetPairIndex;
// ... other varyings ...

void main() {
    float colorIndex;
    vec4 finalColor;

    // Select tileset based on pair index
    if (v_tilesetPairIndex < 0.5) {
        // Tileset pair 0
        if (v_isSecondary < 0.5) {
            colorIndex = texture2D(u_primaryTileset0, v_tileUV).r;
        } else {
            colorIndex = texture2D(u_secondaryTileset0, v_tileUV).r;
        }
        finalColor = texture2D(u_palettes0, paletteCoord);
    } else {
        // Tileset pair 1
        if (v_isSecondary < 0.5) {
            colorIndex = texture2D(u_primaryTileset1, v_tileUV).r;
        } else {
            colorIndex = texture2D(u_secondaryTileset1, v_tileUV).r;
        }
        finalColor = texture2D(u_palettes1, paletteCoord);
    }

    // ... rest of shader ...
}
```

**Tasks:**
- [ ] Add second set of tileset/palette uniforms
- [ ] Add conditional sampling based on `v_tilesetPairIndex`
- [ ] Handle transparency for both tileset pairs

---

### Step 1.4: Update WebGLRenderPipeline

**File:** `src/rendering/webgl/WebGLRenderPipeline.ts`

```typescript
class WebGLRenderPipeline {
    // New: Support 2 tileset pairs
    private tilesetPairs: Array<{
        primaryTexture: WebGLTexture;
        secondaryTexture: WebGLTexture;
        paletteTexture: WebGLTexture;
        id: string;  // e.g., "General+Petalburg"
    }> = [];

    // Upload second tileset pair
    uploadTilesetPair(
        pairIndex: number,  // 0 or 1
        primaryData: Uint8Array,
        primaryWidth: number,
        primaryHeight: number,
        secondaryData: Uint8Array,
        secondaryWidth: number,
        secondaryHeight: number,
        palettes: Palette[]
    ): void;

    // Bind both tileset pairs before rendering
    private bindTilesetPairs(): void {
        const gl = this.gl;

        // Pair 0: texture units 0, 1, 2
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tilesetPairs[0].primaryTexture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.tilesetPairs[0].secondaryTexture);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.tilesetPairs[0].paletteTexture);

        // Pair 1: texture units 3, 4, 5
        if (this.tilesetPairs[1]) {
            gl.activeTexture(gl.TEXTURE3);
            gl.bindTexture(gl.TEXTURE_2D, this.tilesetPairs[1].primaryTexture);
            gl.activeTexture(gl.TEXTURE4);
            gl.bindTexture(gl.TEXTURE_2D, this.tilesetPairs[1].secondaryTexture);
            gl.activeTexture(gl.TEXTURE5);
            gl.bindTexture(gl.TEXTURE_2D, this.tilesetPairs[1].paletteTexture);
        }
    }
}
```

**Tasks:**
- [ ] Add `tilesetPairs` array to store multiple tileset pairs
- [ ] Create `uploadTilesetPair(pairIndex, ...)` method
- [ ] Update `bindTilesetPairs()` to bind all loaded pairs
- [ ] Update uniform locations for second tileset pair
- [ ] Add `clearTilesetPair(pairIndex)` for unloading

---

## Phase 2: World Data Structures

### Step 2.1: Create TilesetPairInfo Type

**File:** `src/pages/WebGLMapPage.tsx` (or new file `src/rendering/types.ts`)

```typescript
type TilesetPairInfo = {
    id: string;                    // "gTileset_General+gTileset_Petalburg"
    primaryTilesetId: string;
    secondaryTilesetId: string;
    primaryTilesetPath: string;
    secondaryTilesetPath: string;
    primaryImage: TilesetImageData;
    secondaryImage: TilesetImageData;
    primaryPalettes: Palette[];
    secondaryPalettes: Palette[];
    primaryMetatiles: Metatile[];
    secondaryMetatiles: Metatile[];
    primaryAttributes: MetatileAttributes[];
    secondaryAttributes: MetatileAttributes[];
    animations: LoadedAnimation[];
};
```

**Tasks:**
- [ ] Define `TilesetPairInfo` type
- [ ] Create helper to generate pair ID from tileset IDs

---

### Step 2.2: Extend StitchedWorldData

**File:** `src/pages/WebGLMapPage.tsx`

```typescript
type StitchedWorldData = {
    maps: StitchedMapInstance[];
    anchorId: string;
    worldBounds: { minX, minY, maxX, maxY, width, height };

    // NEW: Multiple tileset pairs
    tilesetPairs: TilesetPairInfo[];

    // NEW: Map each map to its tileset pair index
    mapTilesetPairIndex: Map<string, number>;  // mapId -> index in tilesetPairs

    // NEW: Border tiles per tileset pair
    borderMetatilesPerPair: Map<number, number[]>;

    // DEPRECATED: Remove single tileset fields
    // primaryMetatiles, secondaryMetatiles, etc. -> moved to tilesetPairs[0]
};
```

**Tasks:**
- [ ] Add `tilesetPairs` array to `StitchedWorldData`
- [ ] Add `mapTilesetPairIndex` mapping
- [ ] Migrate existing single-tileset fields to `tilesetPairs[0]`

---

### Step 2.3: Update loadStitchedWorld Function

**File:** `src/pages/WebGLMapPage.tsx`

```typescript
async function loadStitchedWorld(
    anchorEntry: MapIndexEntry,
    maxDepth: number = 3
): Promise<StitchedWorldData> {
    const maps: StitchedMapInstance[] = [];
    const visited = new Set<string>();
    const tilesetPairsMap = new Map<string, TilesetPairInfo>();
    const mapTilesetPairIndex = new Map<string, number>();

    // BFS to load maps - NOW CROSSES TILESET BOUNDARIES
    const queue = [{ entry: anchorEntry, offsetX: 0, offsetY: 0, depth: 0 }];

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.entry.id)) continue;
        visited.add(current.entry.id);

        // Generate tileset pair ID
        const pairId = `${current.entry.primaryTilesetId}+${current.entry.secondaryTilesetId}`;

        // Load tileset pair if not already loaded (max 2 pairs)
        if (!tilesetPairsMap.has(pairId)) {
            if (tilesetPairsMap.size >= 2) {
                // Skip maps requiring a 3rd tileset pair
                continue;
            }
            const pairInfo = await loadTilesetPair(current.entry);
            tilesetPairsMap.set(pairId, pairInfo);
        }

        // Track which tileset pair this map uses
        const pairIndex = [...tilesetPairsMap.keys()].indexOf(pairId);
        mapTilesetPairIndex.set(current.entry.id, pairIndex);

        // Load map data
        const mapData = await loadMapLayout(...);
        maps.push({ entry: current.entry, mapData, offsetX, offsetY });

        // Queue neighbors (regardless of tileset!)
        if (current.depth < maxDepth) {
            for (const conn of current.entry.connections || []) {
                // ... queue connected maps
            }
        }
    }

    return {
        maps,
        tilesetPairs: [...tilesetPairsMap.values()],
        mapTilesetPairIndex,
        // ...
    };
}
```

**Tasks:**
- [ ] Modify BFS to cross tileset boundaries (up to 2 pairs)
- [ ] Track tileset pair for each map
- [ ] Load tileset assets per unique pair
- [ ] Return multi-tileset world data

---

## Phase 3: Tile Resolution with Tileset Selection

### Step 3.1: Update Tile Resolver

**File:** `src/pages/WebGLMapPage.tsx`

```typescript
function createStitchedTileResolver(world: StitchedWorldData): TileResolverFn {
    const { maps, tilesetPairs, mapTilesetPairIndex } = world;

    return (worldX: number, worldY: number): ResolvedTile | null => {
        for (const map of maps) {
            const localX = worldX - map.offsetX;
            const localY = worldY - map.offsetY;

            if (localX >= 0 && localX < map.entry.width &&
                localY >= 0 && localY < map.entry.height) {

                // Get tileset pair for this map
                const pairIndex = mapTilesetPairIndex.get(map.entry.id) ?? 0;
                const pair = tilesetPairs[pairIndex];

                const idx = localY * map.entry.width + localX;
                const mapTile = map.mapData.layout[idx];
                const metatileId = mapTile.metatileId;

                const isSecondary = metatileId >= 512;
                const metatile = isSecondary
                    ? pair.secondaryMetatiles[metatileId - 512]
                    : pair.primaryMetatiles[metatileId];

                // ... resolve attributes from pair ...

                return {
                    metatile,
                    attributes,
                    mapTile,
                    isSecondary,
                    isBorder: false,
                    tilesetPairIndex: pairIndex,  // NEW
                };
            }
        }

        // Border tile handling...
        return borderTile;
    };
}
```

**Tasks:**
- [ ] Add `tilesetPairIndex` to `ResolvedTile` type
- [ ] Look up tileset pair per map in resolver
- [ ] Use correct metatiles/attributes from the pair

---

### Step 3.2: Update TileInstanceBuilder

**File:** `src/rendering/webgl/TileInstanceBuilder.ts`

```typescript
// When building instances, include tileset pair index
function buildTileInstance(resolved: ResolvedTile, x: number, y: number): TileInstance {
    return {
        x,
        y,
        tileId: resolved.mapTile.metatileId,
        paletteId: resolved.attributes.paletteId,
        flags: buildFlags(resolved),
        tilesetPairIndex: resolved.tilesetPairIndex ?? 0,  // NEW
    };
}
```

**Tasks:**
- [ ] Pass `tilesetPairIndex` from resolved tile to instance
- [ ] Update vertex buffer layout for new attribute

---

## Phase 4: Dynamic World Management

### Step 4.1: Create WorldManager Class

**File:** `src/rendering/WorldManager.ts` (new file)

```typescript
class WorldManager {
    private loadedWorld: StitchedWorldData | null = null;
    private currentAnchorId: string = '';
    private loadedTilesetPairs: Set<string> = new Set();

    // Configuration
    private readonly LOAD_RADIUS = 4;      // Load maps within 4 connections
    private readonly UNLOAD_RADIUS = 6;    // Unload maps beyond 6 connections
    private readonly MAX_TILESET_PAIRS = 2;

    constructor(
        private pipeline: WebGLRenderPipeline,
        private onWorldRebuilt: () => void
    ) {}

    // Called when player position changes significantly
    async updatePlayerPosition(tileX: number, tileY: number): Promise<void> {
        const currentMap = this.findMapAtPosition(tileX, tileY);
        if (!currentMap) return;

        // Check if we need to re-anchor (player moved to edge of loaded world)
        if (this.shouldReanchor(currentMap, tileX, tileY)) {
            await this.reanchorWorld(currentMap.entry);
        }
    }

    private shouldReanchor(currentMap: StitchedMapInstance, tileX: number, tileY: number): boolean {
        // Re-anchor if:
        // 1. Player is in a map that's at the edge of loaded world
        // 2. There are unloaded connections nearby
        // 3. Current anchor is far from player

        const distanceFromAnchor = this.getConnectionDistance(currentMap.entry.id, this.currentAnchorId);
        return distanceFromAnchor >= this.LOAD_RADIUS - 1;
    }

    private async reanchorWorld(newAnchor: MapIndexEntry): Promise<void> {
        // Rebuild world centered on new anchor
        const newWorld = await loadStitchedWorld(newAnchor, this.LOAD_RADIUS);

        // Update tileset pairs in pipeline
        await this.updateTilesetPairs(newWorld);

        // Store new world
        this.loadedWorld = newWorld;
        this.currentAnchorId = newAnchor.id;

        // Notify UI to rebuild tile instances
        this.onWorldRebuilt();
    }

    private async updateTilesetPairs(newWorld: StitchedWorldData): Promise<void> {
        const newPairIds = new Set(newWorld.tilesetPairs.map(p => p.id));

        // Upload new pairs
        for (let i = 0; i < newWorld.tilesetPairs.length; i++) {
            const pair = newWorld.tilesetPairs[i];
            if (!this.loadedTilesetPairs.has(pair.id)) {
                this.pipeline.uploadTilesetPair(i, pair);
            }
        }

        // Clear unused pairs
        for (const oldPairId of this.loadedTilesetPairs) {
            if (!newPairIds.has(oldPairId)) {
                // Pair no longer needed - could clear texture
            }
        }

        this.loadedTilesetPairs = newPairIds;
    }
}
```

**Tasks:**
- [ ] Create `WorldManager` class
- [ ] Implement `updatePlayerPosition()`
- [ ] Implement `shouldReanchor()` logic
- [ ] Implement `reanchorWorld()` with tileset pair management
- [ ] Add connection distance calculation

---

### Step 4.2: Integrate WorldManager into WebGLMapPage

**File:** `src/pages/WebGLMapPage.tsx`

```typescript
// Add WorldManager ref
const worldManagerRef = useRef<WorldManager | null>(null);

// Initialize WorldManager
useEffect(() => {
    if (pipelineRef.current) {
        worldManagerRef.current = new WorldManager(
            pipelineRef.current,
            () => {
                // Callback when world is rebuilt
                rebuildTileInstances();
            }
        );
    }
}, []);

// In render loop, update world manager with player position
if (player && playerLoadedRef.current) {
    worldManagerRef.current?.updatePlayerPosition(player.tileX, player.tileY);
}
```

**Tasks:**
- [ ] Add `WorldManager` instance to WebGLMapPage
- [ ] Call `updatePlayerPosition` in render loop
- [ ] Handle world rebuild callback

---

## Phase 5: Boundary Visualization (Optional)

### Step 5.1: Track Tileset Boundaries

```typescript
type TilesetBoundary = {
    worldX: number;
    worldY: number;
    direction: 'horizontal' | 'vertical';
    fromPairIndex: number;
    toPairIndex: number;
};

function findTilesetBoundaries(world: StitchedWorldData): TilesetBoundary[] {
    const boundaries: TilesetBoundary[] = [];

    for (const map of world.maps) {
        const mapPairIndex = world.mapTilesetPairIndex.get(map.entry.id);

        for (const conn of map.entry.connections || []) {
            const neighborPairIndex = world.mapTilesetPairIndex.get(conn.map);

            if (neighborPairIndex !== undefined && neighborPairIndex !== mapPairIndex) {
                // This is a tileset boundary!
                boundaries.push({
                    worldX: /* calculate */,
                    worldY: /* calculate */,
                    direction: conn.direction === 'north' || conn.direction === 'south' ? 'horizontal' : 'vertical',
                    fromPairIndex: mapPairIndex!,
                    toPairIndex: neighborPairIndex,
                });
            }
        }
    }

    return boundaries;
}
```

**Tasks:**
- [ ] Implement boundary detection
- [ ] Optionally render boundary indicators in debug mode

---

## Phase 6: Animation Support for Multiple Tilesets

### Step 6.1: Update Animation System

**File:** `src/rendering/webgl/WebGLRenderPipeline.ts`

```typescript
// Track animations per tileset pair
private animationsPerPair: Map<number, LoadedAnimation[]> = new Map();

// Update animations for correct tileset pair
updateAnimations(gameFrame: number): void {
    for (const [pairIndex, animations] of this.animationsPerPair) {
        for (const anim of animations) {
            const frameIndex = Math.floor(gameFrame / anim.interval) % anim.sequence.length;
            const frame = anim.frames[anim.sequence[frameIndex]];

            // Upload to correct tileset texture (pair 0 or 1)
            this.updateAnimatedTiles(pairIndex, anim.destinations, frame);
        }
    }
}
```

**Tasks:**
- [ ] Track animations per tileset pair
- [ ] Update correct texture based on pair index
- [ ] Handle animation timing independently per pair

---

## Implementation Checklist

### Phase 1: Multi-Texture Foundation ✅ COMPLETE

#### Step 1.1: Extend TileInstance Data Structure
- [x] Add `tilesetPairIndex` field to TileInstance interface
- [x] Update vertex buffer packing (added bit 7 for tilesetPairIndex)
- [x] Update `buildTileInstances()` to include tileset pair index (defaults to 0)
- [ ] **TEST:** Verify existing rendering still works (no regression)

#### Step 1.2: Update Vertex Shader
- [x] Add `v_tilesetPairIndex` varying output
- [x] Extract `tilesetPairIndex` from flags (bit 7)
- [x] Pass to fragment shader
- [ ] **TEST:** Shader compiles without errors

#### Step 1.3: Update Fragment Shader
- [x] Add second set of tileset uniforms (`u_primaryTileset1`, `u_secondaryTileset1`, `u_palette1`)
- [x] Add `v_tilesetPairIndex` input
- [x] Add conditional sampling based on `v_tilesetPairIndex`
- [x] Handle transparency for both pairs
- [ ] **TEST:** Shader compiles without errors
- [ ] **TEST:** Rendering still works with pair index = 0

#### Step 1.4: Update WebGLRenderPipeline
- [x] Add pair 1 textures in WebGLTextureManager (`primaryTexture1`, `secondaryTexture1`, `paletteTexture1`)
- [x] Initialize pair 1 with 1x1 placeholder textures (prevent shader errors)
- [x] Update `bindTextures()` to bind all 6 texture units
- [x] Add uniform locations for second tileset pair in WebGLTileRenderer
- [x] Set uniform samplers for pair 1 (units 3, 4, 5)
- [ ] **TEST:** Can upload two tileset pairs without crash
- [ ] **TEST:** Both texture units are bound correctly

#### Phase 1 Integration Test
- [ ] Manually set some tiles to `tilesetPairIndex = 1`
- [ ] Verify tiles render from correct tileset
- [ ] Verify no visual artifacts at pair boundaries

---

### Phase 2: World Data Structures ✅ COMPLETE

#### Step 2.1: Create TilesetPairInfo Type
- [x] Define `TilesetPairInfo` type with all tileset data
- [x] Create `getTilesetPairId(primary, secondary)` helper
- [x] Create `loadTilesetPair()` async function
- [ ] **TEST:** Type compiles correctly

#### Step 2.2: Extend StitchedWorldData
- [x] Add `tilesetPairs: TilesetPairInfo[]` array
- [x] Add `mapTilesetPairIndex: Map<string, number>`
- [x] Add `borderMetatilesPerPair` map
- [x] Keep legacy fields referencing `tilesetPairs[0]` for backward compatibility
- [ ] **TEST:** Existing single-tileset loading still works

#### Step 2.3: Update loadStitchedWorld Function
- [x] Remove tileset-matching filter (allow different tilesets)
- [x] Track unique tileset pairs encountered
- [x] Limit to 2 tileset pairs maximum (MAX_TILESET_PAIRS)
- [x] Load tileset assets per unique pair via loadTilesetPair()
- [x] Build `mapTilesetPairIndex` mapping
- [ ] **TEST:** Loads maps with same tileset correctly
- [ ] **TEST:** Loads maps with 2 different tilesets
- [ ] **TEST:** Skips maps requiring 3rd tileset pair

#### Phase 2 Integration Test
- [ ] Load LittlerootTown (single tileset area)
- [ ] Verify `tilesetPairs.length === 1`
- [ ] Load area spanning 2 tilesets
- [ ] Verify `tilesetPairs.length === 2`
- [ ] Verify `mapTilesetPairIndex` is correct

---

### Phase 3: Tile Resolution with Tileset Selection ✅ COMPLETE

#### Step 3.1: Update Tile Resolver
- [x] Add `tilesetPairIndex` to `ResolvedTile` type (optional field)
- [x] Look up tileset pair index per map via mapTilesetPairIndex
- [x] Use correct metatiles/attributes from pair
- [x] Handle border tiles (use pair 0)
- [ ] **TEST:** Resolver returns correct pair index for each tile

#### Step 3.2: Update TileInstanceBuilder
- [x] Update `addMetatileLayer()` to accept tilesetPairIndex parameter
- [x] Pass `tilesetPairIndex` from resolved tile in all build methods
- [x] Vertex data now contains correct pair indices
- [ ] **TEST:** Vertex data contains correct pair indices

#### Phase 3 Integration Test
- [ ] Render area with 2 tileset pairs
- [ ] Verify tiles from each pair render correctly
- [ ] Walk player across tileset boundary
- [ ] Verify no visual glitches at boundary
- [ ] Verify collision still works

---

### Phase 4: Dynamic World Management ✅ COMPLETE

#### Step 4.1: Create WorldManager Class
- [x] Create `src/game/WorldManager.ts` file
- [x] Implement constructor with pipeline reference
- [x] Implement `findMapAtPosition(tileX, tileY)`
- [x] Implement `shouldReanchor()` logic
- [x] Implement `reanchorWorld()` method
- [x] Implement `updateTilesetPairs()` via events
- [x] **TEST:** Class instantiates without errors

#### Step 4.2: Integrate WorldManager into WebGLMapPage
- [x] Add `worldManagerRef` to component
- [x] Initialize WorldManager after pipeline ready
- [x] Call `updatePlayerPosition()` in render loop
- [x] Handle `onWorldRebuilt` callback via events (mapsChanged, tilesetsChanged, reanchored)
- [x] Rebuild tile instances on world change
- [x] **TEST:** WorldManager receives player position updates

#### Step 4.3: Re-anchoring Logic
- [x] Detect when player approaches world edge
- [x] Trigger re-anchor when needed
- [x] Preserve player world position during re-anchor
- [x] Update camera bounds after re-anchor
- [x] **TEST:** Re-anchor triggers when player walks far
- [x] **TEST:** Player position preserved after re-anchor
- [x] **TEST:** No visual jump during re-anchor

#### Phase 4 Integration Test
- [x] Start at LittlerootTown
- [x] Walk north through Route 101, Oldale, Route 102
- [x] Verify world re-anchors smoothly
- [x] Walk into different tileset area (Route 120 → Route 121)
- [x] Verify tileset pairs swap correctly
- [x] Walk back - verify seamless return

---

### Phase 5: Animation Support ✅ COMPLETE

#### Step 5.1: Multi-Tileset Animations
- [x] Track animations per tileset pair (WebGLAnimationManager updated)
- [x] Update correct texture based on pair index (uploadTilesetPair1)
- [x] Handle animation timing per pair (updateAnimationsForPair)
- [x] **TEST:** Water animates in tileset pair 0
- [x] **TEST:** Water animates in tileset pair 1
- [x] **TEST:** Both animate simultaneously at boundary

---

### Phase 6: Player Visual Effects ✅ COMPLETE

#### Step 6.1: Water Reflections
- [x] Implement `computeReflectionStateFromSnapshot()` for reflection detection
- [x] Match GBA scan behavior (tiles y+1 to y+height below player)
- [x] Implement pixel-perfect water masking using `ReflectionMeta.pixelMask`
- [x] Add `renderPlayerReflection()` with proper vertical flip and tint
- [x] Support bridge offsets (pondLow, pondMed, pondHigh)
- [x] **TEST:** Reflection appears on water tiles only
- [x] **TEST:** Reflection masked to water pixels (not land edges)

#### Step 6.2: Field Effect Masking
- [x] Add puddle splash masking (same as water ripple)
- [x] Create `createRenderContextFromSnapshot()` for field effect masking
- [x] Pass render context to `ObjectRenderer.renderFieldEffects()`
- [x] **TEST:** Puddle splashes masked to water pixels
- [x] **TEST:** Water ripples masked to water pixels

---

### Phase 7: Polish & Edge Cases ✅ COMPLETE

#### Step 7.1: Boundary Handling
- [x] Implement `findTilesetBoundaries()` function (via TilesetPairScheduler.getBoundaries())
- [x] Add debug visualization - boundaries shown in debug panel with count and positions
- [x] Handle player standing exactly on boundary - tile resolver uses per-map tileset pairs
- [x] **TEST:** Player can walk freely across boundaries

#### Step 7.2: Error Handling
- [x] Handle failed tileset loads gracefully - catch blocks in loadConnectedMaps, warning logs
- [x] Handle missing map connections - checked before loading, skipped if not found
- [x] Add fallback for 3+ tileset situations - MAX_TILESET_PAIRS_IN_MEMORY=16, caught and warned
- [x] **TEST:** Graceful degradation when tileset fails to load

#### Step 7.3: Performance Optimization
- [x] Profile frame time with 2 tileset pairs - FPS and render time displayed in stats panel
- [x] Optimize tile instance rebuilding - view hash caching, animation-only frames skip rebuild
- [x] Consider texture caching for frequently used pairs - TilesetPairScheduler LRU cache (MAX_CPU_CACHE=4)
- [x] **TEST:** Maintain 60 FPS with 2 tileset pairs

---

### Phase 8: Memory-Efficient Infinite Walking (NEW)

The current system supports 2 tileset pairs in GPU memory, but for truly infinite walking we need smart loading/unloading to handle any number of tileset transitions.

#### Architecture: Tileset Pair Lifecycle

```
Player Position → WorldManager → TilesetPairScheduler
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
              [Active Pair 0]    [Active Pair 1]    [Preload Queue]
              (current area)     (adjacent area)    (upcoming areas)
                    │                   │
                    └───────────────────┼───────────────────┐
                                        ▼                   ▼
                              [GPU Textures 0-2]    [GPU Textures 3-5]
```

#### Step 8.1: TilesetPairScheduler Class

**File:** `src/game/TilesetPairScheduler.ts` (new)

```typescript
interface ScheduledPair {
  id: string;                    // "General+Petalburg"
  priority: 'active' | 'adjacent' | 'preload';
  lastUsedFrame: number;
  gpuSlot: 0 | 1 | null;        // Which GPU slot (null = not loaded)
  data: TilesetPairInfo | null;  // Loaded data (null = not yet loaded)
}

class TilesetPairScheduler {
  private pairs: Map<string, ScheduledPair> = new Map();
  private loadQueue: string[] = [];
  private readonly MAX_CACHED_PAIRS = 4;  // Keep recent pairs in memory

  // Called when player moves - determines which pairs are needed
  updateNeededPairs(
    currentMapPairId: string,
    adjacentMapPairIds: string[],
    upcomingMapPairIds: string[]  // Based on player direction
  ): void;

  // Returns which pair IDs should be in GPU slots 0 and 1
  getActiveGpuPairs(): [string | null, string | null];

  // Async load/unload operations
  async ensurePairLoaded(pairId: string): Promise<TilesetPairInfo>;
  unloadLeastRecentPair(): void;
}
```

**Tasks:**
- [ ] Create `TilesetPairScheduler` class
- [ ] Implement LRU (Least Recently Used) tracking
- [ ] Implement `updateNeededPairs()` with priority assignment
- [ ] Implement `getActiveGpuPairs()` for GPU slot assignment
- [ ] **TEST:** Pairs are prioritized correctly based on player position

#### Step 8.2: Predictive Preloading

```typescript
// In WorldManager or TilesetPairScheduler
predictUpcomingTilesets(
  playerTileX: number,
  playerTileY: number,
  playerDirection: Direction,
  currentMapId: string
): string[] {
  const upcoming: string[] = [];

  // Check connections in player's facing direction
  const currentMap = this.getMap(currentMapId);
  for (const conn of currentMap.connections) {
    if (this.isInPlayerDirection(conn.direction, playerDirection)) {
      const connectedPairId = this.getTilesetPairId(conn.mapId);
      if (connectedPairId !== currentPairId) {
        upcoming.push(connectedPairId);
      }
    }
  }

  return upcoming;
}
```

**Tasks:**
- [ ] Implement `predictUpcomingTilesets()` based on player direction
- [ ] Start preloading ~2-3 tiles before boundary
- [ ] Cancel preloads if player changes direction
- [ ] **TEST:** Tileset preloaded before player reaches boundary

#### Step 8.3: GPU Slot Swapping Strategy

When player crosses into a new tileset region, we need to swap which pair is in slot 0 vs slot 1:

```typescript
// GPU Slot Assignment Rules:
// - Slot 0: Always the tileset pair the player is STANDING in
// - Slot 1: Adjacent tileset pair (or most recently used)
//
// When player crosses boundary:
// 1. New area's pair becomes slot 0
// 2. Old area's pair moves to slot 1
// 3. Any third pair is unloaded from GPU (but kept in CPU cache)

async swapGpuSlots(newPrimaryPairId: string): Promise<void> {
  const currentPrimary = this.getActiveGpuPairs()[0];

  if (currentPrimary === newPrimaryPairId) return;  // No swap needed

  // Load new pair if not already loaded
  const newPair = await this.ensurePairLoaded(newPrimaryPairId);

  // Determine what to keep in slot 1
  const slot1Pair = currentPrimary;  // Old primary becomes secondary

  // Upload to GPU
  this.pipeline.uploadTilesets(newPair, 0);      // New primary → slot 0
  if (slot1Pair) {
    this.pipeline.uploadTilesets(slot1Pair, 1);  // Old primary → slot 1
  }

  // Update all tiles' tilesetPairIndex
  this.rebuildTileInstances();
}
```

**Tasks:**
- [ ] Implement `swapGpuSlots()` method
- [ ] Track which pair is "primary" (player's current area)
- [ ] Minimize GPU uploads by reusing existing textures
- [ ] **TEST:** GPU swap happens smoothly when crossing boundary
- [ ] **TEST:** No visual glitch during swap

#### Step 8.4: Memory Eviction Policy

```typescript
// CPU Memory: LRU cache of TilesetPairInfo objects
// - Keep up to MAX_CACHED_PAIRS (4) pairs in RAM
// - Evict least recently used when limit exceeded
// - Re-load from disk if evicted pair needed again

// GPU Memory: Only 2 pairs at a time
// - Slot 0: Current area (always loaded)
// - Slot 1: Adjacent area (loaded if space)
// - Other pairs: Not in GPU, must swap before use

evictIfNeeded(): void {
  if (this.pairs.size <= this.MAX_CACHED_PAIRS) return;

  // Find least recently used pair that's not in GPU
  let oldest: ScheduledPair | null = null;
  for (const pair of this.pairs.values()) {
    if (pair.gpuSlot !== null) continue;  // Don't evict GPU-loaded pairs
    if (!oldest || pair.lastUsedFrame < oldest.lastUsedFrame) {
      oldest = pair;
    }
  }

  if (oldest) {
    oldest.data = null;  // Free CPU memory
    this.pairs.delete(oldest.id);
  }
}
```

**Tasks:**
- [ ] Implement LRU eviction for CPU cache
- [ ] Track `lastUsedFrame` for each pair
- [ ] Never evict GPU-loaded pairs from CPU cache
- [ ] **TEST:** Memory stays bounded during extended walking
- [ ] **TEST:** Evicted pairs can be reloaded when needed

#### Step 8.5: Seamless Transition Animation (Optional)

For extra polish, briefly show both tileset pairs during transition:

```typescript
// During the ~2 frames of a tileset swap:
// 1. Render current frame with old slot assignment
// 2. Upload new textures in background
// 3. Update tile instances
// 4. Render next frame with new slot assignment
//
// Player perceives no visual change because both pairs
// are in GPU during the transition frame.
```

**Tasks:**
- [ ] Defer tile instance rebuild to next frame
- [ ] Double-buffer slot assignments if needed
- [ ] **TEST:** No frame skip or visual pop during swap

#### Phase 8 Integration Test

- [ ] Start at LittlerootTown
- [ ] Walk all the way to Fortree City (crosses multiple tileset boundaries)
- [ ] Verify smooth transitions at each boundary
- [ ] Check memory usage stays bounded (< 100MB total)
- [ ] Walk back to Littleroot - verify cache hits work
- [ ] Walk in circles at a tileset boundary - verify no memory leak

---

## Final Testing Checklist

### Functional Tests
- [x] Single tileset area (Littleroot → Route 101 → Oldale) renders correctly
- [x] Two-tileset area renders correctly (Route 120 ↔ Route 121)
- [x] Both tileset pairs visible simultaneously at boundary
- [x] Player can walk seamlessly across tileset boundaries
- [x] Player collision works across tileset boundaries
- [x] Re-anchoring happens smoothly when player moves far
- [x] Returning to previously visited areas works
- [x] Border tiles render correctly for each tileset pair
- [x] Animations work for both tileset pairs simultaneously

### Visual Tests
- [x] No seams or gaps at map boundaries
- [x] No seams or gaps at tileset boundaries
- [x] Correct palettes applied to each region
- [x] No flickering during re-anchor
- [x] No texture corruption

### Performance Tests
- [x] Frame time < 16ms (60 FPS) in single-tileset area
- [x] Frame time < 16ms (60 FPS) in two-tileset area
- [ ] Re-anchor completes in < 200ms
- [ ] Memory usage < 64MB for textures
- [ ] No memory leaks during extended play

### Edge Case Tests
- [x] Player at exact tileset boundary coordinates
- [ ] Rapid movement across multiple boundaries
- [ ] Map with no connections
- [ ] Map at world edge (no neighbors in one direction)
- [ ] Very large stitched world (10+ maps)

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Frame time | < 16ms (60 FPS) |
| Tileset pair switch | < 50ms |
| World re-anchor | < 200ms |
| Memory (textures) | < 64MB |
| Max loaded maps | ~20 maps |

---

## Rollback Plan

If multi-tileset rendering causes issues:
1. Disable tileset pair 1 in shader (always use pair 0)
2. Revert to current same-tileset-only stitching
3. Use fade transition for tileset boundaries

The system should gracefully degrade to single-tileset mode.
