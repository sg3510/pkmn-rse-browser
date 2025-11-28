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

import { useEffect, useMemo, useRef, useState } from 'react';
import { WebGLContext, isWebGL2Supported } from '../rendering/webgl/WebGLContext';
import { WebGLTileRenderer } from '../rendering/webgl/WebGLTileRenderer';
import { WebGLAnimationManager } from '../rendering/webgl/WebGLAnimationManager';
import type { TileInstance } from '../rendering/webgl/types';
import type { LoadedAnimation } from '../rendering/types';
import UPNG from 'upng-js';
import mapIndexJson from '../data/mapIndex.json';
import type { MapIndexEntry } from '../types/maps';
import {
  loadTilesetImage,
  loadText,
  parsePalette,
  loadMapLayout,
  loadMetatileDefinitions,
  METATILE_SIZE,
  TILE_SIZE,
  loadBinary,
  type Palette,
  type TilesetImageData,
  type Metatile,
  type MapData,
} from '../utils/mapLoader';
import { TILESET_ANIMATION_CONFIGS } from '../data/tilesetAnimations';
import './WebGLMapPage.css';

const PROJECT_ROOT = '/pokeemerald';
const NUM_PALS_IN_PRIMARY = 6;
const NUM_PALS_TOTAL = 13;
const SECONDARY_TILE_OFFSET = 512;
const GBA_FRAME_MS = 1000 / 59.7275; // Match real GBA vblank timing (~59.73 Hz)

type LoadedMapAssets = {
  mapData: MapData;
  primaryMetatiles: Metatile[];
  secondaryMetatiles: Metatile[];
  primaryImage: TilesetImageData;
  secondaryImage: TilesetImageData;
  primaryPalettes: Palette[];
  secondaryPalettes: Palette[];
  animations: LoadedAnimation[];
};

type WorldChunk = {
  entry: MapIndexEntry;
  mapData: MapData;
  offsetX: number; // in tiles
  offsetY: number; // in tiles
};

