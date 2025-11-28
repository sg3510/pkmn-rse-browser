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
import type { TileResolverFn, ResolvedTile, WorldCameraView, LoadedAnimation } from '../rendering/types';
import { PlayerController, type TileResolver as PlayerTileResolver } from '../game/PlayerController';
import { ObjectRenderer, type WorldCameraView as ObjectRendererView } from '../components/map/renderers/ObjectRenderer';
import { useFieldSprites } from '../hooks/useFieldSprites';
import UPNG from 'upng-js';
import mapIndexJson from '../data/mapIndex.json';
import type { MapIndexEntry } from '../types/maps';
import {
  loadTilesetImage,
  loadText,
  parsePalette,
  loadMapLayout,
  loadMetatileDefinitions,
  loadMetatileAttributes,
  loadBorderMetatiles,
  METATILE_SIZE,
  TILE_SIZE,
  loadBinary,
  type Palette,
  type TilesetImageData,
  type Metatile,
  type MapData,
  type MetatileAttributes,
} from '../utils/mapLoader';
import { TILESET_ANIMATION_CONFIGS } from '../data/tilesetAnimations';
import './WebGLMapPage.css';

const PROJECT_ROOT = '/pokeemerald';
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

/** World data with multiple stitched maps sharing the same tileset */
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
  // Shared tileset assets (all maps use the same tilesets)
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

/** Load palettes from a tileset path, filling missing entries with black */
async function loadPalettes(tilesetPath: string, startIndex: number, count: number): Promise<Palette[]> {
  const palettes: Palette[] = [];
  for (let i = startIndex; i < startIndex + count; i++) {
    try {
      const text = await loadText(`${tilesetPath}/palettes/${i.toString().padStart(2, '0')}.pal`);
      palettes.push(parsePalette(text));
    } catch {
      palettes.push({ colors: Array(16).fill('#000000') });
    }
  }
  return palettes;
}

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

/** Decode an indexed PNG frame (handles 4bpp packed data) */
async function loadIndexedFrame(url: string): Promise<{ data: Uint8Array; width: number; height: number }> {
  const buffer = await loadBinary(url);
  const img = UPNG.decode(buffer);

  let data: Uint8Array;
  if (img.ctype === 3 && img.depth === 4) {
    const packed = new Uint8Array(img.data);
    const unpacked = new Uint8Array(packed.length * 2);
    for (let i = 0; i < packed.length; i++) {
      const byte = packed[i];
      unpacked[i * 2] = (byte >> 4) & 0xf;
      unpacked[i * 2 + 1] = byte & 0xf;
    }
    data = unpacked;
  } else {
    data = new Uint8Array(img.data);
  }

  return { data, width: img.width, height: img.height };
}

/** Safely load metatile attributes, returning empty array on error */
async function safeLoadMetatileAttributes(url: string): Promise<MetatileAttributes[]> {
  try {
    return await loadMetatileAttributes(url);
  } catch (e) {
    console.warn(`Failed to load metatile attributes from ${url}:`, e);
    return [];
  }
}

/** Load tile animations for the given tileset IDs */
async function loadAnimationsForTilesets(primaryId: string, secondaryId: string): Promise<LoadedAnimation[]> {
  const loaded: LoadedAnimation[] = [];
  const requested = [
    ...(TILESET_ANIMATION_CONFIGS[primaryId] ?? []),
    ...(TILESET_ANIMATION_CONFIGS[secondaryId] ?? []),
  ];

  for (const def of requested) {
    try {
      const frames: Uint8Array[] = [];
      let width = 0;
      let height = 0;

      for (const framePath of def.frames) {
        const frame = await loadIndexedFrame(`${PROJECT_ROOT}/${framePath}`);
        frames.push(frame.data);
        width = frame.width;
        height = frame.height;
      }

      const tilesWide = Math.max(1, Math.floor(width / TILE_SIZE));
      const tilesHigh = Math.max(1, Math.floor(height / TILE_SIZE));
      const sequence = def.sequence ?? frames.map((_, i) => i);

      loaded.push({
        id: def.id,
        tileset: def.tileset,
        frames,
        width,
        height,
        tilesWide,
        tilesHigh,
        sequence,
        interval: def.interval,
        destinations: def.destinations,
        altSequence: def.altSequence,
        altSequenceThreshold: def.altSequenceThreshold,
      });
    } catch (err) {
      // Non-critical: skip missing animation assets
      console.warn(`Animation ${def.id} not loaded:`, err);
    }
  }

  return loaded;
}

