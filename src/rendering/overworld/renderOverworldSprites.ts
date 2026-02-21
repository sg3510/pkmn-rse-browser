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
import type { ScriptFieldEffectAnimationManager } from '../../game/ScriptFieldEffectAnimationManager';
import type { OrbEffectRuntime } from '../../game/scriptEffects/orbEffectRuntime';
import type { MirageTowerCollapseRuntime } from '../../game/scriptEffects/mirageTowerCollapseRuntime';
import type { FieldEffectForRendering } from '../../game/FieldEffectManager';
import { calculateSortKey, getRotatingGateAtlasName } from '../spriteUtils';
import { getReflectionTileGridDebug } from '../../components/debug';
import { compositeWebGLFrame } from '../compositeWebGLFrame';
import { buildPriorityDebugInfo } from '../../components/debug/buildPriorityDebugInfo';
import { menuStateManager } from '../../menu';
import type { PendingScriptedWarp } from '../../pages/gamePage/overworldGameUpdate';
import { createLogger } from '../../utils/logger';
import { incrementRuntimePerfCounter, recordRuntimePerfSection } from '../../game/perf/runtimePerfRecorder';
import type { WebGLOrbEffectRenderer } from '../webgl/WebGLOrbEffectRenderer';
import { getFlashRadiusForLevel } from '../../game/flash/FlashController';

interface MutableRef<T> {
  current: T;
}

