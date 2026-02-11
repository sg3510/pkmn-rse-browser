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

import {
  OBJ_EVENT_GFX_ITEM_BALL,
  OBJ_EVENT_GFX_TRUCK,
  isNPCGraphicsId,
  parseMovementType,
  parseTrainerType,
  getInitialDirection,
  type ObjectEventData,
  type ItemBallObject,
  type NPCObject,
  type ScriptObject,
  type LargeObject,
} from '../types/objectEvents';
import type { BgEvent } from './mapEventLoader';
import { getItemIdFromScript } from '../data/itemScripts';
import { getItemName } from '../data/items';
import { gameFlags } from './GameFlags';
import { saveManager } from '../save/SaveManager';
import { resolveDynamicObjectGfx } from './DynamicObjectGfx';

/**
 * Processed background event for tile-based interaction (signs, hidden items)
 */
export interface ProcessedBgEvent {
  id: string;
  type: 'sign' | 'hidden_item' | 'secret_base';
  tileX: number;
  tileY: number;
  elevation: number;
  playerFacingDir: string;
  script: string;
  item: string;
  flag: string;
  /** Whether hidden item has been collected (derived from flag state) */
  collected: boolean;
}

/**
 * Simple tile resolver type for getting tile elevation
 * Returns the tile's elevation at given world coordinates
 */
export type TileElevationResolver = (tileX: number, tileY: number) => number | null;

/** Set of graphics IDs treated as large (non-NPC) rendered objects */
const LARGE_OBJECT_GFX_IDS = new Set([OBJ_EVENT_GFX_TRUCK]);

/**
 * Player room decoration placeholders are map object slots backed by
 * FLAG_DECORATION_* and OBJ_EVENT_GFX_VAR_* with no script.
 *
 * In pokeemerald these slots are populated by decoration data, not spawned as
 * normal NPC object events. Skip them until decoration spawning exists.
 */
function isDecorationSlotPlaceholder(obj: ObjectEventData): boolean {
  if (!obj.flag.startsWith('FLAG_DECORATION_')) return false;
  if (!/^OBJ_EVENT_GFX_VAR_[0-9A-F]$/.test(obj.graphics_id)) return false;
  return obj.script === '0x0' || obj.script === '0';
}

export class ObjectEventManager {
  private itemBalls: Map<string, ItemBallObject> = new Map();
  private npcs: Map<string, NPCObject> = new Map();
  private scriptObjects: Map<string, ScriptObject> = new Map();
  private largeObjects: Map<string, LargeObject> = new Map();
  private bgEvents: Map<string, ProcessedBgEvent> = new Map();
  private tileElevationResolver: TileElevationResolver | null = null;
  private parsedMapIds: Set<string> = new Set();

  /**
   * Set the tile elevation resolver
   *
   * This is used to get the actual tile elevation for NPC collision checks.
   * In pokeemerald, NPC currentElevation is updated to match the tile they're
   * standing on (ObjectEventUpdateElevation), so we need to check the tile's
   * elevation, not the NPC's spawn elevation from map data.
   */
  setTileElevationResolver(resolver: TileElevationResolver | null): void {
    this.tileElevationResolver = resolver;
  }

  /**
   * Clear all object events (called when changing maps)
   */
  clear(): void {
    this.itemBalls.clear();
    this.npcs.clear();
    this.scriptObjects.clear();
    this.largeObjects.clear();
    this.bgEvents.clear();
    this.parsedMapIds.clear();
  }

  /**
   * Check if objects for a given map have already been parsed.
   */
  hasMapObjects(mapId: string): boolean {
    return this.parsedMapIds.has(mapId);
  }

  /**
   * Get the set of map IDs whose objects have been parsed.
   */
  getParsedMapIds(): ReadonlySet<string> {
    return this.parsedMapIds;
  }

