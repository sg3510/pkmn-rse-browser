/**
 * ObjectEventManager - Manages object events (items, NPCs, etc.) on maps
 *
 * Currently supports:
 * - Item balls (OBJ_EVENT_GFX_ITEM_BALL)
 *
 * Future support planned for:
 * - NPCs
 * - Trainers
 * - Berry trees
 */

import type { ObjectEventData, ItemBallObject } from '../types/objectEvents';
import { OBJ_EVENT_GFX_ITEM_BALL } from '../types/objectEvents';
import { getItemIdFromScript } from '../data/itemScripts';
import { getItemName } from '../data/items';
import { gameFlags } from './GameFlags';

export class ObjectEventManager {
  private itemBalls: Map<string, ItemBallObject> = new Map();
  private currentMapId: string | null = null;

  /**
   * Clear all object events (called when changing maps)
   */
  clear(): void {
    this.itemBalls.clear();
    this.currentMapId = null;
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
      // Handle item balls
      if (obj.graphics_id === OBJ_EVENT_GFX_ITEM_BALL) {
        const itemId = getItemIdFromScript(obj.script);
        if (itemId === null) {
          console.warn(`[ObjectEventManager] Unknown item script: ${obj.script}`);
          continue;
        }

        // Convert local coordinates to world coordinates
        const worldX = mapOffsetX + obj.x;
        const worldY = mapOffsetY + obj.y;

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
      // Future: handle other object types (NPCs, trainers, etc.)
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
  ): { type: 'item'; data: ItemBallObject } | null {
    const itemBall = this.getItemBallAt(tileX, tileY);
    if (itemBall) {
      return { type: 'item', data: itemBall };
    }
    // Future: check for NPCs, signs, etc.
    return null;
  }

  /**
   * Refresh collected state from flags (call after flag reset)
   */
  refreshCollectedState(): void {
    for (const ball of this.itemBalls.values()) {
      ball.collected = ball.flag && ball.flag !== '0' ? gameFlags.isSet(ball.flag) : false;
    }
  }
}
