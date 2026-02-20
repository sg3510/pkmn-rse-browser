import type { ObjectEventManager } from './ObjectEventManager';
import type { WorldSnapshot } from './WorldManager';
import type { WebGLSpriteRenderer } from '../rendering/webgl/WebGLSpriteRenderer';
import { getNPCAtlasName } from '../rendering/spriteUtils';
import { saveManager } from '../save/SaveManager';
import { applyObjectEventOverridesForMap } from './overworld/applyObjectEventOverridesForMap';
import { ensureBerryTreeAtlasesUploaded } from '../utils/berryTreeSpriteImport';
import { isBerryTreeGraphicsId } from '../utils/berryTreeSpriteResolver';
import { isLargeObjectGraphicsId, type ObjectEventData } from '../types/objectEvents';
import { getTrainerHillDynamicObjectEvents } from './trainerHillRuntime';

interface SpriteDimensionsLike {
  frameWidth: number;
  frameHeight: number;
}

function getScriptAddressableLargeObjectLocalIds(
  objectEvents: ReadonlyArray<ObjectEventData>
): string[] {
  const localIds: string[] = [];
  for (const event of objectEvents) {
    if (!isLargeObjectGraphicsId(event.graphics_id)) continue;
    if (typeof event.local_id !== 'string' || event.local_id.length === 0) continue;
    localIds.push(event.local_id);
  }
  return localIds;
}

export interface NpcSpriteCacheLike {
  loadMany: (graphicsIds: string[]) => Promise<void>;
  get: (graphicsId: string) => HTMLCanvasElement | null;
  getDimensions: (graphicsId: string) => SpriteDimensionsLike;
}

export interface LoadObjectEventsFromSnapshotParams {
  snapshot: WorldSnapshot;
  objectEventManager: ObjectEventManager;
  spriteCache: NpcSpriteCacheLike;
  spriteRenderer?: WebGLSpriteRenderer | null;
  uploadedSpriteIds?: Set<string>;
  clearAnimations?: () => void;
  debugLog?: (message: string) => void;
  spritePreloadScope?: 'all' | 'anchor-and-neighbors';
  /**
   * When true, keep runtime state for already-parsed maps (scriptRemoved,
   * temporary visibility/position changes) and only parse newly loaded maps.
   */
  preserveExistingMapRuntimeState?: boolean;
  /**
   * Optional cooperative chunk budget for map/object parsing work.
   * When set > 0, yields back to the browser between chunks.
   */
  cooperativeChunkMs?: number;
}

function getRuntimeObjectEvents(
  mapId: string,
  objectEvents: ReadonlyArray<ObjectEventData>
): ObjectEventData[] {
  const trainerHillEvents = getTrainerHillDynamicObjectEvents(mapId);
  if (trainerHillEvents !== null) {
    return trainerHillEvents;
  }
  return [...objectEvents];
}

function getMapIdFromNpcObjectId(id: string): string | null {
  const separator = '_npc_';
  const idx = id.indexOf(separator);
  if (idx <= 0) {
    return null;
  }
  return id.slice(0, idx);
}

function getMapIdFromScriptObjectId(id: string): string | null {
  const separator = '_script_';
  const idx = id.indexOf(separator);
  if (idx <= 0) {
    return null;
  }
  return id.slice(0, idx);
}

function areMapBoundsNeighbors(
  a: { offsetX: number; offsetY: number; width: number; height: number },
  b: { offsetX: number; offsetY: number; width: number; height: number }
): boolean {
  const aMinX = a.offsetX;
  const aMaxX = a.offsetX + a.width - 1;
  const aMinY = a.offsetY;
  const aMaxY = a.offsetY + a.height - 1;

  const bMinX = b.offsetX;
  const bMaxX = b.offsetX + b.width - 1;
  const bMinY = b.offsetY;
  const bMaxY = b.offsetY + b.height - 1;

  const dx = bMinX > aMaxX + 1 ? bMinX - (aMaxX + 1) : aMinX > bMaxX + 1 ? aMinX - (bMaxX + 1) : 0;
  const dy = bMinY > aMaxY + 1 ? bMinY - (aMaxY + 1) : aMinY > bMaxY + 1 ? aMinY - (bMaxY + 1) : 0;

  return dx === 0 && dy === 0;
}

