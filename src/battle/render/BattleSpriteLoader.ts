/**
 * Load Pokemon sprites from pokeemerald graphics for battle rendering.
 *
 * Sprites are at:
 *   public/pokeemerald/graphics/pokemon/{species_name}/anim_front.png (preferred front animation source)
 *   public/pokeemerald/graphics/pokemon/{species_name}/front.png      (fallback front source)
 *   public/pokeemerald/graphics/pokemon/{species_name}/back.png   (64×64 frames; some sheets are stacked)
 *
 * C ref: src/data/pokemon_graphics/front_pic_table.h, back_pic_table.h
 */
import { getSpeciesName } from '../../data/species';
import { getPokemonSpriteCoords, type PokemonSpriteCoords } from '../../data/pokemonSpriteCoords.gen';
import { loadImageCanvasAsset, makeCanvasTransparent } from '../../utils/assetLoader';
import type { BattleWebGLContext } from './BattleWebGLContext';
import type { SpriteInstance } from '../../rendering/types';
import { BATTLE_LAYOUT } from './BattleLayout';

const MON_SPRITE_FRAME_WIDTH = 64;
const MON_SPRITE_FRAME_HEIGHT = 64;

interface BattlePokemonSpriteRuntimeMeta {
  frontFrameCount: number;
  backFrameCount: number;
}

const pokemonSpriteRuntimeMeta = new Map<number, BattlePokemonSpriteRuntimeMeta>();

/** Convert species ID to directory name (e.g., SPECIES 252 → "treecko"). */
function speciesIdToDirectoryName(speciesId: number): string {
  const name = getSpeciesName(speciesId);
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/** Atlas name conventions for battle sprites. */
export function frontSpriteAtlas(speciesId: number): string {
  return `battle_front_${speciesId}`;
}

export function backSpriteAtlas(speciesId: number): string {
  return `battle_back_${speciesId}`;
}

/**
 * Returns true when the image already contains an alpha channel.
 *
 * Many pokeemerald PNGs are authored with real alpha; in those cases we must
 * not apply top-left color keying, or pure-black outline pixels get erased.
 */
function hasTransparentPixels(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return false;
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true;
    }
  }
  return false;
}

function getMonSpriteFrameCount(
  canvas: HTMLCanvasElement,
  side: 'front' | 'back',
  speciesId: number,
  dirName: string,
): number {
  if (canvas.width !== MON_SPRITE_FRAME_WIDTH) {
    console.warn(
      `[BattleSpriteLoader] ${side} sprite for species ${speciesId} (${dirName}) `
      + `is ${canvas.width}px wide (expected ${MON_SPRITE_FRAME_WIDTH}px).`,
    );
  }

  if (canvas.height < MON_SPRITE_FRAME_HEIGHT) {
    console.warn(
      `[BattleSpriteLoader] ${side} sprite for species ${speciesId} (${dirName}) `
      + `is ${canvas.height}px tall (expected at least ${MON_SPRITE_FRAME_HEIGHT}px).`,
    );
    return 1;
  }

  if (canvas.height % MON_SPRITE_FRAME_HEIGHT !== 0) {
    console.warn(
      `[BattleSpriteLoader] ${side} sprite for species ${speciesId} (${dirName}) `
      + `has height ${canvas.height}px, which is not a multiple of ${MON_SPRITE_FRAME_HEIGHT}. `
      + 'Using first frame only.',
    );
    return 1;
  }

  const frameCount = Math.max(1, Math.floor(canvas.height / MON_SPRITE_FRAME_HEIGHT));
  if (side === 'front' && frameCount > 2) {
    console.warn(
      `[BattleSpriteLoader] front sprite for species ${speciesId} (${dirName}) `
      + `has ${frameCount} frames. Expected <= 2 for battle animation. `
      + 'Clamping to first frame to avoid malformed stacked-frame flicker.',
    );
    return 1;
  }
  return frameCount;
}

/** Load a sprite canvas with alpha-aware transparency fallback. */
async function loadSpriteCanvas(url: string): Promise<HTMLCanvasElement> {
  const canvas = await loadImageCanvasAsset(url);
  if (hasTransparentPixels(canvas)) {
    return canvas;
  }
  return makeCanvasTransparent(canvas, { type: 'top-left' });
}