const renderLogger = createLogger('OVERWORLD_RENDER');
const renderScratch = {
  fieldEffects: [] as FieldEffectForRendering[],
  mergeBuffer: [] as SpriteInstance[],
  mergeInputBuffer: [] as SpriteInstance[],
};

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
  ctx2d?: CanvasRenderingContext2D | null;
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
  scriptFieldEffectAnimationManager: ScriptFieldEffectAnimationManager;
  orbEffectRuntime: OrbEffectRuntime;
  orbEffectRenderer: WebGLOrbEffectRenderer | null;
  mirageTowerCollapseRuntime: MirageTowerCollapseRuntime;

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
  getFlashRenderRadius?: () => number;

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
    ctx2d = null,
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
    scriptFieldEffectAnimationManager,
    orbEffectRuntime,
    orbEffectRenderer,
    mirageTowerCollapseRuntime,
    doorAnimations,
    doorSequencer,
    arrowOverlay,
    buildSprites,
    computeReflectionState,
    getFlashRenderRadius,
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
      const objectCoords = player.getObjectEventCoords();
      const reflectionState = computeReflectionState(
        currentSnapshot,
        objectCoords.current.x,
        objectCoords.current.y,
        objectCoords.previous.x,
        objectCoords.previous.y,
        spriteWidth,
        spriteHeight
      );

      // Update reflection tile grid debug info
      if (debugEnabled && gbaFrame % 6 === 0) {
        const debugStart = performance.now();
        result.reflectionTileGridDebug = getReflectionTileGridDebug(
          currentSnapshot,
          tilesetRuntimes,
          objectCoords.previous.x,
          objectCoords.previous.y,
          objectCoords.current.x,
          objectCoords.current.y,
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
      const fieldEffectsBuffer = renderScratch.fieldEffects;
      const fieldEffects = fieldSpritesLoaded
        ? player.getGrassEffectManager().getEffectsForRendering(fieldEffectsBuffer)
        : (() => {
          fieldEffectsBuffer.length = 0;
          return fieldEffectsBuffer;
        })();

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
      result.newDoorSpritesUploaded = spriteBuildResult.newDoorSpritesUploaded;
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
          const gateSpriteInstances = renderScratch.mergeInputBuffer;
          gateSpriteInstances.length = 0;
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
            allSprites = mergeSortedSpritesInPlace(allSprites, gateSpriteInstances, renderScratch.mergeBuffer);
          }
        }
      }

      const scriptFieldEffectSprites = scriptFieldEffectAnimationManager.buildSprites(
        spriteView,
        (atlasName) => spriteRenderer.hasSpriteSheet(atlasName)
      );
      if (scriptFieldEffectSprites.length > 0) {
        allSprites = mergeSortedSpritesInPlace(allSprites, scriptFieldEffectSprites, renderScratch.mergeBuffer);
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
      const weatherNeedsRender = weatherManager.hasActiveVisualEffects();
      const orbState = orbEffectRuntime.getRenderState();
      const mirageState = mirageTowerCollapseRuntime.getRenderState();
      const shouldRenderScriptScreenEffect = !!orbState || !!mirageState;

      const rawFlashRadius = getFlashRenderRadius?.();
      const fullBrightRadius = getFlashRadiusForLevel(0);
      const normalizedFlashRadius = Number.isFinite(rawFlashRadius)
        ? Math.max(0, Math.trunc(rawFlashRadius as number))
        : null;
      const shouldRenderDarknessMask =
        normalizedFlashRadius !== null && normalizedFlashRadius < fullBrightRadius;

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
          renderWeather: weatherNeedsRender
            ? (
              weatherCtx,
              weatherView,
              weatherNowMs,
              weatherWaterMask,
              weatherGl,
              weatherWebglCanvas
            ) => {
              weatherManager.render(
                weatherCtx,
                weatherView,
                weatherNowMs,
                weatherWaterMask,
                weatherGl,
                weatherWebglCanvas
              );
            }
            : undefined,
          renderScriptScreenEffect: shouldRenderScriptScreenEffect
            ? (effectCtx) => {
              const targetWidth = effectCtx.ctx2d.canvas.width;
              const targetHeight = effectCtx.ctx2d.canvas.height;

              if (orbState && orbEffectRenderer) {
                const gl = effectCtx.gl;
                if (
                  effectCtx.webglCanvas.width !== targetWidth
                  || effectCtx.webglCanvas.height !== targetHeight
                ) {
                  effectCtx.webglCanvas.width = targetWidth;
                  effectCtx.webglCanvas.height = targetHeight;
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, targetWidth, targetHeight);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                orbEffectRenderer.render(orbState, targetWidth, targetHeight);
                incrementRuntimePerfCounter('webglCanvasBlits');
                effectCtx.ctx2d.drawImage(effectCtx.webglCanvas, 0, 0, targetWidth, targetHeight);
              }

              if (mirageState) {
                mirageTowerCollapseRuntime.render(
                  effectCtx.ctx2d,
                  effectCtx.view,
                  targetWidth,
                  targetHeight
                );
              }
            }
            : undefined,
          renderDarknessMask: shouldRenderDarknessMask && normalizedFlashRadius !== null
            ? ({ ctx2d: maskCtx, view: maskView }) => {
              const width = maskView.pixelWidth;
              const height = maskView.pixelHeight;
              const playerFrame = player.getFrameInfo();
              const defaultCenterX = width / 2;
              const defaultCenterY = height / 2;
              const playerScreenCenterX = playerFrame
                ? (playerFrame.renderX + playerFrame.sw / 2) - maskView.cameraWorldX
                : defaultCenterX;
              const playerScreenCenterY = playerFrame
                ? (playerFrame.renderY + playerFrame.sh / 2) - maskView.cameraWorldY
                : defaultCenterY;
              const centerX = Math.max(0, Math.min(width - 1, playerScreenCenterX));
              const centerY = Math.max(0, Math.min(height - 1, playerScreenCenterY));
              maskCtx.save();
              maskCtx.fillStyle = '#000000';
              if (normalizedFlashRadius <= 0) {
                maskCtx.fillRect(0, 0, width, height);
              } else {
                maskCtx.beginPath();
                maskCtx.rect(0, 0, width, height);
                maskCtx.arc(centerX, centerY, normalizedFlashRadius, 0, Math.PI * 2);
                maskCtx.fill('evenodd');
              }

              maskCtx.restore();
            }
            : undefined,
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

function mergeSortedSpritesInPlace(
  target: SpriteInstance[],
  additions: SpriteInstance[],
  scratch: SpriteInstance[]
): SpriteInstance[] {
  if (additions.length === 0) return target;

  additions.sort((a, b) => a.sortKey - b.sortKey);

  scratch.length = 0;
  let left = 0;
  let right = 0;
  while (left < target.length && right < additions.length) {
    if (target[left].sortKey <= additions[right].sortKey) {
      scratch.push(target[left++]);
    } else {
      scratch.push(additions[right++]);
    }
  }
  while (left < target.length) scratch.push(target[left++]);
  while (right < additions.length) scratch.push(additions[right++]);

  target.length = 0;
  for (let i = 0; i < scratch.length; i++) {
    target.push(scratch[i]);
  }

  return target;
}

export const __testMergeSortedSpritesInPlace = mergeSortedSpritesInPlace;
