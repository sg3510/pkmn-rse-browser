/**
 * WarpExecutor - Shared Warp Logic
 *
 * Contains renderer-agnostic warp utilities shared between WebGL and Canvas2D.
 * Does NOT contain any GPU, tileset, or world initialization logic.
 *
 * The caller is responsible for:
 * - Initializing the world (WorldManager or MapManager)
 * - Setting up tile resolvers
 * - Uploading tilesets (WebGL only)
 *
 * This module handles:
 * - Spawn position calculation
 * - Facing direction determination
 * - Door exit sequence orchestration
 * - Warp completion (cooldown, state updates)
 */

import type { PlayerController } from './PlayerController';
import type { WarpHandler } from '../field/WarpHandler';
import type { FadeController } from '../field/FadeController';
import type { UseDoorSequencerReturn } from '../hooks/useDoorSequencer';
import type { WarpEvent, MapIndexEntry } from '../types/maps';
import type { WarpTrigger } from '../components/map/utils';
import type { CardinalDirection } from '../field/types';
import { DOOR_TIMING, FADE_TIMING } from '../field/types';
import {
  isDoorBehavior,
  isNonAnimatedDoorBehavior,
  isLadderBehavior,
  isDeepSouthWarp,
  isSouthArrowWarp,
  isNorthArrowWarp,
  isWestArrowWarp,
  isEastArrowWarp,
  requiresDoorExitSequence,
} from '../utils/metatileBehaviors';

// =============================================================================
// Types
// =============================================================================

/**
 * Minimal map info needed for warp destination
 */
export interface WarpDestinationMap {
  entry: MapIndexEntry;
  offsetX: number;
  offsetY: number;
  warpEvents: WarpEvent[];
}

/**
 * Function to resolve tile behavior at a position
 */
export type TileBehaviorResolver = (
  x: number,
  y: number
) => { attributes?: { behavior: number }; mapTile?: { metatileId: number } } | null;

/**
 * Warp destination info provided by the caller after world initialization
 */
export interface WarpDestination {
  /** The destination map */
  map: WarpDestinationMap;
  /** Function to resolve tile behavior (for door exit checks) */
  resolveTileAt: TileBehaviorResolver;
}

/**
 * Dependencies needed by warp executor
 */
export interface WarpExecutorDeps {
  player: PlayerController;
  doorSequencer: UseDoorSequencerReturn;
  fadeController: FadeController;
  warpHandler: WarpHandler;
  /** Ref to control player visibility during door sequences */
  playerHiddenRef: { current: boolean };
  /** Get current timestamp for animations */
  getCurrentTime: () => number;
  /** Called when door animations should be cleared */
  onClearDoorAnimations?: () => void;
}

/**
 * Options for warp execution
 */
export interface WarpOptions {
  /** Force warp even if one is in progress */
  force?: boolean;
  /** Warp originated from a door (affects exit sequence) */
  fromDoor?: boolean;
  /**
   * Player's facing direction BEFORE the warp.
   * Used by ladders and surf transitions to preserve facing.
   * If not provided, defaults to 'down'.
   */
  priorFacing?: CardinalDirection;
}

/**
 * Result of spawn position calculation
 */
export interface SpawnPosition {
  x: number;
  y: number;
}

// =============================================================================
// Spawn Position Calculation
// =============================================================================

/**
 * Calculate spawn position from destination map and warp ID
 *
 * Logic:
 * 1. Find warp event by ID
 * 2. Convert to world coordinates (map offset + warp local position)
 * 3. Fallback to map center if warp not found
 *
 * @param destMap - Destination map info
 * @param destWarpId - Target warp ID in destination map
 * @returns World coordinates for spawn position
 */
