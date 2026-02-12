/**
 * Load and render GBA battle backgrounds.
 *
 * C refs:
 * - public/pokeemerald/src/battle_bg.c (DrawMainBattleBackground, DrawBattleEntryBackground)
 * - public/pokeemerald/src/data/graphics/battle_environment.h
 *
 * Runtime layout (single battles):
 * - BG2 main layer: tiles + map.bin (64x32 tilemap, screenblock layout)
 * - BG1 entry/overlay layer: anim_tiles + anim_map.bin (32x32 tilemap)
 */
import type { BattleWebGLContext } from './BattleWebGLContext';
import type { SpriteInstance } from '../../rendering/types';
import { BATTLE_WIDTH, BATTLE_HEIGHT } from './BattleWebGLContext';
import { loadBinaryAsset, loadTextAsset } from '../../utils/assetLoader';
import {
  decodeGbaBgTilemap,
  drawGbaBgTilemap,
  type IndexedGbaTilesetSource,
} from '../../rendering/gbaTilemap';
import { loadTilesetImage, parsePalette, type Palette, type TilesetImageData } from '../../utils/mapLoader';
import {
  BATTLE_ENVIRONMENT_BY_TERRAIN,
  type BattleTerrain,
} from '../../data/battleEnvironments.gen';

export type { BattleTerrain } from '../../data/battleEnvironments.gen';

export type BattleBackgroundVariant = 'default' | 'kyogre' | 'groudon' | 'rayquaza';

export interface BattleBackgroundProfile {
  terrain: BattleTerrain;
  variant?: BattleBackgroundVariant;
}

const BG_ATLAS = 'battle_bg';
const BATTLE_BG_ROOT = '/pokeemerald/graphics/battle_environment';
const BATTLE_PALETTE_BANK_OFFSET = 2;

// battle_bg.c: BG2 uses screenSize=1 (64x32), BG1 entry layer uses 32x32.
const MAIN_MAP_WIDTH_TILES = 64;
const MAIN_MAP_HEIGHT_TILES = 32;
const ENTRY_MAP_WIDTH_TILES = 32;
const ENTRY_MAP_HEIGHT_TILES = 32;

const composedBackgroundCache = new Map<string, HTMLCanvasElement>();

const FALLBACK_COLORS: Record<BattleTerrain, string> = {
  tall_grass: '#88c070',
  long_grass: '#70a860',
  sand: '#d8c878',
  underwater: '#4880a8',
  water: '#5890b8',
  pond_water: '#68a0c0',
  rock: '#a89878',
  cave: '#786858',
  building: '#c0b8a0',
  plain: '#a8d878',
};

interface BattleBackgroundAssets {
  mainDir: string;
  entryDir: string;
  palettePath: string;
}

const SPECIAL_VARIANT_ASSETS: Record<Exclude<BattleBackgroundVariant, 'default'>, BattleBackgroundAssets> = {
  kyogre: {
    mainDir: 'water',
    entryDir: 'underwater',
    palettePath: `${BATTLE_BG_ROOT}/water/kyogre.pal`,
  },
  groudon: {
    mainDir: 'cave',
    entryDir: 'cave',
    palettePath: `${BATTLE_BG_ROOT}/cave/groudon.pal`,
  },
  rayquaza: {
    mainDir: 'sky',
    entryDir: 'sky',
    palettePath: `${BATTLE_BG_ROOT}/sky/palette.pal`,
  },
};

function createBattleCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = BATTLE_WIDTH;
  canvas.height = BATTLE_HEIGHT;
  return canvas;
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = createBattleCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  return canvas;
}

function normalizeProfile(profile: BattleBackgroundProfile): Required<BattleBackgroundProfile> {
  return {
    terrain: profile.terrain,
    variant: profile.variant ?? 'default',
  };
}

function profileCacheKey(profile: Required<BattleBackgroundProfile>): string {
  return `${profile.terrain}:${profile.variant}`;
}

function resolveAssets(profile: Required<BattleBackgroundProfile>): BattleBackgroundAssets {
  if (profile.variant !== 'default') {
    return SPECIAL_VARIANT_ASSETS[profile.variant];
  }

  const env = BATTLE_ENVIRONMENT_BY_TERRAIN[profile.terrain];
  return {
    mainDir: env.tilesDir,
    entryDir: env.entryDir,
    palettePath: `${BATTLE_BG_ROOT}/${env.paletteDir}/palette.pal`,
  };
}

function splitPaletteBanks(palette: Palette): string[][] {
  const banks: string[][] = [];
  for (let i = 0; i < palette.colors.length; i += 16) {
    const bank = palette.colors.slice(i, i + 16);
    while (bank.length < 16) {
      bank.push('#000000');
    }
    banks.push(bank);
  }
  if (banks.length === 0) {
    banks.push(new Array<string>(16).fill('#000000'));
  }
  return banks;
}