async function loadFrontSpriteCanvas(basePath: string): Promise<HTMLCanvasElement> {
  try {
    return await loadSpriteCanvas(`${basePath}/anim_front.png`);
  } catch {
    return loadSpriteCanvas(`${basePath}/front.png`);
  }
}

function normalizeFrameIndex(frameIndex: number, frameCount: number): number {
  if (!Number.isFinite(frameIndex) || frameCount <= 0) {
    return 0;
  }
  const normalized = Math.trunc(frameIndex) % frameCount;
  return normalized < 0 ? normalized + frameCount : normalized;
}

export function getPokemonBattleFrontFrameCount(speciesId: number): number {
  return pokemonSpriteRuntimeMeta.get(speciesId)?.frontFrameCount ?? 1;
}

export function getPokemonBattleBackFrameCount(speciesId: number): number {
  return pokemonSpriteRuntimeMeta.get(speciesId)?.backFrameCount ?? 1;
}

/**
 * Load and upload a Pokemon's battle sprites (front + back) to the WebGL context.
 * Returns the sprite coordinates for positioning.
 */
export async function loadPokemonBattleSprites(
  webgl: BattleWebGLContext,
  speciesId: number,
): Promise<PokemonSpriteCoords | undefined> {
  const dirName = speciesIdToDirectoryName(speciesId);
  const basePath = `/pokeemerald/graphics/pokemon/${dirName}`;
  const coords = getPokemonSpriteCoords(speciesId);

  const frontAtlas = frontSpriteAtlas(speciesId);
  const backAtlas = backSpriteAtlas(speciesId);
  let frontFrameCount = getPokemonBattleFrontFrameCount(speciesId);
  let backFrameCount = getPokemonBattleBackFrameCount(speciesId);

  // Load front sprite if not already uploaded
  if (!webgl.hasSpriteSheet(frontAtlas)) {
    try {
      const frontCanvas = await loadFrontSpriteCanvas(basePath);
      frontFrameCount = getMonSpriteFrameCount(frontCanvas, 'front', speciesId, dirName);
      webgl.uploadSpriteSheet(frontAtlas, frontCanvas, {
        width: frontCanvas.width,
        height: frontCanvas.height,
        frameWidth: MON_SPRITE_FRAME_WIDTH,
        frameHeight: MON_SPRITE_FRAME_HEIGHT,
        frameCount: frontFrameCount,
      });
    } catch {
      console.warn(`Failed to load front sprite for species ${speciesId} (${dirName})`);
    }
  }

  // Load back sprite if not already uploaded
  if (!webgl.hasSpriteSheet(backAtlas)) {
    try {
      const backCanvas = await loadSpriteCanvas(`${basePath}/back.png`);
      backFrameCount = getMonSpriteFrameCount(backCanvas, 'back', speciesId, dirName);
      webgl.uploadSpriteSheet(backAtlas, backCanvas, {
        width: backCanvas.width,
        height: backCanvas.height,
        frameWidth: MON_SPRITE_FRAME_WIDTH,
        frameHeight: MON_SPRITE_FRAME_HEIGHT,
        frameCount: backFrameCount,
      });
    } catch {
      console.warn(`Failed to load back sprite for species ${speciesId} (${dirName})`);
    }
  }

  pokemonSpriteRuntimeMeta.set(speciesId, { frontFrameCount, backFrameCount });
  return coords;
}

/**
 * Create a SpriteInstance for a Pokemon's front sprite (enemy side).
 *
 * GBA layout: enemy Pokemon appears in the upper-right area.
 * Base position ~(144, 48), adjusted by species coordinates.
 */
