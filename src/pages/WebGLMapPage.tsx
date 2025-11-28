/**
 * WebGL Map Viewer
 *
 * Replacement for the old gameplay-heavy MapRenderer route.
 * This page mirrors the WebGL test harness but renders any map
 * from the map index using only the WebGL tile renderer (no NPCs,
 * scripts, camera, or gameplay systems).
 *
 * Access via /#/webgl-map
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { isWebGL2Supported } from '../rendering/webgl/WebGLContext';
import { WebGLRenderPipeline } from '../rendering/webgl/WebGLRenderPipeline';
import type { TileResolverFn, ResolvedTile, WorldCameraView, LoadedAnimation, ReflectionMeta, RenderContext } from '../rendering/types';
import { PlayerController, type TileResolver as PlayerTileResolver } from '../game/PlayerController';
import { ObjectRenderer, type WorldCameraView as ObjectRendererView } from '../components/map/renderers/ObjectRenderer';
import { useFieldSprites } from '../hooks/useFieldSprites';
import { WorldManager, type WorldSnapshot, type TilesetPairInfo } from '../game/WorldManager';
import mapIndexJson from '../data/mapIndex.json';
import type { MapIndexEntry } from '../types/maps';
import {
  METATILE_SIZE,
  type Palette,
  type TilesetImageData,
  type Metatile,
  type MapData,
  type MetatileAttributes,
} from '../utils/mapLoader';
import { buildTilesetRuntime, type TilesetRuntime as TilesetRuntimeType } from '../utils/tilesetUtils';
import type { TilesetResources } from '../services/MapManager';
import { getBridgeTypeFromBehavior, type BridgeType } from '../utils/metatileBehaviors';
import type { ReflectionState } from '../components/map/types';
import './WebGLMapPage.css';

const NUM_PALS_IN_PRIMARY = 6;
const NUM_PALS_TOTAL = 13;
const SECONDARY_TILE_OFFSET = 512;
const GBA_FRAME_MS = 1000 / 59.7275; // Match real GBA vblank timing (~59.73 Hz)

type RenderStats = {
  webgl2Supported: boolean;
  tileCount: number;
  renderTimeMs: number;
  fps: number;
  error: string | null;
};

type CameraState = {
  x: number;  // camera world position in pixels
  y: number;
};

type DebugTileInfo = {
  tileX: number;
  tileY: number;
  metatileId: number;
  tileElevation: number;
  playerElevation: number;
  collision: number;
  layerType: number;
  behavior: number;
};

/** A single map instance positioned in world space */
type StitchedMapInstance = {
  entry: MapIndexEntry;
  mapData: MapData;
  offsetX: number;  // World tile offset (can be negative)
  offsetY: number;
};

// TilesetPairInfo is now imported from WorldManager

/** World data with multiple stitched maps, potentially using multiple tileset pairs */
type StitchedWorldData = {
  maps: StitchedMapInstance[];
  anchorId: string;
  worldBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };

  /** All tileset pairs used by maps in this world (max 2 for GPU) */
  tilesetPairs: TilesetPairInfo[];

  /** Maps each map ID to its tileset pair index in tilesetPairs array */
  mapTilesetPairIndex: Map<string, number>;

  // Legacy single-tileset fields (for backward compatibility, references tilesetPairs[0])
  primaryMetatiles: Metatile[];
  secondaryMetatiles: Metatile[];
  primaryAttributes: MetatileAttributes[];
  secondaryAttributes: MetatileAttributes[];
  primaryImage: TilesetImageData;
  secondaryImage: TilesetImageData;
  primaryPalettes: Palette[];
  secondaryPalettes: Palette[];
  animations: LoadedAnimation[];
  borderMetatiles: number[];
};

const mapIndexData = mapIndexJson as MapIndexEntry[];

/** Combine primary (0-5) and secondary (6-12) palettes into a single GPU palette array */
function combineTilesetPalettes(primaryPalettes: Palette[], secondaryPalettes: Palette[]): Palette[] {
  const combined: Palette[] = [];

  for (let i = 0; i < NUM_PALS_IN_PRIMARY; i++) {
    combined.push(primaryPalettes[i] || { colors: Array(16).fill('#000000') });
  }

  for (let i = NUM_PALS_IN_PRIMARY; i < NUM_PALS_TOTAL; i++) {
    combined.push(secondaryPalettes[i - NUM_PALS_IN_PRIMARY] || { colors: Array(16).fill('#000000') });
  }

  for (let i = NUM_PALS_TOTAL; i < 16; i++) {
    combined.push({ colors: Array(16).fill('#000000') });
  }

  return combined;
}

// Viewport configuration
const VIEWPORT_TILES_WIDE = 20;
const VIEWPORT_TILES_HIGH = 20;

