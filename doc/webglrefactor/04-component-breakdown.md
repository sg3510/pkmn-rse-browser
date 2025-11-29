# Detailed Component Breakdown

## New Files to Create

### Core Game Logic

#### `src/game/CameraController.ts` (~100 lines)
```typescript
export class CameraController {
  private x: number = 0;
  private y: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;

  followPlayer(player: PlayerController, worldBounds: WorldBounds): void;
  getView(viewport: ViewportConfig): WorldCameraView;
  adjustOffset(dx: number, dy: number): void;  // For re-anchoring
  setPosition(x: number, y: number): void;
}
```

#### `src/game/TileResolverFactory.ts` (~200 lines)
```typescript
export class TileResolverFactory {
  // WebGL path: uses WorldSnapshot with multi-tileset support
  static fromSnapshot(snapshot: WorldSnapshot): TileResolverFn {
    // Handles:
    // - Multi-map resolution
    // - GPU slot mapping
    // - Border tile fallback
  }

  // Canvas2D path: uses RenderContext
  static fromRenderContext(ctx: RenderContext): TileResolverFn;

  // Player-specific resolver (both paths)
  static createPlayerResolver(
    source: WorldSnapshot | RenderContext
  ): PlayerTileResolver;
}
```

#### `src/game/WarpExecutor.ts` (~250 lines)
```typescript
interface WarpExecutorConfig {
  worldProvider: IWorldProvider;
  player: PlayerController;
  pipeline: IRenderPipeline;
  doorSequencer: DoorSequencer;
  fadeController: FadeController;
  tileResolverFactory: typeof TileResolverFactory;
}

export class WarpExecutor {
  constructor(config: WarpExecutorConfig);

  async execute(trigger: WarpTrigger, options?: WarpOptions): Promise<void>;

  // Steps (currently in performWarp):
  private async initializeDestination(mapId: string): Promise<IWorldState>;
  private updateResolvers(worldState: IWorldState): void;
  private findSpawnPosition(map: LoadedMapInstance, warpId: number): Position;
  private determineFacing(trigger: WarpTrigger, destBehavior: number): Direction;
  private handleDoorSequence(options: WarpOptions, destBehavior: number): void;
}
```

#### `src/game/types.ts` (~80 lines)
```typescript
// Unified world state interface
export interface IWorldState {
  maps: LoadedMapInstance[];
  anchorMapId: string;
  worldBounds: WorldBounds;
  tilesetPairs: TilesetPairInfo[];

  // Queries
  getTileAt(x: number, y: number): ResolvedTile | null;
  findMapAtPosition(x: number, y: number): LoadedMapInstance | null;

  // Events
  on(event: WorldStateEvent, handler: Function): () => void;
}

export interface IWorldProvider {
  initialize(mapId: string): Promise<IWorldState>;
  update(playerX: number, playerY: number, direction?: Direction): Promise<void>;
  getSnapshot(): IWorldState;
  dispose(): void;
}
```

### React Components

#### `src/components/debug/TileDebugPanel.tsx` (~60 lines)
```typescript
interface TileDebugPanelProps {
  tile: DebugTileInfo | null;
}

export function TileDebugPanel({ tile }: TileDebugPanelProps) {
  if (!tile) return null;

  return (
    <div className="debug-panel tile-debug">
      <div className="debug-panel__header">Tile Debug</div>
      <div>Position: ({tile.tileX}, {tile.tileY})</div>
      <div>Metatile: {tile.metatileId}</div>
      {/* ... */}
    </div>
  );
}
```

#### `src/components/debug/MapStitchingDebugPanel.tsx` (~80 lines)
```typescript
interface MapStitchingDebugPanelProps {
  info: MapDebugInfo | null;
}

export function MapStitchingDebugPanel({ info }: Props) {
  // GPU slots, loaded maps, connections, boundaries
}
```

#### `src/components/debug/WarpDebugPanel.tsx` (~50 lines)
```typescript
interface WarpDebugPanelProps {
  info: WarpDebugInfo | null;
}

export function WarpDebugPanel({ info }: Props) {
  // Last warp, anchor, snapshot maps, tileset pairs
}
```

#### `src/components/game/GameContainer.tsx` (~400 lines)
```typescript
interface GameContainerProps {
  mapId: string;
  renderer: 'webgl' | 'canvas2d';
  viewport?: ViewportConfig;
  onMapChange?: (mapId: string) => void;
  children?: (state: GameState) => React.ReactNode;
}

export function GameContainer({
  mapId,
  renderer,
  viewport = DEFAULT_VIEWPORT,
  children,
}: GameContainerProps) {
  // Initialize pipeline based on renderer type
  // Set up world provider (WorldManager for WebGL, MapManager for Canvas2D)
  // Run unified game loop
  // Render scene
  // Expose state to children for debug panels
}
```