export function createFrontSprite(
  speciesId: number,
  coords: PokemonSpriteCoords | undefined,
  frameIndex = 0,
): SpriteInstance {
  const atlas = frontSpriteAtlas(speciesId);
  const yOffset = coords?.frontYOffset ?? 0;
  const elevation = coords?.elevation ?? 0;
  const frameCount = getPokemonBattleFrontFrameCount(speciesId);
  const frameY = normalizeFrameIndex(frameIndex, frameCount) * MON_SPRITE_FRAME_HEIGHT;

  return {
    worldX: BATTLE_LAYOUT.enemy.spriteX,
    worldY: BATTLE_LAYOUT.enemy.spriteY + yOffset - elevation,
    width: MON_SPRITE_FRAME_WIDTH,
    height: MON_SPRITE_FRAME_HEIGHT,
    atlasName: atlas,
    atlasX: 0,
    atlasY: frameY,
    atlasWidth: MON_SPRITE_FRAME_WIDTH,
    atlasHeight: MON_SPRITE_FRAME_HEIGHT,
    flipX: false,
    flipY: false,
    alpha: 1,
    tintR: 1,
    tintG: 1,
    tintB: 1,
    sortKey: 10,
    isReflection: false,
  };
}

/**
 * Create a SpriteInstance for a Pokemon's back sprite (player side).
 *
 * GBA layout: player's Pokemon appears in the lower-left area.
 * Base position ~(40, 56), adjusted by species coordinates.
 */
export function createBackSprite(
  speciesId: number,
  coords: PokemonSpriteCoords | undefined,
  frameIndex = 0,
): SpriteInstance {
  const atlas = backSpriteAtlas(speciesId);
  const yOffset = coords?.backYOffset ?? 0;
  const frameCount = getPokemonBattleBackFrameCount(speciesId);
  const frameY = normalizeFrameIndex(frameIndex, frameCount) * MON_SPRITE_FRAME_HEIGHT;

  return {
    worldX: BATTLE_LAYOUT.player.spriteX,
    worldY: BATTLE_LAYOUT.player.spriteY + yOffset,
    width: MON_SPRITE_FRAME_WIDTH,
    height: MON_SPRITE_FRAME_HEIGHT,
    atlasName: atlas,
    atlasX: 0,
    atlasY: frameY,
    atlasWidth: MON_SPRITE_FRAME_WIDTH,
    atlasHeight: MON_SPRITE_FRAME_HEIGHT,
    flipX: false,
    flipY: false,
    alpha: 1,
    tintR: 1,
    tintG: 1,
    tintB: 1,
    sortKey: 20,
    isReflection: false,
  };
}

// --- Intro throw sprites (trainer back pic + Pokeball) ---

export type TrainerBackSpriteId = 'brendan' | 'may';

const TRAINER_BACK_ATLAS_PREFIX = 'battle_trainer_back_';
const POKEBALL_ATLAS = 'battle_pokeball_poke';
const ENEMY_SHADOW_ATLAS = 'battle_enemy_shadow';

export function getTrainerBackSpriteId(playerGender: 0 | 1): TrainerBackSpriteId {
  return playerGender === 1 ? 'may' : 'brendan';
}

function trainerBackAtlas(id: TrainerBackSpriteId): string {
  return `${TRAINER_BACK_ATLAS_PREFIX}${id}`;
}

export function pokeballAtlas(): string {
  return POKEBALL_ATLAS;
}

/**
 * Loads battle intro sprites:
 * - Trainer back pic (64x256, 4x 64x64 frames)
 * - Pokeball sprite sheet (16x48, 3x 16x16 frames)
 *
 * C refs:
 * - public/pokeemerald/src/battle_controller_player.c (trainer throw anim)
 * - public/pokeemerald/src/pokeball.c (player send-out ball)
 */
