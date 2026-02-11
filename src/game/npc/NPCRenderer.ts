/**
 * NPCRenderer - Renders NPCs to canvas with proper direction frames and Y-sorting
 *
 * Handles:
 * - Direction-based sprite frame selection
 * - Horizontal flipping for east-facing sprites
 * - Y-sorting relative to player
 * - Viewport culling
 * - Water/ice reflections (same as player)
 */

import type { NPCObject, NPCDirection } from '../../types/objectEvents';
import { METATILE_SIZE } from '../../utils/mapLoader';
import { npcSpriteCache, getNPCFrameInfo, getNPCFrameRect } from './NPCSpriteLoader';
import { ObjectRenderer, type SpriteFrameInfo } from '../../components/map/renderers/ObjectRenderer';
import { computeObjectReflectionState, getMetatileBehavior } from '../../components/map/utils';
import type { RenderContext } from '../../components/map/types';
import { isTallGrassBehavior, isLongGrassBehavior } from '../../utils/metatileBehaviors';
import { getSpritePriorityForElevation } from '../../utils/elevationPriority';
import { npcAnimationManager, shouldAnimate } from './NPCAnimationEngine';

export interface NPCRenderView {
  cameraWorldX: number;
  cameraWorldY: number;
  pixelWidth: number;
  pixelHeight: number;
}

/**
 * Render NPCs to the canvas with Y-sorting and elevation-based priority
 *
 * In the GBA game, each NPC has a sprite priority based on their elevation:
 * - Priority 2 (elevation 0-3, 5, 7, 9, 11, 15): Rendered BELOW BG1 (behind bridges/overlays)
 * - Priority 1 (elevation 4, 6, 8, 10, 12): Rendered ABOVE BG1 (same level as bridges)
 * - Priority 0 (elevation 13, 14): Rendered ABOVE everything
 *
 * NPCs at the SAME priority as the player should be Y-sorted with the player.
 * NPCs at DIFFERENT priority should be rendered in separate passes (before/after BG layers).
 *
 * @param ctx Canvas 2D context
 * @param npcs Array of visible NPCs to render
 * @param view Current camera/viewport info
 * @param playerTileY Player's tile Y for Y-sorting
 * @param layer 'bottom' for NPCs behind player, 'top' for NPCs in front
 * @param priorityFilter Optional: only render NPCs with this sprite priority (0, 1, or 2)
 * @param excludePlayerPriority Optional: exclude NPCs at this priority (player's priority)
 *        so they can be Y-sorted with player in the player layer instead
 */