export function calculateSpawnPosition(
  destMap: WarpDestinationMap,
  destWarpId: number
): SpawnPosition {
  // Try to find the specific warp event
  if (destMap.warpEvents.length > destWarpId) {
    const destWarp = destMap.warpEvents[destWarpId];
    return {
      x: destMap.offsetX + destWarp.x,
      y: destMap.offsetY + destWarp.y,
    };
  }

  // Fallback: use first warp if available
  if (destMap.warpEvents.length > 0) {
    const destWarp = destMap.warpEvents[0];
    return {
      x: destMap.offsetX + destWarp.x,
      y: destMap.offsetY + destWarp.y,
    };
  }

  // Last resort: center of map
  return {
    x: destMap.offsetX + Math.floor(destMap.entry.width / 2),
    y: destMap.offsetY + Math.floor(destMap.entry.height / 2),
  };
}

// =============================================================================
// Facing Direction Determination
// =============================================================================

/**
 * Determine player facing direction after warp.
 *
 * This is a TypeScript port of GBA's GetAdjustedInitialDirection function
 * from public/pokeemerald/src/overworld.c (lines 929-952).
 *
 * Priority order (first match wins):
 * 1. Deep south warp → face NORTH (up)
 * 2. Any door (animated or non-animated) → face SOUTH (down)
 * 3. South arrow warp → face NORTH (up) [opposite direction]
 * 4. North arrow warp → face SOUTH (down) [opposite direction]
 * 5. West arrow warp → face EAST (right) [opposite direction]
 * 6. East arrow warp → face WEST (left) [opposite direction]
 * 7. Ladder → preserve prior facing
 * 8. Default → face SOUTH (down)
 *
 * Note: Cruise mode (ocean routes) and surf/underwater transitions are not
 * yet implemented as we don't have those game states tracked.
 *
 * @param destBehavior - Behavior of destination tile (-1 if unknown)
 * @param options - Warp options including priorFacing for ladder preservation
 * @returns Direction player should face after warp
 */
export function determineFacing(
  destBehavior: number,
  options?: WarpOptions
): CardinalDirection {
  const priorFacing = options?.priorFacing ?? 'down';

  // Priority 1: Deep south warp → face north
  if (isDeepSouthWarp(destBehavior)) {
    return 'up';
  }

  // Priority 2: Any door (animated or non-animated) → face south
  if (isDoorBehavior(destBehavior) || isNonAnimatedDoorBehavior(destBehavior)) {
    return 'down';
  }

  // Priority 3-6: Arrow warps → face OPPOSITE the arrow direction
  if (isSouthArrowWarp(destBehavior)) {
    return 'up';    // South arrow → face north
  }
  if (isNorthArrowWarp(destBehavior)) {
    return 'down';  // North arrow → face south
  }
  if (isWestArrowWarp(destBehavior)) {
    return 'right'; // West arrow → face east
  }
  if (isEastArrowWarp(destBehavior)) {
    return 'left';  // East arrow → face west
  }

  // Priority 7: Ladder → preserve prior facing
  if (isLadderBehavior(destBehavior)) {
    return priorFacing;
  }

  // Priority 8: Default → face south
  return 'down';
}

// =============================================================================
// Door Exit Sequence Handling
// =============================================================================

/**
 * Handle door exit sequence after warp
 *
 * Checks if destination requires an exit sequence (animated or non-animated door)
 * and starts the appropriate sequence or skips to simple fade-in.
 *
 * @param deps - Warp executor dependencies
 * @param spawnPos - Player spawn position
 * @param destBehavior - Behavior of destination tile
 * @param destMetatileId - Metatile ID of destination tile
 * @param trigger - The warp trigger
 * @param options - Warp options
 * @returns true if exit sequence was started, false if skipped
 */
