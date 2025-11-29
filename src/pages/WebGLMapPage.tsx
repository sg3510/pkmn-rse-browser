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
import { uploadTilesetsFromSnapshot, combineTilesetPalettes } from '../rendering/webgl/TilesetUploader';
import type { TileResolverFn, WorldCameraView, LoadedAnimation, ReflectionMeta, RenderContext } from '../rendering/types';
import { PlayerController, type TileResolver as PlayerTileResolver } from '../game/PlayerController';
import { CameraController, createWebGLCameraController } from '../game/CameraController';
import { TileResolverFactory } from '../game/TileResolverFactory';
import {
  executeWarp,
  type WarpExecutorDeps,
  type WarpDestination,
} from '../game/WarpExecutor';
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
import {
  BRIDGE_OFFSETS,
  getReflectionTint,
  getReflectionAlpha,
  getGlobalShimmer,
  ReflectionShimmer,
  applyGbaAffineShimmer,
} from '../field/ReflectionRenderer';
import { detectWarpTrigger, resolveTileAt, findWarpEventAt, type WarpTrigger } from '../components/map/utils';
import type { ReflectionState } from '../components/map/types';
import { WarpHandler } from '../field/WarpHandler';
import { FadeController } from '../field/FadeController';
import { FADE_TIMING, type CardinalDirection } from '../field/types';
import { useDoorAnimations } from '../hooks/useDoorAnimations';
import { useArrowOverlay } from '../hooks/useArrowOverlay';
import { useDoorSequencer } from '../hooks/useDoorSequencer';
import {
  DebugPanel,
  DEFAULT_DEBUG_OPTIONS,
  type DebugOptions,
  type DebugState,
  type WebGLDebugState,
  type PlayerDebugInfo,
} from '../components/debug';
import {
  isDoorBehavior,
  isArrowWarpBehavior,
  isNonAnimatedDoorBehavior,
  getArrowDirectionFromBehavior,
} from '../utils/metatileBehaviors';
import { getMetatileIdFromMapTile } from '../utils/mapLoader';
import './WebGLMapPage.css';

const SECONDARY_TILE_OFFSET = 512;
const GBA_FRAME_MS = 1000 / 59.7275; // Match real GBA vblank timing (~59.73 Hz)

type RenderStats = {
  webgl2Supported: boolean;
  tileCount: number;
  renderTimeMs: number;
  fps: number;
  error: string | null;
};

