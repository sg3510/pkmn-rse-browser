/**
 * Load Pokemon sprites from pokeemerald graphics for battle rendering.
 *
 * Sprites are at:
 *   public/pokeemerald/graphics/pokemon/{species_name}/front.png  (64×64)
 *   public/pokeemerald/graphics/pokemon/{species_name}/back.png   (64×64)
 *
 * C ref: src/data/pokemon_graphics/front_pic_table.h, back_pic_table.h
 */
import { getSpeciesName } from '../../data/species';
import { getPokemonSpriteCoords, type PokemonSpriteCoords } from '../../data/pokemonSpriteCoords.gen';
import { loadImageCanvasAsset } from '../../utils/assetLoader';
import type { BattleWebGLContext } from './BattleWebGLContext';
import type { SpriteInstance } from '../../rendering/types';

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

/** Load an image from a URL, returning an HTMLImageElement. */
async function loadSpriteCanvas(url: string): Promise<HTMLCanvasElement> {
  return loadImageCanvasAsset(url, { transparency: { type: 'top-left' } });
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

  // Load front sprite if not already uploaded
  if (!webgl.hasSpriteSheet(frontAtlas)) {
    try {
      const frontCanvas = await loadSpriteCanvas(`${basePath}/front.png`);
      webgl.uploadSpriteSheet(frontAtlas, frontCanvas, {
        width: frontCanvas.width,
        height: frontCanvas.height,
      });
    } catch {
      console.warn(`Failed to load front sprite for species ${speciesId} (${dirName})`);
    }
  }

  // Load back sprite if not already uploaded
  if (!webgl.hasSpriteSheet(backAtlas)) {
    try {
      const backCanvas = await loadSpriteCanvas(`${basePath}/back.png`);
      webgl.uploadSpriteSheet(backAtlas, backCanvas, {
        width: backCanvas.width,
        height: backCanvas.height,
      });
    } catch {
      console.warn(`Failed to load back sprite for species ${speciesId} (${dirName})`);
    }
  }

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
): SpriteInstance {
  const atlas = frontSpriteAtlas(speciesId);
  const yOffset = coords?.frontYOffset ?? 0;
  const elevation = coords?.elevation ?? 0;

  return {
    worldX: 144,
    worldY: 16 + yOffset - elevation,
    width: 64,
    height: 64,
    atlasName: atlas,
    atlasX: 0,
    atlasY: 0,
    atlasWidth: 64,
    atlasHeight: 64,
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
): SpriteInstance {
  const atlas = backSpriteAtlas(speciesId);
  const yOffset = coords?.backYOffset ?? 0;

  return {
    worldX: 40,
    worldY: 56 + yOffset,
    width: 64,
    height: 64,
    atlasName: atlas,
    atlasX: 0,
    atlasY: 0,
    atlasWidth: 64,
    atlasHeight: 64,
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
