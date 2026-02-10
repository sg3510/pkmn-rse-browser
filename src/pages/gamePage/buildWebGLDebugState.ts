import type { ObjectEventManager } from '../../game/ObjectEventManager';
import {
  isTruckSequenceLocked,
  type TruckSequenceRuntime,
} from '../../game/TruckSequenceRunner';
import type {
  MapStitchingDebugInfo,
  PriorityDebugInfo,
  ReflectionTileGridDebugInfo,
  RenderStatsDebugInfo,
  TruckBoxRuntimeDebugInfo,
  WarpDebugInfo,
  WebGLDebugState,
} from '../../components/debug/types';

const TRUCK_MAP_ID = 'MAP_INSIDE_OF_TRUCK';
const TRUCK_BOX_LOCAL_IDS = [
  'LOCALID_TRUCK_BOX_TOP',
  'LOCALID_TRUCK_BOX_BOTTOM_L',
  'LOCALID_TRUCK_BOX_BOTTOM_R',
] as const;

export interface NpcSpriteCacheLike {
  has: (graphicsId: string) => boolean;
  hasFailed: (graphicsId: string) => boolean;
}

export interface BuildWebGLDebugStateParams {
  mapStitching: MapStitchingDebugInfo | null;
  warp: WarpDebugInfo | null;
  renderStats: RenderStatsDebugInfo | null;
  shimmer: WebGLDebugState['shimmer'];
  reflectionTileGrid: ReflectionTileGridDebugInfo | null;
  priority: PriorityDebugInfo | null;
  introState: number;
  playerMapId: string | undefined;
  anchorMapId: string | undefined;
  truckRuntime: TruckSequenceRuntime;
  gbaFrame: number;
  objectEventManager: ObjectEventManager;
  npcSpriteCache: NpcSpriteCacheLike;
}

function getTruckBoxDebugInfo(
  objectEventManager: ObjectEventManager,
  npcSpriteCache: NpcSpriteCacheLike
): TruckBoxRuntimeDebugInfo[] {
  return TRUCK_BOX_LOCAL_IDS.map((localId) => {
    const npc = objectEventManager.getNPCByLocalId(TRUCK_MAP_ID, localId);
    if (!npc) {
      return {
        localId,
        graphicsId: 'missing',
        visible: false,
        tileX: 0,
        tileY: 0,
        subTileX: 0,
        subTileY: 0,
        spriteCached: false,
        spriteFailed: false,
      };
    }

    return {
      localId,
      graphicsId: npc.graphicsId,
      visible: npc.visible,
      tileX: npc.tileX,
      tileY: npc.tileY,
      subTileX: npc.subTileX ?? 0,
      subTileY: npc.subTileY ?? 0,
      spriteCached: npcSpriteCache.has(npc.graphicsId),
      spriteFailed: npcSpriteCache.hasFailed(npc.graphicsId),
    };
  });
}

export function buildWebGLDebugState(params: BuildWebGLDebugStateParams): WebGLDebugState {
  const {
    mapStitching,
    warp,
    renderStats,
    shimmer,
    reflectionTileGrid,
    priority,
    introState,
    playerMapId,
    anchorMapId,
    truckRuntime,
    gbaFrame,
    objectEventManager,
    npcSpriteCache,
  } = params;

  const activeMapId = playerMapId ?? anchorMapId;
  const shouldRunTruckSequence =
    activeMapId === TRUCK_MAP_ID
    && introState >= 0
    && introState <= 2;
  const truckOutput = truckRuntime.lastOutput;

  return {
    mapStitching,
    warp,
    renderStats,
    truck: {
      active: truckRuntime.sequence !== null,
      locked: isTruckSequenceLocked(truckRuntime),
      shouldRun: shouldRunTruckSequence,
      introState,
      gbaFrame,
      lastGbaFrame: truckRuntime.lastGbaFrame,
      doorClosedApplied: truckRuntime.doorClosedApplied,
      doorOpenedApplied: truckRuntime.doorOpenedApplied,
      complete: truckOutput.complete,
      cameraOffsetX: truckOutput.cameraOffsetX,
      cameraOffsetY: truckOutput.cameraOffsetY,
      boxOffsets: truckOutput.boxOffsets,
      boxes: getTruckBoxDebugInfo(objectEventManager, npcSpriteCache),
    },
    shimmer,
    reflectionTileGrid,
    priority,
  };
}