export function renderNPCs(
  ctx: CanvasRenderingContext2D,
  npcs: NPCObject[],
  view: NPCRenderView,
  playerTileY: number,
  layer: 'bottom' | 'top',
  priorityFilter?: number,
  excludePlayerPriority?: number
): void {
  if (npcs.length === 0) return;

  ctx.imageSmoothingEnabled = false;

  for (const npc of npcs) {
    // Skip invisible NPCs or sprite-hidden NPCs (MOVEMENT_TYPE_INVISIBLE)
    if (!npc.visible || npc.spriteHidden) continue;

    // Get NPC's sprite priority based on their elevation
    // This matches GBA behavior: sElevationToPriority[elevation]
    const npcPriority = getSpritePriorityForElevation(npc.elevation);

    // Filter by priority if specified
    if (priorityFilter !== undefined && npcPriority !== priorityFilter) continue;

    // Exclude NPCs at player's priority (they'll be Y-sorted with player in player layer)
    if (excludePlayerPriority !== undefined && npcPriority === excludePlayerPriority) continue;

    // Y-sorting: NPCs at Y < playerY are behind (bottom layer)
    // NPCs at Y >= playerY are in front (top layer)
    const isInFront = npc.tileY >= playerTileY;

    // Filter by layer
    if (layer === 'bottom' && isInFront) continue;
    if (layer === 'top' && !isInFront) continue;

    // Get sprite
    const sprite = npcSpriteCache.get(npc.graphicsId);
    if (!sprite) continue;

    // Get frame info - use animation system for animated NPCs
    let frameIndex: number;
    let flipHorizontal: boolean;

    // Check if NPC is walking (has sub-tile offset = mid-movement)
    const isNpcMoving = npc.isWalking ?? false;

    if (shouldAnimate(npc.graphicsId)) {
      // Get animation state for this NPC (creates if doesn't exist)
      // Use stable ID (localId + initial position) so animation state persists during movement
      const npcId = `npc_${npc.localId}_${npc.initialTileX ?? npc.tileX}_${npc.initialTileY ?? npc.tileY}`;
      // Ensure animation state exists (creates if needed)
      npcAnimationManager.getState(
        npcId,
        npc.graphicsId,
        npc.direction,
        isNpcMoving // Use actual walking state for walk animation
      );
      const frameInfo = npcAnimationManager.getFrameInfo(npcId);
      if (frameInfo) {
        frameIndex = frameInfo.frameIndex;
        flipHorizontal = frameInfo.hFlip;
      } else {
        // Fallback to static frame (with frame mapping)
        const staticInfo = getNPCFrameInfo(npc.direction, isNpcMoving, 0, npc.graphicsId);
        frameIndex = staticInfo.frameIndex;
        flipHorizontal = staticInfo.flipHorizontal;
      }
    } else {
      // Static/inanimate sprite - use simple frame lookup (with frame mapping)
      const staticInfo = getNPCFrameInfo(npc.direction, isNpcMoving, 0, npc.graphicsId);
      frameIndex = staticInfo.frameIndex;
      flipHorizontal = staticInfo.flipHorizontal;
    }

    const { sx, sy, sw, sh } = getNPCFrameRect(frameIndex, npc.graphicsId);

    // Calculate world position with sub-tile offset for smooth movement
    // NPCs are positioned at tile center, sprite is drawn from top-left
    // Center sprite horizontally on tile, feet at bottom of tile
    //
    // pokeemerald uses centerToCornerVec to center sprites:
    //   centerToCornerVecX = -(width >> 1)  → shifts left by half width
    //   centerToCornerVecY = -(height >> 1) → shifts up by half height
    //
    // For horizontal centering: tileX*16 + 8 (tile center) - sw/2 (sprite center)
    //   = tileX*16 + (16 - sw)/2
    // For vertical: feet at tile bottom, so top = tileY*16 + 16 - height
    //   = tileY*16 - (height - 16)
    const subTileX = npc.subTileX ?? 0;
    const subTileY = npc.subTileY ?? 0;
    const worldX = npc.tileX * METATILE_SIZE + subTileX + Math.floor((METATILE_SIZE - sw) / 2);
    const worldY = npc.tileY * METATILE_SIZE + subTileY - (sh - METATILE_SIZE);

    // Calculate screen position
    const screenX = Math.round(worldX - view.cameraWorldX);
    const screenY = Math.round(worldY - view.cameraWorldY);

    // Viewport culling
    if (
      screenX + sw < 0 ||
      screenX > view.pixelWidth ||
      screenY + sh < 0 ||
      screenY > view.pixelHeight
    ) {
      continue;
    }

    // Draw sprite (with optional horizontal flip for east-facing)
    if (flipHorizontal) {
      ctx.save();
      ctx.translate(screenX + sw, screenY);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, sx, sy, sw, sh, 0, 0, sw, sh);
      ctx.restore();
    } else {
      ctx.drawImage(sprite, sx, sy, sw, sh, screenX, screenY, sw, sh);
    }
  }
}

/**
 * Render a single NPC for debugging or special cases
 */
export function renderSingleNPC(
  ctx: CanvasRenderingContext2D,
  npc: NPCObject,
  screenX: number,
  screenY: number,
  direction?: NPCDirection
): void {
  const sprite = npcSpriteCache.get(npc.graphicsId);
  if (!sprite) return;

  const dir = direction ?? npc.direction;
  const { frameIndex, flipHorizontal } = getNPCFrameInfo(dir, false, 0, npc.graphicsId);
  const { sx, sy, sw, sh } = getNPCFrameRect(frameIndex, npc.graphicsId);

  ctx.imageSmoothingEnabled = false;

  if (flipHorizontal) {
    ctx.save();
    ctx.translate(screenX + sw, screenY);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, sx, sy, sw, sh, 0, 0, sw, sh);
    ctx.restore();
  } else {
    ctx.drawImage(sprite, sx, sy, sw, sh, screenX, screenY, sw, sh);
  }
}

