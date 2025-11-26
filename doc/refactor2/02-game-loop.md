# Refactor 2.2: Extract Game Loop and State

## Current State

MapRenderer.tsx contains a massive `useEffect` game loop (lines ~2500-3200) that:
- Updates animation timers
- Handles player input
- Updates player movement
- Manages door sequences
- Handles warp transitions
- Updates NPC states
- Triggers re-renders

This tightly couples game logic with React rendering.

---

## Target Architecture

```
src/engine/
├── GameLoop.ts          # Main loop timing and orchestration (~150 lines)
├── GameState.ts         # Central state container (~100 lines)
├── AnimationTimer.ts    # Tileset animation frame tracking (~80 lines)
└── UpdateCoordinator.ts # Coordinates all update systems (~100 lines)
```

---

## Design: Pure Game Engine

The game engine should be **React-free**. React only:
1. Creates the engine
2. Receives state updates
3. Renders to canvas

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   React Hook    │────▶│  GameLoop    │────▶│  Rendering  │
│  (useGameLoop)  │     │ (pure TS)    │     │ (Canvas)    │
└─────────────────┘     └──────────────┘     └─────────────┘
         │                     │
         │                     ▼
         │              ┌──────────────┐
         │              │  GameState   │
         │              │ (observable) │
         └──────────────┴──────────────┘
```

---

## New Module: `GameLoop.ts`

```typescript
/**
 * GameLoop - Main game loop with fixed timestep updates
 *
 * Follows pokeemerald's structure:
 * - CB2_Overworld (main callback)
 * - Updates run at 60fps
 * - Rendering decoupled from updates
 *
 * Reference: pokeemerald/src/overworld.c CB2_Overworld()
 */
export class GameLoop {
  private state: GameState;
  private updateCoordinator: UpdateCoordinator;
  private animationTimer: AnimationTimer;

  private running = false;
  private lastTime = 0;
  private accumulator = 0;

  // GBA runs at ~59.73 fps, we use 60 for simplicity
  private readonly FRAME_MS = 1000 / 60;

  constructor(initialState: GameState) {
    this.state = initialState;
    this.animationTimer = new AnimationTimer();
    this.updateCoordinator = new UpdateCoordinator(this.state);
  }

  /**
   * Start the game loop
   */
  start(onFrame: (state: GameState, deltaMs: number) => void): void {
    this.running = true;
    this.lastTime = performance.now();

    const tick = (currentTime: number) => {
      if (!this.running) return;

      const deltaMs = currentTime - this.lastTime;
      this.lastTime = currentTime;
      this.accumulator += deltaMs;

      // Fixed timestep updates
      while (this.accumulator >= this.FRAME_MS) {
        this.update(this.FRAME_MS);
        this.accumulator -= this.FRAME_MS;
      }

      // Notify for rendering (may interpolate)
      onFrame(this.state, deltaMs);

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
  }

  /**
   * Single frame update
   */
  private update(deltaMs: number): void {
    // Update animation frame counter (for tileset animations)
    this.animationTimer.update(deltaMs);
    this.state.animationFrame = this.animationTimer.getCurrentFrame();

    // Update all game systems
    this.updateCoordinator.update(deltaMs);
  }

  getState(): GameState {
    return this.state;
  }
}
```

---

## New Module: `GameState.ts`

Central state container. Observable for React integration.

```typescript
/**
 * GameState - Central game state container
 *
 * This is the single source of truth for:
 * - World/map data
 * - Player state
 * - Animation state
 * - Active sequences (doors, warps, fades)
 *
 * Design: Immutable updates with change notifications
 */
export interface GameState {
  // World
  world: WorldState;
  anchorMapId: string;

  // Camera
  cameraX: number;
  cameraY: number;

  // Animation
  animationFrame: number;
  animationTime: number;

  // Player
  playerTileX: number;
  playerTileY: number;
  playerElevation: number;
  playerDirection: Direction;
  playerMoving: boolean;

  // Active sequences
  doorSequence: DoorSequenceState | null;
  fadeState: FadeState | null;
  warpPending: WarpTrigger | null;

  // Render flags
  needsRender: boolean;
  viewChanged: boolean;
  elevationChanged: boolean;
}

/**
 * Create initial game state
 */
export function createInitialState(world: WorldState, playerPos: Position): GameState {
  return {
    world,
    anchorMapId: world.anchorId,
    cameraX: playerPos.x,
    cameraY: playerPos.y,
    animationFrame: 0,
    animationTime: 0,
    playerTileX: playerPos.tileX,
    playerTileY: playerPos.tileY,
    playerElevation: 3, // Default elevation
    playerDirection: 'down',
    playerMoving: false,
    doorSequence: null,
    fadeState: null,
    warpPending: null,
    needsRender: true,
    viewChanged: true,
    elevationChanged: false,
  };
}

/**
 * State change listener type
 */
export type StateListener = (state: GameState, changes: Partial<GameState>) => void;

/**
 * Observable wrapper for state
 */
export class ObservableState {
  private state: GameState;
  private listeners: Set<StateListener> = new Set();

  constructor(initial: GameState) {
    this.state = initial;
  }

  get(): GameState {
    return this.state;
  }

