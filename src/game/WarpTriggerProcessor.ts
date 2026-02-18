/**
 * WarpTriggerProcessor
 *
 * Unified warp trigger detection and classification for both WebGL and Canvas2D renderers.
 * This module extracts the duplicated logic for:
 * 1. Tile-change detection (has the player moved to a new tile?)
 * 2. Warp trigger classification (arrow, door, walk-over)
 *
 * Returns action descriptors that renderers can execute in their own way,
 * without directly performing warp execution.
 */

import { detectWarpTrigger, resolveTileAt, type WarpTrigger } from '../components/map/utils.ts';
import { isNonAnimatedDoorBehavior } from '../utils/metatileBehaviors.ts';
import type { RenderContext, ResolvedTile } from '../components/map/types.ts';
import type { PlayerController } from './PlayerController.ts';
import type { WarpHandler } from '../field/WarpHandler.ts';

// =============================================================================
// Types
// =============================================================================

/**
 * State needed to check if tile changed
 */
export interface LastCheckedTile {
  x: number;
  y: number;
  mapId: string;
}

/**
 * Arrow warp action - player must press a direction to trigger
 */
export interface ArrowWarpAction {
  type: 'arrow';
  trigger: WarpTrigger;
  resolvedTile: ResolvedTile;
}

/**
 * Non-animated door warp action - stairs, ladders, etc.
 * Triggers automatic fade + warp sequence
 */
export interface AutoDoorWarpAction {
  type: 'autoDoorWarp';
  trigger: WarpTrigger;
  resolvedTile: ResolvedTile;
  entryDirection: PlayerController['dir'];
}

/**
 * Walk-over warp action - simple teleport tiles
 */
export interface WalkOverWarpAction {
  type: 'walkOverWarp';
  trigger: WarpTrigger;
  resolvedTile: ResolvedTile;
}

/**
 * No action needed
 */
export interface NoAction {
  type: 'none';
  reason: 'no_player' | 'no_context' | 'tile_not_changed' | 'on_cooldown' | 'in_progress' | 'no_trigger' | 'door_active';
}

export type WarpAction = ArrowWarpAction | AutoDoorWarpAction | WalkOverWarpAction | NoAction;

/**
 * Input needed for warp processing
 */
export interface WarpProcessorInput {
  /** Player controller */
  player: PlayerController | null;

  /** Render context for tile lookups */
  renderContext: RenderContext | null;

  /** Warp handler for cooldown/progress state */
  warpHandler: WarpHandler;

  /** Is door sequencer currently active? (prevents new warps) */
  isDoorSequencerActive?: boolean;
}

/**
 * Result of processing warp triggers
 */
export interface WarpProcessorResult {
  /** The action to take (or 'none') */
  action: WarpAction;

  /** Whether tile changed (for updating last checked state) */
  tileChanged: boolean;

  /** Current tile info (if resolved) */
  currentTile?: {
    x: number;
    y: number;
    mapId: string;
  };

  /** Resolved tile data (for additional processing) */
  resolvedTile?: ResolvedTile;

  /** Current behavior value (for arrow overlay updates) */
  behavior?: number;
}

// =============================================================================
// Main Processor
// =============================================================================

/**
 * Process warp triggers for the current frame.
 *
 * This is the main entry point that both renderers should call each frame.
 * It handles:
 * 1. Checking if player moved to a new tile
 * 2. Checking warp cooldown/in-progress state
 * 3. Detecting and classifying warp triggers
 * 4. Returning an action descriptor for the renderer to execute
 *
 * @param input - Current game state needed for warp detection
 * @returns Result with action to take and state updates
 */
