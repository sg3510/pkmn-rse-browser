import type { WorldState } from '../services/MapManager';
import type { CardinalDirection } from '../utils/metatileBehaviors';

export interface Position {
  x: number;
  y: number;
  tileX: number;
  tileY: number;
}

export type DoorSequenceStage =
  | 'idle'
  | 'opening'
  | 'stepping'
  | 'closing'
  | 'waitingBeforeFade'
  | 'fadingOut'
  | 'warping'
  | 'done';

export interface DoorSequenceState {
  type: 'entry' | 'exit';
  stage: DoorSequenceStage;
  doorWorldX: number;
  doorWorldY: number;
  metatileId: number;
  isAnimatedDoor: boolean;
  animationStartTime: number;
  targetTileX?: number;
  targetTileY?: number;
  entryDirection?: CardinalDirection;
}

export interface FadeState {
  mode: 'in' | 'out' | null;
  startedAt: number;
  duration: number;
}

export interface WarpTriggerState {
  kind: 'door' | 'arrow' | 'teleport';
  mapId: string;
  warpId?: number;
  facing?: CardinalDirection;
}

export interface GameState {
  // World
  world: WorldState | null;
  anchorMapId: string | null;

  // Camera
  cameraX: number;
  cameraY: number;

  // Animation timing
  animationFrame: number;
  animationTime: number;

  // Player
  playerTileX: number;
  playerTileY: number;
  playerElevation: number;
  playerDirection: CardinalDirection;
  playerMoving: boolean;

  // Active sequences
  doorSequence: DoorSequenceState | null;
  fadeState: FadeState | null;
  warpPending: WarpTriggerState | null;

  // Render flags
  needsRender: boolean;
  viewChanged: boolean;
  elevationChanged: boolean;
}

export type StateListener = (state: GameState, changes: Partial<GameState>) => void;

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
    playerElevation: 3,
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
 * Observable wrapper around the game state so React can subscribe to changes.
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
