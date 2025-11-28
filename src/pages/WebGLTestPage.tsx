/**
 * WebGL Test Page - Full page test for WebGL tile rendering
 *
 * Access via /#/webgl-test
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import UPNG from 'upng-js';
import { WebGLContext, isWebGL2Supported } from '../rendering/webgl/WebGLContext';
import { WebGLTileRenderer } from '../rendering/webgl/WebGLTileRenderer';
import { WebGLFramebufferManager } from '../rendering/webgl/WebGLFramebufferManager';
import { WebGLCompositor } from '../rendering/webgl/WebGLCompositor';
import { WebGLAnimationManager } from '../rendering/webgl/WebGLAnimationManager';
import {
  loadTilesetImage,
  loadText,
  loadBinary,
  parsePalette,
  loadMapLayout,
  loadMetatileDefinitions,
  TILE_SIZE,
  type Palette,
  type TilesetImageData,
  type Metatile,
  type MapData,
} from '../utils/mapLoader';
import { TILESET_ANIMATION_CONFIGS } from '../data/tilesetAnimations';
import type { TileInstance } from '../rendering/webgl/types';
import type { LoadedAnimation } from '../rendering/types';

/** Available tileset options */
const TILESET_OPTIONS = [
  { value: 'test', label: 'Test Patterns' },
  { value: 'general', label: 'General (Primary)' },
  { value: 'petalburg', label: 'Petalburg City' },
  { value: 'rustboro', label: 'Rustboro City' },
  { value: 'pokemon_center', label: 'Pokemon Center' },
  { value: 'littleroot_map', label: 'Littleroot Town (Map) - flowers' },
  { value: 'dewford_map', label: 'Dewford Town (Map) - water + flag' },
  { value: 'sootopolis_map', label: 'Sootopolis City (Map) - stormy water' },
];

/** Tileset paths */
const TILESET_PATHS: Record<string, { primary: string; secondary: string }> = {
  general: {
    primary: 'pokeemerald/data/tilesets/primary/general',
    secondary: 'pokeemerald/data/tilesets/secondary/petalburg',
  },
  petalburg: {
    primary: 'pokeemerald/data/tilesets/primary/general',
    secondary: 'pokeemerald/data/tilesets/secondary/petalburg',
  },
  rustboro: {
    primary: 'pokeemerald/data/tilesets/primary/general',
    secondary: 'pokeemerald/data/tilesets/secondary/rustboro',
  },
  pokemon_center: {
    primary: 'pokeemerald/data/tilesets/primary/building',
    secondary: 'pokeemerald/data/tilesets/secondary/pokemon_center',
  },
  littleroot_map: {
    primary: 'pokeemerald/data/tilesets/primary/general',
    secondary: 'pokeemerald/data/tilesets/secondary/petalburg',
  },
  dewford_map: {
    primary: 'pokeemerald/data/tilesets/primary/general',
    secondary: 'pokeemerald/data/tilesets/secondary/dewford',
  },
  sootopolis_map: {
    primary: 'pokeemerald/data/tilesets/primary/general',
    secondary: 'pokeemerald/data/tilesets/secondary/sootopolis',
  },
};

/** Map info for debug maps */
const MAP_CONFIGS: Record<string, { layoutPath: string; width: number; height: number; primaryTilesetId: string; secondaryTilesetId: string }> = {
  littleroot_map: {
    layoutPath: 'pokeemerald/data/layouts/LittlerootTown',
    width: 20,
    height: 20,
    primaryTilesetId: 'gTileset_General',
    secondaryTilesetId: '', // Petalburg has no animations
  },
  dewford_map: {
    layoutPath: 'pokeemerald/data/layouts/DewfordTown',
    width: 20,
    height: 20,
    primaryTilesetId: 'gTileset_General',
    secondaryTilesetId: 'gTileset_Dewford',
  },
  sootopolis_map: {
    layoutPath: 'pokeemerald/data/layouts/SootopolisCity',
    width: 60,
    height: 60,
    primaryTilesetId: 'gTileset_General',
    secondaryTilesetId: 'gTileset_Sootopolis',
  },
};

/** Number of palettes from primary tileset (slots 0-5) */
const NUM_PALS_IN_PRIMARY = 6;
/** Total number of tileset palettes (slots 0-12) */
const NUM_PALS_TOTAL = 13;
/** GBA vblank frame duration (~59.73 Hz) for accurate animation timing */
const GBA_FRAME_MS = 1000 / 59.7275;

