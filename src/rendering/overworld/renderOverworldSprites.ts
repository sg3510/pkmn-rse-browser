/**
 * Extracted sprite rendering + compositing from the GamePage render loop.
 * Builds sprite batches, handles rotating gates, and composites the final WebGL frame.
 */
import type { SpriteInstance, WorldCameraView } from '../types';
import type { WorldSnapshot } from '../../game/WorldManager';
import type { PlayerController } from '../../game/PlayerController';
import type { WebGLRenderPipeline } from '../webgl/WebGLRenderPipeline';
import type { WebGLSpriteRenderer } from '../webgl/WebGLSpriteRenderer';
import type { WebGLFadeRenderer } from '../webgl/WebGLFadeRenderer';
import type { WebGLScanlineRenderer } from '../webgl/WebGLScanlineRenderer';
import type { FadeController } from '../../field/FadeController';
import type { UseDoorAnimationsReturn } from '../../hooks/useDoorAnimations';
import type { UseDoorSequencerReturn } from '../../hooks/useDoorSequencer';
import type { UseArrowOverlayReturn } from '../../hooks/useArrowOverlay';
import type { RotatingGateManager } from '../../game/RotatingGateManager';
import type { WorldManager } from '../../game/WorldManager';
import type { WeatherManager } from '../../weather/WeatherManager';
import type { TilesetRuntime } from '../../utils/tilesetUtils';
import type { ReflectionState } from '../../components/map/types';
import type { ReflectionTileGridDebugInfo, PriorityDebugInfo } from '../../components/debug/types';
import type { NPCObject, ItemBallObject, ScriptObject, LargeObject } from '../../types/objectEvents';
import { calculateSortKey, getRotatingGateAtlasName } from '../spriteUtils';
import { getReflectionTileGridDebug } from '../../components/debug';
import { compositeWebGLFrame } from '../compositeWebGLFrame';
import { buildPriorityDebugInfo } from '../../components/debug/buildPriorityDebugInfo';
import { menuStateManager } from '../../menu';
import type { PendingScriptedWarp } from '../../pages/gamePage/overworldGameUpdate';
import { createLogger } from '../../utils/logger';
import { recordRuntimePerfSection } from '../../game/perf/runtimePerfRecorder';

interface MutableRef<T> {
  current: T;
}

const renderLogger = createLogger('OVERWORLD_RENDER');

export interface RenderOverworldSpritesParams {
  player: PlayerController;
  playerLoaded: boolean;
  playerHidden: boolean;
  snapshot: WorldSnapshot | null;
  view: WorldCameraView;
  nowTime: number;
  gbaFrame: number;
  debugEnabled: boolean;

  // Renderers
  spriteRenderer: WebGLSpriteRenderer | null;
  pipeline: WebGLRenderPipeline;
  fadeRenderer: WebGLFadeRenderer | null;
  scanlineRenderer: WebGLScanlineRenderer | null;
  ctx2d: CanvasRenderingContext2D;
  webglCanvas: HTMLCanvasElement;

  // Managers
  worldManager: WorldManager | null;
  weatherManager: WeatherManager;
  rotatingGateManager: RotatingGateManager;
  fadeController: FadeController;
  visibleNpcs: NPCObject[];
  visibleItems: ItemBallObject[];
  visibleScriptObjects: ScriptObject[];
  visibleLargeObjects: LargeObject[];

  // State refs
  tilesetRuntimes: Map<string, TilesetRuntime>;
  fieldSpritesLoaded: boolean;
  doorSpritesUploaded: Set<string>;
  arrowSpriteUploaded: boolean;
  warpingRef: MutableRef<boolean>;
  pendingScriptedWarpRef: MutableRef<PendingScriptedWarp | null>;
  deoxysRockRenderDebugRef: MutableRef<{
    active: boolean;
    startMs: number;
    lastLogMs: number;
  }>;

  // Overlays & animations
  doorAnimations: UseDoorAnimationsReturn;
  doorSequencer: UseDoorSequencerReturn;
  arrowOverlay: UseArrowOverlayReturn;

  // Functions
  buildSprites: (params: any) => any;
  computeReflectionState: (
    snapshot: WorldSnapshot,
    tileX: number,
    tileY: number,
    prevTileX: number,
    prevTileY: number,
    spriteWidth?: number,
    spriteHeight?: number,
  ) => ReflectionState;

  // Zoom
  zoom: number;
}