type RenderStats = {
  webgl2Supported: boolean;
  tileCount: number;
  renderTimeMs: number;
  fps: number;
  error: string | null;
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

/** Build tile instances from map data and metatiles */
function buildMapTiles(
  mapData: MapData,
  primaryMetatiles: Metatile[],
  secondaryMetatiles: Metatile[]
): TileInstance[] {
  const tiles: TileInstance[] = [];

  for (let my = 0; my < mapData.height; my++) {
    for (let mx = 0; mx < mapData.width; mx++) {
      const mapTile = mapData.layout[my * mapData.width + mx];
      const metatileId = mapTile.metatileId;

      const metatile = metatileId < primaryMetatiles.length
        ? primaryMetatiles[metatileId]
        : secondaryMetatiles[metatileId - SECONDARY_TILE_OFFSET];

      if (!metatile) continue;

      for (let layer = 0; layer < 2; layer++) {
        for (let i = 0; i < 4; i++) {
          const tileIndex = layer * 4 + i;
          const tile = metatile.tiles[tileIndex];
          if (!tile) continue;

          const subX = (i % 2) * TILE_SIZE;
          const subY = Math.floor(i / 2) * TILE_SIZE;

          const isSecondary = tile.tileId >= SECONDARY_TILE_OFFSET;
          const tilesetIndex = isSecondary ? 1 : 0;
          const effectiveTileId = isSecondary ? tile.tileId - SECONDARY_TILE_OFFSET : tile.tileId;

          tiles.push({
            x: mx * METATILE_SIZE + subX,
            y: my * METATILE_SIZE + subY,
            tileId: effectiveTileId,
            paletteId: tile.palette,
            xflip: tile.xflip,
            yflip: tile.yflip,
            tilesetIndex,
          });
        }
      }
    }
  }

  return tiles;
}

/** Fetch all assets needed for a single map */
async function loadMapAssets(
  entry: MapIndexEntry,
  cache?: Map<string, LoadedMapAssets>
): Promise<LoadedMapAssets> {
  if (cache?.has(entry.id)) {
    return cache.get(entry.id)!;
  }
  const primaryPath = `${PROJECT_ROOT}/${entry.primaryTilesetPath}`;
  const secondaryPath = `${PROJECT_ROOT}/${entry.secondaryTilesetPath}`;
  const layoutPath = `${PROJECT_ROOT}/${entry.layoutPath}`;

  const [
    mapData,
    primaryMetatiles,
    secondaryMetatiles,
    primaryImage,
    secondaryImage,
    primaryPalettes,
    secondaryPalettes,
  ] = await Promise.all([
    loadMapLayout(`${layoutPath}/map.bin`, entry.width, entry.height),
    loadMetatileDefinitions(`${primaryPath}/metatiles.bin`),
    loadMetatileDefinitions(`${secondaryPath}/metatiles.bin`),
    loadTilesetImage(`${primaryPath}/tiles.png`, true) as Promise<TilesetImageData>,
    loadTilesetImage(`${secondaryPath}/tiles.png`, true) as Promise<TilesetImageData>,
    loadPalettes(primaryPath, 0, NUM_PALS_IN_PRIMARY),
    loadPalettes(secondaryPath, NUM_PALS_IN_PRIMARY, NUM_PALS_TOTAL - NUM_PALS_IN_PRIMARY),
  ]);

  const animations = await loadAnimationsForTilesets(entry.primaryTilesetId, entry.secondaryTilesetId);

  const assets: LoadedMapAssets = {
    mapData,
    primaryMetatiles,
    secondaryMetatiles,
    primaryImage,
    secondaryImage,
    primaryPalettes,
    secondaryPalettes,
    animations,
  };

  cache?.set(entry.id, assets);
  return assets;
}

/** Compute neighbor offset mirroring the game logic (tiles, not pixels) */
function computeOffset(
  base: WorldChunk,
  neighborEntry: MapIndexEntry,
  connection: MapIndexEntry['connections'][number]
): { offsetX: number; offsetY: number } {
  const dir = connection.direction.toLowerCase();
  if (dir === 'up' || dir === 'north') {
    return { offsetX: base.offsetX + connection.offset, offsetY: base.offsetY - neighborEntry.height };
  }
  if (dir === 'down' || dir === 'south') {
    return { offsetX: base.offsetX + connection.offset, offsetY: base.offsetY + base.mapData.height };
  }
  if (dir === 'left' || dir === 'west') {
    return { offsetX: base.offsetX - neighborEntry.width, offsetY: base.offsetY + connection.offset };
  }
  if (dir === 'right' || dir === 'east') {
    return { offsetX: base.offsetX + base.mapData.width, offsetY: base.offsetY + connection.offset };
  }
  return { offsetX: base.offsetX, offsetY: base.offsetY };
}

export function WebGLMapPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glContextRef = useRef<WebGLContext | null>(null);
  const tileRendererRef = useRef<WebGLTileRenderer | null>(null);
  const animationManagerRef = useRef<WebGLAnimationManager | null>(null);
  const tilesRef = useRef<TileInstance[]>([]);
  const tilesetGroupsRef = useRef<Array<{ key: string; assets: LoadedMapAssets; tiles: TileInstance[] }>>([]);
  const mapAssetsCacheRef = useRef<Map<string, LoadedMapAssets>>(new Map());
  const renderSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const rafRef = useRef<number | null>(null);
  const currentTilesetKeyRef = useRef<string | null>(null);

  const renderableMaps = useMemo(
    () =>
      mapIndexData
        .filter((map) => map.layoutPath && map.primaryTilesetPath && map.secondaryTilesetPath)
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const defaultMap = renderableMaps.find((m) => m.name === 'LittlerootTown') || renderableMaps[0];
  const [selectedMapId, setSelectedMapId] = useState<string>(defaultMap?.id ?? '');
  const [stitchConnections, setStitchConnections] = useState<boolean>(false);
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

  // Initialize WebGL context and renderer once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!isWebGL2Supported(canvas)) {
      setStats((s) => ({ ...s, webgl2Supported: false, error: 'WebGL2 not supported in this browser' }));
      return;
    }

    const ctx = new WebGLContext(canvas);
    if (!ctx.initialize()) {
      setStats((s) => ({ ...s, webgl2Supported: false, error: 'Failed to initialize WebGL2 context' }));
      return;
    }

    const renderer = new WebGLTileRenderer(ctx);
    renderer.initialize();

    const animationManager = new WebGLAnimationManager(ctx.getGL(), renderer.getTextureManager());

    glContextRef.current = ctx;
    tileRendererRef.current = renderer;
    animationManagerRef.current = animationManager;

    setStats((s) => ({ ...s, webgl2Supported: true, error: null }));

    let frameCount = 0;
    let fpsTime = performance.now();
    let gbaFrame = 0;
    let gbaAccum = 0;
    let lastTime = performance.now();

    const renderLoop = () => {
      const currentRenderer = tileRendererRef.current;
      const currentCtx = glContextRef.current;
      const canvasEl = canvasRef.current;
      if (!currentRenderer || !currentCtx || !canvasEl) return;

      // Advance GBA-frame counter based on real time so animations match hardware speed
      const nowTime = performance.now();
      const dt = nowTime - lastTime;
      lastTime = nowTime;
      gbaAccum += dt;
      while (gbaAccum >= GBA_FRAME_MS) {
        gbaAccum -= GBA_FRAME_MS;
        gbaFrame++;
      }

      const { width, height } = renderSizeRef.current;
      const groups = tilesetGroupsRef.current;
      const totalTiles = tilesRef.current.length;

      if (width > 0 && height > 0 && totalTiles > 0) {
        if (canvasEl.width !== width || canvasEl.height !== height) {
          canvasEl.width = width;
          canvasEl.height = height;
        }

        const start = performance.now();
        currentCtx.clear(0, 0, 0, 0);

        for (const group of groups) {
          if (currentTilesetKeyRef.current !== group.key) {
            // Upload tileset + palettes for this group
            currentRenderer.uploadTileset('primary', group.assets.primaryImage.data, group.assets.primaryImage.width, group.assets.primaryImage.height);
            currentRenderer.uploadTileset('secondary', group.assets.secondaryImage.data, group.assets.secondaryImage.width, group.assets.secondaryImage.height);
            currentRenderer.uploadPalettes(
              combineTilesetPalettes(group.assets.primaryPalettes, group.assets.secondaryPalettes)
            );

            // Reconfigure animations for this tileset
            if (animationManagerRef.current) {
              animationManagerRef.current.clear();
              animationManagerRef.current.setTilesetBuffers(
                group.assets.primaryImage.data,
                group.assets.primaryImage.width,
                group.assets.primaryImage.height,
                group.assets.secondaryImage.data,
                group.assets.secondaryImage.width,
                group.assets.secondaryImage.height
              );
              if (group.assets.animations.length > 0) {
                animationManagerRef.current.registerAnimations(group.assets.animations);
              }
            }

            currentTilesetKeyRef.current = group.key;
          }

          if (animationManagerRef.current?.hasAnimations()) {
            animationManagerRef.current.updateAnimations(gbaFrame);
          }

          currentRenderer.render(group.tiles, { width, height }, { x: 0, y: 0 });
        }

        const renderTime = performance.now() - start;

        frameCount++;
        const now = performance.now();
        if (now - fpsTime >= 500) {
          const fps = Math.round((frameCount * 1000) / (now - fpsTime));
          setStats((s) => ({
            ...s,
            tileCount: totalTiles,
            renderTimeMs: renderTime,
            fps,
          }));
          frameCount = 0;
          fpsTime = now;
        }
      }

      rafRef.current = requestAnimationFrame(renderLoop);
    };

    rafRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      animationManagerRef.current?.clear();
      renderer.dispose();
      ctx.dispose();
    };
  }, []);

  // Load selected map assets and upload to GPU
  useEffect(() => {
    const entry = selectedMap;
    if (!entry || !tileRendererRef.current || !glContextRef.current) return;

    let cancelled = false;
    setLoading(true);
    setStats((s) => ({ ...s, error: null }));

    const load = async () => {
      try {
        const mapAssetsCache = mapAssetsCacheRef.current;
        const anchorAssets = await loadMapAssets(entry, mapAssetsCache);
        if (cancelled) return;

        // Upload tilesets and palettes from the anchor map
        tileRendererRef.current!.uploadTileset('primary', anchorAssets.primaryImage.data, anchorAssets.primaryImage.width, anchorAssets.primaryImage.height);
        tileRendererRef.current!.uploadTileset('secondary', anchorAssets.secondaryImage.data, anchorAssets.secondaryImage.width, anchorAssets.secondaryImage.height);
        tileRendererRef.current!.uploadPalettes(combineTilesetPalettes(anchorAssets.primaryPalettes, anchorAssets.secondaryPalettes));

        // Configure animations (shared tilesets) from anchor
        if (animationManagerRef.current) {
          animationManagerRef.current.clear();
          animationManagerRef.current.setTilesetBuffers(
            anchorAssets.primaryImage.data,
            anchorAssets.primaryImage.width,
            anchorAssets.primaryImage.height,
            anchorAssets.secondaryImage.data,
            anchorAssets.secondaryImage.width,
            anchorAssets.secondaryImage.height
          );
          if (anchorAssets.animations.length > 0) {
            animationManagerRef.current.registerAnimations(anchorAssets.animations);
          }
        }

        // Build world chunks (anchor + optional stitched neighbors, any tileset)
        const chunks: WorldChunk[] = [
          {
            entry,
            mapData: anchorAssets.mapData,
            offsetX: 0,
            offsetY: 0,
          },
        ];

        const hasConnections = stitchConnections && entry.connections && entry.connections.length > 0;

        if (hasConnections) {
          const mapIndexById = new Map(mapIndexData.map((m) => [m.id, m]));
          const neighborPromises = entry.connections.map(async (conn) => {
            const neighborEntry = mapIndexById.get(conn.map);
            if (!neighborEntry) return null;
            const assets = await loadMapAssets(neighborEntry, mapAssetsCache);
            return { entry: neighborEntry, assets, connection: conn };
          });

          const neighborResults = await Promise.all(neighborPromises);
          for (const res of neighborResults) {
            if (!res) continue;
            const { offsetX, offsetY } = computeOffset(
              { entry, mapData: anchorAssets.mapData, offsetX: 0, offsetY: 0 },
              res.entry,
              res.connection
            );
            chunks.push({
              entry: res.entry,
              mapData: res.assets.mapData,
              offsetX,
              offsetY,
            });
          }
        }

        // Compute world bounds to normalize coordinates
        let minX = 0;
        let minY = 0;
        let maxX = entry.width;
        let maxY = entry.height;
        for (const c of chunks) {
          minX = Math.min(minX, c.offsetX);
          minY = Math.min(minY, c.offsetY);
          maxX = Math.max(maxX, c.offsetX + c.mapData.width);
          maxY = Math.max(maxY, c.offsetY + c.mapData.height);
        }
        const shiftX = -minX;
        const shiftY = -minY;

        // Build tiles for all chunks with shifted coordinates and group by tileset key
        const groups = new Map<string, { key: string; assets: LoadedMapAssets; tiles: TileInstance[] }>();
        let totalTiles = 0;

        for (const chunk of chunks) {
          const chunkAssets = await loadMapAssets(chunk.entry, mapAssetsCache);
          const tilesetKey = `${chunk.entry.primaryTilesetPath}::${chunk.entry.secondaryTilesetPath}`;
          const group = groups.get(tilesetKey) ?? {
            key: tilesetKey,
            assets: chunkAssets,
            tiles: [],
          };

          const baseTiles = buildMapTiles(chunkAssets.mapData, chunkAssets.primaryMetatiles, chunkAssets.secondaryMetatiles);
          const offsetPxX = (chunk.offsetX + shiftX) * METATILE_SIZE;
          const offsetPxY = (chunk.offsetY + shiftY) * METATILE_SIZE;
          for (const t of baseTiles) {
            group.tiles.push({
              ...t,
              x: t.x + offsetPxX,
              y: t.y + offsetPxY,
            });
          }

          totalTiles += baseTiles.length;
          groups.set(tilesetKey, group);
        }

        tilesetGroupsRef.current = Array.from(groups.values());
        tilesRef.current = tilesetGroupsRef.current.flatMap((g) => g.tiles);
        renderSizeRef.current = {
          width: (maxX - minX) * METATILE_SIZE,
          height: (maxY - minY) * METATILE_SIZE,
        };
        setWorldSize({
          width: renderSizeRef.current.width,
          height: renderSizeRef.current.height,
        });

        setStats((s) => ({ ...s, tileCount: totalTiles, error: null }));
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
  }, [selectedMap, stitchConnections]);

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
        Pure tiles-only rendering (no NPCs or gameplay). Powered by the WebGL tile renderer + palette/animation system.
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
          {stitchConnections && (
            <span style={{ display: 'block', marginTop: 4 }}>
              Stitched canvas: {worldSize.width}px × {worldSize.height}px
            </span>
          )}
        </div>
        {selectedMap.connections.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setStitchConnections((v) => !v)}
              style={{
                padding: '0.4rem 0.75rem',
                background: stitchConnections ? '#2356ff' : '#1a1f2d',
                border: '1px solid #2f3a55',
                color: '#e6e6e6',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {stitchConnections ? 'Stitch Connections: ON' : 'Stitch Connections: OFF'}
            </button>
            <span style={{ fontSize: 12, color: '#9fb0cc' }}>
              Includes one connected map per direction when tilesets match.
            </span>
          </div>
        )}
        {loading && <div style={{ marginTop: 8, color: '#88f' }}>Loading map data…</div>}
        {stats.error && <div style={{ marginTop: 8, color: '#ff6666' }}>Error: {stats.error}</div>}
      </div>

      <div className="map-card">
        <div className="map-canvas-wrapper">
          <canvas
            ref={canvasRef}
            className="webgl-map-canvas"
            style={{ width: pixelWidth, height: pixelHeight }}
          />
        </div>
        <div className="map-stats">
          <div><strong>Tiles:</strong> {stats.tileCount.toLocaleString()}</div>
          <div><strong>FPS:</strong> {stats.fps}</div>
          <div><strong>Render:</strong> {stats.renderTimeMs.toFixed(2)} ms</div>
          <div><strong>WebGL2:</strong> {stats.webgl2Supported ? 'Yes' : 'No'}</div>
          <div><strong>Animations:</strong> {animationManagerRef.current?.getAnimationCount() ?? 0}</div>
        </div>
      </div>
    </div>
  );
}

export default WebGLMapPage;
