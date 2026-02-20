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
  isLargeObjectGraphicsId,
  isNPCGraphicsId,
  parseMovementType,
  parseTrainerType,
  getInitialDirection,
  type ObjectEventData,
  type ItemBallObject,
  type NPCObject,
  type NPCDirection,
  type NPCDisguiseState,
  type ScriptObject,
  type LargeObject,
  type ObjectEventRuntimeState,
} from '../types/objectEvents.ts';
import type { BgEvent } from './mapEventLoader';
import { getItemIdFromScript } from '../data/itemScripts.ts';
import { getItemName } from '../data/items.ts';
import { gameFlags } from './GameFlags.ts';
import { resolveDynamicObjectGfx } from './DynamicObjectGfx.ts';
import { npcMovementEngine } from './npc/NPCMovementEngine.ts';
import { incrementRuntimePerfCounter } from './perf/runtimePerfRecorder.ts';
import { resolveBerryTreeId } from './berry/berryConstants.ts';
import { resolveTrainerDisguiseType } from './trainers/trainerDisguise.ts';

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

// C parity refs:
// - public/pokeemerald/include/fieldmap.h (MAP_OFFSET, MAP_OFFSET_W, MAP_OFFSET_H)
// - public/pokeemerald/src/event_object_movement.c
//   - TrySpawnObjectEvents
//   - RemoveObjectEventsOutsideView
const MAP_OFFSET = 7;
const MAP_OFFSET_W = MAP_OFFSET * 2 + 1;
const MAP_OFFSET_H = MAP_OFFSET * 2;
const VIEWPORT_SPAWN_MARGIN_TILES = 2;

function isScriptAddressableLargeObject(
  obj: ObjectEventData,
  resolvedGraphicsId: string
): boolean {
  return (
    isLargeObjectGraphicsId(resolvedGraphicsId)
    && typeof obj.local_id === 'string'
    && obj.local_id.length > 0
  );
}

interface ObjectEventViewWindow {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface VisibleObjectEventSnapshot {
  npcs: NPCObject[];
  itemBalls: ItemBallObject[];
  scriptObjects: ScriptObject[];
  largeObjects: LargeObject[];
}

function getMapIdFromNpcObjectId(id: string): string | null {
  const marker = '_npc_';
  const idx = id.indexOf(marker);
  if (idx <= 0) return null;
  return id.slice(0, idx);
}

function getNowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function hasBuriedMovementType(movementTypeRaw: string): boolean {
  return movementTypeRaw.includes('BURIED');
}

interface PersistedBuriedTrainerState {
  localTileX: number;
  localTileY: number;
  localInitialTileX: number;
  localInitialTileY: number;
  direction: NPCDirection;
  movementTypeRaw: string;
}

export class ObjectEventManager {
  private itemBalls: Map<string, ItemBallObject> = new Map();
  private npcs: Map<string, NPCObject> = new Map();
  private scriptObjects: Map<string, ScriptObject> = new Map();
  private largeObjects: Map<string, LargeObject> = new Map();
  private bgEvents: Map<string, ProcessedBgEvent> = new Map();
  private offscreenDespawnedNpcIds: Set<string> = new Set();
  private offscreenDespawnedItemIds: Set<string> = new Set();
  private offscreenDespawnedScriptObjectIds: Set<string> = new Set();
  private offscreenDespawnedLargeObjectIds: Set<string> = new Set();
  private lastObjectEventViewWindow: ObjectEventViewWindow | null = null;
  private lastProcessedViewWindow: ObjectEventViewWindow | null = null;
  private tileElevationResolver: TileElevationResolver | null = null;
  private parsedMapIds: Set<string> = new Set();
  private parsedMapOffsets = new Map<string, { x: number; y: number }>();
  private persistedRevealedBuriedTrainers = new Map<string, Map<string, PersistedBuriedTrainerState>>();
  private spawnDespawnDirty = true;
  private visibleCacheVersion = 0;
  private visibleNpcCacheVersion = -1;
  private visibleNpcCache: NPCObject[] = [];
  private visibleItemCacheVersion = -1;
  private visibleItemCache: ItemBallObject[] = [];
  private visibleScriptObjectCacheVersion = -1;
  private visibleScriptObjectCache: ScriptObject[] = [];
  private visibleLargeObjectCacheVersion = -1;
  private visibleLargeObjectCache: LargeObject[] = [];
  private visibleSnapshotCacheVersion = -1;
  private visibleSnapshotCache: VisibleObjectEventSnapshot | null = null;

  markSpawnDespawnDirty(): void {
    this.spawnDespawnDirty = true;
    this.lastProcessedViewWindow = null;
  }

  private invalidateVisibleObjectCaches(): void {
    this.visibleCacheVersion += 1;
    this.visibleSnapshotCacheVersion = -1;
    this.visibleSnapshotCache = null;
  }

  private markObjectStateDirty(): void {
    this.markSpawnDespawnDirty();
    this.invalidateVisibleObjectCaches();
  }

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
    this.offscreenDespawnedNpcIds.clear();
    this.offscreenDespawnedItemIds.clear();
    this.offscreenDespawnedScriptObjectIds.clear();
    this.offscreenDespawnedLargeObjectIds.clear();
    this.lastObjectEventViewWindow = null;
    this.lastProcessedViewWindow = null;
    this.parsedMapIds.clear();
    this.parsedMapOffsets.clear();
    this.persistedRevealedBuriedTrainers.clear();
    this.spawnDespawnDirty = true;
    this.invalidateVisibleObjectCaches();
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
   * Get the world offset that was used when a map's objects were parsed.
   */
  getMapOffset(mapId: string): { x: number; y: number } | null {
    return this.parsedMapOffsets.get(mapId) ?? null;
  }

  private createDisguiseStateForMovementType(movementTypeRaw: string): NPCDisguiseState | null {
    const type = resolveTrainerDisguiseType(movementTypeRaw);
    if (!type) return null;
    return {
      type,
      active: true,
      revealing: false,
      revealStartedAtMs: null,
    };
  }

  private syncNpcDisguiseState(npc: NPCObject): void {
    const type = resolveTrainerDisguiseType(npc.movementTypeRaw);
    if (!type) {
      npc.disguiseState = null;
      return;
    }

    if (!npc.disguiseState || npc.disguiseState.type !== type) {
      npc.disguiseState = {
        type,
        active: npc.spriteHidden,
        revealing: false,
        revealStartedAtMs: null,
      };
      return;
    }

    if (!npc.spriteHidden) {
      npc.disguiseState.active = false;
      npc.disguiseState.revealing = false;
      npc.disguiseState.revealStartedAtMs = null;
      return;
    }

    if (!npc.disguiseState.revealing) {
      npc.disguiseState.active = true;
      npc.disguiseState.revealStartedAtMs = null;
    }
  }

