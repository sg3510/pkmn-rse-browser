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
  gbaToDirection,
  type MovementContext,
  type CollisionContext,
} from '../game/npc';
import { getCollisionInDirection } from '../game/npc/NPCCollision';
import type { FieldEffectManager } from '../game/FieldEffectManager';
import { isTallGrassBehavior, isLongGrassBehavior } from '../utils/metatileBehaviors';

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
        // Check if NPC just STARTED walking (was not walking, now is walking)
        const wasWalking = prevWalkingState.current.get(npc.id) ?? false;
        const nowWalking = upd.isWalking;

        // Trigger grass effect when walk starts (on destination tile)
        // GBA triggers grass effect at the moment object BEGINS stepping onto tile
        if (!wasWalking && nowWalking && p.fieldEffectManager && p.getTileBehavior) {
          // The npc.tileX/tileY is already the DESTINATION (set by movement engine)
          const behavior = p.getTileBehavior(npc.tileX, npc.tileY);
          if (behavior !== undefined) {
            if (isTallGrassBehavior(behavior)) {
              p.fieldEffectManager.create(npc.tileX, npc.tileY, 'tall', false, npc.id);
            } else if (isLongGrassBehavior(behavior)) {
              p.fieldEffectManager.create(npc.tileX, npc.tileY, 'long', false, npc.id);
            }
          }
        }

        // Update walking state tracking
        prevWalkingState.current.set(npc.id, nowWalking);

        npc.direction = upd.direction;
        npc.subTileX = upd.subTileX;
        npc.subTileY = upd.subTileY;
        npc.isWalking = upd.isWalking;
        // tileX/tileY are updated inside the movement engine
      }
    }
  }, [createContext]);

  /**
   * Reset movement engine (call on map change)
   */
  const reset = useCallback(() => {
    npcMovementEngine.clear();
    prevWalkingState.current.clear();
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
      if (!npc.visible) continue;

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
      if (!npc.visible) continue;

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
