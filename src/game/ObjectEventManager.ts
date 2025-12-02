/**
 * ObjectEventManager - Manages object events (items, NPCs, etc.) on maps
 *
 * Supports:
 * - Item balls (OBJ_EVENT_GFX_ITEM_BALL)
 * - NPCs (characters, people)
 *
 * Future support planned for:
 * - Trainers (battle triggers)
 * - Berry trees
 */

import type { ObjectEventData, ItemBallObject, NPCObject } from '../types/objectEvents';
import {
  OBJ_EVENT_GFX_ITEM_BALL,
  isNPCGraphicsId,
  parseMovementType,
  parseTrainerType,
  getInitialDirection,
} from '../types/objectEvents';
import { getItemIdFromScript } from '../data/itemScripts';
import { getItemName } from '../data/items';
import { gameFlags } from './GameFlags';

export class ObjectEventManager {
  private itemBalls: Map<string, ItemBallObject> = new Map();
  private npcs: Map<string, NPCObject> = new Map();

  /**
   * Clear all object events (called when changing maps)
   */
  clear(): void {
    this.itemBalls.clear();
    this.npcs.clear();
  }

  /**
   * Parse object events from map data and add them to the collection.
   * Call clear() first when building a new world, then call this for each map.
   *
   * @param mapId The map identifier (e.g., "MAP_ROUTE102")
   * @param objectEvents Array of object event data from map JSON
   * @param mapOffsetX Map's X offset in world coordinates (tiles)
   * @param mapOffsetY Map's Y offset in world coordinates (tiles)
   */
  parseMapObjects(
    mapId: string,
    objectEvents: ObjectEventData[],
    mapOffsetX: number,
    mapOffsetY: number
  ): void {
    for (const obj of objectEvents) {
      // Convert local coordinates to world coordinates
      const worldX = mapOffsetX + obj.x;
      const worldY = mapOffsetY + obj.y;

      // Handle item balls
      if (obj.graphics_id === OBJ_EVENT_GFX_ITEM_BALL) {
        const itemId = getItemIdFromScript(obj.script);
        if (itemId === null) {
          console.warn(`[ObjectEventManager] Unknown item script: ${obj.script}`);
          continue;
        }

        // Create unique ID
        const id = `${mapId}_item_${worldX}_${worldY}`;

        // Check if already collected
        const collected = obj.flag && obj.flag !== '0' ? gameFlags.isSet(obj.flag) : false;

        this.itemBalls.set(id, {
          id,
          tileX: worldX,
          tileY: worldY,
          elevation: obj.elevation,
          itemId,
          itemName: getItemName(itemId),
          flag: obj.flag,
          script: obj.script,
          collected,
        });
      }
      // Handle NPCs
      else if (isNPCGraphicsId(obj.graphics_id)) {
        // Create unique ID
        const localId = obj.local_id ?? null;
        const id = localId
          ? `${mapId}_npc_${localId}`
          : `${mapId}_npc_${worldX}_${worldY}`;

        // Check visibility from flag
        // NPCs with FLAG_HIDE_* are hidden when the flag IS set
        const isHidden = obj.flag && obj.flag !== '0' ? gameFlags.isSet(obj.flag) : false;

        // Parse trainer sight range (could be "0" or a number)
        const trainerSightRange = parseInt(obj.trainer_sight_or_berry_tree_id, 10) || 0;

        this.npcs.set(id, {
          id,
          localId,
          tileX: worldX,
          tileY: worldY,
          elevation: obj.elevation,
          graphicsId: obj.graphics_id,
          direction: getInitialDirection(obj.movement_type),
          movementType: parseMovementType(obj.movement_type),
          movementRangeX: obj.movement_range_x,
          movementRangeY: obj.movement_range_y,
          trainerType: parseTrainerType(obj.trainer_type),
          trainerSightRange,
          script: obj.script,
          flag: obj.flag,
          visible: !isHidden,
        });
      }
      // Future: handle other object types (berry trees, etc.)
    }
  }

  /**
   * Get all visible (not collected) item balls
   */
  getVisibleItemBalls(): ItemBallObject[] {
    return [...this.itemBalls.values()].filter((ball) => !ball.collected);
  }

  /**
   * Get all item balls (including collected ones, for debugging)
   */
  getAllItemBalls(): ItemBallObject[] {
    return [...this.itemBalls.values()];
  }

  /**
   * Get item ball at a specific tile position
   * @returns The item ball if found and not collected, null otherwise
   */
  getItemBallAt(tileX: number, tileY: number): ItemBallObject | null {
    for (const ball of this.itemBalls.values()) {
      if (ball.tileX === tileX && ball.tileY === tileY && !ball.collected) {
        return ball;
      }
    }
    return null;
  }

  /**
   * Mark an item as collected
   * @param id The item ball's unique ID
   * @returns The collected item ball, or null if not found/already collected
   */
  collectItem(id: string): ItemBallObject | null {
    const ball = this.itemBalls.get(id);
    if (!ball || ball.collected) return null;

    // Mark as collected
    ball.collected = true;

    // Set the flag if it exists
    if (ball.flag && ball.flag !== '0') {
      gameFlags.set(ball.flag);
    }

    return ball;
  }