export interface RenderOverworldSpritesResult {
  /** Newly uploaded door sprite atlas names */
  newDoorSpritesUploaded: string[];
  /** Whether arrow sprite was uploaded */
  arrowSpriteWasUploaded: boolean;
  /** Visible NPCs for ref tracking */
  visibleNPCs: NPCObject[];
  /** Visible items for ref tracking */
  visibleItems: ItemBallObject[];
  /** Reflection tile grid debug info (if computed) */
  reflectionTileGridDebug?: ReflectionTileGridDebugInfo;
  /** Priority debug info (if computed) */
  priorityDebugInfo?: PriorityDebugInfo;
}

export function renderOverworldSprites(params: RenderOverworldSpritesParams): RenderOverworldSpritesResult {
  const {
    player,
    playerLoaded,
    playerHidden,
    snapshot: currentSnapshot,
    view,
    nowTime,
    gbaFrame,
    debugEnabled,
    spriteRenderer,
    pipeline,
    fadeRenderer,
    scanlineRenderer,
    ctx2d,
    webglCanvas,
    worldManager,
    weatherManager,
    rotatingGateManager,
    fadeController: fade,
    visibleNpcs: npcs,
    visibleItems: items,
    visibleScriptObjects: scriptObjects,
    visibleLargeObjects: largeObjects,
    tilesetRuntimes,
    fieldSpritesLoaded,
    doorSpritesUploaded,
    arrowSpriteUploaded: arrowSpriteUploadedIn,
    warpingRef,
    pendingScriptedWarpRef,
    deoxysRockRenderDebugRef,
    doorAnimations,
    doorSequencer,
    arrowOverlay,
    buildSprites,
    computeReflectionState,
    zoom,
  } = params;

  const result: RenderOverworldSpritesResult = {
    newDoorSpritesUploaded: [],
    arrowSpriteWasUploaded: false,
    visibleNPCs: [],
    visibleItems: [],
  };

  let lowPrioritySprites: SpriteInstance[] = [];
  let priority0Sprites: SpriteInstance[] = [];

  if (player && playerLoaded) {
    // Compute reflection state
    if (currentSnapshot) {
      const { width: spriteWidth, height: spriteHeight } = player.getSpriteSize();
      const destTile = player.getDestinationTile();
      const reflectionState = computeReflectionState(
        currentSnapshot,
        destTile.x,
        destTile.y,
        player.tileX,
        player.tileY,
        spriteWidth,
        spriteHeight
      );

      // Update reflection tile grid debug info
      if (debugEnabled && gbaFrame % 6 === 0) {
        const debugStart = performance.now();
        result.reflectionTileGridDebug = getReflectionTileGridDebug(
          currentSnapshot,
          tilesetRuntimes,
          player.tileX,
          player.tileY,
          destTile.x,
          destTile.y,
          player.isMoving,
          player.dir,
          reflectionState
        );
        recordRuntimePerfSection('debugState', performance.now() - debugStart);
      }
    }

    // === WebGL Sprite Rendering ===
    if (spriteRenderer && spriteRenderer.isValid()) {
      const spriteView = view;

      if (deoxysRockRenderDebugRef.current.active) {
        const rock = npcs.find((entry) => entry.localId === 'LOCALID_BIRTH_ISLAND_EXTERIOR_ROCK');
        const nowDebugMs = performance.now();
        if (rock && nowDebugMs - deoxysRockRenderDebugRef.current.lastLogMs >= 100) {
          deoxysRockRenderDebugRef.current.lastLogMs = nowDebugMs;
          renderLogger.debug('[Legendary] Deoxys rock render sample', {
            elapsedMs: Math.round(nowDebugMs - deoxysRockRenderDebugRef.current.startMs),
            tileX: rock.tileX,
            tileY: rock.tileY,
            subTileX: rock.subTileX ?? 0,
            subTileY: rock.subTileY ?? 0,
            isWalking: rock.isWalking ?? false,
            visible: rock.visible,
            spriteHidden: rock.spriteHidden ?? false,
            tintR: rock.tintR ?? 1,
            tintG: rock.tintG ?? 1,
            tintB: rock.tintB ?? 1,
          });
        }
      }
      result.visibleNPCs = npcs;
      result.visibleItems = items;

      // Get field effects
      const fieldEffects = fieldSpritesLoaded
        ? player.getGrassEffectManager().getEffectsForRendering()
        : [];

      // Build all sprites
      const spriteBuildStart = performance.now();
      const spriteBuildResult = buildSprites({
        player,
        playerLoaded,
        playerHidden,
        snapshot: currentSnapshot,
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
        arrowSpriteUploaded: arrowSpriteUploadedIn,
        nowTime,
        computeReflectionState,
      });
      recordRuntimePerfSection('spriteBuild', performance.now() - spriteBuildStart);

      // Track newly uploaded sprites
      result.newDoorSpritesUploaded = [...spriteBuildResult.newDoorSpritesUploaded];
      result.arrowSpriteWasUploaded = spriteBuildResult.arrowSpriteWasUploaded;

      // Extract sprite groups
      const {
        lowPrioritySprites: builtLowPriority,
        allSprites: builtAllSprites,
        priority0Sprites: builtP0,
        doorSprites,
        arrowSprite,
        surfBlobSprite,
      } = spriteBuildResult;
      lowPrioritySprites = builtLowPriority;
      priority0Sprites = builtP0;

      let allSprites = builtAllSprites;
      const playerMap = worldManager?.findMapAtPosition(player.tileX, player.tileY);
      if (playerMap) {
        const rotatingGateSprites = rotatingGateManager.getSpritesForRendering(
          playerMap.entry.id,
          playerMap.offsetX,
          playerMap.offsetY,
          nowTime
        );

        if (rotatingGateSprites.length > 0) {
          const gateSpriteInstances: SpriteInstance[] = [];
          for (const gateSprite of rotatingGateSprites) {
            const atlasName = getRotatingGateAtlasName(gateSprite.shapeKey);
            if (!spriteRenderer.hasSpriteSheet(atlasName)) continue;

            gateSpriteInstances.push({
              worldX: gateSprite.worldX,
              worldY: gateSprite.worldY,
              width: gateSprite.width,
              height: gateSprite.height,
              atlasName,
              atlasX: 0,
              atlasY: 0,
              atlasWidth: gateSprite.width,
              atlasHeight: gateSprite.height,
              flipX: false,
              flipY: false,
              rotationDeg: gateSprite.rotationDeg,
              alpha: 1.0,
              tintR: 1.0,
              tintG: 1.0,
              tintB: 1.0,
              sortKey: calculateSortKey(gateSprite.worldY + gateSprite.height / 2, 0),
              isReflection: false,
            });
          }

          if (gateSpriteInstances.length > 0) {
            allSprites = [...allSprites, ...gateSpriteInstances].sort((a, b) => a.sortKey - b.sortKey);
          }
        }
      }

      // Priority debug info
      if (debugEnabled && gbaFrame % 6 === 0) {
        const debugStart = performance.now();
        result.priorityDebugInfo = buildPriorityDebugInfo({
          player,
          allSprites,
          lowPrioritySprites,
          priority0Sprites,
        });
        recordRuntimePerfSection('debugState', performance.now() - debugStart);
      }

      // Compositing
      let fadeAlpha = fade.isActive() ? fade.getAlpha(nowTime) : 0;
      if (warpingRef.current && fadeAlpha < 1.0) {
        const pendingScriptedWarp = pendingScriptedWarpRef.current;
        const isScriptedWarpLoading = pendingScriptedWarp?.phase === 'loading';
        const fadeDirection = fade.getDirection();
        const shouldClampToBlack = isScriptedWarpLoading
          && (fadeDirection !== 'in' || fade.isComplete(nowTime));
        if (shouldClampToBlack) {
          fadeAlpha = 1.0;
        }
      }

      const scanlineIntensity = menuStateManager.isMenuOpen() ? 1.0 : 0.0;

      const compositeStart = performance.now();
      compositeWebGLFrame(
        {
          pipeline,
          spriteRenderer,
          fadeRenderer,
          scanlineRenderer,
          ctx2d,
          webglCanvas,
          view: spriteView,
          snapshot: currentSnapshot,
          tilesetRuntimes,
          renderWeather: (weatherCtx, weatherView, weatherNowMs) => {
            weatherManager.render(weatherCtx, weatherView, weatherNowMs);
          },
        },
        {
          lowPrioritySprites,
          allSprites,
          priority0Sprites,
          doorSprites,
          arrowSprite,
          surfBlobSprite,
        },
        { fadeAlpha, scanlineIntensity, zoom, nowMs: nowTime }
      );
      recordRuntimePerfSection('composite', performance.now() - compositeStart);
    }
  }

  return result;
}
