/**
 * CompositeOrder - Shared Render Order Definition
 *
 * IMPORTANT: Both Canvas2D (useCompositeScene.ts) and WebGL (WebGLMapPage.tsx)
 * MUST follow this order to maintain visual consistency.
 *
 * ## GBA Hardware Priority System
 *
 * The GBA uses a 4-tier priority system (0-3) for both sprites and backgrounds.
 * LOWER numbers = HIGHER priority = drawn ON TOP.
 *
 * ### BG Layer Configuration (from overworld.c)
 * - BG0 (priority 0): UI, menus, text boxes
 * - BG1 (priority 1): Top layer tiles (facades, roofs, DOORS)
 * - BG2 (priority 2): Bottom layer tiles (ground)
 * - BG3 (priority 3): Background (sky, scenery)
 *
 * ### Sprite Priority from Elevation (from event_object_movement.c)
 * sElevationToPriority[] = { 2,2,2,2,1,2,1,2,1,2,1,2,1,0,0,2 }
 *                           0 1 2 3 4 5 6 7 8 9 ...
 * - Priority 2: Elevations 0-3, 5, 7, 9, 11, 15 (ground level)
 * - Priority 1: Elevations 4, 6, 8, 10, 12 (elevated - bridges)
 * - Priority 0: Elevations 13-14 (above everything)
 *
 * ### GBA Render Order (back to front)
 * 1. BG3 (priority 3) - background
 * 2. Reflections (OAM priority 3) - always bottommost sprites
 * 3. BG2 (priority 2) - ground tiles
 * 4. Sprites priority 2 - ground-level player/NPCs
 * 5. BG1 (priority 1) - facades, roofs, DOORS
 * 6. Sprites priority 1 - elevated objects (on bridges)
 * 7. BG0 (priority 0) - UI
 * 8. Sprites priority 0 - very high objects (elevation 13-14)
 *
 * ### Key Insight: Doors on GBA
 * On GBA, doors are NOT sprites! They animate by modifying tilemap data
 * directly in VRAM (field_door.c). Door tiles are part of BG1.
 *
 * Our implementation differs: we use sprite overlays for door animations.
 * This requires careful placement in the render order to achieve similar
 * visual results without modifying the tilemap.
 *
 * Reference: public/pokeemerald/src/event_object_movement.c (lines 7729-7789)
 *            public/pokeemerald/src/overworld.c (lines 266-304)
 *            public/pokeemerald/src/field_door.c
 */

/**
 * The canonical render order for scene compositing.
 * Array index = render order (0 = first/bottom, higher = last/top)
 *
 * This order approximates GBA behavior while accounting for our sprite-based
 * door animation system (vs GBA's tilemap-based doors).
 */
export const COMPOSITE_ORDER = [
  // === BG3 EQUIVALENT: BACKGROUND ===
  'background',           // Ground tiles (BG2 on GBA)

  // === REFLECTIONS (OAM Priority 3) ===
  // Per field_effect_helpers.c: reflectionSprite->oam.priority = 3
  'playerReflection',     // Player reflection on water
  'npcReflections',       // NPC reflections on water

  // === PRIORITY 2 SPRITES (ground level, behind BG1) ===
  // These render BEFORE topBelow because on GBA, P2 sprites render before BG1
  'sprites_p2_bottom',    // NPCs with P2 priority, Y < player
  'sprites_p2_top',       // NPCs with P2 priority, Y >= player

  // === BG1 BOTTOM EQUIVALENT: TOP BELOW ===
  // Bridge undersides, elements that player walks behind
  'topBelow',

  // === DOOR ANIMATIONS ===
  // Our sprite-based door system (GBA uses tilemap modifications in BG1)
  // Rendered AFTER topBelow so doors aren't covered by bridge tiles
  // Rendered BEFORE player so player walks IN FRONT of open doors
  'doorAnimations',

  // === ARROW OVERLAY ===
  // Per field_effect_helpers.c: warp arrow uses priority 1
  'arrowOverlay',

  // === PRIORITY 1 SPRITES + PLAYER (Y-sorted) ===
  // Ground-level player and NPCs at same priority, sorted by Y
  'fieldEffects_bottom',  // Grass/sand effects behind player
  'itemBalls_bottom',     // Item balls behind player
  'sprites_p1_bottom',    // NPCs with P1 priority, Y < player
  'npcGrassEffects',      // Grass effects over NPCs
  'surfBlob',             // Surf blob (rendered before player)
  'player',               // Player sprite
  'fieldEffects_top',     // Grass/sand effects in front of player
  'itemBalls_top',        // Item balls in front of player
  'sprites_p1_top',       // NPCs with P1 priority, Y >= player

  // === BG1 TOP EQUIVALENT: TOP ABOVE ===
  // Building facades, tree canopies that cover player
  // On GBA, doors are part of this layer (BG1), but we render them earlier
  // because our door sprites need to appear behind the walking player
  'topAbove',

  // === PRIORITY 0 SPRITES (above everything) ===
  // Elevation 13-14 objects
  'sprites_p0_bottom',    // NPCs with P0 priority, Y < player
  'sprites_p0_top',       // NPCs with P0 priority, Y >= player

  // === BG0 EQUIVALENT: UI OVERLAYS ===
  'debugOverlay',         // Collision/elevation debug overlays
  'fadeOverlay',          // Screen fade effect
] as const;

export type CompositeLayer = (typeof COMPOSITE_ORDER)[number];

// Re-export elevation priority utilities from the canonical source
// See src/utils/elevationPriority.ts for the GBA-accurate priority table
export {
  ELEVATION_TO_PRIORITY,
  getSpritePriorityForElevation,
  getPriorityLayer,
  isLowPriority,
  isHighPriority,
  getNPCRenderLayer,
} from '../utils/elevationPriority';

/**
 * Get the index of a layer in the render order.
 * Lower index = rendered earlier (appears behind).
 */
export function getLayerIndex(layer: CompositeLayer): number {
  return COMPOSITE_ORDER.indexOf(layer);
}

/**
 * Check if layerA should render before layerB.
 */
export function shouldRenderBefore(layerA: CompositeLayer, layerB: CompositeLayer): boolean {
  return getLayerIndex(layerA) < getLayerIndex(layerB);
}

/**
 * Door animation render position verification.
 *
 * Note: Our door animations are sprite overlays, which differs from GBA's
 * tilemap-based doors. On GBA, doors are part of BG1 (same as facades).
 * We render door animations BEFORE player and BEFORE topAbove to achieve
 * the visual effect of player walking into an open doorway.
 */
export function verifyDoorAnimationOrder(): void {
  const doorIndex = getLayerIndex('doorAnimations');
  const topBelowIndex = getLayerIndex('topBelow');
  const playerIndex = getLayerIndex('player');
  const topAboveIndex = getLayerIndex('topAbove');

  const isCorrect =
    doorIndex > topBelowIndex &&  // After topBelow (not covered by bridges)
    doorIndex < playerIndex &&    // Before player (player walks in front)
    doorIndex < topAboveIndex;    // Before topAbove (visible, not covered)

  if (!isCorrect) {
    console.error('[CompositeOrder] Door animation order is incorrect!', {
      doorIndex,
      topBelowIndex,
      playerIndex,
      topAboveIndex,
    });
  }
}