/**
 * Render water/ice reflections for all visible NPCs
 *
 * This implements the same reflection behavior as the GBA game:
 * - Reflections appear on water/ice tiles below NPCs
 * - Vertically flipped sprite with blue/ice tint
 * - Masked to only show on reflective tile pixels
 *
 * Reflections are rendered BEFORE NPCs so they appear underneath.
 *
 * @param ctx Canvas 2D context
 * @param npcs Array of visible NPCs
 * @param view Current camera/viewport info
 * @param renderContext Render context for tile masks and reflection detection
 */
export function renderNPCReflections(
  ctx: CanvasRenderingContext2D,
  npcs: NPCObject[],
  view: NPCRenderView,
  renderContext: RenderContext
): void {
  if (npcs.length === 0) return;

  for (const npc of npcs) {
    // Skip invisible NPCs or sprite-hidden NPCs (MOVEMENT_TYPE_INVISIBLE)
    if (!npc.visible || npc.spriteHidden) continue;

    // Get sprite
    const sprite = npcSpriteCache.get(npc.graphicsId);
    if (!sprite) continue;

    // Get frame info - use animation system for animated NPCs
    let frameIndex: number;
    let flipHorizontal: boolean;

    const isNpcMoving = npc.isWalking ?? false;

    if (shouldAnimate(npc.graphicsId)) {
      const npcId = `npc_${npc.localId}_${npc.initialTileX ?? npc.tileX}_${npc.initialTileY ?? npc.tileY}`;
      const frameInfo = npcAnimationManager.getFrameInfo(npcId);
      if (frameInfo) {
        frameIndex = frameInfo.frameIndex;
        flipHorizontal = frameInfo.hFlip;
      } else {
        const staticInfo = getNPCFrameInfo(npc.direction, isNpcMoving, 0, npc.graphicsId);
        frameIndex = staticInfo.frameIndex;
        flipHorizontal = staticInfo.flipHorizontal;
      }
    } else {
      const staticInfo = getNPCFrameInfo(npc.direction, isNpcMoving, 0, npc.graphicsId);
      frameIndex = staticInfo.frameIndex;
      flipHorizontal = staticInfo.flipHorizontal;
    }

    const { sx, sy, sw, sh } = getNPCFrameRect(frameIndex, npc.graphicsId);

    // Compute reflection state for this NPC
    // Use initial tile position for reflection detection (not sub-tile)
    const reflectionState = computeObjectReflectionState(
      renderContext,
      npc.tileX,
      npc.tileY,
      npc.initialTileX ?? npc.tileX,  // prevTileX
      npc.initialTileY ?? npc.tileY,  // prevTileY
      sw,
      sh
    );

    // Skip if no reflection
    if (!reflectionState.hasReflection) continue;

    // Calculate world position with sub-tile offset (same as renderNPCs)
    // Center sprite horizontally on tile using pokeemerald formula
    const subTileX = npc.subTileX ?? 0;
    const subTileY = npc.subTileY ?? 0;
    const worldX = npc.tileX * METATILE_SIZE + subTileX + Math.floor((METATILE_SIZE - sw) / 2);
    const worldY = npc.tileY * METATILE_SIZE + subTileY - (sh - METATILE_SIZE);

    // Viewport culling for reflection
    // Reflection appears below sprite, so check slightly larger area
    const reflectionY = worldY + sh - 2;
    const screenX = Math.round(worldX - view.cameraWorldX);
    const screenY = Math.round(reflectionY - view.cameraWorldY);
    if (
      screenX + sw < 0 ||
      screenX > view.pixelWidth ||
      screenY + sh < 0 ||
      screenY > view.pixelHeight
    ) {
      continue;
    }

    // Create sprite frame info for the generic reflection renderer
    const frameInfo: SpriteFrameInfo = {
      sprite,
      sx,
      sy,
      sw,
      sh,
      flip: flipHorizontal,
      worldX,
      worldY,
      tileX: npc.tileX,
      tileY: npc.tileY,
    };

    // Render the reflection
    ObjectRenderer.renderObjectReflection(ctx, frameInfo, reflectionState, view, renderContext);
  }
}

/**
 * Grass sprite cache for NPC grass effects
 */