// CameraState type replaced by CameraController from '../game/CameraController'

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
  const cameraRef = useRef<CameraController | null>(null);
  const gbaFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const gbaAccumRef = useRef<number>(0);

  // Player controller ref
  const playerRef = useRef<PlayerController | null>(null);

  // Warp system refs
  const warpHandlerRef = useRef<WarpHandler>(new WarpHandler());
  const fadeControllerRef = useRef<FadeController>(new FadeController());
  const pendingWarpRef = useRef<WarpTrigger | null>(null);
  const warpingRef = useRef<boolean>(false);
  const playerLoadedRef = useRef<boolean>(false);
  const playerHiddenRef = useRef<boolean>(false);

  // Door animation and arrow overlay hooks (reuse Canvas2D code)
  const doorAnimations = useDoorAnimations();
  const arrowOverlay = useArrowOverlay();
  const doorSequencer = useDoorSequencer({ warpHandler: warpHandlerRef.current });

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
  const [cameraDisplay, setCameraDisplay] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
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

  // Debug state for warp/tileset tracking
  const [warpDebugInfo, setWarpDebugInfo] = useState<{
    lastWarpTo: string;
    currentAnchor: string;
    snapshotMaps: string[];
    snapshotPairs: string[];
    gpuSlots: Record<string, number>;
    resolverVersion: number;
    worldBounds: { minX: number; minY: number; width: number; height: number };
  } | null>(null);

  // Debug panel state
  const [debugOptions, setDebugOptions] = useState<DebugOptions>(DEFAULT_DEBUG_OPTIONS);
  const [playerDebugInfo, setPlayerDebugInfo] = useState<PlayerDebugInfo | null>(null);

  // Create WebGL debug state from existing debug info
  const webglDebugState = useMemo<WebGLDebugState>(() => ({
    mapStitching: mapDebugInfo,
    warp: warpDebugInfo,
    renderStats: {
      tileCount: stats.tileCount,
      fps: stats.fps,
      renderTimeMs: stats.renderTimeMs,
      webgl2Supported: stats.webgl2Supported,
      viewportTilesWide: VIEWPORT_TILES_WIDE,
      viewportTilesHigh: VIEWPORT_TILES_HIGH,
      cameraX: Math.round(cameraDisplay.x),
      cameraY: Math.round(cameraDisplay.y),
      worldWidthPx: worldSize.width,
      worldHeightPx: worldSize.height,
    },
    shimmer: getGlobalShimmer().getDebugInfo(),
  }), [mapDebugInfo, warpDebugInfo, stats, cameraDisplay, worldSize]);

  // Debug state for the panel (WebGL page doesn't track objects)
  const debugState = useMemo<DebugState>(() => ({
    player: playerDebugInfo,
    tile: null,
    objectsAtPlayerTile: null,
    objectsAtFacingTile: null,
    adjacentObjects: null,
    allVisibleNPCs: [],
    allVisibleItems: [],
    totalNPCCount: 0,
    totalItemCount: 0,
  }), [playerDebugInfo]);

  // Track resolver creation for debugging
  const resolverIdRef = useRef(0);

  // Create tile resolver from WorldSnapshot using TileResolverFactory
  const createSnapshotTileResolver = useCallback((snapshot: WorldSnapshot): TileResolverFn => {
    const resolverId = ++resolverIdRef.current;
    console.log(`[RESOLVER] #${resolverId} anchor:${snapshot.anchorMapId} maps:${snapshot.maps.length} pairs:${snapshot.tilesetPairs.length}`,
      snapshot.maps.map(m => m.entry.id));
    return TileResolverFactory.fromSnapshot(snapshot, resolverId);
  }, []);

  // Create player tile resolver from WorldSnapshot using TileResolverFactory
  const createSnapshotPlayerTileResolver = useCallback((snapshot: WorldSnapshot): PlayerTileResolver => {
    return TileResolverFactory.createPlayerResolver(snapshot);
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
        warpEvents: m.warpEvents ?? [],
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

  // Execute a warp to destination map
  const performWarp = useCallback(async (
    trigger: WarpTrigger,
    options?: { force?: boolean; fromDoor?: boolean }
  ) => {
    const worldManager = worldManagerRef.current;
    const player = playerRef.current;
    const pipeline = pipelineRef.current;
    if (!worldManager || !player || !pipeline) return;

    const destMapId = trigger.warpEvent.destMap;
    // Capture prior facing for ladder/surf transitions (GBA preserves facing)
    const priorFacing = player.getFacingDirection();

    console.log('[WARP] ========== WARP START ==========');
    console.log('[WARP] Source map:', trigger.sourceMap.entry.id);
    console.log('[WARP] Destination map:', destMapId);
    console.log('[WARP] fromDoor:', options?.fromDoor);
    console.log('[WARP] priorFacing:', priorFacing);

    try {
      // ===== WebGL-SPECIFIC: Initialize world at destination =====
      const snapshot = await worldManager.initialize(destMapId);
      worldSnapshotRef.current = snapshot;

      // Build tileset runtimes for the new world
      buildTilesetRuntimesFromSnapshot(snapshot);

      // Update stitched world ref for backward compatibility
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

      // Set up new tile resolvers
      const resolver = createSnapshotTileResolver(snapshot);
      pipeline.setTileResolver(resolver);
      const playerResolver = createSnapshotPlayerTileResolver(snapshot);
      player.setTileResolver(playerResolver);

      // Upload tilesets to GPU
      uploadTilesetsFromSnapshot(pipeline, snapshot);

      // Update world bounds
      const { worldBounds } = snapshot;
      worldBoundsRef.current = {
        width: worldBounds.width * METATILE_SIZE,
        height: worldBounds.height * METATILE_SIZE,
        minX: worldBounds.minX,
        minY: worldBounds.minY,
      };
      setWorldSize({ width: worldBounds.width * METATILE_SIZE, height: worldBounds.height * METATILE_SIZE });
      setStitchedMapCount(snapshot.maps.length);

      // ===== SHARED: Execute warp using WarpExecutor =====
      const destMap = snapshot.maps.find(m => m.entry.id === destMapId);
      if (!destMap) {
        console.error('[WARP] Destination map not found in snapshot:', destMapId);
        return;
      }

      // Create render context for tile resolution
      const renderContext = createRenderContextFromSnapshot(snapshot);

      // Build WarpExecutor dependencies
      const warpDeps: WarpExecutorDeps = {
        player,
        doorSequencer,
        fadeController: fadeControllerRef.current,
        warpHandler: warpHandlerRef.current,
        playerHiddenRef,
        getCurrentTime: () => performance.now(),
        onClearDoorAnimations: () => doorAnimations.clearAll(),
      };

      // Build destination info
      const destination: WarpDestination = {
        map: destMap,
        resolveTileAt: (x, y) => {
          if (!renderContext) return null;
          const resolved = resolveTileAt(renderContext, x, y);
          return resolved ? {
            attributes: resolved.attributes,
            mapTile: resolved.mapTile,
          } : null;
        },
      };

      // Execute shared warp logic (spawn position, facing, door sequence)
      // priorFacing is used for ladders (preserve facing) per GBA behavior
      executeWarp(warpDeps, trigger, destination, {
        ...options,
        priorFacing,
      });

      // ===== WebGL-SPECIFIC: Post-warp updates =====
      pipeline.invalidate();

      console.log('[WARP] Warp complete');
      console.log('[WARP] World bounds:', snapshot.worldBounds);
      console.log('[WARP] Loaded maps:', snapshot.maps.map(m => m.entry.id));
      console.log('[WARP] Tileset pairs:', snapshot.tilesetPairs.map(p => p.id));
      console.log('[WARP] GPU slots:', Object.fromEntries(snapshot.pairIdToGpuSlot));

      // Update debug info for UI
      setWarpDebugInfo({
        lastWarpTo: destMapId,
        currentAnchor: snapshot.anchorMapId,
        snapshotMaps: snapshot.maps.map(m => m.entry.id),
        snapshotPairs: snapshot.tilesetPairs.map(p => p.id),
        gpuSlots: Object.fromEntries(snapshot.pairIdToGpuSlot),
        resolverVersion: resolverIdRef.current,
        worldBounds: snapshot.worldBounds,
      });

      // Reset warpingRef for door warps (non-door warps reset in .then() callback)
      if (options?.fromDoor) {
        warpingRef.current = false;
      }
    } catch (err) {
      console.error('[WARP] Failed to perform warp:', err);
      warpHandlerRef.current.setInProgress(false);
      warpingRef.current = false;
    }
  }, [createSnapshotTileResolver, createSnapshotPlayerTileResolver, uploadTilesetsFromSnapshot, buildTilesetRuntimesFromSnapshot, createRenderContextFromSnapshot, doorSequencer, doorAnimations]);

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
    const bridgeOffset = BRIDGE_OFFSETS[reflectionState.bridgeType];

    // For TILE LOOKUP: Use floored world positions to prevent flickering at tile boundaries
    const tileRefX = Math.floor(frame.renderX);
    const tileRefY = Math.floor(frame.renderY) + height - 2 + bridgeOffset;

    // For SCREEN RENDERING: Use Math.round() for consistent pixel alignment
    const reflectionWorldY = frame.renderY + height - 2 + bridgeOffset;
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

    // Apply tint based on reflection type and bridge type
    // GBA uses dark blue tint for pond bridges (low/med/high) to blend with dark water under bridge
    reflectionCtx.globalCompositeOperation = 'source-atop';
    reflectionCtx.fillStyle = getReflectionTint(reflectionState.reflectionType, reflectionState.bridgeType);
    reflectionCtx.fillRect(0, 0, frame.sw, frame.sh);

    // Apply mask
    reflectionCtx.globalCompositeOperation = 'destination-in';
    reflectionCtx.drawImage(maskCanvas, 0, 0);

    // Draw to main canvas with transparency and shimmer effect (water only - ice is still)
    // Pond bridges use slightly reduced alpha to better blend with dark tint
    ctx.save();
    ctx.globalAlpha = getReflectionAlpha(reflectionState.bridgeType);

    // Apply shimmer only for WATER reflections - GBA ice reflections use stillReflection=TRUE
    // which disables affine mode, so ice reflections don't wobble
    if (reflectionState.reflectionType === 'water') {
      const shimmer = getGlobalShimmer();
      const matrixNum = ReflectionShimmer.getMatrixForDirection(
        playerRef.current?.dir ?? 'down',
        frame.flip
      );
      const scaleX = shimmer.getScaleX(matrixNum);

      // Apply GBA-style affine transformation with nearest-neighbor sampling
      // This creates visible pixel-stepping artifacts like the real GBA
      // Canvas2D's ctx.scale() uses bilinear interpolation which smooths out the effect
      const shimmerCanvas = applyGbaAffineShimmer(reflectionCanvas, scaleX);
      ctx.drawImage(shimmerCanvas, screenX, screenY);
    } else {
      // Ice reflections don't shimmer (GBA uses stillReflection=TRUE)
      ctx.drawImage(reflectionCanvas, screenX, screenY);
    }
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

        // Set up door warp handler for animated door and arrow warp entry
        player.setDoorWarpHandler(async (request) => {
          console.log('[DOOR_HANDLER] Called with request:', request);

          if (doorSequencer.isEntryActive()) {
            console.log('[DOOR_HANDLER] Rejected: doorSequencer.isEntryActive()');
            return;
          }
          if (warpHandlerRef.current.isInProgress()) {
            console.log('[DOOR_HANDLER] Rejected: warpHandler.isInProgress()');
            return;
          }

          const snapshot = worldSnapshotRef.current;
          if (!snapshot) {
            console.log('[DOOR_HANDLER] Rejected: no snapshot');
            return;
          }

          const renderContext = createRenderContextFromSnapshot(snapshot);
          if (!renderContext) {
            console.log('[DOOR_HANDLER] Rejected: no renderContext');
            return;
          }

          const resolved = resolveTileAt(renderContext, request.targetX, request.targetY);
          if (!resolved) {
            console.log('[DOOR_HANDLER] Rejected: no resolved tile at', request.targetX, request.targetY);
            return;
          }

          const warpEvent = findWarpEventAt(resolved.map, request.targetX, request.targetY);
          if (!warpEvent) {
            console.log('[DOOR_HANDLER] Rejected: no warpEvent at', request.targetX, request.targetY, 'in map', resolved.map.entry.id);
            console.log('[DOOR_HANDLER] Available warps:', resolved.map.warpEvents);
            return;
          }

          console.log('[DOOR_HANDLER] Found warp:', warpEvent);

          const behavior = resolved.attributes?.behavior ?? -1;
          const isArrow = isArrowWarpBehavior(behavior);
          const isAnimated = isDoorBehavior(behavior);
          const isNonAnimated = isNonAnimatedDoorBehavior(behavior);
          const metatileId = getMetatileIdFromMapTile(resolved.mapTile);

          const trigger: WarpTrigger = {
            kind: isArrow ? 'arrow' : 'door',
            sourceMap: resolved.map,
            warpEvent,
            behavior,
            facing: player.dir,
          };

          // For arrow warps, check player is facing arrow direction
          if (isArrow) {
            const arrowDir = getArrowDirectionFromBehavior(behavior);
            if (!arrowDir || player.dir !== arrowDir) return;

            // Start auto-warp (skip animation, go straight to fade)
            arrowOverlay.hide();
            doorSequencer.startAutoWarp({
              targetX: player.tileX,
              targetY: player.tileY,
              metatileId,
              isAnimatedDoor: false,
              entryDirection: arrowDir as CardinalDirection,
              warpTrigger: trigger,
            }, performance.now(), true);
            player.lockInput();
            return;
          }

          // For animated doors, spawn open animation and start entry sequence
          if (isAnimated) {
            const startedAt = performance.now();
            const openAnimId = await doorAnimations.spawn('open', request.targetX, request.targetY, metatileId, startedAt, true);
            doorSequencer.startEntry({
              targetX: request.targetX,
              targetY: request.targetY,
              metatileId,
              isAnimatedDoor: true,
              entryDirection: player.dir as CardinalDirection,
              warpTrigger: trigger,
              openAnimId: openAnimId ?? undefined,
            }, startedAt);
            if (openAnimId) doorSequencer.setEntryOpenAnimId(openAnimId);
            player.lockInput();
          } else if (isNonAnimated) {
            // Non-animated door (stairs, etc.) - just fade
            doorSequencer.startAutoWarp({
              targetX: request.targetX,
              targetY: request.targetY,
              metatileId,
              isAnimatedDoor: false,
              entryDirection: player.dir as CardinalDirection,
              warpTrigger: trigger,
            }, performance.now(), true);
            player.lockInput();
          }
        });

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

      // Update shimmer animation (GBA-accurate reflection distortion)
      getGlobalShimmer().update(nowTime);

      const { width, height, minX, minY } = worldBoundsRef.current;

      // Convert tile offsets to pixel offsets for camera
      const worldMinX = minX * METATILE_SIZE;
      const worldMinY = minY * METATILE_SIZE;
      const player = playerRef.current;

      // Update warp handler cooldown
      warpHandlerRef.current.update(dt);

      // Update player if loaded (handles its own input via keyboard events)
      if (player && playerLoadedRef.current && !warpingRef.current) {
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

            // Update player debug info for the debug panel
            setPlayerDebugInfo({
              tileX: player.tileX,
              tileY: player.tileY,
              pixelX: player.x,
              pixelY: player.y,
              direction: player.getFacingDirection(),
              elevation: player.getElevation(),
              isMoving: player.isMoving,
              isSurfing: player.isSurfing(),
              mapId: debugInfo?.currentMap ?? selectedMap.id,
            });
          }

          // Update arrow overlay based on current tile behavior
          const snapshot = worldSnapshotRef.current;
          if (snapshot && !warpHandlerRef.current.isInProgress()) {
            const renderContext = createRenderContextFromSnapshot(snapshot);
            if (renderContext) {
              const resolved = resolveTileAt(renderContext, player.tileX, player.tileY);
              const behavior = resolved?.attributes?.behavior ?? 0;
              arrowOverlay.update(
                player.dir as CardinalDirection,
                player.tileX,
                player.tileY,
                behavior,
                nowTime,
                doorSequencer.isActive()
              );
            }
          }

          // Check for warps when player tile changes (matches Canvas2D useRunUpdate logic)
          if (snapshot && !warpHandlerRef.current.isInProgress() && !doorSequencer.isActive()) {
            const renderContext = createRenderContextFromSnapshot(snapshot);
            if (renderContext) {
              const resolvedForWarp = resolveTileAt(renderContext, player.tileX, player.tileY);

              if (resolvedForWarp) {
                const currentMapId = resolvedForWarp.map.entry.id;

                // Check if tile changed
                const lastChecked = warpHandlerRef.current.getState().lastCheckedTile;
                const tileChanged = !lastChecked ||
                  lastChecked.mapId !== currentMapId ||
                  lastChecked.x !== player.tileX ||
                  lastChecked.y !== player.tileY;

                if (tileChanged) {
                  warpHandlerRef.current.updateLastCheckedTile(player.tileX, player.tileY, currentMapId);

                  if (!warpHandlerRef.current.isOnCooldown()) {
                    const trigger = detectWarpTrigger(renderContext, player);
                    if (trigger) {
                      // Arrow warps are handled through PlayerController's doorWarpHandler
                      if (trigger.kind === 'arrow') {
                        // Just update arrow overlay, don't auto-warp
                      } else if (isNonAnimatedDoorBehavior(trigger.behavior)) {
                        // Non-animated doors (stairs, ladders): auto-warp with fade
                        console.log('[WARP] Non-animated door warp:', trigger.kind, 'to', trigger.warpEvent.destMap);
                        arrowOverlay.hide();
                        doorSequencer.startAutoWarp({
                          targetX: player.tileX,
                          targetY: player.tileY,
                          metatileId: getMetatileIdFromMapTile(resolvedForWarp.mapTile),
                          isAnimatedDoor: false,
                          entryDirection: player.dir as CardinalDirection,
                          warpTrigger: trigger,
                        }, nowTime, true);
                        player.lockInput();
                      } else {
                        // Other walk-over warps: simple warp
                        console.log('[WARP] Walk-over warp:', trigger.kind, 'to', trigger.warpEvent.destMap);
                        warpHandlerRef.current.startWarp(player.tileX, player.tileY, currentMapId);
                        pendingWarpRef.current = trigger;
                        warpingRef.current = true;
                        player.lockInput();
                        fadeControllerRef.current.startFadeOut(FADE_TIMING.DEFAULT_DURATION_MS, nowTime);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Advance door entry sequence
      if (doorSequencer.isEntryActive()) {
        const player = playerRef.current;
        if (player) {
          const entryState = doorSequencer.sequencer.getEntryState();
          const isAnimationDone = (animId: number | undefined) => {
            if (animId === undefined) return true;
            if (animId === -1) return false; // Loading in progress
            const anim = doorAnimations.findById(animId);
            return !anim || doorAnimations.isAnimDone(anim, nowTime);
          };
          const isFadeDone = !fadeControllerRef.current.isActive() || fadeControllerRef.current.isComplete(nowTime);

          const result = doorSequencer.updateEntry(nowTime, player.isMoving, isAnimationDone, isFadeDone);

          if (result.action === 'startPlayerStep' && result.direction) {
            player.forceMove(result.direction, true);
          } else if (result.action === 'hidePlayer') {
            playerHiddenRef.current = true;
            // Spawn close animation if animated door
            if (entryState.isAnimatedDoor) {
              const pos = doorSequencer.getEntryDoorPosition();
              doorSequencer.setEntryCloseAnimId(-1);
              doorAnimations.spawn('close', pos?.x ?? 0, pos?.y ?? 0, entryState.metatileId, nowTime)
                .then((closeAnimId) => {
                  if (closeAnimId !== null) doorSequencer.setEntryCloseAnimId(closeAnimId);
                });
              if (entryState.openAnimId !== undefined) doorAnimations.clearById(entryState.openAnimId);
            }
          } else if (result.action === 'removeCloseAnimation' && result.animId !== undefined) {
            doorAnimations.clearById(result.animId);
          } else if (result.action === 'startFadeOut' && result.duration) {
            fadeControllerRef.current.startFadeOut(result.duration, nowTime);
          } else if (result.action === 'executeWarp' && result.trigger) {
            // CRITICAL: Set warpingRef to prevent worldManager.update() during warp
            warpingRef.current = true;
            void performWarp(result.trigger as WarpTrigger, { force: true, fromDoor: true });
          }
        }
      }

      // Advance door exit sequence
      if (doorSequencer.isExitActive()) {
        const player = playerRef.current;
        if (player) {
          const exitState = doorSequencer.sequencer.getExitState();
          const isAnimationDone = (animId: number | undefined) => {
            if (animId === undefined) return true;
            if (animId === -1) return false;
            const anim = doorAnimations.findById(animId);
            return !anim || doorAnimations.isAnimDone(anim, nowTime);
          };
          const isFadeInDone = !fadeControllerRef.current.isActive() || fadeControllerRef.current.isComplete(nowTime);

          const result = doorSequencer.updateExit(nowTime, player.isMoving, isAnimationDone, isFadeInDone);

          if (result.action === 'spawnOpenAnimation') {
            const pos = doorSequencer.getExitDoorPosition();
            doorSequencer.setExitOpenAnimId(-1);
            // Set door to fully-open state before fade completes
            const alreadyOpenStartedAt = nowTime - 500;
            doorAnimations.spawn('open', pos?.x ?? 0, pos?.y ?? 0, exitState.metatileId, alreadyOpenStartedAt, true)
              .then((openAnimId) => {
                if (openAnimId !== null) doorSequencer.setExitOpenAnimId(openAnimId);
              });
          } else if (result.action === 'startPlayerStep' && result.direction) {
            player.forceMove(result.direction, true);
            playerHiddenRef.current = false;
          } else if (result.action === 'spawnCloseAnimation') {
            const pos = doorSequencer.getExitDoorPosition();
            if (exitState.openAnimId !== undefined && exitState.openAnimId !== -1) {
              doorAnimations.clearById(exitState.openAnimId);
            }
            doorSequencer.setExitCloseAnimId(-1);
            doorAnimations.spawn('close', pos?.x ?? 0, pos?.y ?? 0, exitState.metatileId, nowTime)
              .then((closeAnimId) => {
                if (closeAnimId !== null) doorSequencer.setExitCloseAnimId(closeAnimId);
              });
          } else if (result.action === 'removeCloseAnimation' && result.animId !== undefined) {
            doorAnimations.clearById(result.animId);
          }

          if (result.done) {
            player.unlockInput();
            playerHiddenRef.current = false;
          }
        }
      }

      // Handle pending warp when fade out completes
      if (warpingRef.current && pendingWarpRef.current) {
        const fade = fadeControllerRef.current;
        if (fade.getDirection() === 'out' && fade.isComplete(nowTime)) {
          // Fade out complete, execute warp
          const trigger = pendingWarpRef.current;
          pendingWarpRef.current = null;
          void performWarp(trigger).then(() => {
            warpingRef.current = false;
            // Unlock player input after fade in starts
            const player = playerRef.current;
            if (player) {
              // Delay unlock until fade in completes
              setTimeout(() => {
                player.unlockInput();
              }, FADE_TIMING.DEFAULT_DURATION_MS);
            }
          });
        }
      }

      // Camera follows player (using CameraController)
      const camera = cameraRef.current;
      if (camera && player && playerLoadedRef.current) {
        // Update camera bounds (may have changed due to world updates)
        camera.setBounds({ minX: worldMinX, minY: worldMinY, width, height });
        camera.followTarget(player);
      }

      const viewportWidth = VIEWPORT_TILES_WIDE * METATILE_SIZE;
      const viewportHeight = VIEWPORT_TILES_HIGH * METATILE_SIZE;

      if (width > 0 && height > 0 && camera) {
        // Ensure display canvas is sized to viewport
        if (displayCanvas.width !== viewportWidth || displayCanvas.height !== viewportHeight) {
          displayCanvas.width = viewportWidth;
          displayCanvas.height = viewportHeight;
        }

        const start = performance.now();

        // Get camera view for rendering
        const camView = camera.getView(1);  // +1 tile for sub-tile scrolling
        const cameraX = camView.x;
        const cameraY = camView.y;

        const view: WorldCameraView = {
          // CameraView base fields
          cameraX,
          cameraY,
          startTileX: camView.startTileX,
          startTileY: camView.startTileY,
          subTileOffsetX: camView.subTileOffsetX,
          subTileOffsetY: camView.subTileOffsetY,
          tilesWide: camView.tilesWide,
          tilesHigh: camView.tilesHigh,
          pixelWidth: camView.tilesWide * METATILE_SIZE,
          pixelHeight: camView.tilesHigh * METATILE_SIZE,
          // WorldCameraView specific fields
          worldStartTileX: camView.startTileX,
          worldStartTileY: camView.startTileY,
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

        // Render door animations (between topBelow and sprites)
        doorAnimations.prune(nowTime);
        doorAnimations.render(ctx2d, view, nowTime);

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

          // Render player (unless hidden during door sequence)
          if (!playerHiddenRef.current) {
            player.render(ctx2d, cameraX, cameraY);
          }

          // Render arrow overlay (reuse ObjectRenderer.renderArrow from Canvas2D)
          if (arrowOverlay.isVisible() && !doorSequencer.isActive()) {
            const arrowState = arrowOverlay.getState();
            const arrowSprite = arrowOverlay.getSprite();
            if (arrowState && arrowSprite) {
              ObjectRenderer.renderArrow(ctx2d, arrowState, arrowSprite, view, nowTime);
            }
          }

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

        // Render fade overlay (for warp transitions)
        const fade = fadeControllerRef.current;
        if (fade.isActive()) {
          fade.render(ctx2d, viewportWidth, viewportHeight, nowTime);
        }

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
          if (cameraRef.current) {
            const pos = cameraRef.current.getPosition();
            setCameraDisplay({ x: pos.x, y: pos.y });
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
    // Reset/create camera when map changes
    if (cameraRef.current) {
      cameraRef.current.reset();
    } else {
      cameraRef.current = createWebGLCameraController(VIEWPORT_TILES_WIDE, VIEWPORT_TILES_HIGH);
    }
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
            // Adjust player and camera positions by the offset shift
            const player = playerRef.current;
            if (player) {
              player.setPosition(
                player.tileX - event.offsetShift.x,
                player.tileY - event.offsetShift.y
              );
            }
            // Also adjust camera to prevent jitter on reanchor
            if (cameraRef.current) {
              cameraRef.current.adjustOffset(event.offsetShift.x, event.offsetShift.y);
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
          <div style={{ fontSize: 11, color: '#9fb0cc' }}>
            Arrow Keys to move. Z to run. ` for debug panel.
          </div>
        </div>
      </div>

      {/* Debug Panel - slide-out sidebar with WebGL tab */}
      <DebugPanel
        options={debugOptions}
        onChange={setDebugOptions}
        state={debugState}
        webglState={webglDebugState}
      />
    </div>
  );
}

export default WebGLMapPage;
