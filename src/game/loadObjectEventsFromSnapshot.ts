import type { ObjectEventManager } from './ObjectEventManager';
import type { WorldSnapshot } from './WorldManager';
import type { WebGLSpriteRenderer } from '../rendering/webgl/WebGLSpriteRenderer';
import { getNPCAtlasName } from '../rendering/spriteUtils';

interface SpriteDimensionsLike {
  frameWidth: number;
  frameHeight: number;
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
      continue; // Already parsed — preserve existing NPC state
    }

    if (mapInst.objectEvents.length > 0) {
      objectEventManager.parseMapObjects(
        mapInst.entry.id,
        mapInst.objectEvents,
        mapInst.offsetX,
        mapInst.offsetY
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
  }

  const preloadMapIds = getPreloadMapIds(snapshot, spritePreloadScope);
  const npcGraphicsIds = objectEventManager
    .getAllNPCs()
    .filter((npc) => {
      const mapId = getMapIdFromNpcObjectId(npc.id);
      return mapId ? preloadMapIds.has(mapId) : true;
    })
    .map((npc) => npc.graphicsId);

  const scriptObjectGraphicsIds = objectEventManager
    .getVisibleScriptObjects()
    .filter((scriptObject) => {
      const mapId = getMapIdFromScriptObjectId(scriptObject.id);
      return mapId ? preloadMapIds.has(mapId) : true;
    })
    .map((scriptObject) => scriptObject.graphicsId);

  const graphicsIds = Array.from(new Set([
    ...npcGraphicsIds,
    ...scriptObjectGraphicsIds,
  ]));
  if (graphicsIds.length === 0) {
    return;
  }

  const idsToLoad = uploadedSpriteIds
    ? graphicsIds.filter((id) => !uploadedSpriteIds.has(id))
    : graphicsIds;

  if (idsToLoad.length === 0) {
    return;
  }

  await spriteCache.loadMany(idsToLoad);

  if (!spriteRenderer) {
    return;
  }

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