/** Compute neighbor map offset based on connection direction (matches MapManager.computeOffset) */
function computeConnectionOffset(
  baseEntry: MapIndexEntry,
  neighborEntry: MapIndexEntry,
  connection: { direction: string; offset: number },
  baseOffsetX: number,
  baseOffsetY: number
): { offsetX: number; offsetY: number } {
  const dir = connection.direction.toLowerCase();
  if (dir === 'up' || dir === 'north') {
    return { offsetX: baseOffsetX + connection.offset, offsetY: baseOffsetY - neighborEntry.height };
  }
  if (dir === 'down' || dir === 'south') {
    return { offsetX: baseOffsetX + connection.offset, offsetY: baseOffsetY + baseEntry.height };
  }
  if (dir === 'left' || dir === 'west') {
    return { offsetX: baseOffsetX - neighborEntry.width, offsetY: baseOffsetY + connection.offset };
  }
  if (dir === 'right' || dir === 'east') {
    return { offsetX: baseOffsetX + baseEntry.width, offsetY: baseOffsetY + connection.offset };
  }
  return { offsetX: baseOffsetX, offsetY: baseOffsetY };
}

/**
 * Load a world of connected maps that share the same tileset.
 * Only loads maps with matching primary+secondary tilesets (same GPU textures).
 * Maps with different tilesets are skipped - player must warp to change tileset areas.
 *
 * @param anchorEntry - The starting map to build the world from
 * @param maxDepth - Max connection depth to traverse (default 3 to limit memory usage)
 */
