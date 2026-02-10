/**
 * Shared Overworld asset bootstrap for GamePage-like runtimes.
 */

import type { UseArrowOverlayReturn } from '../../hooks/useArrowOverlay';
import type { UseDoorAnimationsReturn } from '../../hooks/useDoorAnimations';
import type { UseDoorSequencerReturn } from '../../hooks/useDoorSequencer';
import type { UseFieldSpritesReturn } from '../../hooks/useFieldSprites';
import type { PlayerController } from '../../game/PlayerController';
import type { WarpHandler } from '../../field/WarpHandler';
import type { WorldSnapshot } from '../../game/WorldManager';
import type { RenderContext } from '../../rendering/types';
import type { WebGLSpriteRenderer } from '../../rendering/webgl/WebGLSpriteRenderer';
import { resolveTileAt, findWarpEventAt } from '../../components/map/utils';
import { getMetatileIdFromMapTile } from '../../utils/mapLoader';
import { startDoorWarpSequence, type DoorWarpContext } from '../../game/DoorActionDispatcher';
import {
  getPlayerAtlasName,
  getFieldEffectAtlasName,
  getLargeObjectAtlasName,
  ITEM_BALL_ATLAS_NAME,
} from '../../rendering/spriteUtils';
import { loadImageAsset, makeTransparentCanvas } from '../../utils/assetLoader';

type MutableRef<T> = { current: T };

export interface EnsureOverworldRuntimeAssetsParams {
  player: PlayerController;
  isDebugMode: () => boolean;
  playerLoadedRef: MutableRef<boolean>;
  playerSpritesLoadPromiseRef: MutableRef<Promise<void> | null>;
  fieldSpritesLoadedRef: MutableRef<boolean>;
  fieldSpritesLoadPromiseRef: MutableRef<Promise<void> | null>;
  spriteRendererRef: MutableRef<WebGLSpriteRenderer | null>;
  worldSnapshotRef: MutableRef<WorldSnapshot | null>;
  warpHandlerRef: MutableRef<WarpHandler>;
  fieldSprites: UseFieldSpritesReturn;
  getRenderContextFromSnapshot: (snapshot: WorldSnapshot) => RenderContext | null;
  doorSequencer: UseDoorSequencerReturn;
  doorAnimations: UseDoorAnimationsReturn;
  arrowOverlay: UseArrowOverlayReturn;
}

function debugLog(isDebugMode: () => boolean, ...args: unknown[]): void {
  if (!isDebugMode()) return;
  console.log(...args);
}