  /**
   * Shift all objects belonging to a map by a tile delta.
   * Used when world stitching changes a persisted map's offset.
   */
  repositionMapObjects(mapId: string, dx: number, dy: number): void {
    const prefix = `${mapId}_`;
    for (const [key, npc] of this.npcs) {
      if (!key.startsWith(prefix)) continue;
      npc.tileX += dx;
      npc.tileY += dy;
      npc.initialTileX += dx;
      npc.initialTileY += dy;
    }
    for (const [key, item] of this.itemBalls) {
      if (!key.startsWith(prefix)) continue;
      item.tileX += dx;
      item.tileY += dy;
    }
    for (const [key, obj] of this.scriptObjects) {
      if (!key.startsWith(prefix)) continue;
      obj.tileX += dx;
      obj.tileY += dy;
    }
    for (const [key, obj] of this.largeObjects) {
      if (!key.startsWith(prefix)) continue;
      obj.tileX += dx;
      obj.tileY += dy;
    }
    for (const [key, bg] of this.bgEvents) {
      if (!key.startsWith(prefix)) continue;
      bg.tileX += dx;
      bg.tileY += dy;
    }
    // Update stored offset to new value
    const old = this.parsedMapOffsets.get(mapId);
    if (old) {
      this.parsedMapOffsets.set(mapId, { x: old.x + dx, y: old.y + dy });
    }
    this.markSpawnDespawnDirty();
  }

  /**
   * Remove all objects belonging to a specific map.
   * Entries are keyed with the mapId prefix (e.g. "MAP_ROUTE_101_npc_...").
   */
  removeMapObjects(mapId: string): void {
    const prefix = `${mapId}_`;
    const mapOffset = this.parsedMapOffsets.get(mapId) ?? null;
    const revealedBuriedStateForMap = new Map<string, PersistedBuriedTrainerState>();
    for (const [key, npc] of this.npcs) {
      if (!key.startsWith(prefix)) continue;
      if (npc.trainerType !== 'buried' || npc.spriteHidden) continue;
      const localKey = npc.localId ?? String(npc.localIdNumber);
      revealedBuriedStateForMap.set(localKey, {
        localTileX: mapOffset ? npc.tileX - mapOffset.x : npc.tileX,
        localTileY: mapOffset ? npc.tileY - mapOffset.y : npc.tileY,
        localInitialTileX: mapOffset ? npc.initialTileX - mapOffset.x : npc.initialTileX,
        localInitialTileY: mapOffset ? npc.initialTileY - mapOffset.y : npc.initialTileY,
        direction: npc.direction,
        movementTypeRaw: npc.movementTypeRaw,
      });
    }
    if (revealedBuriedStateForMap.size > 0) {
      this.persistedRevealedBuriedTrainers.set(mapId, revealedBuriedStateForMap);
    } else {
      this.persistedRevealedBuriedTrainers.delete(mapId);
    }

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
    this.clearOffscreenStateForMap(mapId);
    this.parsedMapIds.delete(mapId);
    this.parsedMapOffsets.delete(mapId);
    this.markObjectStateDirty();
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
    mapOffsetY: number,
    playerGender: 0 | 1 = 0
  ): void {
    this.parsedMapIds.add(mapId);
    this.parsedMapOffsets.set(mapId, { x: mapOffsetX, y: mapOffsetY });

    for (let objIndex = 0; objIndex < objectEvents.length; objIndex++) {
      const obj = objectEvents[objIndex];
      if (isDecorationSlotPlaceholder(obj)) continue;
      const resolvedGraphicsId = resolveDynamicObjectGfx(obj.graphics_id, playerGender);
      const parseAsNpcStyleObject = isScriptAddressableLargeObject(obj, resolvedGraphicsId);
      // Convert local coordinates to world coordinates
      let worldX = mapOffsetX + obj.x;
      let worldY = mapOffsetY + obj.y;

      // C parity: large object templates with a local_id are script-addressable
      // object events. Route those through NPC-style storage so LOCALID script
      // commands (applymovement, removeobject, etc.) can target them directly.
      if (isLargeObjectGraphicsId(resolvedGraphicsId) && !parseAsNpcStyleObject) {
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
        this.offscreenDespawnedLargeObjectIds.delete(id);
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
        this.offscreenDespawnedItemIds.delete(id);
      }
      // Handle NPCs
      else if (parseAsNpcStyleObject || isNPCGraphicsId(resolvedGraphicsId)) {
        // Create unique ID
        // GBA: local IDs are 1-indexed array positions. Auto-assign if not explicit.
        const localId = obj.local_id ?? String(objIndex + 1);
        const id = `${mapId}_npc_${localId}`;

        // Check visibility from flag
        // NPCs with FLAG_HIDE_* are hidden when the flag IS set
        const isHidden = obj.flag && obj.flag !== '0' ? gameFlags.isSet(obj.flag) : false;

        // Parse trainer sight range (could be "0" or a number)
        const trainerSightRange = parseInt(obj.trainer_sight_or_berry_tree_id, 10) || 0;

        const trainerType = parseTrainerType(obj.trainer_type);
        const isBuriedTrainer =
          trainerType === 'buried'
          || hasBuriedMovementType(obj.movement_type);

        const revealedBuriedStateByLocalId = this.persistedRevealedBuriedTrainers.get(mapId);
        const persistedBuriedState = isBuriedTrainer
          ? (
              revealedBuriedStateByLocalId?.get(localId)
              ?? revealedBuriedStateByLocalId?.get(String(objIndex + 1))
              ?? null
            )
          : null;
        const movementTypeRaw = persistedBuriedState?.movementTypeRaw ?? obj.movement_type;
        const resolvedMovementType = parseMovementType(movementTypeRaw);
        if (persistedBuriedState) {
          worldX = mapOffsetX + persistedBuriedState.localTileX;
          worldY = mapOffsetY + persistedBuriedState.localTileY;
        }

        const disguiseState = this.createDisguiseStateForMovementType(obj.movement_type);
        const spriteHidden = persistedBuriedState
          ? false
          : (resolvedMovementType === 'invisible' || disguiseState !== null || isBuriedTrainer);
        this.npcs.set(id, {
          id,
          localId,
          localIdNumber: objIndex + 1,
          tileX: worldX,
          tileY: worldY,
          elevation: obj.elevation,
          graphicsId: resolvedGraphicsId,
          direction: persistedBuriedState?.direction ?? getInitialDirection(movementTypeRaw),
          movementType: resolvedMovementType,
          movementTypeRaw,
          movementRangeX: obj.movement_range_x,
          movementRangeY: obj.movement_range_y,
          trainerType,
          trainerSightRange,
          script: obj.script,
          flag: obj.flag,
          visible: !isHidden,
          spriteHidden,
          scriptRemoved: false,
          renderAboveGrass: false,
          disguiseState,
          tintR: 1,
          tintG: 1,
          tintB: 1,
          // Movement state fields
          subTileX: 0,
          subTileY: 0,
          isWalking: false,
          initialTileX: persistedBuriedState
            ? mapOffsetX + persistedBuriedState.localInitialTileX
            : worldX,
          initialTileY: persistedBuriedState
            ? mapOffsetY + persistedBuriedState.localInitialTileY
            : worldY,
        });
        this.offscreenDespawnedNpcIds.delete(id);
      }
      // Handle scripted non-NPC objects (e.g. Birch's bag)
      else if (obj.script && obj.script !== '0x0') {
        const localId = obj.local_id ?? null;
        const parsedLocalIdNumber = localId !== null ? Number.parseInt(localId, 10) : NaN;
        // C parity: local IDs are effectively 1-indexed template positions when not explicit.
        const localIdNumber = Number.isFinite(parsedLocalIdNumber) ? parsedLocalIdNumber : (objIndex + 1);
        const id = localId
          ? `${mapId}_script_${localId}`
          : `${mapId}_script_${worldX}_${worldY}`;

        const isHidden = obj.flag && obj.flag !== '0' ? gameFlags.isSet(obj.flag) : false;
        const berryTreeId = resolvedGraphicsId === 'OBJ_EVENT_GFX_BERRY_TREE'
          ? resolveBerryTreeId(obj.trainer_sight_or_berry_tree_id)
          : 0;

        this.scriptObjects.set(id, {
          id,
          mapId,
          localId,
          localIdNumber,
          tileX: worldX,
          tileY: worldY,
          elevation: obj.elevation,
          graphicsId: resolvedGraphicsId,
          script: obj.script,
          flag: obj.flag,
          visible: !isHidden,
          berryTreeId,
        });
        this.offscreenDespawnedScriptObjectIds.delete(id);
      }
      // Future: handle other object types (berry trees, etc.)
    }
    this.markObjectStateDirty();
  }

