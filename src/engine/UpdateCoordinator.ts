import type { GameState } from './GameState';
import type { ObservableState } from './GameState';

export interface UpdateContext {
  deltaMs: number;
  timestamp: number;
  state: ObservableState;
}

export interface UpdateResult {
  needsRender?: boolean;
  viewChanged?: boolean;
  elevationChanged?: boolean;
  animationFrameChanged?: boolean;
  playerDirty?: boolean;
}

export interface UpdateCoordinatorHooks {
  beforeUpdate?: (ctx: UpdateContext) => void;
  update?: (ctx: UpdateContext) => UpdateResult | void;
  afterUpdate?: (ctx: UpdateContext, result: UpdateResult) => void;
}

/**
 * UpdateCoordinator - orchestrates per-frame updates across subsystems.
 *
 * This class is intentionally lightweight and delegates real work to the
 * injected hooks so we can reuse existing systems while moving logic out of
 * React components.
 */
export class UpdateCoordinator {
  private hooks: UpdateCoordinatorHooks;
  private state: ObservableState;

  constructor(state: ObservableState, hooks: UpdateCoordinatorHooks = {}) {
    this.state = state;
    this.hooks = hooks;
  }

  update(deltaMs: number, timestamp: number): UpdateResult {
    const ctx: UpdateContext = { deltaMs, timestamp, state: this.state };
    this.hooks.beforeUpdate?.(ctx);
    const result = this.hooks.update?.(ctx) ?? {};

    const normalized: UpdateResult = {
      needsRender: result.needsRender ?? false,
      viewChanged: result.viewChanged ?? false,
      elevationChanged: result.elevationChanged ?? false,
      animationFrameChanged: result.animationFrameChanged ?? false,
      playerDirty: result.playerDirty ?? false,
    };

    const next: Partial<GameState> = {};
    if (typeof normalized.needsRender === 'boolean') {
      next.needsRender = normalized.needsRender;
    }
    if (typeof normalized.viewChanged === 'boolean') {
      next.viewChanged = normalized.viewChanged;
    }
    if (typeof normalized.elevationChanged === 'boolean') {
      next.elevationChanged = normalized.elevationChanged;
    }

    if (Object.keys(next).length > 0) {
      this.state.update(next);
    }

    this.hooks.afterUpdate?.(ctx, normalized);
    return normalized;
  }
}