function getPreloadMapIds(snapshot: WorldSnapshot, scope: 'all' | 'anchor-and-neighbors'): Set<string> {
  if (scope === 'all') {
    return new Set(snapshot.maps.map((map) => map.entry.id));
  }

  const anchor = snapshot.maps.find((map) => map.entry.id === snapshot.anchorMapId) ?? snapshot.maps[0];
  if (!anchor) {
    return new Set();
  }

  const anchorBounds = {
    offsetX: anchor.offsetX,
    offsetY: anchor.offsetY,
    width: anchor.entry.width,
    height: anchor.entry.height,
  };

  const preloadMapIds = new Set<string>([anchor.entry.id]);
  for (const map of snapshot.maps) {
    if (map.entry.id === anchor.entry.id) {
      continue;
    }
    if (
      areMapBoundsNeighbors(anchorBounds, {
        offsetX: map.offsetX,
        offsetY: map.offsetY,
        width: map.entry.width,
        height: map.entry.height,
      })
    ) {
      preloadMapIds.add(map.entry.id);
    }
  }

  return preloadMapIds;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

export async function loadObjectEventsFromSnapshot(
  params: LoadObjectEventsFromSnapshotParams
): Promise<void> {
  const {
    snapshot,
    objectEventManager,
    spriteCache,
    spriteRenderer,
    uploadedSpriteIds,
    debugLog,
    spritePreloadScope = 'anchor-and-neighbors',
    preserveExistingMapRuntimeState = false,
    cooperativeChunkMs = 0,
  } = params;

  const cooperative = cooperativeChunkMs > 0;
  let chunkStartMs = cooperative ? nowMs() : 0;
  const maybeYield = async (): Promise<void> => {
    if (!cooperative) return;
    const elapsed = nowMs() - chunkStartMs;
    if (elapsed < cooperativeChunkMs) return;
    await yieldToMainThread();
    chunkStartMs = nowMs();
  };

  // Incremental update: only add/remove maps that changed.
  // This preserves NPC runtime state (positions, visibility) on still-loaded maps.
  const newMapIds = new Set(snapshot.maps.map((m) => m.entry.id));
  const existingMapIds = objectEventManager.getParsedMapIds();

  // Remove objects for maps no longer in the snapshot
  for (const mapId of existingMapIds) {
    if (!newMapIds.has(mapId)) {
      objectEventManager.removeMapObjects(mapId);
      await maybeYield();
    }
  }

  // Parse objects and bg_events for newly added maps only
  for (const mapInst of snapshot.maps) {
    const runtimeObjectEvents = getRuntimeObjectEvents(mapInst.entry.id, mapInst.objectEvents);
    mapInst.objectEvents = runtimeObjectEvents;

    if (objectEventManager.hasMapObjects(mapInst.entry.id)) {
      // Migration safety: older runtime state may have parsed script-addressable
      // large objects (with local_id) into large-object storage instead of
      // NPC-style object events, which breaks LOCALID script commands.
      const scriptedLargeObjectLocalIds = getScriptAddressableLargeObjectLocalIds(
        runtimeObjectEvents
      );
      const npcIdSet = new Set(objectEventManager.getAllNPCs().map((npc) => npc.id));
      if (
        scriptedLargeObjectLocalIds.length > 0
        && scriptedLargeObjectLocalIds.some((localId) => {
          const expectedNpcId = `${mapInst.entry.id}_npc_${localId}`;
          return !npcIdSet.has(expectedNpcId);
        })
      ) {
        objectEventManager.removeMapObjects(mapInst.entry.id);
        objectEventManager.parseMapObjects(
          mapInst.entry.id,
          runtimeObjectEvents,
          mapInst.offsetX,
          mapInst.offsetY,
          saveManager.getProfile().gender
        );
        if (mapInst.bgEvents.length > 0) {
          objectEventManager.parseMapBgEvents(
            mapInst.entry.id,
            mapInst.bgEvents,
            mapInst.offsetX,
            mapInst.offsetY
          );
        }
      }

      // Check for offset changes — happens when world stitching shifts
      const oldOffset = objectEventManager.getMapOffset(mapInst.entry.id);
      if (oldOffset) {
        const dx = mapInst.offsetX - oldOffset.x;
        const dy = mapInst.offsetY - oldOffset.y;
        if (dx !== 0 || dy !== 0) {
          objectEventManager.repositionMapObjects(mapInst.entry.id, dx, dy);
        }
      }

      if (!preserveExistingMapRuntimeState) {
        // Map persisted across warp — simulate C's "respawn NPCs from flags"
        objectEventManager.resetScriptRemovedState(mapInst.entry.id);

        // Re-apply persistent position overrides (setobjectxyperm).
        applyObjectEventOverridesForMap(mapInst.entry.id, snapshot, objectEventManager);
      }

      await maybeYield();
      continue;
    }

    if (mapInst.objectEvents.length > 0) {
      objectEventManager.parseMapObjects(
        mapInst.entry.id,
        runtimeObjectEvents,
        mapInst.offsetX,
        mapInst.offsetY,
        saveManager.getProfile().gender
      );
    }

    if (mapInst.bgEvents.length > 0) {
      objectEventManager.parseMapBgEvents(
        mapInst.entry.id,
        mapInst.bgEvents,
        mapInst.offsetX,
        mapInst.offsetY
      );
    }

    // Apply persistent NPC position overrides (from copyobjectxytoperm).
    applyObjectEventOverridesForMap(mapInst.entry.id, snapshot, objectEventManager);
    await maybeYield();
  }

  const preloadMapIds = getPreloadMapIds(snapshot, spritePreloadScope);
  const npcGraphicsIds = objectEventManager
    .getAllNPCs()
    .filter((npc) => {
      const mapId = getMapIdFromNpcObjectId(npc.id);
      return mapId ? preloadMapIds.has(mapId) : true;
    })
    .map((npc) => npc.graphicsId);

  const visibleScriptObjects = objectEventManager
    .getVisibleScriptObjects()
    .filter((scriptObject) => {
      const mapId = getMapIdFromScriptObjectId(scriptObject.id);
      return mapId ? preloadMapIds.has(mapId) : true;
    });
  const hasVisibleBerryTrees = visibleScriptObjects.some((scriptObject) =>
    isBerryTreeGraphicsId(scriptObject.graphicsId)
  );
  const scriptObjectGraphicsIds = visibleScriptObjects
    .map((scriptObject) => scriptObject.graphicsId)
    .filter((graphicsId) => !isBerryTreeGraphicsId(graphicsId));

  const graphicsIds = Array.from(new Set([
    ...npcGraphicsIds,
    ...scriptObjectGraphicsIds,
  ]));

  const idsToLoad = graphicsIds.length > 0
    ? (uploadedSpriteIds
      ? graphicsIds.filter((id) => !uploadedSpriteIds.has(id))
      : graphicsIds)
    : [];

  if (idsToLoad.length > 0) {
    await spriteCache.loadMany(idsToLoad);
  }

  if (spriteRenderer && hasVisibleBerryTrees) {
    await ensureBerryTreeAtlasesUploaded(spriteRenderer);
  }

  if (spriteRenderer && idsToLoad.length > 0) {
    for (const graphicsId of idsToLoad) {
      const sprite = spriteCache.get(graphicsId);
      if (!sprite) {
        continue;
      }

      const atlasName = getNPCAtlasName(graphicsId);
      const dims = spriteCache.getDimensions(graphicsId);
      spriteRenderer.uploadSpriteSheet(atlasName, sprite, {
        frameWidth: dims.frameWidth,
        frameHeight: dims.frameHeight,
      });
      uploadedSpriteIds?.add(graphicsId);
      debugLog?.(`[WebGL] Uploaded NPC sprite: ${atlasName} (${sprite.width}x${sprite.height})`);
      await maybeYield();
    }
  }
}