### Hooks

#### `src/hooks/useUnifiedGameLoop.ts` (~300 lines)
```typescript
interface UseUnifiedGameLoopConfig {
  pipeline: IRenderPipeline;
  player: PlayerController;
  camera: CameraController;
  worldState: IWorldState;
  viewport: ViewportConfig;
  doorSequencer: DoorSequencer;
  warpHandler: WarpHandler;
  fadeController: FadeController;
  fieldSprites: FieldSprites;
}

export function useUnifiedGameLoop(config: UseUnifiedGameLoopConfig) {
  // GBA-accurate timing
  // Player update
  // World manager update
  // Warp detection
  // Door sequence handling
  // Scene rendering

  return {
    start: () => void,
    stop: () => void,
    isRunning: boolean,
  };
}
```

#### `src/hooks/useWorldProvider.ts` (~150 lines)
```typescript
interface UseWorldProviderConfig {
  mapId: string;
  mode: 'webgl' | 'canvas2d';
}

export function useWorldProvider(config: UseWorldProviderConfig) {
  // Creates appropriate world provider
  // WebGL: WorldManager (dynamic loading)
  // Canvas2D: MapManager (static loading)

  return {
    worldState: IWorldState | null,
    loading: boolean,
    error: string | null,
    refresh: (mapId: string) => Promise<void>,
  };
}
```

---

## Files to Modify

### `WebGLMapPage.tsx`

**Remove:**
- Inline tile resolver creation (~170 lines)
- Inline camera logic (~40 lines)
- Inline game loop (~500 lines)
- `performWarp` callback (~190 lines)
- Debug panel JSX (~150 lines)

**Keep:**
- Map selector UI
- WebGL-specific pipeline setup
- Integration with GameContainer

**Final structure:**
```tsx
export function WebGLMapPage() {
  const [selectedMapId, setSelectedMapId] = useState(defaultMap.id);

  return (
    <div className="webgl-map-page">
      <MapSelector
        maps={renderableMaps}
        selectedId={selectedMapId}
        onChange={setSelectedMapId}
      />

      <GameContainer
        mapId={selectedMapId}
        renderer="webgl"
        viewport={VIEWPORT_CONFIG}
      >
        {({ debugInfo }) => (
          <div className="debug-panels">
            <TileDebugPanel tile={debugInfo.tile} />
            <MapStitchingDebugPanel info={debugInfo.map} />
            <WarpDebugPanel info={debugInfo.warp} />
          </div>
        )}
      </GameContainer>
    </div>
  );
}
```

### `MapRenderer.tsx`

**Remove:**
- `useRunUpdate` usage (replaced by `useUnifiedGameLoop`)
- `useWarpExecution` usage (replaced by `WarpExecutor`)
- Manual pipeline setup

**Keep:**
- `forwardRef` and handle interface
- `DebugPanel` integration
- `DialogBox` integration

**Final structure:**
```tsx
export const MapRenderer = forwardRef<MapRendererHandle, MapRendererProps>((props, ref) => {
  // Expose save/load via ref (unchanged)

  return (
    <GameContainer
      mapId={props.mapId}
      renderer="canvas2d"
      viewport={VIEWPORT_CONFIG}
    >
      {({ player }) => (
        <>
          <DialogBox ... />
          <DebugPanel ... />
        </>
      )}
    </GameContainer>
  );
});
```

---

## Dependency Graph

```
GameContainer
├── useWorldProvider
│   ├── WorldManager (webgl)
│   └── MapManager (canvas2d)
├── useUnifiedGameLoop
│   ├── CameraController
│   ├── TileResolverFactory
│   └── WarpExecutor
│       └── DoorSequencer
├── IRenderPipeline
│   ├── WebGLRenderPipeline
│   └── Canvas2DRenderPipeline
└── Debug Panels
    ├── TileDebugPanel
    ├── MapStitchingDebugPanel
    └── WarpDebugPanel
```

---

## Line Count Summary

| Category | New Lines | Lines Removed | Net |
|----------|-----------|---------------|-----|
| Core Game | ~630 | - | +630 |
| Debug Components | ~190 | ~150 | +40 |
| Hooks | ~450 | ~500 | -50 |
| GameContainer | ~400 | - | +400 |
| WebGLMapPage | - | ~1050 | -1050 |
| MapRenderer | - | ~100 | -100 |
| **Total** | ~1670 | ~1800 | **-130** |

Net result: Slight reduction in total lines, massive improvement in organization.