export function WebGLMapPage() {
  // Canvas refs - we use two canvases: hidden WebGL and visible 2D
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pipeline and state refs
  const pipelineRef = useRef<WebGLRenderPipeline | null>(null);
  const stitchedWorldRef = useRef<StitchedWorldData | null>(null);
  const worldManagerRef = useRef<WorldManager | null>(null);
  const worldSnapshotRef = useRef<WorldSnapshot | null>(null);
  const worldBoundsRef = useRef<{ width: number; height: number; minX: number; minY: number }>({ width: 0, height: 0, minX: 0, minY: 0 });
  const rafRef = useRef<number | null>(null);
  const cameraRef = useRef<CameraState>({ x: 0, y: 0 });
  const gbaFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const gbaAccumRef = useRef<number>(0);

  // Player controller ref
  const playerRef = useRef<PlayerController | null>(null);
  const playerLoadedRef = useRef<boolean>(false);

  // Field sprites (grass, sand, etc.)
  const fieldSprites = useFieldSprites();
  const fieldSpritesLoadedRef = useRef<boolean>(false);

  // Tileset runtimes for reflection detection (built from TilesetPairInfo)
  const tilesetRuntimesRef = useRef<Map<string, TilesetRuntimeType>>(new Map());

  const renderableMaps = useMemo(
    () =>
      mapIndexData
        .filter((map) => map.layoutPath && map.primaryTilesetPath && map.secondaryTilesetPath)
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const defaultMap = renderableMaps.find((m) => m.name === 'LittlerootTown') || renderableMaps[0];
  const [selectedMapId, setSelectedMapId] = useState<string>(defaultMap?.id ?? '');
  const [stitchedMapCount, setStitchedMapCount] = useState<number>(1);
  const [worldSize, setWorldSize] = useState<{ width: number; height: number }>({
    width: (defaultMap?.width ?? 0) * METATILE_SIZE,
    height: (defaultMap?.height ?? 0) * METATILE_SIZE,
  });
  const selectedMap = useMemo(
    () => renderableMaps.find((m) => m.id === selectedMapId) || defaultMap || renderableMaps[0],
    [selectedMapId, renderableMaps, defaultMap]
  );

  const [stats, setStats] = useState<RenderStats>({
    webgl2Supported: false,
    tileCount: 0,
    renderTimeMs: 0,
    fps: 0,
    error: null,
  });
  const [loading, setLoading] = useState(false);
  const [cameraDisplay, setCameraDisplay] = useState<CameraState>({ x: 0, y: 0 });
  const [debugTile, setDebugTile] = useState<DebugTileInfo | null>(null);
  const [mapDebugInfo, setMapDebugInfo] = useState<{
    currentMap: string | null;
    anchorMap: string;
    loadedMaps: Array<{ id: string; offsetX: number; offsetY: number; width: number; height: number; pairId: string; inGpu: boolean; borderTileCount: number }>;
    expectedConnections: Array<{ from: string; direction: string; to: string; loaded: boolean }>;
    tilesetPairs: number;
    playerPos: { x: number; y: number };
    gpuSlot0: string | null;
    gpuSlot1: string | null;
    boundaries: Array<{ x: number; y: number; length: number; orientation: string; pairA: string; pairB: string }>;
    nearbyBoundaryCount: number;
  } | null>(null);

  // Create tile resolver from WorldSnapshot (for WorldManager integration)
  const createSnapshotTileResolver = useCallback((snapshot: WorldSnapshot): TileResolverFn => {
    const { maps, tilesetPairs, mapTilesetPairIndex, anchorBorderMetatiles, pairIdToGpuSlot, anchorMapId } = snapshot;

    // Helper to convert tileset pair array index to GPU slot (0 or 1)
    const getGpuSlot = (pairIndex: number): number => {
      const pair = tilesetPairs[pairIndex];
      if (!pair) return 0;
      return pairIdToGpuSlot.get(pair.id) ?? 0;
    };

    // Get anchor map's tileset pair for border rendering
    const anchorMap = maps.find(m => m.entry.id === anchorMapId) ?? maps[0];
    const anchorPairIndex = anchorMap ? (mapTilesetPairIndex.get(anchorMap.entry.id) ?? 0) : 0;
    const anchorPair = tilesetPairs[anchorPairIndex] ?? tilesetPairs[0];

    return (worldX: number, worldY: number): ResolvedTile | null => {
      // Find which map contains this world tile
      for (const map of maps) {
        const localX = worldX - map.offsetX;
        const localY = worldY - map.offsetY;

        if (localX >= 0 && localX < map.entry.width &&
            localY >= 0 && localY < map.entry.height) {
          const pairIndex = mapTilesetPairIndex.get(map.entry.id) ?? 0;
          const pair = tilesetPairs[pairIndex];

          const idx = localY * map.entry.width + localX;
          const mapTile = map.mapData.layout[idx];
          const metatileId = mapTile.metatileId;

          const isSecondary = metatileId >= SECONDARY_TILE_OFFSET;
          const metatile = isSecondary
            ? pair.secondaryMetatiles[metatileId - SECONDARY_TILE_OFFSET]
            : pair.primaryMetatiles[metatileId];

          if (!metatile) return null;

          const attrIndex = isSecondary ? metatileId - SECONDARY_TILE_OFFSET : metatileId;
          const attrArray = isSecondary ? pair.secondaryAttributes : pair.primaryAttributes;
          const attributes: MetatileAttributes = attrArray[attrIndex] ?? { behavior: 0, layerType: 0 };

          // Use GPU slot index (0 or 1), not array index
          const gpuSlot = getGpuSlot(pairIndex);

          return {
            metatile,
            attributes,
            mapTile,
            map: null as any,
            tileset: null as any,
            isSecondary,
            isBorder: false,
            tilesetPairIndex: gpuSlot,
          };
        }
      }

      // Out of bounds - find NEAREST map whose tileset pair is IN GPU and use its border tiles
      // CRITICAL: We can only render tiles from tilesets that are currently in GPU!
      // If nearest map's tileset isn't in GPU, fall back to a map whose tileset IS in GPU
      let nearestMap: typeof maps[0] | null = null;
      let nearestDist = Infinity;

      // Helper to check if a map's tileset is in GPU
      const isMapTilesetInGpu = (map: typeof maps[0]): boolean => {
        const pairIndex = mapTilesetPairIndex.get(map.entry.id);
        if (pairIndex === undefined) return false;
        const pair = tilesetPairs[pairIndex];
        if (!pair) return false;
        return pairIdToGpuSlot.has(pair.id);
      };

      for (const map of maps) {
        // ONLY consider maps whose tileset pair is currently in GPU
        if (!isMapTilesetInGpu(map)) continue;

        // Calculate distance from (worldX, worldY) to map's bounding box
        const mapLeft = map.offsetX;
        const mapRight = map.offsetX + map.entry.width;
        const mapTop = map.offsetY;
        const mapBottom = map.offsetY + map.entry.height;

        // Horizontal distance (0 if inside map's X range)
        const dx = worldX < mapLeft ? mapLeft - worldX :
                   worldX >= mapRight ? worldX - mapRight + 1 : 0;
        // Vertical distance (0 if inside map's Y range)
        const dy = worldY < mapTop ? mapTop - worldY :
                   worldY >= mapBottom ? worldY - mapBottom + 1 : 0;

        // Euclidean distance to bounding box (squared for comparison, no need for sqrt)
        const dist = dx * dx + dy * dy;

        if (dist < nearestDist) {
          nearestDist = dist;
          nearestMap = map;
        }
      }

      // Fall back to anchor if no maps with GPU tilesets found
      if (!nearestMap) {
        if (anchorBorderMetatiles.length === 0 || !anchorPair) return null;
        // Use anchor map's borders with anchor's tileset (should be in GPU)
        nearestMap = anchorMap;
      }

      // Get border tiles from the nearest map
      const borderMetatiles = nearestMap.borderMetatiles.length > 0
        ? nearestMap.borderMetatiles
        : anchorBorderMetatiles;

      if (borderMetatiles.length === 0) return null;

      // Get tileset pair for the nearest map
      const nearestPairIndex = mapTilesetPairIndex.get(nearestMap.entry.id) ?? anchorPairIndex;
      const nearestPair = tilesetPairs[nearestPairIndex] ?? anchorPair;

      if (!nearestPair) return null;

      // Verify the pair is actually in GPU - if not, we can't render these borders
      if (!pairIdToGpuSlot.has(nearestPair.id)) {
        // Tileset not in GPU, cannot render border
        return null;
      }

      const borderIndex = ((worldX & 1) + ((worldY & 1) * 2)) % borderMetatiles.length;
      const borderMetatileId = borderMetatiles[borderIndex];

      const isSecondary = borderMetatileId >= SECONDARY_TILE_OFFSET;
      const metatile = isSecondary
        ? nearestPair.secondaryMetatiles[borderMetatileId - SECONDARY_TILE_OFFSET]
        : nearestPair.primaryMetatiles[borderMetatileId];

      if (!metatile) return null;

      const attrIndex = isSecondary ? borderMetatileId - SECONDARY_TILE_OFFSET : borderMetatileId;
      const attrArray = isSecondary ? nearestPair.secondaryAttributes : nearestPair.primaryAttributes;
      const attributes: MetatileAttributes = attrArray[attrIndex] ?? { behavior: 0, layerType: 0 };

      // Use GPU slot index (0 or 1) of the nearest map's tileset pair
      const gpuSlot = getGpuSlot(nearestPairIndex);

      return {
        metatile,
        attributes,
        mapTile: { metatileId: borderMetatileId, collision: 1, elevation: 0 },
        map: null as any,
        tileset: null as any,
        isSecondary,
        isBorder: true,
        tilesetPairIndex: gpuSlot,
      };
    };
  }, []);

  // Create player tile resolver from WorldSnapshot
  const createSnapshotPlayerTileResolver = useCallback((snapshot: WorldSnapshot): PlayerTileResolver => {
    const { maps, tilesetPairs, mapTilesetPairIndex } = snapshot;

    return (worldX: number, worldY: number) => {
      for (const map of maps) {
        const localX = worldX - map.offsetX;
        const localY = worldY - map.offsetY;

        if (localX >= 0 && localX < map.entry.width &&
            localY >= 0 && localY < map.entry.height) {
          const pairIndex = mapTilesetPairIndex.get(map.entry.id) ?? 0;
          const pair = tilesetPairs[pairIndex];

          const idx = localY * map.entry.width + localX;
          const mapTile = map.mapData.layout[idx];
          const metatileId = mapTile.metatileId;
          const isSecondary = metatileId >= SECONDARY_TILE_OFFSET;
          const attrIndex = isSecondary ? metatileId - SECONDARY_TILE_OFFSET : metatileId;
          const attrArray = isSecondary ? pair.secondaryAttributes : pair.primaryAttributes;
          const attributes: MetatileAttributes = attrArray[attrIndex] ?? { behavior: 0, layerType: 0 };

          return { mapTile, attributes };
        }
      }
      return null;
    };
  }, []);

  // Helper to upload tilesets from WorldSnapshot to pipeline
  const uploadTilesetsFromSnapshot = useCallback((
    pipeline: WebGLRenderPipeline,
    snapshot: WorldSnapshot
  ): void => {
    const { tilesetPairs, pairIdToGpuSlot } = snapshot;

    // Upload tilesets based on pairIdToGpuSlot mapping, not array index!
    // This ensures GPU textures match what the scheduler/resolver expects
    for (const pair of tilesetPairs) {
      const gpuSlot = pairIdToGpuSlot.get(pair.id);
      if (gpuSlot === 0) {
        pipeline.uploadTilesets(
          pair.primaryImage.data,
          pair.primaryImage.width,
          pair.primaryImage.height,
          pair.secondaryImage.data,
          pair.secondaryImage.width,
          pair.secondaryImage.height,
          pair.animations
        );
        pipeline.uploadPalettes(combineTilesetPalettes(pair.primaryPalettes, pair.secondaryPalettes));
      } else if (gpuSlot === 1) {
        pipeline.uploadTilesetsPair1(
          pair.primaryImage.data,
          pair.primaryImage.width,
          pair.primaryImage.height,
          pair.secondaryImage.data,
          pair.secondaryImage.width,
          pair.secondaryImage.height,
          pair.animations
        );
        pipeline.uploadPalettesPair1(combineTilesetPalettes(pair.primaryPalettes, pair.secondaryPalettes));
      }
      // Pairs not in GPU (gpuSlot undefined) are skipped - they stay in CPU cache only
    }
  }, []);

  // Build TilesetRuntime from TilesetPairInfo for reflection detection
  const buildTilesetRuntimesFromSnapshot = useCallback((snapshot: WorldSnapshot): void => {
    const { tilesetPairs } = snapshot;
    const runtimesMap = tilesetRuntimesRef.current;

    for (const pair of tilesetPairs) {
      if (runtimesMap.has(pair.id)) continue;

      // Create TilesetResources-like object from TilesetPairInfo
      // We only need the fields used by buildTilesetRuntime
      const resources = {
        key: pair.id,
        primaryTilesetId: pair.primaryTilesetId,
        secondaryTilesetId: pair.secondaryTilesetId,
        primaryTilesetPath: '',  // Not needed for runtime building
        secondaryTilesetPath: '', // Not needed for runtime building
        primaryMetatiles: pair.primaryMetatiles,
        secondaryMetatiles: pair.secondaryMetatiles,
        primaryPalettes: pair.primaryPalettes,
        secondaryPalettes: pair.secondaryPalettes,
        primaryTilesImage: pair.primaryImage.data,
        secondaryTilesImage: pair.secondaryImage.data,
        primaryAttributes: pair.primaryAttributes,
        secondaryAttributes: pair.secondaryAttributes,
        animations: pair.animations,
      } as TilesetResources;

      const runtime = buildTilesetRuntime(resources);
      runtimesMap.set(pair.id, runtime);
    }
  }, []);

  // Get reflection metadata for a tile from the snapshot
  const getReflectionMetaFromSnapshot = useCallback((
    snapshot: WorldSnapshot,
    tileX: number,
    tileY: number
  ): { behavior: number; meta: ReflectionMeta | null } | null => {
    const { maps, tilesetPairs, mapTilesetPairIndex } = snapshot;

    // Find which map contains this tile
    for (const map of maps) {
      const localX = tileX - map.offsetX;
      const localY = tileY - map.offsetY;

      if (localX >= 0 && localX < map.entry.width &&
          localY >= 0 && localY < map.entry.height) {
        const pairIndex = mapTilesetPairIndex.get(map.entry.id) ?? 0;
        const pair = tilesetPairs[pairIndex];

        const idx = localY * map.entry.width + localX;
        const mapTile = map.mapData.layout[idx];
        const metatileId = mapTile.metatileId;

        const isSecondary = metatileId >= SECONDARY_TILE_OFFSET;
        const attrIndex = isSecondary ? metatileId - SECONDARY_TILE_OFFSET : metatileId;
        const attrArray = isSecondary ? pair.secondaryAttributes : pair.primaryAttributes;
        const behavior = attrArray[attrIndex]?.behavior ?? 0;

        // Get reflection meta from runtime
        const runtime = tilesetRuntimesRef.current.get(pair.id);
        if (!runtime) return { behavior, meta: null };

        const meta = isSecondary
          ? runtime.secondaryReflectionMeta[attrIndex]
          : runtime.primaryReflectionMeta[attrIndex];

        return { behavior, meta: meta ?? null };
      }
    }

    return null;
  }, []);

  // Compute reflection state for an object at a tile position
  // Extended to check one extra tile ahead to match GBA behavior
  const computeReflectionStateFromSnapshot = useCallback((
    snapshot: WorldSnapshot,
    tileX: number,
    tileY: number,
    spriteWidth: number = 16,
    spriteHeight: number = 32
  ): ReflectionState => {
    // Calculate how many tiles the sprite covers (GBA formula)
    const widthTiles = Math.max(1, (spriteWidth + 8) >> 4);
    const heightTiles = Math.max(1, (spriteHeight + 8) >> 4);

    let found: 'water' | 'ice' | null = null;

    // GBA scans tiles starting at y+1 (one tile below the object's anchor)
    // and continuing for 'height' tiles. We match this by checking y+1 to y+1+heightTiles
    for (let i = 0; i < heightTiles && !found; i++) {
      const y = tileY + 1 + i;  // Start at tileY + 1 like GBA

      // Check center tile
      const center = getReflectionMetaFromSnapshot(snapshot, tileX, y);
      if (center?.meta?.isReflective) {
        found = center.meta.reflectionType;
        break;
      }

      // Check tiles to left and right based on sprite width
      for (let j = 1; j < widthTiles && !found; j++) {
        const infos = [
          getReflectionMetaFromSnapshot(snapshot, tileX + j, y),
          getReflectionMetaFromSnapshot(snapshot, tileX - j, y),
        ];
        for (const info of infos) {
          if (info?.meta?.isReflective) {
            found = info.meta.reflectionType;
            break;
          }
        }
      }
    }

    // Get bridge type from the tile the object is standing on
    const standingInfo = getReflectionMetaFromSnapshot(snapshot, tileX, tileY);
    const bridgeType: BridgeType = standingInfo
      ? getBridgeTypeFromBehavior(standingInfo.behavior)
      : 'none';

    return {
      hasReflection: !!found,
      reflectionType: found,
      bridgeType,
    };
  }, [getReflectionMetaFromSnapshot]);

  // Create a minimal RenderContext from WorldSnapshot for field effect masking
  const createRenderContextFromSnapshot = useCallback((
    snapshot: WorldSnapshot
  ): RenderContext | null => {
    const { maps, tilesetPairs, mapTilesetPairIndex } = snapshot;
    if (maps.length === 0 || tilesetPairs.length === 0) return null;

    // Find anchor map (the one at offset 0,0 or the first one)
    const anchorMap = maps.find(m => m.offsetX === 0 && m.offsetY === 0) ?? maps[0];
    const anchorPairIndex = mapTilesetPairIndex.get(anchorMap.entry.id) ?? 0;
    const anchorPair = tilesetPairs[anchorPairIndex];

    // Create TilesetResources for the anchor
    const anchorTilesetResources: TilesetResources = {
      key: anchorPair.id,
      primaryTilesetId: anchorPair.primaryTilesetId,
      secondaryTilesetId: anchorPair.secondaryTilesetId,
      primaryTilesetPath: '',
      secondaryTilesetPath: '',
      primaryMetatiles: anchorPair.primaryMetatiles,
      secondaryMetatiles: anchorPair.secondaryMetatiles,
      primaryPalettes: anchorPair.primaryPalettes,
      secondaryPalettes: anchorPair.secondaryPalettes,
      primaryTilesImage: anchorPair.primaryImage.data,
      secondaryTilesImage: anchorPair.secondaryImage.data,
      primaryAttributes: anchorPair.primaryAttributes,
      secondaryAttributes: anchorPair.secondaryAttributes,
      animations: anchorPair.animations,
    };

    // Create WorldMapInstance-like objects
    const worldMaps = maps.map(m => {
      const pairIndex = mapTilesetPairIndex.get(m.entry.id) ?? 0;
      const pair = tilesetPairs[pairIndex];
      return {
        entry: m.entry,
        mapData: m.mapData,
        offsetX: m.offsetX,
        offsetY: m.offsetY,
        borderMetatiles: [],
        tilesets: {
          key: pair.id,
          primaryTilesetId: pair.primaryTilesetId,
          secondaryTilesetId: pair.secondaryTilesetId,
          primaryTilesetPath: '',
          secondaryTilesetPath: '',
          primaryMetatiles: pair.primaryMetatiles,
          secondaryMetatiles: pair.secondaryMetatiles,
          primaryPalettes: pair.primaryPalettes,
          secondaryPalettes: pair.secondaryPalettes,
          primaryTilesImage: pair.primaryImage.data,
          secondaryTilesImage: pair.secondaryImage.data,
          primaryAttributes: pair.primaryAttributes,
          secondaryAttributes: pair.secondaryAttributes,
          animations: pair.animations,
        } as TilesetResources,
        warpEvents: [],
        objectEvents: [],
      };
    });

    // Create anchor WorldMapInstance
    const anchor = worldMaps.find(m => m.offsetX === 0 && m.offsetY === 0) ?? worldMaps[0];

    return {
      world: {
        anchorId: snapshot.anchorMapId,
        maps: worldMaps,
        bounds: {
          minX: snapshot.worldBounds.minX,
          minY: snapshot.worldBounds.minY,
          maxX: snapshot.worldBounds.maxX,
          maxY: snapshot.worldBounds.maxY,
        },
      },
      tilesetRuntimes: tilesetRuntimesRef.current,
      anchor: {
        ...anchor,
        tilesets: anchorTilesetResources,
        borderMetatiles: snapshot.anchorBorderMetatiles ?? [],
      },
    } as RenderContext;
  }, []);

  // Render player reflection using snapshot-based tile lookup
  const renderPlayerReflection = useCallback((
    ctx: CanvasRenderingContext2D,
    player: PlayerController,
    reflectionState: ReflectionState,
    cameraWorldX: number,
    cameraWorldY: number,
    snapshot: WorldSnapshot
  ): void => {
    if (!reflectionState.hasReflection) return;

    const frame = player.getFrameInfo();
    if (!frame || !frame.sprite) return;

    const { height } = player.getSpriteSize();

    // Bridge offsets for reflection positioning
    const BRIDGE_OFFSETS: Record<BridgeType, number> = {
      none: 0,
      pondLow: 2,
      pondMed: 4,
      pondHigh: 6,
    };

    // For TILE LOOKUP: Use floored world positions to prevent flickering at tile boundaries
    const tileRefX = Math.floor(frame.renderX);
    const tileRefY = Math.floor(frame.renderY) + height - 2 + BRIDGE_OFFSETS[reflectionState.bridgeType];

    // For SCREEN RENDERING: Use Math.round() for consistent pixel alignment
    const reflectionWorldY = frame.renderY + height - 2 + BRIDGE_OFFSETS[reflectionState.bridgeType];
    const screenX = Math.round(frame.renderX - cameraWorldX);
    const screenY = Math.round(reflectionWorldY - cameraWorldY);

    // Create mask canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = frame.sw;
    maskCanvas.height = frame.sh;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;
    const maskImage = maskCtx.createImageData(maskCanvas.width, maskCanvas.height);
    const maskData = maskImage.data;

    // Calculate tile range for mask building
    const pixelStartTileX = Math.floor(tileRefX / METATILE_SIZE);
    const pixelEndTileX = Math.floor((tileRefX + frame.sw - 1) / METATILE_SIZE);
    const pixelStartTileY = Math.floor(tileRefY / METATILE_SIZE);
    const pixelEndTileY = Math.floor((tileRefY + frame.sh - 1) / METATILE_SIZE);

    // Expand range by 1 tile in each direction to catch tiles at boundaries during movement
    const startTileX = pixelStartTileX - 1;
    const endTileX = pixelEndTileX + 1;
    const startTileY = pixelStartTileY;
    const endTileY = pixelEndTileY + 1;

    // Build mask from reflective tiles
    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        const info = getReflectionMetaFromSnapshot(snapshot, tx, ty);
        if (!info?.meta?.isReflective) continue;

        const mask = info.meta.pixelMask;
        const tileLeft = tx * METATILE_SIZE - tileRefX;
        const tileTop = ty * METATILE_SIZE - tileRefY;

        for (let y = 0; y < METATILE_SIZE; y++) {
          const globalY = tileTop + y;
          if (globalY < 0 || globalY >= frame.sh) continue;
          for (let x = 0; x < METATILE_SIZE; x++) {
            const globalX = tileLeft + x;
            if (globalX < 0 || globalX >= frame.sw) continue;
            if (mask[y * METATILE_SIZE + x]) {
              const index = (globalY * frame.sw + globalX) * 4 + 3;
              maskData[index] = 255;
            }
          }
        }
      }
    }

    maskCtx.putImageData(maskImage, 0, 0);

    // Create reflection canvas (flipped sprite)
    const reflectionCanvas = document.createElement('canvas');
    reflectionCanvas.width = frame.sw;
    reflectionCanvas.height = frame.sh;
    const reflectionCtx = reflectionCanvas.getContext('2d');
    if (!reflectionCtx) return;

    // Flip vertically
    reflectionCtx.translate(0, frame.sh);
    reflectionCtx.scale(frame.flip ? -1 : 1, -1);

    // Draw sprite
    reflectionCtx.drawImage(
      frame.sprite,
      frame.sx, frame.sy, frame.sw, frame.sh,
      frame.flip ? -frame.sw : 0, 0, frame.sw, frame.sh
    );

    // Reset transform
    reflectionCtx.setTransform(1, 0, 0, 1, 0, 0);

    // Apply tint based on reflection type
    reflectionCtx.globalCompositeOperation = 'source-atop';
    if (reflectionState.reflectionType === 'water') {
      reflectionCtx.fillStyle = 'rgba(100, 150, 255, 0.35)';
    } else {
      // Ice tint (lighter)
      reflectionCtx.fillStyle = 'rgba(200, 220, 255, 0.25)';
    }
    reflectionCtx.fillRect(0, 0, frame.sw, frame.sh);

    // Apply mask
    reflectionCtx.globalCompositeOperation = 'destination-in';
    reflectionCtx.drawImage(maskCanvas, 0, 0);

    // Draw to main canvas with transparency
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.drawImage(reflectionCanvas, screenX, screenY);
    ctx.restore();
  }, [getReflectionMetaFromSnapshot]);

  // Initialize WebGL pipeline and player once
  useEffect(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;

    // Create hidden WebGL canvas
    const webglCanvas = document.createElement('canvas');
    webglCanvasRef.current = webglCanvas;

    if (!isWebGL2Supported(webglCanvas)) {
      setStats((s) => ({ ...s, webgl2Supported: false, error: 'WebGL2 not supported in this browser' }));
      return;
    }

    try {
      const pipeline = new WebGLRenderPipeline(webglCanvas);
      pipelineRef.current = pipeline;
      setStats((s) => ({ ...s, webgl2Supported: true, error: null }));
    } catch (e) {
      setStats((s) => ({ ...s, webgl2Supported: false, error: 'Failed to create WebGL pipeline' }));
      return;
    }

    // Initialize player controller
    const player = new PlayerController();
    playerRef.current = player;

    // Load player sprites
    const loadPlayerSprites = async () => {
      try {
        await player.loadSprite('walking', '/pokeemerald/graphics/object_events/pics/people/brendan/walking.png');
        await player.loadSprite('running', '/pokeemerald/graphics/object_events/pics/people/brendan/running.png');
        await player.loadSprite('surfing', '/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png');
        await player.loadSprite('shadow', '/pokeemerald/graphics/field_effects/pics/shadow_medium.png');
        playerLoadedRef.current = true;
      } catch (err) {
        console.error('Failed to load player sprites:', err);
      }
    };
    loadPlayerSprites();

    // Load field sprites (grass, sand, etc.)
    const loadFieldSprites = async () => {
      try {
        await fieldSprites.loadAll();
        fieldSpritesLoadedRef.current = true;
      } catch (err) {
        console.error('Failed to load field sprites:', err);
      }
    };
    loadFieldSprites();

    let frameCount = 0;
    let fpsTime = performance.now();

    const renderLoop = () => {
      const pipeline = pipelineRef.current;
      const stitchedWorld = stitchedWorldRef.current;
      const displayCanvas = displayCanvasRef.current;
      // Need stitched world to render
      if (!pipeline || !stitchedWorld || !displayCanvas) {
        rafRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const ctx2d = displayCanvas.getContext('2d');
      if (!ctx2d) {
        rafRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      // Advance GBA-frame counter
      const nowTime = performance.now();
      const dt = nowTime - lastTimeRef.current;
      lastTimeRef.current = nowTime;
      gbaAccumRef.current += dt;
      while (gbaAccumRef.current >= GBA_FRAME_MS) {
        gbaAccumRef.current -= GBA_FRAME_MS;
        gbaFrameRef.current++;
      }

      const { width, height, minX, minY } = worldBoundsRef.current;

      // Convert tile offsets to pixel offsets for camera
      const worldMinX = minX * METATILE_SIZE;
      const worldMinY = minY * METATILE_SIZE;
      const player = playerRef.current;

      // Update player if loaded (handles its own input via keyboard events)
      if (player && playerLoadedRef.current) {
        player.update(dt);

        // Update world manager with player position and direction (triggers dynamic map loading)
        const worldManager = worldManagerRef.current;
        if (worldManager) {
          // Get player's current facing direction for predictive tileset loading
          const playerDirection = player.getFacingDirection();
          worldManager.update(player.tileX, player.tileY, playerDirection);

          // Update debug info every ~500ms
          if (gbaFrameRef.current % 30 === 0) {
            const debugInfo = worldManager.getDebugInfo(player.tileX, player.tileY);
            setMapDebugInfo(debugInfo);
          }
        }
      }

      // Camera follows player (center player in viewport)
      const viewportWidth = VIEWPORT_TILES_WIDE * METATILE_SIZE;
      const viewportHeight = VIEWPORT_TILES_HIGH * METATILE_SIZE;
      if (player && playerLoadedRef.current) {
        const focus = player.getCameraFocus();
        cameraRef.current.x = focus.x - viewportWidth / 2;
        cameraRef.current.y = focus.y - viewportHeight / 2;
      }

      // Clamp camera to world bounds with some border overscan
      // Allow scrolling a few tiles beyond edges to see border tiles
      // For stitched worlds, worldMinX/Y can be negative (maps connected left/above anchor)
      const BORDER_OVERSCAN = 3 * METATILE_SIZE; // Allow 3 tiles of border viewing
      const camMinX = worldMinX - BORDER_OVERSCAN;
      const camMaxX = worldMinX + width - viewportWidth + BORDER_OVERSCAN;
      const camMinY = worldMinY - BORDER_OVERSCAN;
      const camMaxY = worldMinY + height - viewportHeight + BORDER_OVERSCAN;
      cameraRef.current.x = Math.max(camMinX, Math.min(cameraRef.current.x, Math.max(camMinX, camMaxX)));
      cameraRef.current.y = Math.max(camMinY, Math.min(cameraRef.current.y, Math.max(camMinY, camMaxY)));

      if (width > 0 && height > 0) {
        // Ensure display canvas is sized to viewport
        if (displayCanvas.width !== viewportWidth || displayCanvas.height !== viewportHeight) {
          displayCanvas.width = viewportWidth;
          displayCanvas.height = viewportHeight;
        }

        const start = performance.now();

        // Create WorldCameraView for viewport culling
        const cameraX = cameraRef.current.x;
        const cameraY = cameraRef.current.y;
        const startTileX = Math.floor(cameraX / METATILE_SIZE);
        const startTileY = Math.floor(cameraY / METATILE_SIZE);
        const subTileOffsetX = cameraX - startTileX * METATILE_SIZE;
        const subTileOffsetY = cameraY - startTileY * METATILE_SIZE;

        // Render +1 tile in each direction to cover sub-tile offset
        // (when we shift by subTileOffsetX/Y, we need extra content on the edges)
        const renderTilesWide = VIEWPORT_TILES_WIDE + 1;
        const renderTilesHigh = VIEWPORT_TILES_HIGH + 1;

        const view: WorldCameraView = {
          // CameraView base fields
          cameraX,
          cameraY,
          startTileX,
          startTileY,
          subTileOffsetX,
          subTileOffsetY,
          tilesWide: renderTilesWide,
          tilesHigh: renderTilesHigh,
          pixelWidth: renderTilesWide * METATILE_SIZE,
          pixelHeight: renderTilesHigh * METATILE_SIZE,
          // WorldCameraView specific fields
          worldStartTileX: startTileX,
          worldStartTileY: startTileY,
          cameraWorldX: cameraX,
          cameraWorldY: cameraY,
        };

        // Get player elevation for layer splitting (same as useCompositeScene)
        const playerElevation = player && playerLoadedRef.current ? player.getElevation() : 0;

        // Render using pipeline (this does viewport culling!)
        // Force full render each frame to avoid dirty tracking issues during testing
        // animationChanged triggers texture updates for animated tiles
        pipeline.render(
          null as any, // RenderContext not used by WebGL pipeline
          view,
          playerElevation,
          { gameFrame: gbaFrameRef.current, needsFullRender: true, animationChanged: true }
        );

        // Composite with sprite rendering between layers (hybrid rendering test)
        // This matches the game's render order:
        //   1. Background layer (BG2 - always behind)
        //   2. TopBelow layer (BG1 tiles behind player based on elevation)
        //   3. Player and other sprites
        //   4. TopAbove layer (BG1 tiles in front of player - bridges, roofs, etc)

        pipeline.compositeBackgroundOnly(ctx2d, view);
        pipeline.compositeTopBelowOnly(ctx2d, view);

        // Create ObjectRenderer view for field effects
        const objView: ObjectRendererView = {
          cameraWorldX: cameraX,
          cameraWorldY: cameraY,
          pixelWidth: viewportWidth,
          pixelHeight: viewportHeight,
        };

        // Render field effects and player with proper Y-sorting
        if (player && playerLoadedRef.current) {
          const playerWorldY = player.y + 16; // Player feet Y position
          const currentSnapshot = worldSnapshotRef.current;

          // Render player reflection (behind player, on water/ice tiles)
          if (currentSnapshot) {
            const { width: spriteWidth, height: spriteHeight } = player.getSpriteSize();
            const reflectionState = computeReflectionStateFromSnapshot(
              currentSnapshot,
              player.tileX,
              player.tileY,
              spriteWidth,
              spriteHeight
            );
            if (reflectionState.hasReflection) {
              renderPlayerReflection(
                ctx2d,
                player,
                reflectionState,
                cameraX,
                cameraY,
                currentSnapshot
              );
            }
          }

          // Create render context for field effect masking (water ripples, puddle splashes)
          const fieldEffectRenderContext = currentSnapshot
            ? createRenderContextFromSnapshot(currentSnapshot)
            : null;

          // Render grass effects behind player (bottom layer)
          if (fieldSpritesLoadedRef.current) {
            const effects = player.getGrassEffectManager().getEffectsForRendering();
            ObjectRenderer.renderFieldEffects(
              ctx2d,
              effects,
              {
                grass: fieldSprites.sprites.grass,
                longGrass: fieldSprites.sprites.longGrass,
                sand: fieldSprites.sprites.sand,
                splash: fieldSprites.sprites.splash,
                ripple: fieldSprites.sprites.ripple,
                arrow: null,
                itemBall: fieldSprites.sprites.itemBall,
              },
              objView,
              playerWorldY,
              'bottom',
              fieldEffectRenderContext ?? undefined
            );
          }

          // Render player
          player.render(ctx2d, cameraX, cameraY);

          // Render grass effects in front of player (top layer)
          if (fieldSpritesLoadedRef.current) {
            const effects = player.getGrassEffectManager().getEffectsForRendering();
            ObjectRenderer.renderFieldEffects(
              ctx2d,
              effects,
              {
                grass: fieldSprites.sprites.grass,
                longGrass: fieldSprites.sprites.longGrass,
                sand: fieldSprites.sprites.sand,
                splash: fieldSprites.sprites.splash,
                ripple: fieldSprites.sprites.ripple,
                arrow: null,
                itemBall: fieldSprites.sprites.itemBall,
              },
              objView,
              playerWorldY,
              'top',
              fieldEffectRenderContext ?? undefined
            );
          }
        }

        pipeline.compositeTopAbove(ctx2d, view);

        const renderTime = performance.now() - start;

        // Get tile count from pipeline stats
        const pipelineStats = pipeline.getStats();
        const tileCount = pipelineStats.passTileCounts.background +
                          pipelineStats.passTileCounts.topBelow +
                          pipelineStats.passTileCounts.topAbove;

        frameCount++;
        const now = performance.now();
        if (now - fpsTime >= 500) {
          const fps = Math.round((frameCount * 1000) / (now - fpsTime));
          setStats((s) => ({
            ...s,
            tileCount,
            renderTimeMs: renderTime,
            fps,
          }));
          setCameraDisplay({ x: cameraRef.current.x, y: cameraRef.current.y });

          // Gather debug tile info for the tile under the player
          if (player && playerLoadedRef.current) {
            const tileX = player.tileX;
            const tileY = player.tileY;
            const stitchedWorld = stitchedWorldRef.current;

            if (stitchedWorld) {
              // Use stitched world data
              const { maps, primaryAttributes, secondaryAttributes } = stitchedWorld;
              // Find which map the player is in
              for (const map of maps) {
                const localX = tileX - map.offsetX;
                const localY = tileY - map.offsetY;
                if (localX >= 0 && localX < map.entry.width && localY >= 0 && localY < map.entry.height) {
                  const mapTile = map.mapData.layout[localY * map.entry.width + localX];
                  const metatileId = mapTile.metatileId;
                  const isSecondary = metatileId >= SECONDARY_TILE_OFFSET;
                  const attrIndex = isSecondary ? metatileId - SECONDARY_TILE_OFFSET : metatileId;
                  const attrArray = isSecondary ? secondaryAttributes : primaryAttributes;
                  const attrs = attrArray[attrIndex] ?? { behavior: 0, layerType: 0 };
                  setDebugTile({
                    tileX,
                    tileY,
                    metatileId,
                    tileElevation: mapTile.elevation,
                    playerElevation,
                    collision: mapTile.collision,
                    layerType: attrs.layerType,
                    behavior: attrs.behavior,
                  });
                  break;
                }
              }
            }
          }

          frameCount = 0;
          fpsTime = now;
        }
      }

      rafRef.current = requestAnimationFrame(renderLoop);
    };

    rafRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      pipelineRef.current?.dispose();
      pipelineRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
      playerLoadedRef.current = false;
      worldManagerRef.current?.dispose();
      worldManagerRef.current = null;
    };
  }, []);

  // Load selected map assets and configure pipeline using WorldManager
  useEffect(() => {
    const entry = selectedMap;
    const pipeline = pipelineRef.current;
    if (!entry || !pipeline) return;

    let cancelled = false;
    setLoading(true);
    setStats((s) => ({ ...s, error: null }));
    // Reset camera when map changes
    cameraRef.current = { x: 0, y: 0 };
    setCameraDisplay({ x: 0, y: 0 });

    // Clean up previous world manager
    if (worldManagerRef.current) {
      worldManagerRef.current.dispose();
      worldManagerRef.current = null;
    }

    const load = async () => {
      try {
        // Create WorldManager and initialize with selected map
        const worldManager = new WorldManager();
        worldManagerRef.current = worldManager;

        // Subscribe to world events for dynamic updates
        worldManager.on((event) => {
          if (cancelled) return;

          if (event.type === 'mapsChanged') {
            // Update snapshot and resolvers
            worldSnapshotRef.current = event.snapshot;

            // Update tile resolver
            const resolver = createSnapshotTileResolver(event.snapshot);
            pipeline.setTileResolver(resolver);

            // Update player resolver
            const player = playerRef.current;
            if (player) {
              const playerResolver = createSnapshotPlayerTileResolver(event.snapshot);
              player.setTileResolver(playerResolver);
            }

            // Update world bounds
            const { worldBounds } = event.snapshot;
            const worldWidth = worldBounds.width * METATILE_SIZE;
            const worldHeight = worldBounds.height * METATILE_SIZE;
            worldBoundsRef.current = {
              width: worldWidth,
              height: worldHeight,
              minX: worldBounds.minX,
              minY: worldBounds.minY,
            };
            setWorldSize({ width: worldWidth, height: worldHeight });
            setStitchedMapCount(event.snapshot.maps.length);

            // Invalidate pipeline cache
            pipeline.invalidate();
          }

          if (event.type === 'tilesetsChanged') {
            // Upload tilesets based on SCHEDULER's GPU slot assignment, not array index!
            // The scheduler determines which pair should be in which GPU slot
            const scheduler = worldManager.getScheduler();
            const { slot0: slot0PairId, slot1: slot1PairId } = scheduler.getGpuSlots();

            // Upload to GPU slot 0
            if (slot0PairId) {
              const slot0Pair = scheduler.getCachedPair(slot0PairId);
              if (slot0Pair) {
                pipeline.uploadTilesets(
                  slot0Pair.primaryImage.data,
                  slot0Pair.primaryImage.width,
                  slot0Pair.primaryImage.height,
                  slot0Pair.secondaryImage.data,
                  slot0Pair.secondaryImage.width,
                  slot0Pair.secondaryImage.height,
                  slot0Pair.animations
                );
                pipeline.uploadPalettes(combineTilesetPalettes(slot0Pair.primaryPalettes, slot0Pair.secondaryPalettes));
              }
            }

            // Upload to GPU slot 1
            if (slot1PairId) {
              const slot1Pair = scheduler.getCachedPair(slot1PairId);
              if (slot1Pair) {
                pipeline.uploadTilesetsPair1(
                  slot1Pair.primaryImage.data,
                  slot1Pair.primaryImage.width,
                  slot1Pair.primaryImage.height,
                  slot1Pair.secondaryImage.data,
                  slot1Pair.secondaryImage.width,
                  slot1Pair.secondaryImage.height,
                  slot1Pair.animations
                );
                pipeline.uploadPalettesPair1(combineTilesetPalettes(slot1Pair.primaryPalettes, slot1Pair.secondaryPalettes));
              }
            }

            // Refresh tile resolver with updated GPU slot info
            const freshSnapshot = worldManager.getSnapshot();
            worldSnapshotRef.current = freshSnapshot;
            const resolver = createSnapshotTileResolver(freshSnapshot);
            pipeline.setTileResolver(resolver);

            pipeline.invalidate();
          }

          if (event.type === 'reanchored') {
            // Adjust player position by the offset shift
            const player = playerRef.current;
            if (player) {
              player.setPosition(
                player.tileX - event.offsetShift.x,
                player.tileY - event.offsetShift.y
              );
            }
          }

          if (event.type === 'gpuSlotsSwapped') {
            // GPU slots changed due to player approaching tileset boundary
            // Re-upload tilesets based on scheduler's new slot assignments
            const scheduler = worldManager.getScheduler();
            const { slot0: slot0PairId, slot1: slot1PairId } = scheduler.getGpuSlots();

            if (slot0PairId) {
              const pair0 = scheduler.getCachedPair(slot0PairId);
              if (pair0) {
                pipeline.uploadTilesets(
                  pair0.primaryImage.data,
                  pair0.primaryImage.width,
                  pair0.primaryImage.height,
                  pair0.secondaryImage.data,
                  pair0.secondaryImage.width,
                  pair0.secondaryImage.height,
                  pair0.animations
                );
                pipeline.uploadPalettes(combineTilesetPalettes(pair0.primaryPalettes, pair0.secondaryPalettes));
              }
            }

            if (slot1PairId) {
              const pair1 = scheduler.getCachedPair(slot1PairId);
              if (pair1) {
                pipeline.uploadTilesetsPair1(
                  pair1.primaryImage.data,
                  pair1.primaryImage.width,
                  pair1.primaryImage.height,
                  pair1.secondaryImage.data,
                  pair1.secondaryImage.width,
                  pair1.secondaryImage.height,
                  pair1.animations
                );
                pipeline.uploadPalettesPair1(combineTilesetPalettes(pair1.primaryPalettes, pair1.secondaryPalettes));
              }
            }

            // CRITICAL: Get fresh snapshot with updated pairIdToGpuSlot and recreate tile resolver!
            // Without this, the tile resolver has stale GPU slot info and can't render border tiles correctly
            const freshSnapshot = worldManager.getSnapshot();
            worldSnapshotRef.current = freshSnapshot;
            const resolver = createSnapshotTileResolver(freshSnapshot);
            pipeline.setTileResolver(resolver);

            // Also update player resolver
            const player = playerRef.current;
            if (player) {
              const playerResolver = createSnapshotPlayerTileResolver(freshSnapshot);
              player.setTileResolver(playerResolver);
            }

            if (event.needsRebuild) {
              pipeline.invalidate();
            }
          }
        });

        // Set up GPU upload callback for scheduler
        worldManager.setGpuUploadCallback((pair, slot) => {
          if (slot === 0) {
            pipeline.uploadTilesets(
              pair.primaryImage.data,
              pair.primaryImage.width,
              pair.primaryImage.height,
              pair.secondaryImage.data,
              pair.secondaryImage.width,
              pair.secondaryImage.height,
              pair.animations
            );
            pipeline.uploadPalettes(combineTilesetPalettes(pair.primaryPalettes, pair.secondaryPalettes));
          } else {
            pipeline.uploadTilesetsPair1(
              pair.primaryImage.data,
              pair.primaryImage.width,
              pair.primaryImage.height,
              pair.secondaryImage.data,
              pair.secondaryImage.width,
              pair.secondaryImage.height,
              pair.animations
            );
            pipeline.uploadPalettesPair1(combineTilesetPalettes(pair.primaryPalettes, pair.secondaryPalettes));
          }
        });

        // Initialize world from selected map
        const snapshot = await worldManager.initialize(entry.id);
        if (cancelled) return;

        worldSnapshotRef.current = snapshot;

        // Build tileset runtimes for reflection detection
        buildTilesetRuntimesFromSnapshot(snapshot);

        // Also store as stitched world for backward compatibility with debug display
        stitchedWorldRef.current = {
          maps: snapshot.maps.map(m => ({
            entry: m.entry,
            mapData: m.mapData,
            offsetX: m.offsetX,
            offsetY: m.offsetY,
          })),
          anchorId: snapshot.anchorMapId,
          worldBounds: snapshot.worldBounds,
          tilesetPairs: snapshot.tilesetPairs,
          mapTilesetPairIndex: snapshot.mapTilesetPairIndex,
          // Legacy fields from primary pair
          primaryMetatiles: snapshot.tilesetPairs[0]?.primaryMetatiles ?? [],
          secondaryMetatiles: snapshot.tilesetPairs[0]?.secondaryMetatiles ?? [],
          primaryAttributes: snapshot.tilesetPairs[0]?.primaryAttributes ?? [],
          secondaryAttributes: snapshot.tilesetPairs[0]?.secondaryAttributes ?? [],
          primaryImage: snapshot.tilesetPairs[0]?.primaryImage ?? { data: new Uint8Array(), width: 0, height: 0 },
          secondaryImage: snapshot.tilesetPairs[0]?.secondaryImage ?? { data: new Uint8Array(), width: 0, height: 0 },
          primaryPalettes: snapshot.tilesetPairs[0]?.primaryPalettes ?? [],
          secondaryPalettes: snapshot.tilesetPairs[0]?.secondaryPalettes ?? [],
          animations: snapshot.tilesetPairs[0]?.animations ?? [],
          borderMetatiles: snapshot.anchorBorderMetatiles ?? [],
        };

        // Set up tile resolver
        const resolver = createSnapshotTileResolver(snapshot);
        pipeline.setTileResolver(resolver);

        // Upload tilesets
        uploadTilesetsFromSnapshot(pipeline, snapshot);

        // Invalidate pipeline cache
        pipeline.invalidate();

        // Set world bounds
        const { worldBounds } = snapshot;
        const worldWidth = worldBounds.width * METATILE_SIZE;
        const worldHeight = worldBounds.height * METATILE_SIZE;
        worldBoundsRef.current = {
          width: worldWidth,
          height: worldHeight,
          minX: worldBounds.minX,
          minY: worldBounds.minY,
        };
        setWorldSize({ width: worldWidth, height: worldHeight });
        setStitchedMapCount(snapshot.maps.length);

        // Set up player
        const player = playerRef.current;
        if (player) {
          const playerResolver = createSnapshotPlayerTileResolver(snapshot);
          player.setTileResolver(playerResolver);

          // Spawn player at center of anchor map (offset 0,0)
          const spawnX = Math.floor(entry.width / 2);
          const spawnY = Math.floor(entry.height / 2);
          player.setPosition(spawnX, spawnY);
        }

        setStats((s) => ({ ...s, error: null }));
      } catch (err) {
        if (!cancelled) {
          setStats((s) => ({
            ...s,
            error: err instanceof Error ? err.message : 'Failed to load map assets',
          }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (worldManagerRef.current) {
        worldManagerRef.current.dispose();
        worldManagerRef.current = null;
      }
    };
  }, [selectedMap, createSnapshotTileResolver, createSnapshotPlayerTileResolver, uploadTilesetsFromSnapshot]);

  if (!selectedMap) {
    return (
      <div className="webgl-map-page">
        <h1>WebGL Map Viewer</h1>
        <p>No maps available.</p>
      </div>
    );
  }

  const pixelWidth = worldSize.width;
  const pixelHeight = worldSize.height;

  return (
    <div className="webgl-map-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1>WebGL Map Viewer</h1>
        <a href="#/" style={{ color: '#88f' }}>Back to main</a>
      </div>
      <p style={{ marginTop: -6, color: '#ccc' }}>
        WebGL tile rendering with player sprite. Powered by the WebGL tile renderer + palette/animation system.
      </p>

      <div className="selector">
        <label htmlFor="map-select">Choose map</label>
        <select
          id="map-select"
          value={selectedMap.id}
          onChange={(e) => {
            setSelectedMapId(e.target.value);
            e.currentTarget.blur();
          }}
        >
          {renderableMaps.map((map) => (
            <option key={map.id} value={map.id}>
              {map.name} ({map.width}x{map.height})
            </option>
          ))}
        </select>
        <div className="selector__meta">
          <span>
            Tilesets: {selectedMap.primaryTilesetId.replace('gTileset_', '')} / {selectedMap.secondaryTilesetId.replace('gTileset_', '')}
          </span>
          <span style={{ display: 'block', marginTop: 4 }}>
            Size: {selectedMap.width}×{selectedMap.height} metatiles ({pixelWidth}×{pixelHeight}px)
          </span>
          {stitchedMapCount > 1 && (
            <span style={{ display: 'block', marginTop: 4, color: '#8cf' }}>
              Stitched: {stitchedMapCount} maps ({worldSize.width}×{worldSize.height}px world)
            </span>
          )}
        </div>
        {loading && <div style={{ marginTop: 8, color: '#88f' }}>Loading map data…</div>}
        {stats.error && <div style={{ marginTop: 8, color: '#ff6666' }}>Error: {stats.error}</div>}
      </div>

      <div className="map-card">
        <div className="map-canvas-wrapper">
          <canvas
            ref={displayCanvasRef}
            className="webgl-map-canvas"
            style={{ width: VIEWPORT_TILES_WIDE * METATILE_SIZE, height: VIEWPORT_TILES_HIGH * METATILE_SIZE }}
          />
        </div>
        <div className="map-stats">
          <div><strong>Tiles:</strong> {stats.tileCount.toLocaleString()}</div>
          <div><strong>FPS:</strong> {stats.fps}</div>
          <div><strong>Render:</strong> {stats.renderTimeMs.toFixed(2)} ms</div>
          <div><strong>WebGL2:</strong> {stats.webgl2Supported ? 'Yes' : 'No'}</div>
          <div><strong>Viewport:</strong> {VIEWPORT_TILES_WIDE}×{VIEWPORT_TILES_HIGH} tiles</div>
          <div><strong>Camera:</strong> ({Math.round(cameraDisplay.x)}, {Math.round(cameraDisplay.y)})</div>
          <div><strong>World:</strong> {worldSize.width}×{worldSize.height}px</div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#9fb0cc' }}>
            Use Arrow Keys to move player. Hold Z to run.
          </div>

          {/* Debug tile info panel */}
          {debugTile && (
            <div style={{ marginTop: 12, padding: 8, background: '#1a1f2d', borderRadius: 4, fontSize: 11 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#88f' }}>Tile Debug</div>
              <div><strong>Position:</strong> ({debugTile.tileX}, {debugTile.tileY})</div>
              <div><strong>Metatile ID:</strong> {debugTile.metatileId} {debugTile.metatileId >= 512 ? '(secondary)' : '(primary)'}</div>
              <div><strong>Tile Elev:</strong> {debugTile.tileElevation}</div>
              <div><strong>Player Elev:</strong> {debugTile.playerElevation}</div>
              <div><strong>Collision:</strong> {debugTile.collision}</div>
              <div><strong>Layer Type:</strong> {debugTile.layerType} {debugTile.layerType === 0 ? '(NORMAL - top in front)' : debugTile.layerType === 1 ? '(COVERED - top in bg)' : debugTile.layerType === 2 ? '(SPLIT)' : ''}</div>
              <div><strong>Behavior:</strong> 0x{debugTile.behavior.toString(16).toUpperCase()}</div>
              <div style={{ marginTop: 4, color: debugTile.tileElevation === debugTile.playerElevation ? '#8f8' : '#f88' }}>
                {debugTile.tileElevation === debugTile.playerElevation ? '✓ Same elevation' : '✗ Different elevation'}
              </div>
              <div style={{ marginTop: 2, fontSize: 10, color: '#888' }}>
                Elev 3 priority: 2 (below BG1)
              </div>
            </div>
          )}

          {/* Map stitching debug panel */}
          {mapDebugInfo && (
            <div style={{ marginTop: 12, padding: 8, background: '#1a2d1a', borderRadius: 4, fontSize: 10, maxHeight: 400, overflowY: 'auto' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#8f8' }}>Map Stitching Debug</div>
              <div><strong>Player:</strong> ({mapDebugInfo.playerPos.x}, {mapDebugInfo.playerPos.y})</div>
              <div><strong>Current:</strong> {mapDebugInfo.currentMap ?? 'None'}</div>
              <div><strong>Anchor:</strong> {mapDebugInfo.anchorMap}</div>
              <div><strong>Tileset Pairs:</strong> {mapDebugInfo.tilesetPairs}</div>
              <div style={{ marginTop: 4, fontWeight: 'bold', color: '#ff8' }}>GPU Slots:</div>
              <div style={{ marginLeft: 8 }}>
                <div>Slot 0: {mapDebugInfo.gpuSlot0?.replace('gTileset_', '').replace('+gTileset_', ' + ') ?? 'empty'}</div>
                <div>Slot 1: {mapDebugInfo.gpuSlot1?.replace('gTileset_', '').replace('+gTileset_', ' + ') ?? 'empty'}</div>
              </div>
              <div style={{ marginTop: 4, fontWeight: 'bold' }}>Connections:</div>
              {mapDebugInfo.expectedConnections.map((c, i) => (
                <div key={i} style={{ color: c.loaded ? '#8f8' : '#f88', marginLeft: 8 }}>
                  {c.direction}: {c.to.replace('MAP_', '')} {c.loaded ? '✓' : '✗'}
                </div>
              ))}
              <div style={{ marginTop: 4, fontWeight: 'bold' }}>Loaded Maps ({mapDebugInfo.loadedMaps.length}):</div>
              {mapDebugInfo.loadedMaps.map((m, i) => (
                <div key={i} style={{ marginLeft: 8, color: m.id === mapDebugInfo.currentMap ? '#ff8' : m.inGpu ? '#8f8' : '#f88' }}>
                  {m.id.replace('MAP_', '')} @({m.offsetX},{m.offsetY}) {m.inGpu ? '✓GPU' : '✗GPU'} borders:{m.borderTileCount}
                </div>
              ))}
              {mapDebugInfo.boundaries.length > 0 && (
                <>
                  <div style={{ marginTop: 4, fontWeight: 'bold', color: '#f8f' }}>Tileset Boundaries ({mapDebugInfo.boundaries.length}):</div>
                  {mapDebugInfo.boundaries.map((b, i) => (
                    <div key={i} style={{ marginLeft: 8, color: '#f8f', fontSize: 9 }}>
                      @({b.x},{b.y}) {b.orientation} len:{b.length}
                    </div>
                  ))}
                  <div style={{ marginTop: 2, color: mapDebugInfo.nearbyBoundaryCount > 0 ? '#ff8' : '#888' }}>
                    Nearby: {mapDebugInfo.nearbyBoundaryCount} {mapDebugInfo.nearbyBoundaryCount > 0 ? '(preloading)' : ''}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WebGLMapPage;