  /**
   * Remove all objects belonging to a specific map.
   * Entries are keyed with the mapId prefix (e.g. "MAP_ROUTE_101_npc_...").
   */
  removeMapObjects(mapId: string): void {
    const prefix = `${mapId}_`;
    for (const key of [...this.npcs.keys()]) {
      if (key.startsWith(prefix)) this.npcs.delete(key);
    }
    for (const key of [...this.itemBalls.keys()]) {
      if (key.startsWith(prefix)) this.itemBalls.delete(key);
    }
    for (const key of [...this.scriptObjects.keys()]) {
      if (key.startsWith(prefix)) this.scriptObjects.delete(key);
    }
    for (const key of [...this.largeObjects.keys()]) {
      if (key.startsWith(prefix)) this.largeObjects.delete(key);
    }
    for (const key of [...this.bgEvents.keys()]) {
      if (key.startsWith(prefix)) this.bgEvents.delete(key);
    }
    this.parsedMapIds.delete(mapId);
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
    this.parsedMapIds.add(mapId);
    const playerGender = saveManager.getProfile().gender;

    for (let objIndex = 0; objIndex < objectEvents.length; objIndex++) {
      const obj = objectEvents[objIndex];
      if (isDecorationSlotPlaceholder(obj)) continue;
      const resolvedGraphicsId = resolveDynamicObjectGfx(obj.graphics_id, playerGender);
      // Convert local coordinates to world coordinates
      const worldX = mapOffsetX + obj.x;
      const worldY = mapOffsetY + obj.y;

      // Handle large non-NPC objects (e.g. truck)
      if (LARGE_OBJECT_GFX_IDS.has(resolvedGraphicsId)) {
        const id = `${mapId}_large_${worldX}_${worldY}`;
        const isHidden = obj.flag && obj.flag !== '0' ? gameFlags.isSet(obj.flag) : false;
        this.largeObjects.set(id, {
          id,
          tileX: worldX,
          tileY: worldY,
          elevation: obj.elevation,
          graphicsId: resolvedGraphicsId,
          flag: obj.flag,
          visible: !isHidden,
        });
        continue;
      }

      // Handle item balls
      if (resolvedGraphicsId === OBJ_EVENT_GFX_ITEM_BALL) {
        // Resolve item ID from script name. Story objects (e.g. RivalsPokeBall)
        // don't map to a real item — render them as item balls anyway so the
        // sprite is visible and interaction falls through to ScriptRunner.
        const itemId = getItemIdFromScript(obj.script) ?? 0;
        const itemName = itemId > 0 ? getItemName(itemId) : '';

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
          itemName,
          flag: obj.flag,
          script: obj.script,
          collected,
        });
      }
      // Handle NPCs
      else if (isNPCGraphicsId(resolvedGraphicsId)) {
        // Create unique ID
        // GBA: local IDs are 1-indexed array positions. Auto-assign if not explicit.
        const localId = obj.local_id ?? String(objIndex + 1);
        const id = `${mapId}_npc_${localId}`;

        // Check visibility from flag
        // NPCs with FLAG_HIDE_* are hidden when the flag IS set
        const isHidden = obj.flag && obj.flag !== '0' ? gameFlags.isSet(obj.flag) : false;

        // Parse trainer sight range (could be "0" or a number)
        const trainerSightRange = parseInt(obj.trainer_sight_or_berry_tree_id, 10) || 0;

        const movementType = parseMovementType(obj.movement_type);
        this.npcs.set(id, {
          id,
          localId,
          tileX: worldX,
          tileY: worldY,
          elevation: obj.elevation,
          graphicsId: resolvedGraphicsId,
          direction: getInitialDirection(obj.movement_type),
          movementType,
          movementTypeRaw: obj.movement_type,
          movementRangeX: obj.movement_range_x,
          movementRangeY: obj.movement_range_y,
          trainerType: parseTrainerType(obj.trainer_type),
          trainerSightRange,
          script: obj.script,
          flag: obj.flag,
          visible: !isHidden,
          spriteHidden: movementType === 'invisible',
          // Movement state fields
          subTileX: 0,
          subTileY: 0,
          isWalking: false,
          initialTileX: worldX,
          initialTileY: worldY,
        });
      }
      // Handle scripted non-NPC objects (e.g. Birch's bag)
      else if (obj.script && obj.script !== '0x0') {
        const localId = obj.local_id ?? null;
        const id = localId
          ? `${mapId}_script_${localId}`
          : `${mapId}_script_${worldX}_${worldY}`;

        const isHidden = obj.flag && obj.flag !== '0' ? gameFlags.isSet(obj.flag) : false;

        this.scriptObjects.set(id, {
          id,
          localId,
          tileX: worldX,
          tileY: worldY,
          elevation: obj.elevation,
          graphicsId: resolvedGraphicsId,
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
  ): { type: 'item'; data: ItemBallObject } | { type: 'npc'; data: NPCObject } | { type: 'script'; data: ScriptObject } | null {
    const itemBall = this.getItemBallAt(tileX, tileY);
    if (itemBall) {
      if (itemBall.itemId > 0) {
        return { type: 'item', data: itemBall };
      }
      // Story item ball (e.g. RivalsPokeBall) — route through script system
      return {
        type: 'script',
        data: {
          id: itemBall.id,
          localId: null,
          tileX: itemBall.tileX,
          tileY: itemBall.tileY,
          elevation: itemBall.elevation,
          graphicsId: OBJ_EVENT_GFX_ITEM_BALL,
          script: itemBall.script,
          flag: itemBall.flag,
          visible: !itemBall.collected,
        },
      };
    }
    const npc = this.getNPCAt(tileX, tileY);
    if (npc) {
      return { type: 'npc', data: npc };
    }
    const scriptObject = this.getScriptObjectAt(tileX, tileY);
    if (scriptObject) {
      return { type: 'script', data: scriptObject };
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
    // C parity: setflag/clearflag during a script does NOT immediately change
    // already-spawned object visibility. Objects only check their hide flags
    // on map load (when first created). Scripts use addobject/removeobject
    // for immediate visibility changes.
    this.refreshBgEventState();
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
   * Get an NPC by map-local ID.
   */
  getNPCByLocalId(mapId: string, localId: string): NPCObject | null {
    const key = `${mapId}_npc_${localId}`;
    return this.npcs.get(key) ?? null;
  }

  /**
   * Set an NPC's tile position by map-local ID.
   */
  setNPCPositionByLocalId(mapId: string, localId: string, tileX: number, tileY: number): boolean {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc) return false;

    npc.tileX = tileX;
    npc.tileY = tileY;
    // Also update initial position (used by movement engine for wander bounds)
    npc.initialTileX = tileX;
    npc.initialTileY = tileY;
    npc.subTileX = 0;
    npc.subTileY = 0;
    npc.isWalking = false;
    return true;
  }

  /**
   * Set an NPC's visibility by map-local ID.
   */
  setNPCVisibilityByLocalId(mapId: string, localId: string, visible: boolean): boolean {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc) return false;
    npc.visible = visible;
    return true;
  }

  /**
   * Set an NPC's spriteHidden state by map-local ID.
   * Used by set_visible/set_invisible movement commands (Kecleon, etc.)
   */
  setNPCSpriteHiddenByLocalId(mapId: string, localId: string, hidden: boolean): boolean {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc) return false;
    npc.spriteHidden = hidden;
    return true;
  }

  /**
   * Set an NPC's facing direction by map-local ID.
   */
  setNPCDirectionByLocalId(
    mapId: string,
    localId: string,
    direction: 'up' | 'down' | 'left' | 'right'
  ): boolean {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc) return false;
    npc.direction = direction;
    return true;
  }

