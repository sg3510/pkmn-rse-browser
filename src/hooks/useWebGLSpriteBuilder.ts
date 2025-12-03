/**
 * useWebGLSpriteBuilder - Builds sprite instances for WebGL rendering
 *
 * Extracts the sprite building logic from WebGLMapPage's render loop.
 * This includes:
 * - Player sprite and reflection
 * - NPC sprites and reflections
 * - Field effects (grass, sand, water effects)
 * - Door animation sprites
 * - Arrow overlay sprite
 *
 * Returns sorted sprite batches ready for rendering.
 */

import { useCallback } from 'react';
import type { SpriteInstance } from '../rendering/types';
import type { PlayerController } from '../game/PlayerController';
import type { WebGLSpriteRenderer } from '../rendering/webgl/WebGLSpriteRenderer';
import type { WorldSnapshot } from '../game/WorldManager';
import type { UseDoorAnimationsReturn } from './useDoorAnimations';
import type { UseArrowOverlayReturn } from './useArrowOverlay';
import type { UseDoorSequencerReturn } from './useDoorSequencer';
import type { NPCObject } from '../types/objectEvents';
import type { TilesetRuntime as TilesetRuntimeType } from '../utils/tilesetUtils';
import type { FieldEffectForRendering } from '../game/FieldEffectManager';
import type { SortableSpriteInfo } from '../rendering/SpriteBatcher';
import type { ReflectionState } from '../components/map/types';

import {
  createSpriteFromFrameInfo,
  createFieldEffectSprite,
  createPlayerReflectionSprite,
  createPlayerShadowSprite,
  createNPCSpriteInstance,
  createNPCReflectionSprite,
  createNPCGrassEffectSprite,
  createDoorAnimationSprite,
  calculateSortKey,
  getPlayerAtlasName,
  getDoorAtlasName,
  ARROW_ATLAS_NAME,
} from '../rendering/spriteUtils';
import {
  ARROW_FRAME_SIZE,
  getArrowAnimationFrame,
  getArrowAtlasCoords,
} from '../field/ArrowAnimationConstants';
import { METATILE_SIZE } from '../utils/mapLoader';
import { getPlayerCenterY } from '../game/playerCoords';
import { buildSpriteBatches } from '../rendering/SpriteBatcher';
import { getReflectionMetaFromSnapshot } from '../game/snapshotUtils';
import { isLongGrassBehavior } from '../utils/metatileBehaviors';

// =============================================================================
// Types
// =============================================================================

export interface SpriteBuildContext {
  player: PlayerController;
  playerLoaded: boolean;
  playerHidden: boolean;
  snapshot: WorldSnapshot | null;
  tilesetRuntimes: Map<string, TilesetRuntimeType>;
  npcs: NPCObject[];
  fieldEffects: FieldEffectForRendering[];
  spriteRenderer: WebGLSpriteRenderer;
  doorAnimations: UseDoorAnimationsReturn;
  arrowOverlay: UseArrowOverlayReturn;
  doorSequencer: UseDoorSequencerReturn;
  doorSpritesUploaded: Set<string>;
  arrowSpriteUploaded: boolean;
  nowTime: number;
  computeReflectionState: (
    snapshot: WorldSnapshot,
    destX: number,
    destY: number,
    originX: number,
    originY: number,
    width: number,
    height: number
  ) => ReflectionState;
}

export interface SpriteBuildResult {
  /** Low priority sprites (P2/P3 NPCs behind bridges) */
  lowPrioritySprites: SpriteInstance[];
  /** Main sprites (P1 player + NPCs + field effects) */
  allSprites: SpriteInstance[];
  /** High priority sprites (P0 NPCs above everything) */
  priority0Sprites: SpriteInstance[];
  /** Door animation sprites */
  doorSprites: SpriteInstance[];
  /** Arrow overlay sprite (if visible) */
  arrowSprite: SpriteInstance | null;
  /** Player world Y for layer calculations */
  playerWorldY: number;
  /** Whether any new door sprites were uploaded */
  newDoorSpritesUploaded: string[];
  /** Whether arrow sprite was uploaded */
  arrowSpriteWasUploaded: boolean;
}

// =============================================================================
// Hook
// =============================================================================

export interface UseWebGLSpriteBuilderReturn {
  buildSprites: (ctx: SpriteBuildContext) => SpriteBuildResult;
}

