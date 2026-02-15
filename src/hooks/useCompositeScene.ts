/**
 * useCompositeScene Hook
 *
 * Provides the main scene compositing/rendering logic for Canvas2D renderer.
 * Extracted from MapRenderer.tsx to reduce component complexity.
 *
 * IMPORTANT: The render order here must match WebGLMapPage.tsx.
 * See src/rendering/CompositeOrder.ts for the canonical render order definition.
 */

import { useCallback, type RefObject } from 'react';
import type { RenderContext, ReflectionState } from '../components/map/types';
import type { WorldCameraView } from '../components/MapRendererTypes';
import type { PlayerController } from '../game/PlayerController';
import type { ObjectEventManager } from '../game/ObjectEventManager';
import type { IRenderPipeline } from '../rendering/IRenderPipeline';
import type { FadeController } from '../field/FadeController';
import type { DebugOptions } from '../components/debug';
import type { UseDoorAnimationsReturn } from './useDoorAnimations';
import type { UseArrowOverlayReturn } from './useArrowOverlay';
import type { UseFieldSpritesReturn } from './useFieldSprites';
import { ObjectRenderer } from '../components/map/renderers/ObjectRenderer';
import { DebugRenderer } from '../components/map/renderers/DebugRenderer';
import { getSpritePriorityForElevation } from '../utils/elevationPriority';
import { renderNPCs, renderNPCReflections, npcAnimationManager } from '../game/npc';
import { getGlobalShimmer } from '../field/ReflectionRenderer';
import { buildSpriteBatches, getEffectsForNPC, getPlayerEffectsForLayer } from '../rendering/SpriteBatcher';
import { isDebugMode } from '../utils/debug';

// Feature flag for render pipeline
const USE_RENDER_PIPELINE = true;

/** Refs needed by compositeScene */
export interface CompositeSceneRefs {
  renderContextRef: RefObject<RenderContext | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  backgroundCanvasRef: RefObject<HTMLCanvasElement | null>;
  topCanvasRef: RefObject<HTMLCanvasElement | null>;
  playerControllerRef: RefObject<PlayerController | null>;
  lastPlayerElevationRef: RefObject<number>;
  renderPipelineRef: RefObject<IRenderPipeline | null>;
  objectEventManagerRef: RefObject<ObjectEventManager>;
  playerHiddenRef: RefObject<boolean>;
  debugOptionsRef: RefObject<DebugOptions>;
  fadeRef: RefObject<FadeController>;
}

/** Hook configuration */
export interface UseCompositeSceneOptions {
  refs: CompositeSceneRefs;
  doorAnimations: UseDoorAnimationsReturn;
  arrowOverlay: UseArrowOverlayReturn;
  fieldSprites: UseFieldSpritesReturn;
  ensureAuxiliaryCanvases: (width: number, height: number) => void;
}

export interface UseCompositeSceneReturn {
  /** Composite and render the full scene */
  compositeScene: (
    reflectionState: ReflectionState,
    view: WorldCameraView,
    viewChanged: boolean,
    animationFrameChanged: boolean,
    nowMs: number,
    gameFrame: number
  ) => void;
}

/**
 * Hook providing scene compositing logic
 */
