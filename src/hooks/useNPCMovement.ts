/**
 * useNPCMovement Hook
 *
 * Manages NPC movement updates in the game loop.
 * This hook initializes the movement engine, registers handlers,
 * and provides an update function to call each frame.
 */

import { useEffect, useCallback, useRef } from 'react';
import type { NPCObject } from '../types/objectEvents';
import {
  npcMovementEngine,
  registerMovementHandlers,
  createCollisionContext,
  type MovementContext,
  type CollisionContext,
} from '../game/npc';
import { getCollisionInDirection } from '../game/npc/NPCCollision';
import type { FieldEffectDirection, FieldEffectManager } from '../game/FieldEffectManager';
import { directionToOffset } from '../utils/direction';
import { MB_DEEP_SAND, MB_FOOTPRINTS, MB_SAND, isTallGrassBehavior, isLongGrassBehavior } from '../utils/metatileBehaviors';

/**
 * Context providers for collision detection
 */
export interface NPCMovementContextProviders {
  /** Check if a tile is walkable */
  isTileWalkable: (x: number, y: number) => boolean;
  /** Get tile elevation */
  getTileElevation: (x: number, y: number) => number;
  /** Get all NPCs (for NPC-NPC collision) */
  getAllNPCs: () => NPCObject[];
  /** Check if player is at position (NPCs shouldn't walk into player) */
  hasPlayerAt?: (x: number, y: number) => boolean;
  /** Get tile behavior at position (for grass effects) */
  getTileBehavior?: (x: number, y: number) => number | undefined;
  /** Field effect manager for creating grass effects */
  fieldEffectManager?: FieldEffectManager;
}

/** Owner position info for grass effect cleanup */
export interface OwnerPositionInfo {
  tileX: number;
  tileY: number;
  destTileX: number;
  destTileY: number;
  prevTileX: number;
  prevTileY: number;
  direction: 'up' | 'down' | 'left' | 'right';
  isMoving: boolean;
  isJumping: boolean;
}

/**
 * Hook return type
 */
export interface UseNPCMovementReturn {
  /** Update NPC movement for the given delta time */
  update: (deltaMs: number, npcs: NPCObject[]) => void;
  /** Reset movement engine (on map change) */
  reset: () => void;
  /** Enable/disable movement */
  setEnabled: (enabled: boolean) => void;
  /** Trigger grass effects for NPCs spawning on grass tiles */
  triggerSpawnGrassEffects: (npcs: NPCObject[]) => void;
  /** Get owner positions for all NPCs (for grass effect cleanup) */
  getNPCOwnerPositions: (npcs: NPCObject[]) => Map<string, OwnerPositionInfo>;
}

// Track if handlers have been registered (module-level to avoid re-registration)
let handlersRegistered = false;

function isBikeGraphics(graphicsId: string): boolean {
  return (
    graphicsId.includes('MACH_BIKE')
    || graphicsId.includes('ACRO_BIKE')
    || graphicsId.includes('CYCLING_TRIATHLETE')
  );
}

function getBikeTrackDirection(
  previousDirection: 'up' | 'down' | 'left' | 'right',
  currentDirection: 'up' | 'down' | 'left' | 'right'
): FieldEffectDirection {
  if (previousDirection === currentDirection) {
    return currentDirection;
  }

  // Mirrors bikeTireTracks_Transitions from pokeemerald.
  const transitions: Record<string, FieldEffectDirection> = {
    'up:right': 'turn_se',
    'up:left': 'turn_sw',
    'down:right': 'turn_ne',
    'down:left': 'turn_nw',
    'left:up': 'turn_se',
    'left:down': 'turn_ne',
    'right:up': 'turn_sw',
    'right:down': 'turn_nw',
  };

  return transitions[`${previousDirection}:${currentDirection}`] ?? currentDirection;
}