  /**
   * Check if there's an interactable object at a position
   * @returns The object type and data, or null if nothing interactable
   */
  getInteractableAt(
    tileX: number,
    tileY: number
  ): { type: 'item'; data: ItemBallObject } | { type: 'npc'; data: NPCObject } | null {
    const itemBall = this.getItemBallAt(tileX, tileY);
    if (itemBall) {
      return { type: 'item', data: itemBall };
    }
    const npc = this.getNPCAt(tileX, tileY);
    if (npc) {
      return { type: 'npc', data: npc };
    }
    return null;
  }

  /**
   * Refresh collected state from flags (call after flag reset)
   */
  refreshCollectedState(): void {
    for (const ball of this.itemBalls.values()) {
      ball.collected = ball.flag && ball.flag !== '0' ? gameFlags.isSet(ball.flag) : false;
    }
    // Also refresh NPC visibility
    this.refreshNPCVisibility();
  }

  // === NPC Methods ===

  /**
   * Get all visible NPCs
   */
  getVisibleNPCs(): NPCObject[] {
    return [...this.npcs.values()].filter((npc) => npc.visible);
  }

  /**
   * Get all NPCs (including hidden ones, for debugging)
   */
  getAllNPCs(): NPCObject[] {
    return [...this.npcs.values()];
  }

  /**
   * Get NPC at a specific tile position
   * @returns The NPC if found and visible, null otherwise
   */
  getNPCAt(tileX: number, tileY: number): NPCObject | null {
    for (const npc of this.npcs.values()) {
      if (npc.tileX === tileX && npc.tileY === tileY && npc.visible) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Check if there's a blocking NPC at a position
   * (Used for collision detection - does NOT check elevation)
   */
  hasNPCAt(tileX: number, tileY: number): boolean {
    return this.getNPCAt(tileX, tileY) !== null;
  }

  /**
   * Check if there's a blocking NPC at a position with elevation check
   *
   * Reference: CheckForObjectEventCollision in event_object_movement.c
   * NPCs only block if they're at the same elevation OR either is at elevation 0/15
   *
   * @param playerElevation The player's current elevation
   */
  hasNPCAtWithElevation(tileX: number, tileY: number, playerElevation: number): boolean {
    const npc = this.getNPCAt(tileX, tileY);
    if (!npc) return false;

    // Ground level (0) or universal (15) can interact with any elevation
    if (playerElevation === 0 || playerElevation === 15) return true;
    if (npc.elevation === 0 || npc.elevation === 15) return true;

    // Same elevation = collision
    return npc.elevation === playerElevation;
  }

  /**
   * Get item ball at a specific tile with elevation check
   *
   * @param playerElevation The player's current elevation
   */
  getItemBallAtWithElevation(tileX: number, tileY: number, playerElevation: number): ItemBallObject | null {
    for (const ball of this.itemBalls.values()) {
      if (ball.tileX === tileX && ball.tileY === tileY && !ball.collected) {
        // Ground level (0) or universal (15) can interact with any elevation
        if (playerElevation === 0 || playerElevation === 15) return ball;
        if (ball.elevation === 0 || ball.elevation === 15) return ball;
        // Same elevation = can interact
        if (ball.elevation === playerElevation) return ball;
      }
    }
    return null;
  }

  /**
   * Check if there's any blocking object (NPC or item ball) at a position
   *
   * This is the main collision checking method used by PlayerController.
   * It combines both NPC and item ball collision with proper elevation checks.
   *
   * Reference: CheckForObjectEventCollision in event_object_movement.c
   *
   * @param tileX Tile X coordinate to check
   * @param tileY Tile Y coordinate to check
   * @param playerElevation The player's current elevation
   * @returns true if tile is blocked by an object
   */
  hasObjectCollisionAt(tileX: number, tileY: number, playerElevation: number): boolean {
    // Block if there's an uncollected item ball at same elevation
    if (this.getItemBallAtWithElevation(tileX, tileY, playerElevation) !== null) {
      return true;
    }
    // Block if there's a visible NPC at same elevation
    if (this.hasNPCAtWithElevation(tileX, tileY, playerElevation)) {
      return true;
    }
    return false;
  }

  /**
   * Refresh NPC visibility from flags
   */
  refreshNPCVisibility(): void {
    for (const npc of this.npcs.values()) {
      // NPCs with FLAG_HIDE_* are hidden when the flag IS set
      npc.visible = !(npc.flag && npc.flag !== '0' ? gameFlags.isSet(npc.flag) : false);
    }
  }

  /**
   * Get unique graphics IDs used by visible NPCs
   * (Used for sprite loading)
   */
  getUniqueNPCGraphicsIds(): string[] {
    const ids = new Set<string>();
    for (const npc of this.npcs.values()) {
      if (npc.visible) {
        ids.add(npc.graphicsId);
      }
    }
    return [...ids];
  }
}