async function loadStitchedWorld(
  anchorEntry: MapIndexEntry,
  maxDepth: number = 3
): Promise<StitchedWorldData> {
  const maps: StitchedMapInstance[] = [];
  const visited = new Set<string>();
  const queue: Array<{ entry: MapIndexEntry; offsetX: number; offsetY: number; depth: number }> = [
    { entry: anchorEntry, offsetX: 0, offsetY: 0, depth: 0 },
  ];

  // Only stitch maps with matching tilesets
  const anchorPrimaryTileset = anchorEntry.primaryTilesetId;
  const anchorSecondaryTileset = anchorEntry.secondaryTilesetId;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.entry.id)) continue;

    // Skip if tilesets don't match (can't render with same GPU textures)
    if (current.entry.primaryTilesetId !== anchorPrimaryTileset ||
        current.entry.secondaryTilesetId !== anchorSecondaryTileset) {
      continue;
    }

    visited.add(current.entry.id);

    // Load map layout data
    const layoutPath = `${PROJECT_ROOT}/${current.entry.layoutPath}`;
    const mapData = await loadMapLayout(`${layoutPath}/map.bin`, current.entry.width, current.entry.height);

    maps.push({
      entry: current.entry,
      mapData,
      offsetX: current.offsetX,
      offsetY: current.offsetY,
    });

    // Queue connected maps if we haven't reached max depth
    if (current.depth < maxDepth) {
      for (const connection of current.entry.connections || []) {
        const neighborEntry = mapIndexData.find(m => m.id === connection.map);
        if (!neighborEntry) continue;

        const { offsetX, offsetY } = computeConnectionOffset(
          current.entry,
          neighborEntry,
          connection,
          current.offsetX,
          current.offsetY
        );
        queue.push({ entry: neighborEntry, offsetX, offsetY, depth: current.depth + 1 });
      }
    }
  }

  // Compute world bounds
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const map of maps) {
    minX = Math.min(minX, map.offsetX);
    minY = Math.min(minY, map.offsetY);
    maxX = Math.max(maxX, map.offsetX + map.entry.width);
    maxY = Math.max(maxY, map.offsetY + map.entry.height);
  }

  // Load shared tileset assets (only once since all maps use same tilesets)
  const primaryPath = `${PROJECT_ROOT}/${anchorEntry.primaryTilesetPath}`;
  const secondaryPath = `${PROJECT_ROOT}/${anchorEntry.secondaryTilesetPath}`;
  const anchorLayoutPath = `${PROJECT_ROOT}/${anchorEntry.layoutPath}`;

  const [
    primaryMetatiles,
    secondaryMetatiles,
    primaryAttributes,
    secondaryAttributes,
    primaryImage,
    secondaryImage,
    primaryPalettes,
    secondaryPalettes,
    borderMetatiles,
  ] = await Promise.all([
    loadMetatileDefinitions(`${primaryPath}/metatiles.bin`),
    loadMetatileDefinitions(`${secondaryPath}/metatiles.bin`),
    safeLoadMetatileAttributes(`${primaryPath}/metatile_attributes.bin`),
    safeLoadMetatileAttributes(`${secondaryPath}/metatile_attributes.bin`),
    loadTilesetImage(`${primaryPath}/tiles.png`, true) as Promise<TilesetImageData>,
    loadTilesetImage(`${secondaryPath}/tiles.png`, true) as Promise<TilesetImageData>,
    loadPalettes(primaryPath, 0, NUM_PALS_IN_PRIMARY),
    loadPalettes(secondaryPath, NUM_PALS_IN_PRIMARY, NUM_PALS_TOTAL - NUM_PALS_IN_PRIMARY),
    loadBorderMetatiles(`${anchorLayoutPath}/border.bin`).catch(() => [] as number[]),
  ]);

  const animations = await loadAnimationsForTilesets(anchorEntry.primaryTilesetId, anchorEntry.secondaryTilesetId);

  return {
    maps,
    anchorId: anchorEntry.id,
    worldBounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
    primaryMetatiles,
    secondaryMetatiles,
    primaryAttributes,
    secondaryAttributes,
    primaryImage,
    secondaryImage,
    primaryPalettes,
    secondaryPalettes,
    animations,
    borderMetatiles,
  };
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

  // Create tile resolver for stitched world (handles multiple maps)
  const createStitchedTileResolver = useCallback((world: StitchedWorldData): TileResolverFn => {
    const { maps, primaryMetatiles, secondaryMetatiles, primaryAttributes, secondaryAttributes, borderMetatiles } = world;

    return (worldX: number, worldY: number): ResolvedTile | null => {
      // Find which map contains this world tile
      for (const map of maps) {
        const localX = worldX - map.offsetX;
        const localY = worldY - map.offsetY;

        if (localX >= 0 && localX < map.entry.width &&
            localY >= 0 && localY < map.entry.height) {
          // Found the map containing this tile
          const idx = localY * map.entry.width + localX;
          const mapTile = map.mapData.layout[idx];
          const metatileId = mapTile.metatileId;

          const isSecondary = metatileId >= SECONDARY_TILE_OFFSET;
          const metatile = isSecondary
            ? secondaryMetatiles[metatileId - SECONDARY_TILE_OFFSET]
            : primaryMetatiles[metatileId];

          if (!metatile) return null;

          const attrIndex = isSecondary ? metatileId - SECONDARY_TILE_OFFSET : metatileId;
          const attrArray = isSecondary ? secondaryAttributes : primaryAttributes;
          const attributes: MetatileAttributes = attrArray[attrIndex] ?? { behavior: 0, layerType: 0 };

          return {
            metatile,
            attributes,
            mapTile,
            map: null as any,
            tileset: null as any,
            isSecondary,
            isBorder: false,
          };
        }
      }

      // Out of world bounds - use border tiles
      if (!borderMetatiles || borderMetatiles.length === 0) {
        return null;
      }

      // Calculate border pattern index (2x2 repeating)
      const borderIndex = ((worldX & 1) + ((worldY & 1) * 2)) % borderMetatiles.length;
      const borderMetatileId = borderMetatiles[borderIndex];

      const isSecondary = borderMetatileId >= SECONDARY_TILE_OFFSET;
      const metatile = isSecondary
        ? secondaryMetatiles[borderMetatileId - SECONDARY_TILE_OFFSET]
        : primaryMetatiles[borderMetatileId];

      if (!metatile) return null;

      const attrIndex = isSecondary ? borderMetatileId - SECONDARY_TILE_OFFSET : borderMetatileId;
      const attrArray = isSecondary ? secondaryAttributes : primaryAttributes;
      const attributes: MetatileAttributes = attrArray[attrIndex] ?? { behavior: 0, layerType: 0 };

      return {
        metatile,
        attributes,
        mapTile: { metatileId: borderMetatileId, collision: 1, elevation: 0 },
        map: null as any,
        tileset: null as any,
        isSecondary,
        isBorder: true,
      };
    };
  }, []);

  // Create player tile resolver for stitched world
  const createStitchedPlayerTileResolver = useCallback((world: StitchedWorldData): PlayerTileResolver => {
    const { maps, primaryAttributes, secondaryAttributes } = world;

    return (worldX: number, worldY: number) => {
      // Find which map contains this world tile
      for (const map of maps) {
        const localX = worldX - map.offsetX;
        const localY = worldY - map.offsetY;

        if (localX >= 0 && localX < map.entry.width &&
            localY >= 0 && localY < map.entry.height) {
          const idx = localY * map.entry.width + localX;
          const mapTile = map.mapData.layout[idx];
          const metatileId = mapTile.metatileId;
          const isSecondary = metatileId >= SECONDARY_TILE_OFFSET;
          const attrIndex = isSecondary ? metatileId - SECONDARY_TILE_OFFSET : metatileId;
          const attrArray = isSecondary ? secondaryAttributes : primaryAttributes;
          const attributes: MetatileAttributes = attrArray[attrIndex] ?? { behavior: 0, layerType: 0 };

          return { mapTile, attributes };
        }
      }

      return null;
    };
  }, []);

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
              'bottom'
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
              'top'
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
    };
  }, []);

  // Load selected map assets and configure pipeline
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

    const load = async () => {
      try {
        // Always use stitched world loading - it handles single maps too
        // and automatically expands to include all connected maps with matching tilesets
        const world = await loadStitchedWorld(entry); // Unlimited depth for same-tileset chains
        if (cancelled) return;

        // Store stitched world
        stitchedWorldRef.current = world;

        // Set up tile resolver for stitched world
        const resolver = createStitchedTileResolver(world);
        pipeline.setTileResolver(resolver);

        // Upload tilesets (shared across all stitched maps)
        pipeline.uploadTilesets(
          world.primaryImage.data,
          world.primaryImage.width,
          world.primaryImage.height,
          world.secondaryImage.data,
          world.secondaryImage.width,
          world.secondaryImage.height,
          world.animations
        );
        pipeline.uploadPalettes(combineTilesetPalettes(world.primaryPalettes, world.secondaryPalettes));

        // Invalidate pipeline cache
        pipeline.invalidate();

        // Set world bounds from stitched world
        const { worldBounds } = world;
        const worldWidth = worldBounds.width * METATILE_SIZE;
        const worldHeight = worldBounds.height * METATILE_SIZE;
        worldBoundsRef.current = {
          width: worldWidth,
          height: worldHeight,
          minX: worldBounds.minX,
          minY: worldBounds.minY,
        };
        setWorldSize({ width: worldWidth, height: worldHeight });
        setStitchedMapCount(world.maps.length);

        // Set up player with stitched tile resolver
        const player = playerRef.current;
        if (player) {
          const playerResolver = createStitchedPlayerTileResolver(world);
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
    };
  }, [selectedMap, createStitchedTileResolver, createStitchedPlayerTileResolver]);

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
        </div>
      </div>
    </div>
  );
}

export default WebGLMapPage;
