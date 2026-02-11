/**
 * Sprite Batcher
 *
 * Unified sprite batch building for both WebGL and Canvas2D renderers.
 * This ensures both renderers produce identical sprite ordering.
 *
 * The batcher takes game state (player, NPCs, field effects) and produces
 * sorted sprite batches ready for rendering. Both renderers MUST use this
 * to ensure visual parity.
 *
 * GBA Render Order (approximate):
 * 1. Low priority NPCs (P2/P3 behind bridge tiles)
 * 2. Y-sorted sprites (player, NPCs at same elevation, field effects)
 * 3. High priority NPCs (P0 above all BG layers)
 */

import type { PlayerController } from '../game/PlayerController';
import type { NPCObject, ItemBallObject } from '../types/objectEvents';
import type { FieldEffectForRendering } from '../game/FieldEffectManager';
// Note: SpriteInstance is the WebGL sprite format. This module returns
// SortableSpriteInfo which is renderer-agnostic. Renderers convert to their format.
import {
  getPlayerFeetY,
  getPlayerCenterY,
  getNPCFeetY,
  calculateSortKey,
  DEFAULT_SPRITE_SUBPRIORITY,
  FIELD_EFFECT_FRONT_SUBPRIORITY,
  FIELD_EFFECT_BEHIND_SUBPRIORITY,
  METATILE_SIZE,
} from '../game/playerCoords';
import { getNPCRenderLayer } from '../utils/elevationPriority';
import { computeFieldEffectLayer } from './fieldEffectUtils';

// =============================================================================
// Types
// =============================================================================

/**
 * Minimal sprite info for sorting (renderer-agnostic)
 *
 * This is the common data needed for Y-sorting. Renderers convert this
 * to their specific sprite format (SpriteInstance for WebGL, draw calls for Canvas2D).
 */
export interface SortableSpriteInfo {
  /** Unique identifier for this sprite */
  id: string;

  /** Type of sprite for renderer-specific handling */
  type: 'player' | 'npc' | 'fieldEffect' | 'playerShadow' | 'reflection' | 'itemBall';

  /** Sort key for Y-ordering (higher = renders later = in front) */
  sortKey: number;

  /** World tile X */
  tileX: number;

  /** World tile Y */
  tileY: number;

  /** For NPCs: the NPC object */
  npc?: NPCObject;

  /** For item balls: the item ball object */
  itemBall?: ItemBallObject;

  /** For field effects: the effect data */
  fieldEffect?: FieldEffectForRendering;

  /** For field effects: which layer (behind = behind player, front = in front) */
  effectLayer?: 'front' | 'behind';

  /** For player: reference to controller */
  player?: PlayerController;
}

/**
 * Result of building sprite batches
 *
 * Sprites are separated into priority groups for correct GBA render order.
 */
export interface SpriteBatchResult {
  /**
   * Low priority sprites (P2/P3 NPCs when player is on bridge)
   * Render BEFORE TopBelow layer
   */
  lowPriority: SortableSpriteInfo[];

  /**
   * Y-sorted sprites (player, most NPCs, field effects)
   * Render between TopBelow and TopAbove layers
   * Already sorted by sortKey (ascending = back to front)
   */
  ySorted: SortableSpriteInfo[];

  /**
   * High priority sprites (P0 NPCs at elevation 13-14)
   * Render AFTER TopAbove layer
   */
  highPriority: SortableSpriteInfo[];

  /**
   * Player's sort key (for debug/comparison)
   */
  playerSortKey: number;

  /**
   * Player's feet Y position
   */
  playerFeetY: number;

  /**
   * Player's center Y position (for field effect layer comparison)
   */
  playerCenterY: number;
}

/**
 * Options for building sprite batches
 */
export interface SpriteBatchOptions {
  /** Include player shadow (when jumping) */
  includePlayerShadow?: boolean;

  /** Player is hidden (don't include player sprite) */
  playerHidden?: boolean;

  /** Include reflections for sprites on reflective tiles */
  includeReflections?: boolean;
}

// =============================================================================
// Main Batch Builder
// =============================================================================

/**
 * Build sprite batches for rendering
 *
 * This is the core function that both WebGL and Canvas2D renderers should use.
 * It takes the current game state and produces sorted sprite batches.
 *
 * @param player - The player controller
 * @param npcs - Visible NPCs to render
 * @param fieldEffects - Active field effects (grass, water, sand, etc.)
 * @param options - Optional configuration
 * @param itemBalls - Visible item balls to render
 * @returns Sorted sprite batches ready for rendering
 */
