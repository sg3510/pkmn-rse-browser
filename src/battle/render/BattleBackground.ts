/**
 * Load and render GBA battle backgrounds.
 *
 * C refs:
 * - public/pokeemerald/src/battle_bg.c (DrawMainBattleBackground, DrawBattleEntryBackground)
 * - public/pokeemerald/src/data/graphics/battle_environment.h
 *
 * Runtime layout (single battles):
 * - BG2 main layer: tiles.png + map.bin (64x32 tilemap)
 * - BG1 entry/overlay layer: anim_tiles.png + anim_map.bin (32x32 tilemap)
 */
import type { BattleWebGLContext } from './BattleWebGLContext';
import type { SpriteInstance } from '../../rendering/types';
import { BATTLE_WIDTH, BATTLE_HEIGHT } from './BattleWebGLContext';
import { loadBinaryAsset, loadImageCanvasAsset } from '../../utils/assetLoader';
import { decodeGbaBgTilemap, drawGbaBgTilemap } from '../../rendering/gbaTilemap';
import {
  BATTLE_ENVIRONMENT_BY_TERRAIN,
  type BattleTerrain,
} from '../../data/battleEnvironments.gen';

export type { BattleTerrain } from '../../data/battleEnvironments.gen';

const BG_ATLAS = 'battle_bg';

// battle_bg.c: BG2 uses screenSize=1 (64x32), BG1 entry layer uses 32x32.
const MAIN_MAP_WIDTH_TILES = 64;
const MAIN_MAP_HEIGHT_TILES = 32;
const ENTRY_MAP_WIDTH_TILES = 32;
const ENTRY_MAP_HEIGHT_TILES = 32;

const composedBackgroundCache = new Map<BattleTerrain, HTMLCanvasElement>();

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

async function composeBattleBackground(terrain: BattleTerrain): Promise<HTMLCanvasElement> {
  const canvas = createBattleCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = FALLBACK_COLORS[terrain];
  ctx.fillRect(0, 0, BATTLE_WIDTH, BATTLE_HEIGHT);

  const env = BATTLE_ENVIRONMENT_BY_TERRAIN[terrain];
  const tilesBasePath = `/pokeemerald/graphics/battle_environment/${env.tilesDir}`;
  const entryBasePath = `/pokeemerald/graphics/battle_environment/${env.entryDir}`;

  try {
    const [mainTilesCanvas, mainMapBuffer] = await Promise.all([
      loadImageCanvasAsset(`${tilesBasePath}/tiles.png`, { transparency: { type: 'none' } }),
      loadBinaryAsset(`${tilesBasePath}/map.bin`),
    ]);

    drawGbaBgTilemap(
      ctx,
      mainTilesCanvas,
      decodeGbaBgTilemap(mainMapBuffer),
      {
        mapWidthTiles: MAIN_MAP_WIDTH_TILES,
        mapHeightTiles: MAIN_MAP_HEIGHT_TILES,
        visibleWidthPx: BATTLE_WIDTH,
        visibleHeightPx: BATTLE_HEIGHT,
      },
    );
  } catch (error) {
    console.warn(`Failed to load main battle background for terrain '${terrain}':`, error);
    return canvas;
  }

  try {
    const [entryTilesCanvas, entryMapBuffer] = await Promise.all([
      loadImageCanvasAsset(`${entryBasePath}/anim_tiles.png`, { transparency: { type: 'none' } }),
      loadBinaryAsset(`${entryBasePath}/anim_map.bin`),
    ]);

    drawGbaBgTilemap(
      ctx,
      entryTilesCanvas,
      decodeGbaBgTilemap(entryMapBuffer),
      {
        mapWidthTiles: ENTRY_MAP_WIDTH_TILES,
        mapHeightTiles: ENTRY_MAP_HEIGHT_TILES,
        visibleWidthPx: BATTLE_WIDTH,
        visibleHeightPx: BATTLE_HEIGHT,
        transparency: { type: 'top-left' },
      },
    );
  } catch {
    // Anim layer is optional for some terrains.
  }

  return canvas;
}

async function getComposedBackground(terrain: BattleTerrain): Promise<HTMLCanvasElement> {
  const cached = composedBackgroundCache.get(terrain);
  if (cached) {
    return cloneCanvas(cached);
  }

  const composed = await composeBattleBackground(terrain);
  composedBackgroundCache.set(terrain, cloneCanvas(composed));
  return composed;
}

/**
 * Load and upload a battle background for the given terrain type.
 */
export async function loadBattleBackground(
  webgl: BattleWebGLContext,
  terrain: BattleTerrain = 'tall_grass',
): Promise<void> {
  if (webgl.hasSpriteSheet(BG_ATLAS)) {
    webgl.removeSpriteSheet(BG_ATLAS);
  }

  const backgroundCanvas = await getComposedBackground(terrain);
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