  update(changes: Partial<GameState>): void {
    this.state = { ...this.state, ...changes };
    this.notify(changes);
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(changes: Partial<GameState>): void {
    for (const listener of this.listeners) {
      listener(this.state, changes);
    }
  }
}
```

---

## New Module: `AnimationTimer.ts`

Handles tileset animation timing.

```typescript
/**
 * AnimationTimer - Manages tileset animation frame timing
 *
 * pokeemerald tileset animations run at different speeds:
 * - Water: 16 frames @ 10 ticks each (160 ticks = 2.67s)
 * - Flowers: 4 frames @ 8 ticks each (32 ticks = 0.53s)
 *
 * This timer provides a global frame counter that
 * individual animations index into with their own periods.
 *
 * Reference: pokeemerald/src/tileset_anims.c
 */
export class AnimationTimer {
  private elapsed = 0;
  private currentFrame = 0;

  // GBA tick = 1/60 second = 16.67ms
  private readonly TICK_MS = 1000 / 60;

  // Frame period in ticks (most common period)
  private readonly FRAME_TICKS = 10;
  private readonly FRAME_MS = this.TICK_MS * this.FRAME_TICKS;

  /**
   * Update timer with elapsed milliseconds
   */
  update(deltaMs: number): void {
    this.elapsed += deltaMs;

    // Increment frame when enough time has passed
    while (this.elapsed >= this.FRAME_MS) {
      this.elapsed -= this.FRAME_MS;
      this.currentFrame++;
    }
  }

  /**
   * Get current animation frame index
   */
  getCurrentFrame(): number {
    return this.currentFrame;
  }

  /**
   * Get frame for specific animation period
   */
  getFrameForPeriod(periodTicks: number, frameCount: number): number {
    const periodMs = periodTicks * this.TICK_MS;
    const cyclePosition = (this.currentFrame * this.FRAME_MS) % (periodMs * frameCount);
    return Math.floor(cyclePosition / periodMs);
  }

  reset(): void {
    this.elapsed = 0;
    this.currentFrame = 0;
  }
}
```

---

## New Module: `UpdateCoordinator.ts`

Coordinates all game system updates.

```typescript
/**
 * UpdateCoordinator - Runs all game system updates in correct order
 *
 * Update order matches pokeemerald:
 * 1. Input processing
 * 2. Player movement
 * 3. Object events (NPCs)
 * 4. Field effects
 * 5. Sequences (doors, warps)
 * 6. Camera
 *
 * Reference: pokeemerald/src/overworld.c RunOverworldTasks()
 */
export class UpdateCoordinator {
  private state: GameState;
  private playerController: PlayerController;
  private objectEventManager: ObjectEventManager;
  private fieldEffectManager: FieldEffectManager;
  private doorSequencer: DoorSequencer;
  private warpHandler: WarpHandler;

  constructor(state: GameState) {
    this.state = state;
    // Initialize systems...
  }

  update(deltaMs: number): void {
    // 1. Update player movement
    this.playerController.update(deltaMs);

    // 2. Update object events
    this.objectEventManager.update(deltaMs);

    // 3. Update field effects (grass, sand, water)
    this.fieldEffectManager.update(deltaMs);
    this.fieldEffectManager.cleanup(this.getOwnerPositions());

    // 4. Update active sequences
    if (this.state.doorSequence) {
      this.doorSequencer.update(deltaMs);
    }

    // 5. Check for warp triggers
    this.warpHandler.checkTrigger();

    // 6. Update camera to follow player
    this.updateCamera();

    // 7. Mark render flags
    this.updateRenderFlags();
  }

  private updateCamera(): void {
    const player = this.playerController;
    const targetX = player.x;
    const targetY = player.y;

    // Smooth camera follow (optional)
    this.state.cameraX = targetX;
    this.state.cameraY = targetY;
  }

  private updateRenderFlags(): void {
    const prevElev = this.state.playerElevation;
    const currElev = this.playerController.getElevation();

    this.state.elevationChanged = prevElev !== currElev;
    this.state.playerElevation = currElev;
    this.state.needsRender = true;
  }
}
```

---

## React Integration: `useGameLoop.ts`

```typescript
/**
 * useGameLoop - React hook to run the game loop
 *
 * This is a thin wrapper that:
 * 1. Creates the game loop on mount
 * 2. Provides state to React via useState
 * 3. Handles cleanup on unmount
 */
export function useGameLoop(
  world: WorldState,
  canvasRef: React.RefObject<HTMLCanvasElement>
): {
  state: GameState;
  isRunning: boolean;
} {
  const [state, setState] = useState<GameState | null>(null);
  const gameLoopRef = useRef<GameLoop | null>(null);

  useEffect(() => {
    if (!world) return;

    const initialState = createInitialState(world, getPlayerSpawnPosition(world));
    const loop = new GameLoop(initialState);
    gameLoopRef.current = loop;

    loop.start((newState) => {
      setState(newState);
    });

    return () => {
      loop.stop();
      gameLoopRef.current = null;
    };
  }, [world]);

  return {
    state: state ?? createInitialState(world, { x: 0, y: 0, tileX: 0, tileY: 0 }),
    isRunning: !!gameLoopRef.current,
  };
}
```

---

## Migration Steps

1. **Create engine modules** in `src/engine/`
2. **Extract timing logic** from MapRenderer useEffect
3. **Extract state management** into GameState
4. **Create UpdateCoordinator** with existing update logic
5. **Create useGameLoop** hook
6. **Replace MapRenderer loop** with useGameLoop
7. **Test** - game should play identically

---

## Benefits

- **Testable**: GameLoop and GameState can be unit tested without DOM
- **Debuggable**: Clear state transitions, easy to add logging
- **Portable**: Engine could run on server for replay verification
- **Maintainable**: Each system is isolated and focused