export function useCompositeScene(options: UseCompositeSceneOptions): UseCompositeSceneReturn {
  const {
    refs,
    doorAnimations,
    arrowOverlay,
    fieldSprites,
    ensureAuxiliaryCanvases,
  } = options;

  const compositeScene = useCallback(
    (
      reflectionState: ReflectionState,
      view: WorldCameraView,
      viewChanged: boolean,
      animationFrameChanged: boolean,
      nowMs: number,
      gameFrame: number
    ) => {
      // Update shimmer animation (GBA-accurate reflection distortion)
      getGlobalShimmer().update(nowMs);

      // Update NPC animations (frame advancement based on delta time)
      npcAnimationManager.update();

      const ctx = refs.renderContextRef.current;
      if (!ctx) return;
      const mainCanvas = refs.canvasRef.current;
      if (!mainCanvas) return;
      const mainCtx = mainCanvas.getContext('2d');
      if (!mainCtx) return;

      const widthPx = view.pixelWidth;
      const heightPx = view.pixelHeight;
      ensureAuxiliaryCanvases(widthPx, heightPx);

      const bgCtx = refs.backgroundCanvasRef.current?.getContext('2d');
      const topCtx = refs.topCanvasRef.current?.getContext('2d');
      if (!bgCtx || !topCtx) return;

      const player = refs.playerControllerRef.current;
      const playerElevation = player ? player.getElevation() : 0;
      const playerPriority = getSpritePriorityForElevation(playerElevation);
      const elevationChanged = refs.lastPlayerElevationRef.current !== playerElevation;
      (refs.lastPlayerElevationRef as { current: number }).current = playerElevation;

      // Split rendering: Top layer split into "Below Player" and "Above Player"
      // This fixes the visual issue where player on a bridge (Elev 4) is covered by the bridge

      // RENDER PIPELINE MODE: Uses the new modular RenderPipeline
      if (USE_RENDER_PIPELINE && refs.renderPipelineRef.current) {
        const pipeline = refs.renderPipelineRef.current;

        // Render all three passes (cached when view/elevation unchanged)
        pipeline.render(ctx, view, playerElevation, {
          needsFullRender: viewChanged,
          animationChanged: animationFrameChanged,
          elevationChanged,
          gameFrame,
        });

        // Composite background first (for priority 2 sprites to appear behind topBelow)
        mainCtx.clearRect(0, 0, widthPx, heightPx);
        pipeline.compositeBackgroundOnly(mainCtx, view);

        // Render priority 2 NPCs that are NOT at player's priority
        // NPCs at player's priority will be Y-sorted with player in the player layer
        if (player) {
          const npcs = refs.objectEventManagerRef.current.getVisibleNPCs();
          renderNPCs(mainCtx, npcs, view, player.tileY, 'bottom', 2, playerPriority);
          renderNPCs(mainCtx, npcs, view, player.tileY, 'top', 2, playerPriority);
        }

        // Now composite topBelow layer (bridges, tree tops rendered behind player)
        pipeline.compositeTopBelowOnly(mainCtx, view);
      }

      doorAnimations.render(mainCtx, view, nowMs);

      // Render arrow overlay
      const arrowState = arrowOverlay.getState();
      const arrowSprite = arrowOverlay.getSprite();
      if (arrowState && arrowSprite) {
        ObjectRenderer.renderArrow(mainCtx, arrowState, arrowSprite, view, nowMs);
      }

      if (player) {
        ObjectRenderer.renderReflection(mainCtx, player, reflectionState, view, ctx);
      }

      // Build sprite batches using shared utility (same logic as WebGLMapPage)
      // This ensures both renderers use identical sorting/layer decisions
      const npcs = refs.objectEventManagerRef.current.getVisibleNPCs();

      // Render NPC reflections (before NPCs so reflections appear underneath)
      renderNPCReflections(mainCtx, npcs, view, ctx);

      // Get field effects for sprite batching
      const fieldEffects = player ? player.getGrassEffectManager().getEffectsForRendering() : [];
      const spriteBatches = player
        ? buildSpriteBatches(player, npcs, fieldEffects, {
            includePlayerShadow: player.showShadow,
            playerHidden: refs.playerHiddenRef.current,
          })
        : null;

      // Sprite cache for field effects
      const fieldSpriteCache = {
        grass: fieldSprites.sprites.grass ?? null,
        longGrass: fieldSprites.sprites.longGrass ?? null,
        sand: fieldSprites.sprites.sand ?? null,
        bikeTracks: fieldSprites.sprites.bikeTracks ?? null,
        splash: fieldSprites.sprites.splash ?? null,
        ripple: fieldSprites.sprites.ripple ?? null,
        arrow: arrowOverlay.getSprite(),
        itemBall: fieldSprites.sprites.itemBall ?? null,
      };

      // Build set of NPC IDs for separating player vs NPC effects
      const npcIds = new Set(npcs.filter(n => n.visible && !n.spriteHidden).map(n => n.id));

      // Render PLAYER field effects behind player (using SpriteBatcher for layer decision)
      // NPC effects are rendered separately right after each NPC
      if (player && spriteBatches) {
        const bottomPlayerEffects = getPlayerEffectsForLayer(spriteBatches.ySorted, 'bottom', npcIds);
        for (const info of bottomPlayerEffects) {
          if (info.fieldEffect) {
            ObjectRenderer.renderSingleFieldEffect(mainCtx, info.fieldEffect, fieldSpriteCache, view, ctx);
          }
        }

        // Render NPC-owned effects that belong to the behind-player layer
        // (sand/deep-sand footprints and bike tire tracks are always 'behind').
        const bottomNpcEffects = spriteBatches.ySorted.filter(
          info =>
            info.type === 'fieldEffect' &&
            info.effectLayer === 'behind' &&
            info.fieldEffect &&
            npcIds.has(info.fieldEffect.ownerObjectId)
        );
        for (const info of bottomNpcEffects) {
          if (info.fieldEffect) {
            ObjectRenderer.renderSingleFieldEffect(mainCtx, info.fieldEffect, fieldSpriteCache, view, ctx);
          }
        }

        // Render item balls behind player
        const itemBalls = refs.objectEventManagerRef.current.getVisibleItemBalls();
        ObjectRenderer.renderItemBalls(mainCtx, itemBalls, fieldSprites.sprites.itemBall ?? null, view, player.tileY, 'bottom');

        // Render NPCs at player's priority behind player (Y-sorted with player)
        renderNPCs(mainCtx, npcs, view, player.tileY, 'bottom', playerPriority);

        // Render NPC grass effects for NPCs behind player (grass ON TOP of each NPC)
        for (const npc of npcs) {
          if (!npc.visible || npc.spriteHidden) continue;
          // Only for NPCs in bottom layer (Y < player)
          if (npc.tileY >= player.tileY) continue;
          // Render grass effects for this NPC
          const npcEffects = getEffectsForNPC(spriteBatches.ySorted, npc.id);
          for (const info of npcEffects) {
            if (info.fieldEffect && info.effectLayer === 'front') {
              ObjectRenderer.renderSingleFieldEffect(mainCtx, info.fieldEffect, fieldSpriteCache, view, ctx);
            }
          }
        }
      }

      // Render surf blob (if surfing or mounting/dismounting)
      // The blob is rendered BEFORE player so player appears on top
      if (player && !refs.playerHiddenRef.current) {
        const surfCtrl = player.getSurfingController();
        const blobRenderer = surfCtrl.getBlobRenderer();
        const shouldRenderBlob = !player.isUnderwater() && (player.isSurfing() || surfCtrl.isJumping());

        if (shouldRenderBlob && blobRenderer.isReady()) {
          const bobOffset = blobRenderer.getBobOffset();
          let blobScreenX: number;
          let blobScreenY: number;

          // Determine blob position based on current animation phase
          if (surfCtrl.isJumpingOn()) {
            // MOUNTING: Blob is at target water tile (destination)
            const targetPos = surfCtrl.getTargetPosition();
            if (targetPos) {
              const blobWorldX = targetPos.tileX * 16 - 8;
              const blobWorldY = targetPos.tileY * 16 - 16;
              blobScreenX = Math.round(blobWorldX - view.cameraWorldX);
              blobScreenY = Math.round(blobWorldY + bobOffset - view.cameraWorldY + 8);
            } else {
              blobScreenX = Math.round(player.x - 8 - view.cameraWorldX);
              blobScreenY = Math.round(player.y + bobOffset - view.cameraWorldY + 8);
            }
          } else if (surfCtrl.isJumpingOff()) {
            // DISMOUNTING: Blob stays at fixed water tile position
            const fixedPos = surfCtrl.getBlobFixedPosition();
            if (fixedPos) {
              const blobWorldX = fixedPos.tileX * 16 - 8;
              const blobWorldY = fixedPos.tileY * 16 - 16;
              blobScreenX = Math.round(blobWorldX - view.cameraWorldX);
              blobScreenY = Math.round(blobWorldY + bobOffset - view.cameraWorldY + 8);
            } else {
              blobScreenX = Math.round(player.x - 8 - view.cameraWorldX);
              blobScreenY = Math.round(player.y + bobOffset - view.cameraWorldY + 8);
            }
          } else {
            // Normal surfing: Blob follows player
            blobScreenX = Math.round(player.x - 8 - view.cameraWorldX);
            blobScreenY = Math.round(player.y + bobOffset - view.cameraWorldY + 8);
          }

          // applyBob = false because we already added bobOffset to blobScreenY
          blobRenderer.render(mainCtx, blobScreenX, blobScreenY, player.dir, false);
        }
      }

      if (player && !refs.playerHiddenRef.current) {
        player.render(mainCtx, view.cameraWorldX, view.cameraWorldY);
      }

      // Render PLAYER field effects in front of player (using SpriteBatcher for layer decision)
      // NPC effects are rendered separately right after each NPC
      if (player && spriteBatches) {
        const topPlayerEffects = getPlayerEffectsForLayer(spriteBatches.ySorted, 'top', npcIds);
        for (const info of topPlayerEffects) {
          if (info.fieldEffect) {
            ObjectRenderer.renderSingleFieldEffect(mainCtx, info.fieldEffect, fieldSpriteCache, view, ctx);
          }
        }

        // Render item balls in front of player
        const itemBalls = refs.objectEventManagerRef.current.getVisibleItemBalls();
        ObjectRenderer.renderItemBalls(mainCtx, itemBalls, fieldSprites.sprites.itemBall ?? null, view, player.tileY, 'top');

        // Render NPCs at player's priority in front of player (Y-sorted with player)
        renderNPCs(mainCtx, npcs, view, player.tileY, 'top', playerPriority);

        // Render NPC grass effects for NPCs in front of player (grass ON TOP of each NPC)
        for (const npc of npcs) {
          if (!npc.visible || npc.spriteHidden) continue;
          // Only for NPCs in top layer (Y >= player)
          if (npc.tileY < player.tileY) continue;
          // Render grass effects for this NPC
          const npcEffects = getEffectsForNPC(spriteBatches.ySorted, npc.id);
          for (const info of npcEffects) {
            if (info.fieldEffect && info.effectLayer === 'front') {
              ObjectRenderer.renderSingleFieldEffect(mainCtx, info.fieldEffect, fieldSpriteCache, view, ctx);
            }
          }
        }
      }

      // Draw Top Layer (Above Player)
      if (USE_RENDER_PIPELINE && refs.renderPipelineRef.current) {
        refs.renderPipelineRef.current.compositeTopAbove(mainCtx, view);
      }

      // Render priority 0 NPCs (elevation 13, 14) that are NOT at player's priority
      // They appear ABOVE everything including topAbove (GBA priority 0 sprites)
      if (player) {
        const npcs = refs.objectEventManagerRef.current.getVisibleNPCs();
        renderNPCs(mainCtx, npcs, view, player.tileY, 'bottom', 0, playerPriority);
        renderNPCs(mainCtx, npcs, view, player.tileY, 'top', 0, playerPriority);
      }

      // Render debug overlays if enabled
      DebugRenderer.renderCollisionElevationOverlay(mainCtx, ctx, view, {
        showCollision: refs.debugOptionsRef.current.showCollisionOverlay,
        showElevation: refs.debugOptionsRef.current.showElevationOverlay,
      });

      // Render fade overlay using FadeController
      if (refs.fadeRef.current.isActive()) {
        const alpha = refs.fadeRef.current.getAlpha(nowMs);
        mainCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        mainCtx.fillRect(0, 0, widthPx, heightPx);
        if (refs.fadeRef.current.isComplete(nowMs)) {
          refs.fadeRef.current.clear();
        }
      }

      if (isDebugMode('door')) {
        console.log(
          `[MapRender] view (${view.worldStartTileX}, ${view.worldStartTileY}) player (${refs.playerControllerRef.current?.tileX}, ${refs.playerControllerRef.current?.tileY})`
        );
      }
    },
    [] // All dependencies are stable: refs are useRef objects, hook functions use useCallback([])
  );

  return { compositeScene };
}