/**
 * Hook for managing NPC movement in the game loop.
 *
 * @example
 * ```typescript
 * const npcMovement = useNPCMovement({
 *   isTileWalkable: (x, y) => mapData.isWalkable(x, y),
 *   getTileElevation: (x, y) => mapData.getElevation(x, y),
 *   getAllNPCs: () => objectEventManager.getVisibleNPCs(),
 * });
 *
 * // In game loop:
 * npcMovement.update(deltaMs, visibleNPCs);
 * ```
 */
export function useNPCMovement(
  providers: NPCMovementContextProviders | null
): UseNPCMovementReturn {
  const providersRef = useRef(providers);
  providersRef.current = providers;

  // Register movement handlers once
  useEffect(() => {
    if (!handlersRegistered) {
      registerMovementHandlers();
      handlersRegistered = true;
      console.log('[NPCMovement] Handlers registered');
    }
  }, []);

  // Create movement context with collision detection
  const createContext = useCallback((): MovementContext => {
    const p = providersRef.current;

    // Simple random function using Math.random
    const random = (max: number) => Math.floor(Math.random() * max);

    if (!p) {
      // Return dummy context if providers not ready
      return {
        getCollisionInDirection: () => 'impassable' as const,
        random,
      };
    }

    // Create collision context
    const collisionContext: CollisionContext = createCollisionContext(
      p.isTileWalkable,
      p.getTileElevation,
      p.getAllNPCs,
      undefined, // isDirectionallyImpassable
      p.hasPlayerAt
    );

    return {
      getCollisionInDirection: (npc, state, direction) => {
        return getCollisionInDirection(npc, state, direction, collisionContext);
      },
      random,
    };
  }, []);

  // Track previous walking state to detect walk start
  const prevWalkingState = useRef<Map<string, boolean>>(new Map());
  const prevDirectionState = useRef<Map<string, 'up' | 'down' | 'left' | 'right'>>(new Map());

  /**
   * Update NPC movement
   */
  const update = useCallback((deltaMs: number, npcs: NPCObject[]) => {
    if (!providersRef.current) return;

    const p = providersRef.current;
    const context = createContext();
    const updates = npcMovementEngine.update(deltaMs, npcs, context);

    // Apply updates to NPCs
    for (const upd of updates) {
      const npc = npcs.find((n) => n.id === upd.npcId);
      if (npc) {
        const nowWalking = upd.isWalking;
        const previousDirection = prevDirectionState.current.get(npc.id) ?? npc.direction;

        // GBA parity: begin-step ground effects fire when a real tile step starts.
        // In this engine, that is the frame where sub-tile offset is initialized to +-16.
        // This remains reliable even when a step ends and the next step starts in one frame.
        const isBeginStep = nowWalking
          && (Math.abs(upd.subTileX) === 16 || Math.abs(upd.subTileY) === 16);

        if (isBeginStep && p.fieldEffectManager && p.getTileBehavior) {
          // The npc.tileX/tileY is already the DESTINATION (set by movement engine)
          const behavior = p.getTileBehavior(npc.tileX, npc.tileY);
          if (behavior !== undefined) {
            if (isTallGrassBehavior(behavior)) {
              p.fieldEffectManager.create(npc.tileX, npc.tileY, 'tall', false, npc.id);
            } else if (isLongGrassBehavior(behavior)) {
              p.fieldEffectManager.create(npc.tileX, npc.tileY, 'long', false, npc.id);
            }
          }

          // C parity: sand/deep-sand tracks are created at previous coords.
          const { dx, dy } = directionToOffset(upd.direction);
          const prevTileX = npc.tileX - dx;
          const prevTileY = npc.tileY - dy;
          const prevBehavior = p.getTileBehavior(prevTileX, prevTileY);

          if (prevBehavior === MB_SAND || prevBehavior === MB_FOOTPRINTS || prevBehavior === MB_DEEP_SAND) {
            const bikeTracks = isBikeGraphics(npc.graphicsId);
            const effectType = bikeTracks
              ? 'bike_tire_tracks'
              : (prevBehavior === MB_DEEP_SAND ? 'deep_sand' : 'sand');
            const direction: FieldEffectDirection = bikeTracks
              ? getBikeTrackDirection(previousDirection, upd.direction)
              : upd.direction;

            p.fieldEffectManager.create(
              prevTileX,
              prevTileY,
              effectType,
              false,
              npc.id,
              direction
            );
          }
        }

        // Update walking state tracking
        prevWalkingState.current.set(npc.id, nowWalking);

        npc.direction = upd.direction;
        npc.subTileX = upd.subTileX;
        npc.subTileY = upd.subTileY;
        npc.isWalking = upd.isWalking;
        // tileX/tileY are updated inside the movement engine

        prevDirectionState.current.set(npc.id, upd.direction);
      }
    }
  }, [createContext]);

  /**
   * Reset movement engine (call on map change)
   */
  const reset = useCallback(() => {
    npcMovementEngine.clear();
    prevWalkingState.current.clear();
    prevDirectionState.current.clear();
    console.log('[NPCMovement] Engine reset');
  }, []);

  /**
   * Enable/disable movement
   */
  const setEnabled = useCallback((enabled: boolean) => {
    npcMovementEngine.setEnabled(enabled);
  }, []);

  /**
   * Trigger grass effects for NPCs spawning on grass tiles
   * Call this once after NPCs are loaded/initialized
   */
  const triggerSpawnGrassEffects = useCallback((npcs: NPCObject[]) => {
    const p = providersRef.current;
    if (!p?.fieldEffectManager || !p?.getTileBehavior) return;

    for (const npc of npcs) {
      if (!npc.visible || npc.spriteHidden) continue;

      const behavior = p.getTileBehavior(npc.tileX, npc.tileY);
      if (behavior !== undefined) {
        if (isTallGrassBehavior(behavior)) {
          // Skip animation for spawn (show frame 0 immediately)
          p.fieldEffectManager.create(npc.tileX, npc.tileY, 'tall', true, npc.id);
        } else if (isLongGrassBehavior(behavior)) {
          p.fieldEffectManager.create(npc.tileX, npc.tileY, 'long', true, npc.id);
        }
      }
    }
  }, []);

  /**
   * Get owner positions for all NPCs (for grass effect cleanup)
   * This should be combined with player position in the cleanup call
   */
  const getNPCOwnerPositions = useCallback((npcs: NPCObject[]): Map<string, {
    tileX: number;
    tileY: number;
    destTileX: number;
    destTileY: number;
    prevTileX: number;
    prevTileY: number;
    direction: 'up' | 'down' | 'left' | 'right';
    isMoving: boolean;
    isJumping: boolean;
  }> => {
    const positions = new Map<string, {
      tileX: number;
      tileY: number;
      destTileX: number;
      destTileY: number;
      prevTileX: number;
      prevTileY: number;
      direction: 'up' | 'down' | 'left' | 'right';
      isMoving: boolean;
      isJumping: boolean;
    }>();

    for (const npc of npcs) {
      if (!npc.visible || npc.spriteHidden) continue;

      // Calculate previous tile from subTile offset
      let prevTileX = npc.tileX;
      let prevTileY = npc.tileY;

      if (npc.isWalking) {
        const subTileX = npc.subTileX ?? 0;
        const subTileY = npc.subTileY ?? 0;

        if (subTileX < -8) prevTileX = npc.tileX - 1;
        else if (subTileX > 8) prevTileX = npc.tileX + 1;

        if (subTileY < -8) prevTileY = npc.tileY - 1;
        else if (subTileY > 8) prevTileY = npc.tileY + 1;
      }

      positions.set(npc.id, {
        tileX: npc.isWalking ? prevTileX : npc.tileX, // Current visual position
        tileY: npc.isWalking ? prevTileY : npc.tileY,
        destTileX: npc.tileX,  // Destination (where tileX/Y points)
        destTileY: npc.tileY,
        prevTileX,
        prevTileY,
        direction: npc.direction,
        isMoving: npc.isWalking,
        isJumping: false, // NPCs don't jump in this implementation
      });
    }

    return positions;
  }, []);

  return {
    update,
    reset,
    setEnabled,
    triggerSpawnGrassEffects,
    getNPCOwnerPositions,
  };
}
