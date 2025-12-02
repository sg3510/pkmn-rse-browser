/**
 * CompositeOrder - Shared Render Order Definition
 *
 * IMPORTANT: Both Canvas2D (useCompositeScene.ts) and WebGL (WebGLMapPage.tsx)
 * MUST follow this order to maintain visual consistency.
 *
 * This file exists because the render order diverged between renderers,
 * causing bugs like gym doors not being visible in WebGL (door animations
 * were rendered before TopAbove, which covered them).
 *
 * The GBA renders layers in priority order:
 * - BG0-BG3 at different priorities
 * - Sprites (OAM) at priorities 0-3
 * - Sprite priority determines if they appear above/below BG layers
 */

/**
 * The canonical render order for scene compositing.
 * Array index = render order (0 = first/bottom, higher = last/top)
 */
export const COMPOSITE_ORDER = [
  // === BACKGROUND LAYER ===
  'background',           // BG tiles (ground, water, etc.)

  // === PRIORITY 2/3 SPRITES (behind bridges) ===
  'sprites_p2_bottom',    // NPCs with P2 priority, Y < player
  'sprites_p2_top',       // NPCs with P2 priority, Y >= player

  // === TOP BELOW LAYER ===
  'topBelow',             // Bridge underside, tree tops that player walks behind

  // === DOOR ANIMATIONS ===
  // CRITICAL: Door animations render AFTER topBelow but BEFORE sprites+player
  // This ensures:
  // 1. Doors are not covered by building facades (topBelow)
  // 2. Player walks IN FRONT of open doors (not behind them)
  'doorAnimations',

  // === ARROW OVERLAY ===
  'arrowOverlay',         // Directional arrow for arrow warps

  // === REFLECTIONS ===
  'playerReflection',     // Player reflection on water
  'npcReflections',       // NPC reflections on water

  // === PRIORITY 1 SPRITES + PLAYER (Y-sorted) ===
  'fieldEffects_bottom',  // Grass/sand effects behind player
  'itemBalls_bottom',     // Item balls behind player
  'sprites_p1_bottom',    // NPCs with P1 priority, Y < player
  'npcGrassEffects',      // Grass effects over NPCs
  'surfBlob',             // Surf blob (rendered before player)
  'player',               // Player sprite
  'fieldEffects_top',     // Grass/sand effects in front of player
  'itemBalls_top',        // Item balls in front of player
  'sprites_p1_top',       // NPCs with P1 priority, Y >= player

  // === TOP ABOVE LAYER ===
  'topAbove',             // Building facades, tree canopies that cover player

  // === PRIORITY 0 SPRITES (above everything) ===
  'sprites_p0_bottom',    // NPCs with P0 priority, Y < player
  'sprites_p0_top',       // NPCs with P0 priority, Y >= player

  // === OVERLAYS ===
  'debugOverlay',         // Collision/elevation debug overlays
  'fadeOverlay',          // Screen fade effect
] as const;

export type CompositeLayer = (typeof COMPOSITE_ORDER)[number];

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
 * Call this in debug mode to verify door animations are rendered
 * at the correct position in the compositing order.
 */
export function verifyDoorAnimationOrder(): void {
  const doorIndex = getLayerIndex('doorAnimations');
  const topBelowIndex = getLayerIndex('topBelow');
  const playerIndex = getLayerIndex('player');
  const topAboveIndex = getLayerIndex('topAbove');

  const isCorrect =
    doorIndex > topBelowIndex &&  // After topBelow (not covered by bridges)
    doorIndex < playerIndex &&    // Before player (player walks in front)
    doorIndex < topAboveIndex;    // Before topAbove (not covered by facades)

  if (!isCorrect) {
    console.error('[CompositeOrder] Door animation order is incorrect!', {
      doorIndex,
      topBelowIndex,
      playerIndex,
      topAboveIndex,
    });
  }
}