  /**
   * Get all visible (not collected) item balls
   */
  getVisibleItemBalls(): ItemBallObject[] {
    if (this.visibleItemCacheVersion !== this.visibleCacheVersion) {
      const rebuilt: ItemBallObject[] = [];
      for (const ball of this.itemBalls.values()) {
        if (ball.collected || this.offscreenDespawnedItemIds.has(ball.id)) continue;
        rebuilt.push(ball);
      }
      this.visibleItemCache = rebuilt;
      this.visibleItemCacheVersion = this.visibleCacheVersion;
      incrementRuntimePerfCounter('visibleListRebuilds');
    }
    return this.visibleItemCache;
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
      if (
        ball.tileX === tileX
        && ball.tileY === tileY
        && !ball.collected
        && !this.offscreenDespawnedItemIds.has(ball.id)
      ) {
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
    this.offscreenDespawnedItemIds.delete(id);

    // Set the flag if it exists
    if (ball.flag && ball.flag !== '0') {
      gameFlags.set(ball.flag);
    }

    this.invalidateVisibleObjectCaches();
    this.markSpawnDespawnDirty();

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
      const marker = '_item_';
      const markerIdx = itemBall.id.indexOf(marker);
      const mapId = markerIdx > 0 ? itemBall.id.slice(0, markerIdx) : '';
      // Story item ball (e.g. RivalsPokeBall) — route through script system
      return {
        type: 'script',
        data: {
          id: itemBall.id,
          mapId,
          localId: null,
          localIdNumber: null,
          tileX: itemBall.tileX,
          tileY: itemBall.tileY,
          elevation: itemBall.elevation,
          graphicsId: OBJ_EVENT_GFX_ITEM_BALL,
          script: itemBall.script,
          flag: itemBall.flag,
          visible: !itemBall.collected,
          berryTreeId: 0,
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
   * Reconcile object state from flags after load/save boundaries.
   *
   * C refs:
   * - public/pokeemerald/src/scrcmd.c (ScrCmd_setflag / ScrCmd_clearflag only mutate flags)
   * - public/pokeemerald/src/event_object_movement.c (TrySpawnObjectEvents checks hide flags on spawn)
   *
   * Use this for load/reconcile boundaries (map load, save load).
   * Runtime script completion should call refreshPostScriptState(), not this method.
   */
  refreshCollectedState(): void {
    for (const ball of this.itemBalls.values()) {
      ball.collected = ball.flag && ball.flag !== '0' ? gameFlags.isSet(ball.flag) : false;
      if (ball.collected) {
        this.offscreenDespawnedItemIds.delete(ball.id);
      }
    }
    this.refreshBgEventState();
    this.markObjectStateDirty();
  }

  /**
   * Reconcile one map from flags at map-entry boundaries.
   *
   * C refs:
   * - public/pokeemerald/src/overworld.c
   *   - RunOnTransitionMapScript executes before object spawning on map entry.
   * - public/pokeemerald/src/event_object_movement.c
   *   - TrySpawnObjectEvents / TrySpawnObjectEventTemplate derive object presence from flags.
   *
   * This lets ON_TRANSITION setflag/clearflag changes affect the freshly entered
   * map before runtime spawning logic runs for that map.
   */
  refreshMapLoadState(mapId: string): void {
    const itemPrefix = `${mapId}_item_`;
    const npcPrefix = `${mapId}_npc_`;
    const scriptPrefix = `${mapId}_script_`;
    const largePrefix = `${mapId}_large_`;
    const bgPrefix = `${mapId}_bg_`;

    for (const [id, ball] of this.itemBalls) {
      if (!id.startsWith(itemPrefix)) continue;
      ball.collected = ball.flag && ball.flag !== '0' ? gameFlags.isSet(ball.flag) : false;
      if (ball.collected) {
        this.offscreenDespawnedItemIds.delete(ball.id);
      }
    }

    for (const [id, bg] of this.bgEvents) {
      if (!id.startsWith(bgPrefix)) continue;
      if (bg.type === 'hidden_item') {
        bg.collected = bg.flag && bg.flag !== '0' ? gameFlags.isSet(bg.flag) : false;
      }
    }

    for (const [id, npc] of this.npcs) {
      if (!id.startsWith(npcPrefix)) continue;
      // Preserve runtime removeobject/addobject state while map is still live.
      if (npc.scriptRemoved) continue;
      npc.visible = !(npc.flag && npc.flag !== '0' ? gameFlags.isSet(npc.flag) : false);
      if (!npc.visible) {
        this.offscreenDespawnedNpcIds.delete(npc.id);
        npcMovementEngine.removeNPC(npc.id);
      }
    }

    for (const [id, scriptObject] of this.scriptObjects) {
      if (!id.startsWith(scriptPrefix)) continue;
      scriptObject.visible = !(scriptObject.flag && scriptObject.flag !== '0' ? gameFlags.isSet(scriptObject.flag) : false);
      if (!scriptObject.visible) {
        this.offscreenDespawnedScriptObjectIds.delete(scriptObject.id);
      }
    }

    for (const [id, largeObject] of this.largeObjects) {
      if (!id.startsWith(largePrefix)) continue;
      largeObject.visible = !(largeObject.flag && largeObject.flag !== '0' ? gameFlags.isSet(largeObject.flag) : false);
      if (!largeObject.visible) {
        this.offscreenDespawnedLargeObjectIds.delete(largeObject.id);
      }
    }
    this.markObjectStateDirty();
  }

  /**
   * Runtime-safe post-script refresh.
   *
   * C parity:
   * - setflag/clearflag (ScrCmd_setflag/ScrCmd_clearflag) do not immediately
   *   despawn already-spawned object events.
   * - removeobject/addobject flow and per-frame TrySpawnObjectEvents drive
   *   immediate runtime object presence changes.
   */
  refreshPostScriptState(): void {
    this.refreshBgEventState();
    this.respawnFlagClearedNPCs();
  }

  // === NPC Methods ===

  /**
   * Get all visible NPCs
   */
  getVisibleNPCs(): NPCObject[] {
    if (this.visibleNpcCacheVersion !== this.visibleCacheVersion) {
      const rebuilt: NPCObject[] = [];
      for (const npc of this.npcs.values()) {
        if (!npc.visible || this.offscreenDespawnedNpcIds.has(npc.id)) continue;
        rebuilt.push(npc);
      }
      this.visibleNpcCache = rebuilt;
      this.visibleNpcCacheVersion = this.visibleCacheVersion;
      incrementRuntimePerfCounter('visibleListRebuilds');
    }
    return this.visibleNpcCache;
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
    const direct = this.npcs.get(key);
    if (direct) return direct;

    if (/^\d+$/.test(localId)) {
      const numericLocalId = Number.parseInt(localId, 10);
      const byNumericLocalId = this.findNPCByNumericLocalId(mapId, numericLocalId);
      if (byNumericLocalId) return byNumericLocalId;
    }

    return null;
  }

  /**
   * Set an NPC's tile position by map-local ID.
   */
  setNPCPositionByLocalId(
    mapId: string,
    localId: string,
    tileX: number,
    tileY: number,
    options?: { updateInitialPosition?: boolean }
  ): boolean {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc) return false;

    npc.tileX = tileX;
    npc.tileY = tileY;
    // C parity:
    // - setobjectxy moves runtime/current coords only.
    // - template coords (spawn/initial) are only changed by setobjectxyperm/copyobjectxytoperm.
    if (options?.updateInitialPosition) {
      npc.initialTileX = tileX;
      npc.initialTileY = tileY;
    }
    npc.subTileX = 0;
    npc.subTileY = 0;
    npc.isWalking = false;
    return true;
  }

  /**
   * Update an NPC's template/spawn tile without moving its current runtime tile.
   * Used by setobjectxyperm/copyobjectxytoperm parity.
   */
  setNPCTemplatePositionByLocalId(
    mapId: string,
    localId: string,
    tileX: number,
    tileY: number
  ): boolean {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc) return false;
    npc.initialTileX = tileX;
    npc.initialTileY = tileY;
    return true;
  }

  /**
   * Set an NPC's visibility by map-local ID.
   */
  setNPCVisibilityByLocalId(mapId: string, localId: string, visible: boolean, persistent: boolean = false): boolean {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc) return false;
    const wasVisible = npc.visible;
    npc.visible = visible;
    this.offscreenDespawnedNpcIds.delete(npc.id);
    if (!visible) {
      npcMovementEngine.removeNPC(npc.id);
    } else if (!wasVisible) {
      // C parity: addobject/showobjectat respawn from template coords.
      this.resetNpcRuntimeSpawnState(npc);
    }
    // Track runtime script removal so refreshNPCVisibility won't undo it.
    npc.scriptRemoved = !visible;
    // Optional persistent sync for callers that explicitly want visibility
    // written to FLAG_HIDE_* for map reload behavior.
    if (persistent && npc.flag && npc.flag !== '0') {
      if (visible) gameFlags.clear(npc.flag);
      else gameFlags.set(npc.flag);
    }
    this.markObjectStateDirty();
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
    this.syncNpcDisguiseState(npc);
    return true;
  }

  /**
   * Toggle script-controlled grass-priority rendering for an NPC.
   */
  setNPCRenderAboveGrassByLocalId(mapId: string, localId: string, renderAboveGrass: boolean): boolean {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc) return false;
    npc.renderAboveGrass = renderAboveGrass;
    return true;
  }

