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
import type { NPCObject, ItemBallObject, ScriptObject, LargeObject } from '../types/objectEvents';
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
  createNPCShadowSprite,
  createNPCReflectionSprite,
  createDoorAnimationSprite,
  createItemBallSpriteInstance,
  createScriptObjectSpriteInstance,
  createLargeObjectSpriteInstance,
  getNPCAtlasName,
  getLargeObjectAtlasName,
  calculateSortKey,
  getPlayerAtlasName,
  getDoorAtlasName,
  ARROW_ATLAS_NAME,
  ITEM_BALL_ATLAS_NAME,
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
import { npcAnimationManager, shouldAnimate } from '../game/npc/NPCAnimationEngine';
import { objectEventAffineManager } from '../game/npc/ObjectEventAffineManager';
import { getNPCFrameInfo } from '../game/npc/NPCSpriteLoader';

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
  items: ItemBallObject[];
  scriptObjects: ScriptObject[];
  largeObjects: LargeObject[];
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
  /** Surf blob sprite (rendered behind player when surfing) */
  surfBlobSprite: SpriteInstance | null;
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
      items,
      scriptObjects,
      largeObjects,
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
    let surfBlobSprite: SpriteInstance | null = null;
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

    // === Build surf blob sprite (if surfing or mounting/dismounting) ===
    if (playerLoaded && !playerHidden && spriteRenderer.hasSpriteSheet('surf-blob')) {
      const surfCtrl = player.getSurfingController();
      const shouldRenderBlob = !player.isUnderwater() && (player.isSurfing() || surfCtrl.isJumping());

      if (shouldRenderBlob) {
        const blobRenderer = surfCtrl.getBlobRenderer();
        const bobOffset = blobRenderer.getBobOffset();

        // Determine blob position based on current animation phase
        let blobWorldX: number;
        let blobWorldY: number;

        if (surfCtrl.isJumpingOn()) {
          // MOUNTING: Blob is at target water tile (destination)
          const targetPos = surfCtrl.getTargetPosition();
          if (targetPos) {
            blobWorldX = targetPos.tileX * METATILE_SIZE - 8;
            blobWorldY = targetPos.tileY * METATILE_SIZE - 16 + bobOffset + 8;
          } else {
            blobWorldX = player.x - 8;
            blobWorldY = player.y + bobOffset + 8;
          }
        } else if (surfCtrl.isJumpingOff()) {
          // DISMOUNTING: Blob stays at fixed water tile position
          const fixedPos = surfCtrl.getBlobFixedPosition();
          if (fixedPos) {
            blobWorldX = fixedPos.tileX * METATILE_SIZE - 8;
            blobWorldY = fixedPos.tileY * METATILE_SIZE - 16 + bobOffset + 8;
          } else {
            blobWorldX = player.x - 8;
            blobWorldY = player.y + bobOffset + 8;
          }
        } else {
          // Normal surfing: Blob follows player
          blobWorldX = player.x - 8;
          blobWorldY = player.y + bobOffset + 8;
        }

        // Get frame based on direction
        // Frame 0: down/up, Frame 1: left, Frame 1 (flipped): right
        const dir = player.dir;
        let atlasX = 0;
        let flipX = false;
        if (dir === 'left') {
          atlasX = 32;
        } else if (dir === 'right') {
          atlasX = 32;
          flipX = true;
        }

        // Blob renders behind player, so use slightly lower sortKey
        const blobSortKey = calculateSortKey(blobWorldY, 0) - 1;

        surfBlobSprite = {
          worldX: blobWorldX,
          worldY: blobWorldY,
          width: 32,
          height: 32,
          atlasName: 'surf-blob',
          atlasX,
          atlasY: 0,
          atlasWidth: 32,
          atlasHeight: 32,
          flipX,
          flipY: false,
          alpha: 1.0,
          tintR: 1.0,
          tintG: 1.0,
          tintB: 1.0,
          sortKey: blobSortKey,
          isReflection: false,
        };
      }
    }

    // === Use SpriteBatcher for unified sprite sorting ===
    const spriteBatches = buildSpriteBatches(player, npcs, fieldEffects, {
      includePlayerShadow: player.showShadow,
      playerHidden,
    }, items);

    // Helper to create NPC sprite with reflections and grass effects
    const createNPCWithExtras = (
      info: SortableSpriteInfo,
      targetArray: SpriteInstance[]
    ) => {
      const npc = info.npc!;
      const atlasName = `npc-${npc.graphicsId}`;
      if (!spriteRenderer.hasSpriteSheet(atlasName)) return;

      // Calculate visual tile position for grass effects
      // During walking: tileX/tileY is DESTINATION, but grass should be at SOURCE
      let visualTileX = npc.tileX;
      let visualTileY = npc.tileY;

      if (npc.isWalking) {
        const subTileX = npc.subTileX ?? 0;
        const subTileY = npc.subTileY ?? 0;

        // subTile is negative during walk (e.g., -16 to 0)
        // Determine source tile based on sub-tile offset direction
        if (subTileX < -8) visualTileX = npc.tileX - 1;
        else if (subTileX > 8) visualTileX = npc.tileX + 1;

        if (subTileY < -8) visualTileY = npc.tileY - 1;
        else if (subTileY > 8) visualTileY = npc.tileY + 1;
      }

      // Get tile meta at visual position (for grass checks)
      const visualTileMeta = snapshot
        ? getReflectionMetaFromSnapshot(snapshot, tilesetRuntimes, visualTileX, visualTileY)
        : null;

      const isOnLongGrass = visualTileMeta ? isLongGrassBehavior(visualTileMeta.behavior) : false;
      let frameOverride: { frameIndex: number; flipHorizontal: boolean } | undefined;
      if (shouldAnimate(npc.graphicsId)) {
        npcAnimationManager.getState(npc.id, npc.graphicsId, npc.direction, npc.isWalking);
        const frameInfo = npcAnimationManager.getFrameInfo(npc.id);
        if (frameInfo) {
          frameOverride = {
            frameIndex: frameInfo.frameIndex,
            flipHorizontal: frameInfo.hFlip,
          };
        }
      }
      if (!frameOverride) {
        const walkFrame = npc.isWalking ? Math.floor(nowTime / 120) % 2 : 0;
        const fallbackFrame = getNPCFrameInfo(
          npc.direction,
          npc.isWalking,
          walkFrame,
          npc.graphicsId
        );
        frameOverride = {
          frameIndex: fallbackFrame.frameIndex,
          flipHorizontal: fallbackFrame.flipHorizontal,
        };
      }

      const affineTransform = objectEventAffineManager.getRenderTransform(npc.id);
      const npcSprite = createNPCSpriteInstance(
        npc,
        info.sortKey,
        isOnLongGrass && !npc.renderAboveGrass,
        frameOverride,
        affineTransform
      );
      if (!npcSprite) return;

      npcSprite.tintR = npc.tintR ?? 1.0;
      npcSprite.tintG = npc.tintG ?? 1.0;
      npcSprite.tintB = npc.tintB ?? 1.0;

      targetArray.push(npcSprite);

      // Add shadow for jumping NPCs
      if (npc.showShadow && spriteRenderer.hasSpriteSheet(getPlayerAtlasName('shadow'))) {
        const shadowSprite = createNPCShadowSprite(npc, info.sortKey);
        targetArray.push(shadowSprite);
      }

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

        // NPC grass effects are now handled by the shared FieldEffectManager
        // (same system as player grass effects - animates properly and uses correct priority)
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

        const atlasName = getPlayerAtlasName(frameInfo.spriteKey);
        if (!spriteRenderer.hasSpriteSheet(atlasName)) continue;

        const clipToHalf = info.player.isOnLongGrass();
        const playerSprite = createSpriteFromFrameInfo(frameInfo, info.sortKey, clipToHalf);

        // Note: Bob offset for surfing is already applied in SurfingState.getFrameInfo()
        // (see PlayerController.ts line 304-305), so we don't apply it here

        allSprites.push(playerSprite);

        // Add player reflection
        if (snapshot) {
          const spriteWidth = frameInfo.sw;
          const spriteHeight = frameInfo.sh;
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
        // Pass pre-computed effectLayer to skip re-computation (important for NPC grass effects)
        const sprite = createFieldEffectSprite(info.fieldEffect, playerWorldY, layer, info.effectLayer);
        if (sprite) {
          sprite.sortKey = info.sortKey;
          allSprites.push(sprite);
        }
      } else if (info.type === 'itemBall' && info.itemBall) {
        // Item balls only render if sprite is uploaded
        if (spriteRenderer.hasSpriteSheet(ITEM_BALL_ATLAS_NAME)) {
          const itemSprite = createItemBallSpriteInstance(info.itemBall, info.sortKey);
          allSprites.push(itemSprite);
        }
      }
    }

    // Script objects (e.g. Birch's bag) share object-event sprite atlases and
    // should be sorted alongside regular field sprites.
    for (const scriptObject of scriptObjects) {
      const atlasName = getNPCAtlasName(scriptObject.graphicsId);
      if (!spriteRenderer.hasSpriteSheet(atlasName)) continue;
      const feetY = scriptObject.tileY * METATILE_SIZE + METATILE_SIZE;
      const sortKey = calculateSortKey(feetY, 128);
      const sprite = createScriptObjectSpriteInstance(scriptObject, sortKey);
      if (sprite) {
        allSprites.push(sprite);
      }
    }

    // === Large objects (truck, etc.) ===
    for (const obj of largeObjects) {
      const atlasName = getLargeObjectAtlasName(obj.graphicsId);
      if (!spriteRenderer.hasSpriteSheet(atlasName)) continue;
      // C parity: object-event coordinates are feet-tile based, regardless of sprite size.
      // Use max subpriority (255) so the truck renders in front of the player at the same Y,
      // matching GBA behavior where the truck covers the player (player emerges from inside).
      const objFeetY = obj.tileY * METATILE_SIZE + METATILE_SIZE;
      const objSortKey = calculateSortKey(objFeetY, 255);
      const sprite = createLargeObjectSpriteInstance(obj, objSortKey);
      allSprites.push(sprite);
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
      surfBlobSprite,
      playerWorldY,
      newDoorSpritesUploaded,
      arrowSpriteWasUploaded,
    };
  }, []);

  return { buildSprites };
}
