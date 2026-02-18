import type { ObjectEventManager } from './ObjectEventManager';
import type { WorldSnapshot } from './WorldManager';
import type { WebGLSpriteRenderer } from '../rendering/webgl/WebGLSpriteRenderer';
import { getNPCAtlasName } from '../rendering/spriteUtils';
import { saveManager } from '../save/SaveManager';
import { applyObjectEventOverridesForMap } from './overworld/applyObjectEventOverridesForMap';
import { ensureBerryTreeAtlasesUploaded } from '../utils/berryTreeSpriteImport';
import { isBerryTreeGraphicsId } from '../utils/berryTreeSpriteResolver';

interface SpriteDimensionsLike {
  frameWidth: number;
  frameHeight: number;
}

const BRINEY_BOAT_GRAPHICS_ID = 'OBJ_EVENT_GFX_MR_BRINEYS_BOAT';

function getBrineyBoatLocalIds(objectEvents: ReadonlyArray<{ graphics_id: string; local_id?: string }>): string[] {
  const localIds: string[] = [];
  for (const event of objectEvents) {
    if (event.graphics_id !== BRINEY_BOAT_GRAPHICS_ID) continue;
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
  } = params;

  // Incremental update: only add/remove maps that changed.
  // This preserves NPC runtime state (positions, visibility) on still-loaded maps.
  const newMapIds = new Set(snapshot.maps.map((m) => m.entry.id));
  const existingMapIds = objectEventManager.getParsedMapIds();

  // Remove objects for maps no longer in the snapshot
  for (const mapId of existingMapIds) {
    if (!newMapIds.has(mapId)) {
      objectEventManager.removeMapObjects(mapId);
    }
  }

  // Parse objects and bg_events for newly added maps only
  for (const mapInst of snapshot.maps) {
    if (objectEventManager.hasMapObjects(mapInst.entry.id)) {
      // Migration safety: older runtime state could have parsed Briney's boat
      // as a large object (or dropped it entirely), which breaks applymovement.
      // Re-parse this map if any Briney boat local ID is missing as an NPC.
      const brineyBoatLocalIds = getBrineyBoatLocalIds(
        mapInst.objectEvents
      );
      const allNpcs = objectEventManager.getAllNPCs();
      if (
        brineyBoatLocalIds.length > 0
        && brineyBoatLocalIds.some((localId) => {
          const expectedNpcId = `${mapInst.entry.id}_npc_${localId}`;
          return allNpcs.every((npc) => npc.id !== expectedNpcId);
        })
      ) {
        objectEventManager.removeMapObjects(mapInst.entry.id);
        objectEventManager.parseMapObjects(
          mapInst.entry.id,
          mapInst.objectEvents,
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

      continue;
    }

    if (mapInst.objectEvents.length > 0) {
      objectEventManager.parseMapObjects(
        mapInst.entry.id,
        mapInst.objectEvents,
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
    }
  }
}
