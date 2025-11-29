# Proposed Shared Abstractions

## 1. Unified World State Interface

```typescript
// src/game/types.ts

/**
 * Renderer-agnostic world state
 * Both WorldManager and MapManager produce this
 */
interface IWorldState {
  maps: LoadedMapInstance[];
  anchorMapId: string;
  worldBounds: WorldBounds;

  // Tile resolution
  getTileAt(worldX: number, worldY: number): ResolvedTile | null;
  getAttributesAt(worldX: number, worldY: number): MetatileAttributes | null;

  // Map queries
  findMapAtPosition(x: number, y: number): LoadedMapInstance | null;

  // Events
  on(event: 'mapsChanged' | 'tilesetsChanged', handler: Function): () => void;
}
```

## 2. Unified Game Engine

```typescript
// src/game/GameEngine.ts

interface GameEngineConfig {
  pipeline: IRenderPipeline;
  worldProvider: IWorldProvider;  // WorldManager or MapManager
  viewport: ViewportConfig;
}

class GameEngine {
  private player: PlayerController;
  private camera: CameraController;
  private warpHandler: WarpHandler;
  private fadeController: FadeController;

  // Subsystems
  private doorSequencer: DoorSequencer;
  private fieldEffects: FieldEffectManager;

  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;

  // Warp API
  async warpTo(mapId: string, x: number, y: number): Promise<void>;
}
```

## 3. Tile Resolver Factory

```typescript
// src/game/TileResolverFactory.ts

/**
 * Creates tile resolvers from different data sources
 */
class TileResolverFactory {
  // For WebGL with WorldSnapshot
  static fromSnapshot(snapshot: WorldSnapshot): TileResolverFn;

  // For Canvas2D with RenderContext
  static fromRenderContext(ctx: RenderContext): TileResolverFn;

  // Unified player resolver
  static createPlayerResolver(source: WorldSnapshot | RenderContext): PlayerTileResolver;
}
```

## 4. Camera Controller

```typescript
// src/game/CameraController.ts

/**
 * Handles camera positioning and smoothing
 * Extracted from inline code in both renderers
 */
class CameraController {
  private x: number = 0;
  private y: number = 0;

  followPlayer(player: PlayerController, worldBounds: WorldBounds): void;
  getView(viewport: ViewportConfig): WorldCameraView;

  // For world re-anchoring
  adjustOffset(dx: number, dy: number): void;
}
```

## 5. Unified Warp Executor

```typescript
// src/game/WarpExecutor.ts

/**
 * Handles warp execution for both renderers
 * Currently duplicated between performWarp (WebGL) and useWarpExecution (Canvas2D)
 */
class WarpExecutor {
  constructor(
    private worldProvider: IWorldProvider,
    private player: PlayerController,
    private pipeline: IRenderPipeline,
    private doorSequencer: DoorSequencer
  );

  async executeWarp(trigger: WarpTrigger, options?: WarpOptions): Promise<void>;

  // Internal steps
  private async loadDestinationWorld(mapId: string): Promise<IWorldState>;
  private findSpawnPosition(destMap: LoadedMapInstance, warpId: number): Position;
  private determineFacing(trigger: WarpTrigger, destBehavior: number): Direction;
}
```

## 6. Scene Compositor Interface

```typescript
// src/rendering/ISceneCompositor.ts

/**
 * Handles scene compositing for both renderers
 */
interface ISceneCompositor {
  // Layer rendering
  renderBackground(ctx: CanvasRenderingContext2D, view: WorldCameraView): void;
  renderTopBelow(ctx: CanvasRenderingContext2D, view: WorldCameraView): void;
  renderTopAbove(ctx: CanvasRenderingContext2D, view: WorldCameraView): void;

  // Sprite layer (between topBelow and topAbove)
  renderSprites(
    ctx: CanvasRenderingContext2D,
    view: WorldCameraView,
    sprites: Renderable[]
  ): void;

  // Effects
  renderFade(ctx: CanvasRenderingContext2D, fade: FadeState): void;
}
```

## 7. Unified Hook: useGameEngine

```typescript
// src/hooks/useGameEngine.ts

interface UseGameEngineOptions {
  mapId: string;
  renderer: 'webgl' | 'canvas2d';
  viewport?: ViewportConfig;
}

function useGameEngine(options: UseGameEngineOptions) {
  // Returns unified interface for both renderers
  return {
    canvasRef,
    player,
    loading,
    error,

    // Debug
    debugInfo,

    // Controls
    setMap: (mapId: string) => void,
  };
}
```

## Migration Path

### Phase 1: Extract Shared Types
- Create `IWorldState` interface
- Both WorldManager and MapManager implement it

### Phase 2: Create TileResolverFactory
- Unify tile resolution patterns
- Single source of truth for tile data access

### Phase 3: Extract CameraController
- Remove inline camera logic from both files
- Shared camera positioning

### Phase 4: Unify WarpExecutor
- Merge `performWarp` and `useWarpExecution`
- Single warp implementation

### Phase 5: Create GameEngine
- Orchestrates all subsystems
- Both pages just configure and render