  /**
   * Set per-NPC render tint (0..1 RGB), used for scripted palette-like effects.
   */
  setNPCTintByLocalId(mapId: string, localId: string, tintR: number, tintG: number, tintB: number): boolean {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc) return false;
    npc.tintR = tintR;
    npc.tintG = tintG;
    npc.tintB = tintB;
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
   *
   * C parity:
   * - setobjectmovementtype updates template movement type only
   *   (see SetObjEventTemplateMovementType in overworld.c).
   * - It must NOT overwrite template coords set via setobjectxyperm.
   */
  setNPCMovementTypeByLocalId(
    mapId: string,
    localId: string,
    movementTypeRaw: string
  ): boolean {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc) return false;
    const disguiseType = resolveTrainerDisguiseType(movementTypeRaw);
    npc.movementType = parseMovementType(movementTypeRaw);
    npc.movementTypeRaw = movementTypeRaw;
    if (disguiseType || hasBuriedMovementType(movementTypeRaw)) {
      npc.spriteHidden = true;
    }
    this.syncNpcDisguiseState(npc);
    npc.direction = getInitialDirection(movementTypeRaw);
    npc.isWalking = false;
    npc.subTileX = 0;
    npc.subTileY = 0;
    // Reset the movement engine's cached state so it re-initializes
    // with the new movement type and position on next update.
    npcMovementEngine.removeNPC(npc.id);
    return true;
  }