interface GrassSpriteCache {
  tallGrass: HTMLCanvasElement | null;
  longGrass: HTMLCanvasElement | null;
}

/**
 * Render grass effects over NPCs standing on grass tiles
 *
 * In the GBA game, NPCs standing on tall/long grass have the grass sprite
 * rendered OVER them, showing only their upper body (head and shoulders).
 * The grass effect uses frame 0 (the "resting" state) which shows the grass
 * at full coverage.
 *
 * This should be called AFTER rendering NPC sprites so grass covers them.
 *
 * @param ctx Canvas 2D context
 * @param npcs Array of visible NPCs
 * @param view Current camera/viewport info
 * @param renderContext Render context for tile behavior lookup
 * @param grassSprites Cached grass sprite canvases
 */
export function renderNPCGrassEffects(
  ctx: CanvasRenderingContext2D,
  npcs: NPCObject[],
  view: NPCRenderView,
  renderContext: RenderContext,
  grassSprites: GrassSpriteCache
): void {
  if (npcs.length === 0) return;

  const GRASS_FRAME_SIZE = 16;
  const GRASS_RESTING_FRAME = 0; // Frame 0 = grass covering character's lower body

  ctx.imageSmoothingEnabled = false;

  for (const npc of npcs) {
    // Skip invisible NPCs or sprite-hidden NPCs (MOVEMENT_TYPE_INVISIBLE)
    if (!npc.visible || npc.spriteHidden) continue;

    // Calculate the tile where the NPC visually appears
    // During walking: tileX/tileY is DESTINATION, but visual position is SOURCE
    // subTileX/Y goes from -16 to 0, so if non-zero, NPC is visually on previous tile
    let visualTileX = npc.tileX;
    let visualTileY = npc.tileY;

    if (npc.isWalking) {
      // NPC is walking - calculate source tile from subTile offset
      // subTileX/Y is negative during walk (e.g., -16 to 0)
      // If subTileX < 0, NPC came from the tile to the left (or right if positive direction)
      const subTileX = npc.subTileX ?? 0;
      const subTileY = npc.subTileY ?? 0;

      // Determine source tile based on sub-tile offset direction
      if (subTileX < -8) visualTileX = npc.tileX - 1;
      else if (subTileX > 8) visualTileX = npc.tileX + 1;

      if (subTileY < -8) visualTileY = npc.tileY - 1;
      else if (subTileY > 8) visualTileY = npc.tileY + 1;
    }

    // Check if NPC's visual position is on a grass tile
    const tileInfo = getMetatileBehavior(renderContext, visualTileX, visualTileY);
    if (!tileInfo) continue;

    const behavior = tileInfo.behavior;
    let grassSprite: HTMLCanvasElement | null = null;

    if (isTallGrassBehavior(behavior)) {
      grassSprite = grassSprites.tallGrass;
    } else if (isLongGrassBehavior(behavior)) {
      grassSprite = grassSprites.longGrass;
    }

    if (!grassSprite) continue;

    // Grass effect is positioned at tile center (FIXED position, doesn't move with NPC)
    const worldX = visualTileX * METATILE_SIZE + METATILE_SIZE / 2;
    const worldY = visualTileY * METATILE_SIZE + METATILE_SIZE / 2;

    // Convert to screen coordinates (top-left corner of grass sprite)
    const screenX = Math.round(worldX - view.cameraWorldX - GRASS_FRAME_SIZE / 2);
    const screenY = Math.round(worldY - view.cameraWorldY - GRASS_FRAME_SIZE / 2);

    // Viewport culling
    if (
      screenX + GRASS_FRAME_SIZE < 0 ||
      screenX > view.pixelWidth ||
      screenY + GRASS_FRAME_SIZE < 0 ||
      screenY > view.pixelHeight
    ) {
      continue;
    }

    // Draw grass sprite frame 0 (resting state = full coverage)
    const sx = GRASS_RESTING_FRAME * GRASS_FRAME_SIZE;
    ctx.drawImage(
      grassSprite,
      sx, 0, GRASS_FRAME_SIZE, GRASS_FRAME_SIZE,
      screenX, screenY, GRASS_FRAME_SIZE, GRASS_FRAME_SIZE
    );
  }
}
