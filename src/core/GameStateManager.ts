/**
 * Game State Manager
 *
 * Central state machine that manages game state transitions.
 * Follows GBA's SetMainCallback2 pattern - only one state active at a time.
 */

import {
  GameState,
  type StateRenderer,
  type StateRegistry,
  type StateTransition,
  type InputState,
  type RenderContext,
} from './GameState';
import { DEFAULT_VIEWPORT_CONFIG, getViewportPixelSize, type ViewportConfig } from '../config/viewport';

export interface GameStateManagerConfig {
  /** Initial state to boot into */
  initialState: GameState;
  /** Viewport configuration */
  viewport?: ViewportConfig;
  /** Callback when state changes */
  onStateChange?: (from: GameState | null, to: GameState) => void;
}

export class GameStateManager {
  private registry: StateRegistry = new Map();
  private currentState: StateRenderer | null = null;
  private currentStateId: GameState | null = null;
  private pendingTransition: StateTransition | null = null;
  private isTransitioning = false;
  private viewport: ViewportConfig;
  private onStateChange?: (from: GameState | null, to: GameState) => void;

  // Input tracking
  private keysPressed = new Set<string>();
  private keysHeld = new Set<string>();
  private keysReleased = new Set<string>();
  private keyDownHandler: (e: KeyboardEvent) => void;
  private keyUpHandler: (e: KeyboardEvent) => void;

  constructor(config: GameStateManagerConfig) {
    this.viewport = config.viewport ?? DEFAULT_VIEWPORT_CONFIG;
    this.onStateChange = config.onStateChange;

    // Set up input handlers
    this.keyDownHandler = (e: KeyboardEvent) => {
      if (!this.keysHeld.has(e.code)) {
        this.keysPressed.add(e.code);
      }
      this.keysHeld.add(e.code);
    };

    this.keyUpHandler = (e: KeyboardEvent) => {
      this.keysHeld.delete(e.code);
      this.keysReleased.add(e.code);
    };

    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
  }

  /**
   * Register a state factory
   */
  registerState(state: GameState, factory: () => StateRenderer): void {
    this.registry.set(state, factory);
  }

  /**
   * Initialize and enter the initial state
   */
  async initialize(initialState: GameState, data?: Record<string, unknown>): Promise<void> {
    await this.transitionTo(initialState, data);
  }

  /**
   * Get current state ID
   */
  getCurrentState(): GameState | null {
    return this.currentStateId;
  }

  /**
   * Request a state transition
   */
  async transitionTo(state: GameState, data?: Record<string, unknown>): Promise<void> {
    if (this.isTransitioning) {
      console.warn('[GameStateManager] Transition already in progress, queueing:', state);
      this.pendingTransition = { to: state, data };
      return;
    }

    const factory = this.registry.get(state);
    if (!factory) {
      console.error('[GameStateManager] No factory registered for state:', state);
      return;
    }

    this.isTransitioning = true;
    const previousState = this.currentStateId;

    try {
      // Exit current state
      if (this.currentState) {
        console.log('[GameStateManager] Exiting state:', this.currentStateId);
        await this.currentState.exit();
      }

      // Create and enter new state
      console.log('[GameStateManager] Entering state:', state);
      const newState = factory();
      await newState.enter(this.viewport, data);

      this.currentState = newState;
      this.currentStateId = state;

      // Notify listener
      this.onStateChange?.(previousState, state);
    } catch (err) {
      console.error('[GameStateManager] Error during transition:', err);
    } finally {
      this.isTransitioning = false;
    }

    // Process any pending transition
    if (this.pendingTransition) {
      const pending = this.pendingTransition;
      this.pendingTransition = null;
      await this.transitionTo(pending.to, pending.data);
    }
  }

  /**
   * Update current state (logic tick)
   */
  update(dt: number, frameCount: number): void {
    if (!this.currentState || this.isTransitioning) return;

    // Build input state
    const input: InputState = {
      pressed: new Set(this.keysPressed),
      held: new Set(this.keysHeld),
      released: new Set(this.keysReleased),
    };

    // Clear frame-specific input
    this.keysPressed.clear();
    this.keysReleased.clear();

    // Let state handle input
    const transition = this.currentState.handleInput(input);
    if (transition) {
      void this.transitionTo(transition.to, transition.data);
      return; // Don't update if transitioning
    }

    // Update state logic
    this.currentState.update(dt, frameCount);
  }

  /**
   * Render current state
   */
  render(ctx2d: CanvasRenderingContext2D): void {
    if (!this.currentState) return;

    const pixelSize = getViewportPixelSize(this.viewport);
    const context: RenderContext = {
      ctx2d,
      viewport: pixelSize,
      viewportConfig: this.viewport,
    };

    this.currentState.render(context);
  }

  /**
   * Update viewport configuration and notify current state
   */
  setViewport(viewport: ViewportConfig): void {
    this.viewport = viewport;
    // Notify current state if it implements onViewportChange
    if (this.currentState?.onViewportChange) {
      this.currentState.onViewportChange(viewport);
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);

    if (this.currentState) {
      void this.currentState.exit();
      this.currentState = null;
      this.currentStateId = null;
    }
  }
}