  /**
   * Begin reveal animation for tree/mountain disguised trainers.
   * Keeps the trainer sprite hidden while the disguise overlay animates.
   */
  startNPCDisguiseRevealByLocalId(mapId: string, localId: string): boolean {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc || !npc.disguiseState) return false;
    npc.spriteHidden = true;
    npc.disguiseState.active = true;
    npc.disguiseState.revealing = true;
    npc.disguiseState.revealStartedAtMs = getNowMs();
    return true;
  }

  /**
   * Finish reveal animation and unhide trainer sprite.
   */
  completeNPCDisguiseRevealByLocalId(mapId: string, localId: string): boolean {
    const npc = this.getNPCByLocalId(mapId, localId);
    if (!npc || !npc.disguiseState) return false;
    npc.disguiseState.active = false;
    npc.disguiseState.revealing = false;
    npc.disguiseState.revealStartedAtMs = null;
    npc.spriteHidden = false;
    return true;
  }

  /**
   * Get NPC collision occupancy tiles.
   * Matches pokeemerald currentCoords + previousCoords checks while moving.
   */
  private getNPCCollisionCoords(npc: NPCObject): Array<{ x: number; y: number }> {
    const occupied = [{ x: npc.tileX, y: npc.tileY }];
    if (!npc.isWalking || (npc.subTileX === 0 && npc.subTileY === 0)) {
      return occupied;
    }

    const prevX = npc.tileX + Math.sign(npc.subTileX);
    const prevY = npc.tileY + Math.sign(npc.subTileY);
    if (prevX !== npc.tileX || prevY !== npc.tileY) {
      occupied.push({ x: prevX, y: prevY });
    }
    return occupied;
  }

  getNPCAt(tileX: number, tileY: number): NPCObject | null {
    for (const npc of this.npcs.values()) {
      if (!npc.visible || this.offscreenDespawnedNpcIds.has(npc.id)) {
        continue;
      }
      for (const occupied of this.getNPCCollisionCoords(npc)) {
        if (occupied.x === tileX && occupied.y === tileY) {
          return npc;
        }
      }
    }
    return null;
  }

  /**
   * Check if there's a blocking NPC at a position.
   * Uses current+previous occupancy while NPC is moving.
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
      if (
        ball.tileX === tileX
        && ball.tileY === tileY
        && !ball.collected
        && !this.offscreenDespawnedItemIds.has(ball.id)
      ) {
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
    let changed = false;
    for (const npc of this.npcs.values()) {
      // Skip NPCs whose visibility was changed at runtime by removeobject/addobject.
      // Their state is authoritative until the next map load.
      if (npc.scriptRemoved) continue;
      // NPCs with FLAG_HIDE_* are hidden when the flag IS set
      const nextVisible = !(npc.flag && npc.flag !== '0' ? gameFlags.isSet(npc.flag) : false);
      if (npc.visible !== nextVisible) changed = true;
      npc.visible = nextVisible;
      if (!npc.visible) {
        if (this.offscreenDespawnedNpcIds.delete(npc.id)) changed = true;
      }
    }
    if (changed) this.markObjectStateDirty();
  }

  /**
   * Reset scriptRemoved state for all NPCs on a map and re-derive visibility
   * from flags. Called during warp transitions for maps that persist in the
   * snapshot, simulating the C engine's behavior of respawning NPCs fresh on
   * every map load.
   */
  resetScriptRemovedState(mapId: string): void {
    const prefix = `${mapId}_npc_`;
    this.clearOffscreenStateForMap(mapId);
    let changed = false;
    for (const [key, npc] of this.npcs) {
      if (!key.startsWith(prefix)) continue;
      if (npc.scriptRemoved) changed = true;
      npc.scriptRemoved = false;
      const nextVisible = !(npc.flag && npc.flag !== '0' ? gameFlags.isSet(npc.flag) : false);
      if (npc.visible !== nextVisible) changed = true;
      npc.visible = nextVisible;
    }
    if (changed) this.markObjectStateDirty();
  }

  /**
   * C parity respawn check for removeobject + clearflag flow.
   * Ref: TrySpawnObjectEvents in event_object_movement.c.
   */
  respawnFlagClearedNPCs(): void {
    const viewWindow = this.lastObjectEventViewWindow;
    let changed = false;
    for (const npc of this.npcs.values()) {
      if (!npc.scriptRemoved) continue;
      // If the flag is clear (or NPC has no flag), it should be visible
      const shouldBeHidden = npc.flag && npc.flag !== '0' ? gameFlags.isSet(npc.flag) : false;
      if (!shouldBeHidden) {
        if (viewWindow && !this.isWithinObjectEventView(npc.initialTileX, npc.initialTileY, viewWindow)) {
          continue;
        }
        this.resetNpcRuntimeSpawnState(npc);
        npc.visible = true;
        npc.scriptRemoved = false;
        if (this.offscreenDespawnedNpcIds.delete(npc.id)) changed = true;
        changed = true;
      }
    }
    if (changed) this.markObjectStateDirty();
  }

  /**
   * Get all visible scripted objects.
   */
  getVisibleScriptObjects(): ScriptObject[] {
    if (this.visibleScriptObjectCacheVersion !== this.visibleCacheVersion) {
      const rebuilt: ScriptObject[] = [];
      for (const obj of this.scriptObjects.values()) {
        if (!obj.visible || this.offscreenDespawnedScriptObjectIds.has(obj.id)) continue;
        rebuilt.push(obj);
      }
      this.visibleScriptObjectCache = rebuilt;
      this.visibleScriptObjectCacheVersion = this.visibleCacheVersion;
      incrementRuntimePerfCounter('visibleListRebuilds');
    }
    return this.visibleScriptObjectCache;
  }

  /**
   * Get scripted object at specific tile.
   */
  getScriptObjectAt(tileX: number, tileY: number): ScriptObject | null {
    for (const scriptObject of this.scriptObjects.values()) {
      if (
        scriptObject.visible
        && scriptObject.tileX === tileX
        && scriptObject.tileY === tileY
        && !this.offscreenDespawnedScriptObjectIds.has(scriptObject.id)
      ) {
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
    let changed = false;
    for (const scriptObject of this.scriptObjects.values()) {
      const nextVisible = !(scriptObject.flag && scriptObject.flag !== '0' ? gameFlags.isSet(scriptObject.flag) : false);
      if (scriptObject.visible !== nextVisible) changed = true;
      scriptObject.visible = nextVisible;
      if (!scriptObject.visible) {
        if (this.offscreenDespawnedScriptObjectIds.delete(scriptObject.id)) changed = true;
      }
    }
    if (changed) this.markObjectStateDirty();
  }

  // === Large Object Methods ===

  /**
   * Get all visible large objects (e.g. truck)
   */
  getVisibleLargeObjects(): LargeObject[] {
    if (this.visibleLargeObjectCacheVersion !== this.visibleCacheVersion) {
      const rebuilt: LargeObject[] = [];
      for (const obj of this.largeObjects.values()) {
        if (!obj.visible || this.offscreenDespawnedLargeObjectIds.has(obj.id)) continue;
        rebuilt.push(obj);
      }
      this.visibleLargeObjectCache = rebuilt;
      this.visibleLargeObjectCacheVersion = this.visibleCacheVersion;
      incrementRuntimePerfCounter('visibleListRebuilds');
    }
    return this.visibleLargeObjectCache;
  }

  getVisibleObjectsSnapshot(): VisibleObjectEventSnapshot {
    if (this.visibleSnapshotCacheVersion === this.visibleCacheVersion && this.visibleSnapshotCache) {
      return this.visibleSnapshotCache;
    }
    const snapshot: VisibleObjectEventSnapshot = {
      npcs: this.getVisibleNPCs(),
      itemBalls: this.getVisibleItemBalls(),
      scriptObjects: this.getVisibleScriptObjects(),
      largeObjects: this.getVisibleLargeObjects(),
    };
    this.visibleSnapshotCache = snapshot;
    this.visibleSnapshotCacheVersion = this.visibleCacheVersion;
    return snapshot;
  }

  /**
   * Per-frame C-style object-event spawn/despawn scheduling based on view bounds.
   *
   * Ref: UpdateObjectEventsForCameraUpdate -> TrySpawnObjectEvents +
   * RemoveObjectEventsOutsideView in event_object_movement.c.
   */
  updateObjectEventSpawnDespawn(
    playerTileX: number,
    playerTileY: number,
    viewportTilesWide?: number,
    viewportTilesHigh?: number
  ): void {
    const viewWindow = this.getObjectEventViewWindowForPlayer(
      playerTileX,
      playerTileY,
      viewportTilesWide,
      viewportTilesHigh
    );
    this.lastObjectEventViewWindow = viewWindow;
    if (
      !this.spawnDespawnDirty
      && this.lastProcessedViewWindow
      && this.isSameViewWindow(this.lastProcessedViewWindow, viewWindow)
    ) {
      return;
    }
    const changed =
      this.trySpawnObjectsInView(viewWindow)
      || this.removeObjectsOutsideView(viewWindow);
    this.lastProcessedViewWindow = viewWindow;
    this.spawnDespawnDirty = false;
    if (changed) this.invalidateVisibleObjectCaches();
  }

  /**
   * Per-frame object-event spawn/despawn scheduling based on camera origin.
   *
   * Mirrors the C camera-window formulas directly:
   * left = pos.x - 2
   * right = pos.x + viewportWidth + 2
   * top = pos.y
   * bottom = pos.y + viewportHeight + 2
   */
  updateObjectEventSpawnDespawnForCamera(
    cameraStartTileX: number,
    cameraStartTileY: number,
    viewportTilesWide: number,
    viewportTilesHigh: number
  ): void {
    const viewWindow = this.getObjectEventViewWindowForCamera(
      cameraStartTileX,
      cameraStartTileY,
      viewportTilesWide,
      viewportTilesHigh
    );
    this.lastObjectEventViewWindow = viewWindow;
    if (
      !this.spawnDespawnDirty
      && this.lastProcessedViewWindow
      && this.isSameViewWindow(this.lastProcessedViewWindow, viewWindow)
    ) {
      return;
    }
    const changed =
      this.trySpawnObjectsInView(viewWindow)
      || this.removeObjectsOutsideView(viewWindow);
    this.lastProcessedViewWindow = viewWindow;
    this.spawnDespawnDirty = false;
    if (changed) this.invalidateVisibleObjectCaches();
  }

  /**
   * Refresh large object visibility from flags
   */
  refreshLargeObjectVisibility(): void {
    let changed = false;
    for (const obj of this.largeObjects.values()) {
      const nextVisible = !(obj.flag && obj.flag !== '0' ? gameFlags.isSet(obj.flag) : false);
      if (obj.visible !== nextVisible) changed = true;
      obj.visible = nextVisible;
      if (!obj.visible) {
        if (this.offscreenDespawnedLargeObjectIds.delete(obj.id)) changed = true;
      }
    }
    if (changed) this.markObjectStateDirty();
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

  /**
   * Capture mutable object-event runtime state for save/load.
   *
   * Includes temporary script-driven changes (setobjectxy/removeobject/etc.)
   * that are not represented by persistent FLAG_HIDE_* data alone.
   */
  getRuntimeState(): ObjectEventRuntimeState {
    let canEncodeAsMapLocal = true;
    for (const id of this.npcs.keys()) {
      const mapId = getMapIdFromNpcObjectId(id);
      if (!mapId || !this.parsedMapOffsets.has(mapId)) {
        canEncodeAsMapLocal = false;
        break;
      }
    }

    const npcs: ObjectEventRuntimeState['npcs'] = {};
    for (const [id, npc] of this.npcs) {
      const mapId = getMapIdFromNpcObjectId(id);
      const mapOffset = mapId ? this.parsedMapOffsets.get(mapId) ?? null : null;
      const tileX = canEncodeAsMapLocal && mapOffset ? npc.tileX - mapOffset.x : npc.tileX;
      const tileY = canEncodeAsMapLocal && mapOffset ? npc.tileY - mapOffset.y : npc.tileY;
      const initialTileX = canEncodeAsMapLocal && mapOffset
        ? npc.initialTileX - mapOffset.x
        : npc.initialTileX;
      const initialTileY = canEncodeAsMapLocal && mapOffset
        ? npc.initialTileY - mapOffset.y
        : npc.initialTileY;
      npcs[id] = {
        tileX,
        tileY,
        initialTileX,
        initialTileY,
        direction: npc.direction,
        visible: npc.visible,
        spriteHidden: npc.spriteHidden,
        scriptRemoved: npc.scriptRemoved,
        renderAboveGrass: npc.renderAboveGrass,
        movementTypeRaw: npc.movementTypeRaw,
      };
    }

    const itemBalls: ObjectEventRuntimeState['itemBalls'] = {};
    for (const [id, ball] of this.itemBalls) {
      itemBalls[id] = { collected: ball.collected };
    }

    const scriptObjects: ObjectEventRuntimeState['scriptObjects'] = {};
    for (const [id, scriptObject] of this.scriptObjects) {
      scriptObjects[id] = { visible: scriptObject.visible };
    }

    const largeObjects: ObjectEventRuntimeState['largeObjects'] = {};
    for (const [id, largeObject] of this.largeObjects) {
      largeObjects[id] = { visible: largeObject.visible };
    }

    return {
      version: 1,
      coordSpace: canEncodeAsMapLocal ? 'mapLocal' : 'world',
      npcs,
      itemBalls,
      scriptObjects,
      largeObjects,
      offscreenDespawnedNpcIds: [...this.offscreenDespawnedNpcIds],
      offscreenDespawnedItemIds: [...this.offscreenDespawnedItemIds],
      offscreenDespawnedScriptObjectIds: [...this.offscreenDespawnedScriptObjectIds],
      offscreenDespawnedLargeObjectIds: [...this.offscreenDespawnedLargeObjectIds],
    };
  }

  /**
   * Restore previously captured runtime state after map/object parsing.
   */
  applyRuntimeState(state: ObjectEventRuntimeState): void {
    if (!state || state.version !== 1) return;
    const coordSpace = state.coordSpace ?? 'world';

    for (const [id, snapshot] of Object.entries(state.npcs ?? {})) {
      const npc = this.resolveNpcByRuntimeStateId(id);
      if (!npc) continue;

      const stateMapId = getMapIdFromNpcObjectId(id) ?? getMapIdFromNpcObjectId(npc.id);
      const stateMapOffset = stateMapId ? this.parsedMapOffsets.get(stateMapId) ?? null : null;
      const toWorldTile = (value: number): number => {
        if (coordSpace === 'mapLocal' && stateMapOffset) {
          return stateMapOffset.y + value;
        }
        return value;
      };
      const toWorldTileX = (value: number): number => {
        if (coordSpace === 'mapLocal' && stateMapOffset) {
          return stateMapOffset.x + value;
        }
        return value;
      };

      if (typeof snapshot.tileX === 'number') npc.tileX = toWorldTileX(snapshot.tileX);
      if (typeof snapshot.tileY === 'number') npc.tileY = toWorldTile(snapshot.tileY);
      if (typeof snapshot.initialTileX === 'number') npc.initialTileX = toWorldTileX(snapshot.initialTileX);
      if (typeof snapshot.initialTileY === 'number') npc.initialTileY = toWorldTile(snapshot.initialTileY);
      if (
        snapshot.direction === 'up'
        || snapshot.direction === 'down'
        || snapshot.direction === 'left'
        || snapshot.direction === 'right'
      ) {
        npc.direction = snapshot.direction;
      }
      npc.visible = snapshot.visible !== false;
      npc.spriteHidden = snapshot.spriteHidden === true;
      npc.scriptRemoved = snapshot.scriptRemoved === true;
      npc.renderAboveGrass = snapshot.renderAboveGrass === true;
      if (typeof snapshot.movementTypeRaw === 'string') {
        npc.movementTypeRaw = snapshot.movementTypeRaw;
        npc.movementType = parseMovementType(snapshot.movementTypeRaw);
      }
      this.syncNpcDisguiseState(npc);
      npc.subTileX = 0;
      npc.subTileY = 0;
      npc.isWalking = false;

      if (!npc.visible) {
        npcMovementEngine.removeNPC(npc.id);
      }
    }

    for (const [id, snapshot] of Object.entries(state.itemBalls ?? {})) {
      const ball = this.itemBalls.get(id);
      if (!ball) continue;
      ball.collected = snapshot.collected === true;
    }

    for (const [id, snapshot] of Object.entries(state.scriptObjects ?? {})) {
      const scriptObject = this.scriptObjects.get(id);
      if (!scriptObject) continue;
      scriptObject.visible = snapshot.visible !== false;
    }

    for (const [id, snapshot] of Object.entries(state.largeObjects ?? {})) {
      const largeObject = this.largeObjects.get(id);
      if (!largeObject) continue;
      largeObject.visible = snapshot.visible !== false;
    }

    this.offscreenDespawnedNpcIds.clear();
    for (const id of state.offscreenDespawnedNpcIds ?? []) {
      const resolvedNpcId = this.resolveExistingNpcIdForRuntimeState(id);
      if (resolvedNpcId) this.offscreenDespawnedNpcIds.add(resolvedNpcId);
    }

    this.offscreenDespawnedItemIds.clear();
    for (const id of state.offscreenDespawnedItemIds ?? []) {
      if (this.itemBalls.has(id)) this.offscreenDespawnedItemIds.add(id);
    }

    this.offscreenDespawnedScriptObjectIds.clear();
    for (const id of state.offscreenDespawnedScriptObjectIds ?? []) {
      if (this.scriptObjects.has(id)) this.offscreenDespawnedScriptObjectIds.add(id);
    }

    this.offscreenDespawnedLargeObjectIds.clear();
    for (const id of state.offscreenDespawnedLargeObjectIds ?? []) {
      if (this.largeObjects.has(id)) this.offscreenDespawnedLargeObjectIds.add(id);
    }
    this.markObjectStateDirty();
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
    this.markSpawnDespawnDirty();
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

  private getObjectEventViewWindowForPlayer(
    playerTileX: number,
    playerTileY: number,
    viewportTilesWide?: number,
    viewportTilesHigh?: number
  ): ObjectEventViewWindow {
    if (
      typeof viewportTilesWide === 'number'
      && typeof viewportTilesHigh === 'number'
      && viewportTilesWide > 0
      && viewportTilesHigh > 0
    ) {
      const halfLeft = Math.floor(viewportTilesWide / 2);
      const halfRight = Math.ceil(viewportTilesWide / 2) - 1;
      const halfTop = Math.floor(viewportTilesHigh / 2);
      const halfBottom = Math.ceil(viewportTilesHigh / 2) - 1;

      return {
        left: playerTileX - halfLeft - VIEWPORT_SPAWN_MARGIN_TILES,
        right: playerTileX + halfRight + VIEWPORT_SPAWN_MARGIN_TILES,
        top: playerTileY - halfTop - VIEWPORT_SPAWN_MARGIN_TILES,
        bottom: playerTileY + halfBottom + VIEWPORT_SPAWN_MARGIN_TILES,
      };
    }

    // C formulas use gSaveBlock1Ptr->pos (camera origin):
    // left = pos.x - 2
    // right = pos.x + MAP_OFFSET_W + 2
    // top = pos.y
    // bottom = pos.y + MAP_OFFSET_H + 2
    // with pos = player - MAP_OFFSET.
    return {
      left: playerTileX - (MAP_OFFSET + 2),
      right: playerTileX + (MAP_OFFSET_W - MAP_OFFSET + 2),
      top: playerTileY - MAP_OFFSET,
      bottom: playerTileY + (MAP_OFFSET_H - MAP_OFFSET + 2),
    };
  }

  private getObjectEventViewWindowForCamera(
    cameraStartTileX: number,
    cameraStartTileY: number,
    viewportTilesWide: number,
    viewportTilesHigh: number
  ): ObjectEventViewWindow {
    return {
      left: cameraStartTileX - VIEWPORT_SPAWN_MARGIN_TILES,
      right: cameraStartTileX + viewportTilesWide + VIEWPORT_SPAWN_MARGIN_TILES,
      top: cameraStartTileY,
      bottom: cameraStartTileY + viewportTilesHigh + VIEWPORT_SPAWN_MARGIN_TILES,
    };
  }

  private isSameViewWindow(a: ObjectEventViewWindow, b: ObjectEventViewWindow): boolean {
    return (
      a.left === b.left
      && a.right === b.right
      && a.top === b.top
      && a.bottom === b.bottom
    );
  }

  private isWithinObjectEventView(tileX: number, tileY: number, viewWindow: ObjectEventViewWindow): boolean {
    return (
      tileX >= viewWindow.left
      && tileX <= viewWindow.right
      && tileY >= viewWindow.top
      && tileY <= viewWindow.bottom
    );
  }

  private clearOffscreenStateForMap(mapId: string): void {
    const prefix = `${mapId}_`;
    let changed = false;
    for (const key of [...this.offscreenDespawnedNpcIds]) {
      if (key.startsWith(prefix) && this.offscreenDespawnedNpcIds.delete(key)) changed = true;
    }
    for (const key of [...this.offscreenDespawnedItemIds]) {
      if (key.startsWith(prefix) && this.offscreenDespawnedItemIds.delete(key)) changed = true;
    }
    for (const key of [...this.offscreenDespawnedScriptObjectIds]) {
      if (key.startsWith(prefix) && this.offscreenDespawnedScriptObjectIds.delete(key)) changed = true;
    }
    for (const key of [...this.offscreenDespawnedLargeObjectIds]) {
      if (key.startsWith(prefix) && this.offscreenDespawnedLargeObjectIds.delete(key)) changed = true;
    }
    if (changed) this.markObjectStateDirty();
  }

  private resetNpcRuntimeSpawnState(npc: NPCObject): void {
    npc.tileX = npc.initialTileX;
    npc.tileY = npc.initialTileY;
    npc.subTileX = 0;
    npc.subTileY = 0;
    npc.isWalking = false;
    npc.direction = getInitialDirection(npc.movementTypeRaw);
    this.syncNpcDisguiseState(npc);
    npcMovementEngine.removeNPC(npc.id);
  }

  private findNPCByNumericLocalId(mapId: string, localIdNumber: number): NPCObject | null {
    const prefix = `${mapId}_npc_`;
    for (const [key, npc] of this.npcs) {
      if (!key.startsWith(prefix)) continue;
      if (npc.localIdNumber === localIdNumber) return npc;
    }
    return null;
  }

  private resolveNpcByRuntimeStateId(id: string): NPCObject | null {
    const direct = this.npcs.get(id);
    if (direct) return direct;

    const mapId = getMapIdFromNpcObjectId(id);
    if (!mapId) return null;

    const localId = id.slice(`${mapId}_npc_`.length);
    if (localId.length === 0) return null;

    return this.getNPCByLocalId(mapId, localId);
  }

  private resolveExistingNpcIdForRuntimeState(id: string): string | null {
    if (this.npcs.has(id)) return id;
    const npc = this.resolveNpcByRuntimeStateId(id);
    return npc?.id ?? null;
  }

  private trySpawnObjectsInView(viewWindow: ObjectEventViewWindow): boolean {
    let changed = false;
    for (const npc of this.npcs.values()) {
      const shouldBeHidden = npc.flag && npc.flag !== '0' ? gameFlags.isSet(npc.flag) : false;
      const canSpawnHere = this.isWithinObjectEventView(npc.initialTileX, npc.initialTileY, viewWindow);
      if (shouldBeHidden || !canSpawnHere) continue;

      if (!npc.visible || this.offscreenDespawnedNpcIds.has(npc.id)) {
        this.resetNpcRuntimeSpawnState(npc);
        npc.visible = true;
        npc.scriptRemoved = false;
        changed = true;
      }
      if (this.offscreenDespawnedNpcIds.delete(npc.id)) {
        changed = true;
      }
    }

    for (const ball of this.itemBalls.values()) {
      const shouldBeHidden = ball.flag && ball.flag !== '0' ? gameFlags.isSet(ball.flag) : false;
      const canSpawnHere = this.isWithinObjectEventView(ball.tileX, ball.tileY, viewWindow);
      if (shouldBeHidden || !canSpawnHere) continue;

      if (ball.collected) {
        ball.collected = false;
        changed = true;
      }
      if (this.offscreenDespawnedItemIds.delete(ball.id)) {
        changed = true;
      }
    }

    for (const scriptObject of this.scriptObjects.values()) {
      const shouldBeHidden = scriptObject.flag && scriptObject.flag !== '0'
        ? gameFlags.isSet(scriptObject.flag)
        : false;
      const canSpawnHere = this.isWithinObjectEventView(scriptObject.tileX, scriptObject.tileY, viewWindow);
      if (shouldBeHidden || !canSpawnHere) continue;

      if (!scriptObject.visible) {
        changed = true;
      }
      scriptObject.visible = true;
      if (this.offscreenDespawnedScriptObjectIds.delete(scriptObject.id)) {
        changed = true;
      }
    }

    for (const largeObject of this.largeObjects.values()) {
      const shouldBeHidden = largeObject.flag && largeObject.flag !== '0'
        ? gameFlags.isSet(largeObject.flag)
        : false;
      const canSpawnHere = this.isWithinObjectEventView(largeObject.tileX, largeObject.tileY, viewWindow);
      if (shouldBeHidden || !canSpawnHere) continue;

      if (!largeObject.visible) {
        changed = true;
      }
      largeObject.visible = true;
      if (this.offscreenDespawnedLargeObjectIds.delete(largeObject.id)) {
        changed = true;
      }
    }
    return changed;
  }

  private removeObjectsOutsideView(viewWindow: ObjectEventViewWindow): boolean {
    let changed = false;
    for (const npc of this.npcs.values()) {
      if (!npc.visible) {
        if (this.offscreenDespawnedNpcIds.delete(npc.id)) {
          changed = true;
        }
        continue;
      }
      if (this.offscreenDespawnedNpcIds.has(npc.id)) continue;

      const currentInView = this.isWithinObjectEventView(npc.tileX, npc.tileY, viewWindow);
      const initialInView = this.isWithinObjectEventView(npc.initialTileX, npc.initialTileY, viewWindow);
      if (!currentInView && !initialInView) {
        if (!this.offscreenDespawnedNpcIds.has(npc.id)) {
          this.offscreenDespawnedNpcIds.add(npc.id);
          npcMovementEngine.removeNPC(npc.id);
          changed = true;
        }
      }
    }

    for (const ball of this.itemBalls.values()) {
      if (ball.collected) {
        if (this.offscreenDespawnedItemIds.delete(ball.id)) {
          changed = true;
        }
        continue;
      }
      if (this.offscreenDespawnedItemIds.has(ball.id)) continue;

      if (!this.isWithinObjectEventView(ball.tileX, ball.tileY, viewWindow)) {
        if (!this.offscreenDespawnedItemIds.has(ball.id)) {
          this.offscreenDespawnedItemIds.add(ball.id);
          changed = true;
        }
      }
    }

    for (const scriptObject of this.scriptObjects.values()) {
      if (!scriptObject.visible) {
        if (this.offscreenDespawnedScriptObjectIds.delete(scriptObject.id)) {
          changed = true;
        }
        continue;
      }
      if (this.offscreenDespawnedScriptObjectIds.has(scriptObject.id)) continue;

      if (!this.isWithinObjectEventView(scriptObject.tileX, scriptObject.tileY, viewWindow)) {
        if (!this.offscreenDespawnedScriptObjectIds.has(scriptObject.id)) {
          this.offscreenDespawnedScriptObjectIds.add(scriptObject.id);
          changed = true;
        }
      }
    }

    for (const largeObject of this.largeObjects.values()) {
      if (!largeObject.visible) {
        if (this.offscreenDespawnedLargeObjectIds.delete(largeObject.id)) {
          changed = true;
        }
        continue;
      }
      if (this.offscreenDespawnedLargeObjectIds.has(largeObject.id)) continue;

      if (!this.isWithinObjectEventView(largeObject.tileX, largeObject.tileY, viewWindow)) {
        if (!this.offscreenDespawnedLargeObjectIds.has(largeObject.id)) {
          this.offscreenDespawnedLargeObjectIds.add(largeObject.id);
          changed = true;
        }
      }
    }
    return changed;
  }
}