  /**
   * Face an NPC toward the player's position.
   */
  faceNpcTowardPlayer(
    mapId: string,
    localId: string,
    playerTileX: number,
    playerTileY: number
  ): void {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc) return;
    const dx = playerTileX - npc.tileX;
    const dy = playerTileY - npc.tileY;
    if (Math.abs(dx) > Math.abs(dy)) {
      npc.direction = dx < 0 ? 'left' : 'right';
    } else if (dy !== 0) {
      npc.direction = dy < 0 ? 'up' : 'down';
    }
  }

  /**
   * Set an NPC's movement type by map-local ID.
   * Also updates direction and stops wandering.
   */
  setNPCMovementTypeByLocalId(
    mapId: string,
    localId: string,
    movementTypeRaw: string
  ): boolean {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc) return false;
    npc.movementType = parseMovementType(movementTypeRaw);
    npc.movementTypeRaw = movementTypeRaw;
    npc.direction = getInitialDirection(movementTypeRaw);
    npc.isWalking = false;
    npc.subTileX = 0;
    npc.subTileY = 0;
    return true;
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
   * Reference: AreElevationsCompatible in event_object_movement.c:7791
   *
   * IMPORTANT: In pokeemerald, NPC currentElevation is updated to match the tile
   * they're standing on (ObjectEventUpdateElevation), NOT their spawn elevation
   * from map data. This matters for NPCs like swimmers who have spawn elevation 3
   * but stand on water tiles with elevation 1.
   *
   * @param playerElevation The player's current elevation
   */
  hasNPCAtWithElevation(tileX: number, tileY: number, playerElevation: number): boolean {
    const npc = this.getNPCAt(tileX, tileY);
    if (!npc) return false;

    // Get the NPC's actual elevation from the tile they're standing on
    // This mirrors pokeemerald's ObjectEventUpdateElevation behavior
    let npcElevation = npc.elevation;
    if (this.tileElevationResolver) {
      const tileElev = this.tileElevationResolver(npc.tileX, npc.tileY);
      if (tileElev !== null && tileElev !== 15) {
        // Update to tile elevation (15 is special - preserves previous)
        npcElevation = tileElev;
      }
    }

    // Ground level (0) or universal (15) can interact with any elevation
    // Reference: AreElevationsCompatible - "if (a == 0 || b == 0) return TRUE;"
    if (playerElevation === 0 || playerElevation === 15) return true;
    if (npcElevation === 0 || npcElevation === 15) return true;

    // Same elevation = collision
    return npcElevation === playerElevation;
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
    // Block if there's a scripted object (e.g. Birch's bag) at same elevation
    if (this.getScriptObjectAtWithElevation(tileX, tileY, playerElevation) !== null) {
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
   * Get all visible scripted objects.
   */
  getVisibleScriptObjects(): ScriptObject[] {
    return [...this.scriptObjects.values()].filter((obj) => obj.visible);
  }

  /**
   * Get scripted object at specific tile.
   */
  getScriptObjectAt(tileX: number, tileY: number): ScriptObject | null {
    for (const scriptObject of this.scriptObjects.values()) {
      if (scriptObject.visible && scriptObject.tileX === tileX && scriptObject.tileY === tileY) {
        return scriptObject;
      }
    }
    return null;
  }

  /**
   * Get scripted object at tile with elevation rules.
   */
  getScriptObjectAtWithElevation(tileX: number, tileY: number, playerElevation: number): ScriptObject | null {
    const scriptObject = this.getScriptObjectAt(tileX, tileY);
    if (!scriptObject) return null;

    if (playerElevation === 0 || playerElevation === 15) return scriptObject;
    if (scriptObject.elevation === 0 || scriptObject.elevation === 15) return scriptObject;
    if (scriptObject.elevation === playerElevation) return scriptObject;

    return null;
  }

  /**
   * Refresh scripted object visibility from flags.
   */
  refreshScriptObjectVisibility(): void {
    for (const scriptObject of this.scriptObjects.values()) {
      scriptObject.visible = !(scriptObject.flag && scriptObject.flag !== '0' ? gameFlags.isSet(scriptObject.flag) : false);
    }
  }

  // === Large Object Methods ===

  /**
   * Get all visible large objects (e.g. truck)
   */
  getVisibleLargeObjects(): LargeObject[] {
    return [...this.largeObjects.values()].filter((obj) => obj.visible);
  }

  /**
   * Refresh large object visibility from flags
   */
  refreshLargeObjectVisibility(): void {
    for (const obj of this.largeObjects.values()) {
      obj.visible = !(obj.flag && obj.flag !== '0' ? gameFlags.isSet(obj.flag) : false);
    }
  }

  /**
   * Get unique graphics IDs used by ALL NPCs and script objects (including hidden ones).
   * Hidden NPCs may become visible during cutscenes, so their sprite sheets
   * must be pre-loaded at map load time. Script objects (cut trees, smash rocks,
   * strength boulders, etc.) also need their sprites pre-loaded.
   */
  getUniqueNPCGraphicsIds(): string[] {
    const ids = new Set<string>();
    for (const npc of this.npcs.values()) {
      ids.add(npc.graphicsId);
    }
    for (const obj of this.scriptObjects.values()) {
      ids.add(obj.graphicsId);
    }
    return [...ids];
  }

  // === Background Event Methods ===

  /**
   * Parse background events (signs, hidden items) from map data.
   *
   * @param mapId The map identifier
   * @param bgEventsData Array of bg event data from map JSON
   * @param mapOffsetX Map's X offset in world coordinates (tiles)
   * @param mapOffsetY Map's Y offset in world coordinates (tiles)
   */
  parseMapBgEvents(
    mapId: string,
    bgEventsData: BgEvent[],
    mapOffsetX: number,
    mapOffsetY: number
  ): void {
    for (const bg of bgEventsData) {
      // Skip secret bases for now
      if (bg.type === 'secret_base') continue;

      const worldX = mapOffsetX + bg.x;
      const worldY = mapOffsetY + bg.y;
      const id = `${mapId}_bg_${worldX}_${worldY}`;

      const collected = bg.type === 'hidden_item' && bg.flag && bg.flag !== '0'
        ? gameFlags.isSet(bg.flag)
        : false;

      this.bgEvents.set(id, {
        id,
        type: bg.type,
        tileX: worldX,
        tileY: worldY,
        elevation: bg.elevation,
        playerFacingDir: bg.playerFacingDir,
        script: bg.script,
        item: bg.item,
        flag: bg.flag,
        collected,
      });
    }
  }

  /**
   * Get background event at a specific tile position.
   * For hidden items, returns null if already collected.
   */
  getBgEventAt(tileX: number, tileY: number): ProcessedBgEvent | null {
    for (const bg of this.bgEvents.values()) {
      if (bg.tileX === tileX && bg.tileY === tileY) {
        if (bg.type === 'hidden_item' && bg.collected) return null;
        return bg;
      }
    }
    return null;
  }

  /**
   * Collect a hidden item bg_event (set flag, mark collected).
   */
  collectHiddenItem(id: string): ProcessedBgEvent | null {
    const bg = this.bgEvents.get(id);
    if (!bg || bg.type !== 'hidden_item' || bg.collected) return null;
    bg.collected = true;
    if (bg.flag && bg.flag !== '0') {
      gameFlags.set(bg.flag);
    }
    return bg;
  }

  /**
   * Refresh bg_event collected state from flags.
   */
  refreshBgEventState(): void {
    for (const bg of this.bgEvents.values()) {
      if (bg.type === 'hidden_item') {
        bg.collected = bg.flag && bg.flag !== '0' ? gameFlags.isSet(bg.flag) : false;
      }
    }
  }
}