/** Load palettes for a tileset */
async function loadPalettes(tilesetPath: string, startIndex: number, count: number): Promise<Palette[]> {
  const palettes: Palette[] = [];
  for (let i = startIndex; i < startIndex + count; i++) {
    try {
      const text = await loadText(`${tilesetPath}/palettes/${i.toString().padStart(2, '0')}.pal`);
      palettes.push(parsePalette(text));
    } catch {
      // Palette doesn't exist, use empty
      palettes.push({ colors: Array(16).fill('#000000') });
    }
  }
  return palettes;
}

/**
 * Combine primary and secondary palettes like the GBA does:
 * - Slots 0-5: from primary tileset's 00-05.pal
 * - Slots 6-12: from secondary tileset's 06-12.pal
 * - Slots 13-15: filled with black (unused)
 */
function combineTilesetPalettes(primaryPalettes: Palette[], secondaryPalettes: Palette[]): Palette[] {
  const combined: Palette[] = [];

  // Slots 0-5: from primary
  for (let i = 0; i < NUM_PALS_IN_PRIMARY; i++) {
    combined.push(primaryPalettes[i] || { colors: Array(16).fill('#000000') });
  }

  // Slots 6-12: from secondary (indices 6-12 in the secondary's palette array)
  for (let i = NUM_PALS_IN_PRIMARY; i < NUM_PALS_TOTAL; i++) {
    combined.push(secondaryPalettes[i - NUM_PALS_IN_PRIMARY] || { colors: Array(16).fill('#000000') });
  }

  // Slots 13-15: fill with black
  for (let i = NUM_PALS_TOTAL; i < 16; i++) {
    combined.push({ colors: Array(16).fill('#000000') });
  }

  return combined;
}

/**
 * Load a PNG frame as indexed pixel data
 */
async function loadIndexedFrame(url: string): Promise<{ data: Uint8Array; width: number; height: number }> {
  const buffer = await loadBinary(url);
  const img = UPNG.decode(buffer);

  let data: Uint8Array;
  if (img.ctype === 3 && img.depth === 4) {
    // 4-bit indexed PNG - unpack nibbles
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

/**
 * Load animations for the given tilesets
 */
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
        const frame = await loadIndexedFrame(`/pokeemerald/${framePath}`);
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
      console.warn(`Animation ${def.id} not loaded:`, err);
    }
  }

  return loaded;
}

/** Secondary tileset tile ID offset */
const SECONDARY_TILE_OFFSET = 512;

/**
 * Build tile instances from map data and metatiles
 * This mimics how the actual renderer works
 */