export function processWarpTrigger(input: WarpProcessorInput): WarpProcessorResult {
  const { player, renderContext, warpHandler, isDoorSequencerActive = false } = input;

  // Early exit: no player
  if (!player) {
    return {
      action: { type: 'none', reason: 'no_player' },
      tileChanged: false,
    };
  }

  // Early exit: no context
  if (!renderContext) {
    return {
      action: { type: 'none', reason: 'no_context' },
      tileChanged: false,
    };
  }

  // Early exit: door sequencer active
  if (isDoorSequencerActive) {
    return {
      action: { type: 'none', reason: 'door_active' },
      tileChanged: false,
    };
  }

  // Resolve current tile
  const resolvedTile = resolveTileAt(renderContext, player.tileX, player.tileY);

  if (!resolvedTile) {
    return {
      action: { type: 'none', reason: 'no_trigger' },
      tileChanged: false,
    };
  }

  const currentMapId = resolvedTile.map.entry.id;
  const behavior = resolvedTile.attributes?.behavior ?? -1;

  // Check if tile changed
  const lastChecked = warpHandler.getState().lastCheckedTile;
  const tileChanged =
    !lastChecked ||
    lastChecked.mapId !== currentMapId ||
    lastChecked.x !== player.tileX ||
    lastChecked.y !== player.tileY;

  const currentTile = {
    x: player.tileX,
    y: player.tileY,
    mapId: currentMapId,
  };

  // If tile hasn't changed, no action needed
  if (!tileChanged) {
    return {
      action: { type: 'none', reason: 'tile_not_changed' },
      tileChanged: false,
      currentTile,
      resolvedTile,
      behavior,
    };
  }

  // Tile changed - check if we should process warp

  // Early exit: warp in progress
  if (warpHandler.isInProgress()) {
    return {
      action: { type: 'none', reason: 'in_progress' },
      tileChanged: true,
      currentTile,
      resolvedTile,
      behavior,
    };
  }

  // Early exit: on cooldown
  if (warpHandler.isOnCooldown()) {
    return {
      action: { type: 'none', reason: 'on_cooldown' },
      tileChanged: true,
      currentTile,
      resolvedTile,
      behavior,
    };
  }

  // Detect warp trigger
  const trigger = detectWarpTrigger(renderContext, player);

  if (!trigger) {
    return {
      action: { type: 'none', reason: 'no_trigger' },
      tileChanged: true,
      currentTile,
      resolvedTile,
      behavior,
    };
  }

  // Classify the warp and return action
  if (trigger.kind === 'arrow') {
    // Arrow warps wait for player input
    return {
      action: { type: 'arrow', trigger, resolvedTile },
      tileChanged: true,
      currentTile,
      resolvedTile,
      behavior,
    };
  }

  if (isNonAnimatedDoorBehavior(trigger.behavior)) {
    // Non-animated doors (stairs, ladders): auto-warp with fade
    return {
      action: {
        type: 'autoDoorWarp',
        trigger,
        resolvedTile,
        entryDirection: player.dir,
      },
      tileChanged: true,
      currentTile,
      resolvedTile,
      behavior,
    };
  }

  // Walk-over warp (teleport tiles, etc.)
  return {
    action: { type: 'walkOverWarp', trigger, resolvedTile },
    tileChanged: true,
    currentTile,
    resolvedTile,
    behavior,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Helper to update warp handler state after processing.
 *
 * Call this after processWarpTrigger() if tileChanged is true.
 */
export function updateWarpHandlerTile(
  warpHandler: WarpHandler,
  result: WarpProcessorResult
): void {
  if (result.tileChanged && result.currentTile) {
    warpHandler.updateLastCheckedTile(
      result.currentTile.x,
      result.currentTile.y,
      result.currentTile.mapId
    );
  }
}

/**
 * Check if an action requires starting a warp sequence.
 */
export function isWarpAction(action: WarpAction): action is AutoDoorWarpAction | WalkOverWarpAction {
  return action.type === 'autoDoorWarp' || action.type === 'walkOverWarp';
}

/**
 * Check if an action is an arrow warp (requires player input).
 */
export function isArrowAction(action: WarpAction): action is ArrowWarpAction {
  return action.type === 'arrow';
}