function toIndexedTilesetSource(tileset: TilesetImageData): IndexedGbaTilesetSource {
  return {
    kind: 'indexed',
    pixels: tileset.data,
    width: tileset.width,
    height: tileset.height,
  };
}

async function composeBattleBackground(profile: Required<BattleBackgroundProfile>): Promise<HTMLCanvasElement> {
  const canvas = createBattleCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = FALLBACK_COLORS[profile.terrain];
  ctx.fillRect(0, 0, BATTLE_WIDTH, BATTLE_HEIGHT);

  const assets = resolveAssets(profile);
  const mainBasePath = `${BATTLE_BG_ROOT}/${assets.mainDir}`;
  const entryBasePath = `${BATTLE_BG_ROOT}/${assets.entryDir}`;

  let paletteBanks: string[][];

  try {
    const [mainTiles, mainMapBuffer, paletteText] = await Promise.all([
      loadTilesetImage(`${mainBasePath}/tiles.png`, true),
      loadBinaryAsset(`${mainBasePath}/map.bin`),
      loadTextAsset(assets.palettePath),
    ]);

    paletteBanks = splitPaletteBanks(parsePalette(paletteText));

    drawGbaBgTilemap(
      ctx,
      toIndexedTilesetSource(mainTiles),
      decodeGbaBgTilemap(mainMapBuffer),
      {
        mapWidthTiles: MAIN_MAP_WIDTH_TILES,
        mapHeightTiles: MAIN_MAP_HEIGHT_TILES,
        visibleWidthPx: BATTLE_WIDTH,
        visibleHeightPx: BATTLE_HEIGHT,
        layoutMode: 'screenblock',
        skipZeroEntries: true,
        paletteBanks,
        paletteBankOffset: BATTLE_PALETTE_BANK_OFFSET,
      },
    );
  } catch (error) {
    console.warn(
      `Failed to load main battle background for terrain '${profile.terrain}' variant '${profile.variant}':`,
      error,
    );
    return canvas;
  }

  try {
    const [entryTiles, entryMapBuffer] = await Promise.all([
      loadTilesetImage(`${entryBasePath}/anim_tiles.png`, true),
      loadBinaryAsset(`${entryBasePath}/anim_map.bin`),
    ]);

    drawGbaBgTilemap(
      ctx,
      toIndexedTilesetSource(entryTiles),
      decodeGbaBgTilemap(entryMapBuffer),
      {
        mapWidthTiles: ENTRY_MAP_WIDTH_TILES,
        mapHeightTiles: ENTRY_MAP_HEIGHT_TILES,
        visibleWidthPx: BATTLE_WIDTH,
        visibleHeightPx: BATTLE_HEIGHT,
        layoutMode: 'screenblock',
        skipZeroEntries: true,
        paletteBanks,
        paletteBankOffset: BATTLE_PALETTE_BANK_OFFSET,
        transparentColorIndexZero: true,
      },
    );
  } catch {
    // Anim layer is optional for some terrains.
  }

  return canvas;
}

async function getComposedBackground(profile: Required<BattleBackgroundProfile>): Promise<HTMLCanvasElement> {
  const cacheKey = profileCacheKey(profile);
  const cached = composedBackgroundCache.get(cacheKey);
  if (cached) {
    return cloneCanvas(cached);
  }

  const composed = await composeBattleBackground(profile);
  composedBackgroundCache.set(cacheKey, cloneCanvas(composed));
  return composed;
}

/**
 * Load and upload a battle background for the given background profile.
 */
export async function loadBattleBackground(
  webgl: BattleWebGLContext,
  profile: BattleBackgroundProfile = { terrain: 'tall_grass', variant: 'default' },
): Promise<void> {
  if (webgl.hasSpriteSheet(BG_ATLAS)) {
    webgl.removeSpriteSheet(BG_ATLAS);
  }

  const normalizedProfile = normalizeProfile(profile);
  const backgroundCanvas = await getComposedBackground(normalizedProfile);
  webgl.uploadSpriteSheet(BG_ATLAS, backgroundCanvas, {
    width: BATTLE_WIDTH,
    height: BATTLE_HEIGHT,
  });
}

/** Create the background sprite instance (covers full battle area). */
export function createBackgroundSprite(): SpriteInstance {
  return {
    worldX: 0,
    worldY: 0,
    width: BATTLE_WIDTH,
    height: BATTLE_HEIGHT,
    atlasName: BG_ATLAS,
    atlasX: 0,
    atlasY: 0,
    atlasWidth: BATTLE_WIDTH,
    atlasHeight: BATTLE_HEIGHT,
    flipX: false,
    flipY: false,
    alpha: 1,
    tintR: 1,
    tintG: 1,
    tintB: 1,
    sortKey: 0,
    isReflection: false,
  };
}