function buildMapTiles(
  mapData: MapData,
  primaryMetatiles: Metatile[],
  secondaryMetatiles: Metatile[]
): TileInstance[] {
  const tiles: TileInstance[] = [];
  const TILE_SIZE = 8;
  const METATILE_SIZE = 16;
  const NUM_PRIMARY_METATILES = 512;

  for (let my = 0; my < mapData.height; my++) {
    for (let mx = 0; mx < mapData.width; mx++) {
      const mapTile = mapData.layout[my * mapData.width + mx];
      const metatileId = mapTile.metatileId;

      // Get metatile from correct tileset
      const metatile = metatileId < NUM_PRIMARY_METATILES
        ? primaryMetatiles[metatileId]
        : secondaryMetatiles[metatileId - NUM_PRIMARY_METATILES];

      if (!metatile) continue;

      // Render both layers (0 and 1)
      for (let layer = 0; layer < 2; layer++) {
        for (let i = 0; i < 4; i++) {
          const tileIndex = layer * 4 + i;
          const tile = metatile.tiles[tileIndex];
          if (!tile) continue;

          // Calculate position within metatile (2x2 grid of 8x8 tiles)
          const subX = (i % 2) * TILE_SIZE;
          const subY = Math.floor(i / 2) * TILE_SIZE;

          // Determine tileset (primary vs secondary)
          const isSecondary = tile.tileId >= SECONDARY_TILE_OFFSET;
          const tilesetIndex = isSecondary ? 1 : 0;

          // Adjust tile ID for secondary tileset (remove offset)
          const effectiveTileId = isSecondary
            ? tile.tileId - SECONDARY_TILE_OFFSET
            : tile.tileId;

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

interface TestStats {
  webgl2Supported: boolean;
  initialized: boolean;
  tileCount: number;
  renderTimeMs: number;
  fps: number;
  error: string | null;
  capabilities: {
    maxTextureSize: number;
    maxTextureUnits: number;
  } | null;
}

/**
 * Create test tile instances (animated patterns)
 */
function createTestTiles(
  tilesWide: number,
  tilesHigh: number,
  frame: number = 0
): TileInstance[] {
  const tiles: TileInstance[] = [];

  for (let y = 0; y < tilesHigh; y++) {
    for (let x = 0; x < tilesWide; x++) {
      // Animated pattern based on frame
      const tileId = ((x + y + Math.floor(frame / 10)) % 32);

      tiles.push({
        x: x * 8,
        y: y * 8,
        tileId,
        paletteId: (x + y) % 6,
        xflip: (x + Math.floor(frame / 30)) % 8 === 0,
        yflip: (y + Math.floor(frame / 30)) % 8 === 0,
        tilesetIndex: 0,
      });
    }
  }

  return tiles;
}

/**
 * Create tiles to display tileset as a grid
 * Shows all tiles in order with their palettes
 */
function createTilesetGridTiles(
  tilesetWidth: number,
  tilesetHeight: number,
  paletteId: number,
  tilesetIndex: 0 | 1
): TileInstance[] {
  const tiles: TileInstance[] = [];
  const tilesPerRow = tilesetWidth / 8;
  const totalTileRows = tilesetHeight / 8;
  const totalTiles = tilesPerRow * totalTileRows;

  for (let i = 0; i < totalTiles; i++) {
    const gridX = i % tilesPerRow;
    const gridY = Math.floor(i / tilesPerRow);

    tiles.push({
      x: gridX * 8,
      y: gridY * 8,
      tileId: i,
      paletteId,
      xflip: false,
      yflip: false,
      tilesetIndex,
    });
  }

  return tiles;
}

/**
 * Create a test tileset with various patterns
 */
function createTestTileset(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height);
  const tilesPerRow = width / 8;

  for (let ty = 0; ty < height / 8; ty++) {
    for (let tx = 0; tx < tilesPerRow; tx++) {
      const tileIndex = ty * tilesPerRow + tx;

      for (let py = 0; py < 8; py++) {
        for (let px = 0; px < 8; px++) {
          const dataIndex = (ty * 8 + py) * width + (tx * 8 + px);

          // Different patterns for different tiles
          const pattern = tileIndex % 8;
          switch (pattern) {
            case 0: // Solid
              data[dataIndex] = 1;
              break;
            case 1: // Checkerboard
              data[dataIndex] = ((px + py) % 2 === 0) ? 2 : 3;
              break;
            case 2: // Horizontal stripes
              data[dataIndex] = (py % 2 === 0) ? 4 : 5;
              break;
            case 3: // Vertical stripes
              data[dataIndex] = (px % 2 === 0) ? 6 : 7;
              break;
            case 4: // Diagonal
              data[dataIndex] = ((px + py) % 4 < 2) ? 8 : 9;
              break;
            case 5: // Border
              data[dataIndex] = (px === 0 || px === 7 || py === 0 || py === 7) ? 10 : 0;
              break;
            case 6: // Gradient
              data[dataIndex] = Math.min(15, Math.floor((px + py) / 2) + 1);
              break;
            case 7: // Cross
              data[dataIndex] = (px === 3 || px === 4 || py === 3 || py === 4) ? 11 : 12;
              break;
          }
        }
      }
    }
  }

  return data;
}

/**
 * Create colorful test palettes
 */
function createTestPalettes(): { colors: string[] }[] {
  const palettes: { colors: string[] }[] = [];

  const colorSets = [
    // Reds
    ['#000000', '#ff0000', '#cc0000', '#990000', '#ff3333', '#ff6666', '#ff9999', '#ffcccc',
     '#800000', '#b30000', '#e60000', '#ff1a1a', '#ff4d4d', '#ff8080', '#ffb3b3', '#ffe6e6'],
    // Greens
    ['#000000', '#00ff00', '#00cc00', '#009900', '#33ff33', '#66ff66', '#99ff99', '#ccffcc',
     '#008000', '#00b300', '#00e600', '#1aff1a', '#4dff4d', '#80ff80', '#b3ffb3', '#e6ffe6'],
    // Blues
    ['#000000', '#0000ff', '#0000cc', '#000099', '#3333ff', '#6666ff', '#9999ff', '#ccccff',
     '#000080', '#0000b3', '#0000e6', '#1a1aff', '#4d4dff', '#8080ff', '#b3b3ff', '#e6e6ff'],
    // Yellows
    ['#000000', '#ffff00', '#cccc00', '#999900', '#ffff33', '#ffff66', '#ffff99', '#ffffcc',
     '#808000', '#b3b300', '#e6e600', '#ffff1a', '#ffff4d', '#ffff80', '#ffffb3', '#ffffe6'],
    // Cyans
    ['#000000', '#00ffff', '#00cccc', '#009999', '#33ffff', '#66ffff', '#99ffff', '#ccffff',
     '#008080', '#00b3b3', '#00e6e6', '#1affff', '#4dffff', '#80ffff', '#b3ffff', '#e6ffff'],
    // Magentas
    ['#000000', '#ff00ff', '#cc00cc', '#990099', '#ff33ff', '#ff66ff', '#ff99ff', '#ffccff',
     '#800080', '#b300b3', '#e600e6', '#ff1aff', '#ff4dff', '#ff80ff', '#ffb3ff', '#ffe6ff'],
  ];

  for (const colors of colorSets) {
    palettes.push({ colors });
  }

  return palettes;
}

/** Loaded tileset data */
interface LoadedTileset {
  primaryImage: Uint8Array;
  secondaryImage: Uint8Array;
  primaryPalettes: Palette[];
  secondaryPalettes: Palette[];
  primaryWidth: number;
  primaryHeight: number;
  secondaryWidth: number;
  secondaryHeight: number;
  // Optional map data for map rendering mode
  mapData?: MapData;
  primaryMetatiles?: Metatile[];
  secondaryMetatiles?: Metatile[];
  // Loaded animations
  animations?: LoadedAnimation[];
}

export function WebGLTestPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState<TestStats>({
    webgl2Supported: false,
    initialized: false,
    tileCount: 0,
    renderTimeMs: 0,
    fps: 0,
    error: null,
    capabilities: null,
  });
  const [tileCount, setTileCount] = useState({ wide: 40, high: 30 });
  const [animate, setAnimate] = useState(true);
  const [selectedTileset, setSelectedTileset] = useState('test');
  const [loadedTileset, setLoadedTileset] = useState<LoadedTileset | null>(null);
  const [selectedPalette, setSelectedPalette] = useState(0);
  const [showSecondary, setShowSecondary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [use3Pass, setUse3Pass] = useState(false);
  const [enableTileAnimations, setEnableTileAnimations] = useState(true);

  // Use refs so render loop can access current values without re-initializing WebGL
  const tileCountRef = useRef(tileCount);
  const animateRef = useRef(animate);
  const loadedTilesetRef = useRef(loadedTileset);
  const selectedPaletteRef = useRef(selectedPalette);
  const showSecondaryRef = useRef(showSecondary);
  const selectedTilesetRef = useRef(selectedTileset);
  const use3PassRef = useRef(use3Pass);
  const enableTileAnimationsRef = useRef(enableTileAnimations);

  // Keep refs in sync with state
  useEffect(() => {
    tileCountRef.current = tileCount;
  }, [tileCount]);

  useEffect(() => {
    animateRef.current = animate;
  }, [animate]);

  useEffect(() => {
    loadedTilesetRef.current = loadedTileset;
  }, [loadedTileset]);

  useEffect(() => {
    selectedPaletteRef.current = selectedPalette;
  }, [selectedPalette]);

  useEffect(() => {
    showSecondaryRef.current = showSecondary;
  }, [showSecondary]);

  useEffect(() => {
    selectedTilesetRef.current = selectedTileset;
  }, [selectedTileset]);

  useEffect(() => {
    use3PassRef.current = use3Pass;
  }, [use3Pass]);

  useEffect(() => {
    enableTileAnimationsRef.current = enableTileAnimations;
  }, [enableTileAnimations]);

  // Ref to store tile renderer for updating tilesets
  const tileRendererRef = useRef<WebGLTileRenderer | null>(null);

  // Ref to store animation manager
  const animationManagerRef = useRef<WebGLAnimationManager | null>(null);

  // Load tileset callback
  const handleLoadTileset = useCallback(async (tilesetKey: string) => {
    if (tilesetKey === 'test') {
      setLoadedTileset(null);
      // Reset to test patterns - renderer will use test tilesets
      const renderer = tileRendererRef.current;
      if (renderer) {
        const tilesetWidth = 128;
        const tilesetHeight = 512;
        const testTileset = createTestTileset(tilesetWidth, tilesetHeight);
        renderer.uploadTileset('primary', testTileset, tilesetWidth, tilesetHeight);
        renderer.uploadTileset('secondary', testTileset, tilesetWidth, tilesetHeight);
        renderer.uploadPalettes(createTestPalettes());
      }
      return;
    }

    const paths = TILESET_PATHS[tilesetKey];
    if (!paths) return;

    setLoading(true);
    const mapConfig = MAP_CONFIGS[tilesetKey];
    const isMapMode = !!mapConfig;

    try {
      // Load tileset images (with dimensions) and palettes
      // GBA palette system:
      // - Primary tileset provides palettes 0-5 (from 00.pal to 05.pal)
      // - Secondary tileset provides palettes 6-12 (from 06.pal to 12.pal)
      const basePromises = [
        loadTilesetImage(`${paths.primary}/tiles.png`, true) as Promise<TilesetImageData>,
        loadTilesetImage(`${paths.secondary}/tiles.png`, true) as Promise<TilesetImageData>,
        loadPalettes(paths.primary, 0, NUM_PALS_IN_PRIMARY),           // Load 00-05.pal from primary
        loadPalettes(paths.secondary, NUM_PALS_IN_PRIMARY, NUM_PALS_TOTAL - NUM_PALS_IN_PRIMARY), // Load 06-12.pal from secondary
      ];

      // For map mode, also load map data and metatiles
      const mapPromises = isMapMode && mapConfig ? [
        loadMapLayout(`${mapConfig.layoutPath}/map.bin`, mapConfig.width, mapConfig.height),
        loadMetatileDefinitions(`${paths.primary}/metatiles.bin`),
        loadMetatileDefinitions(`${paths.secondary}/metatiles.bin`),
      ] : [];

      const results = await Promise.all([...basePromises, ...mapPromises]);

      const primaryImageData = results[0] as TilesetImageData;
      const secondaryImageData = results[1] as TilesetImageData;
      const primaryPalettes = results[2] as Palette[];
      const secondaryPalettes = results[3] as Palette[];

      // Map data (only for map mode)
      const mapData = isMapMode ? results[4] as MapData : undefined;
      const primaryMetatiles = isMapMode ? results[5] as Metatile[] : undefined;
      const secondaryMetatiles = isMapMode ? results[6] as Metatile[] : undefined;

      console.log('Primary tileset:', primaryImageData.width, 'x', primaryImageData.height, '=', primaryImageData.data.length, 'bytes');
      console.log('Secondary tileset:', secondaryImageData.width, 'x', secondaryImageData.height, '=', secondaryImageData.data.length, 'bytes');
      console.log('Loaded palettes: primary[0-5]:', primaryPalettes.length, ', secondary[6-12]:', secondaryPalettes.length);
      if (isMapMode && mapConfig) {
        console.log('Map data:', mapData?.width, 'x', mapData?.height, 'metatiles');
        console.log('Primary metatiles:', primaryMetatiles?.length, ', Secondary metatiles:', secondaryMetatiles?.length);
      }

      // Load animations for map mode
      let animations: LoadedAnimation[] | undefined;
      if (isMapMode && mapConfig) {
        animations = await loadAnimationsForTilesets(
          mapConfig.primaryTilesetId,
          mapConfig.secondaryTilesetId
        );
        console.log('Loaded animations:', animations.length);
      }

      const tileset: LoadedTileset = {
        primaryImage: primaryImageData.data,
        secondaryImage: secondaryImageData.data,
        primaryPalettes,
        secondaryPalettes,
        primaryWidth: primaryImageData.width,
        primaryHeight: primaryImageData.height,
        secondaryWidth: secondaryImageData.width,
        secondaryHeight: secondaryImageData.height,
        mapData,
        primaryMetatiles,
        secondaryMetatiles,
        animations,
      };

      setLoadedTileset(tileset);

      // Upload to WebGL renderer
      const renderer = tileRendererRef.current;
      if (renderer) {
        renderer.uploadTileset('primary', primaryImageData.data, primaryImageData.width, primaryImageData.height);
        renderer.uploadTileset('secondary', secondaryImageData.data, secondaryImageData.width, secondaryImageData.height);
        // Combine palettes correctly: slots 0-5 from primary, slots 6-12 from secondary
        const combinedPalettes = combineTilesetPalettes(primaryPalettes, secondaryPalettes);
        renderer.uploadPalettes(combinedPalettes);

        // Register animations with animation manager
        if (animations && animations.length > 0 && animationManagerRef.current) {
          // Set tileset buffers for animation patching
          animationManagerRef.current.setTilesetBuffers(
            primaryImageData.data,
            primaryImageData.width,
            primaryImageData.height,
            secondaryImageData.data,
            secondaryImageData.width,
            secondaryImageData.height
          );
          animationManagerRef.current.registerAnimations(animations);
          console.log('Registered', animations.length, 'animations with WebGL animation manager');
        }
      }
    } catch (err) {
      console.error('Failed to load tileset:', err);
      setStats(s => ({ ...s, error: `Failed to load tileset: ${err}` }));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load tileset when selection changes
  useEffect(() => {
    handleLoadTileset(selectedTileset);
  }, [selectedTileset, handleLoadTileset]);

  // Initialize WebGL once (empty dependency array)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check WebGL2 support using a separate test canvas (not the render canvas)
    if (!isWebGL2Supported()) {
      setStats(s => ({ ...s, webgl2Supported: false, error: 'WebGL2 not supported' }));
      return;
    }

    setStats(s => ({ ...s, webgl2Supported: true }));

    // Set initial canvas size (will be resized in render loop)
    canvas.width = tileCountRef.current.wide * 8;
    canvas.height = tileCountRef.current.high * 8;

    // Initialize WebGL
    const glContext = new WebGLContext(canvas);
    if (!glContext.initialize()) {
      setStats(s => ({ ...s, error: 'Failed to initialize WebGL context' }));
      return;
    }

    // Set viewport to match canvas size
    glContext.resize(canvas.width, canvas.height);

    const caps = glContext.getCapabilities();
    setStats(s => ({
      ...s,
      capabilities: {
        maxTextureSize: caps.maxTextureSize,
        maxTextureUnits: caps.maxTextureUnits,
      },
    }));

    try {
      const gl = glContext.getGL();

      // Create tile renderer
      const tileRenderer = new WebGLTileRenderer(glContext);
      tileRenderer.initialize();

      // Create animation manager
      const animationManager = new WebGLAnimationManager(gl, tileRenderer.getTextureManager());
      animationManagerRef.current = animationManager;

      // Create framebuffer manager and compositor for 3-pass mode
      const framebufferManager = new WebGLFramebufferManager(gl);
      const compositor = new WebGLCompositor(gl);
      compositor.initialize();

      // Save renderer ref for tileset updates
      tileRendererRef.current = tileRenderer;

      // Upload test tileset (initial)
      const tilesetWidth = 128;
      const tilesetHeight = 512;
      const testTileset = createTestTileset(tilesetWidth, tilesetHeight);
      tileRenderer.uploadTileset('primary', testTileset, tilesetWidth, tilesetHeight);
      tileRenderer.uploadTileset('secondary', testTileset, tilesetWidth, tilesetHeight);

      // Upload test palettes
      const testPalettes = createTestPalettes();
      tileRenderer.uploadPalettes(testPalettes);

      setStats(s => ({ ...s, initialized: true }));

      // Render loop - reads from refs to get current values
      let frameCount = 0;
      let fpsTime = performance.now();
      let animationId: number;
      let gbaFrame = 0;
      let gbaAccum = 0;
      let lastTime = performance.now();

      const render = () => {
        // Convert real elapsed time into GBA frame count so animations run at hardware speed
        const nowTime = performance.now();
        const dt = nowTime - lastTime;
        lastTime = nowTime;
        gbaAccum += dt;
        while (gbaAccum >= GBA_FRAME_MS) {
          gbaAccum -= GBA_FRAME_MS;
          gbaFrame++;
        }
        const startTime = performance.now();
        const currentTileCount = tileCountRef.current;
        const currentAnimate = animateRef.current;
        const currentTileset = loadedTilesetRef.current;
        const currentPalette = selectedPaletteRef.current;
        const currentShowSecondary = showSecondaryRef.current;
        const currentSelectedTileset = selectedTilesetRef.current;
        const current3Pass = use3PassRef.current;
        const currentEnableTileAnimations = enableTileAnimationsRef.current;
        const animFrame = currentAnimate ? gbaFrame : 0;

        // Update tile animations if enabled
        if (currentEnableTileAnimations && animationManagerRef.current && animationManagerRef.current.hasAnimations()) {
          animationManagerRef.current.updateAnimations(gbaFrame);
        }

        // Create tiles based on mode
        let tiles: TileInstance[];
        let renderWidth: number;
        let renderHeight: number;

        if (currentSelectedTileset === 'test' || !currentTileset) {
          // Test pattern mode
          tiles = createTestTiles(
            currentTileCount.wide,
            currentTileCount.high,
            animFrame
          );
          renderWidth = currentTileCount.wide * 8;
          renderHeight = currentTileCount.high * 8;
        } else if (currentTileset.mapData && currentTileset.primaryMetatiles && currentTileset.secondaryMetatiles) {
          // Map rendering mode (e.g., Littleroot Town)
          tiles = buildMapTiles(
            currentTileset.mapData,
            currentTileset.primaryMetatiles,
            currentTileset.secondaryMetatiles
          );
          // Map size: metatiles are 16x16 pixels
          renderWidth = currentTileset.mapData.width * 16;
          renderHeight = currentTileset.mapData.height * 16;
        } else {
          // Real tileset grid mode
          const tilesetIndex = currentShowSecondary ? 1 : 0;
          const width = currentShowSecondary ? currentTileset.secondaryWidth : currentTileset.primaryWidth;
          const height = currentShowSecondary ? currentTileset.secondaryHeight : currentTileset.primaryHeight;
          tiles = createTilesetGridTiles(width, height, currentPalette, tilesetIndex as 0 | 1);
          renderWidth = width;
          renderHeight = height;
        }

        // Resize canvas buffer to match (textures/shaders stay valid)
        if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
          canvas.width = renderWidth;
          canvas.height = renderHeight;
        }

        if (current3Pass) {
          // 3-pass rendering mode - demonstrates framebuffer usage
          // Split tiles into 3 conceptual passes based on position

          // Pass 1: Background (bottom third of tiles)
          const bgTiles = tiles.filter(t => t.y < renderHeight / 3);
          framebufferManager.getFramebuffer('background', renderWidth, renderHeight);
          framebufferManager.bindFramebuffer('background');
          framebufferManager.clear(0, 0, 0, 0);
          if (bgTiles.length > 0) {
            tileRenderer.render(bgTiles, { width: renderWidth, height: renderHeight }, { x: 0, y: 0 });
          }
          framebufferManager.unbindFramebuffer();

          // Pass 2: TopBelow (middle third)
          const middleTiles = tiles.filter(t => t.y >= renderHeight / 3 && t.y < 2 * renderHeight / 3);
          framebufferManager.getFramebuffer('topBelow', renderWidth, renderHeight);
          framebufferManager.bindFramebuffer('topBelow');
          framebufferManager.clear(0, 0, 0, 0);
          if (middleTiles.length > 0) {
            tileRenderer.render(middleTiles, { width: renderWidth, height: renderHeight }, { x: 0, y: 0 });
          }
          framebufferManager.unbindFramebuffer();

          // Pass 3: TopAbove (top third)
          const topTiles = tiles.filter(t => t.y >= 2 * renderHeight / 3);
          framebufferManager.getFramebuffer('topAbove', renderWidth, renderHeight);
          framebufferManager.bindFramebuffer('topAbove');
          framebufferManager.clear(0, 0, 0, 0);
          if (topTiles.length > 0) {
            tileRenderer.render(topTiles, { width: renderWidth, height: renderHeight }, { x: 0, y: 0 });
          }
          framebufferManager.unbindFramebuffer();

          // Composite all passes to screen
          gl.viewport(0, 0, renderWidth, renderHeight);
          compositor.compositeToScreen(
            framebufferManager.getPassTexture('background'),
            renderWidth, renderHeight, 0, 0, true
          );
          compositor.compositeToScreen(
            framebufferManager.getPassTexture('topBelow'),
            renderWidth, renderHeight, 0, 0, false
          );
          compositor.compositeToScreen(
            framebufferManager.getPassTexture('topAbove'),
            renderWidth, renderHeight, 0, 0, false
          );
        } else {
          // Direct rendering mode (original)
          gl.viewport(0, 0, renderWidth, renderHeight);
          glContext.clear(0.1, 0.1, 0.15, 1);
          tileRenderer.render(
            tiles,
            { width: renderWidth, height: renderHeight },
            { x: 0, y: 0 }
          );
        }

        const renderTime = performance.now() - startTime;

        // Update stats
        frameCount++;
        const now = performance.now();
        if (now - fpsTime >= 1000) {
          setStats(s => ({
            ...s,
            tileCount: tiles.length,
            renderTimeMs: renderTime,
            fps: frameCount,
          }));
          frameCount = 0;
          fpsTime = now;
        }

        animationId = requestAnimationFrame(render);
      };

      render();

      return () => {
        cancelAnimationFrame(animationId);
        tileRendererRef.current = null;
        compositor.dispose();
        framebufferManager.dispose();
        tileRenderer.dispose();
        glContext.dispose();
      };
    } catch (error) {
      setStats(s => ({
        ...s,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []); // Empty dependency array - only initialize once

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1a2e',
      color: 'white',
      fontFamily: 'monospace',
      padding: 20,
    }}>
      <h1>WebGL Tile Renderer Test</h1>
      <p>
        <a href="#/" style={{ color: '#88f' }}>&larr; Back to game</a>
      </p>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Canvas */}
        <div>
          <canvas
            ref={canvasRef}
            style={{
              border: '2px solid #444',
              imageRendering: 'pixelated',
              display: 'block',
            }}
          />
        </div>

        {/* Controls & Stats */}
        <div style={{ minWidth: 300 }}>
          <h3>Status</h3>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 12px 4px 0' }}>WebGL2:</td>
                <td>{stats.webgl2Supported ? '✅ Supported' : '❌ Not supported'}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px 4px 0' }}>Initialized:</td>
                <td>{stats.initialized ? '✅ Ready' : '❌ Failed'}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px 4px 0' }}>Tiles:</td>
                <td>{stats.tileCount.toLocaleString()}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px 4px 0' }}>Render time:</td>
                <td>{stats.renderTimeMs.toFixed(2)} ms</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px 4px 0' }}>FPS:</td>
                <td>{stats.fps}</td>
              </tr>
              {stats.capabilities && (
                <>
                  <tr>
                    <td style={{ padding: '4px 12px 4px 0' }}>Max texture:</td>
                    <td>{stats.capabilities.maxTextureSize}px</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 12px 4px 0' }}>Texture units:</td>
                    <td>{stats.capabilities.maxTextureUnits}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          {stats.error && (
            <div style={{ color: '#ff6666', marginTop: 10 }}>
              Error: {stats.error}
            </div>
          )}

          <h3 style={{ marginTop: 20 }}>Controls</h3>
          <div style={{ marginBottom: 10 }}>
            <label>
              Grid size: {tileCount.wide}x{tileCount.high} ({tileCount.wide * tileCount.high} tiles)
            </label>
            <br />
            <input
              type="range"
              min={10}
              max={100}
              value={tileCount.wide}
              onChange={(e) => setTileCount(t => ({ ...t, wide: Number(e.target.value) }))}
              style={{ width: 200 }}
            />
            <span> width</span>
            <br />
            <input
              type="range"
              min={10}
              max={100}
              value={tileCount.high}
              onChange={(e) => setTileCount(t => ({ ...t, high: Number(e.target.value) }))}
              style={{ width: 200 }}
            />
            <span> height</span>
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={animate}
                onChange={(e) => setAnimate(e.target.checked)}
              />
              {' '}Animate tiles
            </label>
          </div>

          <div style={{ marginTop: 10 }}>
            <label>
              <input
                type="checkbox"
                checked={use3Pass}
                onChange={(e) => setUse3Pass(e.target.checked)}
              />
              {' '}Use 3-pass rendering
            </label>
            <div style={{ fontSize: 11, opacity: 0.7, marginLeft: 20 }}>
              (renders to framebuffers, then composites)
            </div>
          </div>
          <div>
            <label>
              <input
                type="checkbox"
                checked={enableTileAnimations}
                onChange={(e) => setEnableTileAnimations(e.target.checked)}
              />
              {' '}Enable tile animations
            </label>
            <div style={{ fontSize: 11, opacity: 0.7, marginLeft: 20 }}>
              (water, flowers - only for Littleroot Map)
            </div>
          </div>

          <h3 style={{ marginTop: 20 }}>Tileset</h3>
          <div style={{ marginBottom: 10 }}>
            <select
              value={selectedTileset}
              onChange={(e) => setSelectedTileset(e.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: 14,
                background: '#333',
                color: 'white',
                border: '1px solid #555',
                borderRadius: 4,
                width: 200,
              }}
            >
              {TILESET_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {loading && <span style={{ marginLeft: 10, color: '#88f' }}>Loading...</span>}
          </div>

          {selectedTileset !== 'test' && (
            <>
              <div style={{ marginBottom: 10 }}>
                <label>
                  Palette: {selectedPalette}
                  <br />
                  <input
                    type="range"
                    min={0}
                    max={15}
                    value={selectedPalette}
                    onChange={(e) => setSelectedPalette(Number(e.target.value))}
                    style={{ width: 200 }}
                  />
                </label>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={showSecondary}
                    onChange={(e) => setShowSecondary(e.target.checked)}
                  />
                  {' '}Show Secondary Tileset
                </label>
              </div>
            </>
          )}

          <h3 style={{ marginTop: 20 }}>Performance Notes</h3>
          <ul style={{ fontSize: 12, opacity: 0.8 }}>
            <li>All tiles rendered in 1 draw call</li>
            <li>GPU palette lookup (no CPU work)</li>
            <li>Target: &lt;1ms for 1600 tiles</li>
            <li>Try increasing grid to stress test</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default WebGLTestPage;