export function buildSpriteBatches(
  player: PlayerController,
  npcs: NPCObject[],
  fieldEffects: FieldEffectForRendering[],
  options: SpriteBatchOptions = {},
  itemBalls: ItemBallObject[] = []
): SpriteBatchResult {
  const playerFeetY = getPlayerFeetY(player);
  const playerCenterY = getPlayerCenterY(player);
  const playerSortKey = calculateSortKey(playerFeetY, DEFAULT_SPRITE_SUBPRIORITY);
  const playerElevation = player.getElevation();

  const lowPriority: SortableSpriteInfo[] = [];
  const ySorted: SortableSpriteInfo[] = [];
  const highPriority: SortableSpriteInfo[] = [];

  // --- Add player ---
  if (!options.playerHidden) {
    ySorted.push({
      id: 'player',
      type: 'player',
      sortKey: playerSortKey,
      tileX: player.tileX,
      tileY: player.tileY,
      player,
    });

    // Add player shadow if jumping
    if (options.includePlayerShadow && player.showShadow) {
      ySorted.push({
        id: 'player-shadow',
        type: 'playerShadow',
        sortKey: playerSortKey, // Shadow at same Y as player feet
        tileX: player.tileX,
        tileY: player.tileY,
        player,
      });
    }
  }

  // --- Add NPCs ---
  for (const npc of npcs) {
    if (!npc.visible || npc.spriteHidden) continue;

    // Include subTileY offset for smooth Y-sorting during movement
    const subTileY = npc.subTileY ?? 0;
    const npcFeetY = getNPCFeetY(npc.tileY) + subTileY;
    const npcSortKey = calculateSortKey(npcFeetY, DEFAULT_SPRITE_SUBPRIORITY);
    const renderLayer = getNPCRenderLayer(npc.elevation, playerElevation);

    const spriteInfo: SortableSpriteInfo = {
      id: `npc-${npc.id}`,
      type: 'npc',
      sortKey: npcSortKey,
      tileX: npc.tileX,
      tileY: npc.tileY,
      npc,
    };

    if (renderLayer === 'aboveAll') {
      highPriority.push(spriteInfo);
    } else if (renderLayer === 'behindBridge') {
      lowPriority.push(spriteInfo);
    } else {
      // 'withPlayer' - Y-sorted with player
      ySorted.push(spriteInfo);
    }
  }

  // --- Add field effects ---
  // Build a map of NPC positions for owner-relative sorting
  const npcPositions = new Map<string, { feetY: number; sortKey: number }>();
  for (const npc of npcs) {
    if (!npc.visible || npc.spriteHidden) continue;
    const subTileY = npc.subTileY ?? 0;
    const npcFeetY = getNPCFeetY(npc.tileY) + subTileY;
    const npcSortKey = calculateSortKey(npcFeetY, DEFAULT_SPRITE_SUBPRIORITY);
    npcPositions.set(npc.id, { feetY: npcFeetY, sortKey: npcSortKey });
  }

  for (const effect of fieldEffects) {
    if (!effect.visible) continue;

    // Check if this effect belongs to an NPC (using ownerObjectId)
    const ownerNpcInfo = npcPositions.get(effect.ownerObjectId);

    const effectTileX = Math.floor(effect.worldX / METATILE_SIZE);
    const effectTileY = Math.floor(effect.worldY / METATILE_SIZE);

    // Determine if this effect renders in front or behind its owner
    // For player effects, use player position; for NPC effects, use NPC position
    let effectLayer: 'front' | 'behind';
    let sortKeyY: number;
    let subpriority: number;

    if (ownerNpcInfo && effect.type !== 'sand' && effect.type !== 'deep_sand' &&
        effect.type !== 'puddle_splash' && effect.type !== 'water_ripple') {
      // NPC grass effect - sort relative to NPC owner
      // Grass should render ON TOP of NPC (in front) unless renderBehindPlayer is set
      if (effect.renderBehindPlayer) {
        effectLayer = 'behind';
        sortKeyY = effect.worldY;
        subpriority = FIELD_EFFECT_BEHIND_SUBPRIORITY;
      } else {
        // Render in front of owner NPC
        effectLayer = 'front';
        sortKeyY = ownerNpcInfo.feetY;
        // Use a slightly higher sort key than the NPC to ensure grass is ON TOP
        subpriority = FIELD_EFFECT_FRONT_SUBPRIORITY;
      }
    } else {
      // Player effect or non-grass effect - use original logic
      effectLayer = computeFieldEffectLayer(effect, playerCenterY);

      if (effectLayer === 'front') {
        // Front effects use player's feet Y + higher subpriority to render after player
        sortKeyY = playerFeetY;
        subpriority = FIELD_EFFECT_FRONT_SUBPRIORITY;
      } else {
        // Behind effects use their own worldY with lower subpriority
        sortKeyY = effect.worldY;
        subpriority = FIELD_EFFECT_BEHIND_SUBPRIORITY;
      }
    }

    const sortKey = calculateSortKey(sortKeyY, subpriority);

    ySorted.push({
      id: `effect-${effect.id}`,
      type: 'fieldEffect',
      sortKey,
      tileX: effectTileX,
      tileY: effectTileY,
      fieldEffect: effect,
      effectLayer,
    });
  }

  // --- Add item balls ---
  // Item balls are Y-sorted with player like NPCs
  // They use the same feet Y calculation as NPCs (tile bottom)
  for (const item of itemBalls) {
    // Item balls are 16x16, positioned at tile top-left
    // Feet Y is at tile bottom (tileY * 16 + 16 = (tileY + 1) * 16)
    const itemFeetY = (item.tileY + 1) * METATILE_SIZE;
    const itemSortKey = calculateSortKey(itemFeetY, DEFAULT_SPRITE_SUBPRIORITY);

    ySorted.push({
      id: `item-${item.id}`,
      type: 'itemBall',
      sortKey: itemSortKey,
      tileX: item.tileX,
      tileY: item.tileY,
      itemBall: item,
    });
  }

  // --- Sort Y-sorted batch ---
  ySorted.sort((a, b) => a.sortKey - b.sortKey);

  return {
    lowPriority,
    ySorted,
    highPriority,
    playerSortKey,
    playerFeetY,
    playerCenterY,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Find the player's index in the Y-sorted batch
 *
 * Useful for Canvas2D renderer which needs to render sprites before and after player.
 */
export function findPlayerIndex(batch: SortableSpriteInfo[]): number {
  return batch.findIndex(s => s.type === 'player');
}

/**
 * Split Y-sorted batch around the player
 *
 * Returns sprites that render before (behind) and after (in front of) the player.
 * Useful for Canvas2D which renders in separate passes.
 */
export function splitAroundPlayer(batch: SortableSpriteInfo[]): {
  before: SortableSpriteInfo[];
  player: SortableSpriteInfo | null;
  after: SortableSpriteInfo[];
} {
  const playerIndex = findPlayerIndex(batch);

  if (playerIndex === -1) {
    return { before: batch, player: null, after: [] };
  }

  return {
    before: batch.slice(0, playerIndex),
    player: batch[playerIndex],
    after: batch.slice(playerIndex + 1),
  };
}

/**
 * Get field effects that should render in a specific layer
 *
 * Convenience function for Canvas2D renderer which renders effects in passes.
 * Maps 'bottom'/'top' to 'behind'/'front' for compatibility with Canvas2D terminology.
 */
export function getEffectsForLayer(
  batch: SortableSpriteInfo[],
  layer: 'bottom' | 'top'
): SortableSpriteInfo[] {
  const effectLayer = layer === 'bottom' ? 'behind' : 'front';
  return batch.filter(s => s.type === 'fieldEffect' && s.effectLayer === effectLayer);
}

/**
 * Get NPCs from a batch
 */
export function getNPCsFromBatch(batch: SortableSpriteInfo[]): SortableSpriteInfo[] {
  return batch.filter(s => s.type === 'npc');
}

/**
 * Get field effects owned by a specific NPC
 *
 * Useful for Canvas2D renderer to render NPC grass effects right after the NPC.
 */
export function getEffectsForNPC(
  batch: SortableSpriteInfo[],
  npcId: string
): SortableSpriteInfo[] {
  return batch.filter(
    s => s.type === 'fieldEffect' &&
         s.fieldEffect?.ownerObjectId === npcId
  );
}

/**
 * Get field effects that belong to the player (not to any NPC)
 *
 * Used by Canvas2D renderer to render player grass effects relative to player.
 */
export function getPlayerEffectsForLayer(
  batch: SortableSpriteInfo[],
  layer: 'bottom' | 'top',
  npcIds: Set<string>
): SortableSpriteInfo[] {
  const effectLayer = layer === 'bottom' ? 'behind' : 'front';
  return batch.filter(
    s => s.type === 'fieldEffect' &&
         s.effectLayer === effectLayer &&
         s.fieldEffect &&
         !npcIds.has(s.fieldEffect.ownerObjectId)
  );
}