export async function loadBattleIntroSprites(
  webgl: BattleWebGLContext,
  playerGender: 0 | 1,
): Promise<void> {
  const trainerId = getTrainerBackSpriteId(playerGender);
  const trainerAtlas = trainerBackAtlas(trainerId);

  if (!webgl.hasSpriteSheet(trainerAtlas)) {
    const trainerCanvas = await loadSpriteCanvas(`/pokeemerald/graphics/trainers/back_pics/${trainerId}.png`);
    webgl.uploadSpriteSheet(trainerAtlas, trainerCanvas, {
      width: trainerCanvas.width,
      height: trainerCanvas.height,
      frameWidth: 64,
      frameHeight: 64,
      frameCount: Math.max(1, Math.floor(trainerCanvas.height / 64)),
    });
  }

  if (!webgl.hasSpriteSheet(POKEBALL_ATLAS)) {
    const ballCanvas = await loadSpriteCanvas('/pokeemerald/graphics/balls/poke.png');
    webgl.uploadSpriteSheet(POKEBALL_ATLAS, ballCanvas, {
      width: ballCanvas.width,
      height: ballCanvas.height,
      frameWidth: 16,
      frameHeight: 16,
      frameCount: Math.max(1, Math.floor(ballCanvas.height / 16)),
    });
  }
}

/**
 * Trainer back sprite instance for intro throw animation.
 * Frame index uses pokeemerald back-pic throw frames.
 */
export function createTrainerBackSprite(
  playerGender: 0 | 1,
  frameIndex: number,
  x: number,
  y: number,
  alpha = 1,
): SpriteInstance {
  const atlasName = trainerBackAtlas(getTrainerBackSpriteId(playerGender));
  const clampedFrame = Math.max(0, Math.min(3, frameIndex));

  return {
    worldX: Math.round(x),
    worldY: Math.round(y),
    width: 64,
    height: 64,
    atlasName,
    atlasX: 0,
    atlasY: clampedFrame * 64,
    atlasWidth: 64,
    atlasHeight: 64,
    flipX: false,
    flipY: false,
    alpha: Math.max(0, Math.min(1, alpha)),
    tintR: 1,
    tintG: 1,
    tintB: 1,
    sortKey: 18,
    isReflection: false,
  };
}

/**
 * Pokeball sprite instance for send-out arc and release.
 * Frame index 0/1/2 maps to poke/great/safari style sequence on poke.png.
 */
export function createPokeballSprite(
  x: number,
  y: number,
  frameIndex: number,
  alpha = 1,
): SpriteInstance {
  const clampedFrame = Math.max(0, Math.min(2, frameIndex));

  return {
    worldX: Math.round(x),
    worldY: Math.round(y),
    width: 16,
    height: 16,
    atlasName: POKEBALL_ATLAS,
    atlasX: 0,
    atlasY: clampedFrame * 16,
    atlasWidth: 16,
    atlasHeight: 16,
    flipX: false,
    flipY: false,
    alpha: Math.max(0, Math.min(1, alpha)),
    tintR: 1,
    tintG: 1,
    tintB: 1,
    sortKey: 22,
    isReflection: false,
  };
}


/**
 * Loads miscellaneous battle sprites used in the scene (non-mon, non-trainer).
 *
 * C ref: public/pokeemerald/src/battle_gfx_sfx_util.c (LoadAndCreateEnemyShadowSprites)
 */
export async function loadBattleMiscSprites(
  webgl: BattleWebGLContext,
): Promise<void> {
  if (!webgl.hasSpriteSheet(ENEMY_SHADOW_ATLAS)) {
    const shadowCanvas = await loadSpriteCanvas('/pokeemerald/graphics/battle_interface/enemy_mon_shadow.png');
    webgl.uploadSpriteSheet(ENEMY_SHADOW_ATLAS, shadowCanvas, {
      width: shadowCanvas.width,
      height: shadowCanvas.height,
    });
  }
}

/**
 * Enemy shadow sprite. In pokeemerald this is only visible for species with
 * non-zero enemy elevation.
 */
export function createEnemyShadowSprite(
  x: number,
  y: number,
  alpha = 0.8,
): SpriteInstance {
  return {
    worldX: Math.round(x),
    worldY: Math.round(y),
    width: 32,
    height: 8,
    atlasName: ENEMY_SHADOW_ATLAS,
    atlasX: 0,
    atlasY: 0,
    atlasWidth: 32,
    atlasHeight: 8,
    flipX: false,
    flipY: false,
    alpha: Math.max(0, Math.min(1, alpha)),
    tintR: 1,
    tintG: 1,
    tintB: 1,
    sortKey: 9,
    isReflection: false,
  };
}