export function ensureOverworldRuntimeAssets(params: EnsureOverworldRuntimeAssetsParams): void {
  const {
    player,
    isDebugMode,
    playerLoadedRef,
    playerSpritesLoadPromiseRef,
    fieldSpritesLoadedRef,
    fieldSpritesLoadPromiseRef,
    spriteRendererRef,
    worldSnapshotRef,
    warpHandlerRef,
    fieldSprites,
    getRenderContextFromSnapshot,
    doorSequencer,
    doorAnimations,
    arrowOverlay,
  } = params;

  if (!playerLoadedRef.current && !playerSpritesLoadPromiseRef.current) {
    playerSpritesLoadPromiseRef.current = (async () => {
      try {
        await player.loadSprite('walking', '/pokeemerald/graphics/object_events/pics/people/brendan/walking.png');
        await player.loadSprite('running', '/pokeemerald/graphics/object_events/pics/people/brendan/running.png');
        await player.loadSprite('surfing', '/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png');
        await player.loadSprite('shadow', '/pokeemerald/graphics/field_effects/pics/shadow_medium.png');

        // Set up door warp handler for animated door and arrow warp entry.
        player.setDoorWarpHandler(async (request) => {
          debugLog(isDebugMode, '[DOOR_HANDLER] Called with request:', request);

          const snapshot = worldSnapshotRef.current;
          if (!snapshot) {
            debugLog(isDebugMode, '[DOOR_HANDLER] Rejected: no snapshot');
            return;
          }

          const renderContext = getRenderContextFromSnapshot(snapshot);
          if (!renderContext) {
            debugLog(isDebugMode, '[DOOR_HANDLER] Rejected: no renderContext');
            return;
          }

          const resolved = resolveTileAt(renderContext, request.targetX, request.targetY);
          if (!resolved) {
            debugLog(isDebugMode, '[DOOR_HANDLER] Rejected: no resolved tile at', request.targetX, request.targetY);
            return;
          }

          const warpEvent = findWarpEventAt(resolved.map, request.targetX, request.targetY);
          if (!warpEvent) {
            debugLog(
              isDebugMode,
              '[DOOR_HANDLER] Rejected: no warpEvent at',
              request.targetX,
              request.targetY,
              'in map',
              resolved.map.entry.id
            );
            return;
          }

          const behavior = resolved.attributes?.behavior ?? -1;
          const metatileId = getMetatileIdFromMapTile(resolved.mapTile);
          if (isDebugMode()) {
            const tileset = resolved.tileset;
            console.log('[DOOR_HANDLER] Found warp:', warpEvent);
            console.log('[DOOR_HANDLER] Tileset attributes debug:', {
              primaryAttributesLength: tileset?.primaryAttributes?.length ?? 0,
              secondaryAttributesLength: tileset?.secondaryAttributes?.length ?? 0,
              metatileId: `0x${metatileId.toString(16)} (${metatileId})`,
              isSecondary: resolved.isSecondary,
              attrAtIndex: resolved.isSecondary
                ? tileset?.secondaryAttributes?.[metatileId - 512]
                : tileset?.primaryAttributes?.[metatileId],
            });
            console.log('[DOOR_HANDLER] Tile info:', {
              metatileId: `0x${metatileId.toString(16)} (${metatileId})`,
              behavior,
              hasAttributes: !!resolved.attributes,
              attributes: resolved.attributes,
            });
          }

          const ctx: DoorWarpContext = {
            targetX: request.targetX,
            targetY: request.targetY,
            behavior,
            metatileId,
            warpEvent,
            sourceMap: resolved.map,
          };

          const started = await startDoorWarpSequence(ctx, {
            player,
            doorSequencer,
            doorAnimations,
            arrowOverlay,
            warpHandler: warpHandlerRef.current,
          });
          if (started) {
            debugLog(isDebugMode, '[DOOR_HANDLER] Door sequence started');
          }
        });

        const spriteRenderer = spriteRendererRef.current;
        if (spriteRenderer) {
          const spriteSheets = player.getSpriteSheets();
          for (const [key, canvas] of spriteSheets) {
            const atlasName = getPlayerAtlasName(key);
            let frameWidth = 16;
            let frameHeight = 32;
            if (key === 'shadow') {
              frameWidth = 16;
              frameHeight = 8;
            } else if (key === 'surfing') {
              frameWidth = 32;
              frameHeight = 32;
            }
            spriteRenderer.uploadSpriteSheet(atlasName, canvas, {
              frameWidth,
              frameHeight,
            });
            debugLog(
              isDebugMode,
              `[WebGL] Uploaded sprite sheet: ${atlasName} (${canvas.width}x${canvas.height}, frame: ${frameWidth}x${frameHeight})`
            );
          }

          const blobRenderer = player.getSurfingController().getBlobRenderer();
          await blobRenderer.waitForLoad();
          const blobCanvas = blobRenderer.getSpriteCanvas();
          if (blobCanvas) {
            spriteRenderer.uploadSpriteSheet('surf-blob', blobCanvas, {
              frameWidth: 32,
              frameHeight: 32,
            });
            debugLog(isDebugMode, `[WebGL] Uploaded surf blob sprite (${blobCanvas.width}x${blobCanvas.height})`);
          }
        }

        playerLoadedRef.current = true;
      } catch (err) {
        console.error('Failed to load player sprites:', err);
        playerSpritesLoadPromiseRef.current = null;
      }
    })();
  }

  if (!fieldSpritesLoadedRef.current && !fieldSpritesLoadPromiseRef.current) {
    fieldSpritesLoadPromiseRef.current = (async () => {
      try {
        await fieldSprites.loadAll();
        const spriteRenderer = spriteRendererRef.current;
        if (spriteRenderer) {
          const fieldSpriteKeys = ['grass', 'longGrass', 'sand', 'splash', 'ripple'] as const;
          for (const key of fieldSpriteKeys) {
            const canvas = fieldSprites.sprites[key];
            if (canvas) {
              const atlasName = getFieldEffectAtlasName(key);
              spriteRenderer.uploadSpriteSheet(atlasName, canvas);
              debugLog(isDebugMode, `[WebGL] Uploaded field sprite: ${atlasName} (${canvas.width}x${canvas.height})`);
            }
          }

          const itemBallCanvas = fieldSprites.sprites.itemBall;
          if (itemBallCanvas) {
            spriteRenderer.uploadSpriteSheet(ITEM_BALL_ATLAS_NAME, itemBallCanvas, {
              frameWidth: 16,
              frameHeight: 16,
            });
            debugLog(
              isDebugMode,
              `[WebGL] Uploaded item ball sprite: ${ITEM_BALL_ATLAS_NAME} (${itemBallCanvas.width}x${itemBallCanvas.height})`
            );
          }

          try {
            const truckImg = await loadImageAsset('/pokeemerald/graphics/object_events/pics/misc/truck.png');
            const truckCanvas = makeTransparentCanvas(truckImg, { type: 'top-left' });
            const atlasName = getLargeObjectAtlasName('OBJ_EVENT_GFX_TRUCK');
            spriteRenderer.uploadSpriteSheet(atlasName, truckCanvas, {
              frameWidth: 48,
              frameHeight: 48,
            });
            debugLog(isDebugMode, `[WebGL] Uploaded truck sprite: ${atlasName} (${truckCanvas.width}x${truckCanvas.height})`);
          } catch (err) {
            console.warn('Failed to load truck sprite:', err);
          }
        }

        fieldSpritesLoadedRef.current = true;
      } catch (err) {
        console.error('Failed to load field sprites:', err);
        fieldSpritesLoadPromiseRef.current = null;
      }
    })();
  }
}