export function useWebGLSpriteBuilder(): UseWebGLSpriteBuilderReturn {
  const buildSprites = useCallback((ctx: SpriteBuildContext): SpriteBuildResult => {
    const {
      player,
      playerLoaded,
      playerHidden,
      snapshot,
      tilesetRuntimes,
      npcs,
      fieldEffects,
      spriteRenderer,
      doorAnimations,
      arrowOverlay,
      doorSequencer,
      doorSpritesUploaded,
      arrowSpriteUploaded,
      nowTime,
      computeReflectionState,
    } = ctx;

    const lowPrioritySprites: SpriteInstance[] = [];
    const allSprites: SpriteInstance[] = [];
    const priority0Sprites: SpriteInstance[] = [];
    const doorSprites: SpriteInstance[] = [];
    let arrowSprite: SpriteInstance | null = null;
    const newDoorSpritesUploaded: string[] = [];
    let arrowSpriteWasUploaded = false;

    const playerWorldY = playerLoaded ? getPlayerCenterY(player) : 0;

    // === Build door animation sprites ===
    const doorAnims = doorAnimations.getAnimations();
    for (const anim of doorAnims) {
      const atlasName = getDoorAtlasName(anim.metatileId);
      if (!doorSpritesUploaded.has(atlasName)) {
        const spriteData = doorAnimations.getSpriteForUpload(anim.metatileId);
        if (spriteData) {
          const canvas = document.createElement('canvas');
          canvas.width = spriteData.width;
          canvas.height = spriteData.height;
          const canvasCtx = canvas.getContext('2d');
          if (canvasCtx) {
            canvasCtx.drawImage(spriteData.image, 0, 0);
            spriteRenderer.uploadSpriteSheet(atlasName, canvas, {
              frameWidth: spriteData.width,
              frameHeight: 32,
            });
            newDoorSpritesUploaded.push(atlasName);
          }
        }
      }

      if (spriteRenderer.hasSpriteSheet(atlasName)) {
        const spriteData = doorAnimations.getSpriteForUpload(anim.metatileId);
        if (spriteData) {
          const doorSprite = createDoorAnimationSprite(
            anim,
            nowTime,
            spriteData.width,
            spriteData.height
          );
          if (doorSprite) {
            doorSprites.push(doorSprite);
          }
        }
      }
    }

    // === Build arrow overlay sprite ===
    if (arrowOverlay.isVisible() && !doorSequencer.isActive()) {
      if (!arrowSpriteUploaded) {
        const arrowData = arrowOverlay.getSpriteForUpload();
        if (arrowData) {
          spriteRenderer.uploadSpriteSheet(ARROW_ATLAS_NAME, arrowData.canvas, {
            frameWidth: 16,
            frameHeight: 16,
          });
          arrowSpriteWasUploaded = true;
        }
      }

      const arrowState = arrowOverlay.getState();
      if (arrowState && spriteRenderer.hasSpriteSheet(ARROW_ATLAS_NAME)) {
        const arrowData = arrowOverlay.getSpriteForUpload();
        if (arrowData) {
          const framesPerRow = Math.max(1, Math.floor(arrowData.width / ARROW_FRAME_SIZE));
          const elapsed = nowTime - arrowState.startedAt;
          const frameIndex = getArrowAnimationFrame(arrowState.direction, elapsed);
          const { atlasX, atlasY } = getArrowAtlasCoords(frameIndex, framesPerRow);

          arrowSprite = {
            worldX: arrowState.worldX * METATILE_SIZE,
            worldY: arrowState.worldY * METATILE_SIZE,
            width: ARROW_FRAME_SIZE,
            height: ARROW_FRAME_SIZE,
            atlasName: ARROW_ATLAS_NAME,
            atlasX,
            atlasY,
            atlasWidth: ARROW_FRAME_SIZE,
            atlasHeight: ARROW_FRAME_SIZE,
            flipX: false,
            flipY: false,
            alpha: 1.0,
            tintR: 1.0,
            tintG: 1.0,
            tintB: 1.0,
            sortKey: calculateSortKey(arrowState.worldY * METATILE_SIZE, 1),
            isReflection: false,
          };
        }
      }
    }

    // === Use SpriteBatcher for unified sprite sorting ===
    const spriteBatches = buildSpriteBatches(player, npcs, fieldEffects, {
      includePlayerShadow: player.showShadow,
      playerHidden,
    });

    // Helper to create NPC sprite with reflections and grass effects
    const createNPCWithExtras = (
      info: SortableSpriteInfo,
      targetArray: SpriteInstance[]
    ) => {
      const npc = info.npc!;
      const atlasName = `npc-${npc.graphicsId}`;
      if (!spriteRenderer.hasSpriteSheet(atlasName)) return;

      const tileMeta = snapshot
        ? getReflectionMetaFromSnapshot(snapshot, tilesetRuntimes, npc.tileX, npc.tileY)
        : null;

      const isOnLongGrass = tileMeta ? isLongGrassBehavior(tileMeta.behavior) : false;
      const npcSprite = createNPCSpriteInstance(npc, info.sortKey, isOnLongGrass);
      if (!npcSprite) return;

      targetArray.push(npcSprite);

      // Add reflection (not for P0 sprites)
      if (snapshot && targetArray !== priority0Sprites) {
        const npcReflectionState = computeReflectionState(
          snapshot,
          npc.tileX,
          npc.tileY,
          npc.tileX,
          npc.tileY,
          npcSprite.width,
          npcSprite.height
        );
        const npcReflection = createNPCReflectionSprite(
          npcSprite,
          npcReflectionState,
          npc.direction
        );
        if (npcReflection) targetArray.push(npcReflection);

        // Add grass effect if on tall grass (not long grass)
        if (tileMeta && !isOnLongGrass) {
          const grassSprite = createNPCGrassEffectSprite(npc, tileMeta.behavior, info.sortKey);
          if (grassSprite) targetArray.push(grassSprite);
        }
      }
    };

    // Process low priority batch (P2/P3 NPCs)
    for (const info of spriteBatches.lowPriority) {
      if (info.type === 'npc') {
        createNPCWithExtras(info, lowPrioritySprites);
      }
    }

    // Process Y-sorted batch (player, NPCs, field effects)
    for (const info of spriteBatches.ySorted) {
      if (info.type === 'player' && info.player) {
        const frameInfo = info.player.getFrameInfo();
        if (!frameInfo) continue;

        const spriteKey = info.player.getCurrentSpriteKey();
        const atlasName = getPlayerAtlasName(spriteKey);
        if (!spriteRenderer.hasSpriteSheet(atlasName)) continue;

        const clipToHalf = info.player.isOnLongGrass();
        const playerSprite = createSpriteFromFrameInfo(frameInfo, atlasName, info.sortKey, clipToHalf);
        allSprites.push(playerSprite);

        // Add player reflection
        if (snapshot) {
          const { width: spriteWidth, height: spriteHeight } = info.player.getSpriteSize();
          const destTile = info.player.getDestinationTile();
          const reflectionState = computeReflectionState(
            snapshot,
            destTile.x,
            destTile.y,
            info.player.tileX,
            info.player.tileY,
            spriteWidth,
            spriteHeight
          );
          const reflectionSprite = createPlayerReflectionSprite(
            playerSprite,
            reflectionState,
            info.player.dir
          );
          if (reflectionSprite) allSprites.push(reflectionSprite);
        }
      } else if (info.type === 'playerShadow' && info.player) {
        const shadowAtlas = getPlayerAtlasName('shadow');
        if (spriteRenderer.hasSpriteSheet(shadowAtlas)) {
          const shadowSprite = createPlayerShadowSprite(info.player.x, info.player.y, info.sortKey);
          allSprites.push(shadowSprite);
        }
      } else if (info.type === 'npc') {
        createNPCWithExtras(info, allSprites);
      } else if (info.type === 'fieldEffect' && info.fieldEffect) {
        const layer = info.effectLayer === 'front' ? 'top' : 'bottom';
        const sprite = createFieldEffectSprite(info.fieldEffect, playerWorldY, layer);
        if (sprite) {
          sprite.sortKey = info.sortKey;
          allSprites.push(sprite);
        }
      }
    }

    // Process high priority batch (P0 NPCs)
    for (const info of spriteBatches.highPriority) {
      if (info.type === 'npc') {
        createNPCWithExtras(info, priority0Sprites);
      }
    }

    // Sort all sprites by sortKey
    allSprites.sort((a, b) => a.sortKey - b.sortKey);

    return {
      lowPrioritySprites,
      allSprites,
      priority0Sprites,
      doorSprites,
      arrowSprite,
      playerWorldY,
      newDoorSpritesUploaded,
      arrowSpriteWasUploaded,
    };
  }, []);

  return { buildSprites };
}