export function handleDoorExitSequence(
  deps: WarpExecutorDeps,
  spawnPos: SpawnPosition,
  destBehavior: number,
  destMetatileId: number,
  trigger: WarpTrigger,
  _options?: WarpOptions
): boolean {
  const {
    player,
    doorSequencer,
    fadeController,
    warpHandler,
    playerHiddenRef,
    getCurrentTime,
  } = deps;

  const now = getCurrentTime();
  const isAnimatedDoor = isDoorBehavior(destBehavior);
  const requiresExitSeq = requiresDoorExitSequence(destBehavior);

  if (requiresExitSeq) {
    // Determine exit direction: for arrow warps, continue in same direction; for doors, exit down
    const exitDirection: CardinalDirection =
      trigger.kind === 'arrow' ? (trigger.facing as CardinalDirection) : 'down';

    // Hide player and start exit sequence
    playerHiddenRef.current = true;
    doorSequencer.startExit(
      {
        doorWorldX: spawnPos.x,
        doorWorldY: spawnPos.y,
        metatileId: destMetatileId,
        isAnimatedDoor,
        exitDirection,
      },
      now
    );
    fadeController.startFadeIn(DOOR_TIMING.FADE_DURATION_MS, now);

    return true; // Exit sequence started
  } else {
    // No door exit sequence needed
    playerHiddenRef.current = false;
    fadeController.startFadeIn(DOOR_TIMING.FADE_DURATION_MS, now);

    // Reset door sequencer and unlock input
    doorSequencer.reset();
    player.unlockInput();
    warpHandler.setInProgress(false);

    return false; // Exit sequence skipped
  }
}

// =============================================================================
// Main Execute Function
// =============================================================================

/**
 * Execute shared warp logic after world has been initialized
 *
 * This function handles all renderer-agnostic warp logic:
 * 1. Calculate spawn position
 * 2. Determine facing direction
 * 3. Set player position
 * 4. Handle door exit sequence (if fromDoor)
 * 5. Complete warp state
 *
 * The caller is responsible for:
 * - Initializing the world at destination map
 * - Setting up tile resolvers
 * - Uploading tilesets (WebGL)
 * - Providing the destination info
 *
 * @param deps - Warp executor dependencies
 * @param trigger - The warp trigger
 * @param destination - Destination map and tile resolver
 * @param options - Warp options
 */
export function executeWarp(
  deps: WarpExecutorDeps,
  trigger: WarpTrigger,
  destination: WarpDestination,
  options?: WarpOptions
): void {
  const {
    player,
    doorSequencer,
    fadeController,
    warpHandler,
    playerHiddenRef,
    getCurrentTime,
    onClearDoorAnimations,
  } = deps;

  const destWarpId = trigger.warpEvent.destWarpId;
  const now = getCurrentTime();

  // 1. Calculate spawn position
  const spawnPos = calculateSpawnPosition(destination.map, destWarpId);

  // 2. Resolve destination tile behavior (for facing and door exit checks)
  const destResolved = destination.resolveTileAt(spawnPos.x, spawnPos.y);
  const destBehavior = destResolved?.attributes?.behavior ?? -1;
  const destMetatileId = destResolved?.mapTile?.metatileId ?? 0;

  // 3. Determine facing direction (uses GBA GetAdjustedInitialDirection logic)
  const facing = determineFacing(destBehavior, options);

  // 4. Set player position and direction
  player.setPositionAndDirection(spawnPos.x, spawnPos.y, facing);

  // 5. Handle door exit sequence if this warp came from a door
  if (options?.fromDoor) {
    handleDoorExitSequence(
      deps,
      spawnPos,
      destBehavior,
      destMetatileId,
      trigger,
      options
    );
  } else {
    // Simple warp (not from door) - just fade in
    fadeController.startFadeIn(FADE_TIMING.DEFAULT_DURATION_MS, now);
    doorSequencer.reset();
    playerHiddenRef.current = false;
  }

  // 6. Complete warp - sets cooldown and updates lastCheckedTile
  warpHandler.completeWarp(
    destination.map.entry.id,
    spawnPos.x,
    spawnPos.y
  );
  warpHandler.setCooldown(350);

  // 7. Clear old door animations
  onClearDoorAnimations?.();
}
